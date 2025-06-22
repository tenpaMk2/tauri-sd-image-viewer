import type { SdParameters } from "./rust-synced-types";

export class InfoViewerOther extends HTMLElement {
  modelEl!: HTMLElement;
  stepsEl!: HTMLElement;
  samplerEl!: HTMLElement;
  scheduleTypeEl!: HTMLElement;
  sizeEl!: HTMLElement;
  cfgScaleEl!: HTMLElement;
  seedEl!: HTMLElement;
  clipSkipEl!: HTMLElement;

  connectedCallback() {
    this.modelEl = this.querySelector('[data-label="model"]')!;
    this.stepsEl = this.querySelector('[data-label="steps"]')!;
    this.samplerEl = this.querySelector('[data-label="sampler"]')!;
    this.scheduleTypeEl = this.querySelector('[data-label="schedule-type"]')!;
    this.sizeEl = this.querySelector('[data-label="size"]')!;
    this.cfgScaleEl = this.querySelector('[data-label="cfg-scale"]')!;
    this.seedEl = this.querySelector('[data-label="seed"]')!;
    this.clipSkipEl = this.querySelector('[data-label="clip-skip"]')!;
  }

  updateInfos(sdParameters: SdParameters | null) {
    if (sdParameters === null) {
      this.modelEl.textContent = "N/A";
      this.stepsEl.textContent = "N/A";
      this.samplerEl.textContent = "N/A";
      this.scheduleTypeEl.textContent = "N/A";
      this.sizeEl.textContent = "N/A";
      this.cfgScaleEl.textContent = "N/A";
      this.seedEl.textContent = "N/A";
      this.clipSkipEl.textContent = "N/A";
      return;
    }

    const {
      model,
      steps,
      sampler,
      schedule_type,
      size,
      cfg_scale,
      seed,
      clip_skip,
    } = sdParameters;

    this.setText(this.modelEl, model ?? "N/A");
    this.setText(this.stepsEl, steps ?? "N/A");
    this.setText(this.samplerEl, sampler ?? "N/A");
    this.setText(this.scheduleTypeEl, schedule_type ?? "N/A");
    this.setText(this.sizeEl, size ?? "N/A");
    this.setText(this.cfgScaleEl, cfg_scale ?? "N/A");
    this.setText(this.seedEl, seed ?? "N/A");
    this.setText(this.clipSkipEl, clip_skip ?? "N/A");
  }

  private setText(el: HTMLElement, text: string) {
    el.textContent = text;
    el.title = text;
  }
}
customElements.define("info-viewer-other", InfoViewerOther);
