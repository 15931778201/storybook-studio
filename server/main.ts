import 'dotenv/config';
import app from './api';
import { initLogRotator, initChangelogCron } from './context';

initLogRotator();
initChangelogCron();

const port = 3000;
console.log(`🚀 Agent 服务已启动: http://localhost:${port}`);
export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, 
};