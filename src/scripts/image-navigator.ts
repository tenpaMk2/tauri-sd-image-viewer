import { path } from "@tauri-apps/api";
import { readDir } from "@tauri-apps/plugin-fs";
import { SUPPORTED_IMAGE_EXTS } from "./mine-type";

/**
 * 指定されたディレクトリの画像ファイル一覧を読み込む
 */
export const loadImageFilesInDirectory = async (
  directoryPath: string
): Promise<string[]> => {
  try {
    const dirEntries = await readDir(directoryPath);
    const imageEntries = dirEntries.filter(
      (entry) =>
        entry.isFile &&
        SUPPORTED_IMAGE_EXTS.some((ext) =>
          entry.name.toLowerCase().endsWith(`.${ext}`)
        )
    );

    return imageEntries.map((entry) => entry.name).sort();
  } catch (error) {
    console.error("Failed to load directory:", error);
    return [];
  }
};

/**
 * 循環インデックスを計算する
 */
const calculateCircularIndex = (
  currentIndex: number,
  direction: "previous" | "next",
  arrayLength: number
): number => {
  return direction === "next"
    ? (currentIndex + 1) % arrayLength
    : currentIndex === 0
      ? arrayLength - 1
      : currentIndex - 1;
};

/**
 * 指定された方向の画像パスを探索
 */
export const findImageInDirection = async (
  currentImagePath: string,
  direction: "previous" | "next" | "last"
): Promise<string | null> => {
  try {
    const dir = await path.dirname(currentImagePath);
    const imageFilenames = await loadImageFilesInDirectory(dir);

    if (imageFilenames.length === 0) {
      console.log("No images found in directory");
      return null;
    }

    const currentBasename = await path.basename(currentImagePath);
    const currentIndex = imageFilenames.indexOf(currentBasename);

    if (currentIndex === -1) {
      console.log("Current image not found in directory");
      return null;
    }

    const newIndex =
      direction === "last"
        ? imageFilenames.length - 1
        : calculateCircularIndex(
            currentIndex,
            direction,
            imageFilenames.length
          );

    const newImagePath = await path.join(dir, imageFilenames[newIndex]);

    // console.log({
    //   direction,
    //   currentIndex,
    //   newIndex,
    //   currentImagePath,
    //   newImagePath,
    // });

    return newImagePath;
  } catch (error) {
    console.error("Navigation failed:", error);
    return null;
  }
};
