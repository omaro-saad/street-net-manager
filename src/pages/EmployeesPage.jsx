// src/pages/EmployeesPage.jsx
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
  apiEmployeesList,
  apiEmployeesAdd,
  apiEmployeesUpdate,
  apiEmployeesDelete,
  apiFinancePut,
} from "../lib/api.js";
import { safeArray, safeObj, nowMs, genId } from "../utils/helpers.js";
import { theme } from "../theme.js";
import { Modal, Field } from "../components/shared/index.js";
import {
  pageWrap,
  input,
  btnPrimary,
  btnGhost,
  btnTinyPrimary,
  btnTinyDanger,
  btnTiny,
  modalCard,
  iconBtn,
  grid2,
  miniLabel,
  chip,
  chipPrimary,
  chipIncome,
  chipExpense,
  tinyNote,
  emptyBox,
  h1,
  contentCenterWrap,
} from "../styles/shared.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toDateISOFromAny(v) {
  if (!v) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return "";
  }
  if (typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  if (v instanceof Date) {
    const d = v;
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return "";
}
function toNum(x) {
  const s = String(x ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isoToMs(iso) {
  const s = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function msToISO(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysISO(iso, days) {
  const ms = isoToMs(iso);
  if (!Number.isFinite(ms)) return "";
  return msToISO(ms + days * 86400000);
}

function addWeeksISO(iso, weeks) {
  return addDaysISO(iso, weeks * 7);
}

function addMonthsISO(iso, months) {
  const ms = isoToMs(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function compareISO(a, b) {
  // works for YYYY-MM-DD
  const aa = String(a || "").trim();
  const bb = String(b || "").trim();
  if (!aa && !bb) return 0;
  if (!aa) return -1;
  if (!bb) return 1;
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function payrollInvoiceKey({ employeeId, date, paySystem, amount, paymentMethod }) {
  return `payroll|emp:${employeeId}|date:${date}|sys:${paySystem}|amt:${Number(amount) || 0}|pm:${paymentMethod || "كاش"}`;
}

function buildPayrollDates(startISO, endISO, paySystem) {
  const start = String(startISO || "").trim();
  const end = String(endISO || "").trim();
  if (!start || !end) return [];
  if (compareISO(start, end) > 0) return [];

  const dates = [];
  let cursor = start;

  while (compareISO(cursor, end) <= 0) {
    dates.push(cursor);

    if (paySystem === "باليوم") cursor = addDaysISO(cursor, 1);
    else if (paySystem === "بالأسبوع") cursor = addWeeksISO(cursor, 1);
    else cursor = addMonthsISO(cursor, 1);

    if (!cursor) break;
    if (dates.length > 5000) break; // حماية من أي جنون
  }

  return dates;
}


/* ======================
   Payroll model
====================== */
const PAYROLL_PAY_METHODS = ["كاش", "بنكي", "آجل"];
const PAYROLL_SYSTEMS = ["باليوم", "بالأسبوع", "بالشهر"];

function makePayrollSeed(empId, startDateISO, paySystem, amount, paymentMethod) {
  const a = Number(amount) || 0;
  const pm = String(paymentMethod || "كاش").trim();
  const ps = String(paySystem || "بالشهر").trim();
  const sd = String(startDateISO || "").trim();
  const id = String(empId || "").trim();
  return `seed|emp:${id}|sd:${sd}|sys:${ps}|amt:${a}|pm:${pm}`;
}

/* ======================
   Finance writer (in-memory)
====================== */
async function addToAutoInvoices(finance, row) {
  const current = safeArray(await finance.get("autoInvoices"));
  const id = String(row?.id || "").trim();
  const next = current.filter((x) => String(x?.id || "") !== id);
  next.unshift(row);
  await finance.set("autoInvoices", next);
}

export default function EmployeesPage() {
  const { data, setData, gate } = useData();
  const { token } = useAuth();

  const useEmployeesApi = isApiMode() && !!token;

  // In-memory or API (gate from DataContext when not using API)
  const empApi = gate?.employees || null;
  const empReady = !!(empApi && typeof empApi.list === "function" && typeof empApi.update === "function" && typeof empApi.create === "function");

  const finance = gate?.finance || null;
  const financeReady = !!(finance && finance.isReady && typeof finance.get === "function" && typeof finance.set === "function");

  const financeTable = gate?.financeDb?.table || null;
  const financeDbUpsert = typeof financeTable?.upsert === "function" ? financeTable.upsert.bind(financeTable) : null;

  const currency = gate?.financeDb?.settings?.get?.()?.currency || "₪";

  /* ======================
     Load employees (API when isApiMode + token, else in-memory)
====================== */
  const [employeesRaw, setEmployeesRaw] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const refreshEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      if (useEmployeesApi && token) {
        const res = await apiEmployeesList(token);
        const list = res.ok && Array.isArray(res.data) ? res.data : [];
        setEmployeesRaw(list);
        setData((prev) => ({ ...prev, employees: list, updatedAt: nowMs() }));
        setLoadErr(res.ok ? "" : res.error || "خطأ في تحميل الموظفين");
      } else if (empReady) {
        const rows = await empApi.list();
        setEmployeesRaw(safeArray(rows));
        setLoadErr("");
      } else {
        setEmployeesRaw(safeArray(dataRef.current?.employees));
        setLoadErr("");
      }
    } catch (e) {
      setLoadErr(String(e?.message || e || "خطأ في تحميل الموظفين"));
      setEmployeesRaw(safeArray(dataRef.current?.employees));
    } finally {
      setEmployeesLoading(false);
    }
  }, [useEmployeesApi, token, empReady, setData]);

  // Load list on mount and when API/gate readiness changes.
  useEffect(() => {
    refreshEmployees();
  }, [refreshEmployees]);

  const employees = useMemo(() => safeArray(employeesRaw), [employeesRaw]);

  const { getLimit, canWrite } = useAuth();
  const { showPlanLimitAlert, showReadOnlyAlert, showValidationAlert, showErrorAlert, showConfirmAlert } = useAlert();
  const employeesLimit = getLimit("employees");
  const employeesAtLimit = employeesLimit != null && employees.length >= employeesLimit;
  const canWriteEmployee = canWrite("employee");

  /* ======================
     UI state
====================== */
  const [q, setQ] = useState("");

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);

  const emptyEmployeeForm = {
    name: "",
    nationalId: "",
    phone: "",
    phone2: "",
    whatsapp: "",
    email: "",
    address: "",
    area: "",
    hasDrivingLicense: "لا",

    jobTitle: "",
    topEducation: "",
    hireDate: todayLocalISO(),
    employmentType: "دوام",
    experienceLevel: "",
    yearsOfWork: "",
  };

  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);

  // Payroll settings modal
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [payrollEmployeeId, setPayrollEmployeeId] = useState(null);
  const [payrollForm, setPayrollForm] = useState({
    enabled: true,
    amount: "",
    paymentMethod: "كاش",
    paySystem: "بالشهر",
    startDate: todayLocalISO(),
    note: "",
  });

  // Employee invoice modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceEmployeeId, setInvoiceEmployeeId] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    date: todayLocalISO(),
    invoiceType: "يومية",
    amount: "",
    paymentMethod: "كاش",
    note: "",
  });

  /* ----------------------
     Filtered list
  ---------------------- */
  const filteredEmployees = useMemo(() => {
    let arr = employees.slice();
    if (q.trim()) {
      const query = q.trim().toLowerCase();
      arr = arr.filter((e) => {
        const name = String(e.name || "").toLowerCase();
        const nationalId = String(e.nationalId || "").toLowerCase();
        const phone = String(e.phone || "").toLowerCase();
        const jobTitle = String(e.jobTitle || "").toLowerCase();
        return name.includes(query) || nationalId.includes(query) || phone.includes(query) || jobTitle.includes(query);
      });
    }
    arr.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    return arr;
  }, [employees, q]);

  /* ======================
     CRUD: Employees
====================== */
  const openAddEmployee = () => {
    if (!empReady && !setData) return showErrorAlert("نظام الموظفين غير جاهز.");
    setEditingEmployeeId(null);
    setEmployeeForm({ ...emptyEmployeeForm, hireDate: todayLocalISO() });
    setEmployeeModalOpen(true);
  };

  const openEditEmployee = (emp) => {
    setEditingEmployeeId(emp.id);

    const hasDL =
      emp.hasDrivingLicense ??
      emp.hasLicense ??
      emp.has_license ??
      emp.drivingLicense ??
      emp.license ??
      false;

    setEmployeeForm({
      name: emp.name || "",
      nationalId: emp.nationalId || "",
      phone: emp.phone || "",
      phone2: emp.phone2 || "",
      whatsapp: emp.whatsapp || "",
      email: emp.email || "",
      address: emp.address || "",
      area: emp.area || "",
      hasDrivingLicense: hasDL === true || hasDL === "نعم" ? "نعم" : "لا",

      jobTitle: emp.jobTitle || "",
      topEducation: emp.topEducation || emp.topDegree || "",
      hireDate: toDateISOFromAny(emp.hireDate) || todayLocalISO(),
      employmentType: emp.employmentType || emp.workType || "دوام",
      experienceLevel: emp.experienceLevel || "",
      yearsOfWork: emp.yearsOfWork === null || emp.yearsOfWork === undefined ? "" : String(emp.yearsOfWork),
    });

    setEmployeeModalOpen(true);
  };

  const saveEmployee = async (e) => {
    e.preventDefault();

    if (!canWriteEmployee) {
      showReadOnlyAlert();
      return;
    }
    if (!editingEmployeeId && employeesAtLimit) {
      showPlanLimitAlert();
      return;
    }

    const name = String(employeeForm.name || "").trim();
    const nationalId = String(employeeForm.nationalId || "").trim();
    const phone = String(employeeForm.phone || "").trim();

    if (!name) return showValidationAlert("اسم الموظف مطلوب.", "اسم الموظف");
    if (!nationalId) return showValidationAlert("هوية الموظف مطلوبة.", "الهوية");
    if (!phone) return showValidationAlert("رقم هاتف الموظف مطلوب.", "رقم الهاتف");

    const payload = {
      name,
      nationalId,
      phone,
      phone2: String(employeeForm.phone2 || "").trim(),
      whatsapp: String(employeeForm.whatsapp || "").trim(),
      email: String(employeeForm.email || "").trim(),
      address: String(employeeForm.address || "").trim(),
      area: String(employeeForm.area || "").trim(),
      hasDrivingLicense: employeeForm.hasDrivingLicense === "نعم",

      jobTitle: String(employeeForm.jobTitle || "").trim(),
      topEducation: String(employeeForm.topEducation || "").trim(),
      hireDate: toDateISOFromAny(employeeForm.hireDate) || todayLocalISO(),
      employmentType: String(employeeForm.employmentType || "دوام").trim(),
      experienceLevel: String(employeeForm.experienceLevel || "").trim(),
      yearsOfWork: String(employeeForm.yearsOfWork || "").trim(),
    };

    try {
      await execute(async () => {
      if (!editingEmployeeId) {
        const payroll = {
          enabled: false,
          amount: 0,
          paymentMethod: "كاش",
          paySystem: "بالشهر",
          startDate: "",
          nextRunDate: "",
          lastRunAt: 0,
          note: "",
          runSeed: "",
        };
        const emp = {
          id: genId("emp"),
          createdAt: nowMs(),
          updatedAt: nowMs(),
          ...payload,
          payroll,
        };
        if (useEmployeesApi && token) {
          const res = await apiEmployeesAdd(token, { ...payload, payroll, createdAt: nowMs(), updatedAt: nowMs() });
          if (!res.ok) {
            showErrorAlert(res.error || "فشل إضافة الموظف.");
            return;
          }
          const created = res.data || { ...emp, id: res.data?.id ?? emp.id };
          setEmployeesRaw((prev) => [created, ...prev]);
          setData((prev) => ({ ...prev, employees: [created, ...safeArray(prev?.employees)], updatedAt: nowMs() }));
        } else if (empReady) {
          await empApi.create(emp);
          setEmployeesRaw((prev) => [emp, ...prev]);
        } else if (typeof setData === "function") {
          setData((prev) => ({
            ...prev,
            employees: [emp, ...safeArray(prev?.employees)],
            updatedAt: nowMs(),
          }));
          setEmployeesRaw((prev) => [emp, ...prev]);
        }
      } else {
        const patch = { ...payload, updatedAt: nowMs() };
        if (useEmployeesApi && token) {
          const res = await apiEmployeesUpdate(token, editingEmployeeId, patch);
          if (!res.ok) {
            showErrorAlert(res.error || "فشل تحديث الموظف.");
            return;
          }
          const updated = res.data || { ...patch, id: editingEmployeeId };
          setEmployeesRaw((prev) =>
            prev.map((e) => (String(e?.id) === String(editingEmployeeId) ? updated : e))
          );
          setData((prev) => {
            const arr = safeArray(prev?.employees);
            const idx = arr.findIndex((x) => String(x?.id) === String(editingEmployeeId));
            if (idx === -1) return prev;
            const next = [...arr];
            next[idx] = updated;
            return { ...prev, employees: next, updatedAt: nowMs() };
          });
        } else if (empReady) {
          await empApi.update(editingEmployeeId, patch);
          setEmployeesRaw((prev) =>
            prev.map((e) => (String(e?.id) === String(editingEmployeeId) ? { ...e, ...patch } : e))
          );
        } else if (typeof setData === "function") {
          setData((prev) => {
            const arr = safeArray(prev?.employees);
            const idx = arr.findIndex((x) => String(x?.id) === String(editingEmployeeId));
            if (idx === -1) return prev;
            const next = [...arr];
            next[idx] = { ...next[idx], ...patch, id: editingEmployeeId };
            return { ...prev, employees: next, updatedAt: nowMs() };
          });
          setEmployeesRaw((prev) =>
            prev.map((e) => (String(e?.id) === String(editingEmployeeId) ? { ...e, ...patch } : e))
          );
        }
      }

      setEmployeeModalOpen(false);
      setEditingEmployeeId(null);
      });
    } catch (err) {
      console.error(err);
      showErrorAlert(`فشل حفظ الموظف: ${String(err?.message || err)}`);
    }
  };

  const deleteEmployee = async (id) => {
    if (!canWriteEmployee) return showReadOnlyAlert();
    showConfirmAlert({
      message: "حذف الموظف؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
            if (useEmployeesApi && token) {
              const res = await apiEmployeesDelete(token, id);
              if (!res.ok) {
                showErrorAlert(res.error || "فشل حذف الموظف.");
                return;
              }
              setEmployeesRaw((prev) => prev.filter((x) => String(x?.id) !== String(id)));
              setData((prev) => ({
                ...prev,
                employees: safeArray(prev?.employees).filter((x) => String(x?.id) !== String(id)),
                updatedAt: nowMs(),
              }));
            } else if (empReady) {
              await empApi.remove(id);
              setEmployeesRaw((prev) => prev.filter((x) => String(x?.id) !== String(id)));
            } else if (typeof setData === "function") {
              setData((prev) => ({
                ...prev,
                employees: safeArray(prev?.employees).filter((x) => String(x?.id) !== String(id)),
                updatedAt: nowMs(),
              }));
              setEmployeesRaw((prev) => prev.filter((x) => String(x?.id) !== String(id)));
            } else {
              showErrorAlert("لا يمكن الحذف.");
            }
        }).catch((err) => {
          console.error(err);
          showErrorAlert(`فشل حذف الموظف: ${String(err?.message || err)}`);
        });
      },
    });
  };

  /* ======================
     Payroll settings + send to Finance
====================== */
  const openPayrollSettings = (emp) => {
    setPayrollEmployeeId(emp.id);
    const pr = safeObj(emp.payroll);
    const ps = PAYROLL_SYSTEMS.includes(pr.paySystem) ? pr.paySystem : "بالشهر";

    setPayrollForm({
      enabled: !!pr.enabled,
      amount: pr.amount === null || pr.amount === undefined ? "" : String(pr.amount),
      paymentMethod: PAYROLL_PAY_METHODS.includes(pr.paymentMethod) ? pr.paymentMethod : "كاش",
      paySystem: ps,
      startDate: toDateISOFromAny(pr.startDate) || todayLocalISO(),
      note: String(pr.note || ""),
    });

    setPayrollModalOpen(true);
  };

  const savePayrollSettings = async (e) => {
    e.preventDefault();
    if (!payrollEmployeeId) return;
  
    const enabled = !!payrollForm.enabled;
    const amount = toNum(payrollForm.amount);
    const paymentMethod = PAYROLL_PAY_METHODS.includes(payrollForm.paymentMethod) ? payrollForm.paymentMethod : "كاش";
    const paySystem = PAYROLL_SYSTEMS.includes(payrollForm.paySystem) ? payrollForm.paySystem : "بالشهر";
    const startDate = toDateISOFromAny(payrollForm.startDate) || todayLocalISO();
    const note = String(payrollForm.note || "").trim();
  
    if (enabled) {
      if (amount === null || amount <= 0) return showValidationAlert("راتب الموظف لازم يكون رقم أكبر من 0.", "الراتب");
      if (!startDate) return showValidationAlert("حدد تاريخ البدء.", "تاريخ البدء");
    }
  
    const runSeed = enabled ? makePayrollSeed(payrollEmployeeId, startDate, paySystem, amount, paymentMethod) : "";
  
    // ⚠️ nextRunDate هنا مش مهم عندك
    // لأنك بدك توليد backlog كامل
    const nextPayroll = {
      enabled,
      amount: enabled ? amount : 0,
      paymentMethod,
      paySystem,
      startDate: enabled ? startDate : "",
      nextRunDate: enabled ? startDate : "",
      lastRunAt: 0,
      note,
      runSeed,
    };
  
    try {
      await execute(async () => {
      // 1) تحديث الموظف
      const payrollPatch = { payroll: nextPayroll, updatedAt: nowMs() };
      if (useEmployeesApi && token) {
        const res = await apiEmployeesUpdate(token, payrollEmployeeId, payrollPatch);
        if (!res.ok) {
          showErrorAlert(res.error || "فشل تحديث الراتب.");
          return;
        }
        const updated = res.data;
        setEmployeesRaw((prev) =>
          prev.map((e) =>
            String(e?.id) === String(payrollEmployeeId) ? { ...e, payroll: nextPayroll } : e
          )
        );
        if (updated) {
          setData((prev) => {
            const arr = safeArray(prev?.employees);
            const idx = arr.findIndex((x) => String(x?.id) === String(payrollEmployeeId));
            if (idx === -1) return prev;
            const next = [...arr];
            next[idx] = updated;
            return { ...prev, employees: next, updatedAt: nowMs() };
          });
        }
      } else if (empReady) {
        await empApi.update(payrollEmployeeId, payrollPatch);
        setEmployeesRaw((prev) =>
          prev.map((e) =>
            String(e?.id) === String(payrollEmployeeId) ? { ...e, payroll: nextPayroll } : e
          )
        );
      } else if (typeof setData === "function") {
        setData((prev) => {
          const arr = safeArray(prev?.employees);
          const idx = arr.findIndex((x) => String(x?.id) === String(payrollEmployeeId));
          if (idx === -1) return prev;
          const next = [...arr];
          next[idx] = { ...next[idx], payroll: nextPayroll, updatedAt: nowMs(), id: payrollEmployeeId };
          return { ...prev, employees: next, updatedAt: nowMs() };
        });
        setEmployeesRaw((prev) =>
          prev.map((e) =>
            String(e?.id) === String(payrollEmployeeId) ? { ...e, payroll: nextPayroll } : e
          )
        );
      }
  
      // 2) لو مش مفعّل: خلص
      if (!enabled) {
        setPayrollModalOpen(false);
        setPayrollEmployeeId(null);
        return;
      }
  
      // 3) Finance readiness
      if (!financeReady) {
        showErrorAlert("تم حفظ إعدادات الراتب، لكن المالية غير جاهزة. لن يتم إرسال فواتير الرواتب.");
        setPayrollModalOpen(false);
        setPayrollEmployeeId(null);
        return;
      }
  
      // 4) توليد كل الفواتير المستحقة من startDate لليوم
      const todayISO = todayLocalISO();
      const dueDates = buildPayrollDates(startDate, todayISO, paySystem);
  
      if (dueDates.length === 0) {
        setPayrollModalOpen(false);
        setPayrollEmployeeId(null);
        return;
      }
  
      // 5) قراءة autoInvoices الحالية (مرة واحدة)
      const currentRaw = await finance.get("autoInvoices");
      const current = Array.isArray(currentRaw) ? currentRaw : [];
  
      // 6) بناء set للمفاتيح لمنع التكرار
      const keySet = new Set(
        current.map((x) => String(x?.payrollKey || x?.id || "")).filter(Boolean)
      );
  
      // 7) جلب الموظف بعد التحديث
      const emp = employees.find((x) => x.id === payrollEmployeeId) || null;
      const empName = String(emp?.name || "—");
      const empPhone = String(emp?.phone || "");
      const empAddress = String(emp?.address || emp?.area || "");
  
      const newInvoices = [];
  
      for (const dateISO of dueDates) {
        const payrollKey = payrollInvoiceKey({
          employeeId: payrollEmployeeId,
          date: dateISO,
          paySystem,
          amount,
          paymentMethod,
        });
  
        // منع التكرار
        if (keySet.has(payrollKey)) continue;
  
        const inv = {
          id: genId("payroll"),
          createdAt: nowMs(),
          updatedAt: nowMs(),
  
          status: "pending", // ✅ لازم قبول/رفض
          source: "employee",
          kind: "راتب موظف",
          date: dateISO,
          currency,
  
          name: empName,
          phone: empPhone,
          address: empAddress,
  
          employeeId: String(payrollEmployeeId),
          amount: Number(amount) || 0,
  
          paySystem,
          paymentMethod,
          startDate,
  
          payrollKey, // ✅ أهم شي لمنع التكرار
          details: [
            `نظام الدفع: ${paySystem}`,
            `طريقة الدفع: ${paymentMethod}`,
            note ? `ملاحظة: ${note}` : "",
          ].filter(Boolean).join(" • "),
        };
  
        newInvoices.push(inv);
        keySet.add(payrollKey);
      }
  
      // 8) إذا ما في جديد، خلص
      if (newInvoices.length === 0) {
        setPayrollModalOpen(false);
        setPayrollEmployeeId(null);
        return;
      }
  
      // 9) حفظ (الجديد أولاً)
      const nextList = [...newInvoices, ...current];
      await finance.set("autoInvoices", nextList);

      // In API mode, persist finance so FinancePage shows the new payroll auto invoices
      if (isApiMode() && token && data) {
        const kv = safeObj(data?.finance?._kv);
        const res = await apiFinancePut(token, { ...kv, autoInvoices: nextList });
        if (res.ok && res.data && typeof setData === "function") {
          setData((prev) => ({ ...prev, finance: { _kv: res.data }, updatedAt: nowMs() }));
        }
      }

      setPayrollModalOpen(false);
      setPayrollEmployeeId(null);
      });
    } catch (err) {
      console.error(err);
      showErrorAlert(`فشل حفظ إعدادات الراتب: ${String(err?.message || err)}`);
    }
  };
  

  /* ======================
     Employee invoice -> Finance (autoInvoices)
====================== */
  const openEmployeeInvoice = (emp) => {
    if (!financeReady && !financeDbUpsert) return showErrorAlert("المالية غير جاهزة.");
    setInvoiceEmployeeId(emp.id);
    setInvoiceForm({
      date: todayLocalISO(),
      invoiceType: "يومية",
      amount: "",
      paymentMethod: "كاش",
      note: "",
    });
    setInvoiceModalOpen(true);
  };

  const saveEmployeeInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceEmployeeId) return;
    if (!financeReady && !financeDbUpsert) return showErrorAlert("المالية غير جاهزة.");

    const emp = employees.find((x) => x.id === invoiceEmployeeId);
    if (!emp) return showErrorAlert("الموظف غير موجود.");

    const date = toDateISOFromAny(invoiceForm.date) || todayLocalISO();
    const invoiceType = String(invoiceForm.invoiceType || "يومية").trim();
    const amount = toNum(invoiceForm.amount);
    const paymentMethod = PAYROLL_PAY_METHODS.includes(invoiceForm.paymentMethod) ? invoiceForm.paymentMethod : "كاش";
    const note = String(invoiceForm.note || "").trim();

    if (amount === null || amount <= 0) return showValidationAlert("المبلغ لازم يكون رقم أكبر من 0.", "المبلغ");

    const autoInv = {
      id: genId("emp_tx"),
      createdAt: nowMs(),
      updatedAt: nowMs(),
      status: "approved",

      source: "employee",
      kind: `فاتورة موظف (${invoiceType})`,
      date,
      currency,

      name: String(emp.name || "—"),
      phone: String(emp.phone || ""),
      address: String(emp.address || emp.area || ""),

      employeeId: String(emp.id),
      amount,

      details: [`طريقة الدفع: ${paymentMethod}`, note ? `ملاحظة: ${note}` : ""].filter(Boolean).join(" • "),
    };

    try {
      await execute(async () => {
      // ✅ source of truth write
      if (financeReady) {
        await addToAutoInvoices(finance, autoInv);
      }

      // ✅ compatibility
      if (financeDbUpsert) {
        await financeDbUpsert("auto_invoices", autoInv);
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

      setInvoiceModalOpen(false);
      setInvoiceEmployeeId(null);
      });
    } catch (err) {
      console.error(err);
      showErrorAlert(`فشل حفظ فاتورة الموظف: ${String(err?.message || err)}`);
    }
  };

  /* ======================
     Render helpers
====================== */
  const getNextDueLabel = (emp) => {
    const pr = safeObj(emp.payroll);
    if (!pr.enabled) return "—";
    const next = toDateISOFromAny(pr.nextRunDate) || toDateISOFromAny(pr.startDate) || "—";
    return next;
  };

  const displayLoading = useMinLoadingTime(employeesLoading && employees.length === 0);
  if (displayLoading) {
    return (
      <div style={pageWrap}>
        <div style={contentCenterWrap}>
          <LoadingLogo />
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <LoadingOverlay visible={actionLoading} />
      {!canWriteEmployee && <ReadOnlyBanner />}
      <div style={topRow}>
        <div>
          <h1 style={h1}>الموظفين</h1>
          {loadErr ? <div style={warnText}>⚠️ {loadErr}</div> : null}
        </div>

        <div style={ghostCard}>
          <div style={ghostTitle}>إجمالي الموظفين</div>
          <div style={ghostText}>( {employees.length} )</div>
        </div>
      </div>

      <div style={filtersCard}>
        <div style={filtersRow}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={miniLabel}>بحث</div>
            <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم / هوية / رقم / مسمى وظيفي..." />
          </div>

          <button
            style={btnPrimary}
            onClick={() => { if (employeesAtLimit) { showPlanLimitAlert(); return; } openAddEmployee(); }}
            disabled={!canWriteEmployee || actionLoading}
            title={!canWriteEmployee ? READ_ONLY_MESSAGE : undefined}
          >
            + إضافة موظف
          </button>
        </div>
      </div>

      <div style={sectionCard}>
        <div style={sectionHeader}>
          <div style={sectionTitle}>بطاقات الموظفين</div>
          <div style={sectionHint}>عرض طولي (Cards)</div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div style={contentCenterWrap}>
            <div style={emptyBox}>لا يوجد موظفين بعد.</div>
          </div>
        ) : (
          <div style={list}>
            {filteredEmployees.map((e) => {
              const pr = safeObj(e.payroll);
              const nextDue = getNextDueLabel(e);

              return (
                <div key={e.id} style={cardRow}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={rowTitle}>{e.name || "—"}</div>
                        <span style={chip}>هوية: {e.nationalId || "—"}</span>
                        <span style={chip}>📞 {e.phone || "—"}</span>
                      </div>

                      <div style={meta}>
                        <span>المسمّى: {e.jobTitle || "—"}</span>
                        <span>نوع العمل: {e.employmentType || e.workType || "—"}</span>
                        <span>تاريخ التوظيف: {toDateISOFromAny(e.hireDate) || "—"}</span>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={pr.enabled ? chipIncome : chipExpense}>الراتب: {pr.enabled ? "مفعّل" : "غير مفعّل"}</span>
                        {pr.enabled ? (
                          <>
                            <span style={chip}>
                              مبلغ: <b>{Number(pr.amount) || 0}</b> {currency}
                            </span>
                            <span style={chip}>
                              دفع: <b>{pr.paymentMethod || "كاش"}</b>
                            </span>
                            <span style={chip}>
                              نظام: <b>{pr.paySystem || "بالشهر"}</b>
                            </span>
                            <span style={chip}>
                              <b>القادم:</b> {nextDue}
                            </span>
                          </>
                        ) : (
                          <span style={chip}>—</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button style={btnTiny} onClick={() => openEditEmployee(e)} disabled={!canWriteEmployee || actionLoading} title={!canWriteEmployee ? READ_ONLY_MESSAGE : undefined}>
                          تعديل
                        </button>
                        <button style={btnTiny} onClick={() => openPayrollSettings(e)} disabled={!canWriteEmployee || actionLoading} title={!canWriteEmployee ? READ_ONLY_MESSAGE : undefined}>
                          راتب الموظف
                        </button>
                        <button style={btnTiny} onClick={() => openEmployeeInvoice(e)} disabled={(!financeReady && !financeDbUpsert) || !canWriteEmployee || actionLoading} title={!canWriteEmployee ? READ_ONLY_MESSAGE : undefined}>
                          فاتورة الموظف
                        </button>
                        <button style={btnTinyDanger} onClick={() => deleteEmployee(e.id)} disabled={!canWriteEmployee || actionLoading} title={!canWriteEmployee ? READ_ONLY_MESSAGE : undefined}>
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Employee Modal */}
      <Modal open={employeeModalOpen} onClose={() => setEmployeeModalOpen(false)} title={editingEmployeeId ? "تعديل موظف" : "إضافة موظف"} style={modalCard}>
        <form onSubmit={saveEmployee} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={grid2}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="اسم الموظف *">
                <input style={input} value={employeeForm.name} onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="هوية الموظف *">
                <input style={input} value={employeeForm.nationalId} onChange={(e) => setEmployeeForm((f) => ({ ...f, nationalId: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="رقم هاتف الموظف *">
                <input style={input} value={employeeForm.phone} onChange={(e) => setEmployeeForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="رقم هاتف احتياطي">
                <input style={input} value={employeeForm.phone2} onChange={(e) => setEmployeeForm((f) => ({ ...f, phone2: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="واتساب الموظف">
                <input style={input} value={employeeForm.whatsapp} onChange={(e) => setEmployeeForm((f) => ({ ...f, whatsapp: e.target.value }))} />
              </Field>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="بريد إلكتروني (اختياري)">
                <input style={input} value={employeeForm.email} onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="العنوان">
                <input style={input} value={employeeForm.address} onChange={(e) => setEmployeeForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="المنطقة">
                <input style={input} value={employeeForm.area} onChange={(e) => setEmployeeForm((f) => ({ ...f, area: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="رخصة سواقة">
                <select style={input} value={employeeForm.hasDrivingLicense} onChange={(e) => setEmployeeForm((f) => ({ ...f, hasDrivingLicense: e.target.value }))}>
                  <option value="لا">لا</option>
                  <option value="نعم">نعم</option>
                </select>
              </Field>
            </div>
            <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed #e5e7eb", paddingTop: 10, marginTop: 4 }} />
            <div>
              <Field label="المسمّى الوظيفي">
                <input style={input} value={employeeForm.jobTitle} onChange={(e) => setEmployeeForm((f) => ({ ...f, jobTitle: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="أعلى شهادة">
                <input style={input} value={employeeForm.topEducation} onChange={(e) => setEmployeeForm((f) => ({ ...f, topEducation: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="تاريخ التوظيف">
                <input style={input} type="date" value={employeeForm.hireDate} onChange={(e) => setEmployeeForm((f) => ({ ...f, hireDate: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="نوع العمل">
                <select style={input} value={employeeForm.employmentType} onChange={(e) => setEmployeeForm((f) => ({ ...f, employmentType: e.target.value }))}>
                  {["دوام", "بالطلب", "عقد", "تدريب", "فترة تجريبية"].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div>
              <Field label="مستوى الخبرة">
                <input style={input} value={employeeForm.experienceLevel} onChange={(e) => setEmployeeForm((f) => ({ ...f, experienceLevel: e.target.value }))} />
              </Field>
            </div>
            <div>
              <Field label="سنين العمل">
                <input style={input} value={employeeForm.yearsOfWork} onChange={(e) => setEmployeeForm((f) => ({ ...f, yearsOfWork: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" style={btnGhost} onClick={() => setEmployeeModalOpen(false)}>إلغاء</button>
            <button type="submit" style={btnPrimary} disabled={actionLoading}>حفظ</button>
          </div>
        </form>
      </Modal>

      {/* Payroll Modal */}
      <Modal open={payrollModalOpen} onClose={() => setPayrollModalOpen(false)} title="إعدادات الموظف (الراتب)" style={modalCard}>
        <form onSubmit={savePayrollSettings} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <div style={grid2}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="تفعيل الجدولة">
                    <select style={input} value={payrollForm.enabled ? "on" : "off"} onChange={(e) => setPayrollForm((f) => ({ ...f, enabled: e.target.value === "on" }))}>
                      <option value="on">مفعّل</option>
                      <option value="off">موقوف</option>
                    </select>
                  </Field>
                </div>
                <div>
                  <Field label="راتب الموظف">
                    <input style={input} value={payrollForm.amount} onChange={(e) => setPayrollForm((f) => ({ ...f, amount: e.target.value }))} placeholder={`مثال: 1500 (${currency})`} />
                  </Field>
                </div>
                <div>
                  <Field label="طريقة الدفع">
                    <select style={input} value={payrollForm.paymentMethod} onChange={(e) => setPayrollForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                      {PAYROLL_PAY_METHODS.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div>
                  <Field label="نظام الدفع">
                    <select style={input} value={payrollForm.paySystem} onChange={(e) => setPayrollForm((f) => ({ ...f, paySystem: e.target.value }))}>
                      {PAYROLL_SYSTEMS.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div>
                  <Field label="تاريخ البداية">
                    <input style={input} type="date" value={payrollForm.startDate} onChange={(e) => setPayrollForm((f) => ({ ...f, startDate: e.target.value }))} />
                  </Field>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="ملاحظات">
                    <input style={input} value={payrollForm.note} onChange={(e) => setPayrollForm((f) => ({ ...f, note: e.target.value }))} placeholder="اختياري..." />
                  </Field>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={emptyBox}>
                    تنبيه: أي تعديل هنا يعمل Reset للراتب (nextRunDate يرجع لتاريخ البداية).
                    <br />
                    وتم إرسال حركة “pending” للمالية فور التفعيل — لأنها طلبك: “لما أضيف راتب ينبعت للرئيسي”.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" style={btnGhost} onClick={() => setPayrollModalOpen(false)}>إلغاء</button>
                <button type="submit" style={btnPrimary}>حفظ</button>
              </div>
            </form>
      </Modal>

      {/* Employee Invoice Modal */}
      <Modal open={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title="فاتورة الموظف" style={modalCard}>
        {(() => {
              const emp = employees.find((x) => x.id === invoiceEmployeeId);
              const empName = emp?.name || "—";
              return (
                <>
                  <div style={tinyNote}>
                    الموظف: <b>{empName}</b> — هذه الفاتورة تظهر في FinancePage ضمن <b>الحسابات الآلية</b> (autoInvoices).
                  </div>

                  <form onSubmit={saveEmployeeInvoice} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    <div style={grid2}>
                      <div>
                        <div style={miniLabel}>التاريخ</div>
                        <input style={input} type="date" value={invoiceForm.date} onChange={(e) => setInvoiceForm((f) => ({ ...f, date: e.target.value }))} />
                      </div>

                      <div>
                        <div style={miniLabel}>نوع الفاتورة</div>
                        <select style={input} value={invoiceForm.invoiceType} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceType: e.target.value }))}>
                          {["يومية", "سلفة", "خصم", "مكافأة", "أخرى"].map((x) => (
                            <option key={x} value={x}>{x}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div style={miniLabel}>المبلغ</div>
                        <input style={input} value={invoiceForm.amount} onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))} placeholder={`مثال: 50 (${currency})`} />
                      </div>

                      <div>
                        <div style={miniLabel}>طريقة الدفع</div>
                        <select style={input} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                          {PAYROLL_PAY_METHODS.map((x) => (
                            <option key={x} value={x}>{x}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={miniLabel}>وصف / ملاحظات</div>
                        <input style={input} value={invoiceForm.note} onChange={(e) => setInvoiceForm((f) => ({ ...f, note: e.target.value }))} placeholder="اختياري..." />
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={emptyBox}>هذه فاتورة “موظف” تُسجل داخل autoInvoices (قاعدة المالية الرئيسية).</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button type="button" style={btnGhost} onClick={() => setInvoiceModalOpen(false)}>إلغاء</button>
                      <button type="submit" style={btnPrimary} disabled={actionLoading}>حفظ الفاتورة</button>
                    </div>
                  </form>
                </>
              );
        })()}
      </Modal>
    </div>
  );
}

/* Page-specific styles (rest from shared) */
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const warnText = { marginTop: 10, fontSize: 12, color: "#b45309", fontWeight: 900, lineHeight: 1.7 };
const ghostCard = { border: `1px solid ${theme.border}`, background: theme.surface, borderRadius: 18, padding: "12px 14px", minWidth: 260 };
const ghostTitle = { fontSize: 12, color: theme.text, fontWeight: 900 };
const ghostText = { fontSize: 14, color: theme.textMuted, marginTop: 6, lineHeight: 1.6, fontWeight: 900 };
const filtersCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };
const sectionCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const sectionTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const sectionHint = { fontSize: 12, fontWeight: 900, color: theme.textMuted };

const list = { display: "flex", flexDirection: "column", gap: 10 };
const cardRow = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const rowTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const meta = { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: theme.textMuted, lineHeight: 1.6 };
