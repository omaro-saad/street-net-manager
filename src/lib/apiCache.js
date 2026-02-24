/**
 * Lightweight in-memory cache for API list responses (lines, packages).
 * Use to avoid refetching on every page visit — back navigation feels instant.
 * TTL in ms; after expiry, next load will refetch and repopulate cache.
 */
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const cache = {
  lines: { data: null, at: 0 },
  packages: { data: null, at: 0 },
  subscribers: { data: null, at: 0 },
  distributors: { data: null, at: 0 },
};

function isFresh(entry) {
  return entry && entry.data !== null && Date.now() - entry.at < CACHE_TTL_MS;
}

export function getCachedLines() {
  return isFresh(cache.lines) ? cache.lines.data : null;
}

export function setCachedLines(data) {
  cache.lines = { data: Array.isArray(data) ? data : null, at: Date.now() };
}

export function getCachedPackages() {
  return isFresh(cache.packages) ? cache.packages.data : null;
}

export function setCachedPackages(data) {
  cache.packages = { data: Array.isArray(data) ? data : null, at: Date.now() };
}

/** Invalidate cache after a mutation so next list load refetches. Optional. */
export function invalidateLines() {
  cache.lines = { data: null, at: 0 };
}

export function invalidatePackages() {
  cache.packages = { data: null, at: 0 };
}

export function getCachedSubscribers() {
  return isFresh(cache.subscribers) ? cache.subscribers.data : null;
}

export function setCachedSubscribers(data) {
  cache.subscribers = { data: Array.isArray(data) ? data : null, at: Date.now() };
}

export function invalidateSubscribers() {
  cache.subscribers = { data: null, at: 0 };
}

export function getCachedDistributors() {
  return isFresh(cache.distributors) ? cache.distributors.data : null;
}

export function setCachedDistributors(data) {
  cache.distributors = { data: Array.isArray(data) ? data : null, at: Date.now() };
}

export function invalidateDistributors() {
  cache.distributors = { data: null, at: 0 };
}
