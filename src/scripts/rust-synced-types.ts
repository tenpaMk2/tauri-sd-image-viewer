/**
 * This file contains TypeScript type definitions that are synchronized with Rust code.
 * I know `tauri-specta` but it's still experimental and not widely adopted.
 */

export type FileSystemInfo = Readonly<{
  filename: string;
  parent_dir: string;
  file_size_bytes: number;
  file_creation_timestamp: number;
  file_modified_timestamp: number;
}>;

export type SdTag = Readonly<{
  name: string;
  weight: number | null;
}>;

export type SdParameters = Readonly<{
  positive_sd_tags: SdTag[];
  negative_sd_tags: SdTag[];
  steps: string | null;
  sampler: string | null;
  schedule_type: string | null;
  cfg_scale: string | null;
  seed: string | null;
  size: string | null;
  model: string | null;
  denoising_strength: string | null;
  clip_skip: string | null;
  raw: string;
}>;

export type PngImageInfo = Readonly<{
  width: number;
  height: number;
  bit_depth: number;
  color_type: string;
  has_alpha: boolean;
  sd_parameters: SdParameters | null;
}>;

export type ExifImageInfo = Readonly<{
  rating: number | null;
  create_date: string | null;
  datetime_original: string | null;
  modify_date: string | null;
}>;

export type ComprehensiveImageInfo = Readonly<{
  file_system_info: FileSystemInfo;
  png_info: PngImageInfo;
  exif_info: ExifImageInfo;
}>;
