const SESSION_STORAGE_KEY = "reader_session_id";

export function getReaderSessionId(): string {
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = `session_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}
