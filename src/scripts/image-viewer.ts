import { path } from "@tauri-apps/api";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import * as ExifParser from "./exif-parser";
import type { FileSelectedEventDetail } from "./global";
import type { ImageViewerImageContainer } from "./image-viewer-image-container";
import type { ImageViewerUiContainer } from "./image-viewer-ui-container";

class ImageViewer extends HTMLElement {
  uiContainerEl!: ImageViewerUiContainer;
  imageContainerEl!: ImageViewerImageContainer;
  currentImagePath!: string;

  connectedCallback() {
    // プロパティの初期化
    this.uiContainerEl = this.querySelector("image-viewer-ui-container")!;
    this.imageContainerEl = this.querySelector("image-viewer-image-container")!;

    // ファイル選択イベントのリスナーを登録
    this.uiContainerEl.addEventListener(
      "file-selected",
      (event: CustomEvent<FileSelectedEventDetail>) => {
        console.log({ fileSelectedEventDetail: event.detail });

        this.currentImagePath = event.detail.filePaths[0];
        this.showImage(this.currentImagePath);
      }
    );

    // キーボードショートカットのリスナーを登録
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  // コンポーネントがDOMから削除されたときにイベントリスナーをクリーンアップ
  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }

  /**
   * 画像を表示する
   * @param filePath 選択されたファイルのパス
   */
  async showImage(filePath: string) {
    console.log({ showingImageFilePath: filePath });
    const imageData = await readFile(filePath);

    const blob = new Blob([imageData], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);

    this.uiContainerEl.hide();
    this.imageContainerEl.setSrc(url);
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
        // this.showPreviousImage(); など
        event.preventDefault(); // デフォルトのスクロール動作を防止
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

  async showNextImage() {
    if (!this.currentImagePath) {
      console.log("No image path available");
      return;
    }

    const dir = await path.dirname(this.currentImagePath);

    console.log({ dir });

    const dirEntries = await readDir(dir);
    const imageEntries = dirEntries.filter(
      (entry) =>
        entry.isFile &&
        (entry.name.endsWith(".jpg") || entry.name.endsWith(".png"))
    );

    const imageFilenames = imageEntries.map((entry) => entry.name).sort();
    // console.log({ imageFilenames });

    const currentIndex = imageFilenames.indexOf(
      await path.basename(this.currentImagePath)
    );
    const nextIndex = (currentIndex + 1) % imageFilenames.length;
    const nextImagePath = await path.join(dir, imageFilenames[nextIndex]);

    console.log({
      currentIndex,
      nextIndex,
      currentImagePath: this.currentImagePath,
      nextImagePath,
    });

    this.showImage(nextImagePath);
    this.currentImagePath = nextImagePath;
  }
}
customElements.define("image-viewer", ImageViewer);
