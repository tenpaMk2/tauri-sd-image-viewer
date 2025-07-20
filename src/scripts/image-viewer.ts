import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { autoReloader } from "./auto-reloader";
import type {
  OpenBrowserEventDetail,
  ReadImageInfoEventDetail,
  WriteImageRatingEventDetail,
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
      }),
    );
  };

  private copyToClipboard = async () => {
    if (!this.currentImagePath) {
      console.warn("No image path available for clipboard copy");
      document.dispatchEvent(
        new CustomEvent("clipboard-copy-failed", {
          detail: { error: "No image path available" },
        }),
      );
      return;
    }

    try {
      console.log("Copying image to clipboard:", this.currentImagePath);
      const result = await invoke("set_clipboard_files", {
        paths: [this.currentImagePath],
      });
      console.log("Image copied to clipboard successfully:", result);

      // コピー成功を通知
      document.dispatchEvent(
        new CustomEvent("clipboard-copy-success", {
          detail: { path: this.currentImagePath },
        }),
      );
    } catch (error) {
      console.error("Failed to copy image to clipboard:", error);
      document.dispatchEvent(
        new CustomEvent("clipboard-copy-failed", {
          detail: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  };

  private writeImageRating = async (
    event: CustomEvent<WriteImageRatingEventDetail>,
  ) => {
    const { rating } = event.detail;

    if (!this.currentImagePath) {
      console.warn("No image path available for rating");
      return;
    }

    await this.writeRatingToPath(this.currentImagePath, rating);
  };

  private async writeRatingToPath(path: string, rating: number) {
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
  }

  private createAutoReloadCallback = (): (() => Promise<void>) => {
    return async () => {
      if (!this.currentImagePath) {
        console.error("No image path available");
        return;
      }

      await this.navigateImage("last", { stopAutoReload: false });
    };
  };

  private requestStartAutoReload = async () => {
    console.log("Request to start auto reload");

    if (autoReloader.getState()) {
      console.warn("Auto reload is already active");
      return;
    }

    const callback = this.createAutoReloadCallback();
    autoReloader.start(callback);
  };

  private requestStopAutoReload = async () => {
    console.log("Request to stop auto reload");

    if (!autoReloader.getState()) {
      console.warn("Auto reload is not active");
      return;
    }

    autoReloader.stop();
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
    document.addEventListener("copy-to-clipboard", this.copyToClipboard);
    document.addEventListener("write-image-rating", this.writeImageRating);
    document.addEventListener("auto-reload-start", this.requestStartAutoReload);
    document.addEventListener("auto-reload-stop", this.requestStopAutoReload);

    // URLパラメータから初期画像のフルパスを取得
    const urlParams = new URLSearchParams(window.location.search);
    console.log({
      "urlParams.get('initialImagePath')": urlParams.get("initialImagePath"),
    });
    const imageFullPath = urlParams.get("initialImagePath") || "";
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
      this.showPreviousImage,
    );
    document.removeEventListener("navigate-to-next", this.showNextImage);
    document.removeEventListener("open-browser-from-viewer", this.openBrowser);
    document.removeEventListener("copy-to-clipboard", this.copyToClipboard);
    document.removeEventListener("write-image-rating", this.writeImageRating);
    document.removeEventListener(
      "auto-reload-start",
      this.requestStartAutoReload,
    );
    document.removeEventListener(
      "auto-reload-stop",
      this.requestStopAutoReload,
    );

    // 自動リロードを停止
    autoReloader.stop();

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
   */
  async navigateImage(
    direction: "previous" | "next" | "last",
    options: { stopAutoReload?: boolean } = { stopAutoReload: true },
  ) {
    if (!this.currentImagePath) {
      console.error("No image path available");
      return;
    }

    // 自動リロード停止の制御
    if (options.stopAutoReload && autoReloader.getState()) {
      console.log("Stopping auto reload due to manual navigation");
      autoReloader.stop();
    }

    const newImagePath = await ImageNavigator.findImageInDirection(
      this.currentImagePath,
      direction,
    );

    if (newImagePath && newImagePath !== this.currentImagePath) {
      await this.showImage(newImagePath);
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
        },
      );

      console.log("Read image info");
      console.debug({ result });

      // パス情報を追加してイベントを発火
      document.dispatchEvent(
        new CustomEvent("read-image-info", {
          detail: { ...result, path: filePath },
        }),
      );
    } catch (error) {
      console.error("Failed to load image metadata:", error);
      throw error;
    }
  }
}
customElements.define("image-viewer", ImageViewer);
