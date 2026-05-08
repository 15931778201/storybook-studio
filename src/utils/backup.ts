
import fs from 'fs'; import path from 'path';
export function createBackup(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const dir = '.agent/backups'; fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, `${path.basename(filePath)}.${Date.now()}.bak`);
  fs.copyFileSync(filePath, backup); return backup;
}
export function restoreBackup(backup: string, target: string) { fs.copyFileSync(backup, target); }
