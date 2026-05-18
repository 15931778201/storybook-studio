import { FileVectorStore } from '../vector/file-vector-store';
import { VectorDocument } from '../vector/vector-store';
import { generateEmbeddings, generateSingleEmbedding } from '../vector/embeddings';
import { RecursiveTextSplitter, TextSplitterConfig } from './text-splitter';
import { KeywordIndex } from './keyword-index';
import { EmbeddingCache } from './embedding-cache';
import { KnowledgeGraph } from './knowledge-graph';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface KnowledgeBaseConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  keywordWeight?: number;
}

interface IndexManifest {
  [filePath: string]: {
    hash: string;
    updatedAt: string;
  };
}

export class KnowledgeBase {
  private vectorStore: FileVectorStore;
  private keywordIndex: KeywordIndex;
  private splitter: RecursiveTextSplitter;
  private docsDir: string;
  private kbId: string;
  private keywordWeight: number;
  private keywordIndexPath: string;
  private manifestPath: string;
  private vectorsDir: string;
  private cache: EmbeddingCache;
  private graph: KnowledgeGraph;

  constructor(kbId: string, docsDir: string, vectorPath: string, config: KnowledgeBaseConfig = {}) {
    this.kbId = kbId;
    this.docsDir = path.resolve(docsDir);
    this.vectorStore = new FileVectorStore(vectorPath);
    this.vectorsDir = path.dirname(path.resolve(vectorPath));
    this.keywordIndexPath = vectorPath.replace(/\.json$/, '-keywords.json');
    this.keywordIndex = new KeywordIndex(this.keywordIndexPath);
    this.manifestPath = path.join(this.vectorsDir, 'index-manifest.json');
    this.splitter = new RecursiveTextSplitter({
      chunkSize: config.chunkSize ?? 1500,
      chunkOverlap: config.chunkOverlap ?? 200,
    });
    this.keywordWeight = config.keywordWeight ?? 0.3;
    // Get the correct embedding model configuration
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.cache = new EmbeddingCache(path.join(this.vectorsDir, 'embedding-cache.sqlite'), embeddingModel);
    this.graph = new KnowledgeGraph(path.join(this.vectorsDir, 'knowledge-graph.json'));
    fs.mkdirSync(this.docsDir, { recursive: true });
  }

  async indexDocuments(clearFirst: boolean = true): Promise<void> {
    if (clearFirst) {
      this.keywordIndex.clear();
    }
    const manifest = clearFirst ? {} : this.loadManifest();
    const files = this.getAllFiles(this.docsDir);
    const currentFileSet = new Set(files);

    for (const file of files) {
      const hash = this.fileHash(file);
      const existing = manifest[file];
      if (!clearFirst && existing && existing.hash === hash) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const chunks = this.splitter.splitText(content);
      const docs: VectorDocument[] = chunks.map((chunk, i) => ({
        id: `${file}_chunk_${i}`,
        content: chunk,
        metadata: { source: file, chunk: i },
      }));

      if (!clearFirst) {
        await this.vectorStore.deleteByPrefix(`${file}_chunk_`);
        this.removeFromKeywordIndex(file);
      }

      this.graph.addFileEntities(file, content);
      for (const doc of docs) {
        this.graph.addChunkAssociations(doc.id, file, doc.content);
      }

      const texts = chunks;
      const uncachedIndices: number[] = [];
      const cachedEmbeddings: (number[] | null)[] = texts.map((t, i) => {
        const cached = this.cache.get(t);
        if (cached) return cached;
        uncachedIndices.push(i);
        return null;
      });
      if (uncachedIndices.length > 0) {
        const uncachedTexts = uncachedIndices.map(i => texts[i]);
        const newEmbeddings = await generateEmbeddings(uncachedTexts);
        for (let j = 0; j < uncachedIndices.length; j++) {
          const idx = uncachedIndices[j];
          cachedEmbeddings[idx] = newEmbeddings[j];
          this.cache.set(texts[idx], newEmbeddings[j]);
        }
      }
      const embeddings = cachedEmbeddings as number[][];
      await this.vectorStore.addDocuments(docs, embeddings);
      for (const doc of docs) {
        this.keywordIndex.addDocument(doc.id, doc.content);
      }
      manifest[file] = { hash, updatedAt: new Date().toISOString() };
    }

    for (const filePath of Object.keys(manifest)) {
      if (!currentFileSet.has(filePath)) {
        await this.vectorStore.deleteByPrefix(`${filePath}_chunk_`);
        this.removeFromKeywordIndex(filePath);
        delete manifest[filePath];
      }
    }

    this.keywordIndex.persist();
    this.graph.persist();
    this.saveManifest(manifest);
    console.log(`知识库 [${this.kbId}] 索引完成: ${files.length} 个文件`);
  }

  private removeFromKeywordIndex(filePath: string): void {
    const prefix = `${filePath}_chunk_`;
    const idsToRemove: string[] = [];
    for (const [, entry] of this.keywordIndex.entries()) {
      for (const id of entry.keys()) {
        if (id.startsWith(prefix)) idsToRemove.push(id);
      }
    }
    for (const id of new Set(idsToRemove)) {
      this.keywordIndex.removeDocument(id);
    }
  }

