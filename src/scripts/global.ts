export type ExifParsedEventDetail = {
  tagInfo: ExifReader.Tags & {
    parameters?: {
      value: string;
      description: string;
    };
  };
};

export type OpenBrowserEventDetail = {
  dir: string;
};

export type OpenImageEventDetail = {
  imageFullPath: string;
};

declare global {
  interface DocumentEventMap {
    "exif-parsed": CustomEvent<ExifParsedEventDetail>;
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
