import { path } from "@tauri-apps/api";
import type { OpenBrowserEventDetail } from "./global";
import { loadImage } from "./image-loader";
import * as ImageNavigator from "./image-navigator";
import { KeyboardHandler } from "./keyboard-handler";

class ImageViewer extends HTMLElement {
  imgEl!: HTMLImageElement;
  currentImagePath!: string;
  private currentImageUrl: string | null = null;

  private keyboardHandler!: KeyboardHandler;

  connectedCallback() {
    this.imgEl = this.querySelector("img")!;

    // 各種ハンドラーの初期化
    this.keyboardHandler = new KeyboardHandler({
      onPreviousImage: () => this.showPreviousImage(),
      onNextImage: () => this.showNextImage(),
    });
    document.addEventListener(
      "navigate-to-previous",
      this.showPreviousImage.bind(this)
    );
    document.addEventListener(
      "navigate-to-next",
      this.showNextImage.bind(this)
    );
    document.addEventListener("open-browser-from-viewer", async () =>
      document.dispatchEvent(
        new CustomEvent<OpenBrowserEventDetail>("open-browser", {
          detail: { dir: await path.dirname(this.currentImagePath) },
        })
      )
    );

    // URLパラメータから画像のフルパスを取得
    const urlParams = new URLSearchParams(window.location.search);
    console.log({
      "urlParams.get('imageFullPath')": urlParams.get("imageFullPath"),
    });
    const imageFullPath = urlParams.get("imageFullPath") || "";
    console.log({ imageFullPath });

    // キーボードショートカットのリスナーを登録
    this.keyboardHandler.attach();

    this.showImage(imageFullPath);
  }

  // コンポーネントがDOMから削除されたときにイベントリスナーをクリーンアップ
  disconnectedCallback() {
    this.keyboardHandler?.detach();
    // URLオブジェクトのクリーンアップ
    this.cleanupCurrentImageUrl();
  }

  /**
   * 現在の画像URLをクリーンアップする
   */
  private cleanupCurrentImageUrl() {
    if (this.currentImageUrl) {
      URL.revokeObjectURL(this.currentImageUrl);
      this.currentImageUrl = null;
    }
  }

  /**
   * 画像を表示する
   * @param filePath 選択されたファイルのパス
   */
  async showImage(filePath: string) {
    try {
      console.log({ showingImageFilePath: filePath });

      // 前の画像URLをクリーンアップ
      this.cleanupCurrentImageUrl();

      this.currentImagePath = filePath;

      const imageData = await loadImage(filePath);
      this.currentImageUrl = imageData.url;

      this.imgEl.src = imageData.url;
    } catch (error) {
      console.error("Failed to show image:", error);
      // エラー処理（将来的にユーザーに通知）
    }
  }

  /**
   * 指定された方向の画像を表示する
   * @param direction "previous" for previous image, "next" for next image
   */
  async navigateImage(direction: "previous" | "next") {
    if (!this.currentImagePath) {
      console.error("No image path available");
      return;
    }

    const newImagePath = await ImageNavigator.findImageInDirection(
      this.currentImagePath,
      direction
    );

    if (newImagePath) {
      window.location.href = `/view?imageFullPath=${encodeURIComponent(newImagePath)}`;
    }
  }

  async showPreviousImage() {
    await this.navigateImage("previous");
  }

  async showNextImage() {
    await this.navigateImage("next");
  }
}
customElements.define("image-viewer", ImageViewer);
