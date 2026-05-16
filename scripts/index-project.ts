#!/usr/bin/env bun
import { KnowledgeBase } from '../src/rag/knowledge-base';
import fs from 'fs';
import path from 'path';

const PROJECT_DIR = path.resolve(process.cwd(), process.argv[2] || '.');
const KB_DOCS_DIR = '.agent/docs';
const PROJECT_PREFIX = 'project';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.agent', '.next', 'build', 'target', '__pycache__']);

const SUPPORTED_EXTS = new Set([
  '.md', '.txt', '.ts', '.tsx', '.js', '.jsx',
  '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.vue',
  '.css', '.html', '.sh', '.sql', '.json', '.xml', '.yaml', '.yml', '.csv',
]);

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const item of entries) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (IGNORE_DIRS.has(item.name) || item.name.startsWith('.')) continue;
      results.push(...collectFiles(fullPath));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  console.log(`📂 扫描项目: ${PROJECT_DIR}`);
  const files = collectFiles(PROJECT_DIR);
  console.log(`📄 找到 ${files.length} 个支持的文件`);

  const docsDir = path.resolve(process.cwd(), KB_DOCS_DIR);
  const projectDocsDir = path.join(docsDir, PROJECT_PREFIX);

  // 清理旧的项目文件
  if (fs.existsSync(projectDocsDir)) {
    fs.rmSync(projectDocsDir, { recursive: true });
  }

  // 复制文件到知识库目录，保持目录结构
  let copied = 0;
  for (const file of files) {
    const relativePath = path.relative(PROJECT_DIR, file);
    const targetPath = path.join(projectDocsDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(file, targetPath);
    copied++;
  }
  console.log(`📋 已复制 ${copied} 个文件到 ${KB_DOCS_DIR}/${PROJECT_PREFIX}/`);

  // 检查是否配置了 Embedding API
  const hasEmbedding = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY;
  if (!hasEmbedding || process.env.DISABLE_VECTOR_SEARCH === 'true') {
    console.log('⚠️  未检测到 Embedding API 配置 (OPENAI_API_KEY)');
    console.log('💡 文件已复制到 .agent/docs/project/，配置 API Key 后重新运行即可建立向量索引');
    console.log('📌 使用 Web UI 启动后，知识库页面会上线查询当前索引状态');
    return;
  }

  // 重建索引
  const kb = new KnowledgeBase(KB_DOCS_DIR, '.agent/knowledge-vectors.json');
  await kb.indexDocuments();
}

main().catch((err) => {
  console.error('❌ 索引失败:', err);
  process.exit(1);
});
