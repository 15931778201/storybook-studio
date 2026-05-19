import { describe, expect, it } from 'bun:test';
import { getToolDefinitions } from '../src/core/tool';

describe('tool definitions', () => {
  it('includes project understanding tools in metadata output', () => {
    const definitions = getToolDefinitions();
    const names = definitions.map((definition) => definition.name);

    expect(names).toContain('file_tree_summary');
    expect(names).toContain('git_context');
    expect(names).toContain('ts_symbols');

    const fileTree = definitions.find((definition) => definition.name === 'file_tree_summary');
    expect(fileTree?.parameters).toHaveProperty('path');
    expect(fileTree?.parameters).toHaveProperty('maxDepth');

    const tsSymbols = definitions.find((definition) => definition.name === 'ts_symbols');
    expect(tsSymbols?.parameters).toHaveProperty('symbol');
    expect(tsSymbols?.parameters).toHaveProperty('mode');
  });
});
