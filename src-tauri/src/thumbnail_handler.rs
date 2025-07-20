use image::GenericImageView;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};
use webp::Encoder;

/// サムネイルの設定
#[derive(Debug, Clone)]
pub struct ThumbnailConfig {
    pub size: u32,
    pub quality: u8, // WebP品質 (1-100)
}

impl Default for ThumbnailConfig {
    fn default() -> Self {
        Self {
            size: 300,
            quality: 50,
        }
    }
}

/// サムネイル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailInfo {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
}

/// バッチサムネイル結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchThumbnailResult {
    pub path: String,
    pub thumbnail: Option<ThumbnailInfo>,
    pub error: Option<String>,
}

/// サムネイルハンドラー
pub struct ThumbnailHandler {
    config: ThumbnailConfig,
    cache_dir: PathBuf, // Mutexなし！初期化時に設定
}

impl ThumbnailHandler {
    /// 新しいサムネイルハンドラーを作成
    pub fn new<R: Runtime>(config: ThumbnailConfig, app: &AppHandle<R>) -> Result<Self, String> {
        let cache_dir = Self::get_cache_directory(app)?;

        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)
                .map_err(|e| format!("キャッシュディレクトリの作成に失敗: {}", e))?;
        }

        Ok(Self { config, cache_dir })
    }

    /// キャッシュディレクトリのパスを取得
    pub fn get_cache_directory<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        app.path()
            .app_cache_dir()
            .map(|cache_dir| cache_dir.join("thumbnails"))
            .map_err(|e| format!("キャッシュディレクトリの取得に失敗: {}", e))
    }

    /// パスのハッシュ部分を生成（主キー：ファイルパスのみ）
    fn generate_path_hash(&self, image_path: &str) -> String {
        let mut path_hasher = Sha256::new();
        path_hasher.update(image_path.as_bytes());
        hex::encode(path_hasher.finalize())
    }

    /// 設定とファイルサイズのハッシュを生成（副キー）
    fn generate_content_hash(&self, image_path: &str) -> String {
        let mut content_hasher = Sha256::new();
        content_hasher.update(self.config.size.to_le_bytes());
        content_hasher.update(self.config.quality.to_le_bytes());

        // ファイルサイズを取得
        if let Ok(metadata) = fs::metadata(image_path) {
            content_hasher.update(metadata.len().to_le_bytes());
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                    content_hasher.update(duration.as_secs().to_le_bytes());
                }
            }
        }

        hex::encode(content_hasher.finalize())
    }

    /// 画像ファイルパスからキャッシュキーを生成
    fn generate_cache_key(&self, image_path: &str) -> String {
        let path_hash = self.generate_path_hash(image_path);
        let content_hash = self.generate_content_hash(image_path);
        format!("{}_{}", path_hash, content_hash)
    }

    /// キャッシュが有効かチェック
    fn is_cache_valid(&self, cache_path: &PathBuf, original_path: &str) -> bool {
        let cache_exists = cache_path.exists();
        let original_exists = std::path::Path::new(original_path).exists();

        matches!((cache_exists, original_exists), (true, true))
    }

    /// キャッシュファイルが古いキャッシュかどうかをチェック
    fn is_old_cache_file(&self, file_name: &str, path_hash: &str) -> bool {
        file_name.starts_with(path_hash) && file_name.ends_with(".webp")
    }

    /// 指定されたパスの古いキャッシュファイルを削除
    fn remove_old_cache_files(&self, image_path: &str) -> Result<(), String> {
        if !self.cache_dir.exists() {
            return Ok(());
        }

        let path_hash = self.generate_path_hash(image_path);
        let entries = fs::read_dir(&self.cache_dir)
            .map_err(|e| format!("キャッシュディレクトリの読み取りに失敗: {}", e))?;

        let mut removed_count = 0;
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };

            if !self.is_old_cache_file(file_name, &path_hash) {
                continue;
            }

            // 現在のキャッシュキーと一致する場合はスキップ
            let current_cache_key = self.generate_cache_key(image_path);
            let current_cache_file = format!("{}.webp", current_cache_key);
            if file_name == current_cache_file {
                continue;
            }

            match fs::remove_file(&path) {
                Ok(_) => {
                    removed_count += 1;
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

        if removed_count > 0 {
            log::info!("{}個の古いキャッシュファイルを削除しました", removed_count);
        }

        Ok(())
    }

    /// バッチでサムネイルを処理（並列読み込み・生成）
    pub fn process_thumbnails_batch<R: Runtime>(
        &self,
        image_paths: &[String],
        _app: &AppHandle<R>,
    ) -> Vec<BatchThumbnailResult> {
        // CPUコア数の75%を使用（UIレンダリング用にコアを残すが、より積極的に）
        let available_cores = std::thread::available_parallelism()
            .map(|cores| cores.get())
            .unwrap_or(4); // フォールバック値
        let max_threads = std::cmp::max(1, (available_cores as f64 * 0.75) as usize);

        log::info!(
            "利用可能コア: {}, 使用コア: {} (75%利用)",
            available_cores,
            max_threads
        );

        // 並列処理でサムネイルを生成（制限付き並列度）
        rayon::ThreadPoolBuilder::new()
            .num_threads(max_threads)
            .build()
            .unwrap()
            .install(|| {
                image_paths
                    .par_iter()
                    .map(
                        |path| match self.load_or_generate_thumbnail(path, &self.cache_dir) {
                            Ok(thumbnail) => BatchThumbnailResult {
                                path: path.clone(),
                                thumbnail: Some(thumbnail),
                                error: None,
                            },
                            Err(e) => BatchThumbnailResult {
                                path: path.clone(),
                                thumbnail: None,
                                error: Some(e),
                            },
                        },
                    )
                    .collect()
            })
    }

    /// サムネイルを読み込みまたは生成（キャッシュ優先）
    fn load_or_generate_thumbnail(
        &self,
        image_path: &str,
        cache_dir: &PathBuf,
    ) -> Result<ThumbnailInfo, String> {
        let cache_key = self.generate_cache_key(image_path);
        let cache_path = cache_dir.join(format!("{}.webp", cache_key));

        // キャッシュが有効かチェック
        if self.is_cache_valid(&cache_path, image_path) {
            let data = fs::read(&cache_path)
                .map_err(|e| format!("キャッシュファイルの読み込みに失敗: {}", e))?;

            return Ok(ThumbnailInfo {
                data,
                width: self.config.size,
                height: self.config.size,
                mime_type: "image/webp".to_string(),
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
        }

        Ok(thumbnail_info)
    }

    /// サムネイルを生成
    fn generate_thumbnail(&self, image_path: &str) -> Result<ThumbnailInfo, String> {
        let img =
            image::open(image_path).map_err(|e| format!("画像ファイルの読み込みに失敗: {}", e))?;

        // サムネイル生成（アスペクト比を維持）
        let thumbnail = img.thumbnail(self.config.size, self.config.size);
        let (width, height) = thumbnail.dimensions();

        // RGBAバイト配列に変換
        let rgba_image = thumbnail.to_rgba8();
        let rgba_data = rgba_image.as_raw();

        // webpクレートを使用して品質設定付きでエンコード
        let encoder = Encoder::from_rgba(rgba_data, width, height);

        // シンプルなエンコード（品質のみ指定）
        let webp_memory = encoder.encode(self.config.quality as f32);
        let encoded_data = webp_memory.to_vec();

        Ok(ThumbnailInfo {
            data: encoded_data,
            width,
            height,
            mime_type: "image/webp".to_string(),
        })
    }

    /// キャッシュをクリア（安全版）
    pub fn clear_cache_safe<R: Runtime>(&self, _app: &AppHandle<R>) -> Result<(), String> {
        if !self.cache_dir.exists() {
            return Ok(());
        }

        let entries = fs::read_dir(&self.cache_dir).map_err(|e| {
            let error_msg = format!(
                "キャッシュディレクトリの読み取りに失敗: {} (パス: {})",
                e,
                self.cache_dir.display()
            );
            log::error!("{}", error_msg);
            error_msg
        })?;

        let mut deleted_count = 0;
        let mut error_count = 0;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            match fs::remove_file(&path) {
                Ok(_) => deleted_count += 1,
                Err(e) => {
                    error_count += 1;
                    log::warn!("ファイルの削除に失敗: {} ({})", e, path.display());
                }
            }
        }

        log::info!(
            "キャッシュクリア完了: {}個のファイルを削除、{}個のエラー",
            deleted_count,
            error_count
        );

        if error_count > 0 {
            Err(format!(
                "一部のファイルの削除に失敗しました（エラー数: {}）",
                error_count
            ))
        } else {
            Ok(())
        }
    }
}

/// サムネイル状態管理用の構造体
pub struct ThumbnailState {
    pub handler: ThumbnailHandler,
}

impl ThumbnailState {
    /// 新しいThumbnailStateを作成
    pub fn new<R: Runtime>(config: ThumbnailConfig, app: &AppHandle<R>) -> Result<Self, String> {
        let handler = ThumbnailHandler::new(config, app)?;
        Ok(Self { handler })
    }
}

/// バッチでサムネイルを生成または取得するTauriコマンド（非同期版）
#[tauri::command]
pub async fn load_thumbnails_batch<R: Runtime>(
    image_paths: Vec<String>,
    app: AppHandle<R>,
    state: tauri::State<'_, ThumbnailState>,
) -> Result<Vec<BatchThumbnailResult>, String> {
    let start_time = std::time::Instant::now();
    let count = image_paths.len();

    let processing_start = std::time::Instant::now();
    let results = state.handler.process_thumbnails_batch(&image_paths, &app);
    let processing_duration = processing_start.elapsed();

    let total_duration = start_time.elapsed();

    // データサイズを計算（クローンを避ける）
    let total_data_size: usize = results
        .iter()
        .filter_map(|r| r.thumbnail.as_ref())
        .map(|t| t.data.len())
        .sum();

    log::info!(
        "バッチ処理詳細統計: {}ファイル, 処理時間: {:.1}ms, 総時間: {:.1}ms, データサイズ: {:.2}MB",
        count,
        processing_duration.as_secs_f64() * 1000.0,
        total_duration.as_secs_f64() * 1000.0,
        total_data_size as f64 / 1024.0 / 1024.0
    );

    Ok(results)
}

/// サムネイルキャッシュをクリアするTauriコマンド（非同期版）
#[tauri::command]
pub async fn clear_thumbnail_cache<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, ThumbnailState>,
) -> Result<(), String> {
    state.handler.clear_cache_safe(&app)
}
