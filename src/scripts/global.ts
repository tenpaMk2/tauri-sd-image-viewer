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

declare global {
  interface DocumentEventMap {
    "exif-parsed": CustomEvent<ExifParsedEventDetail>;
    "navigate-to-next": CustomEvent;
    "navigate-to-previous": CustomEvent;
    "open-browser": CustomEvent<OpenBrowserEventDetail>;
    "open-browser-from-viewer": CustomEvent;
    "open-files": CustomEvent;
    "copy-to-clipboard": CustomEvent;
  }
}
