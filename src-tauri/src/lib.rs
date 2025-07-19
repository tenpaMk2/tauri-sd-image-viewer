mod clipboard;
mod exif_handler;
mod file_system_handler;
mod image_handler;
mod image_types;
mod png_handler;
mod sd_parameters;
mod thumbnail_handler;
use chrono::Local;
use colored::*;
use log;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // サムネイル状態を初期化（setup時にAppHandleを使用）
            let thumbnail_config = thumbnail_handler::ThumbnailConfig::default();
            let thumbnail_state =
                match thumbnail_handler::ThumbnailState::new(thumbnail_config, app.handle()) {
                    Ok(state) => state,
                    Err(e) => {
                        log::error!("ThumbnailStateの初期化に失敗: {}", e);
                        return Err(e.into());
                    }
                };
            app.manage(thumbnail_state);
            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .format(|out, message, record| {
                    let now = Local::now();
                    let formatted_date_time = now.format("%Y-%m-%d %H:%M:%S").to_string();

                    let colored_level = match record.level() {
                        log::Level::Error => "ERROR".red(),
                        log::Level::Warn => "WARN".yellow(),
                        log::Level::Info => "INFO".green(),
                        log::Level::Debug => "DEBUG".blue(),
                        log::Level::Trace => "TRACE".magenta(),
                    };

                    out.finish(format_args!(
                        "[{}][{}][{}] {}",
                        formatted_date_time.cyan(),
                        colored_level,
                        record.target().to_string().cyan(),
                        message
                    ))
                })
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
            // サムネイル操作
            thumbnail_handler::load_thumbnail_from_cache,
            thumbnail_handler::load_thumbnails_batch,
            thumbnail_handler::clear_thumbnail_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
