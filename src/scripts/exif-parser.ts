import ExifReader from "exifreader";
import type { ExifParsedEventDetail } from "./global";

export const parseAndEmit = async (
  buffer: ArrayBuffer | SharedArrayBuffer
): Promise<void> => {
  const tagInfo = await ExifReader.load(buffer);

  console.log("Dispatch 'exif-parsed' event with tagInfo:", tagInfo);

  document.dispatchEvent(
    new CustomEvent<ExifParsedEventDetail>("exif-parsed", {
      detail: { tagInfo },
    })
  );
};

export type SdTag = {
  name: string;
  weight: number | undefined;
};

export type SdParameters = {
  positiveSdTags: SdTag[];
  negativeSdTags: SdTag[];
  steps: string | undefined;
  sampler: string | undefined;
  scheduleType: string | undefined;
  cfgScale: string | undefined;
  seed: string | undefined;
  size: string | undefined;
  modelHash: string | undefined;
  model: string | undefined;
  denoisingStrength: string | undefined;
  clipSkip: string | undefined;
  hiresCfgScale: string | undefined;
  hiresUpscale: string | undefined;
  hiresSteps: string | undefined;
  hiresUpscaler: string | undefined;
};

const parseSdTags = (str: string): SdTag[] => {
  const sdRawTags = str.split(",").map((piece) => piece.trim());

  const result = sdRawTags.map((rawTag) => {
    const weightMatch = rawTag.match(/\(([^:]+):([0-9]+(?:\.[0-9]+)?)\)/);

    if (weightMatch) {
      const [, rawName, rawWeight] = weightMatch;
      const parsedWeight = parseFloat(rawWeight.trim());

      if (isNaN(parsedWeight)) {
        return {
          name: weightMatch[0].trim(),
          weight: undefined,
        };
      }

      return {
        name: rawName.trim(),
        weight: parsedWeight,
      };
    }

    return {
      name: rawTag,
      weight: undefined,
    };
  });

  return result;
};

const parseKeyValuePairs = (text: string): [string, string][] => {
  const chunks = text.split(":");

  const stripedStack: string[] = [];

  for (const [idx, chunk] of chunks.entries()) {
    if (idx === 0 && 1 < chunk.split(",").length) {
      console.warn(
        "Unexpected format: First chunk contains commas, treating as key-value pairs."
      );
      continue;
    }
    if (idx === 0) {
      const key = chunk.trim();
      stripedStack.push(key);
      continue;
    }
    if (idx === chunks.length - 1) {
      const value = chunk.trim();
      stripedStack.push(value);
      continue;
    }

    const valuesAndKey = chunk.split(",");
    if (valuesAndKey.length === 1) {
      console.warn(
        "Unexpected format: First chunk contains commas, treating as key-value pairs."
      );
      continue;
    }

    const value = valuesAndKey.slice(0, -1).join(",").trim();
    const key = valuesAndKey.slice(-1)[0].trim();

    stripedStack.push(value);
    stripedStack.push(key);
  }

  const result: [string, string][] = [];
  for (let i = 0; i < stripedStack.length; i += 2) {
    result.push(stripedStack.slice(i, i + 2) as [string, string]);
  }

  return result;
};

export const parseSdParameters = async (
  parameter: string
): Promise<SdParameters> => {
  const ppSeparated = parameter.split("\nNegative prompt:");
  if (ppSeparated.length !== 2) {
    throw new Error('"Negative prompt:" not found in parameters');
  }

  const npSeparated = ppSeparated[1].split("\nSteps:");
  if (npSeparated.length !== 2) {
    throw new Error('"Steps:" not found in parameters');
  }

  const positiveSdTags = parseSdTags(ppSeparated[0]);
  const negativeSdTags = parseSdTags(npSeparated[0]);

  const fieldEntries = parseKeyValuePairs("Steps:" + npSeparated[1]);
  const fieldMap = new Map<string, string>(fieldEntries);

  const steps = fieldMap.get("Steps");
  const sampler = fieldMap.get("Sampler");
  const scheduleType = fieldMap.get("Schedule type");
  const cfgScale = fieldMap.get("CFG scale");
  const seed = fieldMap.get("Seed");
  const size = fieldMap.get("Size");
  const modelHash = fieldMap.get("Model hash");
  const model = fieldMap.get("Model");
  const denoisingStrength = fieldMap.get("Denoising strength");
  const clipSkip = fieldMap.get("Clip skip");
  const hiresCfgScale = fieldMap.get("Hires CFG Scale");
  const hiresUpscale = fieldMap.get("Hires upscale");
  const hiresSteps = fieldMap.get("Hires steps");
  const hiresUpscaler = fieldMap.get("Hires upscaler");

  return {
    positiveSdTags,
    negativeSdTags,
    steps,
    sampler,
    scheduleType,
    cfgScale,
    seed,
    size,
    modelHash,
    model,
    denoisingStrength,
    clipSkip,
    hiresCfgScale,
    hiresUpscale,
    hiresSteps,
    hiresUpscaler,
  };
};
