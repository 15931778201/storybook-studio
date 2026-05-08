import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { KnowledgeBase } from '../../src';

const rag = new Hono();
const DOCS_DIR = '.agent/docs';
fs.mkdirSync(DOCS_DIR, { recursive: true });

// 上传文档
rag.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) return c.json({ error: 'no files' }, 400);

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const filePath = path.join(DOCS_DIR, file.name);
    fs.writeFileSync(filePath, Buffer.from(buffer));
  }

  // 重新索引知识库
  try {
    const kb = new KnowledgeBase(DOCS_DIR, '.agent/knowledge-vectors.json');
    await kb.indexDocuments();
  } catch (e: any) {
    console.error('RAG 重新索引失败:', e);
    return c.json({ success: true, warning: '文件已保存，但索引失败，请稍后重试' });
  }

  return c.json({ success: true, message: `${files.length} 个文件已上传并索引` });
});

// 查询知识库状态
rag.get('/status', (c) => {
  const files = fs.readdirSync(DOCS_DIR);
  return c.json({ fileCount: files.length, files });
});

// 新增：图片上传端点（也支持拖拽上传到 RAG 的扩展）
rag.post('/api/upload/image', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('image') as File;
  if (!file) return c.json({ success: false, message: '缺少图片' }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  
  // 1. 压缩/转换图片（限制大小和尺寸）
  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  const base64 = resized.toString('base64');
  const mimeType = 'image/jpeg';
  const dataUri = `data:${mimeType};base64,${base64}`;

  // 2. 保存临时文件（可选，用于审计）
  const tempDir = path.join(process.cwd(), '.agent/temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `${Date.now()}.jpg`);
  fs.writeFileSync(tempPath, resized);

  return c.json({ success: true, dataUri, tempPath });
});

export { rag }; 