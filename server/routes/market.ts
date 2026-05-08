import { Hono } from 'hono';
import { fetchSkillMarket, fetchMcpMarket, installSkill, installMcpServer, fetchPluginMarket, installPlugin } from '../../src/market/market-service';

const market = new Hono();
// 获取技能市场列表
market.get('/skills', async (c) => {
  const skills = await fetchSkillMarket();
  return c.json(skills);
});

// 获取 MCP 市场列表
market.get('/mcp', async (c) => {
  const mcps = await fetchMcpMarket();
  return c.json(mcps);
});



// 安装技能
market.post('/skills/install', async (c) => {
  const { name } = await c.req.json();
  const ok = await installSkill(name);
  return c.json({ success: ok });
});

// 安装 MCP 服务器
market.post('/mcp/install', async (c) => {
  const { package: pkg } = await c.req.json();
  const ok = await installMcpServer(pkg);
  return c.json({ success: ok });
});

// 获取插件市场列表
market.get('/plugins', async (c) => {
  const plugins = await fetchPluginMarket();
  return c.json(plugins);
});

// 安装插件
market.post('/plugins/install', async (c) => {
  const { name } = await c.req.json();
  const ok = await installPlugin(name);
  return c.json({ success: ok });
});
export { market };