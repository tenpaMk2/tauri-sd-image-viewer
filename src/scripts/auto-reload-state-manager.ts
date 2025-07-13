/**
 * 自動リロード機能の状態管理クラス（状態のみを管理）
 */
class AutoReloadStateManager {
  private isActive = false;

  constructor() {}

  /**
   * 自動リロードを開始状態にする
   */
  start(): void {
    if (this.isActive) {
      console.warn("Auto reload is already active");
      return;
    }

    console.log("Auto reload state: active");
    this.isActive = true;
    this.notifyStateChange();
  }

  /**
   * 自動リロードを停止状態にする
   */
  stop(): void {
    if (!this.isActive) {
      console.warn("Auto reload is not active");
      return;
    }

    this.isActive = false;
    this.notifyStateChange();
    console.log("Auto reload state: inactive");
  }

  /**
   * 現在の状態を取得
   */
  getState(): boolean {
    return this.isActive;
  }

  /**
   * 自動リロード状態をトグル
   */
  toggle(): void {
    if (this.isActive) {
      this.stop();
    } else {
      this.start();
    }
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

  /**
   * リソースクリーンアップ（アプリケーション終了時用）
   */
  cleanup(): void {
    this.stop();
  }
}

// シングルトンインスタンスをエクスポート
export const autoReloadStateManager = new AutoReloadStateManager();
