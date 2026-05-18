import type { ConfirmRequest } from '../types/confirm';

export type ConfirmFileChange = {
  filePath: string;
  changeType: 'added' | 'deleted' | 'modified';
  accepted: boolean;
};

export type ConfirmSummary = {
  total: number;
  accepted: number;
  added: number;
  deleted: number;
  modified: number;
};

export type ConfirmDecision = {
  approved: boolean;
  selectedFiles?: Record<string, boolean>;
};

export function buildConfirmPreview(toolName: string, args: Record<string, any>, diff: string): Pick<ConfirmRequest, 'files' | 'summary'> {
  const files = parseFilesFromDiff(diff, args);
  const summary: ConfirmSummary = {
    total: files.length,
    accepted: files.filter((file) => file.accepted).length,
    added: files.filter((file) => file.changeType === 'added').length,
    deleted: files.filter((file) => file.changeType === 'deleted').length,
    modified: files.filter((file) => file.changeType === 'modified').length,
  };

  if (files.length === 0) {
    const fallback = extractFallbackFile(toolName, args);
    if (fallback) {
      return {
        files: [{ filePath: fallback, changeType: 'modified', accepted: true }],
        summary: { total: 1, accepted: 1, added: 0, deleted: 0, modified: 1 },
      };
    }
  }

  return { files, summary };
}

export function filterToolArgsByDecision(
  toolName: string,
  args: Record<string, any>,
  decision: ConfirmDecision,
): Record<string, any> | null {
  if (!decision.approved) return null;

  const selectedFiles = decision.selectedFiles || {};
  const accepted = (filePath: string) => selectedFiles[filePath] !== false;

  if (toolName === 'apply_patch' && Array.isArray(args.patches)) {
    const patches = args.patches.filter((patch: any) => typeof patch?.filePath === 'string' && accepted(patch.filePath));
    return patches.length > 0 ? { ...args, patches } : null;
  }

  if (toolName === 'write_file' || toolName === 'edit_file') {
    if (typeof args.filePath === 'string' && !accepted(args.filePath)) {
      return null;
    }
  }

  return args;
}

function parseFilesFromDiff(diff: string, args: Record<string, any>): ConfirmFileChange[] {
  const lines = (diff || '').split('\n');
  const files: ConfirmFileChange[] = [];
  let currentPath = '';
  let hasPlus = false;
  let hasMinus = false;

  const pushCurrent = () => {
    if (!currentPath) return;
    files.push({
      filePath: currentPath,
      changeType: inferChangeType(currentPath, hasPlus, hasMinus),
      accepted: true,
    });
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      pushCurrent();
      currentPath = '';
      hasPlus = false;
      hasMinus = false;
      continue;
    }
    if (line.startsWith('--- ')) {
      const before = cleanDiffPath(line.slice(4));
      if (before && before !== '/dev/null') currentPath = before;
      continue;
    }
    if (line.startsWith('+++ ')) {
      const after = cleanDiffPath(line.slice(4));
      if (after && after !== '/dev/null') currentPath = after;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      hasPlus = true;
      continue;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      hasMinus = true;
    }
  }

  pushCurrent();

  if (files.length > 0) return dedupeFiles(files);

  const fallback = extractFallbackFile('unknown', args);
  return fallback
    ? [{ filePath: fallback, changeType: 'modified', accepted: true }]
    : [];
}

function dedupeFiles(files: ConfirmFileChange[]): ConfirmFileChange[] {
  const map = new Map<string, ConfirmFileChange>();
  for (const file of files) {
    map.set(file.filePath, file);
  }
  return [...map.values()];
}

function inferChangeType(filePath: string, hasPlus: boolean, hasMinus: boolean): ConfirmFileChange['changeType'] {
  if (filePath === '/dev/null') return 'modified';
  if (hasPlus && hasMinus) return 'modified';
  if (hasPlus) return 'added';
  if (hasMinus) return 'deleted';
  return 'modified';
}

function cleanDiffPath(value: string): string {
  return value.trim().split('\t')[0].replace(/^[ab]\//, '');
}

function extractFallbackFile(toolName: string, args: Record<string, any>): string {
  if (toolName === 'apply_patch' && Array.isArray(args.patches) && args.patches[0]?.filePath) {
    return args.patches[0].filePath;
  }
  if (typeof args.filePath === 'string') return args.filePath;
  if (typeof args.path === 'string') return args.path;
  return '';
}
