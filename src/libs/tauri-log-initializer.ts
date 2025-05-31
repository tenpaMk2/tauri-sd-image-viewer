/**
 * Tauri用ログ初期化処理。
 * 何回コールされてもOK（冪等性あり）。
 */

import { debug, error, info, trace, warn } from "@tauri-apps/plugin-log";

const forwardConsole = (
  fnName: "log" | "debug" | "info" | "warn" | "error",
  logger: (message: string) => Promise<void>
) => {
  const original = console[fnName];
  console[fnName] = (...messages) => {
    const message = messages
      .map((m) => (typeof m === "string" ? m : JSON.stringify(m)))
      .join(" ");
    original(message);
    logger(message);
  };
};

forwardConsole("log", trace);
forwardConsole("debug", debug);
forwardConsole("info", info);
forwardConsole("warn", warn);
forwardConsole("error", error);
