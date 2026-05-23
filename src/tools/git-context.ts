import { execFileSync } from 'child_process';
import { z } from 'zod';
import { Tool, safeExecute } from '../core/tool';
import { cache } from '../utils/cache';
import { resolveWorkspaceRoot, WorkspaceToolOptions } from './workspace';

export class GitContextTool extends Tool {
  name = 'git_context';
  description = '获取最近提交和最近 diff 摘要，帮助理解代码近期变化';
  parameters = z.object({
    commits: z.coerce.number().int().min(1).max(20).optional().default(5),
    diffLines: z.coerce.number().int().min(20).max(400).optional().default(120),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  protected async executeCore(validatedParams: unknown) {
    const { commits, diffLines } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const workspaceRoot = resolveWorkspaceRoot(this.options.workspaceRoot);
      if (!isGitRepository(workspaceRoot)) {
        const output = [
          `Workspace: ${workspaceRoot}`,
          'Recent commits: none',
          'Diff stat: none',
          'Diff preview: none',
        ].join('\n\n');
        return { success: true, output, metadata: { cacheHit: false, git: false } };
      }

      const cacheKey = `git-context:${workspaceRoot}:${commits}:${diffLines}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return { success: true, output: cached.output, metadata: { cacheHit: true } };
      }

      const recentCommits = runGit(workspaceRoot, ['log', '--oneline', `-${commits}`]);
      const recentDiff = runGit(workspaceRoot, ['diff', '--stat', `--max-count=${commits}`]) || runGit(workspaceRoot, ['diff', '--stat']);
      const unstagedPreview = runGit(workspaceRoot, ['diff', '--', '.']).split('\n').slice(0, diffLines).join('\n');

      const output = [
        `Workspace: ${workspaceRoot}`,
        recentCommits ? `Recent commits:\n${recentCommits}` : 'Recent commits: none',
        recentDiff ? `Diff stat:\n${recentDiff}` : 'Diff stat: none',
        unstagedPreview ? `Diff preview:\n${unstagedPreview}` : 'Diff preview: none',
      ].join('\n\n');

      cache.set(cacheKey, { output }, 60_000);
      return { success: true, output, metadata: { cacheHit: false } };
    });
  }
}

function runGit(cwd: string, args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd,
      timeout: 5000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch {
    return '';
  }
}

function isGitRepository(cwd: string) {
  try {
    const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      timeout: 3000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output === 'true';
  } catch {
    return false;
  }
}
