// src/pages/DistributorsPage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../DataContext";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAlert } from "../contexts/AlertContext.jsx";
import ReadOnlyBanner from "../components/ReadOnlyBanner.jsx";
import LoadingLogo from "../components/LoadingLogo.jsx";
import { useMinLoadingTime } from "../hooks/useMinLoadingTime.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import LoadingOverlay from "../components/LoadingOverlay.jsx";
import {
  READ_ONLY_MESSAGE,
  isApiMode,
  apiDistributorsList,
  apiDistributorsAdd,
  apiDistributorsUpdate,
  apiDistributorsDelete,
  apiFinancePut,
} from "../lib/api.js";
import { getCachedDistributors, setCachedDistributors, invalidateDistributors } from "../lib/apiCache.js";
import {
  safeArray,
  safeObj,
  nowMs,
  genId,
  toLocalISODate,
  todayISO,
  normId,
  clampMoney,
  toNum,
} from "../utils/helpers.js";
import { normalizeLineRow } from "../utils/lineShape.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { theme } from "../theme.js";
import { Field } from "../components/shared/index.js";
import {
  pageWrap,
  input,
  btnPrimary,
  btnOutline,
  btnTiny,
  btnTinyPrimary,
  btnTinyDanger,
  miniLabel,
  modalOverlay,
  modalContent,
  modalHeader,
  modalTitle,
  emptyText,
  chip,
  chipPrimary,
  h1,
  grid2,
  contentCenterWrap,
} from "../styles/shared.js";

