export type FileSelectedEventDetail = {
  filePaths: string[];
};

export type ExifParsedEventDetail = {
  tagInfo: ExifReader.Tags & {
    parameters?: {
      value: string;
      description: string;
    };
  };
};

declare global {
  interface HTMLElementEventMap {
    "file-selected": CustomEvent<FileSelectedEventDetail>;
  }

  interface DocumentEventMap {
    "exif-parsed": CustomEvent<ExifParsedEventDetail>;
  }
}
