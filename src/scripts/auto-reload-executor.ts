/**
 * 自動リロード機能の実行を担当するクラス
 */
export class AutoReloadExecutor {
  private intervalId: number | null = null;

  /**
   * 自動リロードを開始
   * @param callback 実行するコールバック関数
   * @param interval 実行間隔（ミリ秒）
   */
  start(callback: () => Promise<void>, interval: number = 2000): void {
    if (this.intervalId !== null) {
      console.warn("Auto reload executor is already running");
      return;
    }

    console.log(`Starting auto reload executor with interval ${interval}ms`);

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
  }

  /**
   * 自動リロードを停止
   */
  stop(): void {
    if (this.intervalId === null) {
      console.warn("Auto reload executor is not running");
      return;
    }

    console.log("Stopping auto reload executor");
    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /**
   * 実行中かどうかを確認
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.stop();
  }
}
