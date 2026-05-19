import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentEventBus } from '../src/core/events';
import { DefaultStepPipeline } from '../src/core/default-step-pipeline';
import { ApplyPatchTool } from '../src/tools/apply-patch';
import { WriteFileTool } from '../src/tools/write-file';
import { EditFileTool } from '../src/tools/edit-file';

const originalCwd = process.cwd();
const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-write-protocol-'));
  tempDirs.push(dir);
  return dir;
}

class TestPipeline extends DefaultStepPipeline {
  async runToolCall(toolCall: any, messages: any[]) {
    return this.executeSingleToolCall(toolCall, messages);
  }

  protected async runVerification() {
    return {
      commands: ['CI=1 bun test'],
      passed: true,
      output: '$ CI=1 bun test\nok',
    };
  }
}

afterEach(() => {
  process.chdir(originalCwd);
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('DefaultStepPipeline write protocol', () => {
  it('promotes existing-file write_file calls to apply_patch and reports the patch tool in summary', async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, '.agent'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'demo.ts'), 'export const value = 1;\n', 'utf-8');
    process.chdir(dir);

    const pipeline = new TestPipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [new WriteFileTool({ workspaceRoot: '.' }), new ApplyPatchTool({ workspaceRoot: '.' })],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (messages: any) => messages, options: { maxTokens: 2000 } },
      policy: {
        options: { workspaceRoot: '.' },
        preExecute: async (_tool: any, params: any) => ({ allowed: true, needApproval: false, diff: params?.patches ? 'diff --git a/demo.ts b/demo.ts' : null }),
        postExecute: async () => {},
      },
      maxIterations: 1,
    }, 'write-protocol');

    const events: any[] = [];
    const bus = AgentEventBus.getInstance();
    const handler = (event: any) => events.push(event);
    bus.on('message-write-protocol', handler);

    try {
      await pipeline.runToolCall({
        id: 'write-1',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({
            filePath: 'demo.ts',
            content: 'export const value = 2;\n',
          }),
        },
      }, [{ role: 'user', content: 'update the file' }]);
    } finally {
      bus.off('message-write-protocol', handler);
    }

    expect(fs.readFileSync(path.join(dir, 'demo.ts'), 'utf-8')).toBe('export const value = 2;\n');
    const summary = events.find((event) => event.type === 'summary-ready');
    expect(summary.summary.changes).toEqual([
      {
        kind: 'initial',
        toolName: 'apply_patch',
        changedFiles: ['demo.ts'],
        diff: expect.any(String),
      },
    ]);
  });

  it('promotes edit_file calls to apply_patch and keeps summary on patch protocol', async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, '.agent'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'demo.ts'), 'export const value = 1;\n', 'utf-8');
    process.chdir(dir);

    const pipeline = new TestPipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [
        new WriteFileTool({ workspaceRoot: '.' }),
        new EditFileTool({ workspaceRoot: '.' }),
        new ApplyPatchTool({ workspaceRoot: '.' }),
      ],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (messages: any) => messages, options: { maxTokens: 2000 } },
      policy: {
        options: { workspaceRoot: '.' },
        preExecute: async (_tool: any, params: any) => ({ allowed: true, needApproval: false, diff: params?.patches ? 'diff --git a/demo.ts b/demo.ts' : null }),
        postExecute: async () => {},
      },
      maxIterations: 1,
    }, 'edit-protocol');

    const events: any[] = [];
    const bus = AgentEventBus.getInstance();
    const handler = (event: any) => events.push(event);
    bus.on('message-edit-protocol', handler);

    try {
      await pipeline.runToolCall({
        id: 'edit-1',
        type: 'function',
        function: {
          name: 'edit_file',
          arguments: JSON.stringify({
            filePath: 'demo.ts',
            search: 'value = 1',
            replace: 'value = 2',
          }),
        },
      }, [{ role: 'user', content: 'update the file' }]);
    } finally {
      bus.off('message-edit-protocol', handler);
    }

    expect(fs.readFileSync(path.join(dir, 'demo.ts'), 'utf-8')).toBe('export const value = 2;\n');
    const summary = events.find((event) => event.type === 'summary-ready');
    expect(summary.summary.changes).toEqual([
      {
        kind: 'initial',
        toolName: 'apply_patch',
        changedFiles: ['demo.ts'],
        diff: expect.any(String),
      },
    ]);
  });
});
