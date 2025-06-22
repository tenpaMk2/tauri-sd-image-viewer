import type { ComprehensiveImageInfo } from "./rust-synced-types";

export class InfoViewerBasic extends HTMLElement {
  filenameEl!: HTMLElement;
  parentDirEl!: HTMLElement;
  fileSizeEl!: HTMLElement;
  fileCreatedEl!: HTMLElement;
  fileModifiedEl!: HTMLElement;
  pngResolutionEl!: HTMLElement;
  pngAlphaEl!: HTMLElement;
  exifCreateTimestampLocalEl!: HTMLElement;
  exifModifyTimestampLocalEl!: HTMLElement;
  exifOriginalTimestampLocalEl!: HTMLElement;
  exifRatingEl!: HTMLElement;

  connectedCallback() {
    this.filenameEl = this.querySelector('[data-label="filename"]')!;
    this.parentDirEl = this.querySelector('[data-label="parent-dir"]')!;
    this.fileSizeEl = this.querySelector('[data-label="file-size"]')!;
    this.fileCreatedEl = this.querySelector('[data-label="file-created"]')!;
    this.fileModifiedEl = this.querySelector('[data-label="file-modified"]')!;
    this.pngResolutionEl = this.querySelector('[data-label="png-resolution"]')!;
    this.pngAlphaEl = this.querySelector('[data-label="png-alpha"]')!;
    this.exifCreateTimestampLocalEl = this.querySelector(
      '[data-label="exif-create-timestamp-local"]'
    )!;
    this.exifModifyTimestampLocalEl = this.querySelector(
      '[data-label="exif-modify-timestamp-local"]'
    )!;
    this.exifOriginalTimestampLocalEl = this.querySelector(
      '[data-label="exif-original-timestamp-local"]'
    )!;
    this.exifRatingEl = this.querySelector('[data-label="exif-rating"]')!;
  }

  updateInfos(imageInfo: ComprehensiveImageInfo) {
    const {
      filename,
      parent_dir,
      file_size_bytes,
      file_creation_timestamp,
      file_modified_timestamp,
    } = imageInfo.file_system_info;

    this.setText(this.filenameEl, filename);
    this.setText(this.parentDirEl, parent_dir);
    this.setText(this.fileSizeEl, file_size_bytes.toLocaleString() + " Bytes");

    const fileCreatedDate = new Date(file_creation_timestamp * 1000);
    this.setText(this.fileCreatedEl, fileCreatedDate.toLocaleString());
    const fileModifiedDate = new Date(file_modified_timestamp * 1000);
    this.setText(this.fileModifiedEl, fileModifiedDate.toLocaleString());

    const { width, height, has_alpha } = imageInfo.png_info;

    this.setText(this.pngResolutionEl, `${width} x ${height}`);
    this.setText(this.pngAlphaEl, has_alpha ? "Yes" : "No");

    const { create_date, modify_date, datetime_original, rating } =
      imageInfo.exif_info;

    this.setText(this.exifCreateTimestampLocalEl, create_date ?? "N/A");
    this.setText(this.exifModifyTimestampLocalEl, modify_date ?? "N/A");
    this.setText(this.exifOriginalTimestampLocalEl, datetime_original ?? "N/A");
    this.setText(this.exifRatingEl, (rating ?? "N/A").toString());
  }

  private setText(el: HTMLElement, text: string) {
    el.textContent = text;
    el.title = text;
  }
}
customElements.define("info-viewer-basic", InfoViewerBasic);
