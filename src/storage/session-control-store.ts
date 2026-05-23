export type SessionControlAction = 'pause' | 'resume' | 'skip' | 'retry';
export type SessionControlScope = 'session' | 'step' | 'tool' | 'verification';

export interface SessionControlState {
  sessionId: string;
  action: SessionControlAction;
  stepId?: number;
  scope?: SessionControlScope;
  toolName?: string;
  updatedAt: number;
}

export class SessionControlStore {
  private controls = new Map<string, SessionControlState>();

  set(state: Omit<SessionControlState, 'updatedAt'>) {
    if (state.action === 'resume') {
      this.controls.delete(state.sessionId);
      return {
        ...state,
        updatedAt: Date.now(),
      };
    }
    const value: SessionControlState = {
      ...state,
      updatedAt: Date.now(),
    };
    this.controls.set(state.sessionId, value);
    return value;
  }

  get(sessionId: string) {
    return this.controls.get(sessionId) || null;
  }

  clear(sessionId: string) {
    this.controls.delete(sessionId);
  }

  consumeIfMatches(sessionId: string, stepId?: number) {
    const state = this.controls.get(sessionId);
    if (!state) return null;
    if (state.stepId != null && stepId != null && state.stepId !== stepId) {
      return null;
    }
    if (state.action !== 'pause') {
      this.controls.delete(sessionId);
    }
    return state;
  }

  matchesPause(
    sessionId: string,
    target?: {
      stepId?: number;
      scope?: SessionControlScope;
      toolName?: string;
    }
  ) {
    const state = this.controls.get(sessionId);
    if (!state || state.action !== 'pause') return false;
    if (state.stepId != null && target?.stepId != null && state.stepId !== target.stepId) {
      return false;
    }
    if (state.scope && target?.scope && state.scope !== target.scope) {
      return false;
    }
    if (state.toolName && target?.toolName && state.toolName !== target.toolName) {
      return false;
    }
    return true;
  }
}

export const sessionControlStore = new SessionControlStore();
