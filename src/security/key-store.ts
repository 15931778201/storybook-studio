import { Database } from 'bun:sqlite';
import { encryptApiKey, decryptApiKey } from './crypto';

export interface ApiKeyRecord {
  id: string;
  name: string;
  masked: string;          // 脱敏展示，如 `sk-...abc`
  encrypted: string;        // AES 加密后的完整 Key
  createdAt: string;
  lastUsed?: string;
}

export class ApiKeyStore {
  private db: Database;

  constructor(dbPath: string = '.agent/apikeys.db') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        masked TEXT NOT NULL,
        encrypted TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        last_used TEXT
      );
    `);
  }

  // 存储并加密
  async store(name: string, plainKey: string): Promise<ApiKeyRecord> {
    const id = crypto.randomUUID();
    const masked = plainKey.slice(0, 4) + '...' + plainKey.slice(-4);
    const encrypted = encryptApiKey(plainKey);

    this.db.run(
      'INSERT INTO api_keys (id, name, masked, encrypted) VALUES (?, ?, ?, ?)',
      [id, name, masked, encrypted]
    );
    return { id, name, masked, encrypted, createdAt: new Date().toISOString() };
  }

  // 解密获取
  getDecrypted(id: string): string | null {
    const row = this.db.query('SELECT encrypted FROM api_keys WHERE id = ?').get(id) as any;
    if (!row) return null;

    // 更新最近使用时间
    this.db.run('UPDATE api_keys SET last_used = datetime(\'now\') WHERE id = ?', [id]);
    return decryptApiKey(row.encrypted);
  }

  // 列出所有 Key（仅展示脱敏版本）
  list(): ApiKeyRecord[] {
    const rows = this.db.query('SELECT id, name, masked, created_at, last_used FROM api_keys ORDER BY created_at DESC').all() as any[];
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      masked: r.masked,
      encrypted: '',  // 不返回加密值
      createdAt: r.created_at,
      lastUsed: r.last_used,
    }));
  }

  // 删除
  delete(id: string): boolean {
    const result = this.db.run('DELETE FROM api_keys WHERE id = ?', [id]);
    return result.changes > 0;
  }
}