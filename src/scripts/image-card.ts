import { resetCss } from "./reset-css";

export class ImageCard extends HTMLElement {
  readonly BASE_WIDTH_PX = 320; // 基本の幅
  readonly MAX_HEIGHT_PX = 500; // 最大の高さ

  static get observedAttributes() {
    return ["src", "width", "height", "href", "data-rating", "data-has-rating"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // 初期レイアウトを設定
    this.shadowRoot!.innerHTML = `
      <a>
        <div data-element="spinner"></div>
        <img />
        <div data-element="rating-overlay">
          <div class="buttons has-addons is-small m-0" data-element="rating-buttons">
            <!-- ボタンはJavaScriptで動的生成 -->
          </div>
        </div>
      </a>

      <style>
        ${resetCss}

        :host {
          aspect-ratio: 1 / 1;
          background-color: hsl(var(--bulma-dark-h), var(--bulma-dark-s), var(--bulma-dark-l));
          border-radius: 8px;
          overflow: hidden;
        }
        
        a {
          text-decoration: none;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        
        [data-element="spinner"] {
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
        
        [data-element="spinner"].loaded {
          animation: none;
          display: none;
        }
        
        @keyframes spinAround {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(359deg);
          }
        }
        
        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: none;
          position: absolute;
          top: 0;
          left: 0;
        }
        
        img[src] {
          display: block;
        }
        
        [data-element="rating-overlay"] {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgb(0 0 0 / 0.5);
          border-radius: 4px;
          display: none;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        :host([data-has-rating="true"]) [data-element="rating-overlay"] {
          display: block;
          opacity: 1;
        }
        
        /* Bulmaボタンスタイルのオーバーライド */
        .buttons {
          display: flex;
          align-items: center;
        }
        
        .button {
          background-color: transparent;
          border: 1px solid rgb(255 255 255 / 0.2);
          color: white;
          cursor: pointer;
          padding: 0.125rem;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s ease;
        }
        
        .button:hover {
          background-color: rgb(255 255 255 / 0.1);
        }
        
        .buttons.has-addons .button:first-child {
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
        }
        
        .buttons.has-addons .button:last-child {
          border-top-right-radius: 4px;
          border-bottom-right-radius: 4px;
        }
        
        .buttons.has-addons .button:not(:first-child) {
          border-left: none;
        }
        
        .icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 1rem;
          width: 1rem;
        }
        
        .is-hidden {
          display: none !important;
        }
      </style>
    `;

    // ボタンを動的生成
    this.generateRatingButtons();
  }

  // レーティングボタンを動的生成
  private generateRatingButtons() {
    const buttonsContainer = this.shadowRoot!.querySelector(
      '[data-element="rating-buttons"]',
    )!;

    for (let rating = 1; rating <= 5; rating++) {
      const button = this.createRatingButton(rating);
      buttonsContainer.appendChild(button);
    }
  }

  // 単一のレーティングボタンを作成
  private createRatingButton(rating: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "button";
    button.setAttribute("data-rating", rating.toString());
    button.setAttribute("title", `Rating: ${rating}`);

    button.innerHTML = `
      <span class="icon">
        <span data-star="fill" class="is-hidden">
          ${this.getStarFillSvg()}
        </span>
        <span data-star="empty">
          ${this.getStarEmptySvg()}
        </span>
      </span>
    `;

    return button;
  }

  // 塗りつぶし星のSVGを取得 (Mage アイコン: mage:star-fill)
  private getStarFillSvg(): string {
    return `
      <svg width="1.0em" height="1.0em" viewBox="0 0 24 24">
        <path fill="currentColor" d="M21.95 10.605a1.75 1.75 0 0 1-.5.86l-3.3 3.22a.4.4 0 0 0-.08.12a.3.3 0 0 0 0 .14l.78 4.56c.065.336.03.684-.1 1a1.65 1.65 0 0 1-.61.77a1.83 1.83 0 0 1-.92.35h-.13a1.8 1.8 0 0 1-.84-.21l-4.1-2.14a.28.28 0 0 0-.28 0l-4.1 2.15a1.9 1.9 0 0 1-1 .21a1.83 1.83 0 0 1-.93-.35a1.75 1.75 0 0 1-.61-.78a1.8 1.8 0 0 1-.1-1l.78-4.55a.23.23 0 0 0 0-.14a.4.4 0 0 0-.07-.12l-3.3-3.24a1.8 1.8 0 0 1-.49-.85a1.75 1.75 0 0 1 0-1a1.81 1.81 0 0 1 1.49-1.21l4.5-.66a.18.18 0 0 0 .12-.05a.3.3 0 0 0 .09-.11l2.1-4.18c.143-.3.369-.553.65-.73a1.79 1.79 0 0 1 2.57.74l2.08 4.16a.4.4 0 0 0 .1.12a.2.2 0 0 0 .13.05l4.57.66c.332.05.644.192.9.41c.251.217.441.496.55.81c.106.32.124.662.05.99"></path>
      </svg>
    `;
  }

  // 空の星のSVGを取得 (Mage アイコン: mage:star)
  private getStarEmptySvg(): string {
    return `
      <svg width="1.0em" height="1.0em" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m12.495 18.587l4.092 2.15a1.044 1.044 0 0 0 1.514-1.106l-.783-4.552a1.05 1.05 0 0 1 .303-.929l3.31-3.226a1.043 1.043 0 0 0-.575-1.785l-4.572-.657A1.04 1.04 0 0 1 15 7.907l-2.088-4.175a1.044 1.044 0 0 0-1.88 0L8.947 7.907a1.04 1.04 0 0 1-.783.575l-4.51.657a1.044 1.044 0 0 0-.584 1.785l3.309 3.226a1.04 1.04 0 0 1 .303.93l-.783 4.55a1.044 1.044 0 0 0 1.513 1.107l4.093-2.15a1.04 1.04 0 0 1 .991 0"></path>
      </svg>
    `;
  }

  // 属性が変更されたときに呼ばれる
  attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    if (oldValue === newValue) return;

    if (name === "src") {
      const img = this.shadowRoot!.querySelector<HTMLImageElement>("img")!;
      const spinner = this.shadowRoot!.querySelector<HTMLElement>(
        '[data-element="spinner"]',
      )!;

      img.src = newValue as string;
      img.loading = "lazy";

      // 画像が読み込まれたらスピナーを非表示にする
      img.onload = () => {
        spinner.classList.add("loaded");
      };

      return;
    }

    if (name === "href") {
      const link = this.shadowRoot!.querySelector<HTMLAnchorElement>("a")!;
      link.href = newValue as string;
      return;
    }

    if (name === "width" || name === "height") {
      this.updateLayout();
    }

    if (name === "data-rating" || name === "data-has-rating") {
      this.updateRating();
    }
  }

