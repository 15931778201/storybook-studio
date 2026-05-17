import fs from 'fs';
import path from 'path';

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '些', '什么', '怎么', '如何',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'may', 'might', 'shall', 'should', 'this', 'that', 'these', 'those',
  'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his',
  'her', 'our', 'their', 'not', 'no', 'nor', 'so', 'if', 'then', 'than',
  'also', 'just', 'about', 'into', 'over', 'after', 'before', 'between',
  'more', 'most', 'some', 'any', 'each', 'every', 'both', 'all', 'other',
  'such', 'only', 'very', 'too', 'much', 'many', 'up', 'down', 'out', 'off',
  'above', 'below', 'when', 'where', 'why', 'how', 'which', 'who', 'whom',
]);

const TOKENIZE_REGEX = /[a-zA-Z0-9_\u4e00-\u9fff]+/g;

interface SerializedIndex {
  entries: Record<string, Record<string, number>>;
  docLengths: Record<string, number>;
  totalDocs: number;
}

export class KeywordIndex {
  private index: Map<string, Map<string, number>> = new Map();
  private docLengths: Map<string, number> = new Map();
  private totalDocs: number = 0;
  private storagePath: string;
  private static readonly K1 = 1.5;
  private static readonly B = 0.75;

  constructor(storagePath: string) {
    this.storagePath = path.resolve(storagePath);
    this.load();
  }

  addDocument(id: string, content: string): void {
    const tokens = this.tokenize(content);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    for (const [token, count] of tf) {
      let entry = this.index.get(token);
      if (!entry) {
        entry = new Map();
        this.index.set(token, entry);
      }
      entry.set(id, (entry.get(id) || 0) + count);
    }
    this.docLengths.set(id, tokens.length);
    this.totalDocs++;
  }

  removeDocument(id: string): void {
    for (const [, entry] of this.index) {
      entry.delete(id);
    }
    for (const [key, entry] of this.index) {
      if (entry.size === 0) this.index.delete(key);
    }
    this.docLengths.delete(id);
    this.totalDocs = Math.max(0, this.totalDocs - 1);
  }

  search(query: string): Map<string, number> {
    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();
    const avgDocLen = this.totalDocs > 0
      ? Array.from(this.docLengths.values()).reduce((a, b) => a + b, 0) / this.totalDocs
      : 1;
    const N = this.totalDocs;

    for (const token of tokens) {
      const entry = this.index.get(token);
      if (!entry) continue;
      const n = entry.size;
      const idf = N > 0 ? Math.log((N - n + 0.5) / (n + 0.5) + 1) : 0;

      for (const [docId, tf] of entry) {
        const docLen = this.docLengths.get(docId) || avgDocLen;
        const bm25Score = idf * (tf * (KeywordIndex.K1 + 1)) / (tf + KeywordIndex.K1 * (1 - KeywordIndex.B + KeywordIndex.B * docLen / avgDocLen));
        scores.set(docId, (scores.get(docId) || 0) + bm25Score);
      }
    }
    return scores;
  }

  entries(): IterableIterator<[string, Map<string, number>]> {
    return this.index.entries();
  }

  docCount(): number {
    return this.totalDocs;
  }

  persist(): void {
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    const obj: SerializedIndex = {
      entries: {},
      docLengths: Object.fromEntries(this.docLengths),
      totalDocs: this.totalDocs,
    };
    for (const [key, docMap] of this.index) {
      obj.entries[key] = Object.fromEntries(docMap);
    }
    fs.writeFileSync(this.storagePath, JSON.stringify(obj), 'utf-8');
  }

  clear(): void {
    this.index.clear();
    this.docLengths.clear();
    this.totalDocs = 0;
    if (fs.existsSync(this.storagePath)) {
      fs.unlinkSync(this.storagePath);
    }
  }

  private load(): void {
    if (!fs.existsSync(this.storagePath)) return;
    try {
      const obj: SerializedIndex = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
      this.docLengths = new Map(Object.entries(obj.docLengths || {}));
      this.totalDocs = obj.totalDocs || 0;
      for (const [key, docMap] of Object.entries(obj.entries || {})) {
        this.index.set(key, new Map(Object.entries(docMap)));
      }
    } catch {
      this.index.clear();
      this.docLengths.clear();
      this.totalDocs = 0;
    }
  }

  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(TOKENIZE_REGEX.source, 'g');
    while ((match = regex.exec(text.toLowerCase())) !== null) {
      const token = match[0];
      if (token.length >= 2 && !STOP_WORDS.has(token)) {
        tokens.push(token);
      }
    }
    return tokens;
  }
}
