import { listen } from "@tauri-apps/api/event";
import * as TauriDialog from "@tauri-apps/plugin-dialog";
import type { OpenBrowserEventDetail, OpenImageEventDetail } from "./global";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";

/**
 * 画像を開く
 */
document.addEventListener(
  "open-image",
  async (event: CustomEvent<OpenImageEventDetail>) => {
    console.log("'open-image' event received:", event.detail);

    const imagePath = event.detail?.imageFullPath;

    if (!imagePath) {
      console.error("No image path provided in event detail");
      return;
    }

    // サポート画像ファイルかを確認
    if (!SUPPORTED_IMAGE_EXTS.some((ext) => imagePath.endsWith(ext))) {
      console.error("Unsupported image file type:", imagePath);
      return;
    }

    console.info("Navigating to image view with path:", imagePath);

    window.location.href = `/view?imageFullPath=${encodeURIComponent(imagePath)}`;
  }
);

/**
 * ブラウザーを開く
 */
document.addEventListener(
  "open-browser",
  async (event: CustomEvent<OpenBrowserEventDetail>) => {
    console.log("'open-browser' event received:", event.detail);

    const dir = event.detail?.dir;

    console.info("Navigating to browser with dir:", dir);

    if (dir) {
      window.location.href = `/browse?dir=${encodeURIComponent(dir)}`;
    }
  }
);

/**
 * 単一画像ファイル選択ダイアログを開く
 */
document.addEventListener(
  "open-image-selector-dialog",
  async (event: CustomEvent) => {
    console.log("'open-image-selector-dialog' event received:", event.detail);

    const imageFullPath = await TauriDialog.open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Images",
          extensions: SUPPORTED_IMAGE_EXTS,
        },
      ],
    });

    console.log({ selectedPaths: imageFullPath });

    if (imageFullPath === null) {
      console.log("No file selected");
      return;
    }

    document.dispatchEvent(
      new CustomEvent<OpenImageEventDetail>("open-image", {
        detail: { imageFullPath },
      })
    );
  }
);

/**
 * 複数ディレクトリ選択ダイアログを開く
 */
document.addEventListener(
  "open-directories-selector-dialog",
  async (event: CustomEvent) => {
    console.log(
      "'open-directories-selector-dialog' event received:",
      event.detail
    );

    const directories = await TauriDialog.open({
      multiple: true,
      directory: true,
    });

    console.log({ selectedPaths: directories });

    if (directories === null) {
      console.log("No directory selected");
      return;
    }

    const dir = directories[0]; // 最初の選択されたディレクトリを使用
    // TODO: 複数ディレクトリの選択に対応

    document.dispatchEvent(
      new CustomEvent<OpenBrowserEventDetail>("open-browser", {
        detail: { dir },
      })
    );
  }
);

/**
 * ドラッグ&ドロップイベントのリスナー
 */
listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
  console.log('"tauri://drag-drop" payload:', event.payload);

  const filePaths = event.payload.paths;

  if (filePaths.length === 0) {
    console.warn("No files dropped");
    return;
  }

  document.dispatchEvent(
    new CustomEvent<OpenImageEventDetail>("open-image", {
      detail: { imageFullPath: filePaths[0] }, // 最初のファイルを使用
    })
  );
});

/**
 * Tauriのエラーイベントリスナー
 */
listen("tauri://error", (e) => {
  console.error('"tauri://error" event:', e);
});
