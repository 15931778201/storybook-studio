
import { appendAuditLog } from '../utils/logger';
export async function recordAudit(entry: { level: string; actor: string; operation: string; params: any; result: string; reason?: string }) { appendAuditLog({ ...entry, timestamp: new Date().toISOString() }, '.agent/audit.jsonl'); }
