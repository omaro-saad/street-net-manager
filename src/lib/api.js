/**
 * API client for backend (auth + optional data). Use when VITE_API_URL is set.
 */
const API_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

export function getApiUrl() {
  return API_URL;
}

export function isApiMode() {
  return !!API_URL;
}

/** Login. 403 with code "subscription_expired" is expected for expired accounts and is handled by redirecting to the subscription-expired page (browser may still log the 403 in console). */
export async function apiLogin(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: String(username).trim(), password: String(password) }),
  });
  let data = {};
  try {
    const text = await res.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!res.ok) {
    const out = {
      ok: false,
      error: data?.error || "فشل تسجيل الدخول.",
      code: data?.code,
      user: data?.user,
      org: data?.org,
      subscription: data?.subscription,
      status: res.status,
    };
    return out;
  }
  return { ok: true, token: data.token, user: data.user };
}

export async function apiMe(token) {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data?.error || "فشل جلب البيانات.",
      code: data?.code,
      user: data?.user,
      org: data?.org,
      subscription: data?.subscription,
    };
  }
  return {
    ok: true,
    user: data.user,
    org: data.org,
    subscription: data.subscription,
    role: data.role,
    oadminUsername: data.oadminUsername ?? null,
    allowedModules: data.allowedModules || [],
    modulePermissions: data.modulePermissions || null,
    limits: data.limits || null,
    usage: data.usage || {},
  };
}

/** Update username (authenticated). Optional secretCode for verification, like password reset. */
export async function apiUpdateUsername(token, newUsername, secretCode) {
  const body = { newUsername: String(newUsername).trim() };
  if (secretCode != null && String(secretCode).trim()) body.secretCode = String(secretCode).trim();
  const res = await fetch(`${API_URL}/api/auth/profile/username`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || "فشل تحديث اسم المستخدم." };
  }
  return { ok: true, user: data.user };
}

/** Reset password with username + secret reset code + new password (no auth). */
export async function apiResetPassword(username, resetCode, newPassword) {
  const res = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: String(username).trim(),
      resetCode: String(resetCode).trim(),
      newPassword: String(newPassword).trim(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || "فشل إعادة تعيين كلمة المرور." };
  }
  return { ok: true, message: data.message };
}

