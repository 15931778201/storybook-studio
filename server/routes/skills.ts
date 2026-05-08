// server/routes/skills.ts
import { Hono } from 'hono';
import { skillManager } from '../context';

const skills = new Hono();

// 获取所有技能
skills.get('/', (c) => {
  const list = skillManager.listSkills().map(s => ({
    name: s.metadata.name,
    title: s.metadata.title,
    description: s.metadata.description,
    tags: s.metadata.tags,
    stepCount: s.steps.length,
    version: s.metadata.version,
  }));
  return c.json(list);
});

// 获取单个技能详情
skills.get('/:name', (c) => {
  const name = c.req.param('name');
  const skill = skillManager.getSkill(name);
  if (!skill) return c.json({ error: '技能不存在' }, 404);
  return c.json({
    metadata: skill.metadata,
    steps: skill.steps,
    raw: skill.raw,
  });
});

// 删除技能
skills.delete('/:name', (c) => {
  const name = c.req.param('name');
  const ok = skillManager.deleteSkill(name);
  return c.json({ success: ok });
});


skills.post('/reload', async (c) => {
  await skillManager.hotReload();
  return c.json({ success: true });
});
export { skills };