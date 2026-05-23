import { Database } from "bun:sqlite";
import type { Message } from "../types/message";
import type { MemoryItem } from "../core/memory";

export interface SessionRuntimeSnapshot {
  sessionId: string;
  status: 'idle' | 'running' | 'paused' | 'done' | 'aborted';
  mode?: 'planning' | 'executing' | 'react' | 'done';
  phase?: string;
  currentStepIndex?: number;
  lastInput?: string;
  finalOutput?: string;
  plan?: any;
  messages?: Message[];
  runtimeData?: Record<string, unknown>;
  updatedAt?: string;
}

export class SessionStore {
  private db: Database;

  constructor(dbPath: string = ".agent/session.db") {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_call_id TEXT,
        steps TEXT,  -- JSON for thinking steps
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_runtime (
        session_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        mode TEXT,
        phase TEXT,
        current_step_index INTEGER,
        last_input TEXT,
        final_output TEXT,
        plan_json TEXT,
        messages_json TEXT,
        runtime_data_json TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    try {
      this.db.run(`ALTER TABLE session_runtime ADD COLUMN runtime_data_json TEXT`);
    } catch {}
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    `);
  }

  saveSession(sessionId: string, workspaceId: string) {
    this.db.run(
      `INSERT OR REPLACE INTO sessions (id, workspace_id, updated_at) VALUES (?, ?, datetime('now'))`,
      [sessionId, workspaceId]
    );
  }

  // 保存消息历史（全量替换或增量添加）
  saveMessages(sessionId: string, messages: Message[]) {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO messages (id, session_id, role, content, tool_calls, tool_call_id, steps)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.db.transaction(() => {
      // 先清空该会话的消息，再批量插入
      this.db.run("DELETE FROM messages WHERE session_id = ?", [sessionId]);
      for (const msg of messages) {
        insert.run(
          msg.id || crypto.randomUUID(),
          sessionId,
          msg.role,
          msg.content,
          msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls 
            ? JSON.stringify(msg.tool_calls) 
            : null,
          msg.role === 'tool' ? msg.tool_call_id : null,
          msg.role === 'thinking' && 'steps' in msg && msg.steps 
            ? JSON.stringify(msg.steps) 
            : null
        );
      }
    })();
  }

  loadMessages(sessionId: string): Message[] {
    const rows = this.db
      .query("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC")
      .all(sessionId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_call_id: row.tool_call_id || undefined,
      steps: row.steps ? JSON.parse(row.steps) : undefined,
    }));
  }

  saveMemories(sessionId: string, memories: MemoryItem[]) {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO memories (id, session_id, key, content) VALUES (?, ?, ?, ?)`
    );
    this.db.transaction(() => {
      this.db.run("DELETE FROM memories WHERE session_id = ?", [sessionId]);
      for (const mem of memories) {
        insert.run(mem.id || crypto.randomUUID(), sessionId, mem.key, mem.content);
      }
    })();
  }

  loadMemories(sessionId: string): MemoryItem[] {
    const rows = this.db
      .query("SELECT * FROM memories WHERE session_id = ?")
      .all(sessionId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      key: row.key,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    }));
  }

  saveRuntimeState(snapshot: SessionRuntimeSnapshot) {
    this.db.run(
      `INSERT OR REPLACE INTO session_runtime
       (session_id, status, mode, phase, current_step_index, last_input, final_output, plan_json, messages_json, runtime_data_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        snapshot.sessionId,
        snapshot.status,
        snapshot.mode || null,
        snapshot.phase || null,
        snapshot.currentStepIndex ?? null,
        snapshot.lastInput || null,
        snapshot.finalOutput || null,
        snapshot.plan ? JSON.stringify(snapshot.plan) : null,
        snapshot.messages ? JSON.stringify(snapshot.messages) : null,
        snapshot.runtimeData ? JSON.stringify(snapshot.runtimeData) : null,
      ]
    );
  }

  loadRuntimeState(sessionId: string): SessionRuntimeSnapshot | null {
    const row = this.db
      .query(`SELECT * FROM session_runtime WHERE session_id = ?`)
      .get(sessionId) as any;
    if (!row) return null;
    return {
      sessionId: row.session_id,
      status: row.status,
      mode: row.mode || undefined,
      phase: row.phase || undefined,
      currentStepIndex: row.current_step_index ?? undefined,
      lastInput: row.last_input || undefined,
      finalOutput: row.final_output || undefined,
      plan: row.plan_json ? JSON.parse(row.plan_json) : undefined,
      messages: row.messages_json ? JSON.parse(row.messages_json) : undefined,
      runtimeData: row.runtime_data_json ? JSON.parse(row.runtime_data_json) : undefined,
      updatedAt: row.updated_at,
    };
  }

  clearRuntimeState(sessionId: string) {
    this.db.run(`DELETE FROM session_runtime WHERE session_id = ?`, [sessionId]);
  }

  // 清空旧会话（可选）
  deleteSession(sessionId: string) {
    this.db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
    this.db.run("DELETE FROM session_runtime WHERE session_id = ?", [sessionId]);
  }

  close() {
    this.db.close();
  }
}