function normalizeDistributorRow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = normId(raw.id);
  if (!id) return null;
  return {
    ...raw,
    id,
    name: String(raw.name ?? "").trim(),
    phone: String(raw.phone ?? "").trim(),
    address: String(raw.address ?? raw.area ?? "").trim(),
    area: String(raw.area ?? raw.address ?? "").trim(),
    notes: String(raw.notes ?? "").trim(),
    lineId: raw.lineId != null ? String(raw.lineId) : "",
    lineName: String(raw.lineName ?? "").trim(),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

// Distributor Packages -> Service
function normalizeDistributorPkgToService(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const target = String(raw.target || "").toLowerCase();
  if (target !== "distributor") return null;

  const id = normId(raw.id) || "";
  const name = String(raw.name ?? "").trim();
  const price = Number(raw.cardPrice ?? raw.price ?? 0);
  const speed = String(raw.cardSpeed ?? raw.speed ?? "").trim();
  const validityText = String(raw.cardValidity ?? raw.validityText ?? "").trim();

  const safeId =
    id ||
    (name
      ? `dist_offer_${name.replace(/\s+/g, "_")}_${Number.isFinite(price) ? price : 0}_${speed || "nospeed"}_${validityText || "noval"}`
      : "");

  if (!safeId) return null;

  return {
    id: safeId,
    name: name || "—",
    price: Number.isFinite(price) ? price : 0,
    speed,
    validityText,
    type: "card",
    active: raw.active !== false,
    source: "packages",
  };
}

/* ========================= Auto Invoice (Canonical) ========================= */
function createAutoInvoiceForDistributorSale({ sale, distributor }) {
  const currency = String(sale.currency || "₪");
  const detailsText =
    `باقة: ${sale.serviceName || "—"} | ` +
    `+ سعر: ${Number(sale.servicePrice || 0).toFixed(2)} ${currency} | ` +
    `+ سرعة: ${sale.serviceSpeed || "—"} | ` +
    `+ إضافي: ${Number(sale.extraFees || 0).toFixed(2)} ${currency} | ` +
    `+ خصم: ${Number(sale.specialDiscount || 0).toFixed(2)} ${currency}`;

  return {
    id: `auto_${sale.id}`,
    createdAt: Number(sale.createdAt) || nowMs(),
    updatedAt: nowMs(),
    status: "approved",
    source: "distributor",
    kind: "فاتورة موزع",
    date: String(sale.startDate || toLocalISODate(nowMs())),
    currency,

    name: String(distributor?.name || sale.distributorName || "—"),
    phone: String(distributor?.phone || ""),
    address: String(distributor?.address || distributor?.area || ""),

    refId: String(sale.id),
    distributorId: String(distributor?.id || sale.distributorId || ""),

    lineId: String(distributor?.lineId || ""),
    lineName: String(distributor?.lineName || ""),

    serviceId: String(sale.serviceId || ""),
    serviceName: String(sale.serviceName || "—"),
    servicePrice: Number(sale.servicePrice || 0),
    serviceSpeed: String(sale.serviceSpeed || "—"),
    serviceValidityText: String(sale.serviceValidityText || "—"),

    extraFees: clampMoney(sale.extraFees),
    specialDiscount: clampMoney(sale.specialDiscount),
    amount: clampMoney(sale.total),
    details: detailsText,
  };
}

/* ========================= Finance push (works on Web/Electron) ========================= */
async function pushAutoInvoiceEverywhere({ gate, setData, autoInv, data, token }) {
  if (!autoInv?.id) return;
  try {
    if (gate?.financeDb?.table?.upsert) {
      await gate.financeDb.table.upsert("auto_invoices", autoInv);
    } else if (typeof setData === "function") {
      setData((prev) => {
        const p = safeObj(prev);
        const fin = safeObj(p.finance);
        const kv = safeObj(fin._kv);
        const arr = safeArray(kv.autoInvoices);
        if (arr.some((x) => String(x?.id) === String(autoInv.id))) return p;
        return {
          ...p,
          finance: { ...fin, _kv: { ...kv, autoInvoices: [autoInv, ...arr] } },
          updatedAt: nowMs(),
        };
      });
    }
    // In API mode, persist finance so FinancePage shows the new auto invoice
    if (isApiMode() && token && data) {
      const kv = safeObj(data?.finance?._kv);
      const nextAuto = [autoInv, ...safeArray(kv.autoInvoices)];
      const res = await apiFinancePut(token, { ...kv, autoInvoices: nextAuto });
      if (res.ok && res.data && typeof setData === "function") {
        setData((prev) => ({ ...prev, finance: { _kv: res.data }, updatedAt: nowMs() }));
      }
    }
  } catch (e) {
    console.warn("pushAutoInvoice failed:", e);
  }
}

export default function DistributorsPage() {
  const ctx = useData();
  const { token } = useAuth();
  const data = ctx?.data;
  const setData = ctx?.setData;
  const gate = ctx?.gate;

  const useDistributorsApi = isApiMode() && !!token;
  const [distributorsFromApi, setDistributorsFromApi] = useState([]);
  const [distributorsApiLoading, setDistributorsApiLoading] = useState(false);
  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  const loadDistributorsApi = useCallback(async () => {
    if (!useDistributorsApi || !token) return;
    const cached = getCachedDistributors();
    if (cached != null) {
      setDistributorsFromApi(cached);
      return;
    }
    setDistributorsApiLoading(true);
    try {
      const res = await apiDistributorsList(token);
      if (res.ok && Array.isArray(res.data)) {
        setDistributorsFromApi(res.data);
        setCachedDistributors(res.data);
      } else setDistributorsFromApi([]);
    } catch {
      setDistributorsFromApi([]);
    } finally {
      setDistributorsApiLoading(false);
    }
  }, [useDistributorsApi, token]);

  useEffect(() => {
    if (useDistributorsApi) loadDistributorsApi();
  }, [useDistributorsApi, loadDistributorsApi]);

  useEffect(() => {
    if (!useDistributorsApi || typeof setData !== "function") return;
    setData((prev) => ({ ...prev, distributors: { items: distributorsFromApi }, updatedAt: nowMs() }));
  }, [useDistributorsApi, distributorsFromApi, setData]);

  const currency =
    gate?.financeDb?.settings?.get?.()?.currency ||
    data?.finance?.pricing?.defaultCurrency ||
    "₪";

  const { isNarrow, isMobile } = useResponsive();

  // ======================
  // Local Source of Truth (NO DB) or from API
  // ======================
  const lines = useMemo(() => {
    const raw = data?.lines?.items ?? data?.lines ?? [];
    return safeArray(raw).map(normalizeLineRow).filter(Boolean);
  }, [data?.lines]);

  const services = useMemo(() => {
    const raw = data?.packages?.items ?? data?.packages ?? [];
    return safeArray(raw)
      .map(normalizeDistributorPkgToService)
      .filter(Boolean)
      .filter((s) => s.active !== false);
  }, [data?.packages]);

  const distributors = useMemo(() => {
    if (useDistributorsApi) return safeArray(distributorsFromApi).map(normalizeDistributorRow).filter(Boolean);
    const raw = data?.distributors?.items ?? data?.distributors ?? [];
    return safeArray(raw).map(normalizeDistributorRow).filter(Boolean);
  }, [useDistributorsApi, distributorsFromApi, data?.distributors]);

  const { getLimit, canWrite } = useAuth();
  const { showPlanLimitAlert, showReadOnlyAlert, showValidationAlert, showErrorAlert, showConfirmAlert } = useAlert();
  const distributorsLimit = getLimit("distributors");
  const distributorsAtLimit = distributorsLimit != null && distributors.length >= distributorsLimit;
  const canWriteDistributors = canWrite("distributors");

  const autoInvoices = useMemo(() => {
    const fin = safeObj(data?.finance);
    const arr = safeArray(fin.autoInvoices);
    return arr;
  }, [data?.finance]);

  // ===== UI Search =====
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return distributors;
    return distributors.filter((d) => {
      const addr = String(d.address || d.area || "").toLowerCase();
      return (
        String(d.name || "").toLowerCase().includes(qq) ||
        String(d.phone || "").toLowerCase().includes(qq) ||
        addr.includes(qq) ||
        String(d.notes || "").toLowerCase().includes(qq) ||
        String(d.lineName || "").toLowerCase().includes(qq)
      );
    });
  }, [distributors, q]);

  // ===== Modals =====
  const overlayRef = useRef(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);

  const emptyDist = () => ({ name: "", phone: "", address: "", lineId: "", notes: "" });
  const [distForm, setDistForm] = useState(emptyDist());

  const openAdd = () => {
    if (typeof setData !== "function") return showErrorAlert("setData غير متوفر في DataContext. الصفحة لن تحفظ.");
    setEditing(null);
    setDistForm(emptyDist());
    setShowAdd(true);
  };
  const closeAdd = () => setShowAdd(false);

  const openEdit = (d) => {
    setEditing(d);
    setDistForm({
      name: d.name || "",
      phone: d.phone || "",
      address: d.address || d.area || "",
      lineId: d.lineId ? String(d.lineId) : "",
      notes: d.notes || "",
    });
    setShowEdit(true);
  };
  const closeEdit = () => {
    setEditing(null);
    setShowEdit(false);
  };

  const validateDist = () => {
    const name = String(distForm.name || "").trim();
    const phone = String(distForm.phone || "").trim();
    const address = String(distForm.address || "").trim();
    if (!name) return "اسم الموزع مطلوب.";
    if (!phone) return "رقم الموزع مطلوب.";
    if (!address) return "العنوان مطلوب.";
    return null;
  };

  function localUpsertDistributor(id, patch, { isNew } = { isNew: false }) {
    if (typeof setData !== "function") return false;

    setData((prev) => {
      const p = safeObj(prev);
      const root = p.distributors;
      const arr = safeArray(root?.items ?? root ?? []);
      const nextRootIsObject = root && typeof root === "object" && !Array.isArray(root);

      if (isNew) {
        const nextArr = [patch, ...arr];
        return {
          ...p,
          distributors: nextRootIsObject ? { ...safeObj(root), items: nextArr } : nextArr,
          updatedAt: nowMs(),
        };
      }

      const idx = arr.findIndex((x) => String(x?.id) === String(id));
      if (idx === -1) {
        const nextArr = [{ id, ...patch }, ...arr];
        return {
          ...p,
          distributors: nextRootIsObject ? { ...safeObj(root), items: nextArr } : nextArr,
          updatedAt: nowMs(),
        };
      }

      const nextArr = arr.slice();
      nextArr[idx] = { ...safeObj(nextArr[idx]), ...patch, id: String(id) };
      return {
        ...p,
        distributors: nextRootIsObject ? { ...safeObj(root), items: nextArr } : nextArr,
        updatedAt: nowMs(),
      };
    });

    return true;
  }

  function localRemoveDistributor(id) {
    if (typeof setData !== "function") return false;

    setData((prev) => {
      const p = safeObj(prev);
      const root = p.distributors;
      const arr = safeArray(root?.items ?? root ?? []);
      const nextArr = arr.filter((x) => String(x?.id) !== String(id));
      const nextRootIsObject = root && typeof root === "object" && !Array.isArray(root);

      return {
        ...p,
        distributors: nextRootIsObject ? { ...safeObj(root), items: nextArr } : nextArr,
        updatedAt: nowMs(),
      };
    });

    return true;
  }

  const saveDistributor = async (e) => {
    e.preventDefault();
    if (!canWriteDistributors) return showReadOnlyAlert();
    const err = validateDist();
    if (err) return showValidationAlert(err);

    await execute(async () => {
    const name = String(distForm.name || "").trim();
    const phone = String(distForm.phone || "").trim();
    const address = String(distForm.address || "").trim();
    const notes = String(distForm.notes || "").trim();
    const lineId = String(distForm.lineId || "").trim();

    const line = lineId ? lines.find((l) => String(l.id) === String(lineId)) : null;
    const area = address;

    if (!editing) {
      const d = {
        id: genId("dist"),
        createdAt: nowMs(),
        updatedAt: nowMs(),
        name,
        phone,
        address,
        area,
        notes,
        lineId: line ? String(line.id) : "",
        lineName: line ? (line.name || "—") : "",
      };
      if (distributorsAtLimit) {
        showPlanLimitAlert();
        return;
      }
      if (useDistributorsApi && token) {
        const res = await apiDistributorsAdd(token, d);
        if (!res.ok) return showErrorAlert(res.error || "فشل إضافة الموزع.");
        if (res.data) {
          setDistributorsFromApi((prev) => [res.data, ...prev]);
          invalidateDistributors();
        }
        closeAdd();
        return;
      }
      const ok = localUpsertDistributor(d.id, d, { isNew: true });
      if (!ok) return showErrorAlert("فشل الحفظ محليًا.");
      closeAdd();
      return;
    }

    const patch = {
      updatedAt: nowMs(),
      name,
      phone,
      address,
      area,
      notes,
      lineId: line ? String(line.id) : "",
      lineName: line ? (line.name || "—") : "",
    };
    if (useDistributorsApi && token) {
      const res = await apiDistributorsUpdate(token, editing.id, patch);
      if (!res.ok) return showErrorAlert(res.error || "فشل تحديث الموزع.");
      if (res.data) {
        setDistributorsFromApi((prev) => prev.map((d) => (String(d.id) === String(editing.id) ? res.data : d)));
        invalidateDistributors();
      }
      closeEdit();
      return;
    }
    const ok = localUpsertDistributor(editing.id, patch, { isNew: false });
    if (!ok) return showErrorAlert("فشل تعديل الموزع محليًا.");
    closeEdit();
    });
  };

  const deleteDistributor = async (id) => {
    if (!canWriteDistributors) return showReadOnlyAlert();
    showConfirmAlert({
      message: "حذف الموزع؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
          if (useDistributorsApi && token) {
            const res = await apiDistributorsDelete(token, id);
            if (!res.ok) return showErrorAlert(res.error || "فشل حذف الموزع.");
            setDistributorsFromApi((prev) => prev.filter((d) => String(d.id) !== String(id)));
            invalidateDistributors();
            return;
          }
          const ok = localRemoveDistributor(id);
          if (!ok) showErrorAlert("فشل الحذف محليًا.");
        });
      },
    });
  };

  // ===== Invoice =====
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceFor, setInvoiceFor] = useState(null);

  const emptyInv = () => ({
    startDate: todayISO(),
    paymentMethod: "نقدي",
    serviceId: "",
    qty: "1",
    extraFees: "",
    specialDiscount: "",
    freeCards: "",
    notes: "",
  });
  const [invForm, setInvForm] = useState(emptyInv());

  const openInvoice = (dist) => {
    if (typeof setData !== "function" && !gate?.financeDb?.table?.upsert) {
      showErrorAlert("لا يمكن حفظ الفاتورة: لا يوجد setData ولا financeDb.upsert.");
      return;
    }
    setInvoiceFor(dist);
    setInvForm(emptyInv());
    setShowInvoice(true);
  };
  const closeInvoice = () => {
    setInvoiceFor(null);
    setShowInvoice(false);
  };

  const selectedService = useMemo(
    () => services.find((s) => String(s.id) === String(invForm.serviceId)) || null,
    [services, invForm.serviceId]
  );

  const svcType = String(selectedService?.type || "card").toLowerCase();
  const qtyLabel = svcType === "bundle" ? "عدد الحزم" : "عدد البطاقات";

  const svcPrice = useMemo(() => {
    const p = Number(selectedService?.price);
    return Number.isFinite(p) ? p : 0;
  }, [selectedService]);

  const calcTotal = useMemo(() => {
    const qty = toNum(invForm.qty);
    const qn = qty === null ? 0 : Math.max(0, qty);
    const extra = invForm.extraFees === "" ? 0 : (toNum(invForm.extraFees) ?? 0);
    const disc = invForm.specialDiscount === "" ? 0 : (toNum(invForm.specialDiscount) ?? 0);
    const subtotal = svcPrice * qn;
    return Math.max(0, subtotal + extra - disc);
  }, [svcPrice, invForm.qty, invForm.extraFees, invForm.specialDiscount]);

  const serviceLongLabel = (s) => {
    const name = String(s?.name || "—");
    const validity = String(s?.validityText || "—");
    const speed = String(s?.speed || "—");
    const price = Number(s?.price || 0).toFixed(2);
    return `${name} | ${price} ${currency} | ${speed} | ${validity}`;
  };

  const saveInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceFor) return;

    const startDate = String(invForm.startDate || "").trim();
    if (!startDate) return showValidationAlert("تاريخ البداية مطلوب.", "تاريخ البداية");

    const svc = services.find((s) => String(s.id) === String(invForm.serviceId)) || null;
    if (!svc) return showValidationAlert("اختر باقة موزع صحيحة (target=distributor).", "الباقة");

    const qty = toNum(invForm.qty);
    if (qty === null || qty <= 0) return showValidationAlert(`${qtyLabel} لازم يكون رقم أكبر من 0.`, qtyLabel);

    const extra = invForm.extraFees === "" ? 0 : toNum(invForm.extraFees);
    const disc = invForm.specialDiscount === "" ? 0 : toNum(invForm.specialDiscount);
    const free = invForm.freeCards === "" ? 0 : toNum(invForm.freeCards);

    if (extra === null || extra < 0) return showValidationAlert("الرسوم الإضافية لازم تكون رقم >= 0.", "الرسوم الإضافية");
    if (disc === null || disc < 0) return showValidationAlert("الخصومات لازم تكون رقم >= 0.", "الخصومات");
    if (free === null || free < 0) return showValidationAlert("البطاقات المجانية لازم تكون رقم >= 0.", "البطاقات المجانية");

    await execute(async () => {
    const sale = {
      id: genId("dist_sale"),
      createdAt: nowMs(),
      source: "distributor",
      distributorId: invoiceFor.id,
      distributorName: invoiceFor.name,
      startDate,
      paymentMethod: String(invForm.paymentMethod || "نقدي"),

      serviceId: String(svc.id),
      serviceName: String(svc.name || "—"),
      serviceType: String(svc.type || "card"),
      servicePrice: Number(svc.price) || 0,
      serviceSpeed: String(svc.speed || "—"),
      serviceValidityText: String(svc.validityText || "—"),

      qty: Number(qty),
      extraFees: clampMoney(extra),
      specialDiscount: clampMoney(disc),
      freeCards: Math.max(0, Number(free) || 0),
      notes: String(invForm.notes || "").trim(),
      total: clampMoney(calcTotal),
      currency,
    };

    let autoInv = createAutoInvoiceForDistributorSale({ sale, distributor: invoiceFor });
    if (!autoInv?.id) autoInv = { ...autoInv, id: genId("auto") };

    try {
      await pushAutoInvoiceEverywhere({ gate, setData, autoInv, data, token });
      closeInvoice();
    } catch (err) {
      console.error("saveInvoice failed:", err);
      showErrorAlert(`فشل حفظ فاتورة الموزع: ${String(err?.message || err)}`);
    }
    });
  };

  // ✅ Responsive derived styles
  const pageWrapR = useMemo(() => ({ ...pageWrap, paddingBottom: isMobile ? 80 : 10 }), [isMobile]);
  const topRowR = useMemo(
    () => ({
      ...topRow,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );
  const rightTopR = useMemo(
    () => ({
      ...rightTop,
      alignItems: isMobile ? "stretch" : "flex-end",
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );
  const miniStatsR = useMemo(
    () => ({ ...miniStats, justifyContent: isMobile ? "flex-start" : "flex-end" }),
    [isMobile]
  );
  const btnPrimaryR = useMemo(
    () => ({ ...btnPrimary, width: isMobile ? "100%" : undefined, justifyContent: "center" }),
    [isMobile]
  );
  const filtersRowR = useMemo(
    () => ({
      ...filtersRow,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-end",
    }),
    [isMobile]
  );
  const gridR = useMemo(
    () => ({
      ...grid2,
      gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))",
    }),
    [isMobile, isNarrow]
  );
  const cardTopR = useMemo(
    () => ({
      ...cardTop,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );
  const actionsRowR = useMemo(
    () => ({
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: isMobile ? "flex-start" : "flex-end",
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );
  const btnOutlineR = useMemo(
    () => ({ ...btnOutline, width: isMobile ? "100%" : undefined, justifyContent: "center" }),
    [isMobile]
  );
  const btnModalPrimaryR = useMemo(
    () => ({ ...btnPrimary, width: isMobile ? "100%" : undefined, justifyContent: "center" }),
    [isMobile]
  );
  const overlayR = useMemo(
    () => ({ ...modalOverlay, padding: isMobile ? 10 : 14, alignItems: isMobile ? "stretch" : "center" }),
    [isMobile]
  );
  const modalR = useMemo(
    () => ({
      ...modalWide,
      maxWidth: isMobile ? "100%" : 980,
      borderRadius: isMobile ? 16 : 20,
      padding: isMobile ? "12px 12px 12px" : "18px 18px 16px",
      maxHeight: isMobile ? "96vh" : "90vh",
    }),
    [isMobile]
  );
  const formGridR = useMemo(
    () => ({ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }),
    [isMobile]
  );
  const modalActionsR = useMemo(
    () => ({
      ...modalActions,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );

  const displayLoading = useMinLoadingTime(useDistributorsApi && distributorsApiLoading && distributorsFromApi.length === 0);
  if (displayLoading) {
    return (
      <div style={pageWrapR}>
        <div style={contentCenterWrap}>
          <LoadingLogo />
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapR}>
      <LoadingOverlay visible={actionLoading} />
      {!canWriteDistributors && <ReadOnlyBanner />}
      <div style={topRowR}>
        <div>
          <h1 style={{ ...h1, fontSize: isMobile ? 22 : 26 }}>الموزعين</h1>
          {typeof setData !== "function" ? (
            <div style={warnText}>⚠️ setData غير متوفر — الإضافة/التعديل/الحذف لن تحفظ.</div>
          ) : null}
          {!gate?.financeDb?.table?.upsert ? (
            <div style={tinyHint}>
              ℹ️ ملاحظة: لا يوجد financeDb.upsert — الفواتير ستُحفظ داخل <b>data.finance.autoInvoices</b> فقط.
            </div>
          ) : null}
        </div>

        <div style={rightTopR}>
          <button
            style={btnPrimaryR}
            onClick={() => { if (distributorsAtLimit) { showPlanLimitAlert(); return; } openAdd(); }}
            disabled={!canWriteDistributors || actionLoading}
            title={!canWriteDistributors ? READ_ONLY_MESSAGE : undefined}
          >
            + إضافة موزع
          </button>
          <div style={miniStatsR}>
            <span style={chip}>
              الخطوط : <b>{lines.length}</b>
            </span>
            <span style={chip}>
              خدمات الموزع : <b>{services.length}</b>
            </span>
            <span style={chip}>
              الموزعين : <b>{distributors.length}</b>
            </span>
          </div>
        </div>
      </div>

      <div style={filtersCard}>
        <div style={filtersRowR}>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260, width: isMobile ? "100%" : undefined }}>
            <div style={miniLabel}>بحث</div>
            <input
              style={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="اسم / رقم / خط / ملاحظات..."
            />
          </div>
        </div>

        {lines.length === 0 ? (
          <div style={warnText}>⚠️ لا توجد خطوط محليًا (اذهب لصفحة الخطوط وأضف خطوط).</div>
        ) : null}
        {services.length === 0 ? (
          <div style={warnText}>⚠️ لا توجد خدمات موزعين (اذهب لصفحة الباقات وأضف packages target=distributor).</div>
        ) : null}
      </div>

      <div style={gridR}>
        {filtered.length === 0 ? (
          <div style={contentCenterWrap}>
            <div style={emptyText}>لا يوجد موزعين حسب البحث.</div>
          </div>
        ) : (
          filtered.map((d) => {
            const distInvoices = autoInvoices.filter(
              (inv) => String(inv?.source) === "distributor" && String(inv?.distributorId) === String(d.id)
            );
            const sum = distInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
            const addrText = d.address || d.area || "—";
            return (
              <div key={d.id} style={card}>
                <div style={cardTopR}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={cardTitle}>{d.name || "—"}</div>
                    <div style={cardMeta}>
                      <span style={chip}>📞 {d.phone || "—"}</span>
                      <span style={chip}>📍 {addrText}</span>
                      <span style={chipPrimary}>{d.lineId ? `🧵 الخط: ${d.lineName || "—"}` : "🧵 بدون خط"}</span>
                    </div>
                  </div>

                  <div style={actionsRowR}>
                    <button style={btnTiny} onClick={() => openEdit(d)} disabled={!canWriteDistributors || actionLoading} title={!canWriteDistributors ? READ_ONLY_MESSAGE : undefined}>
                      تعديل
                    </button>
                    <button style={btnTinyPrimary} onClick={() => openInvoice(d)} disabled={!canWriteDistributors || actionLoading} title={!canWriteDistributors ? READ_ONLY_MESSAGE : undefined}>
                      + فاتورة
                    </button>
                    <button style={btnTinyDanger} onClick={() => deleteDistributor(d.id)} disabled={!canWriteDistributors || actionLoading} title={!canWriteDistributors ? READ_ONLY_MESSAGE : undefined}>
                      حذف
                    </button>
                  </div>
                </div>

                <div style={cardBody}>
                  <div style={row}>
                    <span style={k}>ملاحظات:</span>
                    <span style={v}>{d.notes || "—"}</span>
                  </div>
                  <div style={row}>
                    <span style={k}>فواتير مسجلة:</span>
                    <span style={v}>{distInvoices.length}</span>
                  </div>
                  <div style={row}>
                    <span style={k}>إجمالي:</span>
                    <span style={v}>
                      <b>{sum.toFixed(2)}</b> {currency}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Distributor */}
      {showAdd && (
        <Modal
          overlayRef={overlayRef}
          title="إضافة موزع"
          onClose={closeAdd}
          overlayStyle={overlayR}
          modalStyle={modalR}
        >
          <form onSubmit={saveDistributor} style={formGridR}>
            <Field label="اسم الموزع">
              <input
                style={input}
                value={distForm.name}
                onChange={(e) => setDistForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>

            <Field label="رقم الموزع">
              <input
                style={input}
                value={distForm.phone}
                onChange={(e) => setDistForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>

            <Field label="العنوان">
              <input
                style={input}
                value={distForm.address}
                onChange={(e) => setDistForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>

            <Field label="الخط (اختياري — من الخطوط)">
              <select
                style={input}
                value={distForm.lineId}
                onChange={(e) => setDistForm((f) => ({ ...f, lineId: e.target.value }))}
              >
                <option value="">بدون خط</option>
                {lines.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.name || `Line ${l.id}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ملاحظات">
              <input
                style={input}
                value={distForm.notes}
                onChange={(e) => setDistForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={btnOutlineR} onClick={closeAdd}>
                إلغاء
              </button>
              <button type="submit" style={btnModalPrimaryR} disabled={actionLoading}>
                حفظ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Distributor */}
      {showEdit && (
        <Modal
          overlayRef={overlayRef}
          title="تعديل موزع"
          onClose={closeEdit}
          overlayStyle={overlayR}
          modalStyle={modalR}
        >
          <form onSubmit={saveDistributor} style={formGridR}>
            <Field label="اسم الموزع">
              <input
                style={input}
                value={distForm.name}
                onChange={(e) => setDistForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>

            <Field label="رقم الموزع">
              <input
                style={input}
                value={distForm.phone}
                onChange={(e) => setDistForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>

            <Field label="العنوان">
              <input
                style={input}
                value={distForm.address}
                onChange={(e) => setDistForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>

            <Field label="الخط (اختياري — من الخطوط)">
              <select
                style={input}
                value={distForm.lineId}
                onChange={(e) => setDistForm((f) => ({ ...f, lineId: e.target.value }))}
              >
                <option value="">بدون خط</option>
                {lines.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.name || `Line ${l.id}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ملاحظات">
              <input
                style={input}
                value={distForm.notes}
                onChange={(e) => setDistForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={btnOutlineR} onClick={closeEdit}>
                إلغاء
              </button>
              <button type="submit" style={btnModalPrimaryR} disabled={actionLoading}>
                حفظ التعديل
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invoice Modal */}
      {showInvoice && invoiceFor && (
        <Modal
          overlayRef={overlayRef}
          title={`فاتورة موزع: ${invoiceFor.name}`}
          onClose={closeInvoice}
          overlayStyle={overlayR}
          modalStyle={modalR}
        >
          <form onSubmit={saveInvoice} style={formGridR}>
            <Field label="تاريخ البداية">
              <input
                type="date"
                style={input}
                value={invForm.startDate}
                onChange={(e) => setInvForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </Field>

            <Field label="طريقة الدفع">
              <select
                style={input}
                value={invForm.paymentMethod}
                onChange={(e) => setInvForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              >
                <option value="نقدي">نقدي</option>
                <option value="تحويل">تحويل</option>
                <option value="آجل">آجل</option>
              </select>
            </Field>

            <Field label="اختيار باقة الموزع (اسم | السعر | السرعة | الصلاحية)">
              <select
                style={input}
                value={invForm.serviceId}
                onChange={(e) => setInvForm((f) => ({ ...f, serviceId: e.target.value }))}
              >
                <option value="">اختر الباقة</option>
                {services.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {serviceLongLabel(s)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={qtyLabel}>
              <input style={input} value={invForm.qty} onChange={(e) => setInvForm((f) => ({ ...f, qty: e.target.value }))} />
            </Field>

            <Field label="رسوم إضافية">
              <input
                style={input}
                value={invForm.extraFees}
                onChange={(e) => setInvForm((f) => ({ ...f, extraFees: e.target.value }))}
              />
            </Field>

            <Field label="خصومات خاصة">
              <input
                style={input}
                value={invForm.specialDiscount}
                onChange={(e) => setInvForm((f) => ({ ...f, specialDiscount: e.target.value }))}
              />
            </Field>

            <Field label="بطاقات مجانية (لا تؤثر على المالية)">
              <input
                style={input}
                value={invForm.freeCards}
                onChange={(e) => setInvForm((f) => ({ ...f, freeCards: e.target.value }))}
              />
            </Field>

            <Field label="ملاحظات">
              <input style={input} value={invForm.notes} onChange={(e) => setInvForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>

            <div style={previewBox}>
              <div style={previewTitle}>معاينة الإجمالي (رسمي)</div>
              <div style={previewRow}>
                <span>الإجمالي:</span>
                <b>
                  {calcTotal.toFixed(2)} {currency}
                </b>
              </div>
            </div>

            <div style={modalActionsR}>
              <button type="button" style={btnOutlineR} onClick={closeInvoice}>
                إلغاء
              </button>
              <button type="submit" style={btnModalPrimaryR} disabled={actionLoading}>
                حفظ الفاتورة
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ===== UI Helpers ===== */
function Modal({ overlayRef, title, onClose, children, overlayStyle, modalStyle }) {
  return (
    <div
      ref={overlayRef}
      style={overlayStyle || modalOverlay}
      onMouseDown={(e) => e.target === overlayRef.current && onClose()}
    >
      <div style={modalStyle || modalWide}>
        <div style={modalHeader}>
          <div style={modalTitle}>{title}</div>
          <button style={xBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ===== Styles (page-specific; shared tokens imported above) ===== */
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const rightTop = { display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" };
const filtersCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };
const miniStats = { display: "flex", gap: 8, flexWrap: "wrap" };
const tinyHint = { marginTop: 6, fontSize: 12, color: theme.textMuted, lineHeight: 1.7 };
const warnText = { marginTop: 10, fontSize: 12, color: theme.warning, fontWeight: 900, lineHeight: 1.7 };

const modalWide = { ...modalContent, width: "100%", maxWidth: 980, padding: "18px 18px 16px", maxHeight: "90vh", overflowY: "auto" };
const xBtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: theme.textMuted, padding: "6px 10px", borderRadius: 12 };

const card = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const cardTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" };
const cardTitle = { fontSize: 16, fontWeight: 900, color: theme.text };
const cardMeta = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const cardBody = { display: "grid", gap: 6 };
const row = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const k = { fontSize: 12, color: theme.textMuted, fontWeight: 900 };
const v = { fontSize: 12, color: theme.text, fontWeight: 900 };

const modalActions = { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 };
const previewBox = { gridColumn: "1 / -1", border: `1px dashed ${theme.border}`, background: theme.surface, borderRadius: 18, padding: 12 };
const previewTitle = { fontSize: 13, fontWeight: 900, color: theme.text, marginBottom: 8 };
const previewRow = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: theme.text, lineHeight: 1.7 };
