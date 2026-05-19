import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { Tool, safeExecute } from '../core/tool';
import { cache } from '../utils/cache';
import { resolveWorkspacePath, resolveWorkspaceRoot, WorkspaceToolOptions } from './workspace';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.agent', '.worktrees']);

export class FileTreeSummaryTool extends Tool {
  name = 'file_tree_summary';
  description = '输出当前工作区的目录树摘要，适合快速理解项目结构';
  parameters = z.object({
    path: z.string().optional().default('.').describe('要扫描的相对路径'),
    maxDepth: z.coerce.number().int().min(1).max(8).optional().default(3),
    maxEntries: z.coerce.number().int().min(10).max(500).optional().default(160),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  protected async executeCore(validatedParams: unknown) {
    const { path: targetPath, maxDepth, maxEntries } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const workspaceRoot = resolveWorkspaceRoot(this.options.workspaceRoot);
      const root = resolveWorkspacePath(workspaceRoot, targetPath);
      const cacheKey = `file-tree:${workspaceRoot}:${targetPath}:${maxDepth}:${maxEntries}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return { success: true, output: cached.output, metadata: { cacheHit: true } };
      }

      const lines: string[] = [];
      const counter = { value: 0 };
      walkTree(root, workspaceRoot, maxDepth, maxEntries, lines, counter);

      const output = [
        `Workspace: ${workspaceRoot}`,
        `Tree path: ${targetPath}`,
        lines.join('\n') || '(empty)',
      ].join('\n\n');

      cache.set(cacheKey, { output }, 300_000);
      return { success: true, output, metadata: { cacheHit: false, entries: counter.value } };
    });
  }
}

function walkTree(
  currentPath: string,
  workspaceRoot: string,
  maxDepth: number,
  maxEntries: number,
  lines: string[],
  counter: { value: number },
  depth = 0,
) {
  if (depth > maxDepth || counter.value >= maxEntries) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (counter.value >= maxEntries) return;
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(workspaceRoot, fullPath);
    lines.push(`${'  '.repeat(depth)}- ${relativePath}${entry.isDirectory() ? '/' : ''}`);
    counter.value += 1;

    if (entry.isDirectory()) {
      walkTree(fullPath, workspaceRoot, maxDepth, maxEntries, lines, counter, depth + 1);
    }
  }
}
