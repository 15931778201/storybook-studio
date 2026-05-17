import fs from 'fs';
import path from 'path';

const DEFAULT_LOG_DIR = '.agent/logs';
const DEFAULT_MAX_SIZE_MB = 100;
const DEFAULT_MAX_AGE_DAYS = 7;

export interface LogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

export class LogRotator {
  private baseDir: string;
  private maxSizeBytes: number;
  private maxAgeDays: number;

  constructor(baseDir = DEFAULT_LOG_DIR, maxSizeMB = DEFAULT_MAX_SIZE_MB, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
    this.baseDir = baseDir;
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    this.maxAgeDays = maxAgeDays;
  }

  private ensureDir(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  getCurrentLogPath(): string {
    this.ensureDir();
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.baseDir, `app-${date}.log`);
  }

  async checkAndRotate(): Promise<void> {
    this.ensureDir();
    const logPath = this.getCurrentLogPath();

    if (!fs.existsSync(logPath)) return;

    const stat = fs.statSync(logPath);
    if (stat.size < this.maxSizeBytes) return;

    let i = 1;
    while (fs.existsSync(`${logPath}.${i}`)) i++;
    fs.renameSync(logPath, `${logPath}.${i}`);
  }

  async cleanOldLogs(): Promise<void> {
    this.ensureDir();
    const files = fs.readdirSync(this.baseDir);
    const now = Date.now();
    const cutoff = now - this.maxAgeDays * 86400000;

    for (const file of files) {
      if (!file.startsWith('app-')) continue;
      const filePath = path.join(this.baseDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    }
  }

  async append(entry: string): Promise<void> {
    await this.checkAndRotate();
    const logPath = this.getCurrentLogPath();
    fs.appendFileSync(logPath, entry + '\n');
  }

  listLogFiles(): LogFileInfo[] {
    this.ensureDir();
    const files = fs.readdirSync(this.baseDir);
    const result: LogFileInfo[] = [];

    for (const file of files) {
      if (!file.startsWith('app-') && file !== 'app.log') continue;
      const filePath = path.join(this.baseDir, file);
      const stat = fs.statSync(filePath);
      result.push({
        name: file,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }

    result.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return result;
  }

  readLogFile(filename: string, options?: {
    level?: string;
    keyword?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
  }): { total: number; page: number; pageSize: number; data: any[] } {
    const filePath = path.join(this.baseDir, filename);
    if (!fs.existsSync(filePath)) {
      return { total: 0, page: 1, pageSize: 50, data: [] };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const allEntries = lines.map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    }).filter(Boolean);

    const filtered = allEntries.filter((entry: any) => {
      if (options?.level && entry.level !== options.level) return false;
      if (options?.keyword && !entry.message?.toLowerCase().includes(options.keyword.toLowerCase())) return false;
      if (options?.startTime && entry.timestamp < options.startTime) return false;
      if (options?.endTime && entry.timestamp > options.endTime) return false;
      return true;
    });

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return { total: filtered.length, page, pageSize, data };
  }
}
