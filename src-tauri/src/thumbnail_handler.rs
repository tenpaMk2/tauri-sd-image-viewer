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
    pub quality: u8,            // WebP品質 (1-100)
    pub include_metadata: bool, // メタデータを埋め込むかどうか
}

impl Default for ThumbnailConfig {
    fn default() -> Self {
        Self {
            size: 300,
            quality: 50,
            include_metadata: true,
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
    pub metadata: Option<crate::webp_metadata::ThumbnailMetadata>,
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
        // CPUコア数の75%を使用
        let available_cores = std::thread::available_parallelism()
            .map(|cores| cores.get())
            .unwrap_or(4); // フォールバック値
        let max_threads = std::cmp::max(1, (available_cores as f64 * 0.75) as usize);

        log::info!(
            "利用可能コア: {}, 使用コア: {}",
            available_cores,
            max_threads
        );

        // 並列処理でサムネイルを生成（高並列度）
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

            // 既存のWebPからメタデータを読み取り
            let metadata = crate::webp_metadata::extract_metadata_from_webp(&data)
                .ok()
                .flatten();

            return Ok(ThumbnailInfo {
                data,
                width: self.config.size,
                height: self.config.size,
                mime_type: "image/webp".to_string(),
                metadata,
            });
        }

        // キャッシュが無効な場合、古いキャッシュファイルを削除
        if let Err(e) = self.remove_old_cache_files(image_path) {
            log::warn!("古いキャッシュファイルの削除に失敗: {}", e);
        }

        // 新しいサムネイルを生成（統合版）
        let thumbnail_info = self.generate_thumbnail(image_path)?;

        // キャッシュに保存
        if let Err(e) = fs::write(&cache_path, &thumbnail_info.data) {
            log::warn!("サムネイルキャッシュの保存に失敗: {}", e);
        }

        Ok(thumbnail_info)
    }

    /// サムネイルを生成
    fn generate_thumbnail(&self, image_path: &str) -> Result<ThumbnailInfo, String> {
        // 1. ファイルを一度だけ読み込み（統一されたアプローチ）
        let file_data =
            std::fs::read(image_path).map_err(|e| format!("ファイル読み込みエラー: {}", e))?;

        // 2. バイトデータから画像を読み込み
        let img = crate::image_handler::load_image_from_bytes(&file_data)?;

        // 3. サムネイル生成（アスペクト比を維持）
        let thumbnail = img.thumbnail(self.config.size, self.config.size);
        let (width, height) = thumbnail.dimensions();

        // 4. RGBAバイト配列に変換
        let rgba_image = thumbnail.to_rgba8();
        let rgba_data = rgba_image.as_raw();

        // 5. 条件付きでメタデータを軽量読み取り（同じバイトデータから）
        let metadata = if self.config.include_metadata {
            self.extract_metadata_from_bytes(&file_data, image_path)
                .ok()
        } else {
            None
        };

        // 6. メタデータ付きWebPを一度で生成
        let webp_data = if let Some(ref meta) = metadata {
            let encoder =
                crate::webp_metadata::WebPMetadataEncoder::new(self.config.quality as f32);
            encoder.encode_with_metadata(rgba_data, width, height, Some(meta.clone()))?
        } else {
            // メタデータがない場合は従来の方式
            let encoder = Encoder::from_rgba(rgba_data, width, height);
            let webp_memory = encoder.encode(self.config.quality as f32);
            webp_memory.to_vec()
        };

        Ok(ThumbnailInfo {
            data: webp_data,
            width,
            height,
            mime_type: "image/webp".to_string(),
            metadata,
        })
    }

    /// バイトデータからメタデータを抽出（統一アプローチ）
    fn extract_metadata_from_bytes(
        &self,
        file_data: &[u8],
        image_path: &str,
    ) -> Result<crate::webp_metadata::ThumbnailMetadata, String> {
        // ファイル拡張子を判定
        let file_extension = crate::exif_handler::determine_file_extension(image_path);

        // EXIF情報をバイトデータから読み取り（直接処理）
        let exif_info = crate::exif_handler::read_exif_from_bytes(file_data, file_extension);

        // SDパラメーター情報をバイトデータから読み取り（PNGの場合のみ）
        let sd_parameters = if image_path.to_lowercase().ends_with(".png") {
            crate::png_handler::read_png_sd_parameters_from_bytes(file_data)
        } else {
            None
        };

        // デバッグログ：抽出されたメタデータの情報
        log::debug!(
            "メタデータ抽出: {} - EXIF rating: {:?}, SD params: {}",
            image_path.split('/').last().unwrap_or("unknown"),
            exif_info.as_ref().and_then(|e| e.rating),
            sd_parameters.is_some()
        );

        Ok(crate::webp_metadata::ThumbnailMetadata {
            exif_info,
            sd_parameters,
            cache_version: 1,
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

    // メタデータ情報をデバッグログに出力
    log::info!(
        "サムネイル生成開始: {}ファイル, メタデータ埋め込み: {}",
        count,
        state.handler.config.include_metadata
    );

    // rayonの並列処理に全てを任せる（チャンク制御不要）
    let all_results = state.handler.process_thumbnails_batch(&image_paths, &app);

    let total_duration = start_time.elapsed();

    // データサイズを計算
    let total_data_size: usize = all_results
        .iter()
        .filter_map(|r| r.thumbnail.as_ref())
        .map(|t| t.data.len())
        .sum();

    // メタデータ統計をログ出力
    let metadata_count = all_results
        .iter()
        .filter_map(|r| r.thumbnail.as_ref())
        .filter(|t| t.metadata.is_some())
        .count();

    log::info!(
        "バッチ処理完了: {}ファイル, 総時間: {:.1}ms, データサイズ: {:.2}MB, メタデータ付き: {}個",
        count,
        total_duration.as_secs_f64() * 1000.0,
        total_data_size as f64 / 1024.0 / 1024.0,
        metadata_count
    );

    Ok(all_results)
}

/// サムネイルキャッシュをクリアするTauriコマンド（非同期版）
#[tauri::command]
pub async fn clear_thumbnail_cache<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, ThumbnailState>,
) -> Result<(), String> {
    state.handler.clear_cache_safe(&app)
}

/// サムネイルからメタデータを抽出するTauriコマンド
#[tauri::command]
pub async fn extract_thumbnail_metadata<R: Runtime>(
    image_path: String,
    _app: AppHandle<R>,
    state: tauri::State<'_, ThumbnailState>,
) -> Result<Option<crate::webp_metadata::ThumbnailMetadata>, String> {
    let cache_key = state.handler.generate_cache_key(&image_path);
    let cache_path = state.handler.cache_dir.join(format!("{}.webp", cache_key));

    // キャッシュファイルが存在するかチェック
    if !cache_path.exists() {
        return Ok(None);
    }

    // WebPファイルからメタデータを抽出
    let data = std::fs::read(&cache_path)
        .map_err(|e| format!("キャッシュファイルの読み込みに失敗: {}", e))?;

    crate::webp_metadata::extract_metadata_from_webp(&data)
}
