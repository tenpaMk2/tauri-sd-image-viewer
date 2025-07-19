use image::{GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

/// サムネイルの設定
#[derive(Debug, Clone)]
pub struct ThumbnailConfig {
    pub size: u32,
    pub quality: u8, // JPEG品質 (1-100)
}

impl Default for ThumbnailConfig {
    fn default() -> Self {
        Self {
            size: 300,
            quality: 85,
        }
    }
}

/// サムネイル情報
#[derive(Debug, Serialize, Deserialize)]
pub struct ThumbnailInfo {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
}

/// サムネイルハンドラー
pub struct ThumbnailHandler {
    config: ThumbnailConfig,
    cache_dir: Option<PathBuf>, // 遅延初期化用
}

impl ThumbnailHandler {
    /// 新しいサムネイルハンドラーを作成
    pub fn new(config: ThumbnailConfig) -> Self {
        Self {
            config,
            cache_dir: None,
        }
    }

    /// キャッシュディレクトリを取得または初期化
    fn ensure_cache_dir<R: Runtime>(&mut self, app: &AppHandle<R>) -> Result<&PathBuf, String> {
        if self.cache_dir.is_none() {
            let cache_dir = Self::get_cache_directory(app)?;

            // キャッシュディレクトリを作成
            if !cache_dir.exists() {
                fs::create_dir_all(&cache_dir)
                    .map_err(|e| format!("キャッシュディレクトリの作成に失敗: {}", e))?;
            }

            self.cache_dir = Some(cache_dir);
        }

        Ok(self.cache_dir.as_ref().unwrap())
    }

    /// キャッシュディレクトリのパスを取得
    pub fn get_cache_directory<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        // TauriのPathResolverを使用してアプリケーション専用のキャッシュディレクトリを取得
        let cache_dir = app
            .path()
            .app_cache_dir()
            .map_err(|e| format!("キャッシュディレクトリの取得に失敗: {}", e))?;

        // thumbnailsサブディレクトリを追加
        Ok(cache_dir.join("thumbnails"))
    }

    /// 画像ファイルパスからキャッシュキーを生成
    fn generate_cache_key(&self, image_path: &str) -> String {
        // パスのハッシュ部分
        let mut path_hasher = Sha256::new();
        path_hasher.update(image_path.as_bytes());
        path_hasher.update(self.config.size.to_le_bytes());
        path_hasher.update(self.config.quality.to_le_bytes());
        let path_hash = hex::encode(path_hasher.finalize());

        // ファイルの日付情報とサイズを取得
        if let Ok(metadata) = fs::metadata(image_path) {
            let size = metadata.len();
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                    let timestamp = duration.as_secs();
                    return format!("{}_{}_{}", path_hash, size, timestamp);
                }
            }
            // 日付情報が取得できない場合はサイズのみ
            return format!("{}_{}", path_hash, size);
        }

        // メタデータが取得できない場合はパスハッシュのみ
        path_hash
    }

    /// キャッシュファイルのパスを取得
    fn get_cache_file_path(&self, cache_key: &str) -> Result<PathBuf, String> {
        let cache_dir = self
            .cache_dir
            .as_ref()
            .ok_or("キャッシュディレクトリが初期化されていません")?;
        Ok(cache_dir.join(format!("{}.jpg", cache_key)))
    }

    /// キャッシュが有効かチェック
    fn is_cache_valid(&self, cache_path: &Path, original_path: &str) -> bool {
        log::info!(
            "キャッシュ有効性チェック開始 - キャッシュ: {}, 元ファイル: {}",
            cache_path.display(),
            original_path
        );

        if !cache_path.exists() {
            log::info!("キャッシュファイルが存在しません: {}", cache_path.display());
            return false;
        }

        // 元ファイルが存在するかチェック
        if !Path::new(original_path).exists() {
            log::info!("元ファイルが存在しません: {}", original_path);
            return false;
        }

        // キャッシュキーにファイルサイズと更新時刻が含まれているため、
        // キャッシュファイルが存在すれば有効とみなす
        log::info!("キャッシュ有効: {}", cache_path.display());
        true
    }

    /// 指定されたパスの古いキャッシュファイルを削除
    fn remove_old_cache_files(&self, image_path: &str) -> Result<(), String> {
        let cache_dir = self
            .cache_dir
            .as_ref()
            .ok_or("キャッシュディレクトリが初期化されていません")?;

        if !cache_dir.exists() {
            return Ok(());
        }

        // パスのハッシュ部分を生成（現在のファイルと同じパスを持つキャッシュを特定するため）
        let mut path_hasher = Sha256::new();
        path_hasher.update(image_path.as_bytes());
        path_hasher.update(self.config.size.to_le_bytes());
        path_hasher.update(self.config.quality.to_le_bytes());
        let path_hash = hex::encode(path_hasher.finalize());

        let entries = fs::read_dir(cache_dir)
            .map_err(|e| format!("キャッシュディレクトリの読み取りに失敗: {}", e))?;

        let mut removed_count = 0;
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name() {
                        if let Some(name_str) = file_name.to_str() {
                            // ファイル名がパスハッシュで始まり、.jpgで終わる場合は同じパスのキャッシュ
                            if name_str.starts_with(&path_hash) && name_str.ends_with(".jpg") {
                                match fs::remove_file(&path) {
                                    Ok(_) => {
                                        removed_count += 1;
                                        log::info!(
                                            "古いキャッシュファイルを削除: {}",
                                            path.display()
                                        );
                                    }
                                    Err(e) => {
                                        log::warn!(
                                            "古いキャッシュファイルの削除に失敗: {} ({})",
                                            path.display(),
                                            e
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if removed_count > 0 {
            log::info!("{}個の古いキャッシュファイルを削除しました", removed_count);
        }

        Ok(())
    }

    /// サムネイルを生成または取得
    /// サムネイルを生成または取得
    pub fn get_thumbnail<R: Runtime>(
        &mut self,
        image_path: &str,
        app: &AppHandle<R>,
    ) -> Result<ThumbnailInfo, String> {
        // キャッシュディレクトリを確保
        self.ensure_cache_dir(app)?;

        let cache_key = self.generate_cache_key(image_path);
        let cache_path = self.get_cache_file_path(&cache_key)?;

        // キャッシュが有効かチェック
        if self.is_cache_valid(&cache_path, image_path) {
            let data = fs::read(&cache_path)
                .map_err(|e| format!("キャッシュファイルの読み込みに失敗: {}", e))?;

            log::info!("サムネイルキャッシュから読み込み: {}", cache_path.display());
            return Ok(ThumbnailInfo {
                data,
                width: self.config.size,
                height: self.config.size,
                mime_type: "image/jpeg".to_string(),
            });
        }

        // キャッシュが無効な場合、古いキャッシュファイルを削除
        if let Err(e) = self.remove_old_cache_files(image_path) {
            log::warn!("古いキャッシュファイルの削除に失敗: {}", e);
        }

        // 新しいサムネイルを生成
        let thumbnail_info = self.generate_thumbnail(image_path)?;

        // キャッシュに保存
        if let Err(e) = fs::write(&cache_path, &thumbnail_info.data) {
            log::warn!("サムネイルキャッシュの保存に失敗: {}", e);
        } else {
            log::info!("サムネイルキャッシュに保存: {}", cache_path.display());
        }

        Ok(thumbnail_info)
    }

    /// サムネイルを生成
    fn generate_thumbnail(&self, image_path: &str) -> Result<ThumbnailInfo, String> {
        // 画像を読み込み
        let img =
            image::open(image_path).map_err(|e| format!("画像ファイルの読み込みに失敗: {}", e))?;

        // サムネイルサイズにリサイズ
        let thumbnail = img.thumbnail(self.config.size, self.config.size);
        let (width, height) = thumbnail.dimensions();

        // JPEGにエンコード
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);

        thumbnail
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("サムネイルのエンコードに失敗: {}", e))?;

        Ok(ThumbnailInfo {
            data: buffer,
            width,
            height,
            mime_type: "image/jpeg".to_string(),
        })
    }

    /// キャッシュをクリア（安全版）
    pub fn clear_cache_safe<R: Runtime>(&mut self, app: &AppHandle<R>) -> Result<(), String> {
        self.ensure_cache_dir(app)?;

        let cache_dir = self.cache_dir.as_ref().unwrap();

        if cache_dir.exists() {
            // ディレクトリ内のファイルを読み取り
            let entries = fs::read_dir(cache_dir).map_err(|e| {
                let error_msg = format!(
                    "キャッシュディレクトリの読み取りに失敗: {} (パス: {})",
                    e,
                    cache_dir.display()
                );
                log::error!("{}", error_msg);
                error_msg
            })?;

            let mut deleted_count = 0;
            let mut error_count = 0;

            for entry in entries {
                match entry {
                    Ok(entry) => {
                        let path = entry.path();
                        if path.is_file() {
                            match fs::remove_file(&path) {
                                Ok(_) => {
                                    deleted_count += 1;
                                }
                                Err(e) => {
                                    error_count += 1;
                                    log::warn!(
                                        "ファイルの削除に失敗: {} (パス: {})",
                                        e,
                                        path.display()
                                    );
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error_count += 1;
                        log::warn!("ディレクトリエントリの読み取りに失敗: {}", e);
                    }
                }
            }

            log::info!(
                "キャッシュクリア完了: {}個のファイルを削除、{}個のエラー",
                deleted_count,
                error_count
            );

            if error_count > 0 {
                return Err(format!(
                    "一部のファイルの削除に失敗しました（エラー数: {}）",
                    error_count
                ));
            }
        }

        Ok(())
    }
}

/// サムネイル状態管理用の構造体
pub struct ThumbnailState {
    pub handler: Mutex<ThumbnailHandler>,
}

impl ThumbnailState {
    /// 新しいThumbnailStateを作成
    pub fn new(config: ThumbnailConfig) -> Self {
        let handler = ThumbnailHandler::new(config);
        Self {
            handler: Mutex::new(handler),
        }
    }
}

/// サムネイルを取得するTauriコマンド
#[tauri::command]
pub fn get_thumbnail<R: Runtime>(
    image_path: String,
    app: AppHandle<R>,
    state: tauri::State<ThumbnailState>,
) -> Result<ThumbnailInfo, String> {
    let mut handler = state.handler.lock().map_err(|e| {
        let error_msg = format!("サムネイルハンドラーのロックに失敗: {:?}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;

    handler.get_thumbnail(&image_path, &app)
}

/// サムネイルキャッシュをクリアするTauriコマンド
#[tauri::command]
pub fn clear_thumbnail_cache<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<ThumbnailState>,
) -> Result<(), String> {
    let mut handler = state
        .handler
        .lock()
        .map_err(|_| "サムネイルハンドラーのロックに失敗")?;
    handler.clear_cache_safe(&app)
}
