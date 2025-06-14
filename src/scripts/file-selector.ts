import { path } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";

export class FileSelector extends HTMLElement {
  connectedCallback() {
    // TODO: ここはtauri全体のイベントじゃなくて、コンポーネントのイベントで書き直す。
    listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      console.log('"tauri://drag-drop" payload:', event.payload);

      const filePaths = event.payload.paths;
      for (const filePath of filePaths) {
        console.log({ filePath });
      }

      this.handleSelectedFiles(filePaths);
    });

    const inputEl = document.querySelector("input")!;

    inputEl.addEventListener("click", async (e) => {
      e.preventDefault();

      const filePaths = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: SUPPORTED_IMAGE_EXTS,
          },
        ],
      });

      console.log({ filePaths });

      if (!filePaths) {
        console.error("No file selected");
        return;
      }

      const filePathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
      this.handleSelectedFiles(filePathsArray);
    });
  }

  private async isImageFile(filePath: string): Promise<boolean> {
    try {
      const ext = (await path.extname(filePath)).toLowerCase();
      return SUPPORTED_IMAGE_EXTS.includes(ext as any);
    } catch (error) {
      console.error("Failed to check file extension:", error);
      return false;
    }
  }

  private async handleSelectedFiles(filePaths: string[]) {
    // 最初のサポートされた画像ファイルを見つける
    for (const filePath of filePaths) {
      if (await this.isImageFile(filePath)) {
        console.log("Navigating to image:", filePath);
        window.location.href = `/view?imageFullPath=${encodeURIComponent(filePath)}`;
        return;
      }
    }

    console.warn("No supported image files found in selected files");
    // TODO: ユーザーにエラーメッセージを表示
  }
}
customElements.define("file-selector", FileSelector);

listen("tauri://error", (e) => {
  console.error('"tauri://error" event:', e);
});
