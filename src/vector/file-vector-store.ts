import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import { VectorStore, VectorDocument } from './vector-store';

export class FileVectorStore implements VectorStore {
  private db: Database;
  private filePath: string;

  constructor(filePath: string = '.agent/vectors.json') {
    this.filePath = path.resolve(filePath);
    const sqlitePath = this.filePath.replace(/\.json$/, '.sqlite');
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new Database(sqlitePath);
    this.db.run(`CREATE TABLE IF NOT EXISTS vectors (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    )`);
  }

  async addDocuments(docs: VectorDocument[], embeddings: number[][]): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO vectors (id, content, embedding, metadata) VALUES (?, ?, ?, ?)'
    );
    const tx = this.db.transaction(() => {
      for (let i = 0; i < docs.length; i++) {
        stmt.run(docs[i].id, docs[i].content, JSON.stringify(embeddings[i]), JSON.stringify(docs[i].metadata));
      }
    });
    tx();
    await this.persist();
  }

  async similaritySearch(queryEmbedding: number[], k: number): Promise<VectorDocument[]> {
    const rows = this.db.query<{ id: string; content: string; embedding: string; metadata: string }, any[]>(
      'SELECT id, content, embedding, metadata FROM vectors'
    ).all();
    const scored = rows.map(row => {
      const emb = JSON.parse(row.embedding) as number[];
      const doc: VectorDocument = {
        id: row.id,
        content: row.content,
        metadata: JSON.parse(row.metadata),
      };
      return { doc, score: cosineSim(queryEmbedding, emb) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(x => x.doc);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.db.run(`DELETE FROM vectors WHERE id IN (${placeholders})`, ids);
    await this.persist();
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    this.db.run('DELETE FROM vectors WHERE id LIKE ?', [`${prefix}%`]);
    await this.persist();
  }

  async persist(): Promise<void> {
    this.db.run('VACUUM');
  }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}
