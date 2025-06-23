export type Task = Readonly<{
  id: string;
}>;

export class TaskQueue {
  private queue: Task[] = [];
  private running = new Set<string>();
  private readonly maxConcurrent: number;
  private readonly taskExecutor: (task: Task) => Promise<void>;

  constructor(taskExecutor: (task: Task) => Promise<void>, maxConcurrent = 1) {
    this.taskExecutor = taskExecutor;
    this.maxConcurrent = maxConcurrent;
  }

  add(task: Task) {
    console.log(`Adding task: ${task.id}`);

    this.queue.push(task);
    this.processQueue();
  }

  private async processQueue() {
    console.log("Processing queue...");

    if (this.maxConcurrent <= this.running.size || this.queue.length === 0) {
      console.log("Max concurrent tasks reached or queue is empty.");
      return;
    }

    const task = this.queue.shift()!;
    this.running.add(task.id);

    try {
      await this.executeTask(task);
    } finally {
      this.running.delete(task.id);
      this.processQueue(); // 次のタスクを実行
    }
  }

  private async executeTask(task: Task) {
    console.log(`Executing task: ${task.id}`);

    try {
      await this.taskExecutor(task);
    } catch (error) {
      console.error(`Task failed: ${task.id}`, error);
    }
  }

  clear() {
    console.log("Clearing queue...");
    this.queue.length = 0;
  }

  // 便利なヘルパーメソッド
  get queueLength(): number {
    return this.queue.length;
  }

  get runningCount(): number {
    return this.running.size;
  }

  get isIdle(): boolean {
    return this.queue.length === 0 && this.running.size === 0;
  }
}
