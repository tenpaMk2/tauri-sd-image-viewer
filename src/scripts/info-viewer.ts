import type { ReadImageInfoEventDetail } from "./global";
import type { SdTag } from "./rust-synced-types";

class InfoViewerPrompt extends HTMLElement {
  containerEl!: HTMLElement;

  connectedCallback() {
    this.containerEl = this.querySelector("div")!;
  }

  updateTags(sdTags: SdTag[]) {
    this.containerEl.classList.remove("skeleton-block");

    const tagEls = sdTags.map((tag) => {
      const tagEl = document.createElement("span");
      tagEl.classList.add("tag");

      if (tag.weight === null) {
        tagEl.textContent = tag.name;
      } else {
        tagEl.textContent = `(${tag.name}:${tag.weight})`;
      }

      return tagEl;
    });

    console.debug({ tagElsLength: tagEls.length });

    this.containerEl.replaceChildren(...tagEls);
  }
}
customElements.define("info-viewer-prompt", InfoViewerPrompt);

// TODO: 内容が同じなので、class定義は1つにして、 `.define()` を2回呼び出すようにするのを検討。
class InfoViewerMeta extends HTMLElement {
  textarea!: HTMLTextAreaElement;

  connectedCallback() {
    this.textarea = this.querySelector("textarea")!;
  }

  updateText(text: string) {
    this.textarea.textContent = text;
  }
}
customElements.define("info-viewer-meta", InfoViewerMeta);

class InfoViewer extends HTMLElement {
  promptEl!: InfoViewerPrompt;
  metaEl!: InfoViewerMeta;

  connectedCallback() {
    this.promptEl = this.querySelector("info-viewer-prompt")!;
    this.metaEl = this.querySelector("info-viewer-meta")!;

    document.addEventListener(
      "read-image-info",
      this.handleReadImageInfo.bind(this)
    );
  }

  async handleReadImageInfo(event: CustomEvent<ReadImageInfoEventDetail>) {
    console.log({ readImageInfoEventDetail: event.detail });

    const sdParameters = event.detail.png_info.sd_parameters;

    if (!sdParameters) {
      console.warn("No SD parameters found in the image info.");
    }

    this.promptEl.updateTags(sdParameters?.positive_sd_tags ?? []);
  }
}
customElements.define("info-viewer", InfoViewer);
