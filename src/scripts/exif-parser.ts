import { ExifEventManager } from "./exif-event-manager";
import { SdParameterParser } from "./sd-parameter-parser";

// 既存のコードとの互換性を保つため
export const parseAndEmit = ExifEventManager.parseAndEmit;
export const parseSdParameters = SdParameterParser.parseSdParameters;

// 型のエクスポート
export type { SdParameters, SdTag } from "./sd-parameter-parser";
