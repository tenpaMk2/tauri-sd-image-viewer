import "@scripts/image-card";
import type { ImageCard } from "@scripts/image-card";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";
import type { ThumbnailInfo } from "./rust-synced-types";
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
  }, 1);

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

      // キューにタスクを追加
      this.imageLoadQueue.add({ id: imageFullPath });
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
