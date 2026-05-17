import { Database } from 'bun:sqlite';

export interface ChangelogEntry {
  id: string;
  type: string;
  title: string;
  description?: string;
  trigger: string;
  commitHash?: string;
  createdAt: string;
}

export interface ChangelogFilter {
  type?: string;
  trigger?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

export interface ChangelogListResult {
  items: ChangelogEntry[];
  total: number;
}

export class ChangelogStore {
  private db: Database;

  constructor(dbPath: string = '.agent/changelog.db') {
    this.db = new Database(dbPath);
    this.db.run('PRAGMA journal_mode=WAL');
    this.init();
  }

  private init(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS changelog_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        trigger TEXT NOT NULL,
        commit_hash TEXT,
        created_at TEXT NOT NULL
      );
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_changelog_type ON changelog_entries(type)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_changelog_trigger ON changelog_entries(trigger)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_changelog_created_at ON changelog_entries(created_at)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS changelog_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  async list(filters: ChangelogFilter = {}): Promise<ChangelogListResult> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.type) {
      conditions.push('type = ?');
      values.push(filters.type);
    }
    if (filters.trigger) {
      conditions.push('trigger = ?');
      values.push(filters.trigger);
    }
    if (filters.startTime) {
      conditions.push('created_at >= ?');
      values.push(filters.startTime);
    }
    if (filters.endTime) {
      conditions.push('created_at <= ?');
      values.push(filters.endTime);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.query(`SELECT COUNT(*) as count FROM changelog_entries ${where}`).get(...values) as any;
    const total = countRow.count;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    const rows = this.db.query(
      `SELECT * FROM changelog_entries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...values, pageSize, offset) as any[];

    return {
      items: rows.map(this.rowToEntry),
      total,
    };
  }

  async create(entry: {
    type: string;
    title: string;
    description?: string;
    trigger: string;
    commitHash?: string;
  }): Promise<ChangelogEntry> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.run(
      `INSERT INTO changelog_entries (id, type, title, description, trigger, commit_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, entry.type, entry.title, entry.description ?? null, entry.trigger, entry.commitHash ?? null, createdAt]
    );

    return this.get(id) as Promise<ChangelogEntry>;
  }

  async bulkCreate(entries: Array<{
    type: string;
    title: string;
    description?: string;
    trigger: string;
    commitHash?: string;
  }>): Promise<number> {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO changelog_entries (id, type, title, description, trigger, commit_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const now = new Date().toISOString();

    const insertMany = this.db.transaction((items: typeof entries) => {
      let count = 0;
      for (const item of items) {
        const id = crypto.randomUUID();
        const result = insert.run(id, item.type, item.title, item.description ?? null, item.trigger, item.commitHash ?? null, now);
        count += result.changes;
      }
      return count;
    });

    return insertMany(entries);
  }

  async get(id: string): Promise<ChangelogEntry | null> {
    const row = this.db.query('SELECT * FROM changelog_entries WHERE id = ?').get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.run('DELETE FROM changelog_entries WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async getLastScanTime(): Promise<string | null> {
    const row = this.db.query('SELECT value FROM changelog_meta WHERE key = ?').get('last_git_scan') as any;
    return row ? row.value : null;
  }

  async updateScanTime(): Promise<void> {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO changelog_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['last_git_scan', now]
    );
  }

  private rowToEntry(row: any): ChangelogEntry {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description || undefined,
      trigger: row.trigger,
      commitHash: row.commit_hash || undefined,
      createdAt: row.created_at,
    };
  }
}
