import { FileVectorStore } from '../vector/file-vector-store';
import { VectorDocument } from '../vector/vector-store';
import { generateEmbeddings, generateSingleEmbedding } from '../vector/embeddings';
import fs from 'fs';
import path from 'path';

export class KnowledgeBase {
  private vectorStore: FileVectorStore;
  private docsDir: string;
  private kbId: string;

  constructor(kbId: string, docsDir: string, vectorPath: string) {
    this.kbId = kbId;
    this.docsDir = path.resolve(docsDir);
    this.vectorStore = new FileVectorStore(vectorPath);
    fs.mkdirSync(this.docsDir, { recursive: true });
  }

  async indexDocuments(): Promise<void> {
    const files = this.getAllFiles(this.docsDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const chunks = this.splitText(content, 500);
      const docs: VectorDocument[] = chunks.map((chunk, i) => ({
        id: `${file}_chunk_${i}`,
        content: chunk,
        metadata: { source: file, chunk: i },
      }));
      const embeddings = await generateEmbeddings(chunks);
      await this.vectorStore.addDocuments(docs, embeddings);
    }
    console.log(`知识库 [${this.kbId}] 索引完成: ${files.length} 个文件`);
  }

  async retrieve(query: string, topK: number = 3): Promise<string> {
    const queryEmbedding = await generateSingleEmbedding(query);
    const results = await this.vectorStore.similaritySearch(queryEmbedding, topK);
    if (results.length === 0) return '';
    const snippets = results.map(r => `[来源: ${r.metadata.source}] ${r.content}`);
    return `相关知识库内容：\n${snippets.join('\n\n')}`;
  }

  listFiles(): { name: string; size: number; mtime: Date }[] {
    if (!fs.existsSync(this.docsDir)) return [];
    return fs.readdirSync(this.docsDir)
      .filter(f => fs.statSync(path.join(this.docsDir, f)).isFile())
      .map(f => {
        const stat = fs.statSync(path.join(this.docsDir, f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      });
  }

  deleteFile(fileName: string): boolean {
    const resolved = path.resolve(this.docsDir, fileName);
    if (!resolved.startsWith(this.docsDir + path.sep)) return false;
    try {
      if (!fs.existsSync(resolved)) return false;
      fs.unlinkSync(resolved);
      return true;
    } catch {
      return false;
    }
  }

  getDocCount(): number {
    return this.listFiles().length;
  }

  private readonly SUPPORTED_EXTS = new Set([
    '.md', '.txt', '.parsed.txt', '.ts', '.tsx', '.js', '.jsx',
    '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.vue',
    '.css', '.html', '.sh', '.sql', '.json', '.xml', '.yaml', '.yml', '.csv',
  ]);

  private getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;
        results = results.concat(this.getAllFiles(fullPath));
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (this.SUPPORTED_EXTS.has(ext)) results.push(fullPath);
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
