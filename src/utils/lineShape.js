/**
 * Unified line normalizer - single source for Plans, Subscribers, Distributors, MyMap
 */
import { isObj, normId } from "./helpers.js";

export function normalizeLineRow(raw) {
  if (!isObj(raw)) return null;
  const id = normId(raw.id);
  if (!id) return null;
  const name = String(raw.name ?? raw.title ?? raw.label ?? raw.lineName ?? "").trim();
  const address = String(raw.address ?? raw.location ?? raw.addr ?? "").trim();
  const active = raw.active === 0 ? false : Boolean(raw.active ?? true);
  return {
    ...raw,
    id,
    name: name || `Line ${id}`,
    address,
    active,
  };
}

/** Alias for MyMapPage / LinesPage */
export function ensureLineShape(raw) {
  return normalizeLineRow(raw);
}
