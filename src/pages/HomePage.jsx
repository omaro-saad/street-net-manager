// src/pages/HomePage.jsx
// Statistics from globally preloaded data (DataContext). No per-page fetch.
import { useEffect, useMemo, useState } from "react";
import { useData } from "../DataContext";
import { useNavigate } from "react-router-dom";
import { isApiMode } from "../lib/api.js";
import LoadingLogo from "../components/LoadingLogo.jsx";
import { useMinLoadingTime } from "../hooks/useMinLoadingTime.js";

/* =========================
   Helpers
========================= */
function safeArray(x) {
  return Array.isArray(x) ? x : [];
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
function asBool(x, defaultVal = true) {
  if (x === 0 || x === "0") return false;
  if (x === 1 || x === "1") return true;
  if (typeof x === "boolean") return x;
  if (x === null || x === undefined) return defaultVal;
  return Boolean(x);
}
function pickFirst(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return null;
}
function isExpired(sub) {
  const e = pickFirst(sub?.expiresAt, sub?.expires_at, sub?.expiryAt, sub?.expiry_at, sub?.expires);
  const num = Number(e);
  if (!Number.isFinite(num) || num <= 0) return false;
  return num < Date.now();
}

/* =========================
   Home
========================= */
export default function HomePage() {
  const { data, gate, initDone } = useData() || {};
  const navigate = useNavigate();
  const displayLoading = useMinLoadingTime(isApiMode() && !initDone);
  if (displayLoading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
        <LoadingLogo />
      </div>
    );
  }

  // ✅ very light "enter" animation trigger (no layout changes)
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);

  // =========================
  // ✅ Settings (Admin) -> Home Title + Paragraph
  // =========================
  const settingsObj = useMemo(() => {
    const g = gate?.settings?.get ? gate.settings.get() : null;
    return safeObj(g || data?.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate?.settings, data?.settings]);

  const adminSettings = useMemo(() => safeObj(settingsObj.admin), [settingsObj]);

  const defaultCompanyName = "برنامج مدير شبكتك";
  const defaultCompanyAbout =
    "مدير شبكتك هو نظام متكامل لإدارة شبكات الإنترنت المحلية بطريقة ذكية ومنظمة، صُمّم خصيصًا لأصحاب الشبكات والمزوّدين الصغار والمتوسطين. يوفّر لك التطبيق لوحة تحكّم واحدة لإدارة المشتركين، الخطوط، الموزّعين، الأجهزة، الموظفين، المخزون، والحسابات المالية بكل سهولة ووضوح."
  const companyName = useMemo(() => {
    const n = clampWords(adminSettings.companyName, 4);
    return n || defaultCompanyName;
  }, [adminSettings.companyName]);

  const companyAbout = useMemo(() => {
    const p = cleanText(adminSettings.companyAbout);
    return p || defaultCompanyAbout;
  }, [adminSettings.companyAbout]);

  // =========================
  // ✅ Data from global store (preloaded on app init when in API mode)
  // =========================
  const subscribers = useMemo(() => safeArray(data?.subscribers), [data?.subscribers]);
  const distributors = useMemo(() => safeArray(data?.distributors), [data?.distributors]);
  const lines = useMemo(() => {
    const raw = data?.lines;
    return Array.isArray(raw) ? raw : safeArray(raw?.items);
  }, [data?.lines]);
  const employees = useMemo(() => {
    const d1 = safeArray(data?.employees);
    if (d1.length) return d1;
    return safeArray(data?.staff);
  }, [data?.employees, data?.staff]);

  const financeKv = useMemo(() => safeObj(data?.finance?._kv), [data?.finance?._kv]);
  const manualInvoices = useMemo(() => safeArray(financeKv.manualInvoices), [financeKv.manualInvoices]);
  const autoInvoices = useMemo(() => safeArray(financeKv.autoInvoices), [financeKv.autoInvoices]);

  const inventoryObj = useMemo(() => safeObj(data?.inventory), [data?.inventory]);
  const warehouses = useMemo(() => {
    const w1 = safeArray(inventoryObj.warehouses);
    if (w1.length) return w1;
    return safeArray(inventoryObj.list);
  }, [inventoryObj.warehouses, inventoryObj.list]);

  const sectionsCount = useMemo(() => {
    const direct = safeArray(inventoryObj.sections);
    if (direct.length) return direct.length;
    let c = 0;
    for (const w of safeArray(warehouses)) c += safeArray(w?.sections).length;
    return c;
  }, [inventoryObj.sections, warehouses]);

  const packagesItems = useMemo(() => {
    const raw = data?.packages;
    return Array.isArray(raw) ? raw : safeArray(raw?.items);
  }, [data?.packages]);

  // =========================
  // ✅ Stats (from preloaded data; update when context updates after create/update/delete)
  // =========================
  const subsStats = useMemo(() => {
    let active = 0;
    let expired = 0;
    let inactive = 0;

    for (const s of safeArray(subscribers)) {
      const sObj = safeObj(s);
      const isActive = asBool(sObj.active, true);
      const status = cleanText(sObj.status).toLowerCase();
      const exp = isExpired(sObj);

      if (!isActive || status === "inactive" || status === "disabled" || status === "off") {
        inactive += 1;
        continue;
      }
      if (exp || status === "expired" || status === "ended" || status === "finished") {
        expired += 1;
        continue;
      }
      active += 1;
    }

    return { active, expired, inactive, total: safeArray(subscribers).length };
  }, [subscribers]);

  const linesStats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const l of safeArray(lines)) {
      const isAct = asBool(l?.active, true);
      if (isAct) active += 1;
      else inactive += 1;
    }
    return { active, inactive, total: safeArray(lines).length };
  }, [lines]);

  const manualCount = useMemo(() => safeArray(manualInvoices).length, [manualInvoices]);
  const autoCount = useMemo(() => safeArray(autoInvoices).length, [autoInvoices]);

  const devicesCount = useMemo(() => {
    const items = safeArray(inventoryObj.items);
    if (items.length) return items.length;
    const d = safeArray(data?.devices);
    if (d.length) return d.length;
    let c = 0;
    for (const l of safeArray(lines)) c += safeArray(l?.devices).length;
    return c;
  }, [inventoryObj.items, data?.devices, lines]);

  // =========================
  // ✅ Tiles
  // =========================
  const tiles = [
    {
      title: "المشتركين",
      description: "إحصائيات دقيقة للمشتركين حسب الحالة.",
      stats: [
        { label: "فعّال", value: subsStats.active },
        { label: "منتهي", value: subsStats.expired },
        { label: "غير فعّال", value: subsStats.inactive },
      ],
      route: "/subscribers",
      accent: "#a855f7",
    },
    {
      title: "الموزعين",
      description: "عدد الموزعين المسجلين داخل النظام.",
      stats: [{ label: "عدد الموزعين", value: safeArray(distributors).length }],
      route: "/distributors",
      accent: "#6366f1",
    },
    {
      title: "خطوط الشبكة",
      description: "عدد الخطوط حسب حالة التفعيل.",
      stats: [
        { label: "خط فعّال", value: linesStats.active },
        { label: "خط غير فعّال", value: linesStats.inactive },
      ],
      route: "/lines",
      accent: "#22c55e",
    },
    {
      title: "الباقات",
      description: "عدد باقات المشتركين والموزعين.",
      stats: [{ label: "عدد الباقات", value: packagesItems.length }],
      route: "/packages",
      accent: "#8b5cf6",
    },
    {
      title: "الموظفين",
      description: "عدد الموظفين المسجلين داخل النظام.",
      stats: [{ label: "عدد الموظفين", value: safeArray(employees).length }],
      route: "/employee",
      accent: "#0ea5e9",
    },
    {
      title: "المالية والحسابات",
      description: "عدد الفواتير بحسب نوع الإدخال.",
      stats: [
        { label: "يدوي", value: manualCount },
        { label: "تلقائي", value: autoCount },
      ],
      route: "/finance",
      accent: "#f97316",
    }
  ];

  return (
    <div className={`hp-root ${entered ? "hp-entered" : ""}`} style={{ height: "100%" }}>
      <div className="hp-wrap">
        {/* القسم الأيمن */}
        <div className="hp-right">
          <header className="hp-fade">
            <h1 className="hp-title">أهلا بك {companyName}</h1>
            <p className="hp-about">{companyAbout}</p>
          </header>

          <section className="hp-concept hp-fade" style={{ animationDelay: "60ms" }}>
            <h2 className="hp-concept-title">مفهوم النظام</h2>
            <p className="hp-concept-body">
              هذا التطبيق يعمل كمخزن بيانات محلي للشبكة: كل شيء محفوظ على جهازك فقط. بإمكانك لاحقاً
              استخدام النسخ الاحتياطي من صفحة الإعدادات (تنزيل/استعادة) للحفاظ على بياناتك.
            </p>
          </section>
        </div>

        {/* القسم الأيسر */}
        <div className="hp-left">
          {tiles.map((tile, i) => (
            <div
              key={tile.title}
              className="hp-tile-anim"
              style={{ ["--d"]: `${120 + i * 45}ms` }}
            >
              <DashboardTile tile={tile} onClick={() => navigate(tile.route)} />
            </div>
          ))}
        </div>
      </div>

      {/* Responsive + very light animation CSS */}
      <style>{`
        .hp-wrap{
          height: 100%;
          display: flex;
          gap: 24px;
          flex-direction: row;
        }

        .hp-right{
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        .hp-left{
        flex: 1.2;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        min-width: 0;
        height: 100%;
        align-content: stretch;
        }

        /* NEW: خلي الـ wrapper يمسك ارتفاع الخلية ويعطيه للزر */
        .hp-tile-anim{
          height: 100%;
          display: flex;
        }


        .hp-title{
          font-size: 30px;
          font-weight: 800;
          margin-bottom: 10px;
          color: var(--app-text);
        }

        .hp-about{
          font-size: 15px;
          color: var(--app-text-muted);
          max-width: 420px;
          line-height: 1.7;
        }

        .hp-concept{
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.05));
          border: 1px solid var(--app-border);
        }

        .hp-concept-title{
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--app-text);
        }

        .hp-concept-body{
          font-size: 14px;
          color: var(--app-text-muted);
          line-height: 1.7;
        }

        .theme-dark .hp-concept{
          background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(139,92,246,0.12), rgba(99,102,241,0.1));
        }

        /* ===== Very light entrance animation (does NOT change tile styles) ===== */
        .hp-fade, .hp-tile-anim{
          opacity: 0;
          transform: translateY(6px);
          will-change: transform, opacity;
        }

        .hp-entered .hp-fade{
          animation: hpIn 420ms ease-out forwards;
        }

        .hp-entered .hp-tile-anim{
          animation: hpIn 420ms ease-out forwards;
          animation-delay: var(--d, 140ms);
        }

        @keyframes hpIn{
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce){
          .hp-fade, .hp-tile-anim{
            opacity: 1;
            transform: none;
            animation: none !important;
          }
        }

        /* ===== Responsive ===== */
        @media (max-width: 980px){
          .hp-wrap{ gap: 16px; }
          .hp-title{ font-size: 28px; }
          .hp-about{ max-width: 100%; }
        }

        @media (max-width: 720px){
          .hp-wrap{
            flex-direction: column;
            gap: 14px;
          }

          .hp-left{
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .hp-title{
            font-size: 24px;
            margin-bottom: 8px;
          }

          .hp-about{
            font-size: 14px;
            line-height: 1.75;
          }

          .hp-concept{
            margin-top: 10px;
            padding: 12px 12px;
            border-radius: 14px;
          }

          .hp-concept-title{ font-size: 16px; }
          .hp-concept-body{ font-size: 13px; }
        }

        @media (max-width: 420px){
          .hp-title{ font-size: 22px; }
          .hp-left{ gap: 10px; }
          .hp-concept{ padding: 11px 11px; }
        }
      `}</style>
    </div>
  );
}

