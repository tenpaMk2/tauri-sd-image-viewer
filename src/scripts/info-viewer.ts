import type { ExifParsedEventDetail } from "./global";
import { SdParameterParser, type SdTag } from "./sd-parameter-parser";

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

      if (tag.weight === undefined) {
        tagEl.textContent = tag.name;
      } else {
        tagEl.textContent = `(${tag.name}:${tag.weight})`;
      }

      return tagEl;
    });

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

    document.addEventListener("exif-parsed", this.handleExifParsed.bind(this));
  }

  async handleExifParsed(event: CustomEvent<ExifParsedEventDetail>) {
    console.log({ exifParsedEventDetail: event.detail });

    console.log(event.detail.tagInfo.parameters?.value);

    const sdParameters = await SdParameterParser.parseSdParameters(
      event.detail.tagInfo.parameters?.value ?? ""
    );

    this.promptEl.updateTags(sdParameters.positiveSdTags);
  }

  // generatePrompt(sdTags: ExifParser.SdTag[]) {
  //   return sdTags
  //     .map((tag) => {
  //       if (tag.weight === undefined) {
  //         return tag.name;
  //       }

  //       return `(${tag.name}:${tag.weight})`;
  //     })
  //     .join(", ");
  // }
}
customElements.define("info-viewer", InfoViewer);
