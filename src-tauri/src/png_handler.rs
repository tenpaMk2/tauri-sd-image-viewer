use crate::image_types::PngImageInfo;
use crate::sd_parameters::SdParameters;
use png::{Decoder, Encoder};
use std::fs::File;
use std::io::{BufWriter, Cursor};

/// PNG画像情報を読み込み（Tauri API）
#[tauri::command]
pub fn read_png_image_info(path: String) -> Result<PngImageInfo, String> {
    let data = std::fs::read(&path).map_err(|e| format!("ファイル読み込みエラー: {}", e))?;
    read_png_info_from_bytes(&data)
}

/// バイトデータからPNG情報を読み取り（中核処理）
pub fn read_png_info_from_bytes(data: &[u8]) -> Result<PngImageInfo, String> {
    let cursor = Cursor::new(data);
    let decoder = Decoder::new(cursor);
    let reader = decoder
        .read_info()
        .map_err(|e| format!("PNG解析エラー: {}", e))?;
    let info = reader.info();

    // SD Parameters を検索・解析
    let mut sd_parameters = None;
    for entry in &info.uncompressed_latin1_text {
        if entry.keyword == "parameters" {
            match SdParameters::parse(&entry.text) {
                Ok(params) => sd_parameters = Some(params),
                Err(_) => {} // 解析失敗は無視
            }
            break;
        }
    }

    Ok(PngImageInfo {
        width: info.width,
        height: info.height,
        bit_depth: info.bit_depth as u8,
        color_type: format!("{:?}", info.color_type),
        sd_parameters,
    })
}

/// バイトデータからSDパラメーターのみを読み取り（中核処理）
pub fn read_png_sd_parameters_from_bytes(data: &[u8]) -> Option<SdParameters> {
    let cursor = Cursor::new(data);
    let decoder = Decoder::new(cursor);
    let reader = decoder.read_info().ok()?;
    let info = reader.info();

    // SD Parameters のみを検索
    for entry in &info.uncompressed_latin1_text {
        if entry.keyword == "parameters" {
            if let Ok(params) = SdParameters::parse(&entry.text) {
                return Some(params);
            }
            break;
        }
    }
    None
}

/// SD Parameters をPNGファイルから削除（Tauri API）
#[tauri::command]
pub fn clear_png_sd_parameters(path: String) -> Result<(), String> {
    // 必要な情報を抽出するため、まず読み込み
    let (image_data, width, height, color_type, bit_depth, text_chunks) = {
        let input_file =
            File::open(&path).map_err(|e| format!("入力ファイル読み込みエラー: {}", e))?;
        let decoder = Decoder::new(input_file);
        let mut reader = decoder
            .read_info()
            .map_err(|e| format!("PNG解析エラー: {}", e))?;

        // 画像データを取得
        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader
            .next_frame(&mut buf)
            .map_err(|e| format!("画像データ読み込みエラー: {}", e))?;

        // parametersチャンク以外のテキストチャンクを保存
        let text_chunks: Vec<(String, String)> = reader
            .info()
            .uncompressed_latin1_text
            .iter()
            .filter(|entry| entry.keyword != "parameters")
            .map(|entry| (entry.keyword.clone(), entry.text.clone()))
            .collect();

        (
            buf,
            info.width,
            info.height,
            info.color_type,
            info.bit_depth,
            text_chunks,
        )
    }; // ここでinput_fileとreaderがdropされる

    // 新しいファイルを書き込み（元ファイルを上書き）
    let output_file = File::create(&path).map_err(|e| format!("出力ファイル作成エラー: {}", e))?;
    let w = BufWriter::new(output_file);

    let mut encoder = Encoder::new(w, width, height);
    encoder.set_color(color_type);
    encoder.set_depth(bit_depth);

    // parametersチャンク以外を復元
    for (keyword, text) in text_chunks {
        encoder
            .add_text_chunk(keyword, text)
            .map_err(|e| format!("テキストチャンク追加エラー: {}", e))?;
    }

    // ヘッダーと画像データを書き込み
    let mut writer = encoder
        .write_header()
        .map_err(|e| format!("ヘッダー書き込みエラー: {}", e))?;
    writer
        .write_image_data(&image_data)
        .map_err(|e| format!("画像データ書き込みエラー: {}", e))?;

    Ok(())
}
