// FinancePage.jsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { useData } from "../DataContext";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAlert } from "../contexts/AlertContext.jsx";
import ReadOnlyBanner from "../components/ReadOnlyBanner.jsx";
import LoadingLogo from "../components/LoadingLogo.jsx";
import { useMinLoadingTime } from "../hooks/useMinLoadingTime.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import LoadingOverlay from "../components/LoadingOverlay.jsx";
import { READ_ONLY_MESSAGE, isApiMode, apiFinanceGet, apiFinancePut } from "../lib/api.js";
import { safeArray, safeObj, nowMs, genId, fmtMoney } from "../utils/helpers.js";
import { usePageTips } from "../hooks/usePageTips.js";
import PageTipsModal from "../components/PageTipsModal.jsx";
import { PAGE_TIPS } from "../constants/pageTips.js";
import { theme } from "../theme.js";
import {
  pageWrap,
  input,
  h1,
  miniLabel,
  btnPrimary,
  btnDanger,
  btnTinyDanger,
  btnTiny,
  btnGhost,
  iconBtn,
  modalOverlay,
  modalCard,
  modalHeader,
  modalTitle,
  chip,
  chipPrimary,
  chipIncome,
  chipExpense,
  emptyBox,
  emptyText,
  grid2,
  contentCenterWrap,
} from "../styles/shared.js";

