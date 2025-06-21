use crate::sd_parameters::SdParameters;
use png::Decoder;
use std::fs::File;

/// PNG画像の基本情報とSD Parametersを読み取る
#[tauri::command]
pub fn read_png_metadata(path: String) -> Result<(), String> {
    let file = File::open(&path).map_err(|e| format!("ファイルを開くことができません: {}", e))?;

    let decoder = Decoder::new(file);
    let reader = decoder
        .read_info()
        .map_err(|e| format!("PNGデコードエラー: {}", e))?;

    let info = reader.info();

    // 基本情報
    let width = info.width;
    let height = info.height;
    println!("🎆 Image size: {width}x{height}");

    dbg!(info.bit_depth);
    dbg!(info.content_light_level);

    // PNG固有のテキストメタデータ
    for entry in &info.uncompressed_latin1_text {
        println!("🏷️ {}: {}", entry.keyword, entry.text);

        // Stable Diffusion Parameters の解析
        if entry.keyword == "parameters" {
            match SdParameters::parse(&entry.text) {
                Ok(sd_params) => {
                    println!("✅ SD Parameters解析成功:");
                    println!("  Positive tags: {:?}", sd_params.positive_sd_tags);
                    println!("  Negative tags: {:?}", sd_params.negative_sd_tags);
                    println!("  Steps: {:?}", sd_params.steps);
                    println!("  Sampler: {:?}", sd_params.sampler);
                    println!("  CFG Scale: {:?}", sd_params.cfg_scale);
                    println!("  Seed: {:?}", sd_params.seed);
                    println!("  Size: {:?}", sd_params.size);
                    println!("  Model: {:?}", sd_params.model);
                }
                Err(e) => {
                    println!("❌ SD Parameters解析エラー: {}", e);
                }
            }
        }
    }

    Ok(())
}
