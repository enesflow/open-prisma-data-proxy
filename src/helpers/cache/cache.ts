import {headerWithCommasToRecord} from "../query";

export function hash(str: string) {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(str);
  return hasher.digest("hex");
}

type CacheStoreTimeInformation = {
  expiresAt: number;
  createdAt: number;
}

export type CacheStore = {
  delete: (key: string, ...args: any[]) => Promise<void>;
  has: (key: string, ...args: any[]) => Promise<boolean>;
  getFull: (key: string, ...args: any[]) => Promise<{
    value: any;
} & CacheStoreTimeInformation | null>;
  get: (key: string, ...args: any[]) => Promise<any>;
  getTimeInformation: (key: string, ...args: any[]) => Promise<CacheStoreTimeInformation | null>;
  set: (key: string, value: any, ttl: number, ...args: any[]) => Promise<void>;
  clear: () => Promise<void>;
  clearOld: () => Promise<void>;
}

export function routineCacheClear(cache: CacheStore, interval: number) {
  setInterval(() => {
    cache.clear();
  }, interval);
}

export const clearOldCacheTimeLimits = {
  frame: 1000 * 60,
  times: 10
} as const

export function getCacheInformationFromHeaders(headers: Record<string, string | null>) {
  const cacheControl = headers["cache-control"];
  if (!cacheControl) return null;
  if (cacheControl === "no-cache") return null;
  const cacheInformation = headerWithCommasToRecord(cacheControl);
  return {
    "max-age": cacheInformation["max-age"] ? parseInt(cacheInformation["max-age"]) : undefined,
    "stale-while-revalidate": cacheInformation["stale-while-revalidate"] ? parseInt(cacheInformation["stale-while-revalidate"]) : undefined,
  }
}