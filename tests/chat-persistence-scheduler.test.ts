import { describe, expect, it } from 'bun:test';
import { createPersistenceScheduler } from '../web/src/utils/chat-persistence-scheduler';

describe('chat persistence scheduler', () => {
  it('coalesces frequent updates into one delayed persistence write', () => {
    const saved: string[] = [];
    const timers: Array<() => void> = [];
    const scheduler = createPersistenceScheduler<string>({
      delayMs: 100,
      save: (value) => saved.push(value),
      setTimeoutFn: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimeoutFn: () => {},
    });

    scheduler.schedule('first');
    scheduler.schedule('second');
    scheduler.schedule('latest');

    expect(saved).toEqual([]);
    expect(timers).toHaveLength(1);

    timers[0]();

    expect(saved).toEqual(['latest']);
  });

  it('flushes the latest queued value immediately', () => {
    const saved: string[] = [];
    const scheduler = createPersistenceScheduler<string>({
      delayMs: 100,
      save: (value) => saved.push(value),
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => {},
    });

    scheduler.schedule('queued');
    scheduler.flush();

    expect(saved).toEqual(['queued']);
  });
});
