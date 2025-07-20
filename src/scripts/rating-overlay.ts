import "./rating-button";

/**
 * レーティングオーバーレイのカスタムエレメント
 */
export class RatingOverlay extends HTMLElement {
  static get observedAttributes() {
    return ["rating", "visible", "image-path"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private get rating(): number {
    return parseInt(this.getAttribute("rating") ?? "0", 10);
  }

  private get isVisible(): boolean {
    return this.getAttribute("visible") === "true";
  }

  private get imagePath(): string | null {
    return this.getAttribute("image-path");
  }

  private render() {
    const imagePath = this.imagePath;
    const buttons = Array.from({ length: 5 }, (_, index) => {
      const buttonRating = index + 1;
      const isActive = buttonRating < this.rating + 1;
      const imagePathAttr = imagePath ? `image-path="${imagePath}"` : "";
      return `<rating-button rating="${buttonRating}" active="${isActive}" ${imagePathAttr}></rating-button>`;
    }).join("");

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgb(0 0 0 / 0.5);
          border-radius: 4px;
          display: ${this.isVisible ? "block" : "none"};
          opacity: ${this.isVisible ? "1" : "0"};
          transition: opacity 0.2s ease;
        }
        
        .rating-container {
          display: flex;
          align-items: center;
        }
      </style>
      <div class="rating-container">
        ${buttons}
      </div>
    `;
  }
}

customElements.define("rating-overlay", RatingOverlay);
