import { describe, expect, it } from 'bun:test';
import {
  WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY,
  getDefaultWorkspaceStatusCollapsed,
  loadWorkspaceStatusCollapsed,
  saveWorkspaceStatusCollapsed,
} from '../web/src/utils/workspace-status-panel-state';

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

describe('workspace status panel state', () => {
  it('defaults to expanded on desktop widths', () => {
    expect(getDefaultWorkspaceStatusCollapsed(1280)).toBe(false);
    expect(getDefaultWorkspaceStatusCollapsed(1024)).toBe(false);
  });

  it('defaults to collapsed on narrow widths', () => {
    expect(getDefaultWorkspaceStatusCollapsed(1023)).toBe(true);
    expect(getDefaultWorkspaceStatusCollapsed(768)).toBe(true);
  });

  it('loads persisted collapsed state before falling back to viewport width', () => {
    const storage = createStorage({
      [WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY]: 'true',
    });

    expect(loadWorkspaceStatusCollapsed(storage as Storage, 1600)).toBe(true);
  });

  it('falls back to viewport width when there is no persisted state', () => {
    const storage = createStorage();

    expect(loadWorkspaceStatusCollapsed(storage as Storage, 1440)).toBe(false);
    expect(loadWorkspaceStatusCollapsed(storage as Storage, 800)).toBe(true);
  });

  it('persists the latest user selection', () => {
    const storage = createStorage();

    saveWorkspaceStatusCollapsed(storage as Storage, true);
    expect(storage.getItem(WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY)).toBe('true');

    saveWorkspaceStatusCollapsed(storage as Storage, false);
    expect(storage.getItem(WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY)).toBe('false');
  });
});
