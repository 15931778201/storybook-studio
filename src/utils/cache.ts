// src/utils/cache.ts
class MemoryCache {
  private store = new Map<string, { value: any; expiry: number }>();

  set(key: string, value: any, ttlMs: number = 60000) {
    this.store.set(key, { value, expiry: Date.now() + ttlMs });
  }

  get(key: string): any | null {
    const item = this.store.get(key);
    if (!item || Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }
}

export const cache = new MemoryCache();