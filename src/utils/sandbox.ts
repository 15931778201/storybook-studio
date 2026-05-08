import { execSync } from 'child_process';

export function executeSafely(command: string, options?: { timeout?: number; maxOutput?: number }) {
  try {
    const output = execSync(command, {
      timeout: options?.timeout ?? 30000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10,
    });
    return output.slice(0, options?.maxOutput ?? 10000);
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}
