export interface PersistenceScheduler<T> {
  schedule(value: T): void;
  flush(): void;
  cancel(): void;
}

export function createPersistenceScheduler<T>(_options: {
  delayMs: number;
  save: (value: T) => void;
  setTimeoutFn?: (fn: () => void, delayMs: number) => any;
  clearTimeoutFn?: (timer: any) => void;
}): PersistenceScheduler<T> {
  const options = _options;
  const setTimeoutFn = options.setTimeoutFn || globalThis.setTimeout.bind(globalThis);
  const clearTimeoutFn = options.clearTimeoutFn || globalThis.clearTimeout.bind(globalThis);
  let queuedValue: T | undefined;
  let hasQueuedValue = false;
  let timer: any = null;

  const persist = () => {
    timer = null;
    if (!hasQueuedValue) return;
    const value = queuedValue as T;
    queuedValue = undefined;
    hasQueuedValue = false;
    options.save(value);
  };

  return {
    schedule(value: T) {
      queuedValue = value;
      hasQueuedValue = true;
      if (timer !== null) return;
      timer = setTimeoutFn(persist, options.delayMs);
    },
    flush() {
      if (timer !== null) {
        clearTimeoutFn(timer);
        timer = null;
      }
      persist();
    },
    cancel() {
      if (timer !== null) {
        clearTimeoutFn(timer);
      }
      timer = null;
      queuedValue = undefined;
      hasQueuedValue = false;
    },
  };
}
