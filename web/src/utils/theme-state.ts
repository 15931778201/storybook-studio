const THEME_STORAGE_KEY = 'theme';

interface ThemeReadableStorage {
  getItem: (key: string) => string | null;
}

interface ThemeWritableStorage {
  setItem: (key: string, value: string) => void;
}

interface ThemeClassList {
  toggle: (className: string, force?: boolean) => void;
}

export function getInitialThemePreference(storage: ThemeReadableStorage = window.localStorage): boolean {
  return storage.getItem(THEME_STORAGE_KEY) === 'dark';
}

export function applyThemePreference(
  isDark: boolean,
  target: { storage?: ThemeWritableStorage; classList?: ThemeClassList } = {},
) {
  const storage = target.storage || window.localStorage;
  const classList = target.classList || document.documentElement.classList;
  storage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  classList.toggle('dark', isDark);
}

export function toggleThemePreference(isDark: boolean): boolean {
  return !isDark;
}
