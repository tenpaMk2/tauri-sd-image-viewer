import type { OpenBrowserEventDetail } from "./global";

/**
 * ブラウザーを開く
 */
document.addEventListener(
  "open-browser",
  (event: CustomEvent<OpenBrowserEventDetail>) => {
    console.log("open-browser event received:", event.detail);

    const detail = event.detail;
    const dir = detail?.dir;

    console.info("Navigating to browser with dir:", dir);
    if (dir) {
      window.location.href = `/browse?dir=${encodeURIComponent(dir)}`;
    }
  }
);
