use crate::image_types::ExifImageInfo;
use little_exif::exif_tag::ExifTag;
use little_exif::ifd::ExifTagGroup;
use little_exif::metadata::Metadata;
use std::path::Path;

/// EXIF情報を読み込み
#[tauri::command]
pub fn read_exif_image_info(path: String) -> Result<Option<ExifImageInfo>, String> {
    let metadata = match Metadata::new_from_path(path.as_ref()) {
        Ok(meta) => meta,
        Err(_) => return Ok(None), // EXIFがない場合はNone
    };

    let mut exif_info = ExifImageInfo {
        rating: None,
        create_date: None,
        datetime_original: None,
        modify_date: None,
    };

    for tag in &metadata {
        // little_exifのExifTagから必要な情報を抽出
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
                // レーティング情報の可能性
                if *tag_id == 18246 && !values.is_empty() {
                    exif_info.rating = Some(values[0]);
                }
            }
            _ => {
                // その他のタグは無視（デバッグ時は出力）
                // println!("EXIF Tag: {:?}", tag);
            }
        }
    }

    Ok(Some(exif_info))
}

/// 画像のレーティングをEXIFに書き込み
#[tauri::command]
pub fn write_exif_image_rating(path: String, rating: u32) -> Result<(), String> {
    if 5 < rating {
        return Err("レーティングは0-5の範囲で指定してください".to_string());
    }

    dbg!(&path);
    dbg!(&rating);

    let png_path = Path::new(&path);

    // メタデータを読み込み
    let mut png_data = Metadata::new_from_path(&png_path)
        .map_err(|e| format!("メタデータ読み込みエラー: {}", e))?;

    // レーティングタグを設定
    png_data.set_tag(ExifTag::UnknownINT16U(
        vec![rating as u16],
        18246,
        ExifTagGroup::GENERIC,
    ));

    // レーティングパーセントタグを設定
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

    println!(
        "Writing rating: {} -> {}% to {}",
        rating,
        percent,
        png_path.display()
    );

    // メタデータをファイルに書き込み
    png_data
        .write_to_file(&png_path)
        .map_err(|e| format!("書き込みエラー: {}", e))?;

    println!("Rating written successfully");
    Ok(())
}
