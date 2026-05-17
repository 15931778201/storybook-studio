import fs from 'fs';
import path from 'path';
import { ParsedSkill, SkillStep, SkillMetadata } from '../types/skill';
import { VectorStore, VectorDocument } from '../vector/vector-store';
import { generateEmbeddings, generateSingleEmbedding } from '../vector/embeddings';

export class SkillManager {
  private skillsDir: string;
  private vectorStore: VectorStore;

  /** 🔥 改为元数据缓存，不再全量加载技能内容 */
  private metaCache: Map<string, SkillMetadata> = new Map();
  /** 向量索引是否已建立 */
  private indexed = false;

  constructor(baseDir: string = '.agent/skills', vectorStore: VectorStore) {
    this.skillsDir = path.resolve(process.cwd(), baseDir);
    this.vectorStore = vectorStore;
    fs.mkdirSync(this.skillsDir, { recursive: true });
    this.refreshMetaCache();
  }

  /** 只扫描文件名和 front matter，不解析步骤 */
  private refreshMetaCache(): void {
    this.metaCache.clear();
    if (!fs.existsSync(this.skillsDir)) return;

    const files = fs.readdirSync(this.skillsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const meta = this.parseMetadataOnly(file);
      if (meta) {
        this.metaCache.set(meta.name, meta);
      }
    }
    console.log(`📋 已扫描 ${this.metaCache.size} 个技能元数据（未加载内容）`);
  }

