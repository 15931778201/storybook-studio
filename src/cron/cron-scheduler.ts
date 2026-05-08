import cron from 'node-cron';
import { EventEmitter } from 'events';
import type { CronJob } from './cron-types';
import { CronStore } from './cron-store';

export class CronScheduler extends EventEmitter {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private store: CronStore;

  constructor(store: CronStore) {
    super();
    this.store = store;
  }

  /** 启动所有已启用的任务 */
  async start(): Promise<void> {
    const jobs = await this.store.listEnabled();
    for (const job of jobs) {
      this.scheduleJob(job);
    }
    console.log(`🕐 定时任务调度器已启动，加载 ${jobs.length} 个任务`);
  }

  /** 调度单个任务 */
  scheduleJob(job: CronJob): void {
    // 先移除旧任务（如果存在）
    this.removeJob(job.id);

    if (!cron.validate(job.cronExpression)) {
      console.warn(`无效的 cron 表达式: ${job.cronExpression} (${job.name})`);
      return;
    }

    const task = cron.schedule(job.cronExpression, async () => {
      console.log(`⏰ 触发定时任务: ${job.name}`);
      this.emit('trigger', job);
      await this.store.updateLastRun(job.id, new Date().toISOString());
    });

    this.tasks.set(job.id, task);
  }

  /** 移除任务 */
  removeJob(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
  }

  /** 停止所有任务 */
  stop(): void {
    for (const [id] of this.tasks) {
      this.removeJob(id);
    }
  }
}