  async retrieve(query: string, topK: number = 3): Promise<string> {
    const expandedQueries = this.expandQuery(query);
    const queryEmbedding = await generateSingleEmbedding(query);
    const vectorResults = await this.vectorStore.similaritySearch(queryEmbedding, topK * 2);

    const kwWeight = this.adaptiveWeight(query);
    const keywordScores = this.keywordIndex.search(expandedQueries.join(' '));
    const graphChunkIds = new Set(this.graph.search(query));

    const merged = new Map<string, { doc: VectorDocument; vectorScore: number; keywordScore: number; graphBoost: number }>();
    for (const doc of vectorResults) {
      merged.set(doc.id, { doc, vectorScore: 1, keywordScore: 0, graphBoost: graphChunkIds.has(doc.id) ? 0.2 : 0 });
    }
    for (const [chunkId, score] of keywordScores) {
      if (merged.has(chunkId)) {
        merged.get(chunkId)!.keywordScore = score;
      } else {
        merged.set(chunkId, { doc: { id: chunkId, content: '', metadata: {} }, vectorScore: 0, keywordScore: score, graphBoost: graphChunkIds.has(chunkId) ? 0.2 : 0 });
      }
    }
    for (const cid of graphChunkIds) {
      if (!merged.has(cid)) {
        merged.set(cid, { doc: { id: cid, content: '', metadata: {} }, vectorScore: 0, keywordScore: 0, graphBoost: 0.2 });
      }
    }

    const kwMax = keywordScores.size > 0 ? Math.max(...Array.from(keywordScores.values()), 1) : 1;
    const results = Array.from(merged.values()).map(({ doc, vectorScore, keywordScore, graphBoost }) => ({
      doc,
      score: (1 - kwWeight) * vectorScore + kwWeight * (keywordScore / kwMax) + graphBoost,
    }));
    results.sort((a, b) => b.score - a.score);

    const final = results.slice(0, topK);
    if (final.length === 0) return '';
    const snippets = final.map(r => `[来源: ${r.doc.metadata.source}] ${r.doc.content}`);
    return `相关知识库内容：\n${snippets.join('\n\n')}`;
  }

  private adaptiveWeight(query: string): number {
    const codePatterns = /[A-Z][a-z]+[A-Z]|[a-z]+_[a-z]+|[a-z]+\.[a-z]+|::|->|=>|`[^`]+`|function|class|import|interface|type|const|let|var/g;
    const codeMatches = query.match(codePatterns);
    const codeRatio = codeMatches ? codeMatches.length / Math.max(query.split(/\s+/).length, 1) : 0;
    if (codeRatio > 0.3) return 0.5;
    if (codeRatio > 0.1) return 0.4;
    return 0.3;
  }

  private expandQuery(query: string): string[] {
    const queries = [query];
    const codeSymbols = query.match(/[a-zA-Z_$][\w$]*/g);
    if (codeSymbols && codeSymbols.length > 1) {
      const camelParts = codeSymbols.flatMap(s => s.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/));
      if (camelParts.length > codeSymbols.length) {
        queries.push(camelParts.join(' '));
      }
    }
    return queries;
  }

  getConfig(): KnowledgeBaseConfig & { kbId: string } {
    return {
      kbId: this.kbId,
      chunkSize: this.splitter.getChunkSize(),
      chunkOverlap: this.splitter.getChunkOverlap(),
      keywordWeight: this.keywordWeight,
    };
  }

  setConfig(config: KnowledgeBaseConfig): void {
    if (config.chunkSize !== undefined) this.splitter.setChunkSize(config.chunkSize);
    if (config.chunkOverlap !== undefined) this.splitter.setChunkOverlap(config.chunkOverlap);
    if (config.keywordWeight !== undefined) this.keywordWeight = config.keywordWeight;
  }

  getGraph(): KnowledgeGraph { return this.graph; }

  async retrieveWithScores(query: string, topK: number = 5): Promise<{ content: string; source: string; score: number }[]> {
    const queryEmbedding = await generateSingleEmbedding(query);
    const vectorResults = await this.vectorStore.similaritySearch(queryEmbedding, topK * 2);
    const kwWeight = this.adaptiveWeight(query);
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

    const kwMax = keywordScores.size > 0 ? Math.max(...Array.from(keywordScores.values()), 1) : 1;
    const results = Array.from(merged.values()).map(({ doc, vectorScore, keywordScore }) => ({
      content: doc.content,
      source: doc.metadata.source,
      score: (1 - kwWeight) * vectorScore + kwWeight * (keywordScore / kwMax),
    }));
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  getFileChunks(fileName: string): { index: number; content: string; charCount: number }[] {
    const resolved = path.resolve(this.docsDir, fileName);
    if (!resolved.startsWith(this.docsDir + path.sep) || !fs.existsSync(resolved)) return [];
    const content = fs.readFileSync(resolved, 'utf-8');
    const chunks = this.splitter.splitText(content);
    return chunks.map((chunk, i) => ({ index: i, content: chunk, charCount: chunk.length }));
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

  private loadManifest(): IndexManifest {
    if (!fs.existsSync(this.manifestPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
    } catch {
      return {};
    }
  }

  private saveManifest(manifest: IndexManifest): void {
    fs.mkdirSync(path.dirname(this.manifestPath), { recursive: true });
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  private fileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
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
