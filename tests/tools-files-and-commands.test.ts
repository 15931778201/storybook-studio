import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ArchiveTool,
  ApplyPatchTool,
  BashTool,
  EditFileTool,
  GitTool,
  GlobTool,
  GrepTool,
  JsonQueryTool,
  ReadFileTool,
  WriteFileTool,
} from '../src/tools';

const originalCwd = process.cwd();
const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-tools-'));
  tempDirs.push(dir);
  return dir;
}

async function withTempCwd<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, '.agent'), { recursive: true });
  process.chdir(dir);
  try {
    return await fn(dir);
  } finally {
    process.chdir(originalCwd);
  }
}

afterEach(() => {
  process.chdir(originalCwd);
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('file and command tools', () => {
  it('ReadFileTool reads the requested line window', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'notes.txt');
    fs.writeFileSync(filePath, 'first\nsecond\nthird', 'utf-8');

    const result = await new ReadFileTool().execute({ filePath, offset: 1, limit: 1 });

    expect(result.success).toBe(true);
    expect(result.output).toBe('second');
  });

  it('WriteFileTool writes content and records audit metadata', async () => {
    await withTempCwd(async (dir) => {
      const result = await new WriteFileTool().execute({
        filePath: 'created.txt',
        content: 'hello world',
      });

      expect(result.success).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'created.txt'), 'utf-8')).toBe('hello world');
      expect(fs.existsSync(path.join(dir, '.agent/audit.jsonl'))).toBe(true);
    });
  });

  it('WriteFileTool refuses to overwrite an existing file and asks callers to use apply_patch', async () => {
    await withTempCwd(async (dir) => {
      fs.writeFileSync(path.join(dir, 'existing.txt'), 'before', 'utf-8');

      const result = await new WriteFileTool().execute({
        filePath: 'existing.txt',
        content: 'after',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('apply_patch');
      expect(fs.readFileSync(path.join(dir, 'existing.txt'), 'utf-8')).toBe('before');
    });
  });

  it('EditFileTool delegates to apply_patch and returns unified patch metadata', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'edit.txt');
    fs.writeFileSync(filePath, 'alpha beta alpha', 'utf-8');

    const result = await new EditFileTool().execute({
      filePath,
      search: 'alpha',
      replace: 'omega',
    });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('omega beta omega');
    expect(result.metadata?.writeProtocol).toBe('apply_patch');
    expect(result.metadata?.changedFiles).toEqual([filePath]);
    expect(typeof result.metadata?.diff).toBe('string');
  });

  it('ApplyPatchTool returns conflict metadata and rollback details when a later patch fails', async () => {
    await withTempCwd(async (dir) => {
      fs.writeFileSync(path.join(dir, 'a.ts'), 'export const a = 1;\n', 'utf-8');
      fs.writeFileSync(path.join(dir, 'b.ts'), 'export const b = true;\n', 'utf-8');

      const result = await new ApplyPatchTool().execute({
        patches: [
          {
            filePath: 'a.ts',
            search: 'export const a = 1;',
            replace: 'export const a = 2;',
          },
          {
            filePath: 'b.ts',
            search: 'export const missing = true;',
            replace: 'export const b = false;',
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('未找到匹配内容');
      expect(result.metadata?.conflict?.filePath).toBe('b.ts');
      expect(result.metadata?.rollbackPerformed).toBe(true);
      expect(result.metadata?.rolledBackFiles).toEqual(['a.ts']);
      expect(fs.readFileSync(path.join(dir, 'a.ts'), 'utf-8')).toContain('export const a = 1;');
    });
  });

  it('ApplyPatchTool reports context conflicts separately from missing search text', async () => {
    await withTempCwd(async (dir) => {
      fs.writeFileSync(path.join(dir, 'ctx.ts'), 'header\nconst value = 1;\nfooter\n', 'utf-8');

      const result = await new ApplyPatchTool().execute({
        patches: [
          {
            filePath: 'ctx.ts',
            search: 'const value = 1;',
            replace: 'const value = 2;',
            beforeContext: 'different header',
            afterContext: 'footer',
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.metadata?.conflict?.reason).toBe('上下文冲突');
      expect(result.metadata?.rollbackPerformed).toBe(false);
      expect(fs.readFileSync(path.join(dir, 'ctx.ts'), 'utf-8')).toBe('header\nconst value = 1;\nfooter\n');
    });
  });

  it('BashTool executes a command with shell support (pipes, redirects, stderr)', async () => {
    const result = await new BashTool().execute({
      command: `${process.execPath} -e "console.log('tool-ok')"`,
    });

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('tool-ok');
  });

  it('BashTool supports legacy args array (backward compat)', async () => {
    const result = await new BashTool().execute({
      command: process.execPath,
      args: ['-e', "console.log('args-ok')"],
    });

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('args-ok');
  });

  it('BashTool returns non-zero exit code in output (not a failure)', async () => {
    const result = await new BashTool().execute({
      command: 'sh -c "exit 42"',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('退出码 42');
  });

  it('BashTool supports pipes and redirects', async () => {
    const result = await new BashTool().execute({
      command: "echo 'hello world' | wc -w",
    });

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('2');
  });

  it('GrepTool returns matching file and line output', async () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'grep.txt'), 'needle\nother', 'utf-8');

    const result = await new GrepTool().execute({
      pattern: 'needle',
      path: dir,
      include: '*.txt',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('grep.txt:1:needle');
  });

  it('GlobTool finds files matching a pattern', async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.writeFileSync(path.join(dir, 'nested', 'match.tooltest'), 'ok', 'utf-8');

    const result = await new GlobTool().execute({
      pattern: '*.tooltest',
      path: dir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('match.tooltest');
  });

  it('JsonQueryTool returns the requested nested value', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'data.json');
    fs.writeFileSync(filePath, JSON.stringify({ users: [{ name: 'Ada' }] }), 'utf-8');

    const result = await new JsonQueryTool().execute({
      filePath,
      path: 'users[0].name',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('"Ada"');
  });

  it('GitTool runs an allowed git subcommand', async () => {
    const result = await new GitTool().execute({
      subcommand: 'status',
      args: ['--short', '--', 'src/tools/index.ts'],
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeString();
  });

  it('ArchiveTool compresses and decompresses a file', async () => {
    const dir = makeTempDir();
    const source = path.join(dir, 'source.txt');
    const zip = path.join(dir, 'archive.zip');
    const extracted = path.join(dir, 'out');
    fs.writeFileSync(source, 'archived content', 'utf-8');

    const compress = await new ArchiveTool().execute({
      action: 'compress',
      source,
      target: zip,
    });
    const decompress = await new ArchiveTool().execute({
      action: 'decompress',
      source: zip,
      target: extracted,
    });

    expect(compress.success).toBe(true);
    expect(decompress.success).toBe(true);
    expect(fs.readFileSync(path.join(extracted, 'source.txt'), 'utf-8')).toBe('archived content');
  });

  it('ApplyPatchTool updates multiple files from patch instructions', async () => {
    await withTempCwd(async (dir) => {
      fs.writeFileSync(path.join(dir, 'a.ts'), 'export const a = 1;\n', 'utf-8');
      fs.writeFileSync(path.join(dir, 'b.ts'), 'export const b = true;\n', 'utf-8');

      const result = await new ApplyPatchTool().execute({
        patches: [
          {
            filePath: 'a.ts',
            search: 'export const a = 1;',
            replace: 'export const a = 2;',
          },
          {
            filePath: 'b.ts',
            search: 'export const b = true;',
            replace: 'export const b = false;',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'a.ts'), 'utf-8')).toContain('export const a = 2;');
      expect(fs.readFileSync(path.join(dir, 'b.ts'), 'utf-8')).toContain('export const b = false;');
    });
  });
});
