import type { ComprehensiveImageInfo } from "./rust-synced-types";

export type ReadImageInfoEventDetail = ComprehensiveImageInfo;

export type OpenBrowserEventDetail = {
  dir: string;
};

export type OpenImageEventDetail = {
  imageFullPath: string;
};

declare global {
  interface DocumentEventMap {
    "read-image-info": CustomEvent<ReadImageInfoEventDetail>;
    "navigate-to-next": CustomEvent;
    "navigate-to-previous": CustomEvent;
    "open-browser": CustomEvent<OpenBrowserEventDetail>;
    "open-browser-from-viewer": CustomEvent;
    "open-image": CustomEvent<OpenImageEventDetail>;
    "open-image-selector-dialog": CustomEvent;
    "open-directories-selector-dialog": CustomEvent;
    "copy-to-clipboard": CustomEvent;
  }
}
