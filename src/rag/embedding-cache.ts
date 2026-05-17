import { Database } from 'bun:sqlite';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export class EmbeddingCache {
  private db: Database;
  private model: string;

  constructor(cachePath: string, model: string = 'text-embedding-3-small') {
    fs.mkdirSync(path.dirname(path.resolve(cachePath)), { recursive: true });
    this.db = new Database(path.resolve(cachePath));
    this.model = model;
    this.db.run(`CREATE TABLE IF NOT EXISTS embedding_cache (
      text_hash TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
  }

  get(text: string): number[] | null {
    const hash = this.hash(text);
    const row = this.db.query<{ embedding: string }, [string, string]>(
      'SELECT embedding FROM embedding_cache WHERE text_hash = ? AND model = ?'
    ).get(hash, this.model) as { embedding: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.embedding);
    } catch {
      return null;
    }
  }

  set(text: string, embedding: number[]): void {
    const hash = this.hash(text);
    this.db.run(
      'INSERT OR REPLACE INTO embedding_cache (text_hash, model, embedding, created_at) VALUES (?, ?, ?, ?)',
      [hash, this.model, JSON.stringify(embedding), Date.now()]
    );
  }

  getOrCompute(text: string, compute: () => Promise<number[]>): Promise<number[]> {
    const cached = this.get(text);
    if (cached) return Promise.resolve(cached);
    return compute().then(embedding => {
      this.set(text, embedding);
      return embedding;
    });
  }

  clear(): void {
    this.db.run('DELETE FROM embedding_cache WHERE model = ?', [this.model]);
  }

  close(): void {
    this.db.close();
  }

  private hash(text: string): string {
    return crypto.createHash('md5').update(text, 'utf-8').digest('hex');
  }
}
