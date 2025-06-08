import { path } from "@tauri-apps/api";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import * as ExifParser from "./exif-parser";
import type { FileSelectedEventDetail } from "./global";
import type { ImageViewerImageContainer } from "./image-viewer-image-container";
import type { ImageViewerUiContainer } from "./image-viewer-ui-container";
import {
  detectImageMimeType,
  SUPPORTED_IMAGE_EXTS,
  type MimeType,
} from "./mine-type";

class ImageViewer extends HTMLElement {
  uiContainerEl!: ImageViewerUiContainer;
  imageContainerEl!: ImageViewerImageContainer;
  currentImagePath!: string;
  private currentImageUrl: string | null = null;

  connectedCallback() {
    // プロパティの初期化
    this.uiContainerEl = this.querySelector("image-viewer-ui-container")!;
    this.imageContainerEl = this.querySelector("image-viewer-image-container")!;

    // URLパラメータから画像のフルパスを取得
    const urlParams = new URLSearchParams(window.location.search);
    console.log({
      "urlParams.get('imageFullPath')": urlParams.get("imageFullPath"),
    });
    const imageFullPath = urlParams.get("imageFullPath") || "";
    console.log({ imageFullPath });

    // キーボードショートカットのリスナーを登録
    document.addEventListener("keydown", this.handleKeyDown.bind(this));

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
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
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
    console.log({ showingImageFilePath: filePath });

    // 前の画像URLをクリーンアップ
    this.cleanupCurrentImageUrl();

    this.currentImagePath = filePath;

    const imageData = await readFile(filePath);

    const mimeType: MimeType =
      (await detectImageMimeType(filePath)) ?? "image/jpeg";

    const blob = new Blob([imageData], { type: mimeType });
    this.currentImageUrl = URL.createObjectURL(blob);

    this.uiContainerEl.hide();
    this.imageContainerEl.setSrc(this.currentImageUrl);
    this.imageContainerEl.show();

    ExifParser.parseAndEmit(imageData.buffer);
  }

  /**
   * キーボードイベントを処理する
   */
  handleKeyDown(event: KeyboardEvent) {
    // フォーカスされている要素がテキスト入力欄かどうかをチェック
    const activeElement = document.activeElement;
    const isInputActive =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable);

    // テキスト入力欄がフォーカスされている場合は処理しない
    if (isInputActive) {
      return;
    }

    // カーソルキーの処理
    switch (event.key) {
      case "ArrowLeft":
        // 左キーの処理
        console.log({ keyPressed: event.key });
        event.preventDefault(); // デフォルトのスクロール動作を防止
        this.showPreviousImage();
        break;
      case "ArrowRight":
        // 右キーの処理
        console.log({ keyPressed: event.key });
        event.preventDefault();
        this.showNextImage();
        break;
      case "ArrowUp":
        // 上キーの処理
        console.log({ keyPressed: event.key });
        event.preventDefault();
        break;
      case "ArrowDown":
        // 下キーの処理
        console.log({ keyPressed: event.key });
        event.preventDefault();
        break;
    }
  }

  /**
   * 同じディレクトリ内の画像ファイル一覧を読み込む
   */
  async loadImageFilesInCurrentDirectory(): Promise<string[]> {
    if (!this.currentImagePath) {
      return [];
    }

    const dir = await path.dirname(this.currentImagePath);
    const dirEntries = await readDir(dir);
    const imageEntries = dirEntries.filter(
      (entry) =>
        entry.isFile &&
        SUPPORTED_IMAGE_EXTS.some((ext) =>
          entry.name.toLowerCase().endsWith(`.${ext}`)
        )
    );

    return imageEntries.map((entry) => entry.name).sort();
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

    const dir = await path.dirname(this.currentImagePath);
    const imageFilenames = await this.loadImageFilesInCurrentDirectory();

    if (imageFilenames.length === 0) {
      console.log("No images found in directory");
      return;
    }

    const currentBasename = await path.basename(this.currentImagePath);
    const currentIndex = imageFilenames.indexOf(currentBasename);

    if (currentIndex === -1) {
      console.log("Current image not found in directory");
      return;
    }

    // 次/前の画像のインデックスを計算（循環処理）
    const newIndex =
      direction === "next"
        ? (currentIndex + 1) % imageFilenames.length
        : (currentIndex - 1 + imageFilenames.length) % imageFilenames.length;

    const newImagePath = await path.join(dir, imageFilenames[newIndex]);

    console.log({
      direction,
      currentIndex,
      newIndex,
      currentImagePath: this.currentImagePath,
      newImagePath,
    });

    this.showImage(newImagePath);
  }

  async showPreviousImage() {
    await this.navigateImage("previous");
  }

  async showNextImage() {
    await this.navigateImage("next");
  }
}
customElements.define("image-viewer", ImageViewer);
