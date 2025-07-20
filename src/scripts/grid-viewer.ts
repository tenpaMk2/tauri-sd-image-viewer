import "@scripts/image-card";
import type { ImageCard } from "@scripts/image-card";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";
import type { BatchThumbnailResult, ThumbnailInfo } from "./rust-synced-types";
import { TaskQueue } from "./task-queue";

// サムネイルからObjectURLを作成する関数
const createThumbnailUrl = (thumbnailInfo: ThumbnailInfo): string => {
  const uint8Array = new Uint8Array(thumbnailInfo.data);
  const blob = new Blob([uint8Array], { type: thumbnailInfo.mime_type });
  return URL.createObjectURL(blob);
};

class GridViewer extends HTMLElement {
  readonly imageMap = new Map<string, ImageCard>();
  private imageLoadQueue = new TaskQueue(async (task) => {
    await this.updateImage(task.id);
  }, 8); // 並行数を8に増加

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

    // 先にDOM更新
    for (const imageFullPath of imageFullPaths) {
      const imageCard = document.createElement("image-card") as ImageCard;
      this.appendChild(imageCard);
      this.imageMap.set(imageFullPath, imageCard);
    }

    // バッチ処理でサムネイルを生成
    await this.loadThumbnailsBatch(imageFullPaths);
  }

  async loadThumbnailsBatch(imageFullPaths: string[]) {
    console.log(
      `バッチでサムネイル処理開始: ${imageFullPaths.length}個のファイル`,
    );

    // 小さなチャンクで逐次処理（UI応答性重視）
    await this.loadThumbnailsSequentially(imageFullPaths);

    console.log("全サムネイル処理完了");
  }

  // 小さなチャンクで逐次処理（UIブロックを最小化）
  private async loadThumbnailsSequentially(imageFullPaths: string[]) {
    const CHUNK_SIZE = 5; // 非常に小さなチャンク

    for (let i = 0; i < imageFullPaths.length; i += CHUNK_SIZE) {
      const chunk = imageFullPaths.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(imageFullPaths.length / CHUNK_SIZE);

      console.log(
        `チャンク ${chunkIndex}/${totalChunks} 処理開始 (${chunk.length}ファイル)`,
      );

      try {
        const chunkStartTime = performance.now();

        const results = (await invoke("load_thumbnails_batch", {
          imagePaths: chunk,
        })) as BatchThumbnailResult[];

        const chunkRustTime = performance.now() - chunkStartTime;
        console.log(
          `チャンク ${chunkIndex}/${totalChunks} 処理時間: ${chunkRustTime.toFixed(2)}ms`,
        );

        // 即座にDOM更新
        this.updateDOMImmediate(results);

        // UI応答性のための短い待機
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`チャンク ${chunkIndex} エラー:`, error);
        // エラー時は個別処理にフォールバック
        for (const path of chunk) {
          this.imageLoadQueue.add({ id: path });
        }
      }
    }
  }

  // DOM更新を即座に実行
  private updateDOMImmediate(results: BatchThumbnailResult[]) {
    for (const result of results) {
      const imageCard = this.imageMap.get(result.path);
      if (!imageCard) continue;

      if (result.thumbnail) {
        const url = createThumbnailUrl(result.thumbnail);
        imageCard.setAttribute("src", url);
        imageCard.setAttribute("width", result.thumbnail.width.toString());
        imageCard.setAttribute("height", result.thumbnail.height.toString());
        imageCard.setAttribute(
          "href",
          "view/?initialImagePath=" + encodeURIComponent(result.path),
        );
      } else if (result.error) {
        console.error(`Failed to load thumbnail: ${result.path}`, result.error);
      }
    }
  }

  updateImage = async (imageFullPath: string) => {
    try {
      // サムネイルを生成または取得
      const thumbnailResponse = (await invoke("load_thumbnail_from_cache", {
        imagePath: imageFullPath,
      })) as ThumbnailInfo;

      // ObjectURLを作成
      const url = createThumbnailUrl(thumbnailResponse);

      const imageCard = this.imageMap.get(imageFullPath)!;
      imageCard.setAttribute("src", url);
      imageCard.setAttribute("width", thumbnailResponse.width.toString());
      imageCard.setAttribute("height", thumbnailResponse.height.toString());
      imageCard.setAttribute(
        "href",
        "view/?initialImagePath=" + encodeURIComponent(imageFullPath),
      );
    } catch (error) {
      console.error(`Failed to load thumbnail: ${imageFullPath}`, error);
    }
  };
}
customElements.define("grid-viewer", GridViewer);