/** List Ousers in org (Oadmin only). */
export async function apiListOusers(token) {
  const res = await fetch(`${API_URL}/api/auth/ousers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب القائمة." };
  return { ok: true, ousers: data.ousers || [] };
}

/** Get Ouser permissions (Oadmin only). Returns permissions = { moduleKey: "read"|"read_write" }. */
export async function apiGetOuserPermissions(token, ouserId) {
  const res = await fetch(`${API_URL}/api/auth/ousers/${encodeURIComponent(ouserId)}/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الصلاحيات." };
  const permissions = data.permissions && typeof data.permissions === "object" ? data.permissions : {};
  return { ok: true, allowedModules: data.allowedModules || [], permissions };
}

/** Set Ouser permissions (Oadmin only). permissions = { moduleKey: "read"|"read_write" }. */
export async function apiSetOuserPermissions(token, ouserId, permissions) {
  const res = await fetch(`${API_URL}/api/auth/ousers/${encodeURIComponent(ouserId)}/permissions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ permissions: permissions && typeof permissions === "object" ? permissions : {} }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حفظ الصلاحيات." };
  return { ok: true, permissions: data.permissions || {} };
}

/** Lines (persist in DB when API + Supabase). */
export async function apiLinesList(token) {
  const res = await fetch(`${API_URL}/api/lines`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الخطوط.", data: [] };
  return { ok: true, data: Array.isArray(data.data) ? data.data : [] };
}

export async function apiLinesAdd(token, body) {
  const res = await fetch(`${API_URL}/api/lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل إضافة الخط.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiLinesUpdate(token, id, body) {
  const res = await fetch(`${API_URL}/api/lines/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل تحديث الخط.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiLinesDelete(token, id) {
  const res = await fetch(`${API_URL}/api/lines/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حذف الخط." };
  return { ok: true };
}

/** Packages (persist in DB when API + Supabase). */
export async function apiPackagesList(token) {
  const res = await fetch(`${API_URL}/api/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الباقات.", data: [] };
  return { ok: true, data: Array.isArray(data.data) ? data.data : [] };
}

export async function apiPackagesAdd(token, body) {
  const res = await fetch(`${API_URL}/api/packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل إضافة الباقة.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiPackagesUpdate(token, id, body) {
  const res = await fetch(`${API_URL}/api/packages/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل تحديث الباقة.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiPackagesDelete(token, id) {
  const res = await fetch(`${API_URL}/api/packages/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حذف الباقة." };
  return { ok: true };
}

/** Subscribers (persist in DB when API + Supabase). */
export async function apiSubscribersList(token) {
  const res = await fetch(`${API_URL}/api/subscribers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب المشتركين.", data: [] };
  return { ok: true, data: Array.isArray(data.data) ? data.data : [] };
}

export async function apiSubscribersAdd(token, body) {
  const res = await fetch(`${API_URL}/api/subscribers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل إضافة المشترك.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiSubscribersUpdate(token, id, body) {
  const res = await fetch(`${API_URL}/api/subscribers/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل تحديث المشترك.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiSubscribersDelete(token, id) {
  const res = await fetch(`${API_URL}/api/subscribers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حذف المشترك." };
  return { ok: true };
}

/** Distributors (persist in DB when API + Supabase). */
export async function apiDistributorsList(token) {
  const res = await fetch(`${API_URL}/api/distributors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الموزعين.", data: [] };
  return { ok: true, data: Array.isArray(data.data) ? data.data : [] };
}

export async function apiDistributorsAdd(token, body) {
  const res = await fetch(`${API_URL}/api/distributors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل إضافة الموزع.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiDistributorsUpdate(token, id, body) {
  const res = await fetch(`${API_URL}/api/distributors/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل تحديث الموزع.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiDistributorsDelete(token, id) {
  const res = await fetch(`${API_URL}/api/distributors/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حذف الموزع." };
  return { ok: true };
}

/** Employees (persist in DB when API + Supabase). */
export async function apiEmployeesList(token) {
  const res = await fetch(`${API_URL}/api/employees`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الموظفين.", data: [] };
  return { ok: true, data: Array.isArray(data.data) ? data.data : [] };
}

export async function apiEmployeesAdd(token, body) {
  const res = await fetch(`${API_URL}/api/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل إضافة الموظف.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiEmployeesUpdate(token, id, body) {
  const res = await fetch(`${API_URL}/api/employees/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل تحديث الموظف.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiEmployeesDelete(token, id) {
  const res = await fetch(`${API_URL}/api/employees/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حذف الموظف." };
  return { ok: true };
}

/** Inventory / Devices (persist in DB when API + Supabase). warehouses, sections, items. */
export async function apiInventoryGet(token) {
  const res = await fetch(`${API_URL}/api/inventory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب المخزون.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiInventorySet(token, payload) {
  const res = await fetch(`${API_URL}/api/inventory`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حفظ المخزون.", data: null };
  return { ok: true, data: data.data ?? null };
}

/** Finance KV (persist in DB when API + Supabase). manualInvoices, autoInvoices, etc. */
export async function apiFinanceGet(token) {
  const res = await fetch(`${API_URL}/api/finance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب المالية.", data: {} };
  return { ok: true, data: data.data && typeof data.data === "object" ? data.data : {} };
}

export async function apiFinancePut(token, kv) {
  const res = await fetch(`${API_URL}/api/finance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(kv && typeof kv === "object" ? kv : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حفظ المالية.", data: {} };
  return { ok: true, data: data.data && typeof data.data === "object" ? data.data : {} };
}

/** Settings (theme, company name, about). Persist in DB when API + Supabase. */
export async function apiSettingsGet(token) {
  const res = await fetch(`${API_URL}/api/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الإعدادات.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiSettingsPut(token, payload) {
  const res = await fetch(`${API_URL}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload && typeof payload === "object" ? payload : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حفظ الإعدادات.", data: null };
  return { ok: true, data: data.data ?? null };
}

/** Maps (persist in DB when API + Supabase). Per-line map data (nodes, edges, viewport). */
export async function apiMapsGet(token, lineId) {
  const res = await fetch(`${API_URL}/api/maps/${encodeURIComponent(lineId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب الخريطة.", data: null };
  return { ok: true, data: data.data ?? null };
}

export async function apiMapsSet(token, lineId, payload) {
  const res = await fetch(`${API_URL}/api/maps/${encodeURIComponent(lineId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حفظ الخريطة.", data: null };
  return { ok: true, data: data.data ?? null };
}

/** Backup (admin only): one file per org, replace on each backup. */
export async function apiBackupGet(token) {
  const res = await fetch(`${API_URL}/api/backup`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل جلب النسخة الاحتياطية.", backup: null };
  return { ok: true, backup: data.backup ?? null };
}

export async function apiBackupPost(token, snapshot) {
  const res = await fetch(`${API_URL}/api/backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(snapshot != null ? { data: snapshot } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حفظ النسخة الاحتياطية." };
  return { ok: true, message: data?.message };
}

export async function apiBackupRestore(token) {
  const res = await fetch(`${API_URL}/api/backup/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل استعادة النسخة الاحتياطية.", data: null };
  return { ok: true, data: data.data ?? null, message: data?.message };
}

/** Delete all org data (admin only). Keeps backup and accounts. Then client should logout. */
export async function apiDeleteAllData(token) {
  const res = await fetch(`${API_URL}/api/data/delete-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "فشل حذف البيانات." };
  return { ok: true, message: data?.message };
}

export const PLAN_LIMIT_MESSAGE = "لقد وصلت لحد الخطة. يرجى الترقية.";
export const READ_ONLY_MESSAGE = "لديك صلاحية عرض فقط. التعديل غير مسموح.";
export const SUPPORT_EMAIL = "omarsskaik@gmail.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=طلب دعم - مدير شبكتك`;
export const SUPPORT_WHATSAPP_URL = "https://api.whatsapp.com/send/?phone=%2B970595696010&text&type=phone_number&app_absent=0";
