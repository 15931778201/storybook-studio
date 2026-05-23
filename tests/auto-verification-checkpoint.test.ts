import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runCheckpointedVerification } from '../src/core/auto-verification';

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-verification-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('verification checkpoint', () => {
  it('resumes from the first unfinished command instead of re-running completed commands', async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, '.agent'), { recursive: true });
    const executed: string[] = [];

    const result = await runCheckpointedVerification(
      ['cmd-1', 'cmd-2'],
      async (command) => {
        executed.push(command);
        return {
          success: true,
          output: `$ ${command}\nok`,
        };
      },
      {
        sessionId: 'resume-verification',
        checkpointPath: path.join(dir, '.agent', 'verification-checkpoints.json'),
        resumeFrom: {
          commands: ['cmd-1', 'cmd-2'],
          completed: 1,
          outputs: ['$ cmd-1\nok'],
        },
      },
    );

    expect(executed).toEqual(['cmd-2']);
    expect(result.passed).toBe(true);
    expect(result.output).toContain('$ cmd-1');
    expect(result.output).toContain('$ cmd-2');
  });
});
