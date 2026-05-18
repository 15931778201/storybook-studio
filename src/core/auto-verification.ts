import path from 'path';
import { BashTool } from '../tools/bash';

export type VerificationResult = {
  commands: string[];
  passed: boolean;
  output: string;
};

export function recommendVerificationCommands(changedFiles: string[]): string[] {
  const normalized = changedFiles.map((file) => file.toLowerCase());
  const hasTs = normalized.some((file) => /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(file));
  const hasPackage = normalized.some((file) => /(^|\/)package\.json$/.test(file));
  const hasWeb = normalized.some((file) => file.startsWith('web/'));

  const commands: string[] = [];
  if (hasPackage || hasTs) {
    commands.push('CI=1 bun test');
  }
  if (hasWeb) {
    commands.push('CI=1 bun run --cwd web build');
  }
  if (commands.length === 0) {
    commands.push('CI=1 bun test');
  }
  return [...new Set(commands)];
}

export async function runAutoVerification(
  changedFiles: string[],
  workspaceRoot?: string,
): Promise<VerificationResult> {
  const commands = recommendVerificationCommands(changedFiles);
  const bash = new BashTool({ workspaceRoot });
  const outputs: string[] = [];
  let passed = true;

  for (const command of commands) {
    const result = await bash.execute({ command, timeout: 120000 });
    outputs.push(`$ ${command}\n${result.output}`);
    if (!result.success || /退出码\s+[1-9]\d*/.test(result.output)) {
      passed = false;
      break;
    }
  }

  return {
    commands,
    passed,
    output: outputs.join('\n\n'),
  };
}

export function summarizeAppliedFiles(changedFiles: string[]) {
  const uniqueFiles = [...new Set(changedFiles.map((file) => path.normalize(file)))];
  return uniqueFiles;
}
