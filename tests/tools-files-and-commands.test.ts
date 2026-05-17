import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ArchiveTool,
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

  it('EditFileTool replaces matching text in a file', async () => {
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
});
