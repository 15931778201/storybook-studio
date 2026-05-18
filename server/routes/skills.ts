// server/routes/skills.ts
import { Hono } from 'hono';
import { skillManager, skillImporter } from '../context';
import type { ImportResult } from '../../src/types/skill';

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
skills.post('/import', async (c) => {
  const contentType = c.req.header('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.parseBody();
      const file = formData['file'] as File | undefined;
      const force = formData['force'] === 'true';

      if (!file) {
        return c.json({ imported: [], skipped: [], errors: [{ name: 'unknown', error: '未上传文件' }] }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const results = await skillImporter.importFromZip(buffer, force);
      return c.json(formatImportResponse(results));
    }

    const body = await c.req.json();
    const { type, value, force } = body;

    if (type === 'url' && value) {
      const results = await skillImporter.importFromUrl(value, !!force);
      return c.json(formatImportResponse(results));
    }

    if (type === 'zip' && value) {
      const buffer = Buffer.from(value, 'base64');
      const results = await skillImporter.importFromZip(buffer, !!force);
      return c.json(formatImportResponse(results));
    }

    return c.json({ imported: [], skipped: [], errors: [{ name: 'unknown', error: '无效的请求参数，需要 type + value 或 multipart file' }] }, 400);
  } catch (e: any) {
    return c.json({ imported: [], skipped: [], errors: [{ name: 'unknown', error: `导入失败: ${e.message}` }] }, 500);
  }
});

function formatImportResponse(results: ImportResult[]) {
  const imported = results.filter(r => r.success).map(r => ({ name: r.name, title: r.title, overwritten: r.overwritten }));
  const skipped = results.filter(r => !r.success && r.reason === 'duplicate').map(r => ({ name: r.name, reason: r.error }));
  const errors = results.filter(r => !r.success && r.reason !== 'duplicate').map(r => ({ name: r.name, error: r.error }));
  return { imported, skipped, errors };
}

export { skills };