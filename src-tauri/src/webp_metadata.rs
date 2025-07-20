// WebPメタデータ埋め込み用のモジュール
use crate::image_types::ExifImageInfo;
use crate::sd_parameters::SdParameters;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailMetadata {
    pub exif_info: Option<ExifImageInfo>,
    pub sd_parameters: Option<SdParameters>,
    pub cache_version: u32,
}

pub struct WebPMetadataEncoder {
    quality: f32,
}

impl WebPMetadataEncoder {
    pub fn new(quality: f32) -> Self {
        Self { quality }
    }

    /// RGBAデータから直接メタデータ付きWebPを生成
    pub fn encode_with_metadata(
        &self,
        rgba_data: &[u8],
        width: u32,
        height: u32,
        metadata: Option<ThumbnailMetadata>,
    ) -> Result<Vec<u8>, String> {
        // 1. 基本WebPエンコード
        let encoder = webp::Encoder::from_rgba(rgba_data, width, height);
        let webp_data = encoder.encode(self.quality);

        // 2. メタデータがない場合はそのまま返す
        let Some(meta) = metadata else {
            return Ok(webp_data.to_vec());
        };

        // 3. メタデータをWebPに追加
        self.inject_metadata_to_webp(webp_data.as_ref(), &meta)
    }

    /// 既存のWebPデータにメタデータチャンクを注入
    fn inject_metadata_to_webp(
        &self,
        webp_data: &[u8],
        metadata: &ThumbnailMetadata,
    ) -> Result<Vec<u8>, String> {
        // WebPフォーマット: 'RIFF' + size + 'WEBP' + chunks

        if webp_data.len() < 12 || &webp_data[0..4] != b"RIFF" || &webp_data[8..12] != b"WEBP" {
            return Err("無効なWebPファイル形式".to_string());
        }

        let mut result = Vec::new();

        // RIFFヘッダーをコピー（サイズは後で更新）
        result.extend_from_slice(&webp_data[0..8]);
        result.extend_from_slice(b"WEBP");

        // 既存のチャンクをコピー
        let mut pos = 12;
        while pos < webp_data.len() {
            if pos + 8 > webp_data.len() {
                break;
            }

            let _chunk_id = &webp_data[pos..pos + 4];
            let chunk_size = u32::from_le_bytes([
                webp_data[pos + 4],
                webp_data[pos + 5],
                webp_data[pos + 6],
                webp_data[pos + 7],
            ]) as usize;

            let chunk_end = pos + 8 + chunk_size + (chunk_size % 2); // パディング考慮
            if chunk_end > webp_data.len() {
                break;
            }

            result.extend_from_slice(&webp_data[pos..chunk_end]);
            pos = chunk_end;
        }

        // メタデータチャンクを追加
        self.add_metadata_chunk(&mut result, metadata)?;

        // RIFFサイズを更新
        let total_size = (result.len() - 8) as u32;
        result[4..8].copy_from_slice(&total_size.to_le_bytes());

        Ok(result)
    }

    /// メタデータチャンクを追加
    fn add_metadata_chunk(
        &self,
        webp_data: &mut Vec<u8>,
        metadata: &ThumbnailMetadata,
    ) -> Result<(), String> {
        // WebP仕様準拠：XMPチャンクとして保存（標準的なメタデータ格納方法）
        // XMPはXMLベースだが、ここではJSON形式のカスタムデータを保存
        // 注: 完全なXMP準拠ではないが、XMPチャンクを利用してアプリケーション固有データを格納
        let json_data = serde_json::to_string(metadata)
            .map_err(|e| format!("メタデータのシリアライズに失敗: {}", e))?;

        let json_bytes = json_data.as_bytes();
        let chunk_size = json_bytes.len() as u32;

        // WebP仕様準拠：XMPチャンクヘッダー
        webp_data.extend_from_slice(b"XMP "); // FourCC（4番目はスペース0x20）
        webp_data.extend_from_slice(&chunk_size.to_le_bytes()); // Size (little-endian)

        // チャンクペイロード（JSON形式のアプリケーション固有メタデータ）
        webp_data.extend_from_slice(json_bytes);

        // WebP仕様必須：偶数バイト境界へのパディング
        if json_bytes.len() % 2 != 0 {
            webp_data.push(0); // パディングバイトは0でなければならない
        }

        Ok(())
    }
}

/// WebPからメタデータを抽出
pub fn extract_metadata_from_webp(webp_data: &[u8]) -> Result<Option<ThumbnailMetadata>, String> {
    // WebP仕様準拠：最小12バイト（RIFF + size + WEBP）
    if webp_data.len() < 12 || &webp_data[0..4] != b"RIFF" || &webp_data[8..12] != b"WEBP" {
        return Ok(None);
    }

    let mut pos = 12;
    while pos < webp_data.len() {
        // WebP仕様準拠：チャンクヘッダーサイズ検証
        if pos + 8 > webp_data.len() {
            break;
        }

        let chunk_id = &webp_data[pos..pos + 4];
        let chunk_size = u32::from_le_bytes([
            webp_data[pos + 4],
            webp_data[pos + 5],
            webp_data[pos + 6],
            webp_data[pos + 7],
        ]) as usize;

        if chunk_id == b"XMP " {
            // WebP仕様準拠：XMPチャンク（4番目の文字はスペース）
            let data_start = pos + 8;
            let data_end = data_start + chunk_size;

            // WebP仕様準拠：チャンクサイズ境界検証
            if data_end <= webp_data.len() {
                let json_data = &webp_data[data_start..data_end];
                let json_str = std::str::from_utf8(json_data)
                    .map_err(|e| format!("メタデータのUTF-8変換に失敗: {}", e))?;

                let metadata: ThumbnailMetadata = serde_json::from_str(json_str)
                    .map_err(|e| format!("メタデータのデシリアライズに失敗: {}", e))?;

                return Ok(Some(metadata));
            }
        }

        // WebP仕様準拠：パディング考慮（偶数バイト境界）
        let chunk_end = pos + 8 + chunk_size + (chunk_size % 2);

        // 不正なチャンクサイズからの保護
        if chunk_end > webp_data.len() {
            break;
        }

        pos = chunk_end;
    }

    Ok(None)
}
