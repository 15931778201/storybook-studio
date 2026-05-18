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
      expect(names).toContain('call_skill');

      const repoMap = tools.find((tool: any) => tool.name === 'repo_map');
      const result = await repoMap.execute({ path: '.', maxFiles: 20 });

      expect(result.success).toBe(true);
      expect(result.output).toContain(`Workspace: ${workspaceRoot}`);
      expect(result.output).toContain('package.json');

      const cached = await repoMap.execute({ path: '.', maxFiles: 20 });
      expect(cached.metadata?.cacheHit).toBe(true);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
