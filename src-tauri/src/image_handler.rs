use crate::exif_handler::read_exif_image_info;
use crate::image_types::ComprehensiveImageInfo;
use crate::png_handler::read_png_image_info;

/// 画像の全情報を読み込み（PNG + EXIF）
#[tauri::command]
pub fn read_comprehensive_image_info(path: String) -> Result<ComprehensiveImageInfo, String> {
    let png_info = read_png_image_info(path.clone())?;
    let exif_info = read_exif_image_info(path)?;

    Ok(ComprehensiveImageInfo {
        png_info,
        exif_info,
    })
}
