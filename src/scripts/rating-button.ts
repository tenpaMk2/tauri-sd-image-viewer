import "./star-icon";

/**
 * レーティングボタンのカスタムエレメント
 */
export class RatingButton extends HTMLElement {
  static get observedAttributes() {
    return ["rating", "active", "image-path"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
    this.setupEventListeners();
  }

  attributeChangedCallback() {
    this.render();
  }

  private setupEventListeners() {
    this.shadowRoot?.addEventListener("click", this.handleClick);
  }

  private handleClick = async (event: Event) => {
    // イベントの伝播を停止してリンクジャンプを防ぐ
    event.preventDefault();
    event.stopPropagation();

    const rating = this.rating;
    const imagePath = this.imagePath;

    if (!imagePath) {
      console.error("Image path not provided to rating-button");
      return;
    }

    // ImageViewerにrating書き込みを依頼（パスを含む）
    document.dispatchEvent(
      new CustomEvent("write-image-rating-with-path", {
        detail: { rating: rating, path: imagePath },
      }),
    );

    // 楽観的更新は image-card で image-rating-write-success をリッスンして処理
  };

  private get rating(): number {
    return parseInt(this.getAttribute("rating") ?? "0", 10);
  }

  private get isActive(): boolean {
    return this.getAttribute("active") === "true";
  }

  private get imagePath(): string | null {
    return this.getAttribute("image-path");
  }

  private render() {
    const variant = this.isActive ? "fill" : "empty";

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        
        button {
          background-color: transparent;
          border: 1px solid rgb(255 255 255 / 0.2);
          color: white;
          cursor: pointer;
          padding: 0.2rem 0.3rem;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s ease;
        }
        
        button:hover {
          background-color: rgb(255 255 255 / 0.1);
        }
        
        /* 連結ボタンスタイル */
        :host(:first-child) button {
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
        }
        
        :host(:last-child) button {
          border-top-right-radius: 4px;
          border-bottom-right-radius: 4px;
        }
        
        :host(:not(:first-child)) button {
          border-left: none;
        }
      </style>
      <button type="button" data-rating="${this.rating}" title="Rating: ${this.rating}">
        <star-icon variant="${variant}" size="0.875rem"></star-icon>
      </button>
    `;
  }
}

customElements.define("rating-button", RatingButton);
