use crate::sd_parameters::SdParameters;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PngImageInfo {
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub color_type: String,
    pub file_size_bytes: u64,
    pub sd_parameters: Option<SdParameters>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExifImageInfo {
    pub rating: Option<u16>,
    pub create_date: Option<String>,
    pub datetime_original: Option<String>,
    pub modify_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComprehensiveImageInfo {
    pub png_info: PngImageInfo,
    pub exif_info: Option<ExifImageInfo>,
}
