// src/rag/knowledge-base.ts
import { FileVectorStore } from '../vector/file-vector-store';
import { VectorDocument } from '../vector/vector-store';
import { generateEmbeddings, generateSingleEmbedding } from '../vector/embeddings';
import fs from 'fs';
import path from 'path';

export class KnowledgeBase {
  private vectorStore: FileVectorStore;
  private docsDir: string;

  constructor(docsDir: string = '.agent/docs', vectorPath: string = '.agent/knowledge-vectors.json') {
    this.docsDir = path.resolve(process.cwd(), docsDir);
    this.vectorStore = new FileVectorStore(path.dirname(vectorPath));
    fs.mkdirSync(this.docsDir, { recursive: true });
  }

  // 索引文档目录中的所有 Markdown/Text 文件
  async indexDocuments(): Promise<void> {
    const files = this.getAllFiles(this.docsDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const chunks = this.splitText(content, 500); // 每500字符一段
      const docs: VectorDocument[] = chunks.map((chunk, i) => ({
        id: `${file}_chunk_${i}`,
        content: chunk,
        metadata: { source: file, chunk: i },
      }));
      const texts = chunks;
      const embeddings = await generateEmbeddings(texts);
      await this.vectorStore.addDocuments(docs, embeddings);
    }
    console.log(`✅ RAG 知识库索引完成: ${files.length} 个文件`);
  }

  // 检索相关知识
  async retrieve(query: string, topK: number = 3): Promise<string> {
    const queryEmbedding = await generateSingleEmbedding(query);
    const results = await this.vectorStore.similaritySearch(queryEmbedding, topK);
    if (results.length === 0) return '';
    const snippets = results.map(r => `[来源: ${r.metadata.source}] ${r.content}`);
    return `📖 相关知识库内容：\n${snippets.join('\n\n')}`;
  }

  private getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results = results.concat(this.getAllFiles(fullPath));
      } else if (
        item.name.endsWith('.md') ||
        item.name.endsWith('.txt') ||
        item.name.endsWith('.parsed.txt')
      ) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private splitText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
}