function DashboardTile({ tile, onClick }) {
  const { title, description, stats, accent } = tile;

  return (
    <button
      type="button"
      className="hp-tile"
      onClick={onClick}
      style={{
        textAlign: "right",
        borderRadius: "18px",
        padding: "18px 16px",
        border: "1px solid var(--app-border)",
        backgroundColor: "var(--app-surface)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        alignItems: "flex-start",
        transition: "transform 0.12s ease-out, box-shadow 0.12s ease-out, border-color 0.12s",
        width: "100%",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "var(--app-shadow-md)";
        e.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--app-border)";
      }}
    >
      <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--app-text)" }}>{title}</span>

      <p style={{ fontSize: "14px", color: "var(--app-text-muted)", lineHeight: 1.6, marginTop: "-4px" }}>{description}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {safeArray(stats).map((s, idx) => (
          <div
            key={`${s.label}_${idx}`}
            style={{
              padding: "8px 10px",
              borderRadius: "999px",
              backgroundColor: "var(--app-surface-alt)",
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              border: "1px solid var(--app-border)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "999px", backgroundColor: accent }} />
            <span style={{ fontSize: "12px", color: "var(--app-text-muted)", fontWeight: 700 }}>{s.label}</span>
            <span style={{ fontSize: "10px", fontWeight: 900, color: "var(--app-text)" }}>{s.value}</span>
          </div>
        ))}
      </div>
    </button>
  );
}
