// src/pages/SettingsPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../DataContext";

const primary = "#8b5cf6";

// ===== Helpers =====
function nowMs() {
  return Date.now();
}
function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}
function cleanText(x) {
  const s = String(x ?? "").trim();
  return s ? s : "";
}
function clampWords(s, maxWords = 4) {
  const t = cleanText(s);
  if (!t) return "";
  const parts = t.split(/\s+/g).filter(Boolean);
  return parts.slice(0, maxWords).join(" ");
}
function downloadJson(filename, payload) {
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== Tiny toast system =====
let _toastFn = null;
function toast(msg) {
  if (_toastFn) _toastFn(msg);
}
function Toast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    _toastFn = (m) => {
      setMsg(String(m || ""));
      setTimeout(() => setMsg(""), 2200);
    };
    return () => {
      _toastFn = null;
    };
  }, []);
  if (!msg) return null;
  return <div style={toastBox}>{msg}</div>;
}

// ===== UI Components =====
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={miniLabel}>{label}</div>
      {children}
    </div>
  );
}

function InnerModal({ title, onClose, children }) {
  return (
    <div style={innerModalWrap} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={innerModal}>
        <div style={innerHeader}>
          <div style={innerTitle}>{title}</div>
          <button style={xBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { data, setData, gate } = useData() || {};

  // ===== Settings source (gate first) =====
  const settingsSource = useMemo(() => {
    const g = gate?.settings?.get ? gate.settings.get() : null;
    if (g) return safeObj(g);
    return safeObj(data?.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate?.settings, data?.settings]);

  const setSettings = (nextSettings) => {
    const clean = safeObj(nextSettings);

    if (gate?.settings?.set) {
      gate.settings.set(clean);
      return;
    }

    if (!setData) {
      alert("setData غير متوفر. تأكد من DataContext.");
      return;
    }
    setData((prev) => ({ ...prev, settings: clean }));
  };

  // ===== UI tabs =====
  const TABS = [
    { key: "admin", label: "الإدارة" },
    { key: "app", label: "إعدادات البرنامج" },
  ];
  const [tab, setTab] = useState("admin");

  // ===== Admin form =====
  const [companyName, setCompanyName] = useState("");
  const [companyAbout, setCompanyAbout] = useState("");
  const [adminUsername, setAdminUsername] = useState("");

  // ===== App settings =====
  const fileInputRef = useRef(null); // fallback only (web)
  const [dbResetConfirmOpen, setDbResetConfirmOpen] = useState(false);

  // ✅ Logout confirm
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  // ===== init from settings =====
  useEffect(() => {
    const admin = safeObj(settingsSource.admin);

    setCompanyName(cleanText(admin.companyName));
    setCompanyAbout(cleanText(admin.companyAbout));
    setAdminUsername(cleanText(admin.username));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSource]);

  // ===== Save admin =====
  const saveAdmin = () => {
    const name = clampWords(companyName, 4);
    if (!name) return alert("اسم الشركة مطلوب (يفضل أقل من 4 كلمات).");

    const next = {
      ...settingsSource,
      admin: {
        companyName: name,
        companyAbout: cleanText(companyAbout),
        username: cleanText(adminUsername),
        updatedAt: nowMs(),
      },
    };

    setSettings(next);
    toast("✅ تم حفظ بيانات الإدارة.");
  };

  // =========================================================
  // ✅ Backup/Restore/Delete using gate.backup + include settings
  // =========================================================
  const downloadFullBackup = async () => {
    try {
      if (!gate?.backup?.exportAll) {
        alert("backup.exportAll غير متوفر. تأكد من DataContext.");
        return;
      }

      const payload = await gate.backup.exportAll();

      // ✅ Electron manual save (Save As)
      if (gate?.backup?.saveJsonAs) {
        const suggested = `street-net-manager_backup_يدوي_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
        const res = await gate.backup.saveJsonAs(payload, suggested);
        if (res?.canceled) return;
        toast("⬇️ تم حفظ النسخة الاحتياطية (يدوي).");
        return;
      }

      // fallback (web)
      const fileName = `street-net-manager_backup_يدوي_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      downloadJson(fileName, payload);
      toast("⬇️ تم تنزيل نسخة احتياطية كاملة (fallback).");
    } catch (err) {
      alert(`Backup Error: ${String(err?.message || err)}`);
    }
  };

  const pickRestoreFile = async () => {
    try {
      // ✅ Electron native open + import
      if (gate?.backup?.pickAndImport) {
        const res = await gate.backup.pickAndImport();
        if (res?.canceled) return;
        toast("✅ تمت الاستعادة الكاملة بنجاح.");
        return;
      }

      // fallback (web input)
      if (!fileInputRef.current) return;
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    } catch (err) {
      alert(`Restore Error: ${String(err?.message || err)}`);
    }
  };

  const onRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!gate?.backup?.importAll) {
        alert("backup.importAll غير متوفر. تأكد من DataContext.");
        return;
      }

      const text = await file.text();
      const parsed = JSON.parse(text);

      await gate.backup.importAll(parsed);
      toast("✅ تمت الاستعادة الكاملة بنجاح.");
    } catch (err) {
      alert(`Restore Error: ${String(err?.message || err)}`);
    }
  };

  const deleteAllDatabase = async () => {
    try {
      if (gate?.backup?.resetAll) {
        await gate.backup.resetAll();
        setDbResetConfirmOpen(false);
        toast("🗑️ تم حذف كل شيء نهائياً.");
        return;
      }

      // fallback
      if (!setData) {
        alert("setData غير متوفر.");
        return;
      }
      setData((prev) => ({
        ...safeObj(prev),
        lines: [],
        speeds: [],
        devices: [],
        subscribers: [],
        distributors: [],
        employees: [],
        inventory: { warehouses: [], sections: [], items: [] },
        updatedAt: nowMs(),
      }));
      setDbResetConfirmOpen(false);
      toast("🗑️ تم حذف كل شيء (fallback).");
    } catch (err) {
      alert(`DB Reset Error: ${String(err?.message || err)}`);
    }
  };

  // ✅ Deactivate license only (logout)
  const deactivateLicenseOnly = async () => {
    try {
      const api = window?.api;
      if (!api?.license?.deactivate) {
        alert("license.deactivate غير متوفر. تأكد من preload/main.");
        return;
      }

      setLogoutBusy(true);
      const res = await api.license.deactivate();
      setLogoutBusy(false);
      setLogoutConfirmOpen(false);

      if (res?.ok) {
        toast("✅ تم تسجيل الخروج من التفعيل.");
        navigate("/activate", { replace: true });
        return;
      }

      alert(`تعطيل التفعيل فشل: ${String(res?.error || "Unknown")}`);
    } catch (e) {
      setLogoutBusy(false);
      alert(`تعطيل التفعيل فشل: ${String(e?.message || e)}`);
    }
  };

  // ===== UI =====
  const companyPreview = useMemo(() => {
    const admin = safeObj(settingsSource.admin);
    return {
      name: clampWords(admin.companyName || companyName || "—", 4) || "—",
      about: cleanText(admin.companyAbout || companyAbout),
      user: cleanText(admin.username || adminUsername),
    };
  }, [settingsSource, companyName, companyAbout, adminUsername]);

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={heroCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 260 }}>
            <div style={heroTitle}>الإعدادات</div>
          </div>

          <div style={previewBox}>
            <div style={previewTitle}>شاشة العرض</div>
            <div style={previewRow}>
              <span style={previewK}>الشركة:</span>
              <span style={previewV}>{companyPreview.name}</span>
            </div>
            <div style={previewRow}>
              <span style={previewK}>المستخدم:</span>
              <span style={previewV}>{companyPreview.user || "—"}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={tabsRow}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} style={tab === t.key ? tabBtnActive : tabBtn}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin */}
      {tab === "admin" && (
        <div style={card}>
          <div style={cardTitle}>الإدارة</div>
          <div style={cardHint}>املأ بيانات الهوية الأساسية. (اسم الشركة يفضّل أقل من 4 كلمات)</div>

          <div style={formGrid}>
            <Field label="اسم الشركة (أقل من 4 كلمات)">
              <input style={input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="مثال: شركة توزيع انترنت .." />
            </Field>

            <Field label="اسم المستخدم">
              <input style={input} value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="مثال: أحمد" />
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="فقرة توصيفية">
                <textarea style={textarea} value={companyAbout} onChange={(e) => setCompanyAbout(e.target.value)} placeholder="وصف مختصر عن الشركة/الخدمة..." />
              </Field>
            </div>

            <div style={actionsRow}>
              <button type="button" style={btnPrimary} onClick={saveAdmin}>
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App */}
      {tab === "app" && (
        <div style={card}>
          <div style={cardTitle}>إعدادات البرنامج</div>

          <br />

          <div style={grid3}>
            <div style={miniCard}>
              <div style={miniTitle}>حذف التقدم</div>
              <div style={miniText}>حذف قاعدة البيانات الخاصة فيك بالكامل</div>
              <button style={btnDanger} onClick={() => setDbResetConfirmOpen(true)}>
                حذف كل شيئ نهائياً
              </button>
            </div>

            <div style={miniCard}>
              <div style={miniTitle}>تنزيل نسخة احتياطية كاملة</div>
              <div style={miniText}>ملف واحد يرجع كل شيء (كل الصفحات + الإعدادات).</div>
              <button style={btnOutline} onClick={downloadFullBackup}>
                تنزيل نسخة كاملة
              </button>
            </div>

            <div style={miniCard}>
              <div style={miniTitle}>استعادة نسخة كاملة</div>
              <div style={miniText}>يرجع كل البيانات بالكامل وفق المصدر الموحد.</div>
              <button style={btnOutline} onClick={pickRestoreFile}>
                استعادة نسخة
              </button>

              {/* fallback only */}
              <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onRestoreFile} />
            </div>
          </div>

          <div style={{ height: 10 }} />

          {/* ✅ NEW: Logout license only */}
          <div style={miniCard}>
            <div style={miniTitle}>تسجيل خروج من التفعيل</div>
            <div style={miniText}>
              هذا يمسح ملف التفعيل فقط ويرجعك لصفحة التحقق — بدون حذف قاعدة البيانات.
            </div>
            <button style={btnDanger} onClick={() => setLogoutConfirmOpen(true)} disabled={logoutBusy}>
              {logoutBusy ? "جارِ التنفيذ..." : "تسجيل خروج من التفعيل"}
            </button>
          </div>

          {dbResetConfirmOpen && (
            <InnerModal title="تأكيد الحذف الشامل" onClose={() => setDbResetConfirmOpen(false)}>
              <div style={confirmText}>
                ⚠️ سيتم حذف كل شيء.
                <br />
                هذا الإجراء لا يمكن التراجع عنه إلا باستعادة نسخة احتياطية.
                <br />
                هل تريد المتابعة؟
              </div>
              <div style={confirmActions}>
                <button style={btnOutline} onClick={() => setDbResetConfirmOpen(false)}>
                  إلغاء
                </button>
                <button style={btnDanger} onClick={deleteAllDatabase}>
                  نعم، احذف كل شيء
                </button>
              </div>
            </InnerModal>
          )}

          {logoutConfirmOpen && (
            <InnerModal title="تأكيد تسجيل الخروج من التفعيل" onClose={() => setLogoutConfirmOpen(false)}>
              <div style={confirmText}>
                سيتم مسح ملف التفعيل فقط.
                <br />
                قاعدة البيانات وبياناتك ستبقى كما هي.
                <br />
                هل تريد المتابعة؟
              </div>
              <div style={confirmActions}>
                <button style={btnOutline} onClick={() => setLogoutConfirmOpen(false)} disabled={logoutBusy}>
                  إلغاء
                </button>
                <button style={btnDanger} onClick={deactivateLicenseOnly} disabled={logoutBusy}>
                  نعم، سجّل خروج
                </button>
              </div>
            </InnerModal>
          )}
        </div>
      )}

      <Toast />
    </div>
  );
}

