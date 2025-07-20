import "@scripts/image-card";
import type { ImageCard } from "@scripts/image-card";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";
import type { BatchThumbnailResult, ThumbnailInfo } from "./rust-synced-types";

// サムネイルからObjectURLを作成する関数
const createThumbnailUrl = (thumbnailInfo: ThumbnailInfo): string => {
  const uint8Array = new Uint8Array(thumbnailInfo.data);
  const blob = new Blob([uint8Array], { type: thumbnailInfo.mime_type });
  return URL.createObjectURL(blob);
};

class GridViewer extends HTMLElement {
  readonly imageMap = new Map<string, ImageCard>();

  async connectedCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log({ "urlParams.get('dir')": urlParams.get("dir") });
    const TARGET_DIR = urlParams.get("dir") || (await path.downloadDir());

    const dirEntries = await readDir(TARGET_DIR);
    const imageEntries = dirEntries.filter((entry) => {
      if (!entry.isFile) return false;
      const ext = entry.name.split(".").pop()?.toLowerCase();
      return ext && SUPPORTED_IMAGE_EXTS.some((x) => x === ext);
    });

    const imageFullPaths = await Promise.all(
      imageEntries
        .map((entry) => entry.name)
        .map((filename) => path.join(TARGET_DIR, filename))
        .sort(),
    );

    // 先にDOM更新（プレースホルダー表示）
    for (const imageFullPath of imageFullPaths) {
      const imageCard = document.createElement("image-card") as ImageCard;
      this.appendChild(imageCard);
      this.imageMap.set(imageFullPath, imageCard);
    }

    // チャンクごとの並列処理でサムネイルを生成
    await this.loadThumbnailsBatch(imageFullPaths);
  }

  // 1枚の画像を即座に更新
  private updateSingleImage(imagePath: string, thumbnail: ThumbnailInfo) {
    const imageCard = this.imageMap.get(imagePath);
    if (!imageCard) return;

    const url = createThumbnailUrl(thumbnail);

    // ImageCardの属性を設定してサムネイル表示
    imageCard.setAttribute("src", url);
    imageCard.setAttribute(
      "href",
      `/view?initialImagePath=${encodeURIComponent(imagePath)}`,
    );
    imageCard.setAttribute("width", thumbnail.width.toString());
    imageCard.setAttribute("height", thumbnail.height.toString());
  }

  // チャンクごとの並列処理（効率的なバッチ処理）
  async loadThumbnailsBatch(imageFullPaths: string[]) {
    const CHUNK_SIZE = 16; // チャンクサイズ
    const chunks = [];

    // 配列をチャンクに分割
    for (let i = 0; i < imageFullPaths.length; i += CHUNK_SIZE) {
      chunks.push(imageFullPaths.slice(i, i + CHUNK_SIZE));
    }

    console.log(
      `チャンク処理開始: ${chunks.length}チャンク, チャンクサイズ: ${CHUNK_SIZE}`,
    );

    // チャンクごとに処理
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      try {
        const startTime = performance.now();

        // バッチでサムネイルを取得
        const results = (await invoke("load_thumbnails_batch", {
          imagePaths: chunk,
        })) as BatchThumbnailResult[];

        const processingTime = performance.now() - startTime;

        // 結果を即座にUI更新
        for (const result of results) {
          if (result.thumbnail) {
            this.updateSingleImage(result.path, result.thumbnail);
          } else if (result.error) {
            console.error(`サムネイル処理エラー: ${result.path}`, result.error);
          }
        }

        console.log(
          `チャンク ${chunkIndex + 1}/${chunks.length} 完了: ${processingTime.toFixed(1)}ms (${chunk.length}ファイル)`,
        );
      } catch (error) {
        console.error(`チャンク ${chunkIndex + 1} 処理エラー:`, error);
      }
    }

    console.log("全チャンク処理完了");
  }
}

customElements.define("grid-viewer", GridViewer);
