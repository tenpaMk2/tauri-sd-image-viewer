use crate::image_types::ExifImageInfo;
use little_exif::exif_tag::ExifTag;
use little_exif::filetype::FileExtension;
use little_exif::ifd::ExifTagGroup;
use little_exif::metadata::Metadata;
use std::path::Path;

/// EXIF情報を読み込み（Tauri API）
#[tauri::command]
pub fn read_exif_image_info(path: String) -> Result<Option<ExifImageInfo>, String> {
    let data = std::fs::read(&path).map_err(|e| format!("ファイル読み込みエラー: {}", e))?;
    let file_extension = determine_file_extension(&path);
    Ok(read_exif_from_bytes(&data, file_extension))
}

/// バイトデータからEXIF情報を読み取り（中核処理）
pub fn read_exif_from_bytes(data: &[u8], file_extension: FileExtension) -> Option<ExifImageInfo> {
    // 直接バイトデータからメタデータを読み取り（一時ファイル不要）
    let metadata = Metadata::new_from_vec(&data.to_vec(), file_extension).ok()?;
    extract_exif_info_from_metadata(&metadata)
}

/// ファイル拡張子を判定
pub fn determine_file_extension(image_path: &str) -> FileExtension {
    // ファイル名から拡張子を抽出（効率的な実装）
    let extension = image_path
        .rfind('.')
        .map(|pos| &image_path[pos + 1..])
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "jpg" | "jpeg" => FileExtension::JPEG,
        "png" => FileExtension::PNG {
            as_zTXt_chunk: false,
        },
        "tiff" | "tif" => FileExtension::TIFF,
        "webp" => FileExtension::WEBP,
        "heif" | "heic" => FileExtension::HEIF,
        "jxl" => FileExtension::JXL,
        _ => FileExtension::JPEG, // デフォルト
    }
}

/// Metadataオブジェクトから情報を抽出（共通処理）
fn extract_exif_info_from_metadata(metadata: &Metadata) -> Option<ExifImageInfo> {
    let mut exif_info = ExifImageInfo {
        rating: None,
        create_date: None,
        datetime_original: None,
        modify_date: None,
    };

    for tag in metadata {
        match tag {
            ExifTag::CreateDate(value) => {
                exif_info.create_date = Some(value.clone());
            }
            ExifTag::DateTimeOriginal(value) => {
                exif_info.datetime_original = Some(value.clone());
            }
            ExifTag::ModifyDate(value) => {
                exif_info.modify_date = Some(value.clone());
            }
            ExifTag::UnknownINT16U(values, tag_id, _) => {
                if *tag_id == 18246 && !values.is_empty() {
                    exif_info.rating = Some(values[0]);
                }
            }
            _ => {}
        }
    }

    Some(exif_info)
}

/// 画像のレーティングをEXIFに書き込み（Tauri API）
#[tauri::command]
pub fn write_exif_image_rating(path: String, rating: u32) -> Result<(), String> {
    if 5 < rating {
        return Err("レーティングは0-5の範囲で指定してください".to_string());
    }

    let png_path = Path::new(&path);
    let mut png_data = Metadata::new_from_path(&png_path)
        .map_err(|e| format!("メタデータ読み込みエラー: {}", e))?;

    png_data.set_tag(ExifTag::UnknownINT16U(
        vec![rating as u16],
        18246,
        ExifTagGroup::GENERIC,
    ));

    let percent = match rating {
        0 => 0,
        1 => 1,
        2 => 25,
        3 => 50,
        4 => 75,
        5 => 99,
        _ => unreachable!(),
    };

    png_data.set_tag(ExifTag::UnknownINT16U(
        vec![percent],
        18249,
        ExifTagGroup::GENERIC,
    ));

    png_data
        .write_to_file(&png_path)
        .map_err(|e| format!("書き込みエラー: {}", e))?;

    Ok(())
}
