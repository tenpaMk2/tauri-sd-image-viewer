import { path } from "@tauri-apps/api";
import type { FileSelectedEventDetail } from "./global";
import { loadImage } from "./image-loader";
import * as ImageNavigator from "./image-navigator";
import type { ImageViewerImageContainer } from "./image-viewer-image-container";
import type { ImageViewerUiContainer } from "./image-viewer-ui-container";
import { KeyboardHandler } from "./keyboard-handler";

class ImageViewer extends HTMLElement {
  uiContainerEl!: ImageViewerUiContainer;
  imageContainerEl!: ImageViewerImageContainer;
  currentImagePath!: string;
  private currentImageUrl: string | null = null;

  private keyboardHandler!: KeyboardHandler;

  connectedCallback() {
    // プロパティの初期化
    this.uiContainerEl = this.querySelector("image-viewer-ui-container")!;
    this.imageContainerEl = this.querySelector("image-viewer-image-container")!;

    // 各種ハンドラーの初期化
    this.keyboardHandler = new KeyboardHandler({
      onPreviousImage: () => this.showPreviousImage(),
      onNextImage: () => this.showNextImage(),
    });

    // URLパラメータから画像のフルパスを取得
    const urlParams = new URLSearchParams(window.location.search);
    console.log({
      "urlParams.get('imageFullPath')": urlParams.get("imageFullPath"),
    });
    const imageFullPath = urlParams.get("imageFullPath") || "";
    console.log({ imageFullPath });

    // キーボードショートカットのリスナーを登録
    this.keyboardHandler.attach();

    if (imageFullPath) {
      // すでに画像のパスが指定されている場合は、その画像を表示
      this.showImage(imageFullPath);
    } else {
      // 画像のパスが指定されていない場合は、ファイル選択ダイアログを表示

      // ファイル選択イベントのリスナーを登録
      this.uiContainerEl.addEventListener(
        "file-selected",
        (event: CustomEvent<FileSelectedEventDetail>) => {
          console.log({ fileSelectedEventDetail: event.detail });

          this.showImage(event.detail.filePaths[0]);
        }
      );
    }
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

      this.uiContainerEl.hide();
      this.imageContainerEl.setSrc(imageData.url);
      this.imageContainerEl.show();
    } catch (error) {
      console.error("Failed to show image:", error);
      // エラー処理（将来的にユーザーに通知）
    }
  }

  /**
   * キーボードイベントを処理する
   */
  handleKeyDown(_event: KeyboardEvent) {
    // このメソッドは KeyboardHandler に移動済み
    // 互換性のため残していますが、実際の処理は KeyboardHandler で行われます
  }

  /**
   * 同じディレクトリ内の画像ファイル一覧を読み込む
   */
  async loadImageFilesInCurrentDirectory(): Promise<string[]> {
    if (!this.currentImagePath) {
      return [];
    }

    const dir = await path.dirname(this.currentImagePath);
    return await ImageNavigator.loadImageFilesInDirectory(dir);
  }

  /**
   * 指定された方向の画像を表示する
   * @param direction "previous" for previous image, "next" for next image
   */
  async navigateImage(direction: "previous" | "next") {
    if (!this.currentImagePath) {
      console.log("No image path available");
      return;
    }

    const newImagePath = await ImageNavigator.findImageInDirection(
      this.currentImagePath,
      direction
    );

    if (newImagePath) {
      await this.showImage(newImagePath);
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
