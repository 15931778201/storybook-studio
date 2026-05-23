import { describe, expect, it } from 'bun:test';
import {
  applyThemePreference,
  getInitialThemePreference,
  toggleThemePreference,
} from '../web/src/utils/theme-state';

describe('theme state helpers', () => {
  it('loads dark mode from the single persisted theme key', () => {
    const storage = new Map<string, string>([['theme', 'dark']]);

    expect(getInitialThemePreference({
      getItem: (key) => storage.get(key) ?? null,
    })).toBe(true);
  });

  it('persists and applies the dark class from one state value', () => {
    const writes: Record<string, string> = {};
    const classes = new Set<string>();

    applyThemePreference(true, {
      storage: {
        setItem: (key, value) => {
          writes[key] = value;
        },
      },
      classList: {
        toggle: (className, force) => {
          force ? classes.add(className) : classes.delete(className);
        },
      },
    });

    expect(writes.theme).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    expect(toggleThemePreference(true)).toBe(false);
  });
});
