// src/utils/request-coalescer.ts
class RequestCoalescer {
  private pending = new Map<string, Promise<string>>();

  async coalesce(key: string, fn: () => Promise<string>): Promise<string> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }
    const promise = fn().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}

export const coalescer = new RequestCoalescer();