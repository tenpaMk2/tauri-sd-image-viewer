export class ImageViewerImageContainer extends HTMLElement {
  imageEl!: HTMLImageElement;

  connectedCallback() {
    this.imageEl = this.querySelector<HTMLImageElement>("img")!;
  }

  setSrc(src: string) {
    this.imageEl.src = src;
  }

  hide() {
    this.classList.remove("is-flex");
    this.classList.add("is-hidden");
  }
  show() {
    this.classList.remove("is-hidden");
    this.classList.add("is-flex");
  }
}
customElements.define(
  "image-viewer-image-container",
  ImageViewerImageContainer
);
