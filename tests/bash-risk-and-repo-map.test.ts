import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BashTool } from '../src/tools/bash';
import { RepoMapTool } from '../src/tools/repo-map';

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-repo-map-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('bash risk and repo map', () => {
  it('marks destructive bash commands as high risk', async () => {
    const result = await new BashTool().execute({ command: 'echo ok && rm -rf /tmp/not-real-agent-test' });

    expect(result.success).toBe(true);
    expect(result.metadata?.riskLevel).toBe('high');
    expect(result.metadata?.requiresConfirmation).toBe(true);
  });

  it('caches repo map output for the same workspace scan', async () => {
    const workspaceRoot = makeTempDir();
    fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf-8');
    fs.mkdirSync(path.join(workspaceRoot, 'src'));
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf-8');

    const tool = new RepoMapTool({ workspaceRoot });
    const first = await tool.execute({ path: '.', maxFiles: 20 });
    const second = await tool.execute({ path: '.', maxFiles: 20 });

    expect(first.success).toBe(true);
    expect(first.output).toContain(`Workspace: ${workspaceRoot}`);
    expect(first.metadata?.cacheHit).toBe(false);
    expect(second.metadata?.cacheHit).toBe(true);
  });
});