  /** 只解析 front matter，不解析步骤 */
  private parseMetadataOnly(filename: string): SkillMetadata | null {
    try {
      const filePath = path.join(this.skillsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) {
        return {
          name: filename.replace('.md', ''),
          title: filename.replace('.md', ''),
          description: '',
          version: '1.0.0',
          author: 'unknown',
          tags: [],
          createdAt: '',
          updatedAt: '',
        };
      }

      const metaLines = fmMatch[1].split('\n');
      const meta: any = {};
      for (const line of metaLines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          meta[key] = value;
        }
      }

      return {
        name: meta.name || filename.replace('.md', ''),
        title: meta.title || meta.name || '',
        description: meta.description || '',
        version: meta.version || '1.0.0',
        author: meta.author || 'unknown',
        tags: meta.tags ? meta.tags.split(',').map((t: string) => t.trim()) : [],
        createdAt: meta.createdAt || '',
        updatedAt: meta.updatedAt || '',
      };
    } catch {
      return null;
    }
  }

  /** 🔥 按需加载完整技能（包含步骤） */
  private loadFullSkill(name: string): ParsedSkill | null {
    const filePath = path.join(this.skillsDir, `${name}.md`);
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseSkillContent(content, name);
  }

  /** 解析完整技能内容（保留原有逻辑） */
  parseSkillContent(content: string, source: string = 'inline'): ParsedSkill | null {
    try {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const meta: any = {};
      if (fmMatch) {
        const metaLines = fmMatch[1].split('\n');
        for (const line of metaLines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            meta[key] = value;
          }
        }
      }

      const stepsContent = fmMatch ? fmMatch[2] : content;
      const steps = this.parseStepsFromMarkdown(stepsContent);

      return {
        metadata: {
          name: meta.name || source,
          title: meta.title || source,
          description: meta.description || '',
          version: meta.version || '1.0.0',
          author: meta.author || 'unknown',
          tags: meta.tags ? meta.tags.split(',').map((t: string) => t.trim()) : [],
          createdAt: meta.createdAt || '',
          updatedAt: meta.updatedAt || new Date().toISOString(),
        },
        steps,
        raw: content,
      };
    } catch (e) {
      console.error('解析技能内容失败:', e);
      return null;
    }
  }

  /** 从 Markdown 解析步骤（保留原有逻辑） */
  private parseStepsFromMarkdown(content: string): SkillStep[] {
    const steps: SkillStep[] = [];
    const listRegex = /^-\s+(\w+):\s*(.+)$/gm;
    let match;
    let order = 1;
    while ((match = listRegex.exec(content)) !== null) {
      const tool = match[1];
      const paramsStr = match[2].trim();
      steps.push({
        id: `step-${order}`,
        order,
        tool,
        params: this.parseJsonSafe(paramsStr),
        description: '',
      });
      order++;
    }
    return steps;
  }

  private parseJsonSafe(str: string): Record<string, any> {
    try { return JSON.parse(str); } catch { return { raw: str }; }
  }

  // ── 外部接口 ──

  /** 获取技能元数据（不加载内容） */
  getSkillMeta(name: string): SkillMetadata | null {
    return this.metaCache.get(name) || null;
  }

  /** 🔥 获取完整技能（按需加载） */
  getSkill(name: string): ParsedSkill | null {
    return this.loadFullSkill(name);
  }

  /** 列出所有技能（仅元数据） */
  listSkills(): ParsedSkill[] {
    return Array.from(this.metaCache.values()).map(meta => ({
      metadata: meta,
      steps: [],
      raw: '',
    }));
  }

  /** 搜索技能（基于元数据文本匹配） */
  searchSkills(query: string): ParsedSkill[] {
    const lower = query.toLowerCase();
    return this.listSkills().filter(s =>
      s.metadata.name.includes(lower) ||
      s.metadata.title.includes(lower) ||
      s.metadata.description.includes(lower) ||
      s.metadata.tags.some(t => t.includes(lower))
    );
  }

  // ── 向量检索（按需建立索引） ──

  /** 🔥 按需检索：先建立或更新索引，再检索 */
  async searchRelevantSkills(query: string, topK: number = 3): Promise<string> {
    if (process.env.DISABLE_VECTOR_SEARCH === 'true') return '';
    if (this.metaCache.size === 0) return '';

    try {
      // 首次检索时建立索引
      if (!this.indexed) {
        await this.buildIndex();
      }

      const queryEmbedding = await generateSingleEmbedding(query);
      if (!queryEmbedding || queryEmbedding.length === 0) return '';

      const results = await this.vectorStore.similaritySearch(queryEmbedding, topK);
      if (results.length === 0) return '';

      const snippets = results.map(r => `[${r.metadata.skillName}] ${r.content}`);
      return `📚 相关技能上下文：\n${snippets.join('\n')}`;
    } catch (e) {
      console.warn('技能检索失败:', e);
      return '';
    }
  }

  /** 建立向量索引（按需加载每个技能内容） */
  private async buildIndex(): Promise<void> {
    console.log('🔨 正在建立技能向量索引...');
    for (const name of this.metaCache.keys()) {
      const skill = this.loadFullSkill(name);
      if (skill) {
        await this.indexSkill(skill);
      }
    }
    this.indexed = true;
    console.log('✅ 技能向量索引建立完成');
  }

  /** 索引单个技能 */
  private async indexSkill(skill: ParsedSkill): Promise<void> {
    const docs: VectorDocument[] = [];
    const texts: string[] = [];

    const overviewText = `技能: ${skill.metadata.title}\n描述: ${skill.metadata.description}`;
    texts.push(overviewText);
    docs.push({
      id: `${skill.metadata.name}-overview`,
      content: overviewText,
      metadata: { skillName: skill.metadata.name, type: 'overview' },
    });

    for (const step of skill.steps) {
      const stepText = `步骤${step.order}: ${step.description} 工具: ${step.tool} 参数: ${JSON.stringify(step.params)}`;
      texts.push(stepText);
      docs.push({
        id: `${skill.metadata.name}-step-${step.order}`,
        content: stepText,
        metadata: { skillName: skill.metadata.name, type: 'step', stepId: step.id },
      });
    }

    const embeddings = await generateEmbeddings(texts);
    await this.vectorStore.addDocuments(docs, embeddings);
  }

  /** 重新索引（安装新技能后调用） */
  async reindex(): Promise<void> {
    this.indexed = false;
    await this.buildIndex();
  }

  // ── 写操作（保持原有，但改完后刷新元数据缓存和索引） ──

  createSkill(name: string, title: string, description: string, steps: SkillStep[], tags: string[] = []): ParsedSkill | null {
    const skill: ParsedSkill = {
      metadata: {
        name, title, description,
        version: '1.0.0', author: 'agent', tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      steps,
      raw: '',
    };
    const content = this.skillToMarkdown(skill);
    const filePath = path.join(this.skillsDir, `${name}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    this.metaCache.set(name, skill.metadata);
    this.indexed = false; // 标记需要重建索引
    return skill;
  }

  deleteSkill(name: string): boolean {
    const filePath = path.join(this.skillsDir, `${name}.md`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.metaCache.delete(name);
    this.indexed = false;
    return true;
  }

  importSkill(rawContent: string, overwrite: boolean = false): ParsedSkill | null {
    const parsed = this.parseSkillContent(rawContent);
    if (!parsed) return null;

    const filePath = path.join(this.skillsDir, `${parsed.metadata.name}.md`);
    const exists = fs.existsSync(filePath);

    if (exists && !overwrite) return null;

    fs.writeFileSync(filePath, rawContent, 'utf-8');
    this.metaCache.set(parsed.metadata.name, parsed.metadata);
    this.indexed = false;
    return parsed;
  }

  updateSkill(name: string, updates: Partial<SkillMetadata> & { steps?: SkillStep[] }): ParsedSkill | null {
    const skill = this.loadFullSkill(name);
    if (!skill) return null;

    if (updates.steps) skill.steps = updates.steps;
    Object.assign(skill.metadata, { ...updates, updatedAt: new Date().toISOString() });
    delete (skill.metadata as any).steps;

    const content = this.skillToMarkdown(skill);
    const filePath = path.join(this.skillsDir, `${name}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    this.metaCache.set(name, skill.metadata);
    this.indexed = false;
    return skill;
  }

  skillToMarkdown(skill: ParsedSkill): string {
    const meta = skill.metadata;
    let md = '---\n';
    md += `name: ${meta.name}\n`;
    md += `title: ${meta.title}\n`;
    md += `description: ${meta.description}\n`;
    md += `version: ${meta.version}\n`;
    md += `author: ${meta.author}\n`;
    md += `tags: ${meta.tags.join(', ')}\n`;
    md += `createdAt: ${meta.createdAt}\n`;
    md += `updatedAt: ${meta.updatedAt}\n`;
    md += '---\n\n';

    if (skill.steps.length > 0) {
      for (const step of skill.steps) {
        md += `- ${step.tool}: ${JSON.stringify(step.params)}\n`;
      }
    }
    return md;
  }

  /**
   * 执行技能的热重载操作
   * 该方法会重新扫描目录并重建向量索引，以实现技能的热更新
   * @returns {Promise<void>} 返回一个空Promise，表示异步操作完成
   */
  async hotReload(): Promise<void> {
    console.log('🔄 热重载技能...');  // 输出开始热重载的日志信息
    this.refreshMetaCache();  // 重新扫描目录，更新元数据缓存
    this.indexed = false;     // 重建向量索引（下次检索时触发）
    console.log('✅ 技能已热更新');
  }
}