  // レイアウトを更新する
  updateLayout() {
    const width = parseInt(this.getAttribute("width") || "0", 10);
    const height = parseInt(this.getAttribute("height") || "0", 10);

    if (!width || !height) {
      return;
    }

    const img = this.shadowRoot!.querySelector<HTMLImageElement>("img")!;
    img.width = width;
    img.height = height;
  }

  // レーティング表示を更新する
  updateRating() {
    const hasRating = this.getAttribute("data-has-rating") === "true";
    const rating = parseInt(this.getAttribute("data-rating") || "0", 10);

    if (!hasRating || rating === 0) {
      return;
    }

    // StarRating.astroと同じロジックでボタンごとに星の表示/非表示を切り替え
    const buttons = this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      "button[data-rating]",
    );
    buttons.forEach((button) => {
      const buttonRating = parseInt(button.dataset.rating || "0");
      const fillStar = button.querySelector('[data-star="fill"]');
      const emptyStar = button.querySelector('[data-star="empty"]');

      if (buttonRating <= rating) {
        // 塗りつぶしの星を表示、空の星を非表示
        fillStar?.classList.remove("is-hidden");
        emptyStar?.classList.add("is-hidden");
      } else {
        // 空の星を表示、塗りつぶしの星を非表示
        fillStar?.classList.add("is-hidden");
        emptyStar?.classList.remove("is-hidden");
      }
    });
  }
}

customElements.define("image-card", ImageCard);
