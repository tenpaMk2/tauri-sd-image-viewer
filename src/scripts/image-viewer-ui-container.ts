import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileSelectedEventDetail } from "./global";

export class ImageViewerUiContainer extends HTMLElement {
  connectedCallback() {
    // TODO: ここはtauri全体のイベントじゃなくて、コンポーネントのイベントで書き直す。
    listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      console.log('"tauri://drag-drop" payload:', event.payload);

      const filePaths = event.payload.paths;
      for (const filePath of filePaths) {
        console.log({ filePath });
      }

      this.dispatch(filePaths);
    });

    const inputEl = document.querySelector("input")!;

    inputEl.addEventListener("click", async (e) => {
      e.preventDefault();

      const filePaths = await open({
        multiple: true,
        directory: false,
      });

      console.log({ filePaths });

      if (!filePaths) {
        console.error("No file selected");
        return;
      }

      this.dispatch(filePaths);
    });
  }

  dispatch(filePaths: string[]) {
    // カスタムイベントを発火して親に通知
    this.dispatchEvent(
      new CustomEvent<FileSelectedEventDetail>("file-selected", {
        detail: { filePaths },
      })
    );
  }

  hide() {
    this.classList.add("is-hidden");
  }
  show() {
    this.classList.remove("is-hidden");
  }
}
customElements.define("image-viewer-ui-container", ImageViewerUiContainer);

listen("tauri://error", (e) => {
  console.error('"tauri://error" event:', e);
});
