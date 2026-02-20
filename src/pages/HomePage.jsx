// src/pages/HomePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../DataContext";
import { useNavigate } from "react-router-dom";

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
function makeOnChanged(channel, cb) {
  if (typeof cb !== "function") return () => {};
  if (typeof channel !== "function") return () => {};
  return channel(cb);
}

/* =========================
   Home
========================= */
export default function HomePage() {
  const { data, gate } = useData() || {};
  const navigate = useNavigate();

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
  // ✅ Detect DB availability
  // =========================
  const hasSubscribersDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.subscribers &&
    typeof window.api.subscribers.list === "function";

  const hasDistributorsDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.distributors &&
    typeof window.api.distributors.list === "function";

  const hasLinesDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.lines &&
    typeof window.api.lines.list === "function";

  const hasEmployeesDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.employees &&
    typeof window.api.employees.list === "function";

  const hasInventoryDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.inventory &&
    typeof window.api.inventory.listAll === "function";

  const hasFinanceDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.finance &&
    typeof window.api.finance.getSummary === "function";

  const hasLineDevicesDb =
    typeof window !== "undefined" &&
    window.api &&
    window.api.lineDevices &&
    typeof window.api.lineDevices.listAll === "function";

  // =========================
  // ✅ DB State (local in Home)
  // =========================
  const [dbSubs, setDbSubs] = useState([]);
  const [dbDists, setDbDists] = useState([]);
  const [dbLines, setDbLines] = useState([]);
  const [dbEmployees, setDbEmployees] = useState([]);
  const [dbInventory, setDbInventory] = useState(null);
  const [dbLineDevicesCount, setDbLineDevicesCount] = useState(null);

  const [dbManualInvoicesCount, setDbManualInvoicesCount] = useState(null);
  const [dbAutoInvoicesCount, setDbAutoInvoicesCount] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // =========================
  // ✅ Loaders (DB-first)
  // =========================
  const loadSubsDb = async () => {
    if (!hasSubscribersDb) return;
    try {
      const list = await window.api.subscribers.list();
      if (!mountedRef.current) return;
      setDbSubs(safeArray(list));
    } catch {
      if (!mountedRef.current) return;
      setDbSubs([]);
    }
  };

  const loadDistsDb = async () => {
    if (!hasDistributorsDb) return;
    try {
      const list = await window.api.distributors.list();
      if (!mountedRef.current) return;
      setDbDists(safeArray(list));
    } catch {
      if (!mountedRef.current) return;
      setDbDists([]);
    }
  };

  const loadLinesDb = async () => {
    if (!hasLinesDb) return;
    try {
      const list = await window.api.lines.list();
      if (!mountedRef.current) return;
      setDbLines(safeArray(list));
    } catch {
      if (!mountedRef.current) return;
      setDbLines([]);
    }
  };

  const loadEmployeesDb = async () => {
    if (!hasEmployeesDb) return;
    try {
      const list = await window.api.employees.list();
      if (!mountedRef.current) return;
      setDbEmployees(safeArray(list));
    } catch {
      if (!mountedRef.current) return;
      setDbEmployees([]);
    }
  };

  const loadInventoryDb = async () => {
    if (!hasInventoryDb) return;
    try {
      const res = await window.api.inventory.listAll();
      if (!mountedRef.current) return;
      setDbInventory(safeObj(res));
    } catch {
      if (!mountedRef.current) return;
      setDbInventory(null);
    }
  };

  const loadFinanceDb = async () => {
    if (!hasFinanceDb) return;
    try {
      const sum = await window.api.finance.getSummary();
      if (!mountedRef.current) return;

      const manual = Number(sum?.manualInvoicesCount ?? sum?.manual ?? sum?.manualInvoices ?? null);
      const auto = Number(sum?.autoInvoicesCount ?? sum?.auto ?? sum?.autoInvoices ?? null);

      setDbManualInvoicesCount(Number.isFinite(manual) ? manual : null);
      setDbAutoInvoicesCount(Number.isFinite(auto) ? auto : null);
    } catch {
      if (!mountedRef.current) return;
      setDbManualInvoicesCount(null);
      setDbAutoInvoicesCount(null);
    }
  };

  const loadLineDevicesAll = async () => {
    if (!hasLineDevicesDb) return;
    try {
      const list = await window.api.lineDevices.listAll();
      if (!mountedRef.current) return;
      setDbLineDevicesCount(safeArray(list).length);
    } catch {
      if (!mountedRef.current) return;
      setDbLineDevicesCount(null);
    }
  };

  // =========================
  // ✅ Boot + live refresh
  // =========================
  useEffect(() => {
    let unsubs = [];

    const boot = async () => {
      if (hasSubscribersDb) await loadSubsDb();
      if (hasDistributorsDb) await loadDistsDb();
      if (hasLinesDb) await loadLinesDb();
      if (hasEmployeesDb) await loadEmployeesDb();
      if (hasInventoryDb) await loadInventoryDb();
      if (hasFinanceDb) await loadFinanceDb();
      if (hasLineDevicesDb) await loadLineDevicesAll();
    };

    boot();

    if (hasSubscribersDb && typeof window.api.subscribers.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.subscribers.onChanged, () => loadSubsDb()));
    }
    if (hasDistributorsDb && typeof window.api.distributors.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.distributors.onChanged, () => loadDistsDb()));
    }
    if (hasLinesDb && typeof window.api.lines.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.lines.onChanged, () => loadLinesDb()));
    }
    if (hasEmployeesDb && typeof window.api.employees.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.employees.onChanged, () => loadEmployeesDb()));
    }
    if (hasInventoryDb && typeof window.api.inventory.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.inventory.onChanged, () => loadInventoryDb()));
    }
    if (hasFinanceDb && typeof window.api.finance.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.finance.onChanged, () => loadFinanceDb()));
    }
    if (hasLineDevicesDb && typeof window.api.lineDevices.onChanged === "function") {
      unsubs.push(makeOnChanged(window.api.lineDevices.onChanged, () => loadLineDevicesAll()));
    }

    const needPolling =
      (hasSubscribersDb && typeof window.api.subscribers.onChanged !== "function") ||
      (hasDistributorsDb && typeof window.api.distributors.onChanged !== "function") ||
      (hasLinesDb && typeof window.api.lines.onChanged !== "function") ||
      (hasEmployeesDb && typeof window.api.employees.onChanged !== "function") ||
      (hasInventoryDb && typeof window.api.inventory.onChanged !== "function") ||
      (hasFinanceDb && typeof window.api.finance.onChanged !== "function") ||
      (hasLineDevicesDb && typeof window.api.lineDevices.onChanged !== "function");

    let t = null;
    if (needPolling) {
      t = setInterval(() => {
        if (hasSubscribersDb) loadSubsDb();
        if (hasDistributorsDb) loadDistsDb();
        if (hasLinesDb) loadLinesDb();
        if (hasEmployeesDb) loadEmployeesDb();
        if (hasInventoryDb) loadInventoryDb();
        if (hasFinanceDb) loadFinanceDb();
        if (hasLineDevicesDb) loadLineDevicesAll();
      }, 2000);
    }

    return () => {
      for (const u of unsubs) {
        try {
          if (typeof u === "function") u();
        } catch {}
      }
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasSubscribersDb,
    hasDistributorsDb,
    hasLinesDb,
    hasEmployeesDb,
    hasInventoryDb,
    hasFinanceDb,
    hasLineDevicesDb,
  ]);

  // =========================
  // ✅ Unified sources: DB-first -> gate -> data
  // =========================
  const subscribers = useMemo(() => {
    if (hasSubscribersDb) return safeArray(dbSubs);
    const g = gate?.subscribers?.list;
    if (Array.isArray(g)) return g;
    return safeArray(data?.subscribers);
  }, [hasSubscribersDb, dbSubs, gate?.subscribers?.list, data?.subscribers]);

  const distributors = useMemo(() => {
    if (hasDistributorsDb) return safeArray(dbDists);
    const g = gate?.distributors?.list;
    if (Array.isArray(g)) return g;
    return safeArray(data?.distributors);
  }, [hasDistributorsDb, dbDists, gate?.distributors?.list, data?.distributors]);

  const lines = useMemo(() => {
    if (hasLinesDb) return safeArray(dbLines);
    const g = gate?.lines?.list;
    if (Array.isArray(g)) return g;
    return safeArray(data?.lines);
  }, [hasLinesDb, dbLines, gate?.lines?.list, data?.lines]);

  const employees = useMemo(() => {
    if (hasEmployeesDb) return safeArray(dbEmployees);
    const g = gate?.employees?.list;
    if (Array.isArray(g)) return g;

    const d1 = safeArray(data?.employees);
    if (d1.length) return d1;

    const d2 = safeArray(data?.staff);
    if (d2.length) return d2;

    return [];
  }, [hasEmployeesDb, dbEmployees, gate?.employees?.list, data?.employees, data?.staff]);

  const finance = useMemo(() => safeObj(data?.finance), [data?.finance]);
  const manualInvoices = useMemo(() => safeArray(finance.manualInvoices), [finance.manualInvoices]);
  const autoInvoices = useMemo(() => safeArray(finance.autoInvoices), [finance.autoInvoices]);

  const inventoryObj = useMemo(() => {
    if (hasInventoryDb) return safeObj(dbInventory);
    return safeObj(data?.inventory);
  }, [hasInventoryDb, dbInventory, data?.inventory]);

  const warehouses = useMemo(() => {
    const w1 = safeArray(inventoryObj.warehouses);
    if (w1.length) return w1;
    const w2 = safeArray(inventoryObj.list);
    if (w2.length) return w2;
    return [];
  }, [inventoryObj.warehouses, inventoryObj.list]);

  const sectionsCount = useMemo(() => {
    const direct = safeArray(inventoryObj.sections);
    if (direct.length) return direct.length;

    let c = 0;
    for (const w of safeArray(warehouses)) c += safeArray(w?.sections).length;
    return c;
  }, [inventoryObj.sections, warehouses]);

  // =========================
  // ✅ Stats
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

  const manualCount = useMemo(() => {
    if (typeof dbManualInvoicesCount === "number") return dbManualInvoicesCount;
    return safeArray(manualInvoices).length;
  }, [dbManualInvoicesCount, manualInvoices]);

  const autoCount = useMemo(() => {
    if (typeof dbAutoInvoicesCount === "number") return dbAutoInvoicesCount;
    return safeArray(autoInvoices).length;
  }, [dbAutoInvoicesCount, autoInvoices]);

  const devicesCount = useMemo(() => {
    if (typeof dbLineDevicesCount === "number") return dbLineDevicesCount;

    const d = safeArray(data?.devices);
    if (d.length) return d.length;

    let c = 0;
    for (const l of safeArray(lines)) c += safeArray(l?.devices).length;
    return c;
  }, [dbLineDevicesCount, data?.devices, lines]);

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
      route: "/plans",
      accent: "#22c55e",
    },
    {
      title: "الاجهزة والمعدات",
      description: "إحصائيات المخازن والأقسام والأجهزة.",
      stats: [
        { label: "مخازن", value: safeArray(warehouses).length },
        { label: "أقسام", value: sectionsCount },
        { label: "أجهزة", value: devicesCount },
      ],
      route: "/devices",
      accent: "#ec4899",
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
    },
  ];

  return (
    <div className={`hp-root ${entered ? "hp-entered" : ""}`} style={{ height: "100%" }}>
      <div className="hp-wrap">
        {/* القسم الأيمن */}
        <div className="hp-right">
          <header className="hp-fade">
            <h1 className="hp-title">أهلاً بك في {companyName}</h1>
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
          color: #111827;
        }

        .hp-about{
          font-size: 15px;
          color: #6b7280;
          max-width: 420px;
          line-height: 1.7;
        }

        .hp-concept{
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.05));
          border: 1px solid rgba(148,163,184,0.5);
        }

        .hp-concept-title{
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 6px;
          color: #111827;
        }

        .hp-concept-body{
          font-size: 14px;
          color: #4b5563;
          line-height: 1.7;
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
      onClick={onClick}
      style={{
        textAlign: "right",
        borderRadius: "18px",
        padding: "18px 16px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
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
        e.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.07)";
        e.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      <span style={{ fontSize: "16px", fontWeight: 700, color: "#374151" }}>{title}</span>

      <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.6, marginTop: "-4px" }}>{description}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {safeArray(stats).map((s, idx) => (
          <div
            key={`${s.label}_${idx}`}
            style={{
              padding: "8px 10px",
              borderRadius: "999px",
              backgroundColor: "#f9fafb",
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              border: "1px solid #e5e7eb",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "999px", backgroundColor: accent }} />
            <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700 }}>{s.label}</span>
            <span style={{ fontSize: "10px", fontWeight: 900, color: "#111827" }}>{s.value}</span>
          </div>
        ))}
      </div>
    </button>
  );
}
