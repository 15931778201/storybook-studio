import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { z } from 'zod';
import { Tool, safeExecute, ToolResult } from '../core/tool';
import { resolveWorkspacePath, resolveWorkspaceRoot, WorkspaceToolOptions } from './workspace';
import { cache } from '../utils/cache';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.agent', '.worktrees']);

export class RepoMapTool extends Tool {
  name = 'repo_map';
  description = '生成当前工作区的轻量文件树和关键项目文件摘要';
  parameters = z.object({
    path: z.string().optional().default('.').describe('要扫描的工作区相对路径'),
    maxFiles: z.coerce.number().int().min(1).max(300).optional().default(120).describe('要扫描的最大文件数'),
    maxDepth: z.coerce.number().int().min(1).max(8).optional().default(4).describe('要扫描的最大目录深度'),
  });

  constructor(private options: WorkspaceToolOptions = {}) { super(); }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { path: scanPath, maxFiles, maxDepth } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const workspaceRoot = resolveWorkspaceRoot(this.options.workspaceRoot);
      const root = resolveWorkspacePath(workspaceRoot, scanPath);
      const cacheKey = `repo-map:${workspaceRoot}:${scanPath}:${maxFiles}:${maxDepth}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return { success: true, output: cached.output, metadata: { cacheHit: true } };
      }

      const files: string[] = [];
      walk(root, workspaceRoot, maxDepth, maxFiles, files);

      const keyFiles = files.filter((file) =>
        /(^|\/)(package\.json|tsconfig\.json|README\.md|Dockerfile|docker-compose\.yml|vite\.config\.ts)$/.test(file)
      );
      const recentCommits = readRecentCommits(workspaceRoot);
      const output = [
        `Workspace: ${workspaceRoot}`,
        keyFiles.length ? `Key files:\n${keyFiles.map((f) => `- ${f}`).join('\n')}` : 'Key files: none found',
        recentCommits.length ? `Recent commits:\n${recentCommits.map((line) => `- ${line}`).join('\n')}` : 'Recent commits: none found',
        `Files (${files.length}${files.length >= maxFiles ? '+' : ''}):\n${files.map((f) => `- ${f}`).join('\n')}`,
      ].join('\n\n');

      cache.set(cacheKey, { output }, 60_000);
      return { success: true, output, metadata: { cacheHit: false } };
    }, { timeout: 10000, maxOutput: 12000 });
  }
}

function readRecentCommits(workspaceRoot: string): string[] {
  try {
    const stdout = execFileSync('git', ['log', '--oneline', '-3'], {
      cwd: workspaceRoot,
      timeout: 5000,
      encoding: 'utf-8',
    });
    return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function walk(current: string, workspaceRoot: string, maxDepth: number, maxFiles: number, files: string[], depth = 0) {
  if (depth > maxDepth || files.length >= maxFiles) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (files.length >= maxFiles) break;
    if (entry.name.startsWith('.') && !['.env.example'].includes(entry.name)) continue;
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(current, entry.name);
    const relative = path.relative(workspaceRoot, fullPath);
    if (entry.isDirectory()) {
      walk(fullPath, workspaceRoot, maxDepth, maxFiles, files, depth + 1);
    } else {
      files.push(relative);
    }
  }
}
