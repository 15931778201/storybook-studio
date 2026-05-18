import path from 'path';

export interface WorkspaceToolOptions {
  workspaceRoot?: string;
}

export function resolveWorkspaceRoot(workspaceRoot?: string): string {
  return path.resolve(process.cwd(), workspaceRoot || '.');
}

export function resolveWorkspacePath(workspaceRoot: string | undefined, targetPath: string): string {
  if (!workspaceRoot) {
    return path.resolve(process.cwd(), targetPath || '.');
  }
  const root = resolveWorkspaceRoot(workspaceRoot);
  const resolved = path.resolve(root, targetPath || '.');
  const relative = path.relative(root, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolved;
  }
  throw new Error(`路径越界: ${targetPath} 不在 workspace ${root} 内`);
}
