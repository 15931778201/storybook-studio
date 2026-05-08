export interface CronJob {
  id: string;
  name: string;
  description: string;
  cronExpression: string;    // 标准 cron 表达式，如 "0 9 * * 1-5"
  prompt: string;             // 发送给 Agent 的提示词
  role?: string;              // 执行时使用的角色
  enabled: boolean;
  lastRun?: string;           // 上次执行时间
  nextRun?: string;           // 下次执行时间
  createdAt: string;
  updatedAt: string;
}