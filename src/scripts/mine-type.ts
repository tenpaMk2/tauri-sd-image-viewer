/**
 * Detects the MIME type of an image file based on its extension.
 * https://www.iana.org/assignments/media-types/media-types.xhtml#image
 */
import { path } from "@tauri-apps/api";

export type MimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/avif";

export const detectImageMimeType = async (
  filename: string
): Promise<MimeType | null> => {
  const ext = (await path.extname(filename)).toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return null;
  }
};
