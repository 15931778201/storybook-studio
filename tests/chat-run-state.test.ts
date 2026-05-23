import { describe, expect, it } from 'bun:test';
import {
  createInitialChatRunState,
  markChatRunDismissed,
  markChatRunPaused,
  markChatRunResumed,
  markChatRunRunning,
  markChatRunStopped,
} from '../web/src/utils/chat-run-state';

describe('chat run state helpers', () => {
  it('tracks paused runs as resumable for the active session', () => {
    let state = createInitialChatRunState();

    state = markChatRunRunning(state);
    expect(state).toEqual({ status: 'running', resumable: false });

    state = markChatRunStopped(state);
    expect(state).toEqual({ status: 'paused', resumable: true });

    state = markChatRunResumed(state);
    expect(state).toEqual({ status: 'running', resumable: false });
  });

  it('clears resumable state when switching conversations or workspaces', () => {
    const state = markChatRunPaused(createInitialChatRunState());

    expect(state).toEqual({ status: 'paused', resumable: true });
    expect(createInitialChatRunState()).toEqual({ status: 'idle', resumable: false });
  });

  it('dismisses a paused resumable run back to idle', () => {
    const state = markChatRunStopped(createInitialChatRunState());

    expect(markChatRunDismissed(state)).toEqual({ status: 'idle', resumable: false });
  });
});
