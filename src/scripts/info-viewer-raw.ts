class InfoViewerRaw extends HTMLElement {
  textarea!: HTMLTextAreaElement;

  connectedCallback() {
    this.textarea = this.querySelector("textarea")!;
  }

  updateRawText(text: string) {
    this.textarea.textContent = text;
  }
}
customElements.define("info-viewer-raw", InfoViewerRaw);
