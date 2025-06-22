use crate::image_types::FileSystemInfo;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

/// ファイルシステム情報を読み込み
#[tauri::command]
pub fn read_file_system_info(path: String) -> Result<FileSystemInfo, String> {
    let file_path = Path::new(&path);

    // ファイルの存在確認
    if !file_path.exists() {
        return Err(format!("ファイルが存在しません: {}", path));
    }

    // ファイルメタデータを取得
    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("ファイル情報取得エラー: {}", e))?;

    // ファイル名を取得
    let filename = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_string();

    // 親ディレクトリパスを取得
    let parent_dir = file_path
        .parent()
        .and_then(|parent| parent.to_str())
        .unwrap_or("")
        .to_string();

    // ファイルサイズを取得
    let file_size_bytes = metadata.len();

    // ファイル作成日時を取得（Unix timestamp）
    let file_creation_timestamp = metadata
        .created()
        .map_err(|e| format!("作成日時取得エラー: {}", e))?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("タイムスタンプ変換エラー: {}", e))?
        .as_secs();

    // 最終更新日時を取得（Unix timestamp）
    let file_modified_timestamp = metadata
        .modified()
        .map_err(|e| format!("更新日時取得エラー: {}", e))?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("タイムスタンプ変換エラー: {}", e))?
        .as_secs();

    Ok(FileSystemInfo {
        filename,
        parent_dir,
        file_size_bytes,
        file_creation_timestamp,
        file_modified_timestamp,
    })
}
