import type { SdTag } from "./rust-synced-types";

export class InfoViewerPrompt extends HTMLElement {
  containerEl!: HTMLElement;

  connectedCallback() {
    this.containerEl = this.querySelector("div")!;
  }

  updateTags(sdTags: SdTag[]) {
    this.containerEl.classList.remove("skeleton-block");

    const tagEls = sdTags.map((tag) => {
      const tagEl = document.createElement("span");
      tagEl.classList.add("tag");
      tagEl.classList.add("is-primary");

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
