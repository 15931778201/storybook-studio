
import fs from 'fs'; import path from 'path';
import { VectorStore, VectorDocument } from './vector-store';
export class FileVectorStore implements VectorStore {
  private filePath: string; private vectors: any[] = [];
  constructor(filePath: string = '.agent/vectors.json') { this.filePath = path.resolve(filePath); this.load(); }
  private load() { try { if (fs.existsSync(this.filePath)) this.vectors = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')); } catch { this.vectors = []; } }
  async addDocuments(docs: VectorDocument[], embeddings: number[][]) {
    for (let i=0; i<docs.length; i++) this.vectors.push({ id: docs[i].id, content: docs[i].content, metadata: docs[i].metadata, embedding: embeddings[i] });
    await this.persist();
  }
  async similaritySearch(query: number[], k: number): Promise<VectorDocument[]> {
    return this.vectors.map(v => ({ doc: { id: v.id, content: v.content, metadata: v.metadata }, score: cosineSim(query, v.embedding) }))
      .sort((a,b) => b.score - a.score).slice(0, k).map(x => x.doc);
  }
  async deleteByIds(ids: string[]) { this.vectors = this.vectors.filter(v => !ids.includes(v.id)); await this.persist(); }
  async persist() { fs.mkdirSync(path.dirname(this.filePath), { recursive: true }); fs.writeFileSync(this.filePath, JSON.stringify(this.vectors)); }
}
function cosineSim(a: number[], b: number[]): number { let dot=0, na=0, nb=0; for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return dot/(Math.sqrt(na)*Math.sqrt(nb)+1e-10); }
