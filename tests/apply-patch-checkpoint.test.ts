import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ApplyPatchTool } from '../src/tools/apply-patch';

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-apply-patch-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('apply patch checkpoint', () => {
  it('resumes from the first unfinished hunk', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'demo.ts');
    fs.writeFileSync(filePath, 'alpha\nbeta\ngamma\n', 'utf-8');

    const tool = new ApplyPatchTool({ workspaceRoot: dir });
    const result = await tool.execute({
      patches: [
        { filePath: 'demo.ts', search: 'alpha', replace: 'ALPHA' },
        { filePath: 'demo.ts', search: 'beta', replace: 'BETA' },
      ],
      checkpoint: {
        completedHunks: 1,
        patches: [
          { filePath: 'demo.ts', search: 'alpha', replace: 'ALPHA' },
          { filePath: 'demo.ts', search: 'beta', replace: 'BETA' },
        ],
      },
    } as any);

    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('alpha\nBETA\ngamma\n');
    expect(result.metadata?.checkpoint?.completedHunks).toBe(2);
  });
});
