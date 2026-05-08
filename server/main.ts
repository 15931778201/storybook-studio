// server/main.ts
import 'dotenv/config';
import app from './api';

const port = 3000;
console.log(`🚀 Agent 服务已启动: http://localhost:${port}`);
export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, 
};