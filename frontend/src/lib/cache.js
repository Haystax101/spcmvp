const canUseStorage = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

export const readCacheEntry = (key, maxAgeMs = 0) => {
  if (!key || !canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const savedAt = Number(parsed.savedAt) || 0;
    if (maxAgeMs > 0 && savedAt > 0 && Date.now() - savedAt > maxAgeMs) return null;

    return {
      savedAt,
      data: parsed.data ?? null,
    };
  } catch {
    return null;
  }
};

export const readCacheValue = (key, maxAgeMs = 0) => readCacheEntry(key, maxAgeMs)?.data ?? null;

export const writeCacheEntry = (key, data) => {
  if (!key || !canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Ignore storage quota and availability errors.
  }
};

export const removeCacheEntry = (key) => {
  if (!key || !canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage availability errors.
  }
};