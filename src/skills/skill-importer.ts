import { SkillManager } from './skill-manager';
import type { ImportResult, ImportSourceType } from '../types/skill';
import AdmZip from 'adm-zip';

export class SkillImporter {
  constructor(private skillManager: SkillManager) {}

  detectSourceType(url: string): ImportSourceType {
    if (/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url)) return 'github';
    if (/^https?:\/\/clawhub\.ai\/skills\/[\w.-]+/.test(url)) return 'clawhub';
    if (url.startsWith('http://') || url.startsWith('https://')) return 'direct';
    return 'unknown';
  }

  async importFromUrl(url: string, force: boolean = false): Promise<ImportResult[]> {
    const sourceType = this.detectSourceType(url);
    if (sourceType === 'unknown') {
      return [{ name: 'unknown', title: 'unknown', success: false, overwritten: false, reason: 'unknown', error: '无法识别的 URL 格式' }];
    }

    let content: string;
    try {
      content = sourceType === 'github' ? await this.downloadFromGitHub(url) : await this.fetchUrl(url);
    } catch (e: any) {
      return [{ name: 'unknown', title: 'unknown', success: false, overwritten: false, reason: 'download_error', error: `下载失败: ${e.message}` }];
    }

    const result = await this.installSingleSkill(content, force);
    return [result];
  }

  async importFromZip(buffer: Buffer, force: boolean = false): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    let zip: AdmZip;

    try {
      zip = new AdmZip(buffer);
    } catch (e: any) {
      return [{ name: 'unknown', title: 'unknown', success: false, overwritten: false, reason: 'zip_error', error: `ZIP 解析失败: ${e.message}` }];
    }

    const entries = zip.getEntries();
    const mdEntries = entries.filter((e: any) =>
      !e.isDirectory &&
      e.entryName.endsWith('.md') &&
      (e.entryName.startsWith('skills/') || !e.entryName.includes('/'))
    );

    if (mdEntries.length === 0) {
      return [{ name: 'unknown', title: 'unknown', success: false, overwritten: false, reason: 'zip_error', error: 'ZIP 中未找到技能文件（需 .md 文件，支持 skills/ 目录或根目录）' }];
    }

    for (const entry of mdEntries) {
      const content = entry.getData().toString('utf-8');
      const result = await this.installSingleSkill(content, force);
      results.push(result);
    }

    return results;
  }

  private async downloadFromGitHub(url: string): Promise<string> {
    const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!match) throw new Error('无效的 GitHub URL');

    const [, owner, repo] = match;
    let branch = 'main';

    if (url.includes('/tree/')) {
      const afterTree = url.split('/tree/')[1];
      branch = afterTree.split('/')[0];
    }

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skill.md`;
    return this.fetchUrl(rawUrl);
  }

  private async fetchUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  }

  private async installSingleSkill(raw: string, force: boolean): Promise<ImportResult> {
    const parsed = this.skillManager.parseSkillContent(raw);
    if (!parsed) {
      return { name: 'unknown', title: 'unknown', success: false, overwritten: false, reason: 'parse_error', error: '技能格式无效：无法解析 YAML front matter 或步骤' };
    }

    const name = parsed.metadata.name;
    const title = parsed.metadata.title;
    const existing = this.skillManager.getSkillMeta(name);

    if (existing && !force) {
      return { name, title, success: false, overwritten: false, reason: 'duplicate', error: '技能已存在' };
    }

    try {
      const result = this.skillManager.importSkill(raw, force);
      if (!result) {
        return { name, title, success: false, overwritten: false, reason: 'save_error', error: '安装失败: 保存文件失败' };
      }
      return { name, title, success: true, overwritten: !!existing };
    } catch (e: any) {
      return { name, title, success: false, overwritten: false, reason: 'save_error', error: `安装失败: ${e.message}` };
    }
  }
}
