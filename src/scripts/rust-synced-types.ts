/**
 * This file contains TypeScript type definitions that are synchronized with Rust code.
 */

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
  png_info: PngImageInfo;
  exif_info: ExifImageInfo;
}>;
