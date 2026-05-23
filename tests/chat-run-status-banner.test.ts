import { describe, expect, it } from 'bun:test';
import { buildRunStatusBanner } from '../web/src/utils/chat-run-status-banner';

describe('chat run status banner', () => {
  it('shows resume, retry and dismiss actions when a run is paused', () => {
    const banner = buildRunStatusBanner({ status: 'paused', resumable: true });

    expect(banner?.message).toBe('生成已暂停');
    expect(banner?.actions.map((action) => action.key)).toEqual(['resume', 'retry', 'dismiss']);
  });

  it('finds the latest user message for retry', () => {
    const banner = buildRunStatusBanner({ status: 'paused', resumable: true }, [
      { id: 'u1', role: 'user', content: 'first' },
      { id: 'a1', role: 'assistant', content: 'partial' },
      { id: 'u2', role: 'user', content: 'retry me' },
      { id: 'a2', role: 'assistant', content: 'paused' },
    ]);

    expect(banner?.retryText).toBe('retry me');
  });

  it('does not show a banner for idle runs', () => {
    expect(buildRunStatusBanner({ status: 'idle', resumable: false })).toBe(null);
  });
});
