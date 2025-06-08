import { readFile } from "@tauri-apps/plugin-fs";
import { ExifEventManager } from "./exif-event-manager";
import { detectImageMimeType, type MimeType } from "./mine-type";

export type ImageData = {
  url: string;
  mimeType: MimeType;
  filePath: string;
};

/**
 * 画像ファイルを読み込み、Blob URLを作成
 */
export const loadImage = async (filePath: string): Promise<ImageData> => {
  try {
    const imageData = await readFile(filePath);
    const mimeType: MimeType =
      (await detectImageMimeType(filePath)) ?? "image/jpeg";

    const blob = new Blob([imageData], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const imageResult = {
      url,
      mimeType,
      filePath,
    };

    // EXIFデータの解析を非同期で実行（画像表示をブロックしない）
    ExifEventManager.parseAndEmit(imageData.buffer).catch((error) => {
      console.warn("EXIF parsing failed:", error);
    });

    return imageResult;
  } catch (error) {
    console.error("Failed to load image:", error);
    throw new Error(`画像の読み込みに失敗しました: ${filePath}`);
  }
};
