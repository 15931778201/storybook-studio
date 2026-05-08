import { Database } from 'bun:sqlite';
import { CronJob } from '../types/cron';

export class CronStore {
  private db: Database;

  constructor(dbPath: string = '.agent/cron.db') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        cron_expression TEXT NOT NULL,
        prompt TEXT NOT NULL,
        role TEXT,
        enabled INTEGER DEFAULT 1,
        last_run TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  async list(): Promise<CronJob[]> {
    const rows = this.db.query('SELECT * FROM cron_jobs ORDER BY created_at DESC').all() as any[];
    return rows.map(this.rowToJob);
  }

  async listEnabled(): Promise<CronJob[]> {
    const rows = this.db.query('SELECT * FROM cron_jobs WHERE enabled = 1').all() as any[];
    return rows.map(this.rowToJob);
  }

  async get(id: string): Promise<CronJob | null> {
    const row = this.db.query('SELECT * FROM cron_jobs WHERE id = ?').get(id) as any;
    return row ? this.rowToJob(row) : null;
  }

  async create(job: Omit<CronJob, 'id' | 'lastRun' | 'createdAt' | 'updatedAt'>): Promise<CronJob> {
    const id = crypto.randomUUID();
    this.db.run(
      `INSERT INTO cron_jobs (id, name, description, cron_expression, prompt, role, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, job.name, job.description, job.cronExpression, job.prompt, job.role || null, job.enabled ? 1 : 0]
    );
    return this.get(id) as Promise<CronJob>;
  }

  async update(id: string, updates: Partial<CronJob>): Promise<CronJob | null> {
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'description', 'cron_expression', 'prompt', 'role', 'enabled'].includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (sets.length === 0) return this.get(id);
    sets.push('updated_at = datetime(\'now\')');
    values.push(id);
    this.db.run(`UPDATE cron_jobs SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.get(id);
  }

  async updateLastRun(id: string, lastRun: string): Promise<void> {
    this.db.run('UPDATE cron_jobs SET last_run = ?, updated_at = datetime(\'now\') WHERE id = ?', [lastRun, id]);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.run('DELETE FROM cron_jobs WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private rowToJob(row: any): CronJob {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      cronExpression: row.cron_expression,
      prompt: row.prompt,
      role: row.role || undefined,
      enabled: row.enabled === 1,
      lastRun: row.last_run || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}