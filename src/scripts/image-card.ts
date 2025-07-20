import type { ImageRatingWriteSuccessEventDetail } from "./global";
import "./rating-overlay";
import { resetCss } from "./reset-css";

/**
 * 画像カードのカスタムエレメント
 * サムネイル画像とレーティング情報を表示
 */
export class ImageCard extends HTMLElement {
  readonly BASE_WIDTH_PX = 320; // 基本の幅
  readonly MAX_HEIGHT_PX = 500; // 最大の高さ

  static get observedAttributes() {
    return [
      "src",
      "width",
      "height",
      "href",
      "data-rating",
      "data-has-rating",
      "data-image-path",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // レーティング書き込み成功時の楽観的更新
    document.addEventListener(
      "image-rating-write-success",
      this.handleRatingWriteSuccess,
    );
  }

  private handleRatingWriteSuccess = (event: Event) => {
    const customEvent =
      event as CustomEvent<ImageRatingWriteSuccessEventDetail>;
    const { path, rating } = customEvent.detail;

    // このカードの画像パスと一致する場合のみ更新
    const myImagePath = this.getAttribute("data-image-path");
    if (myImagePath === path) {
      this.setAttribute("data-rating", rating.toString());
      this.setAttribute("data-has-rating", "true");
    }
  };

  attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    if (oldValue === newValue) return;

    switch (name) {
      case "src":
        this.updateImageSource(newValue as string);
        break;
      case "href":
        this.updateHref(newValue as string);
        break;
      case "width":
      case "height":
        this.updateLayout();
        break;
      case "data-rating":
      case "data-has-rating":
      case "data-image-path":
        this.updateRating();
        break;
    }
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        ${resetCss}

        :host {
          aspect-ratio: 1 / 1;
          background-color: hsl(var(--bulma-dark-h), var(--bulma-dark-s), var(--bulma-dark-l));
          border-radius: 8px;
          overflow: hidden;
        }
        
        .container {
          text-decoration: none;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        
        .spinner {
          width: 1.5em;
          height: 1.5em;
          border: 2px solid #dbdbdb;
          border-radius: 9999px;
          border-right-color: transparent;
          border-top-color: transparent;
          animation: spinAround 500ms infinite linear;
          display: block;
          position: relative;
        }
        
        .spinner.loaded {
          animation: none;
          display: none;
        }
        
        @keyframes spinAround {
          from { transform: rotate(0deg); }
          to { transform: rotate(359deg); }
        }
        
        .image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: none;
          position: absolute;
          top: 0;
          left: 0;
        }
        
        .image[src] {
          display: block;
        }
      </style>
      
      <a class="container">
        <div class="spinner"></div>
        <img class="image" />
        <rating-overlay></rating-overlay>
      </a>
    `;

    this.updateRating();
  }

  private updateImageSource(src: string) {
    const img = this.shadowRoot?.querySelector<HTMLImageElement>(".image");
    const spinner = this.shadowRoot?.querySelector<HTMLElement>(".spinner");

    if (!img || !spinner) return;

    img.src = src;
    img.loading = "lazy";

    img.onload = () => {
      spinner.classList.add("loaded");
    };
  }

  private updateHref(href: string) {
    const link =
      this.shadowRoot?.querySelector<HTMLAnchorElement>(".container");
    if (link) {
      link.href = href;
    }
  }

  private updateLayout() {
    const width = parseInt(this.getAttribute("width") ?? "0", 10);
    const height = parseInt(this.getAttribute("height") ?? "0", 10);

    if (!width || !height) return;

    const img = this.shadowRoot?.querySelector<HTMLImageElement>(".image");
    if (img) {
      img.width = width;
      img.height = height;
    }
  }

  private updateRating() {
    const hasRating = this.getAttribute("data-has-rating") === "true";
    const rating = parseInt(this.getAttribute("data-rating") ?? "0", 10);
    const imagePath = this.getAttribute("data-image-path");
    const overlay = this.shadowRoot?.querySelector("rating-overlay");

    if (!overlay) return;

    overlay.setAttribute("rating", rating.toString());
    overlay.setAttribute(
      "visible",
      (hasRating && rating < 6 && rating !== 0).toString(),
    );

    // 画像パスをrating-overlayに渡す
    if (imagePath) {
      overlay.setAttribute("image-path", imagePath);
    }
  }

  disconnectedCallback() {
    document.removeEventListener(
      "image-rating-write-success",
      this.handleRatingWriteSuccess,
    );
  }
}

customElements.define("image-card", ImageCard);
