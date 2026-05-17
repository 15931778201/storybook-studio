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

interface InvertedIndexEntry {
  ids: string[];
}

export class KeywordIndex {
  private index: Map<string, InvertedIndexEntry> = new Map();
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = path.resolve(storagePath);
    this.load();
  }

  addDocument(id: string, content: string): void {
    const tokens = this.tokenize(content);
    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      let entry = this.index.get(token);
      if (!entry) {
        entry = { ids: [] };
        this.index.set(token, entry);
      }
      if (!entry.ids.includes(id)) {
        entry.ids.push(id);
      }
    }
  }

  removeDocument(id: string): void {
    for (const [, entry] of this.index) {
      entry.ids = entry.ids.filter(x => x !== id);
    }
    for (const [key, entry] of this.index) {
      if (entry.ids.length === 0) this.index.delete(key);
    }
  }

  search(query: string): Map<string, number> {
    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();
    for (const token of tokens) {
      const entry = this.index.get(token);
      if (!entry) continue;
      for (const id of entry.ids) {
        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }
    return scores;
  }

  docCount(): number {
    const docIds = new Set<string>();
    for (const [, entry] of this.index) {
      for (const id of entry.ids) {
        docIds.add(id);
      }
    }
    return docIds.size;
  }

  persist(): void {
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    const obj: Record<string, string[]> = {};
    for (const [key, entry] of this.index) {
      obj[key] = entry.ids;
    }
    fs.writeFileSync(this.storagePath, JSON.stringify(obj), 'utf-8');
  }

  clear(): void {
    this.index.clear();
    if (fs.existsSync(this.storagePath)) {
      fs.unlinkSync(this.storagePath);
    }
  }

  private load(): void {
    if (!fs.existsSync(this.storagePath)) return;
    try {
      const obj = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
      for (const [key, ids] of Object.entries(obj)) {
        this.index.set(key, { ids: ids as string[] });
      }
    } catch {
      this.index.clear();
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
