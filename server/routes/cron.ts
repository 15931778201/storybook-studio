import { CronStore } from '../../src/cron/cron-store';
import { CronScheduler } from '../../src/cron/cron-scheduler';
import { Hono } from 'hono';
const cronStore = new CronStore('.agent/cron.db');
const scheduler = new CronScheduler(cronStore);
const cron = new Hono();
// 获取所有定时任务
cron.get('/', async (c) => {
  const jobs = await cronStore.list();
  return c.json(jobs);
});

// 创建定时任务
cron.post('/', async (c) => {
  const body = await c.req.json();
  const job = await cronStore.create({
    name: body.name,
    description: body.description || '',
    cronExpression: body.cronExpression,
    prompt: body.prompt,
    role: body.role,
    enabled: body.enabled !== false,
  });
  scheduler.scheduleJob(job); // 实时激活
  return c.json(job);
});

// 更新定时任务
cron.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updated = await cronStore.update(id, body);
  if (updated) {
    scheduler.scheduleJob(updated); // 重新调度
  }
  return c.json(updated);
});

// 删除定时任务
cron.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const ok = await cronStore.delete(id);
  if (ok) scheduler.removeJob(id);
  return c.json({ success: ok });
});

// 立即执行一次
cron.post('/:id/run', async (c) => {
  const id = c.req.param('id');
  const job = await cronStore.get(id);
  if (!job) return c.json({ success: false, message: '任务不存在' }, 404);
  scheduler.emit('trigger', job);
  return c.json({ success: true });
});

export { cron };