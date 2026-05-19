import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildChatTools } from '../server/routes/chat';

describe('chat workspace tool wiring', () => {
  it('registers local code-assistant tools with workspace isolation', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-chat-workspace-'));
    try {
      fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf-8');
      const tools = buildChatTools(workspaceRoot);
      const names = tools.map((tool: any) => tool.name);

      expect(names).toContain('read_file');
      expect(names).toContain('write_file');
      expect(names).toContain('bash');
      expect(names).toContain('grep');
      expect(names).toContain('glob');
      expect(names).toContain('edit_file');
      expect(names).toContain('apply_patch');
      expect(names).toContain('json_query');
      expect(names).toContain('git');
      expect(names).toContain('repo_map');
      expect(names).toContain('file_tree_summary');
      expect(names).toContain('git_context');
      expect(names).toContain('ts_symbols');
      expect(names).toContain('call_skill');

      const repoMap = tools.find((tool: any) => tool.name === 'repo_map');
      const result = await repoMap.execute({ path: '.', maxFiles: 20 });

      expect(result.success).toBe(true);
      expect(result.output).toContain(`Workspace: ${workspaceRoot}`);
      expect(result.output).toContain('package.json');

      const cached = await repoMap.execute({ path: '.', maxFiles: 20 });
      expect(cached.metadata?.cacheHit).toBe(true);

      fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceRoot, 'src', 'index.ts'),
        [
          'export function greet(name: string) {',
          "  return `hello ${name}`;",
          '}',
          '',
          "console.log(greet('world'));",
        ].join('\n'),
        'utf-8',
      );

      const fileTree = tools.find((tool: any) => tool.name === 'file_tree_summary');
      const treeResult = await fileTree.execute({ path: '.', maxDepth: 2, maxEntries: 20 });
      expect(treeResult.success).toBe(true);
      expect(treeResult.output).toContain('src/');
      expect(treeResult.output).toContain('src/index.ts');

      const gitContext = tools.find((tool: any) => tool.name === 'git_context');
      const gitResult = await gitContext.execute({ commits: 1, diffLines: 40 });
      expect(gitResult.success).toBe(true);
      expect(gitResult.output).toContain(`Workspace: ${workspaceRoot}`);

      const tsSymbols = tools.find((tool: any) => tool.name === 'ts_symbols');
      const symbolResult = await tsSymbols.execute({ symbol: 'greet', mode: 'both' });
      expect(symbolResult.success).toBe(true);
      expect(symbolResult.output).toContain('[definition] src/index.ts:1');
      expect(symbolResult.output).toContain('[reference] src/index.ts:5');
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
