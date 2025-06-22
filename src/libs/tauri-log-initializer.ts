/**
 * Tauri用ログ初期化処理。
 * 何回コールされてもOK（冪等性あり）。
 */

import { debug, error, info, warn } from "@tauri-apps/plugin-log";

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

forwardConsole("log", info); // Attach `log` to not `trace` but `info` level.
forwardConsole("debug", debug);
forwardConsole("info", info);
forwardConsole("warn", warn);
forwardConsole("error", error);
