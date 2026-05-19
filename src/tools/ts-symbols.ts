import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { Tool, safeExecute } from '../core/tool';
import { resolveWorkspaceRoot, WorkspaceToolOptions } from './workspace';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.agent', '.worktrees']);

export class TsSymbolsTool extends Tool {
  name = 'ts_symbols';
  description = '扫描 TS/JS 符号定义与引用，支持“这个函数在哪里被引用”检索';
  parameters = z.object({
    symbol: z.string().min(1).describe('符号名'),
    mode: z.enum(['definitions', 'references', 'both']).optional().default('both'),
    maxResults: z.coerce.number().int().min(1).max(200).optional().default(80),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  protected async executeCore(validatedParams: unknown) {
    const { symbol, mode, maxResults } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const workspaceRoot = resolveWorkspaceRoot(this.options.workspaceRoot);
      const files = collectCodeFiles(workspaceRoot);
      const results: string[] = [];

      for (const file of files) {
        if (results.length >= maxResults) break;
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (results.length >= maxResults) return;
          const isDefinition = isSymbolDefinition(line, symbol);
          const isReference = isSymbolReference(line, symbol) && !isDefinition;

          if ((mode === 'definitions' || mode === 'both') && isDefinition) {
            results.push(`[definition] ${path.relative(workspaceRoot, file)}:${index + 1}: ${line.trim()}`);
            return;
          }
          if ((mode === 'references' || mode === 'both') && isReference) {
            results.push(`[reference] ${path.relative(workspaceRoot, file)}:${index + 1}: ${line.trim()}`);
          }
        });
      }

      return {
        success: true,
        output: results.length > 0 ? results.join('\n') : `未找到符号 ${symbol} 的${mode === 'definitions' ? '定义' : mode === 'references' ? '引用' : '定义或引用'}`,
        metadata: {
          symbol,
          mode,
          resultCount: results.length,
        },
      };
    }, { maxOutput: 16000 });
  }
}

function collectCodeFiles(root: string) {
  const results: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        stack.push(path.join(current, entry.name));
        continue;
      }

      if (CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(path.join(current, entry.name));
      }
    }
  }

  return results.sort();
}

function isSymbolDefinition(line: string, symbol: string) {
  const escaped = escapeRegExp(symbol);
  const patterns = [
    new RegExp(`\\bfunction\\s+${escaped}\\b`),
    new RegExp(`\\bconst\\s+${escaped}\\b`),
    new RegExp(`\\blet\\s+${escaped}\\b`),
    new RegExp(`\\bvar\\s+${escaped}\\b`),
    new RegExp(`\\bclass\\s+${escaped}\\b`),
    new RegExp(`\\binterface\\s+${escaped}\\b`),
    new RegExp(`\\btype\\s+${escaped}\\b`),
    new RegExp(`\\bexport\\s+(async\\s+)?function\\s+${escaped}\\b`),
    new RegExp(`\\b${escaped}\\s*=\\s*\\(`),
  ];

  return patterns.some((pattern) => pattern.test(line));
}

function isSymbolReference(line: string, symbol: string) {
  return new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(line);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
