import path from 'path';
import { BashTool } from '../tools/bash';
import fs from 'fs';

export type VerificationResult = {
  commands: string[];
  passed: boolean;
  output: string;
  incomplete?: boolean;
};

export type VerificationCheckpoint = {
  commands: string[];
  completed: number;
  outputs: string[];
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
  return runCheckpointedVerification(
    commands,
    (command) => bash.execute({ command, timeout: 120000 }),
  );
}

export async function runCheckpointedVerification(
  commands: string[],
  runner: (command: string) => Promise<{ success: boolean; output: string }>,
  options: {
    sessionId?: string;
    checkpointPath?: string;
    resumeFrom?: VerificationCheckpoint;
    onCheckpoint?: (checkpoint?: VerificationCheckpoint) => void;
    shouldPause?: () => boolean;
  } = {},
): Promise<VerificationResult> {
  const outputs: string[] = [];
  let passed = true;
  const resumeFrom = options.resumeFrom;
  let startIndex = 0;

  if (resumeFrom && JSON.stringify(resumeFrom.commands) === JSON.stringify(commands)) {
    startIndex = Math.min(resumeFrom.completed, commands.length);
    outputs.push(...resumeFrom.outputs);
  }

  for (let index = startIndex; index < commands.length; index += 1) {
    if (options.shouldPause?.()) {
      const checkpoint = { commands, completed: index, outputs: [...outputs] };
      persistVerificationCheckpoint(commands, index, outputs, options);
      options.onCheckpoint?.(checkpoint);
      return {
        commands,
        passed: false,
        output: outputs.join('\n\n'),
        incomplete: true,
      };
    }
    const command = commands[index];
    const result = await runner(command);
    outputs.push(`$ ${command}\n${result.output}`);
    persistVerificationCheckpoint(commands, index + 1, outputs, options);
    options.onCheckpoint?.({ commands, completed: index + 1, outputs: [...outputs] });
    if (!result.success || /退出码\s+[1-9]\d*/.test(result.output)) {
      passed = false;
      break;
    }
  }

  options.onCheckpoint?.(undefined);

  return {
    commands,
    passed,
    output: outputs.join('\n\n'),
  };
}

function persistVerificationCheckpoint(
  commands: string[],
  completed: number,
  outputs: string[],
  options: {
    sessionId?: string;
    checkpointPath?: string;
  },
) {
  if (!options.checkpointPath || !options.sessionId) return;
  const payload = fs.existsSync(options.checkpointPath)
    ? JSON.parse(fs.readFileSync(options.checkpointPath, 'utf-8'))
    : {};
  payload[options.sessionId] = { commands, completed, outputs };
  fs.writeFileSync(options.checkpointPath, JSON.stringify(payload, null, 2));
}

export function summarizeAppliedFiles(changedFiles: string[]) {
  const uniqueFiles = [...new Set(changedFiles.map((file) => path.normalize(file)))];
  return uniqueFiles;
}
