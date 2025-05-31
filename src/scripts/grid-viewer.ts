import "@scripts/image-card";
import type { ImageCard } from "@scripts/image-card";
import { path } from "@tauri-apps/api";
import { readDir, readFile } from "@tauri-apps/plugin-fs";

const detectImageMineType = async (
  filename: string
): Promise<string | null> => {
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
    default:
      return null;
  }
};

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

  async connectedCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log({ "urlParams.get('dir')": urlParams.get("dir") });
    const TARGET_DIR = urlParams.get("dir") || (await path.downloadDir());

    const dirEntries = await readDir(TARGET_DIR);
    const imageEntries = dirEntries.filter(
      (entry) => entry.isFile && /\.(jpg|jpeg|png|webp|gif)$/i.test(entry.name)
    );

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
    }

    const promises = imageFullPaths.map(this.updateImage.bind(this));
    await Promise.all(promises);
  }

  async updateImage(imageFullPath: string) {
    try {
      const mimeType =
        (await detectImageMineType(imageFullPath)) ?? "image/png";
      const imageData = await readFile(imageFullPath);
      // 画像の詳細情報を取得
      const { url, width, height } = await getImageDetails(imageData, mimeType);

      const imageCard = this.imageMap.get(imageFullPath)!;
      imageCard.setAttribute("src", url);
      imageCard.setAttribute("width", width.toString());
      imageCard.setAttribute("height", height.toString());
      imageCard.setAttribute(
        "href",
        "/?image=" + encodeURIComponent(imageFullPath)
      );
    } catch (error) {
      console.error(`Failed to load image: ${imageFullPath}`, error);
    }
  }
}
customElements.define("grid-viewer", GridViewer);
