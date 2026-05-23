import { SessionStore, type SessionRuntimeSnapshot } from './session-store';

let runtimeStore: SessionStore | null = null;

export function getSessionRuntimeStore() {
  if (!runtimeStore) {
    runtimeStore = new SessionStore('.agent/session.db');
  }
  return runtimeStore;
}

export function saveRuntimeSnapshot(snapshot: SessionRuntimeSnapshot) {
  getSessionRuntimeStore().saveRuntimeState(snapshot);
}

export function loadRuntimeSnapshot(sessionId: string) {
  return getSessionRuntimeStore().loadRuntimeState(sessionId);
}

export function clearRuntimeSnapshot(sessionId: string) {
  getSessionRuntimeStore().clearRuntimeState(sessionId);
}
