export type ExifParsedEventDetail = {
  tagInfo: ExifReader.Tags & {
    parameters?: {
      value: string;
      description: string;
    };
  };
};

declare global {
  interface DocumentEventMap {
    "exif-parsed": CustomEvent<ExifParsedEventDetail>;
  }
}
