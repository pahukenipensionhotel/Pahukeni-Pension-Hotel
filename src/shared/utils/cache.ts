type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

export const setCache = <T>(key: string, data: T) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const getCache = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
};
