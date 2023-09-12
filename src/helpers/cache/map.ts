import {CacheStore, clearOldCacheTimeLimits, hash} from "./cache";


export function useJavascriptMapCacheStore(): CacheStore {
  const cache = new Map<string, {
    value: any;
    expiresAt: number;
    createdAt: number;
  }>();

  async function deleteKey(key: string, alreadyHashed = false) {
    if (!alreadyHashed)
      key = hash(key);
    cache.delete(key);
  }

  async function has(key: string, alreadyHashed = false) {
    if (!alreadyHashed)
      key = hash(key);
    if (!cache.has(key)) return false;
    const {expiresAt} = cache.get(key)!;
    if (expiresAt < Date.now()) {
      await deleteKey(key, true);
      return false;
    }
    return true;
  }

  async function getFull(key: string, alreadyHashed = false) {
    if (!alreadyHashed)
      key = hash(key);
    if (!await has(key, true)) return null;
    const result = cache.get(key);
    if (!result) return null;
    return result;
  }

  async function get(key: string, alreadyHashed = false) {
    return (await getFull(key, alreadyHashed))?.value;
  }

  async function getTimeInformation(key: string, alreadyHashed = false) {
    return getFull(key, alreadyHashed);
  }

  async function set(key: string, value: any, ttl: number, alreadyHashed = false) {
    if (!alreadyHashed)
      key = hash(key);
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  // we store the timestamps so that we warn the user if they're clearing the old cache too often
  let clearOldCallTimestamps : number[] = [];

  async function clearOld() {
    const now = Date.now();
    await Promise.all([...cache.keys()].map(async key => {
      return has(key, true);
    }));
    clearOldCallTimestamps.push(now);
    clearOldCallTimestamps = clearOldCallTimestamps.filter(timestamp => timestamp > now - clearOldCacheTimeLimits.frame);
    if (clearOldCallTimestamps.length > clearOldCacheTimeLimits.times) {
      console.warn("You're clearing the old cache too often.");
    }
  }

  return {
    delete: deleteKey,
    has,
    get,
    set,
    clear: () => {
      cache.clear();
      return Promise.resolve();
    },
    clearOld,
    getTimeInformation,
    getFull: getFull
  }
}