import { KnowledgeBase } from './knowledge-base';
import fs from 'fs';
import path from 'path';

export interface KBConfig {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  docCount: number;
}

export class KnowledgeBaseManager {
  private baseDir: string;
  private configPath: string;
  private instances: Map<string, KnowledgeBase> = new Map();

  constructor(baseDir: string = '.agent/knowledge') {
    this.baseDir = path.resolve(baseDir);
    this.configPath = path.join(this.baseDir, 'config.json');
    fs.mkdirSync(this.baseDir, { recursive: true });
    this.migrateLegacy();
  }

  list(): KBConfig[] {
    return this.loadConfig();
  }

  getKB(id: string): KnowledgeBase {
    if (!this.instances.has(id)) {
      const configs = this.loadConfig();
      const cfg = configs.find(c => c.id === id);
      if (!cfg) throw new Error(`知识库 ${id} 不存在`);
      const kbDir = this.kbDir(id);
      this.instances.set(id, new KnowledgeBase(id, path.join(kbDir, 'docs'), path.join(kbDir, 'vectors.json')));
    }
    return this.instances.get(id)!;
  }

  create(name: string, description: string = ''): KBConfig {
    const configs = this.loadConfig();
    if (configs.some(c => c.name === name)) {
      throw new Error(`知识库 "${name}" 已存在`);
    }
    const id = 'kb-' + Date.now();
    const now = new Date().toISOString();
    const entry: KBConfig = { id, name, description, createdAt: now, docCount: 0 };
    configs.push(entry);
    this.saveConfig(configs);
    fs.mkdirSync(path.join(this.kbDir(id), 'docs'), { recursive: true });
    return entry;
  }

  rename(id: string, name: string, description?: string): KBConfig {
    const configs = this.loadConfig();
    const entry = configs.find(c => c.id === id);
    if (!entry) throw new Error(`知识库 ${id} 不存在`);
    if (name) entry.name = name;
    if (description !== undefined) entry.description = description;
    this.saveConfig(configs);
    this.instances.delete(id);
    return entry;
  }

  delete(id: string): void {
    const configs = this.loadConfig();
    const idx = configs.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`知识库 ${id} 不存在`);
    configs.splice(idx, 1);
    this.saveConfig(configs);
    this.instances.delete(id);
    const dir = this.kbDir(id);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async retrieve(query: string, kbIds: string[], topK: number = 2): Promise<string> {
    const results = await Promise.all(
      kbIds.map(async (id) => {
        try {
          const kb = this.getKB(id);
          return await kb.retrieve(query, topK);
        } catch {
          return '';
        }
      })
    );
    return results.filter(r => r).join('\n\n');
  }

  async indexOne(id: string): Promise<void> {
    const kb = this.getKB(id);
    await kb.indexDocuments();
    const configs = this.loadConfig();
    const entry = configs.find(c => c.id === id);
    if (entry) {
      entry.docCount = kb.getDocCount();
      this.saveConfig(configs);
    }
  }

  async indexAll(): Promise<void> {
    for (const cfg of this.list()) {
      await this.indexOne(cfg.id);
    }
  }

  private loadConfig(): KBConfig[] {
    if (!fs.existsSync(this.configPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private saveConfig(configs: KBConfig[]): void {
    fs.writeFileSync(this.configPath, JSON.stringify(configs, null, 2), 'utf-8');
  }

  private kbDir(id: string): string {
    return path.join(this.baseDir, id);
  }

  private migrateLegacy(): void {
    const legacyDocs = path.resolve('.agent/docs');
    const legacyVectors = path.resolve('.agent/knowledge-vectors.json');
    const configPath = this.configPath;
    if (fs.existsSync(configPath)) return;
    if (!fs.existsSync(legacyDocs)) return;
    const configs = this.loadConfig();
    if (configs.length > 0) return;
    const id = 'kb-default';
    const now = new Date().toISOString();
    const entry: KBConfig = { id, name: '默认知识库', description: '从旧版本迁移', createdAt: now, docCount: 0 };
    configs.push(entry);
    this.saveConfig(configs);
    const targetDir = path.join(this.kbDir(id), 'docs');
    fs.mkdirSync(targetDir, { recursive: true });
    if (fs.existsSync(legacyDocs)) {
      const files = fs.readdirSync(legacyDocs);
      for (const f of files) {
        const src = path.join(legacyDocs, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(targetDir, f));
        }
      }
    }
    if (fs.existsSync(legacyVectors)) {
      const vectorsDir = this.kbDir(id);
      fs.copyFileSync(legacyVectors, path.join(vectorsDir, 'vectors.json'));
      fs.unlinkSync(legacyVectors);
    }
    console.log('已迁移旧版知识库到多知识库格式');
  }
}
