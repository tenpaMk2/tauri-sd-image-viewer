use crate::exif_handler::read_exif_image_info;
use crate::file_system_handler::read_file_system_info;
use crate::image_types::ComprehensiveImageInfo;
use crate::png_handler::read_png_image_info;

/// バイトデータから画像を読み込み（中核処理）
pub fn load_image_from_bytes(data: &[u8]) -> Result<image::DynamicImage, String> {
    image::load_from_memory(data)
        .map_err(|e| format!("バイトデータからの画像読み込みエラー: {}", e))
}

/// 画像の全情報を読み込み（Tauri API）
#[tauri::command]
pub fn read_comprehensive_image_info(path: String) -> Result<ComprehensiveImageInfo, String> {
    let file_system_info = read_file_system_info(path.clone())?;
    let png_info = read_png_image_info(path.clone())?;
    let exif_info = read_exif_image_info(path)?;

    Ok(ComprehensiveImageInfo {
        file_system_info,
        png_info,
        exif_info,
    })
}
