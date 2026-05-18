export interface ParsedDiffView {
  filePath: string;
  original: string;
  modified: string;
  additions: number;
  deletions: number;
  language: string;
  raw: string;
  isEmpty: boolean;
}

type ToolArgs = Record<string, unknown> | undefined | null;

const extensionLanguages: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  dockerfile: 'dockerfile',
};

export function parseUnifiedDiff(diff: string, args?: ToolArgs): ParsedDiffView {
  const raw = diff ?? '';
  const trimmed = raw.trim();
  const original: string[] = [];
  const modified: string[] = [];
  let filePath = extractPathFromArgs(args);
  let additions = 0;
  let deletions = 0;

  for (const line of raw.split('\n')) {
    if (line.startsWith('+++ ')) {
      filePath = cleanDiffPath(line.slice(4)) || filePath;
      continue;
    }
    if (line.startsWith('--- ')) {
      if (!filePath) filePath = cleanDiffPath(line.slice(4));
      continue;
    }
    if (
      line.startsWith('diff --git ') ||
      line.startsWith('index ') ||
      line.startsWith('new file mode ') ||
      line.startsWith('deleted file mode ') ||
      line.startsWith('similarity index ') ||
      line.startsWith('rename from ') ||
      line.startsWith('rename to ') ||
      line.startsWith('@@')
    ) {
      continue;
    }

    if (line.startsWith('+')) {
      modified.push(line.slice(1));
      additions += 1;
      continue;
    }

    if (line.startsWith('-')) {
      original.push(line.slice(1));
      deletions += 1;
      continue;
    }

    const contextLine = line.startsWith(' ') ? line.slice(1) : line;
    original.push(contextLine);
    modified.push(contextLine);
  }

  filePath = filePath || '未命名文件';

  return {
    filePath,
    original: trimTrailingBlankLines(original).join('\n'),
    modified: trimTrailingBlankLines(modified).join('\n'),
    additions,
    deletions,
    language: detectLanguage(filePath),
    raw,
    isEmpty: trimmed.length === 0,
  };
}

function extractPathFromArgs(args: ToolArgs): string {
  if (!args) return '';
  const candidates = ['filePath', 'path', 'targetPath', 'relativePath'];
  for (const key of candidates) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function cleanDiffPath(path: string): string {
  const clean = path.trim().split('\t')[0];
  if (!clean || clean === '/dev/null') return '';
  return clean.replace(/^[ab]\//, '');
}

function detectLanguage(filePath: string): string {
  const basename = filePath.split('/').pop()?.toLowerCase() || '';
  if (basename === 'dockerfile' || basename.endsWith('.dockerfile')) return 'dockerfile';
  const extension = basename.split('.').pop() || '';
  return extensionLanguages[extension] || 'plaintext';
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const next = [...lines];
  while (next.length > 0 && next[next.length - 1] === '') {
    next.pop();
  }
  return next;
}