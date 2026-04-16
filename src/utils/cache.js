const cache = new Map();

export const getCachedData = async (key, fetcher, ttlSeconds = 15) => {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp < ttlSeconds * 1000)) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

export const clearCache = (key) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};
