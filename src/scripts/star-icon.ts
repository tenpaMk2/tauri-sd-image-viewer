/**
 * 星形アイコンのカスタムエレメント
 * Mage アイコンライブラリの星アイコンを表示
 */
export class StarIcon extends HTMLElement {
  static get observedAttributes() {
    return ["variant", "size"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private get variant(): "fill" | "empty" {
    return (this.getAttribute("variant") as "fill" | "empty") || "empty";
  }

  private get size(): string {
    return this.getAttribute("size") ?? "0.875rem";
  }

  private render() {
    const svg =
      this.variant === "fill" ? this.getStarFillSvg() : this.getStarEmptySvg();

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: ${this.size};
          height: ${this.size};
        }
        
        svg {
          width: 100%;
          height: 100%;
          color: inherit;
        }
      </style>
      ${svg}
    `;
  }

  // 塗りつぶし星のSVG (Mage アイコン: mage:star-fill)
  private getStarFillSvg(): string {
    return `
      <svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M21.95 10.605a1.75 1.75 0 0 1-.5.86l-3.3 3.22a.4.4 0 0 0-.08.12a.3.3 0 0 0 0 .14l.78 4.56c.065.336.03.684-.1 1a1.65 1.65 0 0 1-.61.77a1.83 1.83 0 0 1-.92.35h-.13a1.8 1.8 0 0 1-.84-.21l-4.1-2.14a.28.28 0 0 0-.28 0l-4.1 2.15a1.9 1.9 0 0 1-1 .21a1.83 1.83 0 0 1-.93-.35a1.75 1.75 0 0 1-.61-.78a1.8 1.8 0 0 1-.1-1l.78-4.55a.23.23 0 0 0 0-.14a.4.4 0 0 0-.07-.12l-3.3-3.24a1.8 1.8 0 0 1-.49-.85a1.75 1.75 0 0 1 0-1a1.81 1.81 0 0 1 1.49-1.21l4.5-.66a.18.18 0 0 0 .12-.05a.3.3 0 0 0 .09-.11l2.1-4.18c.143-.3.369-.553.65-.73a1.79 1.79 0 0 1 2.57.74l2.08 4.16a.4.4 0 0 0 .1.12a.2.2 0 0 0 .13.05l4.57.66c.332.05.644.192.9.41c.251.217.441.496.55.81c.106.32.124.662.05.99"></path>
      </svg>
    `;
  }

  // 空の星のSVG (Mage アイコン: mage:star)
  private getStarEmptySvg(): string {
    return `
      <svg viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m12.495 18.587l4.092 2.15a1.044 1.044 0 0 0 1.514-1.106l-.783-4.552a1.05 1.05 0 0 1 .303-.929l3.31-3.226a1.043 1.043 0 0 0-.575-1.785l-4.572-.657A1.04 1.04 0 0 1 15 7.907l-2.088-4.175a1.044 1.044 0 0 0-1.88 0L8.947 7.907a1.04 1.04 0 0 1-.783.575l-4.51.657a1.044 1.044 0 0 0-.584 1.785l3.309 3.226a1.04 1.04 0 0 1 .303.93l-.783 4.55a1.044 1.044 0 0 0 1.513 1.107l4.093-2.15a1.04 1.04 0 0 1 .991 0"></path>
      </svg>
    `;
  }
}

customElements.define("star-icon", StarIcon);
