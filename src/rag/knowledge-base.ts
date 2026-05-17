import { FileVectorStore } from '../vector/file-vector-store';
import { VectorDocument } from '../vector/vector-store';
import { generateEmbeddings, generateSingleEmbedding } from '../vector/embeddings';
import { RecursiveTextSplitter, TextSplitterConfig } from './text-splitter';
import { KeywordIndex } from './keyword-index';
import fs from 'fs';
import path from 'path';

export interface KnowledgeBaseConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  keywordWeight?: number;
}

export class KnowledgeBase {
  private vectorStore: FileVectorStore;
  private keywordIndex: KeywordIndex;
  private splitter: RecursiveTextSplitter;
  private docsDir: string;
  private kbId: string;
  private keywordWeight: number;
  private keywordIndexPath: string;

  constructor(kbId: string, docsDir: string, vectorPath: string, config: KnowledgeBaseConfig = {}) {
    this.kbId = kbId;
    this.docsDir = path.resolve(docsDir);
    this.vectorStore = new FileVectorStore(vectorPath);
    this.keywordIndexPath = vectorPath.replace(/\.json$/, '-keywords.json');
    this.keywordIndex = new KeywordIndex(this.keywordIndexPath);
    this.splitter = new RecursiveTextSplitter({
      chunkSize: config.chunkSize ?? 1500,
      chunkOverlap: config.chunkOverlap ?? 200,
    });
    this.keywordWeight = config.keywordWeight ?? 0.3;
    fs.mkdirSync(this.docsDir, { recursive: true });
  }

  async indexDocuments(clearFirst: boolean = true): Promise<void> {
    if (clearFirst) {
      this.keywordIndex.clear();
    }
    const files = this.getAllFiles(this.docsDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const chunks = this.splitter.splitText(content);
      const docs: VectorDocument[] = chunks.map((chunk, i) => ({
        id: `${file}_chunk_${i}`,
        content: chunk,
        metadata: { source: file, chunk: i },
      }));
      const texts = chunks;
      const embeddings = await generateEmbeddings(texts);
      await this.vectorStore.addDocuments(docs, embeddings);
      for (const doc of docs) {
        this.keywordIndex.addDocument(doc.id, doc.content);
      }
    }
    this.keywordIndex.persist();
    console.log(`知识库 [${this.kbId}] 索引完成: ${files.length} 个文件`);
  }

  async retrieve(query: string, topK: number = 3): Promise<string> {
    const queryEmbedding = await generateSingleEmbedding(query);
    const vectorResults = await this.vectorStore.similaritySearch(queryEmbedding, topK * 2);

    const keywordScores = this.keywordIndex.search(query);

    const merged = new Map<string, { doc: VectorDocument; vectorScore: number; keywordScore: number }>();
    for (const doc of vectorResults) {
      merged.set(doc.id, { doc, vectorScore: 1, keywordScore: 0 });
    }
    for (const [chunkId, score] of keywordScores) {
      if (merged.has(chunkId)) {
        merged.get(chunkId)!.keywordScore = score;
      }
    }

    const kwMax = Math.max(...Array.from(keywordScores.values()), 1);
    const results = Array.from(merged.values()).map(({ doc, vectorScore, keywordScore }) => ({
      doc,
      score: (1 - this.keywordWeight) * vectorScore + this.keywordWeight * (keywordScore / kwMax),
    }));
    results.sort((a, b) => b.score - a.score);

    const final = results.slice(0, topK);
    if (final.length === 0) return '';
    const snippets = final.map(r => `[来源: ${r.doc.metadata.source}] ${r.doc.content}`);
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
}
