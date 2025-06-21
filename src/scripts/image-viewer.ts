import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import type {
  OpenBrowserEventDetail,
  ReadImageInfoEventDetail,
} from "./global";
import { loadImage } from "./image-loader";
import * as ImageNavigator from "./image-navigator";
import { KeyboardHandler } from "./keyboard-handler";

class ImageViewer extends HTMLElement {
  imgEl!: HTMLImageElement;
  currentImagePath!: string;
  private currentImageUrl: string | null = null;

  private keyboardHandler!: KeyboardHandler;

  // あとで `removeEventListener()` するためにアロー関数で定義
  private showPreviousImage = async () => {
    await this.navigateImage("previous");
  };

  private showNextImage = async () => {
    await this.navigateImage("next");
  };

  private openBrowser = async () => {
    document.dispatchEvent(
      new CustomEvent<OpenBrowserEventDetail>("open-browser", {
        detail: { dir: await path.dirname(this.currentImagePath) },
      })
    );
  };

  connectedCallback() {
    this.imgEl = this.querySelector("img")!;

    // 各種ハンドラーの初期化
    this.keyboardHandler = new KeyboardHandler({
      onPreviousImage: this.showPreviousImage,
      onNextImage: this.showNextImage,
    });

    // アロー関数なのでそのまま渡せる
    document.addEventListener("navigate-to-previous", this.showPreviousImage);
    document.addEventListener("navigate-to-next", this.showNextImage);
    document.addEventListener("open-browser-from-viewer", this.openBrowser);

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

    // 他のイベントリスナーもクリーンアップ
    document.removeEventListener(
      "navigate-to-previous",
      this.showPreviousImage
    );
    document.removeEventListener("navigate-to-next", this.showNextImage);
    document.removeEventListener("open-browser-from-viewer", this.openBrowser);

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

      // 画像情報の取得（非同期で実行、画像表示をブロックしない）
      this.loadImageMetadata(filePath).catch((error) => {
        console.warn("Failed to load image metadata:", error);
      });
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

  /**
   * 画像のメタデータを読み込む
   */
  private async loadImageMetadata(filePath: string) {
    try {
      const result: ReadImageInfoEventDetail = await invoke(
        "read_comprehensive_image_info",
        {
          path: filePath,
        }
      );

      console.log("Read image info:", result);

      document.dispatchEvent(
        new CustomEvent("read-image-info", { detail: result })
      );
    } catch (error) {
      console.error("Failed to load image metadata:", error);
      throw error;
    }
  }
}
customElements.define("image-viewer", ImageViewer);