/* ===== Styles ===== */
const pageWrap = { display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto", paddingBottom: 10 };

const heroCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  background: "#fff",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const heroTitle = { fontSize: 26, fontWeight: 900, color: "#111827" };

const previewBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 12,
  minWidth: 320,
  background: "#f9fafb",
};
const previewTitle = { fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 8 };
const previewRow = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const previewK = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const previewV = { fontSize: 12, color: "#111827", fontWeight: 900 };

const tabsRow = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const tabBtn = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
};
const tabBtnActive = {
  ...tabBtn,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
};

const card = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 14, display: "flex", flexDirection: "column", gap: 10 };
const cardTitle = { fontSize: 16, fontWeight: 900, color: "#111827" };
const cardHint = { fontSize: 12, color: "#6b7280", fontWeight: 900, lineHeight: 1.7 };

const formGrid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 12px" };
const actionsRow = { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10 };

const miniLabel = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const input = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none",
  backgroundColor: "#ffffff",
  width: "100%",
  boxSizing: "border-box",
};
const textarea = {
  ...input,
  minHeight: 90,
  resize: "vertical",
  lineHeight: 1.7,
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  backgroundColor: primary,
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.15)",
  whiteSpace: "nowrap",
};
const btnOutline = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  backgroundColor: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};
const btnDanger = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  backgroundColor: "#dc2626",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const grid3 = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 };
const miniCard = { border: "1px solid #e5e7eb", borderRadius: 16, padding: 12, background: "#fff", display: "flex", flexDirection: "column", gap: 10 };
const miniTitle = { fontSize: 13, fontWeight: 900, color: "#111827" };
const miniText = { fontSize: 12, color: "#6b7280", fontWeight: 900, lineHeight: 1.7 };

const innerModalWrap = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15,23,42,0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: 14,
};
const innerModal = { width: "100%", maxWidth: 720, backgroundColor: "#fff", borderRadius: 20, padding: 14, boxShadow: "0 25px 50px rgba(15,23,42,0.35)" };
const innerHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 };
const innerTitle = { fontSize: 16, fontWeight: 900, color: "#111827" };
const xBtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#6b7280", padding: "6px 10px", borderRadius: 12 };

const confirmText = { fontSize: 13, color: "#111827", fontWeight: 900, lineHeight: 1.7, padding: "4px 2px" };
const confirmActions = { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, flexWrap: "wrap" };

const toastBox = {
  position: "fixed",
  bottom: 16,
  right: 16,
  zIndex: 2000,
  border: "1px solid #e5e7eb",
  background: "#111827",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 14,
  fontWeight: 900,
  fontSize: 12,
  boxShadow: "0 20px 50px rgba(15,23,42,0.35)",
};
