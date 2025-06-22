import type { ReadImageInfoEventDetail } from "./global";
import type { InfoViewerBasic } from "./info-viewer-basic";
import type { InfoViewerOther } from "./info-viewer-other";
import type { InfoViewerPrompt } from "./info-viewer-prompt";

class InfoViewer extends HTMLElement {
  basicEl!: InfoViewerBasic;
  positivePromptEl!: InfoViewerPrompt;
  negativePromptEl!: InfoViewerPrompt;
  otherEl!: InfoViewerOther;
  rawEl!: InfoViewerRaw;

  connectedCallback() {
    this.basicEl = this.querySelector("info-viewer-basic")!;
    this.positivePromptEl = this.querySelector(
      'info-viewer-prompt[data-prompt-type="positive"]'
    )!;
    this.negativePromptEl = this.querySelector(
      'info-viewer-prompt[data-prompt-type="negative"]'
    )!;
    this.otherEl = this.querySelector("info-viewer-other")!;
    this.rawEl = this.querySelector("info-viewer-raw")!;

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

    this.basicEl.updateInfos(event.detail);
    this.positivePromptEl.updateTags(sdParameters?.positive_sd_tags ?? []);
    this.negativePromptEl.updateTags(sdParameters?.negative_sd_tags ?? []);
    this.otherEl.updateInfos(sdParameters);
    this.rawEl.updateRawText(sdParameters?.raw ?? "");
  }
}
customElements.define("info-viewer", InfoViewer);
