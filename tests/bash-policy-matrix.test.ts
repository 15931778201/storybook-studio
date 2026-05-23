import { describe, expect, it } from 'bun:test';
import { classifyCommandRisk } from '../src/tools/bash';

describe('bash policy matrix', () => {
  it('treats read-only shell commands as low risk', () => {
    const result = classifyCommandRisk('ls -la src');
    expect(result.riskLevel).toBe('low');
    expect(result.requiresConfirmation).toBe(false);
    expect(result.policy).toBe('allow');
  });

  it('treats install/build commands as medium risk', () => {
    const result = classifyCommandRisk('bun install');
    expect(result.riskLevel).toBe('medium');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.policy).toBe('confirm');
  });

  it('blocks destructive commands', () => {
    const result = classifyCommandRisk('rm -rf /tmp/demo');
    expect(result.riskLevel).toBe('high');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.policy).toBe('deny');
  });
});
