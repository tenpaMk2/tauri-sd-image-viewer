import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { AutoReloadExecutor } from "./auto-reload-executor";
import { autoReloadStateManager } from "./auto-reload-state-manager";
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
  private autoReloadExecutor = new AutoReloadExecutor();

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
    if (autoReloadStateManager.getState()) {
      console.warn("Auto reload is already active");
      return;
    }

    const callback = this.createAutoReloadCallback();
    this.autoReloadExecutor.start(callback, 2000);
    autoReloadStateManager.start();
  };

  private requestStopAutoReload = async () => {
    if (!autoReloadStateManager.getState()) {
      console.warn("Auto reload is not active");
      return;
    }

    this.autoReloadExecutor.stop();
    autoReloadStateManager.stop();
  };

  private handleAutoReloadStateRequest = () => {
    // 現在の状態を即座に通知
    document.dispatchEvent(
      new CustomEvent("auto-reload-state-changed", {
        detail: { isActive: autoReloadStateManager.getState() },
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
    document.addEventListener("auto-reload-start", this.requestStartAutoReload);
    document.addEventListener("auto-reload-stop", this.requestStopAutoReload);
    document.addEventListener(
      "request-auto-reload-state",
      this.handleAutoReloadStateRequest
    );

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
      this.showPreviousImage
    );
    document.removeEventListener("navigate-to-next", this.showNextImage);
    document.removeEventListener("open-browser-from-viewer", this.openBrowser);
    document.removeEventListener(
      "auto-reload-start",
      this.requestStartAutoReload
    );
    document.removeEventListener(
      "auto-reload-stop",
      this.requestStopAutoReload
    );
    document.removeEventListener(
      "request-auto-reload-state",
      this.handleAutoReloadStateRequest
    );

    // 自動リロードを停止
    this.autoReloadExecutor.stop();
    autoReloadStateManager.stop();

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
    options: { stopAutoReload?: boolean } = { stopAutoReload: true }
  ) {
    if (!this.currentImagePath) {
      console.error("No image path available");
      return;
    }

    // 自動リロード停止の制御
    if (options.stopAutoReload && autoReloadStateManager.getState()) {
      console.log("Stopping auto reload due to manual navigation");
      this.autoReloadExecutor.stop();
      autoReloadStateManager.stop();
    }

    const newImagePath = await ImageNavigator.findImageInDirection(
      this.currentImagePath,
      direction
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
        }
      );

      console.log("Read image info");
      console.debug({ result });

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
