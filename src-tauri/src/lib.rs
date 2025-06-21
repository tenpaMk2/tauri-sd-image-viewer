mod clipboard;
mod exif_handler;
mod image_handler;
mod image_types;
mod png_handler;
mod sd_parameters;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // クリップボード操作
            clipboard::set_clipboard_files,
            // PNG操作
            png_handler::read_png_image_info,
            png_handler::clear_png_sd_parameters,
            // EXIF操作
            exif_handler::read_exif_image_info,
            exif_handler::write_exif_image_rating,
            // 統合操作
            image_handler::read_comprehensive_image_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
