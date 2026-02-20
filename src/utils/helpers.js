/**
 * Shared helpers - single source for all pages
 */

export function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

export function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

export function nowMs() {
  return Date.now();
}

export function genId(prefix) {
  return `${prefix}_${nowMs()}_${Math.floor(Math.random() * 100000)}`;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toLocalISODate(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO() {
  return toLocalISODate(Date.now());
}

export function normId(x) {
  return String(x ?? "").trim();
}

export function toNum(x) {
  const s = String(x ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function clampMoney(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

export function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

export function localDateToMs(isoDate) {
  const s = String(isoDate || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function addDaysLocal(baseMs, days) {
  const d = new Date(baseMs);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + Number(days || 0),
    0,
    0,
    0,
    0
  ).getTime();
}

export function fmtDurationDays(days) {
  if (days == null) return "لا نهائي";
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n} يوم`;
}
