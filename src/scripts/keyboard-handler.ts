export type KeyboardHandlerCallbacks = {
  onPreviousImage: () => void;
  onNextImage: () => void;
};

export class KeyboardHandler {
  private callbacks: KeyboardHandlerCallbacks;
  private boundHandleKeyDown: (event: KeyboardEvent) => void;

  constructor(callbacks: KeyboardHandlerCallbacks) {
    this.callbacks = callbacks;
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * キーボードイベントリスナーを登録
   */
  attach() {
    document.addEventListener("keydown", this.boundHandleKeyDown);
  }

  /**
   * キーボードイベントリスナーを削除
   */
  detach() {
    document.removeEventListener("keydown", this.boundHandleKeyDown);
  }

  /**
   * 入力要素がフォーカスされているかチェック
   */
  private isInputElementFocused(): boolean {
    const activeElement = document.activeElement;
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable)
    );
  }

  /**
   * キーボードイベントを処理する
   */
  private handleKeyDown(event: KeyboardEvent) {
    // テキスト入力欄がフォーカスされている場合は処理しない
    if (this.isInputElementFocused()) {
      return;
    }

    const keyActions: Record<string, () => void> = {
      ArrowLeft: () => {
        event.preventDefault();
        this.callbacks.onPreviousImage();
      },
      ArrowRight: () => {
        event.preventDefault();
        this.callbacks.onNextImage();
      },
    };

    const action = keyActions[event.key];
    if (action) {
      console.log({ keyPressed: event.key });
      action();
    }
  }
}