function todayLocalISO() {
  const d = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toNum(x) {
  const s = String(x ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" • ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return "";
}
/* =========================
   Constants
   ========================= */
const MANUAL_TYPES = ["دخل", "مصروف", "سلفة", "بيع استثنائي", "صيانة", "أخرى"];
const PAY_METHODS = ["كاش", "تحويل", "آجل", "أخرى"];

/* =========================
   In-memory FinancePage (NO DB)
   ========================= */
const TIPS_PAGE_KEY = "finance";

export default function FinancePage() {
  const { data, setData, gate } = useData();
  const { token } = useAuth();
  const { showTips, handleTipsDone, handleTipsLinkClick } = usePageTips(TIPS_PAGE_KEY);

  const useFinanceApi = isApiMode() && !!token;

  const finance = gate?.finance;
  const financeReady = !!finance?.isReady;

  const [tab, setTab] = useState("manual"); // manual | auto
  const [financeLoading, setFinanceLoading] = useState(false);

  // Load finance from API when in API mode
  useEffect(() => {
    if (!useFinanceApi || !token) {
      setFinanceLoading(false);
      return;
    }
    setFinanceLoading(true);
    let cancelled = false;
    (async () => {
      const res = await apiFinanceGet(token);
      if (cancelled) return;
      setFinanceLoading(false);
      if (res.ok && res.data) setData((prev) => ({ ...prev, finance: { _kv: res.data }, updatedAt: nowMs() }));
    })();
    return () => { cancelled = true; };
  }, [useFinanceApi, token, setData]);

  // -------------------------
  // Source: data.finance (in-memory or synced from API)
  // -------------------------
  const finKv = safeObj(data?.finance?._kv ?? data?.finance);
  const manualAll = safeArray(finKv.manualInvoices);
  const autoAll = safeArray(finKv.autoInvoices);
  const pricing = { enabled: true, defaultCurrency: "₪", ...safeObj(finKv.pricing) };

  const currency = String(pricing?.defaultCurrency || "₪");

  const { getLimit, canWrite } = useAuth();
  const { showPlanLimitAlert, showReadOnlyAlert, showValidationAlert, showErrorAlert, showSuccessAlert, showConfirmAlert } = useAlert();
  const financeManualLimit = getLimit("financeManual");
  const financeManualAtLimit = financeManualLimit != null && manualAll.length >= financeManualLimit;
  const canWriteFinance = canWrite("finance");
  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  // Persist full finance KV to API when in API mode
  const persistFinanceKv = useCallback(
    async (mergedKv) => {
      if (!useFinanceApi || !token) return;
      const res = await apiFinancePut(token, mergedKv);
      if (!res.ok) showErrorAlert(res.error || "فشل حفظ المالية.");
    },
    [useFinanceApi, token, showErrorAlert]
  );

  // -------------------------
  // MANUAL
  // -------------------------
  const [qManual, setQManual] = useState("");
  const [sortManual, setSortManual] = useState("newest");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  const manualFiltered = useMemo(() => {
    let arr = manualAll.slice();

    if (filterType !== "all") arr = arr.filter((x) => x.type === filterType);
    if (filterDate !== "all") arr = arr.filter((x) => x.date === filterDate);

    if (qManual.trim()) {
      const query = qManual.trim().toLowerCase();
      arr = arr.filter((x) => {
        const title = String(x.title || "").toLowerCase();
        const note = String(x.note || "").toLowerCase();
        const date = String(x.date || "").toLowerCase();
        const amount = String(x.amount ?? "").toLowerCase();
        const method = String(x.payMethod || "").toLowerCase();
        return title.includes(query) || note.includes(query) || date.includes(query) || amount.includes(query) || method.includes(query);
      });
    }

    arr.sort((a, b) => {
      if (sortManual === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortManual === "amountHigh") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortManual === "amountLow") return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });

    return arr;
  }, [manualAll, qManual, sortManual, filterType, filterDate]);

  const manualTotal = useMemo(() => {
    return manualFiltered.reduce((sum, inv) => {
      const amt = Number(inv.amount) || 0;
      const sign = inv.type === "دخل" ? 1 : -1;
      return sum + sign * amt;
    }, 0);
  }, [manualFiltered]);

  const todayKey = todayLocalISO();
  const todayTotal = useMemo(() => {
    return manualAll
      .filter((x) => x.date === todayKey)
      .reduce((sum, inv) => {
        const amt = Number(inv.amount) || 0;
        const sign = inv.type === "دخل" ? 1 : -1;
        return sum + sign * amt;
      }, 0);
  }, [manualAll, todayKey]);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingManualId, setEditingManualId] = useState(null);

  const emptyManualForm = {
    date: todayLocalISO(),
    type: "مصروف",
    title: "",
    amount: "",
    payMethod: "كاش",
    note: "",
  };
  const [manualForm, setManualForm] = useState(emptyManualForm);

  const openAddManual = () => {
    setEditingManualId(null);
    setManualForm({ ...emptyManualForm, date: todayLocalISO() });
    setManualModalOpen(true);
  };

  const openEditManual = (inv) => {
    setEditingManualId(inv.id);
    setManualForm({
      date: inv.date || todayLocalISO(),
      type: inv.type || "مصروف",
      title: inv.title || "",
      amount: String(inv.amount ?? ""),
      payMethod: inv.payMethod || "كاش",
      note: inv.note || "",
    });
    setManualModalOpen(true);
  };

  const persistManual = async (next) => {
    await finance.set("manualInvoices", next);
    await persistFinanceKv({ ...finKv, manualInvoices: next });
  };

  const saveManualInvoice = async (e) => {
    e.preventDefault();
    if (!financeReady) return showErrorAlert("المالية غير جاهزة.");
    if (!canWriteFinance) {
      showReadOnlyAlert();
      return;
    }
    if (!editingManualId && financeManualAtLimit) {
      showPlanLimitAlert();
      return;
    }

    const date = String(manualForm.date || "").trim();
    const type = String(manualForm.type || "").trim();
    const title = String(manualForm.title || "").trim();
    const amount = toNum(manualForm.amount);
    const payMethod = String(manualForm.payMethod || "").trim();
    const note = String(manualForm.note || "").trim();

    if (!date) return showValidationAlert("حدد التاريخ.", "التاريخ");
    if (!MANUAL_TYPES.includes(type)) return showValidationAlert("نوع الفاتورة غير صحيح.", "النوع");
    if (!title) return showValidationAlert("اكتب عنوان/سبب الفاتورة.", "العنوان");
    if (amount === null || amount <= 0) return showValidationAlert("المبلغ لازم يكون رقم أكبر من 0.", "المبلغ");
    if (!PAY_METHODS.includes(payMethod)) return showValidationAlert("طريقة الدفع غير صحيحة.", "طريقة الدفع");

    const id = editingManualId ? editingManualId : genId("man");
    const createdAt = editingManualId
      ? (manualAll.find((x) => String(x.id) === String(id))?.createdAt || nowMs())
      : nowMs();

    const row = { id, createdAt, updatedAt: nowMs(), date, type, title, amount, payMethod, note };

    const next = editingManualId
      ? manualAll.map((x) => (String(x.id) === String(id) ? row : x))
      : [row, ...manualAll];

    await execute(async () => {
      await persistManual(next);
      setManualModalOpen(false);
      setEditingManualId(null);
    });
  };

  const deleteManualInvoice = async (id) => {
    if (!canWriteFinance) return showReadOnlyAlert();
    if (!financeReady) return showErrorAlert("المالية غير جاهزة.");
    showConfirmAlert({
      message: "حذف الفاتورة اليدوية؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        const key = String(id || "").trim();
        const next = manualAll.filter((x) => String(x.id) !== key);
        execute(() => persistManual(next));
      },
    });
  };

  // -------------------------
  // AUTO (from 3 pages only)
  // -------------------------
  const [source, setSource] = useState("all"); // subscriber | distributor | employee | all
  const [qAuto, setQAuto] = useState("");
  const [sortAuto, setSortAuto] = useState("newest");

  const autoFiltered = useMemo(() => {
    let arr = autoAll.slice();

    if (source !== "all") arr = arr.filter((x) => String(x.source) === source);

    if (qAuto.trim()) {
      const query = qAuto.trim().toLowerCase();
      arr = arr.filter((x) => {
        const name = String(x.name || "").toLowerCase();
        const phone = String(x.phone || "").toLowerCase();
        const kind = String(x.kind || "").toLowerCase();
        const date = String(x.date || "").toLowerCase();
        const amount = String(x.amount ?? "").toLowerCase();
        const details = String(asText(x.details) || "").toLowerCase();
        const status = String(x.status || "").toLowerCase();
        return (
          name.includes(query) ||
          phone.includes(query) ||
          kind.includes(query) ||
          date.includes(query) ||
          amount.includes(query) ||
          details.includes(query) ||
          status.includes(query)
        );
      });
    }

    arr.sort((a, b) => {
      if (sortAuto === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortAuto === "amountHigh") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortAuto === "amountLow") return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });

    return arr;
  }, [autoAll, source, qAuto, sortAuto]);

  const autoTotal = useMemo(() => {
    return autoFiltered.reduce((s, x) => {
      const st = String(x.status || "approved");
      if (st === "pending") return s;
      return s + (Number(x.amount) || 0);
    }, 0);
  }, [autoFiltered]);

  const persistAuto = async (next) => {
    await finance.set("autoInvoices", next);
    await persistFinanceKv({ ...finKv, autoInvoices: next });
  };

  const approveAutoInvoice = async (inv) => {
    if (!canWriteFinance) return showReadOnlyAlert();
    if (!financeReady) return showErrorAlert("المالية غير جاهزة.");
    const id = String(inv?.id || "").trim();
    if (!id) return;

    const next = autoAll.map((x) => {
      if (String(x.id) !== id) return x;
      return { ...x, status: "approved", approvedAt: nowMs(), updatedAt: nowMs() };
    });

    await execute(() => persistAuto(next));
  };

  const deleteAutoInvoice = async (inv) => {
    if (!canWriteFinance) return showReadOnlyAlert();
    if (!financeReady) return showErrorAlert("المالية غير جاهزة.");
    const id = String(inv?.id || "").trim();
    if (!id) return;
    showConfirmAlert({
      message: "حذف الحركة من الحساب الآلي؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        const next = autoAll.filter((x) => String(x.id) !== id);
        execute(() => persistAuto(next));
      },
    });
  };

  // -------------------------
  // Dump / Clear
  // -------------------------
  const [dumpOpen, setDumpOpen] = useState(false);
  const [dumpType, setDumpType] = useState("manual"); // manual | auto
  const [dumpAction, setDumpAction] = useState("download"); // download | clear

  function downloadTextFile(filename, content) {
    const text = String(content ?? "");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const buildManualText = useCallback(() => {
    const list = manualAll.slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    const lines = [];
    lines.push("=".repeat(40));
    lines.push("تقرير الفواتير اليدوية");
    lines.push(`التاريخ: ${todayLocalISO()}`);
    lines.push(`العملة: ${currency}`);
    lines.push(`عدد الفواتير: ${list.length}`);
    lines.push("=".repeat(40));
    lines.push("");

    list.forEach((inv, idx) => {
      const type = String(inv.type || "—");
      const sign = type === "دخل" ? "+" : "-";
      lines.push(`[${idx + 1}]`);
      lines.push(`التاريخ: ${inv.date || "—"}`);
      lines.push(`النوع: ${type}`);
      lines.push(`العنوان: ${inv.title || "—"}`);
      lines.push(`طريقة الدفع: ${inv.payMethod || "—"}`);
      lines.push(`المبلغ: ${sign} ${fmtMoney(inv.amount)} ${currency}`);
      if (inv.note) lines.push(`ملاحظة: ${asText(inv.note)}`);
      lines.push("");
      lines.push("-".repeat(40));
      lines.push("");
    });

    return lines.join("\n");
  }, [manualAll, currency]);

  const buildAutoText = useCallback(() => {
    const list = autoAll.slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    const lines = [];
    lines.push("=".repeat(40));
    lines.push("تقرير الحسابات الآلية — من الصفحات الثلاث فقط");
    lines.push(`التاريخ: ${todayLocalISO()}`);
    lines.push(`العملة: ${currency}`);
    lines.push(`عدد الحركات: ${list.length}`);
    lines.push("=".repeat(40));
    lines.push("");

    list.forEach((inv, idx) => {
      const st = String(inv.status || "approved");
      const stateLabel = st === "pending" ? "بانتظار القبول" : "معتمد";
      lines.push(`[${idx + 1}] ${inv.kind || "—"} (${stateLabel})`);
      lines.push(`المصدر: ${inv.source || "—"}`);
      lines.push(`التاريخ: ${inv.date || "—"}`);
      lines.push(`الاسم: ${inv.name || "—"}`);
      lines.push(`الجوال: ${inv.phone || "—"}`);
      lines.push(`المبلغ: ${fmtMoney(inv.amount)} ${currency}`);
      if (inv.details) lines.push(`تفاصيل: ${asText(inv.details)}`);
      lines.push("");
      lines.push("-".repeat(40));
      lines.push("");
    });

    return lines.join("\n");
  }, [autoAll, currency]);

  const clearManualAll = useCallback(async () => {
    if (!financeReady) return showErrorAlert("المالية غير جاهزة.");
    showConfirmAlert({
      message: "تفريغ (حذف) كل الفواتير اليدوية؟",
      confirmLabel: "تفريغ",
      onConfirm: () => {
        execute(async () => {
          await finance.set("manualInvoices", []);
          await persistFinanceKv({ ...finKv, manualInvoices: [] });
          showSuccessAlert("تم تفريغ الفواتير اليدوية.");
        });
      },
    });
  }, [financeReady, finance, showConfirmAlert, showSuccessAlert, persistFinanceKv, finKv, execute]);

  const clearAutoAll = useCallback(async () => {
    if (!financeReady) return showErrorAlert("المالية غير جاهزة.");
    showConfirmAlert({
      message: "تفريغ (حذف) كل الفواتير الآلية؟",
      confirmLabel: "تفريغ",
      onConfirm: () => {
        execute(async () => {
          await finance.set("autoInvoices", []);
          await persistFinanceKv({ ...finKv, autoInvoices: [] });
          showSuccessAlert("تم تفريغ الفواتير الآلية.");
        });
      },
    });
  }, [financeReady, finance, showConfirmAlert, showSuccessAlert, persistFinanceKv, finKv, execute]);

  const runDump = async () => {
    if (dumpAction === "clear" && !canWriteFinance) return showReadOnlyAlert();
    const stamp = todayLocalISO();
    if (dumpAction === "download") {
      if (dumpType === "manual") downloadTextFile(`manual_invoices_${stamp}.txt`, buildManualText());
      else downloadTextFile(`auto_invoices_${stamp}.txt`, buildAutoText());
      setDumpOpen(false);
      return;
    }
    if (dumpType === "manual") await clearManualAll();
    else await clearAutoAll();
    setDumpOpen(false);
  };

  // -------------------------
  // Render guards
  // -------------------------
  const displayLoading = useMinLoadingTime(useFinanceApi && financeLoading);
  if (displayLoading) {
    return (
      <div style={pageWrap}>
        <div style={contentCenterWrap}>
          <LoadingLogo />
        </div>
      </div>
    );
  }

  if (!financeReady) {
    return (
      <div style={pageWrap}>
        <div style={contentCenterWrap}>
          <div style={sectionCard}>
            <div style={sectionTitle}>المالية والحسابات</div>
            <div style={emptyBox}>
              ❌ المالية غير جاهزة.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <PageTipsModal open={showTips} slides={PAGE_TIPS[TIPS_PAGE_KEY]} onDone={handleTipsDone} onLinkClick={handleTipsLinkClick} />
      <LoadingOverlay visible={actionLoading} />
      {!canWriteFinance && <ReadOnlyBanner />}
      <div style={topRow}>
        <div>
          <h1 style={h1}>المالية والحسابات</h1>
        </div>

        {tab === "manual" ? (
          <div style={totalCard}>
            <div style={totalLabel}>صافي اليوم ({todayKey})</div>
            <div style={totalValue}>
              {fmtMoney(todayTotal)} {currency}
            </div>
          </div>
        ) : (
          <div style={totalCard}>
            <div style={totalLabel}>إجمالي المعروض (بدون الطلبات)</div>
            <div style={totalValue}>
              {fmtMoney(autoTotal)} {currency}
            </div>
          </div>
        )}
      </div>

      {/* Tabs + Dump */}
      <div style={tabsWrap}>
        <div style={tabsRight}>
          <button style={tabBtn(tab === "manual")} onClick={() => setTab("manual")}>
            الفواتير اليدوية
          </button>
          <button style={tabBtn(tab === "auto")} onClick={() => setTab("auto")}>
            الحسابات الآلية
          </button>
        </div>

        <div style={tabsLeft}>
          <button style={tabBtnSpecial(false)} onClick={() => setDumpOpen(true)} disabled={actionLoading} title="تنزيل/تفريغ الفواتير">
            📦 تفريغ الفواتير
          </button>
        </div>
      </div>

      {/* MANUAL */}
      {tab === "manual" && (
        <>
          <div style={filtersCard}>
            <div style={filtersRow}>
              <div style={{ minWidth: 220 }}>
                <div style={miniLabel}>نوع</div>
                <select style={input} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="all">الكل</option>
                  {MANUAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: 220 }}>
                <div style={miniLabel}>تاريخ</div>
                <select style={input} value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
                  <option value="all">الكل</option>
                  {Array.from(new Set(manualAll.map((x) => x.date).filter(Boolean)))
                    .sort()
                    .reverse()
                    .map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={miniLabel}>بحث</div>
                <input style={input} value={qManual} onChange={(e) => setQManual(e.target.value)} placeholder="عنوان / ملاحظة / مبلغ..." />
              </div>

              <div style={{ minWidth: 220 }}>
                <div style={miniLabel}>ترتيب</div>
                <select style={input} value={sortManual} onChange={(e) => setSortManual(e.target.value)}>
                  <option value="newest">الأحدث</option>
                  <option value="oldest">الأقدم</option>
                  <option value="amountHigh">الأعلى مبلغ</option>
                  <option value="amountLow">الأقل مبلغ</option>
                </select>
              </div>
            </div>

            <div style={actionBar}>
              <button
                style={btnPrimary}
                onClick={() => { if (financeManualAtLimit) { showPlanLimitAlert(); return; } openAddManual(); }}
                disabled={!canWriteFinance || actionLoading}
                title={!canWriteFinance ? READ_ONLY_MESSAGE : undefined}
              >
                + إضافة فاتورة
              </button>
            </div>
          </div>

          <div style={sectionCard}>
            <div style={sectionHeader}>
              <div style={sectionTitle}>الفواتير اليدوية</div>
              <div style={sectionHint}>
                صافي المعروض: {fmtMoney(manualTotal)} {currency}
              </div>
            </div>

            {manualFiltered.length === 0 ? (
              <div style={contentCenterWrap}>
                <div style={emptyBox}>لا يوجد فواتير يدوية بعد.</div>
              </div>
            ) : (
              <div style={list}>
                {manualFiltered.map((inv) => {
                  const sign = inv.type === "دخل" ? "+" : "-";
                  const pillStyle = inv.type === "دخل" ? chipIncome : chipExpense;
                  return (
                    <div key={inv.id} style={row}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={rowTitle}>{inv.title || "—"}</div>
                          <span style={pillStyle}>{inv.type}</span>
                          <span style={chip}>{inv.date || "—"}</span>
                          <span style={chip}>{inv.payMethod || "—"}</span>
                        </div>
                        {inv.note ? <div style={noteText}>{asText(inv.note)}</div> : null}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <div style={amount}>
                          {sign} {fmtMoney(inv.amount)} {currency}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={btnTiny} onClick={() => openEditManual(inv)} disabled={!canWriteFinance || actionLoading} title={!canWriteFinance ? READ_ONLY_MESSAGE : undefined}>
                            تعديل
                          </button>
                          <button style={btnTinyDanger} onClick={() => deleteManualInvoice(inv.id)} disabled={!canWriteFinance || actionLoading} title={!canWriteFinance ? READ_ONLY_MESSAGE : undefined}>
                            حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual Modal */}
          {manualModalOpen && (
            <div style={modalOverlay} onMouseDown={() => setManualModalOpen(false)}>
              <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
                <div style={modalHeader}>
                  <div style={modalTitle}>{editingManualId ? "تعديل فاتورة" : "إضافة فاتورة"}</div>
                  <button style={iconBtn} onClick={() => setManualModalOpen(false)}>
                    ✕
                  </button>
                </div>

                <form onSubmit={saveManualInvoice} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={grid2}>
                    <div>
                      <div style={miniLabel}>التاريخ</div>
                      <input style={input} type="date" value={manualForm.date} onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>النوع</div>
                      <select style={input} value={manualForm.type} onChange={(e) => setManualForm((f) => ({ ...f, type: e.target.value }))}>
                        {MANUAL_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={miniLabel}>العنوان / السبب</div>
                      <input style={input} value={manualForm.title} onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>المبلغ</div>
                      <input style={input} value={manualForm.amount} onChange={(e) => setManualForm((f) => ({ ...f, amount: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>طريقة الدفع</div>
                      <select style={input} value={manualForm.payMethod} onChange={(e) => setManualForm((f) => ({ ...f, payMethod: e.target.value }))}>
                        {PAY_METHODS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={miniLabel}>ملاحظة (اختياري)</div>
                      <textarea style={{ ...input, minHeight: 90, resize: "vertical" }} value={manualForm.note} onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button type="button" style={btnGhost} onClick={() => setManualModalOpen(false)}>
                      إلغاء
                    </button>
                    <button type="submit" style={btnPrimary} disabled={actionLoading}>
                      حفظ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* AUTO */}
      {tab === "auto" && (
        <>
          <div style={filtersCard}>
            <div style={filtersRow}>
              <div style={{ minWidth: 240 }}>
                <div style={miniLabel}>المصدر</div>
                <select style={input} value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="all">الكل</option>
                  <option value="subscriber">مشتركين</option>
                  <option value="distributor">موزعين</option>
                  <option value="employee">موظفين</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={miniLabel}>بحث</div>
                <input style={input} value={qAuto} onChange={(e) => setQAuto(e.target.value)} placeholder="اسم / رقم / نوع / تاريخ / مبلغ / تفاصيل..." />
              </div>

              <div style={{ minWidth: 240 }}>
                <div style={miniLabel}>ترتيب</div>
                <select style={input} value={sortAuto} onChange={(e) => setSortAuto(e.target.value)}>
                  <option value="newest">الأحدث</option>
                  <option value="oldest">الأقدم</option>
                  <option value="amountHigh">الأعلى مبلغ</option>
                  <option value="amountLow">الأقل مبلغ</option>
                </select>
              </div>
            </div>
          </div>

          <div style={sectionCard}>
            <div style={sectionHeader}>
              <div style={sectionTitle}>الحسابات الآلية</div>
              <div style={sectionHint}>
                {autoFiltered.length} حركة • من المشتركين والموزعين والموظفين • الطلبات لا تؤثر على الإجمالي حتى القبول
              </div>
            </div>
            <div style={{ ...emptyText, marginBottom: 12, fontWeight: 500 }}>
              الفواتير الآلية تُضاف تلقائياً من: صفحة المشتركين (اشتراكات)، صفحة الموزعين (فاتورة موزع)، صفحة الموظفين (راتب / فاتورة موظف).
            </div>

            {autoFiltered.length === 0 ? (
              <div style={contentCenterWrap}>
                <div style={emptyBox}>
                  لا توجد حركات آلية بعد. أضف فواتير من صفحة المشتركين أو الموزعين أو الموظفين لتظهر هنا.
                </div>
              </div>
            ) : (
              <div style={list}>
                {autoFiltered.map((inv) => {
                  const st = String(inv.status || "approved");
                  const isPending = st === "pending";
                  const sourceLabel =
                    inv.source === "subscriber" ? "مشترك" : inv.source === "distributor" ? "موزع" : inv.source === "employee" ? "موظف" : "—";

                  return (
                    <div key={inv.id} style={row}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={rowTitle}>{inv.kind || "—"}</div>
                          <span style={chipPrimary}>{sourceLabel}</span>
                          <span style={chip}>{inv.date || "—"}</span>
                          {isPending ? <span style={chipPending}>بانتظار القبول</span> : <span style={chipApproved}>معتمد</span>}
                        </div>

                        <div style={meta}>
                          <span>👤 {inv.name || "—"}</span>
                          <span>📞 {inv.phone || "—"}</span>
                        </div>

                        {inv.details ? <div style={noteText}>{asText(inv.details)}</div> : null}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <div style={amount}>
                          {fmtMoney(inv.amount)} {currency}
                        </div>

                        {isPending ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button style={btnTinyOk} onClick={() => approveAutoInvoice(inv)} disabled={!canWriteFinance || actionLoading} title={!canWriteFinance ? READ_ONLY_MESSAGE : undefined}>
                              قبول
                            </button>
                            <button style={btnTinyDanger} onClick={() => deleteAutoInvoice(inv)} disabled={!canWriteFinance || actionLoading} title={!canWriteFinance ? READ_ONLY_MESSAGE : undefined}>
                              رفض / حذف
                            </button>
                          </div>
                        ) : (
                          <button style={btnTinyDanger} onClick={() => deleteAutoInvoice(inv)} disabled={!canWriteFinance || actionLoading} title={!canWriteFinance ? READ_ONLY_MESSAGE : undefined}>
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dump Modal */}
      {dumpOpen && (
        <div style={modalOverlay} onMouseDown={() => setDumpOpen(false)}>
          <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>تفريغ الفواتير</div>
              <button style={iconBtn} onClick={() => setDumpOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={grid2}>
                <div>
                  <div style={miniLabel}>النوع</div>
                  <select style={input} value={dumpType} onChange={(e) => setDumpType(e.target.value)}>
                    <option value="manual">الفواتير اليدوية</option>
                    <option value="auto">الفواتير الآلية</option>
                  </select>
                </div>

                <div>
                  <div style={miniLabel}>العملية</div>
                  <select style={input} value={dumpAction} onChange={(e) => setDumpAction(e.target.value)}>
                    <option value="download">⬇ تنزيل كنص مرتب</option>
                    <option value="clear">🗑 حذف كامل (تفريغ)</option>
                  </select>
                </div>
              </div>

              <div style={emptyBox}>سيتم تنزيل أو تفريغ بيانات المالية.</div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button style={btnGhost} onClick={() => setDumpOpen(false)}>
                  إلغاء
                </button>
                <button style={dumpAction === "clear" ? btnDanger : btnPrimary} onClick={runDump} disabled={dumpAction === "clear" && !canWriteFinance} title={dumpAction === "clear" && !canWriteFinance ? READ_ONLY_MESSAGE : undefined}>
                  {dumpAction === "clear" ? "تفريغ الآن" : "تنزيل الآن"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Page-specific styles (shared tokens imported above) ===== */
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };

const totalCard = { border: `1px solid ${theme.border}`, background: theme.surface, borderRadius: 18, padding: "12px 14px", minWidth: 280 };
const totalLabel = { fontSize: 12, color: theme.textMuted, fontWeight: 900 };
const totalValue = { fontSize: 22, color: theme.text, fontWeight: 900, marginTop: 4 };

const tabsWrap = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", border: `1px solid ${theme.border}`, background: theme.surface, borderRadius: 18, padding: 10 };
const tabsRight = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const tabsLeft = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

const tabBtn = (active) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: active ? "none" : `1px solid ${theme.border}`,
  background: active ? (theme.primaryGradient || theme.primary) : theme.surface,
  color: active ? "#fff" : theme.text,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 13,
  boxShadow: active ? "0 12px 30px rgba(15,23,42,0.12)" : "none",
});
const tabBtnSpecial = () => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: `1px solid ${theme.primary}`,
  background: theme.surfaceAlt,
  color: theme.primary,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 13,
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
});

const filtersCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };
const actionBar = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

const sectionCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
const sectionTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const sectionHint = { fontSize: 12, fontWeight: 900, color: theme.textMuted };

const list = { display: "flex", flexDirection: "column", gap: 10 };
const row = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" };
const rowTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const noteText = { fontSize: 12, color: theme.textMuted, lineHeight: 1.7 };
const meta = { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: theme.textMuted, lineHeight: 1.6 };

const chipPending = { padding: "6px 10px", borderRadius: 999, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", fontWeight: 900, fontSize: 12 };
const chipApproved = { padding: "6px 10px", borderRadius: 999, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", fontWeight: 900, fontSize: 12 };

const amount = { fontSize: 16, fontWeight: 900, color: theme.text };
const btnTinyOk = { padding: "8px 12px", borderRadius: 999, border: "none", backgroundColor: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
