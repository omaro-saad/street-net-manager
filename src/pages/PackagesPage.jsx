// src/pages/PackagesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useData } from "../DataContext";
import { safeArray, safeObj, nowMs, genId, fmtMoney } from "../utils/helpers.js";
import { theme } from "../theme.js";

function toNum(x) {
  const s = String(x ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* =========================
   Constants
   ========================= */
const SUB_TYPES = [
  { key: "time", label: "سحب بالأيام" },
  { key: "usage", label: "استهلاك بالسحب" },
];

const VALIDITY_PRESETS = [
  { key: "day", label: "يوم", days: 1 },
  { key: "month", label: "شهر", days: 30 },
  { key: "twoMonths", label: "شهرين", days: 60 },
  { key: "year", label: "سنة", days: 365 },
  { key: "unlimited", label: "لانهائي", days: null },
];

const DIST_PAY_METHODS = ["كاش", "بنكي", "آجل", "أخرى"];
const DIST_PACKAGE_TYPES = ["بطاقة"];

/* =========================
   Validity helpers
   ========================= */
function presetToDays(presetKey) {
  const it = VALIDITY_PRESETS.find((v) => v.key === presetKey);
  if (!it) return 30;
  return it.days;
}
function validityLabel(mode, presetKey, daysValue) {
  if (mode === "preset") {
    const it = VALIDITY_PRESETS.find((v) => v.key === presetKey);
    return it?.label || "—";
  }
  if (daysValue === null) return "لانهائي";
  const n = Number(daysValue);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n} يوم`;
}

function normalizeValidityBlock(v) {
  const x = safeObj(v);
  const mode = x.mode === "manual" ? "manual" : "preset";

  const preset = VALIDITY_PRESETS.some((k) => k.key === x.preset) ? x.preset : "month";
  const manualDaysRaw = x.manualDays;

  if (mode === "preset") {
    const days = presetToDays(preset);
    return { mode: "preset", preset, days, manualDays: "" };
  }

  const d = toNum(manualDaysRaw);
  const days = d === null ? 30 : Math.max(1, Math.floor(d));
  return { mode: "manual", preset: "month", days, manualDays: String(days) };
}

function buildServiceFieldsFromPkg(pkg) {
  const x = safeObj(pkg);
  const type = x.type === "usage" ? "usage" : "time";

  let validityMode = "days";
  let daysOption = "";
  let usageOption = "";

  if (type === "time") {
    const d = x.timeValidityDays;
    if (d === null) {
      validityMode = "usage";
      usageOption = "لا نهائي";
      daysOption = "";
    } else {
      const n = Number(d);
      validityMode = "days";
      daysOption = Number.isFinite(n) && n > 0 ? `${Math.floor(n)} يوم` : "30 يوم";
      usageOption = "";
    }
    return { validityMode, daysOption, usageOption };
  }

  const usageText = String(x.usageText || "").trim();
  const enabled = !!x.usageValidityEnabled;
  const ud = x.usageValidityDays;

  if (enabled && ud !== null) {
    const n = Number(ud);
    validityMode = "days";
    daysOption = Number.isFinite(n) && n > 0 ? `${Math.floor(n)} يوم` : "1 يوم";
    usageOption = usageText || "—";
  } else {
    validityMode = "usage";
    usageOption = usageText || "—";
    daysOption = "";
  }

  return { validityMode, daysOption, usageOption };
}

function normalizePkg(p) {
  const x = safeObj(p);
  const target = x.target === "distributor" ? "distributor" : "subscriber";

  const base = {
    id: x.id || genId("pkg"),
    createdAt: Number(x.createdAt) || nowMs(),
    updatedAt: nowMs(),
    target,
    active: x.active ?? true,
  };

  if (target === "subscriber") {
    const type = SUB_TYPES.some((t) => t.key === x.type) ? x.type : "time";

    const timeValidity = normalizeValidityBlock({
      mode: x.timeValidityMode ?? x.validityMode ?? "preset",
      preset: x.timeValidityPreset ?? x.validityPreset ?? "month",
      manualDays: x.timeValidityManualDays ?? x.validityDays ?? "",
    });

    const usageValidityEnabled = !!x.usageValidityEnabled;
    const usageValidity = normalizeValidityBlock({
      mode: x.usageValidityMode ?? "preset",
      preset: x.usageValidityPreset ?? "day",
      manualDays: x.usageValidityManualDays ?? x.usageValidityDays ?? "",
    });

    const row = {
      ...base,

      type,
      name: String(x.name || "باقة").trim(),
      price: Number(x.price) || 0,
      speed: String(x.speed || "").trim(),

      timeValidityMode: timeValidity.mode,
      timeValidityPreset: timeValidity.preset,
      timeValidityDays: timeValidity.days,
      timeValidityManualDays: timeValidity.manualDays,

      usageText: String(x.usageText || "").trim(),

      usageValidityEnabled,
      usageValidityMode: usageValidity.mode,
      usageValidityPreset: usageValidity.preset,
      usageValidityDays: usageValidity.days,
      usageValidityManualDays: usageValidity.manualDays,

      note: String(x.note || "").trim(),
    };

    const svc = buildServiceFieldsFromPkg(row);

    return {
      ...row,
      validityMode: svc.validityMode,
      daysOption: svc.daysOption,
      usageOption: svc.usageOption,
    };
  }

  return {
    ...base,
    name: String(x.name || "باقة موزع").trim(),
    paymentMethod: DIST_PAY_METHODS.includes(String(x.paymentMethod || "").trim()) ? String(x.paymentMethod).trim() : "كاش",
    packageType: DIST_PACKAGE_TYPES.includes(String(x.packageType || "").trim()) ? String(x.packageType).trim() : "بطاقة",
    cardSpeed: String(x.cardSpeed || "").trim(),
    cardValidity: String(x.cardValidity || "").trim(),
    cardPrice: Number(x.cardPrice) || 0,
    note: String(x.note || "").trim(),
  };
}

/* =========================
   Page
   ========================= */
export default function PackagesPage() {
  const { gate } = useData();

  const [pageTab, setPageTab] = useState("subscriber");
  const [all, setAll] = useState([]);

  const [dbErr, setDbErr] = useState("");

  const loadAll = async () => {
    try {
      if (!gate?.packages?.isReady || typeof gate.packages.list !== "function") {
        setAll([]);
        setDbErr("packages.list غير متوفر (Gate غير جاهز)");
        return;
      }
      const items = await gate.packages.list();
      setAll(
        safeArray(items)
          .map(normalizePkg)
          .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
      );
      setDbErr("");
    } catch (e) {
      setAll([]);
      setDbErr(String(e?.message || e || "Packages error"));
    }
  };

  useEffect(() => {
    loadAll();
    let off = null;
    try {
      if (gate?.packages?.onChanged) off = gate.packages.onChanged(() => loadAll());
    } catch {}
    return () => {
      try {
        if (typeof off === "function") off();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  const list = useMemo(() => all.filter((x) => x.target === pageTab), [all, pageTab]);

  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    let arr = list.slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((x) => {
        const name = String(x.name || "").toLowerCase();
        const note = String(x.note || "").toLowerCase();

        if (x.target === "subscriber") {
          const type = String(x.type || "").toLowerCase();
          const speed = String(x.speed || "").toLowerCase();
          const usage = String(x.usageText || "").toLowerCase();
          const price = String(x.price ?? "").toLowerCase();

          const tv = validityLabel(x.timeValidityMode, x.timeValidityPreset, x.timeValidityDays).toLowerCase();
          const uv = x.usageValidityEnabled ? validityLabel(x.usageValidityMode, x.usageValidityPreset, x.usageValidityDays).toLowerCase() : "";

          const svcVm = String(x.validityMode || "").toLowerCase();
          const svcDays = String(x.daysOption || "").toLowerCase();
          const svcUsage = String(x.usageOption || "").toLowerCase();

          return (
            name.includes(s) ||
            type.includes(s) ||
            speed.includes(s) ||
            usage.includes(s) ||
            note.includes(s) ||
            price.includes(s) ||
            tv.includes(s) ||
            uv.includes(s) ||
            svcVm.includes(s) ||
            svcDays.includes(s) ||
            svcUsage.includes(s)
          );
        }

        const pm = String(x.paymentMethod || "").toLowerCase();
        const pt = String(x.packageType || "").toLowerCase();
        const spd = String(x.cardSpeed || "").toLowerCase();
        const val = String(x.cardValidity || "").toLowerCase();
        const price = String(x.cardPrice ?? "").toLowerCase();
        return name.includes(s) || pm.includes(s) || pt.includes(s) || spd.includes(s) || val.includes(s) || note.includes(s) || price.includes(s);
      });
    }
    return arr;
  }, [list, q]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const makeEmptyForm = (target = pageTab) => {
    if (target === "distributor") {
      return {
        target: "distributor",
        name: "",
        paymentMethod: "كاش",
        packageType: "بطاقة",
        cardSpeed: "",
        cardValidity: "",
        cardPrice: "",
        note: "",
        active: "on",
      };
    }

    return {
      target: "subscriber",
      type: "time",
      name: "",
      price: "",
      speed: "",
      timeValidityMode: "preset",
      timeValidityPreset: "month",
      timeValidityManualDays: "",
      usageText: "",
      usageValidityEnabled: "off",
      usageValidityMode: "preset",
      usageValidityPreset: "day",
      usageValidityManualDays: "",
      note: "",
      active: "on",
    };
  };

  const [form, setForm] = useState(() => makeEmptyForm(pageTab));

  useEffect(() => {
    if (open && editingId) return;
    setForm(makeEmptyForm(pageTab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTab]);

  const openAdd = () => {
    setEditingId(null);
    setForm(makeEmptyForm(pageTab));
    setOpen(true);
  };

  const openEdit = (row) => {
    const x = normalizePkg(row);
    setEditingId(x.id);

    if (x.target === "subscriber") {
      setForm({
        target: "subscriber",
        type: x.type || "time",
        name: x.name || "",
        price: String(x.price ?? ""),
        speed: x.speed || "",
        timeValidityMode: x.timeValidityMode || "preset",
        timeValidityPreset: x.timeValidityPreset || "month",
        timeValidityManualDays: x.timeValidityManualDays || "",
        usageText: x.usageText || "",
        usageValidityEnabled: x.usageValidityEnabled ? "on" : "off",
        usageValidityMode: x.usageValidityMode || "preset",
        usageValidityPreset: x.usageValidityPreset || "day",
        usageValidityManualDays: x.usageValidityManualDays || "",
        note: x.note || "",
        active: x.active ? "on" : "off",
      });
    } else {
      setForm({
        target: "distributor",
        name: x.name || "",
        paymentMethod: x.paymentMethod || "كاش",
        packageType: x.packageType || "بطاقة",
        cardSpeed: x.cardSpeed || "",
        cardValidity: x.cardValidity || "",
        cardPrice: String(x.cardPrice ?? ""),
        note: x.note || "",
        active: x.active ? "on" : "off",
      });
    }

    setOpen(true);
  };

  const remove = async (id) => {
    if (!window.confirm("حذف هذه الباقة؟")) return;
    if (!gate?.packages?.isReady || typeof gate.packages.remove !== "function") return alert("packages.remove غير متوفر");
    await gate.packages.remove(id);
  };

  const buildValidityFromForm = ({ mode, preset, manualDays }) => {
    const m = mode === "manual" ? "manual" : "preset";
    if (m === "preset") {
      const pr = VALIDITY_PRESETS.some((v) => v.key === preset) ? preset : "month";
      return { mode: "preset", preset: pr, days: presetToDays(pr), manualDays: "" };
    }
    const d = toNum(manualDays);
    if (d === null || d <= 0) return { error: "القيمة اليدوية لازم تكون رقم أيام صحيح." };
    return { mode: "manual", preset: "month", days: Math.floor(d), manualDays: String(Math.floor(d)) };
  };

  const save = async (e) => {
    e.preventDefault();

    const target = form.target === "distributor" ? "distributor" : "subscriber";
    const active = form.active === "on";

    if (!gate?.packages?.isReady || typeof gate.packages.upsert !== "function") return alert("packages.upsert غير متوفر");

    const id = editingId ? editingId : genId("pkg");
    const createdAt = editingId ? (all.find((x) => String(x.id) === String(id))?.createdAt || nowMs()) : nowMs();

    if (target === "subscriber") {
      const type = SUB_TYPES.some((t) => t.key === form.type) ? form.type : "time";
      const name = String(form.name || "").trim();
      const price = toNum(form.price);
      const speed = String(form.speed || "").trim();

      if (!name) return alert("اسم باقة المشترك مطلوب.");
      if (price === null || price < 0) return alert("سعر الباقة لازم يكون رقم صحيح (0 أو أكثر).");
      if (!speed) return alert("سرعة الباقة مطلوبة.");

      const timeV = buildValidityFromForm({
        mode: form.timeValidityMode,
        preset: form.timeValidityPreset,
        manualDays: form.timeValidityManualDays,
      });
      if (timeV.error) return alert(timeV.error);

      const usageText = String(form.usageText || "").trim();
      if (type === "usage" && !usageText) {
        return alert("اكتب الاستهلاك/السحب كنص واضح (مثال: 700 ميجا).");
      }

      const usageValidityEnabled = form.usageValidityEnabled === "on";
      let usageV = { mode: "preset", preset: "day", days: 1, manualDays: "" };
      if (usageValidityEnabled) {
        usageV = buildValidityFromForm({
          mode: form.usageValidityMode,
          preset: form.usageValidityPreset,
          manualDays: form.usageValidityManualDays,
        });
        if (usageV.error) return alert(`صلاحية الاستهلاك: ${usageV.error}`);
      } else {
        usageV = { mode: "preset", preset: "unlimited", days: null, manualDays: "" };
      }

      const note = String(form.note || "").trim();

      const row = normalizePkg({
        id,
        createdAt,
        target,
        active,
        type,
        name,
        price: Number(price) || 0,
        speed,
        timeValidityMode: timeV.mode,
        timeValidityPreset: timeV.preset,
        timeValidityDays: timeV.days,
        timeValidityManualDays: timeV.manualDays,
        usageText,
        usageValidityEnabled,
        usageValidityMode: usageV.mode,
        usageValidityPreset: usageV.preset,
        usageValidityDays: usageV.days,
        usageValidityManualDays: usageV.manualDays,
        note,
      });

      await gate.packages.upsert(row);

      setOpen(false);
      setEditingId(null);
      return;
    }

    // distributor
    const name = String(form.name || "").trim();
    const paymentMethod = DIST_PAY_METHODS.includes(String(form.paymentMethod || "").trim()) ? String(form.paymentMethod).trim() : "كاش";
    const packageType = DIST_PACKAGE_TYPES.includes(String(form.packageType || "").trim()) ? String(form.packageType).trim() : "بطاقة";

    const cardSpeed = String(form.cardSpeed || "").trim();
    const cardValidity = String(form.cardValidity || "").trim();
    const cardPrice = toNum(form.cardPrice);
    const note = String(form.note || "").trim();

    if (!name) return alert("اسم باقة الموزع مطلوب.");
    if (!paymentMethod) return alert("اختر آلية الدفع.");
    if (!packageType) return alert("اختر نوع الباقة.");
    if (!cardSpeed) return alert("اكتب سرعة البطاقة.");
    if (!cardValidity) return alert("اكتب صلاحية البطاقة.");
    if (cardPrice === null || cardPrice < 0) return alert("سعر البطاقة لازم يكون رقم صحيح (0 أو أكثر).");

    const row = normalizePkg({
      id,
      createdAt,
      target,
      active,
      name,
      paymentMethod,
      packageType,
      cardSpeed,
      cardValidity,
      cardPrice: Number(cardPrice) || 0,
      note,
    });

    await gate.packages.upsert(row);

    setOpen(false);
    setEditingId(null);
  };

  /* =========================
     ✅ Invoice generation (NO DB)
     ========================= */
  const generateInvoicesForPackage = async (pkg) => {
    const x = normalizePkg(pkg);
    if (!x?.id) return alert("الباقة غير صالحة.");

    if (!gate?.invoices?.isReady || typeof gate.invoices.appendMany !== "function") {
      return alert("invoices.appendMany غير متوفر (Gate invoices غير جاهز)");
    }

    // NOTE: هذا “إرسال” بالمعنى المنطقي داخل التطبيق: إضافة فواتير للـ Context
    if (x.target === "subscriber") {
      const subs = (await gate.subscribers.list()) || [];
      if (safeArray(subs).length === 0) return alert("ما في مشتركين حالياً لتوليد فواتير.");

      const rows = safeArray(subs).map((s) => {
        const sid = String(s?.id || "");
        return {
          id: genId("inv_sub"),
          createdAt: nowMs(),
          target: "subscriber",
          subscriberId: sid,
          subscriberName: String(s?.name || "").trim(),
          packageId: x.id,
          packageName: x.name || "—",
          amount: Number(x.price) || 0,
          meta: {
            type: x.type,
            speed: x.speed || "",
            timeValidityDays: x.timeValidityDays ?? null,
            usageText: x.usageText || "",
            usageValidityEnabled: !!x.usageValidityEnabled,
            usageValidityDays: x.usageValidityDays ?? null,
          },
          status: "unpaid",
        };
      });

      await gate.invoices.appendMany("subscriber", rows);
      alert(`✅ تم توليد ${rows.length} فاتورة للمشتركين (In-Memory)`);
      return;
    }

    // distributor
    const dists = (await gate.distributors.list()) || [];
    if (safeArray(dists).length === 0) return alert("ما في موزعين حالياً لتوليد فواتير.");

    const rows = safeArray(dists).map((d) => {
      const did = String(d?.id || "");
      return {
        id: genId("inv_dist"),
        createdAt: nowMs(),
        target: "distributor",
        distributorId: did,
        distributorName: String(d?.name || "").trim(),
        packageId: x.id,
        packageName: x.name || "—",
        amount: Number(x.cardPrice) || 0,
        meta: {
          paymentMethod: x.paymentMethod || "كاش",
          packageType: x.packageType || "بطاقة",
          cardSpeed: x.cardSpeed || "",
          cardValidity: x.cardValidity || "",
        },
        status: "unpaid",
      };
    });

    await gate.invoices.appendMany("distributor", rows);
    alert(`✅ تم توليد ${rows.length} فاتورة للموزعين (In-Memory)`);
  };

  // ===== Render =====
  return (
    <div style={pageWrap}>
      <div style={topRow}>
        <div>
          <h1 style={h1}>الحزم والباقات</h1>
          <div style={hint}>بدون قواعد بيانات — كل شيء داخل الـ Context (وبيطير مع refresh)</div>
          {dbErr ? <div style={warnBox}>⚠️ {dbErr}</div> : null}
        </div>

        <div style={ghostCard}>
          <div style={ghostTitle}>ملاحظة</div>
          <div style={ghostText}>الصلاحية: اختيار سريع أو يدوي + المودال Scroll + العرض Cards.</div>
        </div>
      </div>

      <div style={tabsWrap}>
        <div style={tabsRight}>
          <button style={tabBtn(pageTab === "subscriber")} onClick={() => setPageTab("subscriber")}>
            باقات المشتركين
          </button>
          <button style={tabBtn(pageTab === "distributor")} onClick={() => setPageTab("distributor")}>
            باقات الموزعين
          </button>
        </div>

        <div style={tabsLeft}>
          <button style={tabBtnSpecial(true)} onClick={openAdd}>
            + إضافة باقة
          </button>
        </div>
      </div>

      <div style={filtersCard}>
        <div style={filtersRow}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={miniLabel}>بحث</div>
            <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم/السرعة/الصلاحية/السعر..." />
          </div>
        </div>
      </div>

      <div style={sectionCard}>
        <div style={sectionHeader}>
          <div style={sectionTitle}>{pageTab === "subscriber" ? "باقات المشتركين" : "باقات الموزعين"}</div>
          <div style={sectionHint}>{filtered.length} باقة</div>
        </div>

        {filtered.length === 0 ? (
          <div style={emptyBox}>لا يوجد عروض بعد. اضغط “إضافة باقة”.</div>
        ) : (
          <div style={cardsGrid}>
            {filtered.map((x) => {
              const isSub = x.target === "subscriber";
              const badge = isSub ? SUB_TYPES.find((t) => t.key === x.type)?.label || "—" : `${x.paymentMethod || "كاش"} • ${x.packageType || "بطاقة"}`;

              const lines = isSub
                ? x.type === "time"
                  ? [`⚡ السرعة: ${x.speed || "—"}`, `⏳ الصلاحية: ${validityLabel(x.timeValidityMode, x.timeValidityPreset, x.timeValidityDays)}`]
                  : [`⚡ السرعة: ${x.speed || "—"}`, `📉 الاستهلاك: ${x.usageText || "—"}`, `⏳ صلاحية أيام: ${x.usageValidityEnabled ? validityLabel(x.usageValidityMode, x.usageValidityPreset, x.usageValidityDays) : "بدون"}`]
                : [`⚡ سرعة البطاقة: ${x.cardSpeed || "—"}`, `⏳ صلاحية البطاقة: ${x.cardValidity || "—"}`, `💰 سعر البطاقة: ${fmtMoney(x.cardPrice)}`];

              const priceLine = isSub ? `💰 السعر: ${fmtMoney(x.price)}` : `💰 السعر: ${fmtMoney(x.cardPrice)}`;

              return (
                <div key={x.id} style={card}>
                  <div style={cardTop}>
                    <div style={cardTitleWrap}>
                      <div style={cardTitle}>{x.name || "—"}</div>
                      <div style={cardBadgeRow}>
                        <span style={chip2}>{badge}</span>
                        <span style={x.active ? chipApproved : chipPending}>{x.active ? "مفعّلة" : "موقوفة"}</span>
                      </div>
                    </div>

                    <div style={cardPrice}>{priceLine}</div>
                  </div>

                  <div style={cardBody}>
                    {lines.map((t, i) => (
                      <div key={i} style={cardLine}>
                        {t}
                      </div>
                    ))}
                    {x.note ? <div style={cardNote}>📝 {x.note}</div> : null}
                  </div>

                  <div style={cardActions}>
                    <button style={btnTiny} onClick={() => openEdit(x)}>
                      تعديل
                    </button>
                    <button style={btnTiny} onClick={() => generateInvoicesForPackage(x)} title="توليد فواتير حسب نوع الباقة للموجودين حالياً">
                      توليد فواتير
                    </button>
                    <button style={btnTinyDanger} onClick={() => remove(x.id)}>
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div style={modalOverlay} onMouseDown={() => setOpen(false)}>
          <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>{editingId ? "تعديل باقة" : "إضافة باقة"}</div>
              <button style={iconBtn} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div style={modalScroll}>
              <div style={selectorBlockFull}>
                <div style={miniLabel}>الجهة</div>
                <div style={segRow}>
                  <button type="button" style={segBtn(form.target !== "distributor")} onClick={() => setForm(makeEmptyForm("subscriber"))}>
                    مشتركين
                  </button>
                  <button type="button" style={segBtn(form.target === "distributor")} onClick={() => setForm(makeEmptyForm("distributor"))}>
                    موزعين
                  </button>
                </div>
              </div>

              {form.target !== "distributor" ? (
                <div style={selectorBlockFull}>
                  <div style={miniLabel}>نوع العرض (للمشترك)</div>
                  <div style={segRowWrap}>
                    {SUB_TYPES.map((t) => (
                      <button key={t.key} type="button" style={segBtnSmall(form.type === t.key)} onClick={() => setForm((f) => ({ ...f, type: t.key }))}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {form.target !== "distributor" ? (
                  <div style={grid2}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={miniLabel}>اسم الباقة</div>
                      <input style={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>سعر الباقة</div>
                      <input style={input} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>سرعة الباقة</div>
                      <input style={input} value={form.speed} onChange={(e) => setForm((f) => ({ ...f, speed: e.target.value }))} placeholder="مثال: 2 ميجا / 10Mbps" />
                    </div>

                    {form.type === "time" ? (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={miniLabel}>الصلاحية</div>
                        <br />
                        <div style={segRow}>
                          <button type="button" style={segBtn(form.timeValidityMode === "preset")} onClick={() => setForm((f) => ({ ...f, timeValidityMode: "preset", timeValidityManualDays: "" }))}>
                            اختيار سريع
                          </button>
                          <button type="button" style={segBtn(form.timeValidityMode === "manual")} onClick={() => setForm((f) => ({ ...f, timeValidityMode: "manual" }))}>
                            إدخال يدوي
                          </button>
                        </div>
                        <br />
                        {form.timeValidityMode === "preset" ? (
                          <select style={input} value={form.timeValidityPreset} onChange={(e) => setForm((f) => ({ ...f, timeValidityPreset: e.target.value }))}>
                            {VALIDITY_PRESETS.map((v) => (
                              <option key={v.key} value={v.key}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            style={input}
                            inputMode="numeric"
                            value={String(form.timeValidityManualDays ?? "")}
                            onChange={(e) => setForm((f) => ({ ...f, timeValidityManualDays: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="مثال: 60 = شهرين"
                          />
                        )}
                        <div style={tinyNote}>✅ اختيار واحد فقط. “لانهائي” موجود في الاختيار السريع.</div>
                      </div>
                    ) : null}

                    {form.type === "usage" ? (
                      <>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={miniLabel}>الاستهلاك / السحب (نص)</div>
                          <input style={input} value={form.usageText} onChange={(e) => setForm((f) => ({ ...f, usageText: e.target.value }))} placeholder="مثال: 700 ميجا / 20 جيجا / 200 ساعة" />
                          <div style={tinyNote}>الأساس بدون تاريخ انتهاء، لكن تقدر تضيف صلاحية أيام اختيارية تحت.</div>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={miniLabel}>إضافة صلاحية أيام (اختياري)</div>

                          <div style={segRow}>
                            <button type="button" style={segBtn(form.usageValidityEnabled === "on")} onClick={() => setForm((f) => ({ ...f, usageValidityEnabled: "on" }))}>
                              نعم
                            </button>
                            <button type="button" style={segBtn(form.usageValidityEnabled !== "on")} onClick={() => setForm((f) => ({ ...f, usageValidityEnabled: "off" }))}>
                              لا
                            </button>
                          </div>

                          <br />

                          {form.usageValidityEnabled === "on" ? (
                            <div style={{ marginTop: 10 }}>
                              <div style={miniLabel}>طريقة إدخال الصلاحية</div>

                              <div style={segRow}>
                                <button type="button" style={segBtn(form.usageValidityMode === "preset")} onClick={() => setForm((f) => ({ ...f, usageValidityMode: "preset", usageValidityManualDays: "" }))}>
                                  اختيار سريع
                                </button>
                                <button type="button" style={segBtn(form.usageValidityMode === "manual")} onClick={() => setForm((f) => ({ ...f, usageValidityMode: "manual" }))}>
                                  إدخال يدوي
                                </button>
                              </div>

                              <br />

                              {form.usageValidityMode === "preset" ? (
                                <select style={input} value={form.usageValidityPreset} onChange={(e) => setForm((f) => ({ ...f, usageValidityPreset: e.target.value }))}>
                                  {VALIDITY_PRESETS.map((v) => (
                                    <option key={v.key} value={v.key}>
                                      {v.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  style={input}
                                  inputMode="numeric"
                                  value={String(form.usageValidityManualDays ?? "")}
                                  onChange={(e) => setForm((f) => ({ ...f, usageValidityManualDays: e.target.value.replace(/[^\d]/g, "") }))}
                                  placeholder="مثال: 7"
                                />
                              )}

                              <div style={tinyNote}>✅ اختيار واحد فقط.</div>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={miniLabel}>ملاحظة (اختياري)</div>
                      <textarea style={{ ...input, minHeight: 90, resize: "vertical" }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>الحالة</div>
                      <select style={input} value={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value }))}>
                        <option value="on">مفعّلة</option>
                        <option value="off">موقوفة</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={grid2}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={miniLabel}>اسم الباقة</div>
                      <input style={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>آلية الدفع</div>
                      <select style={input} value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                        {DIST_PAY_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={miniLabel}>نوع الباقة</div>
                      <select style={input} value={form.packageType} onChange={(e) => setForm((f) => ({ ...f, packageType: e.target.value }))}>
                        {DIST_PACKAGE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={miniLabel}>سرعة البطاقة</div>
                      <input style={input} value={form.cardSpeed} onChange={(e) => setForm((f) => ({ ...f, cardSpeed: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>صلاحية البطاقة</div>
                      <input style={input} value={form.cardValidity} onChange={(e) => setForm((f) => ({ ...f, cardValidity: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>سعر البطاقة</div>
                      <input style={input} value={form.cardPrice} onChange={(e) => setForm((f) => ({ ...f, cardPrice: e.target.value }))} />
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={miniLabel}>ملاحظة (اختياري)</div>
                      <textarea style={{ ...input, minHeight: 90, resize: "vertical" }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                    </div>

                    <div>
                      <div style={miniLabel}>الحالة</div>
                      <select style={input} value={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value }))}>
                        <option value="on">مفعّلة</option>
                        <option value="off">موقوفة</option>
                      </select>
                    </div>
                  </div>
                )}

                <div style={modalActionsSticky}>
                  <button type="button" style={btnGhost} onClick={() => setOpen(false)}>
                    إلغاء
                  </button>
                  <button type="submit" style={btnPrimary}>
                    حفظ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Styles
   ========================= */
const pageWrap = { display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto", paddingBottom: 10 };
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const h1 = { fontSize: 26, fontWeight: 900, color: "#111827" };
const hint = { fontSize: 12, color: "#6b7280", fontWeight: 900, marginTop: 6, lineHeight: 1.7 };

const warnBox = { marginTop: 10, border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 14, padding: 10, color: "#9a3412", fontWeight: 900, fontSize: 12, lineHeight: 1.7 };

const ghostCard = { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 18, padding: "12px 14px", minWidth: 260 };
const ghostTitle = { fontSize: 12, color: "#111827", fontWeight: 900 };
const ghostText = { fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.6 };

const tabsWrap = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", border: "1px solid #e5e7eb", background: "#fff", borderRadius: 18, padding: 10 };
const tabsRight = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const tabsLeft = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

const tabBtn = (active) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: active ? "none" : "1px solid #e5e7eb",
  background: active ? theme.primary : "#fff",
  color: active ? "#fff" : "#111827",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 13,
  boxShadow: active ? "0 12px 30px rgba(15,23,42,0.12)" : "none",
});
const tabBtnSpecial = (active) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: active ? "none" : `1px solid ${theme.primary}`,
  background: active ? theme.primary : "#f5f3ff",
  color: active ? "#fff" : "#4c1d95",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 13,
  boxShadow: active ? "0 14px 34px rgba(139,92,246,0.25)" : "0 10px 24px rgba(15,23,42,0.06)",
});

const filtersCard = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };
const miniLabel = { fontSize: 12, color: "#6b7280", fontWeight: 900 };

const input = { padding: "10px 12px", borderRadius: 14, border: "1px solid #d1d5db", fontSize: 14, outline: "none", backgroundColor: "#ffffff", width: "100%", boxSizing: "border-box" };

const sectionCard = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
const sectionTitle = { fontSize: 15, fontWeight: 900, color: "#111827" };
const sectionHint = { fontSize: 12, fontWeight: 900, color: "#6b7280" };

const emptyBox = { border: "1px dashed #e5e7eb", background: "#f9fafb", borderRadius: 18, padding: 14, fontSize: 13, color: "#6b7280", lineHeight: 1.7 };

const chip2 = { padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#111827", fontWeight: 900, fontSize: 12 };
const chipPending = { padding: "6px 10px", borderRadius: 999, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", fontWeight: 900, fontSize: 12 };
const chipApproved = { padding: "6px 10px", borderRadius: 999, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", fontWeight: 900, fontSize: 12 };

const btnPrimary = { padding: "10px 16px", borderRadius: 999, border: "none", backgroundColor: theme.primary, color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.15)", whiteSpace: "nowrap" };
const btnTinyDanger = { padding: "8px 12px", borderRadius: 999, border: "none", backgroundColor: "#dc2626", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const btnTiny = { padding: "8px 12px", borderRadius: 999, border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#111827", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const btnGhost = { padding: "10px 16px", borderRadius: 999, border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#111827", fontWeight: 900, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" };

const tinyNote = { fontSize: 12, color: "#6b7280", lineHeight: 1.7 };

const cardsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, alignItems: "stretch" };

const card = { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 12px 30px rgba(15,23,42,0.06)" };

const cardTop = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const cardTitleWrap = { display: "flex", flexDirection: "column", gap: 8 };
const cardTitle = { fontSize: 16, fontWeight: 900, color: "#111827" };
const cardBadgeRow = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };

const cardPrice = { fontSize: 13, fontWeight: 900, color: "#111827", padding: "8px 10px", borderRadius: 14, border: "1px solid #e5e7eb", background: "#f9fafb" };
const cardBody = { display: "flex", flexDirection: "column", gap: 6, flex: 1 };
const cardLine = { fontSize: 12, color: "#374151", lineHeight: 1.7 };
const cardNote = { fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginTop: 4 };

const cardActions = { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" };

const modalOverlay = { position: "fixed", inset: 0, background: "rgba(17,24,39,0.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16, zIndex: 999 };
const modalCard = { width: "min(920px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #e5e7eb", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: 14, maxHeight: "92vh", display: "flex", flexDirection: "column" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 };
const modalTitle = { fontSize: 16, fontWeight: 900, color: "#111827" };
const iconBtn = { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "8px 10px", cursor: "pointer", fontWeight: 900 };

const modalScroll = { overflowY: "auto", paddingRight: 6, paddingBottom: 10 };

const modalActionsSticky = { position: "sticky", bottom: 0, background: "#fff", paddingTop: 10, marginTop: 6, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 };

const selectorBlockFull = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 };

const segRow = { display: "flex", gap: 10, flexWrap: "wrap" };
const segRowWrap = { display: "flex", gap: 10, flexWrap: "wrap" };

const segBtn = (active) => ({
  flex: 1,
  minWidth: 160,
  padding: "10px 12px",
  borderRadius: 14,
  border: active ? "none" : "1px solid #e5e7eb",
  background: active ? theme.primary : "#fff",
  color: active ? "#fff" : "#111827",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 13,
  boxShadow: active ? "0 12px 30px rgba(15,23,42,0.12)" : "none",
});

const segBtnSmall = (active) => ({
  padding: "9px 12px",
  borderRadius: 14,
  border: active ? "none" : "1px solid #e5e7eb",
  background: active ? theme.primary : "#fff",
  color: active ? "#fff" : "#111827",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
  boxShadow: active ? "0 12px 30px rgba(15,23,42,0.12)" : "none",
});

const grid2 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
