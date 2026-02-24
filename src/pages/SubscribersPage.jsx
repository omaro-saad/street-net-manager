// src/pages/SubscribersPage.jsx
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
  PLAN_LIMIT_MESSAGE,
  READ_ONLY_MESSAGE,
  isApiMode,
  apiSubscribersList,
  apiSubscribersAdd,
  apiSubscribersUpdate,
  apiSubscribersDelete,
  apiFinancePut,
} from "../lib/api.js";
import { getCachedSubscribers, setCachedSubscribers, invalidateSubscribers } from "../lib/apiCache.js";
import {
  safeArray,
  safeObj,
  nowMs,
  genId,
  toLocalISODate,
  todayISO,
  localDateToMs,
  fmtMoney,
  normId,
  isObj,
  toNum,
  clampMoney,
  addDaysLocal,
  fmtDurationDays,
} from "../utils/helpers.js";
import { normalizeLineRow } from "../utils/lineShape.js";
import { theme } from "../theme.js";
import { useResponsive } from "../hooks/useResponsive.js";
import {
  pageWrap,
  input,
  btnPrimary,
  btnTinyDanger,
  btnTiny,
  btnTinyPrimary,
  btnGhost,
  iconBtn,
  miniLabel,
  modalOverlay,
  modalCard,
  modalHeader,
  modalTitle,
  chip,
  chipPrimary,
  chipIncome,
  chipExpense,
  h1,
  textMuted,
  emptyBox,
  contentCenterWrap,
} from "../styles/shared.js";

const LS_LAST_SUB_SERVICE_ID = "subscribers:lastServiceId";

function normalizeSubscriberServiceFromPkg(raw) {
  if (!isObj(raw)) return null;
  const target = String(raw.target || "").toLowerCase();
  if (target !== "subscriber") return null;

  const id = normId(raw.id);
  if (!id) return null;

  const name = String(raw.name ?? "").trim();
  const speed = String(raw.speed ?? "").trim();

  const priceNum = Number(raw.price ?? 0);
  const price = Number.isFinite(priceNum) ? priceNum : 0;

  const validityMode = String(raw.validityMode || "").toLowerCase() === "usage" ? "usage" : "days";

  let durationDays = null;
  if (validityMode === "days") {
    const d = raw.timeValidityDays;
    if (d === null) durationDays = null;
    else {
      const n = Number(d);
      durationDays = Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
    }
  }

  const daysOption = String(raw.daysOption ?? (durationDays == null ? "لا نهائي" : `${durationDays} يوم`)).trim();
  const usageOption = String(raw.usageOption ?? raw.usageText ?? "").trim();

  const active = raw.active !== false;

  return {
    id,
    name: name || "—",
    speed,
    price,
    validityMode,
    durationDays,
    daysOption,
    usageOption,
    active,
    source: "packages",
  };
}

function normalizeSubscriberRow(raw) {
  if (!isObj(raw)) return null;
  const id = normId(raw.id);
  if (!id) return null;

  const startAt = raw.startAt == null ? 0 : Number(raw.startAt) || 0;
  const expiresAt = raw.expiresAt == null ? null : Number(raw.expiresAt);

  const dev = isObj(raw.device) ? raw.device : {};
  const ipAddress = String(raw.deviceIpAddress ?? dev.ipAddress ?? "").trim();
  const adminPassword = String(raw.deviceAdminPassword ?? dev.adminPassword ?? "").trim();
  const userPassword = String(raw.deviceUserPassword ?? dev.userPassword ?? "").trim();
  const subUsername = String(raw.subUsername ?? dev.subUsername ?? "").trim();
  const subPassword = String(raw.subPassword ?? dev.subPassword ?? "").trim();

  return {
    ...raw,
    id,
    name: String(raw.name ?? "").trim(),
    phone: String(raw.phone ?? "").trim(),
    address1: String(raw.address1 ?? "").trim(),
    area: String(raw.area ?? "").trim(),
    address2: String(raw.address2 ?? "").trim(),

    lineId: raw.lineId != null ? String(raw.lineId) : "",
    lineName: String(raw.lineName ?? "").trim(),
    serviceId: raw.serviceId != null ? String(raw.serviceId) : "",
    serviceName: String(raw.serviceName ?? "").trim(),

    status: raw.status === "deactivated" ? "deactivated" : "active",
    createdAt: Number(raw.createdAt) || 0,
    registeredAt: Number(raw.registeredAt) || Number(raw.createdAt) || 0,
    startAt,
    expiresAt: expiresAt == null ? null : Number.isFinite(expiresAt) ? expiresAt : null,
    extraFees: raw.extraFees == null ? 0 : Number(raw.extraFees) || 0,
    specialDiscount: raw.specialDiscount == null ? 0 : Number(raw.specialDiscount) || 0,
    generalNotes: String(raw.generalNotes ?? "").trim(),

    serviceValidityMode: raw.serviceValidityMode === "usage" ? "usage" : "days",
    serviceDaysOption: String(raw.serviceDaysOption ?? ""),
    serviceUsageOption: String(raw.serviceUsageOption ?? ""),

    device: {
      ipAddress,
      adminPassword,
      userPassword,
      subUsername,
      subPassword,
    },

    deviceIpAddress: ipAddress,
    deviceAdminPassword: adminPassword,
    deviceUserPassword: userPassword,
    subUsername,
    subPassword,
  };
}

/* =========================
   Expiry calc
   ========================= */
function calcExpiresAt(startAtMs, svc) {
  const base = Number(startAtMs) || 0;

  const validityMode = svc?.validityMode === "usage" ? "usage" : "days";
  if (validityMode === "usage") return null;

  const d = svc?.durationDays;
  if (d == null) return null;

  const n = Number(d);
  if (!Number.isFinite(n) || n <= 0) return addDaysLocal(base, 30);

  return addDaysLocal(base, n);
}

