import { resetCss } from "./reset-css";

export class ImageCard extends HTMLElement {
  readonly BASE_WIDTH_PX = 320; // 基本の幅
  readonly MAX_HEIGHT_PX = 500; // 最大の高さ

  static get observedAttributes() {
    return ["src", "width", "height"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // 初期レイアウトを設定
    this.shadowRoot!.innerHTML = `
      <figure>
        <img></img>
      </figure>

      <style>
        ${resetCss}

        :host {
          border: 1px solid grey;
          flex: 1 1 var(--flex-basis, 320px);
        }
        figure {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          max-width: var(--max-width, 100%);
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
      // 幅または高さが設定されていない場合は、デフォルトのスタイルを適用
      this.style.setProperty("--flex-basis", "1 1 10px");
      this.style.setProperty("--max-width", "10px");
      return;
    }

    const flexBasisPx = Math.floor((width / height) * this.BASE_WIDTH_PX);
    const maxWidthPx = Math.floor((width / height) * this.MAX_HEIGHT_PX);

    console.log({ flexBasisPx, maxWidthPx });

    this.style.setProperty("--flex-basis", `${flexBasisPx}px`);
    this.style.setProperty("--max-width", `${maxWidthPx}px`);

    const img = this.shadowRoot!.querySelector<HTMLImageElement>("img")!;
    img.width = width;
    img.height = height;
  }
}

customElements.define("image-card", ImageCard);
