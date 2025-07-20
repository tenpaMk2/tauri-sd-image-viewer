import "@scripts/image-card";
import type { ImageCard } from "@scripts/image-card";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import type { WriteImageRatingWithPathEventDetail } from "./global";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";
import type { BatchThumbnailResult, ThumbnailInfo } from "./rust-synced-types";

// サムネイルからObjectURLを作成する関数
const createThumbnailUrl = (thumbnailInfo: ThumbnailInfo): string => {
  const uint8Array = new Uint8Array(thumbnailInfo.data);
  const blob = new Blob([uint8Array], { type: thumbnailInfo.mime_type });
  return URL.createObjectURL(blob);
};

// 配列をチャンクに分割するユーティリティ関数
const createChunks = <T>(array: T[], chunkSize: number): T[][] =>
  Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, i) =>
    array.slice(i * chunkSize, (i + 1) * chunkSize),
  );

class GridViewer extends HTMLElement {
  readonly imageMap = new Map<string, ImageCard>();

  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // グリッド用のレーティング書き込みイベントをリッスン
    document.addEventListener(
      "write-image-rating-with-path",
      this.handleWriteImageRatingWithPath,
    );
  }

  private handleWriteImageRatingWithPath = async (event: Event) => {
    const customEvent =
      event as CustomEvent<WriteImageRatingWithPathEventDetail>;
    const { rating, path } = customEvent.detail;

    try {
      await invoke("write_exif_image_rating", {
        path: path,
        rating: rating,
      });
      console.log(`Rating ${rating} written to ${path}`);

      // rating書き込み成功を通知
      document.dispatchEvent(
        new CustomEvent("image-rating-write-success", {
          detail: { path: path, rating },
        }),
      );
    } catch (error) {
      console.error("Failed to write rating:", error);
      document.dispatchEvent(
        new CustomEvent("image-rating-write-failed", {
          detail: {
            path: path,
            rating,
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  };

  async connectedCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log({ "urlParams.get('dir')": urlParams.get("dir") });
    const TARGET_DIR = urlParams.get("dir") ?? (await path.downloadDir());

    const dirEntries = await readDir(TARGET_DIR);
    const imageEntries = dirEntries.filter((entry) => {
      if (!entry.isFile) return false;
      const ext = entry.name.split(".").at(-1)?.toLowerCase();
      return (
        ext && SUPPORTED_IMAGE_EXTS.some((supportedExt) => supportedExt === ext)
      );
    });

    const imageFullPaths = await Promise.all(
      imageEntries
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (entry) => await path.join(TARGET_DIR, entry.name)),
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
    imageCard.setAttribute("data-image-path", imagePath);

    // メタデータがある場合、追加情報を設定（実験的）
    if (thumbnail.metadata) {
      const { exif_info, sd_parameters } = thumbnail.metadata;

      // EXIF Rating情報をdata属性に設定
      if (exif_info?.rating !== null && exif_info?.rating !== undefined) {
        imageCard.setAttribute("data-rating", exif_info.rating.toString());
        imageCard.setAttribute("data-has-rating", "true");
      } else {
        imageCard.setAttribute("data-rating", "0");
        imageCard.setAttribute("data-has-rating", "false");
      }

      // SD Parameters情報もdata属性に設定（実験的）
      if (sd_parameters) {
        imageCard.setAttribute("data-has-sd-params", "true");
        if (sd_parameters.model) {
          imageCard.setAttribute("data-sd-model", sd_parameters.model);
        }
        if (sd_parameters.seed) {
          imageCard.setAttribute("data-sd-seed", sd_parameters.seed);
        }
      } else {
        imageCard.setAttribute("data-has-sd-params", "false");
      }

      // キャッシュバージョン情報
      imageCard.setAttribute(
        "data-cache-version",
        thumbnail.metadata.cache_version.toString(),
      );
    } else {
      // メタデータがない場合のフォールバック
      imageCard.setAttribute("data-rating", "0");
      imageCard.setAttribute("data-has-rating", "false");
      imageCard.setAttribute("data-has-sd-params", "false");
    }
  }

  // チャンクごとの並列処理（効率的なバッチ処理）
  async loadThumbnailsBatch(imageFullPaths: string[]) {
    const CHUNK_SIZE = 16; // チャンクサイズ

    // 配列をチャンクに分割（モダンな書き方）
    const chunks = createChunks(imageFullPaths, CHUNK_SIZE);

    console.log(
      `チャンク処理開始: ${chunks.length}チャンク, チャンクサイズ: ${CHUNK_SIZE}`,
    );

    // チャンクごとに処理（モダンなfor...of）
    for (const [chunkIndex, chunk] of chunks.entries()) {
      try {
        const startTime = performance.now();

        // バッチでサムネイルを取得
        const results = (await invoke("load_thumbnails_batch", {
          imagePaths: chunk,
        })) as BatchThumbnailResult[];

        const processingTime = performance.now() - startTime;

        // 結果を即座にUI更新
        results.forEach((result) => {
          const { path, thumbnail, error } = result;
          if (thumbnail) {
            this.updateSingleImage(path, thumbnail);
          } else if (error) {
            console.error(`サムネイル処理エラー: ${path}`, error);
          }
        });

        console.log(
          `チャンク ${chunkIndex + 1}/${chunks.length} 完了: ${processingTime.toFixed(1)}ms (${chunk.length}ファイル)`,
        );
      } catch (error) {
        console.error(`チャンク ${chunkIndex + 1} 処理エラー:`, error);
      }
    }

    console.log("全チャンク処理完了");
  }

  disconnectedCallback() {
    document.removeEventListener(
      "write-image-rating-with-path",
      this.handleWriteImageRatingWithPath,
    );
  }
}

customElements.define("grid-viewer", GridViewer);
