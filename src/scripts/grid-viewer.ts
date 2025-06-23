import "@scripts/image-card";
import type { ImageCard } from "@scripts/image-card";
import { path } from "@tauri-apps/api";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import {
  detectImageMimeType,
  SUPPORTED_IMAGE_EXTS,
  type MimeType,
} from "./mine-type";
import { TaskQueue } from "./task-queue";

// 画像データからアスペクト比を取得する関数（最適化バージョン）
const getImageDetails = (
  imageData: Uint8Array,
  mimeType: string
): Promise<{
  url: string;
  width: number;
  height: number;
}> => {
  // asyncで囲わずに、直接Promiseを返す
  return new Promise((resolve, reject) => {
    const blob = new Blob([imageData], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      resolve({ url, width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読み込みに失敗しました"));
    };

    img.src = url;
  });
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
        .sort()
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
      const mimeType: MimeType =
        (await detectImageMimeType(imageFullPath)) ?? "image/png";
      const imageData = await readFile(imageFullPath);
      // 画像の詳細情報を取得
      const { url, width, height } = await getImageDetails(imageData, mimeType);

      const imageCard = this.imageMap.get(imageFullPath)!;
      imageCard.setAttribute("src", url);
      imageCard.setAttribute("width", width.toString());
      imageCard.setAttribute("height", height.toString());
      imageCard.setAttribute(
        "href",
        "view/?imageFullPath=" + encodeURIComponent(imageFullPath)
      );
    } catch (error) {
      console.error(`Failed to load image: ${imageFullPath}`, error);
    }
  };
}
customElements.define("grid-viewer", GridViewer);
