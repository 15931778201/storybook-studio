import { Hono } from 'hono';
import { knowledgeBaseManager } from '../context';
import fs from 'fs';
import path from 'path';

const knowledge = new Hono();

knowledge.get('/', (c) => {
  return c.json(knowledgeBaseManager.list());
});

knowledge.post('/', async (c) => {
  const { name, description } = await c.req.json();
  if (!name || !name.trim()) return c.json({ error: 'Name cannot be empty' }, 400);
  try {
    const kb = knowledgeBaseManager.create(name.trim(), description || '');
    return c.json(kb, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

knowledge.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { name, description } = await c.req.json();
  try {
    const kb = knowledgeBaseManager.rename(id, name, description);
    return c.json(kb);
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

knowledge.delete('/:id', (c) => {
  const id = c.req.param('id');
  try {
    knowledgeBaseManager.delete(id);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

knowledge.get('/:id/files', (c) => {
  const id = c.req.param('id');
  try {
    const kb = knowledgeBaseManager.getKB(id);
    return c.json({ files: kb.listFiles() });
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

knowledge.post('/:id/upload', async (c) => {
  const id = c.req.param('id');
  const formData = await c.req.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) return c.json({ error: 'No files selected' }, 400);
  try {
    const kb = knowledgeBaseManager.getKB(id);
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(process.cwd(), '.agent', 'knowledge', id, 'docs', file.name);
      fs.writeFileSync(filePath, buffer);
    }
    try {
      await knowledgeBaseManager.indexOne(id);
    } catch (e: any) {
      console.error('Index failed:', e);
      return c.json({ success: true, warning: 'Files saved but index failed' });
    }
    return c.json({ success: true, message: `${files.length} file(s) uploaded and indexed` });
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

knowledge.delete('/:id/files/:fileName', (c) => {
  const id = c.req.param('id');
  const fileName = c.req.param('fileName');
  try {
    const kb = knowledgeBaseManager.getKB(id);
    const deleted = kb.deleteFile(fileName);
    if (!deleted) return c.json({ error: 'File not found' }, 404);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

knowledge.post('/:id/reindex', async (c) => {
  const id = c.req.param('id');
  try {
    await knowledgeBaseManager.indexOne(id);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

knowledge.get('/:id/status', (c) => {
  const id = c.req.param('id');
  try {
    const kb = knowledgeBaseManager.getKB(id);
    const files = kb.listFiles();
    return c.json({ id, fileCount: files.length, files });
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

export { knowledge };
