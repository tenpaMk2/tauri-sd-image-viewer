import ExifReader from "exifreader";
import type { ExifParsedEventDetail } from "./global";

export class ExifEventManager {
  /**
   * EXIFデータをパースしてイベントを発火
   */
  static async parseAndEmit(
    buffer: ArrayBuffer | SharedArrayBuffer
  ): Promise<void> {
    try {
      const tagInfo = await ExifReader.load(buffer);

      console.log("Dispatch 'exif-parsed' event with tagInfo:", tagInfo);

      document.dispatchEvent(
        new CustomEvent<ExifParsedEventDetail>("exif-parsed", {
          detail: { tagInfo },
        })
      );
    } catch (error) {
      console.error("EXIF parsing failed:", error);
      throw error;
    }
  }
}
