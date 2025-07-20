import { resetCss } from "./reset-css";

export class ImageCard extends HTMLElement {
  readonly BASE_WIDTH_PX = 320; // 基本の幅
  readonly MAX_HEIGHT_PX = 500; // 最大の高さ

  static get observedAttributes() {
    return ["src", "width", "height", "href"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // 初期レイアウトを設定
    this.shadowRoot!.innerHTML = `
      <a class="box">
        <img />
      </a>

      <style>
        ${resetCss}

        :host {
          aspect-ratio: 1 / 1;
          border: 1px solid rgb(0 56 48);
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
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: none;
        }
        
        img[src] {
          display: block;
        }
      </style>
    `;
  }

  // 属性が変更されたときに呼ばれる
  attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    if (oldValue === newValue) return;

    if (name === "src") {
      const img = this.shadowRoot!.querySelector<HTMLImageElement>("img")!;
      img.src = newValue as string;
      img.loading = "lazy";
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
}

customElements.define("image-card", ImageCard);
