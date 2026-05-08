import { Database } from "bun:sqlite";
import type { ModelConfig } from "../types/config";

const DEFAULT_CONFIG: ModelConfig = {
  id: crypto.randomUUID(),
  model: process.env.OPENAI_MODEL || "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export class ModelConfigStore {
  private db: Database;

  constructor(dbPath: string = ".agent/config.db") {
    this.db = new Database(dbPath);
    this.init();
    // 如果表为空，插入默认配置
    const row = this.db.query("SELECT id FROM model_config WHERE id = 1").get();
    if (!row) {
      this.save(DEFAULT_CONFIG);
    }
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS model_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        model TEXT NOT NULL,
        api_key TEXT NOT NULL,
        base_url TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.7,
        max_tokens INTEGER NOT NULL DEFAULT 4096,
        top_p REAL NOT NULL DEFAULT 1.0,
        frequency_penalty REAL NOT NULL DEFAULT 0.0,
        presence_penalty REAL NOT NULL DEFAULT 0.0,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  get(): ModelConfig | null {
    const row = this.db.query("SELECT * FROM model_config WHERE id = 1").get() as any;
    if (!row) return null;
    return {
      id: row.id,
      model: row.model,
      apiKey: row.api_key,
      baseURL: row.base_url,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      topP: row.top_p,
      frequencyPenalty: row.frequency_penalty,
      presencePenalty: row.presence_penalty,
    };
  }

  save(config: ModelConfig): void {
    this.db.run(
      `INSERT OR REPLACE INTO model_config 
        (id, model, api_key, base_url, temperature, max_tokens, top_p, frequency_penalty, presence_penalty) 
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.model,
        config.apiKey,
        config.baseURL,
        config.temperature,
        config.maxTokens,
        config.topP,
        config.frequencyPenalty,
        config.presencePenalty,
      ]
    );
  }
}