export default function SubscribersPage() {
  const ctx = useData();
  const { isAtLimit, canWrite, token } = useAuth();
  const { showPlanLimitAlert, showReadOnlyAlert, showValidationAlert, showErrorAlert, showConfirmAlert } = useAlert();
  const subscribersAtLimit = isAtLimit("subscribers", "subscribers");
  const canWriteSubscribers = canWrite("subscribers");
  const data = ctx?.data;
  const setData = ctx?.setData;
  const gate = ctx?.gate;

  const useSubscribersApi = isApiMode() && !!token;
  const [subscribersFromApi, setSubscribersFromApi] = useState([]);
  const [subscribersApiLoading, setSubscribersApiLoading] = useState(false);
  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  const loadSubscribersApi = useCallback(async () => {
    if (!useSubscribersApi || !token) return;
    const cached = getCachedSubscribers();
    if (cached != null) {
      setSubscribersFromApi(cached);
      return;
    }
    setSubscribersApiLoading(true);
    try {
      const res = await apiSubscribersList(token);
      if (res.ok && Array.isArray(res.data)) {
        setSubscribersFromApi(res.data);
        setCachedSubscribers(res.data);
      } else setSubscribersFromApi([]);
    } catch {
      setSubscribersFromApi([]);
    } finally {
      setSubscribersApiLoading(false);
    }
  }, [useSubscribersApi, token]);

  useEffect(() => {
    if (useSubscribersApi) loadSubscribersApi();
  }, [useSubscribersApi, loadSubscribersApi]);

  useEffect(() => {
    if (!useSubscribersApi || typeof setData !== "function") return;
    setData((prev) => ({ ...prev, subscribers: subscribersFromApi, updatedAt: nowMs() }));
  }, [useSubscribersApi, subscribersFromApi, setData]);

  // ✅ currency
  const currency = gate?.financeDb?.settings?.get?.()?.currency || data?.finance?.pricing?.defaultCurrency || "₪";

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
      .map(normalizeSubscriberServiceFromPkg)
      .filter(Boolean)
      .filter((s) => s.active !== false);
  }, [data?.packages]);

  const subscribersAll = useMemo(() => {
    if (useSubscribersApi) return safeArray(subscribersFromApi).map(normalizeSubscriberRow).filter(Boolean);
    const raw = data?.subscribers ?? [];
    return safeArray(raw).map(normalizeSubscriberRow).filter(Boolean);
  }, [useSubscribersApi, subscribersFromApi, data?.subscribers]);

  // ======================
  // Computed status
  // ======================
  const enrichedSubscribers = useMemo(() => {
    const now = Date.now();
    return subscribersAll.map((s) => {
      const exp = s.expiresAt;
      const expired = s.status !== "deactivated" && exp != null && Number.isFinite(exp) && exp <= now;
      return {
        ...s,
        computedStatus: s.status === "deactivated" ? "deactivated" : expired ? "expired" : "active",
      };
    });
  }, [subscribersAll]);

  const { isNarrow, isMobile } = useResponsive();

  // ===== UI state =====
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const list = useMemo(() => {
    let arr = enrichedSubscribers.slice();

    if (filterStatus !== "all") arr = arr.filter((x) => x.computedStatus === filterStatus);

    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter((x) => {
        const lineName = String(x.lineName || "").toLowerCase();
        const svcName = String(x.serviceName || "").toLowerCase();
        return (
          String(x.name || "").toLowerCase().includes(qq) ||
          String(x.phone || "").toLowerCase().includes(qq) ||
          String(x.address1 || "").toLowerCase().includes(qq) ||
          lineName.includes(qq) ||
          svcName.includes(qq) ||
          String(x.generalNotes || "").toLowerCase().includes(qq)
        );
      });
    }

    arr.sort((a, b) => {
      const aa = Number(a.createdAt || 0);
      const bb = Number(b.createdAt || 0);
      return sortBy === "oldest" ? aa - bb : bb - aa;
    });

    return arr;
  }, [enrichedSubscribers, q, filterStatus, sortBy]);

  // ===== Modal =====
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [renewMode, setRenewMode] = useState(false);
  const editingOriginalRef = useRef(null);

  const emptyForm = {
    name: "",
    phone: "",
    address1: "",
    lineId: "",
    serviceId: "",
    extraFees: "",
    specialDiscount: "",
    startDate: todayISO(),

    ipAddress: "",
    adminPassword: "",
    userPassword: "",

    subUsername: "",
    subPassword: "",

    generalNotes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const selectedService = useMemo(
    () => services.find((s) => String(s.id) === String(form.serviceId)) || null,
    [services, form.serviceId]
  );

  const selectedLine = useMemo(
    () => lines.find((l) => String(l.id) === String(form.lineId)) || null,
    [lines, form.lineId]
  );

  const serviceChipText = useMemo(() => {
    if (!selectedService) return "اختر خدمة";

    const durationText =
      selectedService.validityMode === "usage"
        ? `سحب: ${selectedService.usageOption || "—"}`
        : `مدة: ${fmtDurationDays(selectedService.durationDays)}`;

    const speedText = selectedService.speed ? ` | ${selectedService.speed}` : "";
    const priceText = ` | ${fmtMoney(selectedService.price ?? 0)} ${currency}`;

    return `${selectedService.name || "—"} | ${durationText}${speedText}${priceText}`;
  }, [selectedService, currency]);

  const depsOk = true; // ✅ always works (NO DB)

  const openAdd = () => {
    editingOriginalRef.current = null;
    setEditingId(null);
    setRenewMode(false);

    let lastSvc = "";
    try {
      lastSvc = String(localStorage.getItem(LS_LAST_SUB_SERVICE_ID) || "").trim();
    } catch {}

    setForm({ ...emptyForm, startDate: todayISO(), serviceId: lastSvc });
    setModalOpen(true);
  };

  const openEdit = (sub) => {
    setEditingId(sub.id);
    setRenewMode(false);
    editingOriginalRef.current = sub;

    const startISO = sub.startAt ? toLocalISODate(sub.startAt) : todayISO();

    setForm({
      name: sub.name || "",
      phone: sub.phone || "",
      address1: sub.address1 || "",
      lineId: sub.lineId ? String(sub.lineId) : "",
      serviceId: sub.serviceId ? String(sub.serviceId) : "",
      extraFees: sub.extraFees === null || sub.extraFees === undefined ? "" : String(sub.extraFees),
      specialDiscount: sub.specialDiscount === null || sub.specialDiscount === undefined ? "" : String(sub.specialDiscount),
      startDate: startISO,

      ipAddress: sub.device?.ipAddress || sub.deviceIpAddress || "",
      adminPassword: sub.device?.adminPassword || sub.deviceAdminPassword || "",
      userPassword: sub.device?.userPassword || sub.deviceUserPassword || "",

      subUsername: sub.device?.subUsername || sub.subUsername || "",
      subPassword: sub.device?.subPassword || sub.subPassword || "",

      generalNotes: sub.generalNotes || "",
    });

    setModalOpen(true);
  };

  const openRenew = (sub) => {
    setEditingId(sub.id);
    setRenewMode(true);
    editingOriginalRef.current = sub;

    setForm({
      name: sub.name || "",
      phone: sub.phone || "",
      address1: sub.address1 || "",
      lineId: sub.lineId ? String(sub.lineId) : "",
      serviceId: sub.serviceId ? String(sub.serviceId) : "",

      extraFees: "0",
      specialDiscount: "0",

      startDate: todayISO(),

      ipAddress: sub.device?.ipAddress || sub.deviceIpAddress || "",
      adminPassword: sub.device?.adminPassword || sub.deviceAdminPassword || "",
      userPassword: sub.device?.userPassword || sub.deviceUserPassword || "",

      subUsername: sub.device?.subUsername || sub.subUsername || "",
      subPassword: sub.device?.subPassword || sub.subPassword || "",

      generalNotes: sub.generalNotes || "",
    });

    setModalOpen(true);
  };

  const validateBeforeSave = () => {
    const name = String(form.name || "").trim();
    const phone = String(form.phone || "").trim();
    const address1 = String(form.address1 || "").trim();
    const lineId = String(form.lineId || "").trim();
    const serviceId = String(form.serviceId || "").trim();
    const startMs = localDateToMs(form.startDate);

    if (!name) return "اسم المشترك مطلوب.";
    if (!phone) return "رقم الجوال مطلوب.";
    if (!address1) return "العنوان 1 مطلوب.";
    if (!lineId) return "اختيار الخط مطلوب.";
    if (!serviceId) return "اختيار نوع الاشتراك (الباقة) مطلوب.";
    if (!startMs) return "تاريخ بدء الاشتراك غير صحيح.";

    const ip = String(form.ipAddress || "").trim();
    const ap = String(form.adminPassword || "").trim();
    const up = String(form.userPassword || "").trim();
    const su = String(form.subUsername || "").trim();
    const sp = String(form.subPassword || "").trim();

    if (!ip) return "عنوان الـ IP مطلوب.";
    if (!ap) return "Admin Password مطلوب.";
    if (!up) return "User Password مطلوب.";
    if (!su) return "يوزر الاشتراك مطلوب.";
    if (!sp) return "كلمة مرور الاشتراك مطلوبة.";

    const fees = form.extraFees === "" ? 0 : toNum(form.extraFees);
    const disc = form.specialDiscount === "" ? 0 : toNum(form.specialDiscount);
    if (fees === null || fees < 0) return "الرسوم الإضافية لازم تكون رقم >= 0.";
    if (disc === null || disc < 0) return "الخصم لازم يكون رقم >= 0.";

    return null;
  };

  // ✅ فاتورة مختصرة (زي نظامك)
  const createAutoInvoiceForSubscriber = (subscriber, amount, meta) => {
    const svc = meta?.service || null;
    const ln = meta?.line || null;

    const extra = clampMoney(subscriber.extraFees ?? 0);
    const disc = clampMoney(subscriber.specialDiscount ?? 0);

    const details =
      `باقة: ${String(svc?.name || subscriber.serviceName || "—")} | ` +
      `سعر: ${fmtMoney(Number(svc?.price ?? 0))} ${currency} | ` +
      `سرعة: ${String(svc?.speed || "—")} | ` +
      `إضافي: ${fmtMoney(extra)} ${currency} | ` +
      `خصم: ${fmtMoney(disc)} ${currency}`;

    return {
      id: genId("auto"),
      createdAt: nowMs(),
      updatedAt: nowMs(),
      status: "approved",
      source: "subscriber",
      kind: "اشتراك",
      date: toLocalISODate(nowMs()),
      currency,

      name: subscriber.name,
      phone: subscriber.phone,
      amount: clampMoney(amount),
      refId: subscriber.id,

      serviceId: subscriber.serviceId || (svc ? String(svc.id) : ""),
      serviceName: subscriber.serviceName || (svc ? String(svc.name || "—") : ""),
      lineId: subscriber.lineId || (ln ? String(ln.id) : ""),
      lineName: subscriber.lineName || (ln ? String(ln.name || "—") : ""),

      extraFees: extra,
      specialDiscount: disc,
      details,
    };
  };

  const pushAutoInvoiceEverywhere = async (autoInv) => {
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
      // In API mode, persist finance (including new auto invoice) so FinancePage shows it
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
  };

  const buildDevicePayload = (fallbackDevice) => {
    const ip = String(form.ipAddress || "").trim();
    const ap = String(form.adminPassword || "").trim();
    const up = String(form.userPassword || "").trim();
    const su = String(form.subUsername || "").trim();
    const sp = String(form.subPassword || "").trim();

    const fb = isObj(fallbackDevice) ? fallbackDevice : {};

    return {
      ipAddress: ip || String(fb.ipAddress || ""),
      adminPassword: ap || String(fb.adminPassword || ""),
      userPassword: up || String(fb.userPassword || ""),
      subUsername: su || String(fb.subUsername || ""),
      subPassword: sp || String(fb.subPassword || ""),
    };
  };

  // ======================
  // Local CRUD (NO DB)
  // ======================
  const localUpsertSubscriber = (id, patch, { isNew } = { isNew: false }) => {
    if (typeof setData !== "function") {
      showErrorAlert("لا يمكن الحفظ: setData غير متوفر في DataContext.");
      return false;
    }

    setData((prev) => {
      const p = safeObj(prev);
      const arr = safeArray(p.subscribers);

      if (isNew) {
        return {
          ...p,
          subscribers: [patch, ...arr],
          updatedAt: nowMs(),
        };
      }

      const idx = arr.findIndex((x) => String(x?.id) === String(id));
      if (idx === -1) {
        // لو مش موجود، اعتبره upsert
        return {
          ...p,
          subscribers: [{ id, ...patch }, ...arr],
          updatedAt: nowMs(),
        };
      }

      const next = arr.slice();
      next[idx] = { ...safeObj(next[idx]), ...patch, id: String(id) };
      return {
        ...p,
        subscribers: next,
        updatedAt: nowMs(),
      };
    });

    return true;
  };

  const localRemoveSubscriber = (id) => {
    if (typeof setData !== "function") {
      showErrorAlert("لا يمكن الحذف: setData غير متوفر في DataContext.");
      return false;
    }

    setData((prev) => {
      const p = safeObj(prev);
      const arr = safeArray(p.subscribers);
      return {
        ...p,
        subscribers: arr.filter((x) => String(x?.id) !== String(id)),
        updatedAt: nowMs(),
      };
    });

    return true;
  };

  const saveSubscriber = async (e) => {
    e.preventDefault();
    if (!canWriteSubscribers) return showReadOnlyAlert();
    const err = validateBeforeSave();
    if (err) return showValidationAlert(err);

    await execute(async () => {
    const name = String(form.name || "").trim();
    const phone = String(form.phone || "").trim();
    const address1 = String(form.address1 || "").trim();

    const area = address1;
    const address2 = "";

    const service = services.find((s) => String(s.id) === String(form.serviceId)) || null;
    const line = lines.find((l) => String(l.id) === String(form.lineId)) || null;

    if (!service) return showErrorAlert("الباقة المختارة غير موجودة ضمن الحزم (Packages).");
    if (!line) return showErrorAlert("الخط المختار غير موجود ضمن الخطوط (Lines).");

    try {
      localStorage.setItem(LS_LAST_SUB_SERVICE_ID, String(form.serviceId || ""));
    } catch {}

    const basePrice = Number(service.price) || 0;
    const extraFees = form.extraFees === "" ? 0 : toNum(form.extraFees) || 0;
    const specialDiscount = form.specialDiscount === "" ? 0 : toNum(form.specialDiscount) || 0;
    const total = Math.max(0, basePrice + extraFees - specialDiscount);

    const startAt = localDateToMs(form.startDate);
    if (!startAt) return showValidationAlert("تاريخ بدء الاشتراك غير صحيح.", "تاريخ البدء");

    const generalNotes = String(form.generalNotes || "").trim();

    const fallbackDevice = editingOriginalRef.current?.device || {
      ipAddress: "",
      adminPassword: "",
      userPassword: "",
      subUsername: "",
      subPassword: "",
    };
    const device = buildDevicePayload(fallbackDevice);

    const deviceIpAddress = String(device.ipAddress || "").trim();
    const deviceAdminPassword = String(device.adminPassword || "").trim();
    const deviceUserPassword = String(device.userPassword || "").trim();
    const subUsername = String(device.subUsername || "").trim();
    const subPassword = String(device.subPassword || "").trim();

    // ============ ADD NEW ============
    if (!editingId) {
      const registeredAt = nowMs();
      const expiresAt = calcExpiresAt(startAt, service);

      const sub = {
        id: genId("sub"),
        createdAt: registeredAt,
        updatedAt: registeredAt,

        name,
        phone,
        address1,

        area,
        address2,

        lineId: String(line.id),
        lineName: line.name || `Line ${line.id}`,

        serviceId: String(service.id),
        serviceName: service.name || "—",
        serviceValidityMode: service.validityMode === "usage" ? "usage" : "days",
        serviceDaysOption: service.validityMode === "usage" ? "" : service.durationDays == null ? "لا نهائي" : `${service.durationDays} يوم`,
        serviceUsageOption: service.usageOption || "",

        extraFees,
        specialDiscount,

        registeredAt,
        startAt,
        expiresAt,

        device,
        deviceIpAddress,
        deviceAdminPassword,
        deviceUserPassword,
        subUsername,
        subPassword,

        status: "active",
        generalNotes,
      };

      const autoInv = createAutoInvoiceForSubscriber(sub, total, { service, line });

      if (useSubscribersApi && token) {
        const res = await apiSubscribersAdd(token, sub);
        if (!res.ok) return showErrorAlert(res.error || "فشل إضافة المشترك.");
        if (res.data) {
          setSubscribersFromApi((prev) => [res.data, ...prev]);
          invalidateSubscribers();
        }
        await pushAutoInvoiceEverywhere(autoInv);
        setModalOpen(false);
        setEditingId(null);
        setRenewMode(false);
        editingOriginalRef.current = null;
        setForm({ ...emptyForm, startDate: todayISO(), serviceId: String(form.serviceId || "") });
        return;
      }

      const ok = localUpsertSubscriber(sub.id, sub, { isNew: true });
      if (!ok) return showErrorAlert("فشل الحفظ محليًا.");

      await pushAutoInvoiceEverywhere(autoInv);

      setModalOpen(false);
      setEditingId(null);
      setRenewMode(false);
      editingOriginalRef.current = null;
      setForm({ ...emptyForm, startDate: todayISO(), serviceId: String(form.serviceId || "") });
      return;
    }

    // ============ EDIT or RENEW ============
    const newExpiresAt = calcExpiresAt(startAt, service);
    const shouldCreateInvoice = Boolean(renewMode);

    const patch = {
      updatedAt: nowMs(),

      name,
      phone,
      address1,

      area,
      address2,

      lineId: String(line.id),
      lineName: line.name || `Line ${line.id}`,

      serviceId: String(service.id),
      serviceName: service.name || "—",
      serviceValidityMode: service.validityMode === "usage" ? "usage" : "days",
      serviceDaysOption: service.validityMode === "usage" ? "" : service.durationDays == null ? "لا نهائي" : `${service.durationDays} يوم`,
      serviceUsageOption: service.usageOption || "",

      extraFees,
      specialDiscount,

      startAt,
      expiresAt: newExpiresAt,

      device,
      deviceIpAddress,
      deviceAdminPassword,
      deviceUserPassword,
      subUsername,
      subPassword,

      generalNotes,
      status: "active",
    };

    if (useSubscribersApi && token) {
      const res = await apiSubscribersUpdate(token, editingId, patch);
      if (!res.ok) return showErrorAlert(res.error || "فشل تحديث المشترك.");
      if (res.data) {
        setSubscribersFromApi((prev) => prev.map((s) => (String(s.id) === String(editingId) ? res.data : s)));
        invalidateSubscribers();
      }
      if (shouldCreateInvoice) {
        const updatedSub = { ...(editingOriginalRef.current || {}), id: editingId, ...patch };
        const autoInv = createAutoInvoiceForSubscriber(updatedSub, total, { service, line });
        await pushAutoInvoiceEverywhere(autoInv);
      }
      setModalOpen(false);
      setEditingId(null);
      setRenewMode(false);
      editingOriginalRef.current = null;
      return;
    }

    const ok = localUpsertSubscriber(editingId, patch, { isNew: false });
    if (!ok) return showErrorAlert("فشل تعديل المشترك محليًا.");

    if (shouldCreateInvoice) {
      const updatedSub = { ...(editingOriginalRef.current || {}), id: editingId, ...patch };
      const autoInv = createAutoInvoiceForSubscriber(updatedSub, total, { service, line });
      await pushAutoInvoiceEverywhere(autoInv);
    }

    setModalOpen(false);
    setEditingId(null);
    setRenewMode(false);
    editingOriginalRef.current = null;
    });
  };

  const deleteSubscriber = async (id) => {
    if (!canWriteSubscribers) return showReadOnlyAlert();
    showConfirmAlert({
      message: "حذف المشترك؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
          if (useSubscribersApi && token) {
            const res = await apiSubscribersDelete(token, id);
            if (!res.ok) return showErrorAlert(res.error || "فشل حذف المشترك.");
            setSubscribersFromApi((prev) => prev.filter((s) => String(s.id) !== String(id)));
            invalidateSubscribers();
            return;
          }
          const ok = localRemoveSubscriber(id);
          if (!ok) showErrorAlert("فشل الحذف محليًا.");
        });
      },
    });
  };

  const previewTotal = useMemo(() => {
    if (!selectedService) return null;
    return Math.max(0, (Number(selectedService.price) || 0) + (toNum(form.extraFees) || 0) - (toNum(form.specialDiscount) || 0));
  }, [selectedService, form.extraFees, form.specialDiscount]);

  const gridCols = isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))";

  // ✅ Responsive style variants
  const pageWrapR = useMemo(() => ({ ...pageWrap, paddingBottom: isMobile ? 80 : 10 }), [isMobile]);
  const topRowR = useMemo(
    () => ({
      ...topRow,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );
  const statCardR = useMemo(
    () => ({
      ...statCard,
      minWidth: isMobile ? "100%" : 320,
      width: isMobile ? "100%" : undefined,
    }),
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
  const filterBlock = useMemo(
    () => ({
      width: isMobile ? "100%" : undefined,
      minWidth: isMobile ? "100%" : 220,
    }),
    [isMobile]
  );
  const searchBlock = useMemo(
    () => ({
      width: isMobile ? "100%" : undefined,
      minWidth: isMobile ? "100%" : 260,
      flex: 1,
    }),
    [isMobile]
  );
  const rowR = useMemo(
    () => ({
      ...row,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );
  const leftColR = useMemo(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: isMobile ? "100%" : 280,
      flex: 1,
    }),
    [isMobile]
  );
  const rightColR = useMemo(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: 8,
      alignItems: isMobile ? "stretch" : "flex-end",
    }),
    [isMobile]
  );
  const actionsRowR = useMemo(
    () => ({
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: isMobile ? "flex-start" : "flex-end",
    }),
    [isMobile]
  );
  const modalOverlayR = useMemo(
    () => ({
      ...modalOverlay,
      padding: isMobile ? 10 : 16,
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );
  const modalCardR = useMemo(
    () => ({
      ...modalCard,
      width: isMobile ? "100%" : modalCard.width,
      borderRadius: isMobile ? 16 : 18,
      maxHeight: isMobile ? "96vh" : "92vh",
      padding: isMobile ? 12 : 14,
    }),
    [isMobile]
  );
  const modalScrollAreaR = useMemo(() => ({ ...modalScrollArea, paddingRight: isMobile ? 0 : 2 }), [isMobile]);
  const svcRowR = useMemo(
    () => ({
      ...svcRow,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );

  const chip2R = useMemo(
    () => ({
      ...chip,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    []
  );
  const chipR = useMemo(
    () => ({
      ...chip,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    []
  );

  const btnPrimaryR = useMemo(() => ({ ...btnPrimary, width: isMobile ? "100%" : undefined, justifyContent: "center" }), [isMobile]);
  const btnGhostR = useMemo(() => ({ ...btnGhost, width: isMobile ? "100%" : undefined }), [isMobile]);
  const modalFooterR = useMemo(
    () => ({
      ...modalFooter,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );

  const displayLoading = useMinLoadingTime(useSubscribersApi && subscribersApiLoading && subscribersFromApi.length === 0);
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
      {!canWriteSubscribers && <ReadOnlyBanner />}
      <div style={topRowR}>
        <div>
          <h1 style={{ ...h1, fontSize: isMobile ? 22 : 26 }}>المشتركين</h1>
        </div>

        <div style={statCardR}>
          <div style={statTitle}>إحصائيات سريعة</div>
          <div style={statRow}>
            <span style={statChip}>
              الخطوط: <b>{lines.length}</b>
            </span>
            <span style={statChip}>
              الباقات: <b>{services.length}</b>
            </span>
            <span style={statChip}>
              المشتركين: <b>{subscribersAll.length}</b>
            </span>
          </div>
        </div>
      </div>

      <div style={filtersCard}>
        <div style={filtersRowR}>
          <button
            style={btnPrimaryR}
            onClick={openAdd}
            disabled={!depsOk || subscribersAtLimit || !canWriteSubscribers || actionLoading}
            title={!canWriteSubscribers ? READ_ONLY_MESSAGE : subscribersAtLimit ? PLAN_LIMIT_MESSAGE : undefined}
          >
            + إضافة مشترك
          </button>

          <div style={filterBlock}>
            <div style={miniLabel}>حالة</div>
            <select style={input} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={!depsOk}>
              <option value="all">الكل</option>
              <option value="active">فعال</option>
              <option value="expired">منتهي</option>
              <option value="deactivated">موقوف</option>
            </select>
          </div>

          <div style={filterBlock}>
            <div style={miniLabel}>ترتيب</div>
            <select style={input} value={sortBy} onChange={(e) => setSortBy(e.target.value)} disabled={!depsOk}>
              <option value="newest">الأحدث</option>
              <option value="oldest">الأقدم</option>
            </select>
          </div>

          <div style={searchBlock}>
            <div style={miniLabel}>بحث</div>
            <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم / رقم / خط / باقة / ملاحظات..." disabled={!depsOk} />
          </div>
        </div>

        {lines.length === 0 ? <div style={warnText}>⚠️ لا توجد خطوط محفوظة محليًا (اذهب لصفحة الخطوط وأضف خطوط).</div> : null}
        {services.length === 0 ? <div style={warnText}>⚠️ لا توجد باقات مشتركين محفوظة محليًا (اذهب لصفحة الباقات وأضف target=subscriber).</div> : null}
      </div>

      <div style={sectionCard}>
        <div style={sectionHeader}>
          <div style={sectionTitle}>قائمة المشتركين</div>
          <div style={sectionHint}>{list.length} عنصر</div>
        </div>

        {list.length === 0 ? (
          <div style={contentCenterWrap}>
            <div style={emptyBox}>لا يوجد مشتركين حسب الفلاتر الحالية.</div>
          </div>
        ) : (
          <div style={listWrap}>
            {list.map((s) => {
              const statusPill = s.computedStatus === "active" ? chipIncome : s.computedStatus === "expired" ? chipExpense : pillGray;

              const registeredDate = s.registeredAt ? toLocalISODate(s.registeredAt) : "—";
              const startDate = s.startAt ? toLocalISODate(s.startAt) : "—";
              const expiresDate = s.expiresAt == null ? "لا نهائي" : s.expiresAt ? toLocalISODate(s.expiresAt) : "—";

              return (
                <div key={s.id} style={rowR}>
                  <div style={leftColR}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={rowTitle}>{s.name || "—"}</div>
                      <span style={statusPill}>{s.computedStatus === "active" ? "فعال" : s.computedStatus === "expired" ? "منتهي" : "موقوف"}</span>
                      <span style={chip2R}>📞 {s.phone || "—"}</span>
                      <span style={chip2R}>
                        🧵 الخط: <b>{s.lineName || "—"}</b>
                      </span>
                      <span style={chipR}>
                        الباقة: <b>{s.serviceName || "—"}</b>
                      </span>

                      {s.serviceValidityMode === "usage" ? (
                        <span style={chip2R}>
                          📶 السحب: <b>{s.serviceUsageOption || "—"}</b>
                        </span>
                      ) : (
                        <span style={chip2R}>
                          🗓️ المدة: <b>{s.serviceDaysOption || "—"}</b>
                        </span>
                      )}
                    </div>

                    <div style={meta}>
                      <span>
                        إنشاء: <b>{registeredDate}</b>
                      </span>
                      <span>
                        بدء: <b>{startDate}</b>
                      </span>
                      <span>
                        انتهاء: <b>{expiresDate}</b>
                      </span>
                      <span>
                        رسوم: <b>{fmtMoney(s.extraFees ?? 0)}</b> {currency}
                      </span>
                      <span>
                        خصم: <b>{fmtMoney(s.specialDiscount ?? 0)}</b> {currency}
                      </span>
                    </div>

                    <div style={noteText}>
                      العنوان: {s.address1 || "—"}
                      {s.device?.ipAddress ? ` | IP: ${s.device.ipAddress}` : ""}
                      {s.generalNotes ? ` | ملاحظات: ${s.generalNotes}` : ""}
                    </div>
                  </div>

                  <div style={rightColR}>
                    <div style={actionsRowR}>
                      {s.computedStatus === "expired" ? (
                        <>
                          <button style={btnTinyPrimary} onClick={() => openRenew(s)} disabled={!canWriteSubscribers || actionLoading} title={!canWriteSubscribers ? READ_ONLY_MESSAGE : undefined}>
                            تفعيل
                          </button>
                          <button style={btnTinyDanger} onClick={() => deleteSubscriber(s.id)} disabled={!canWriteSubscribers || actionLoading} title={!canWriteSubscribers ? READ_ONLY_MESSAGE : undefined}>
                            حذف
                          </button>
                        </>
                      ) : (
                        <>
                          <button style={btnTiny} onClick={() => openEdit(s)} disabled={!canWriteSubscribers || actionLoading} title={!canWriteSubscribers ? READ_ONLY_MESSAGE : undefined}>
                            تعديل
                          </button>
                          <button style={btnTinyDanger} onClick={() => deleteSubscriber(s.id)} disabled={!canWriteSubscribers || actionLoading} title={!canWriteSubscribers ? READ_ONLY_MESSAGE : undefined}>
                            حذف
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={modalOverlayR} onMouseDown={() => setModalOpen(false)}>
          <div style={modalCardR} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>{editingId ? (renewMode ? "تفعيل / تجديد اشتراك" : "تعديل مشترك") : "إضافة مشترك"}</div>
              <button style={iconBtn} onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={modalScrollAreaR}>
              <form onSubmit={saveSubscriber} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ ...grid, gridTemplateColumns: isMobile ? "1fr" : gridCols }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={miniLabel}>اسم المشترك</div>
                    <input style={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>

                  <div>
                    <div style={miniLabel}>رقم الجوال</div>
                    <input style={input} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>

                  <div>
                    <div style={miniLabel}>العنوان 1</div>
                    <input style={input} value={form.address1} onChange={(e) => setForm((f) => ({ ...f, address1: e.target.value }))} />
                  </div>

                  <div>
                    <div style={miniLabel}>الخط (من الخطوط)</div>
                    <select style={input} value={form.lineId} onChange={(e) => setForm((f) => ({ ...f, lineId: e.target.value }))}>
                      <option value="">اختر الخط</option>
                      {lines.map((l) => (
                        <option key={String(l.id)} value={String(l.id)}>
                          {l.name || `Line ${l.id}`}
                        </option>
                      ))}
                    </select>
                    {lines.length === 0 ? <div style={warnText}>⚠️ لا توجد خطوط.</div> : null}
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={miniLabel}>الباقة (من الحزم packages)</div>
                    <div style={svcRowR}>
                      <select style={{ ...input, flex: 1 }} value={form.serviceId} onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}>
                        <option value="">اختر الباقة</option>
                        {services.map((s) => {
                          const durationText = s.validityMode === "usage" ? `سحب: ${s.usageOption || "—"}` : `مدة: ${fmtDurationDays(s.durationDays)}`;
                          const speedText = s.speed ? ` | ${s.speed}` : "";
                          const priceText = ` | ${fmtMoney(s.price ?? 0)} ${currency}`;
                          return (
                            <option key={String(s.id)} value={String(s.id)}>
                              {s.name} | {durationText}
                              {speedText}
                              {priceText}
                            </option>
                          );
                        })}
                      </select>
                      <span style={chip2R}>{serviceChipText}</span>
                    </div>
                    {services.length === 0 ? <div style={warnText}>⚠️ لا يوجد باقات مشتركين.</div> : null}
                  </div>

                  <div>
                    <div style={miniLabel}>{renewMode ? "تاريخ تجديد الاشتراك (اليوم)" : "تاريخ بدء الاشتراك"}</div>
                    <input style={input} type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                    <div style={tinyHint}>{renewMode ? "تم ضبطه افتراضيًا على اليوم." : "هذا التاريخ للحالات الخاصة."}</div>
                  </div>

                  <div>
                    <div style={miniLabel}>رسوم إضافية</div>
                    <input style={input} value={form.extraFees} onChange={(e) => setForm((f) => ({ ...f, extraFees: e.target.value }))} placeholder="مثال: 10" />
                  </div>

                  <div>
                    <div style={miniLabel}>خصومات خاصة</div>
                    <input style={input} value={form.specialDiscount} onChange={(e) => setForm((f) => ({ ...f, specialDiscount: e.target.value }))} placeholder="مثال: 5" />
                  </div>
                </div>

                {/* ✅ Advanced required */}
                <div style={advancedShell}>
                  <div style={advancedTop}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={advancedTitle}>إعدادات متقدمة</div>
                      <div style={advancedSub}>مطلوبة دائمًا.</div>
                    </div>
                    <span style={badgeReq}>مطلوب</span>
                  </div>

                  <div style={{ borderTop: `1px solid ${theme.border}`, background: theme.surface }}>
                    <div style={{ padding: 12 }}>
                      <div style={{ ...grid, gridTemplateColumns: isMobile ? "1fr" : gridCols }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={miniLabel}>عنوان الـ IP</div>
                          <input style={input} value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} />
                        </div>

                        <div>
                          <div style={miniLabel}>Admin Password</div>
                          <input style={input} value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} />
                        </div>

                        <div>
                          <div style={miniLabel}>User Password</div>
                          <input style={input} value={form.userPassword} onChange={(e) => setForm((f) => ({ ...f, userPassword: e.target.value }))} />
                        </div>

                        <div>
                          <div style={miniLabel}>يوزر الاشتراك</div>
                          <input style={input} value={form.subUsername} onChange={(e) => setForm((f) => ({ ...f, subUsername: e.target.value }))} />
                        </div>

                        <div>
                          <div style={miniLabel}>كلمة مرور الاشتراك</div>
                          <input style={input} value={form.subPassword} onChange={(e) => setForm((f) => ({ ...f, subPassword: e.target.value }))} />
                        </div>
                      </div>

                      <div style={warnFill}>⚠️ جميع حقول الإعدادات المتقدمة مطلوبة.</div>
                    </div>
                  </div>
                </div>

                <div style={notesOuter}>
                  <div style={miniLabel}>ملاحظات عامة للاشتراك</div>
                  <textarea style={textarea} value={form.generalNotes} onChange={(e) => setForm((f) => ({ ...f, generalNotes: e.target.value }))} placeholder="اختياري..." />
                  <div style={tinyHint}>هذه ملاحظة واحدة فقط.</div>
                </div>

                <div style={modalFooterR}>
                  <button type="button" style={btnGhostR} onClick={() => setModalOpen(false)}>
                    إلغاء
                  </button>
                  <button type="submit" style={btnPrimaryR} disabled={actionLoading}>
                    {editingId ? (renewMode ? "تفعيل وتجديد + فاتورة" : "حفظ التعديل") : "تفعيل الاشتراك"}
                  </button>
                </div>

                {selectedService ? (
                  <div style={previewBox}>
                    <div style={previewTitle}>معاينة قيمة الفاتورة (قبل الحفظ)</div>
                    <div style={previewRow}>
                      <span>سعر الباقة:</span>
                      <b>
                        {fmtMoney(selectedService.price ?? 0)} {currency}
                      </b>
                    </div>
                    <div style={previewRow}>
                      <span>رسوم إضافية:</span>
                      <b>
                        {fmtMoney(toNum(form.extraFees) ?? 0)} {currency}
                      </b>
                    </div>
                    <div style={previewRow}>
                      <span>خصم:</span>
                      <b>
                        {fmtMoney(toNum(form.specialDiscount) ?? 0)} {currency}
                      </b>
                    </div>
                    <div style={previewRow}>
                      <span>الإجمالي:</span>
                      <b>
                        {fmtMoney(previewTotal ?? 0)} {currency}
                      </b>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
                      الخط المختار: <b>{selectedLine?.name || "—"}</b>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
                      مدة الباقة: <b>{selectedService.validityMode === "usage" ? "سحب (usage)" : fmtDurationDays(selectedService.durationDays)}</b>
                    </div>

                    {renewMode ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#065f46", fontWeight: 900, lineHeight: 1.7 }}>
                        ✅ هذا الحفظ سيُنشئ فاتورة جديدة (تجديد).
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontWeight: 900, lineHeight: 1.7 }}>
                        ℹ️ التعديل العادي لا يُنشئ فاتورة.
                      </div>
                    )}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Styles ===== */
/* ===== Page-specific styles (shared tokens imported above) ===== */
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const statCard = { border: `1px solid ${theme.border}`, background: theme.surface, borderRadius: 18, padding: 12, minWidth: 320 };
const statTitle = { fontSize: 12, fontWeight: 900, color: theme.text };
const statRow = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 };
const statChip = { padding: "6px 10px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, fontWeight: 900, fontSize: 12, color: theme.text };

const filtersCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };

const warnText = { marginTop: 10, fontSize: 12, color: theme.warning, fontWeight: 900, lineHeight: 1.7 };
const tinyHint = { marginTop: 6, fontSize: 12, color: theme.textMuted, lineHeight: 1.7 };

const textarea = {
  padding: "10px 12px",
  borderRadius: 14,
  border: `1px solid ${theme.border}`,
  fontSize: 14,
  outline: "none",
  backgroundColor: theme.surface,
  width: "100%",
  boxSizing: "border-box",
  minHeight: 90,
  resize: "vertical",
  lineHeight: 1.7,
  color: theme.text,
};

const sectionCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const sectionTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const sectionHint = { fontSize: 12, fontWeight: 900, color: theme.textMuted };

const listWrap = { display: "flex", flexDirection: "column", gap: 10 };

const row = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" };
const rowTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const meta = { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: theme.textMuted, lineHeight: 1.6 };
const noteText = { fontSize: 12, color: theme.textMuted, lineHeight: 1.7 };

const pillGray = { padding: "6px 10px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, fontWeight: 900, fontSize: 12 };

const modalScrollArea = { overflowY: "auto", paddingRight: 2 };

const grid = { display: "grid", gap: 12 };
const svcRow = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };

const advancedShell = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, overflow: "hidden" };
const advancedTop = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 };
const advancedTitle = { fontSize: 14, fontWeight: 900, color: theme.text };
const advancedSub = { fontSize: 12, color: theme.textMuted, fontWeight: 900 };
const badgeReq = { padding: "6px 10px", borderRadius: 999, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900, fontSize: 12 };
const warnFill = { marginTop: 10, fontSize: 12, color: theme.warning, fontWeight: 900 };

const notesOuter = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12 };

const modalFooter = { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };

const previewBox = { border: `1px dashed ${theme.border}`, background: theme.surfaceAlt, borderRadius: 18, padding: 12, marginTop: 2 };
const previewTitle = { fontSize: 13, fontWeight: 900, color: theme.text, marginBottom: 10 };
const previewRow = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12, color: theme.text, lineHeight: 1.7 };
