use crate::sd_parameters::SdParameters;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSystemInfo {
    pub filename: String,
    pub parent_dir: String,
    pub file_size_bytes: u64,
    pub file_creation_timestamp: u64, // Unix timestamp (seconds)
    pub file_modified_timestamp: u64, // Unix timestamp (seconds)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PngImageInfo {
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub color_type: String,
    pub sd_parameters: Option<SdParameters>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExifImageInfo {
    pub rating: Option<u16>,
    pub create_date: Option<String>,
    pub datetime_original: Option<String>,
    pub modify_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComprehensiveImageInfo {
    pub file_system_info: FileSystemInfo,
    pub png_info: PngImageInfo,
    pub exif_info: Option<ExifImageInfo>,
}
