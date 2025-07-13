/**
 * 自動リロード機能クラス（状態管理 + 実行制御）
 */
class AutoReloader {
  private intervalId: number | null = null;
  private isActive = false;

  constructor() {
    // 状態問い合わせイベントを直接処理
    document.addEventListener("request-auto-reload-state", () => {
      this.notifyStateChange();
    });
  }

  /**
   * 自動リロードを開始
   * @param callback 実行するコールバック関数
   * @param interval 実行間隔（ミリ秒）
   */
  start(callback: () => Promise<void>, interval: number = 2000): void {
    if (this.isActive || this.intervalId !== null) {
      console.warn("Auto reload is already active");
      return;
    }

    console.log(`Starting auto reload with interval ${interval}ms`);
    this.isActive = true;

    // 即座に1回実行
    callback().catch(console.error);

    // 定期実行を開始
    this.intervalId = window.setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error("Auto reload execution failed:", error);
      }
    }, interval);

    this.notifyStateChange();
  }

  /**
   * 自動リロードを停止
   */
  stop(): void {
    if (!this.isActive && this.intervalId === null) {
      console.warn("Auto reload is not active");
      return;
    }

    console.log("Stopping auto reload");

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isActive = false;
    this.notifyStateChange();
  }

  /**
   * 現在の状態を取得
   */
  getState(): boolean {
    return this.isActive;
  }

  /**
   * 状態変更をDOMイベントで通知
   */
  private notifyStateChange(): void {
    document.dispatchEvent(
      new CustomEvent("auto-reload-state-changed", {
        detail: { isActive: this.isActive },
      })
    );
  }
}

// シングルトンインスタンスをエクスポート
export const autoReloader = new AutoReloader();
