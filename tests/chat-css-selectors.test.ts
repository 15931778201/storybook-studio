import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';

function selectorCounts(css: string) {
  const counts = new Map<string, number>();
  for (const match of css.matchAll(/(^|\n)\s*([^@{}\n][^{}\n]+)\s*\{/g)) {
    const selector = match[2].trim();
    counts.set(selector, (counts.get(selector) || 0) + 1);
  }
  return counts;
}

describe('chat css selectors', () => {
  it('keeps chat style selectors single-sourced', () => {
    const css = readFileSync('web/src/style/chat.css', 'utf8');
    const counts = selectorCounts(css);
    const duplicates = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([selector]) => selector);

    expect(duplicates).toEqual([]);
  });
});
