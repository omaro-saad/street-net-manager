// src/pages/LinesPage.jsx
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useData } from "../DataContext";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAlert } from "../contexts/AlertContext.jsx";
import ReadOnlyBanner from "../components/ReadOnlyBanner.jsx";
import {
  READ_ONLY_MESSAGE,
  isApiMode,
  apiLinesList,
  apiLinesAdd,
  apiLinesUpdate,
  apiLinesDelete,
} from "../lib/api.js";
import { getCachedLines, setCachedLines, invalidateLines } from "../lib/apiCache.js";
import LoadingLogo from "../components/LoadingLogo.jsx";
import { useMinLoadingTime } from "../hooks/useMinLoadingTime.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import LoadingOverlay from "../components/LoadingOverlay.jsx";
import { safeArray, safeObj, nowMs, genId, normId } from "../utils/helpers.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { usePageTips } from "../hooks/usePageTips.js";
import PageTipsModal from "../components/PageTipsModal.jsx";
import { PAGE_TIPS } from "../constants/pageTips.js";
import { theme } from "../theme.js";
import { Field } from "../components/shared/index.js";
import {
  pageWrap,
  input,
  btnPrimary,
  btnOutline,
  btnTinyPrimary,
  btnTinyDanger,
  iconBtn,
  miniLabel,
  modalHeader,
  modalTitle,
  modalOverlay,
  modalContent,
  emptyText,
  chip,
  h1,
  textMuted,
  grid2,
  contentCenterWrap,
} from "../styles/shared.js";
function ensureLineShape(raw) {
  const x = raw && typeof raw === "object" ? raw : {};
  const id = normId(x.id) || genId("line");
  const key = normId(x.key) || `line:${id}`;

  return {
    id,
    key,
    name: String(x.name || "").trim(),
    address: String(x.address || "").trim(),
    active: x.active === 0 ? false : Boolean(x.active ?? true),
    createdAt: Number(x.createdAt) || nowMs(),
    updatedAt: Number(x.updatedAt) || nowMs(),
  };
}
function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}
function cleanText(x) {
  const s = String(x ?? "").trim();
  return s ? s : "";
}

const TIPS_PAGE_KEY = "lines";

export default function LinesPage() {
  const ctx = useData();
  const { data, setData } = ctx || {};
  const { getLimit, canWrite, token } = useAuth();
  const { showTips, handleTipsDone, handleTipsLinkClick } = usePageTips(TIPS_PAGE_KEY);
  const { showPlanLimitAlert, showReadOnlyAlert, showValidationAlert, showErrorAlert, showConfirmAlert } = useAlert();
  const canWriteLines = canWrite("lines");
  const { isNarrow, isMobile } = useResponsive();

  const useLinesApi = isApiMode() && !!token;
  const [linesFromApi, setLinesFromApi] = useState([]);
  const [linesApiLoading, setLinesApiLoading] = useState(false);
  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  const loadLinesApi = useCallback(async () => {
    if (!useLinesApi || !token) return;
    const cached = getCachedLines();
    if (cached != null) {
      setLinesFromApi(cached);
      return;
    }
    setLinesApiLoading(true);
    try {
      const res = await apiLinesList(token);
      if (res.ok && Array.isArray(res.data)) {
        const shaped = res.data.map(ensureLineShape);
        setLinesFromApi(shaped);
        setCachedLines(shaped);
      } else setLinesFromApi([]);
    } catch {
      setLinesFromApi([]);
    } finally {
      setLinesApiLoading(false);
    }
  }, [useLinesApi, token]);

  useEffect(() => {
    if (useLinesApi) loadLinesApi();
  }, [useLinesApi, loadLinesApi]);

  // Sync API lines into DataContext so SubscribersPage, DistributorsPage, MyMapPage can read them
  useEffect(() => {
    if (!useLinesApi || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      lines: { items: linesFromApi },
      updatedAt: nowMs(),
    }));
  }, [useLinesApi, linesFromApi, setData]);

  const lines = useMemo(() => {
    if (useLinesApi) return linesFromApi;
    const raw = data?.lines?.items ?? data?.lines ?? [];
    return safeArray(raw).map(ensureLineShape);
  }, [useLinesApi, linesFromApi, data?.lines]);

  const linesLimit = getLimit("lines");
  const linesAtLimit = linesLimit != null && lines.length >= linesLimit;

  const subscribersSource = useMemo(() => safeArray(data?.subscribers ?? []), [data?.subscribers]);
  const distributorsSource = useMemo(() => safeArray(data?.distributors ?? []), [data?.distributors]);

  // ===== Local CRUD: Lines =====
  const localUpsertLine = (id, patch, { isNew } = { isNew: false }) => {
    if (typeof setData !== "function") {
      showErrorAlert("لا يمكن الحفظ: setData غير متوفر في DataContext.");
      return false;
    }

    setData((prev) => {
      const p = safeObj(prev);
      const holder = isObj(p.lines) ? safeObj(p.lines) : null;

      // support both shapes:
      // 1) lines: { items: [] }
      // 2) lines: []
      const arr = holder ? safeArray(holder.items) : safeArray(p.lines);

      if (isNew) {
        const nextArr = [patch, ...arr];
        return holder
          ? { ...p, lines: { ...holder, items: nextArr }, updatedAt: nowMs() }
          : { ...p, lines: nextArr, updatedAt: nowMs() };
      }

      const idx = arr.findIndex((x) => normId(x?.id) === normId(id));
      if (idx === -1) {
        const nextArr = [{ id, ...patch }, ...arr];
        return holder
          ? { ...p, lines: { ...holder, items: nextArr }, updatedAt: nowMs() }
          : { ...p, lines: nextArr, updatedAt: nowMs() };
      }

      const next = arr.slice();
      next[idx] = { ...safeObj(next[idx]), ...patch, id: normId(id) };

      return holder
        ? { ...p, lines: { ...holder, items: next }, updatedAt: nowMs() }
        : { ...p, lines: next, updatedAt: nowMs() };
    });

    return true;
  };

  const localRemoveLine = (id) => {
    if (typeof setData !== "function") {
      showErrorAlert("لا يمكن الحذف: setData غير متوفر في DataContext.");
      return false;
    }

    setData((prev) => {
      const p = safeObj(prev);
      const holder = isObj(p.lines) ? safeObj(p.lines) : null;
      const arr = holder ? safeArray(holder.items) : safeArray(p.lines);

      const nextArr = arr.filter((x) => normId(x?.id) !== normId(id));

      return holder
        ? { ...p, lines: { ...holder, items: nextArr }, updatedAt: nowMs() }
        : { ...p, lines: nextArr, updatedAt: nowMs() };
    });

    return true;
  };

  const localToggleActive = (id) => {
    const current = lines.find((l) => normId(l.id) === normId(id));
    if (!current) return false;

    const ok = localUpsertLine(id, { active: !Boolean(current.active), updatedAt: nowMs() }, { isNew: false });
    return ok;
  };

  // ===== UI state =====
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredLines = useMemo(() => {
    let arr = safeArray(lines);

    if (activeFilter !== "all") {
      const wantActive = activeFilter === "active";
      arr = arr.filter((l) => Boolean(l.active) === wantActive);
    }

    if (q.trim()) {
      const query = q.trim().toLowerCase();
      arr = arr.filter((l) => {
        const name = String(l.name || "").toLowerCase();
        const address = String(l.address || "").toLowerCase();
        return name.includes(query) || address.includes(query);
      });
    }

    arr.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return arr;
  }, [lines, q, activeFilter]);

  // ===== Modals =====
  const overlayRef = useRef(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return { name: "", address: "", active: true };
  }

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowAdd(true);
  };
  const closeAdd = () => setShowAdd(false);

  const openEdit = (line) => {
    const l = ensureLineShape(line);
    setEditing(l);
    setForm({
      name: l.name || "",
      address: l.address || "",
      active: Boolean(l.active),
    });
    setShowEdit(true);
  };
  const closeEdit = () => {
    setEditing(null);
    setShowEdit(false);
  };

  // =========================
  // CRUD (API when useLinesApi, else local)
  // =========================
  const addLine = async (e) => {
    e.preventDefault();
    if (!canWriteLines) return showReadOnlyAlert();

    if (linesAtLimit) {
      showPlanLimitAlert();
      return;
    }

    const payload = validate(form);
    if (!payload.ok) return showValidationAlert(payload.msg);

    await execute(async () => {
    if (useLinesApi && token) {
      const optimistic = ensureLineShape({
        id: `temp-${Date.now()}`,
        name: payload.data.name,
        address: payload.data.address,
        active: payload.data.active,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setLinesFromApi((prev) => [optimistic, ...prev]);
      closeAdd();
      const res = await apiLinesAdd(token, {
        name: payload.data.name,
        address: payload.data.address,
        active: payload.data.active,
      });
      if (!res.ok) {
        setLinesFromApi((prev) => prev.filter((l) => l.id !== optimistic.id));
        return showErrorAlert(res.error || "فشل إضافة الخط.");
      }
      if (res.data) {
        const server = ensureLineShape(res.data);
        setLinesFromApi((prev) => prev.map((l) => (l.id === optimistic.id ? server : l)));
        invalidateLines();
      }
      return;
    }

    const newLine = ensureLineShape({
      id: genId("line"),
      name: payload.data.name,
      address: payload.data.address,
      active: payload.data.active,
      createdAt: nowMs(),
      updatedAt: nowMs(),
    });

    const ok = localUpsertLine(newLine.id, newLine, { isNew: true });
    if (!ok) return showErrorAlert("فشل حفظ الخط محليًا.");
    closeAdd();
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!canWriteLines) return showReadOnlyAlert();

    const payload = validate(form);
    if (!payload.ok) return showValidationAlert(payload.msg);

    await execute(async () => {
    if (useLinesApi && token) {
      const res = await apiLinesUpdate(token, editing.id, {
        name: payload.data.name,
        address: payload.data.address,
        active: payload.data.active,
      });
      if (!res.ok) return showErrorAlert(res.error || "فشل تحديث الخط.");
      if (res.data) {
        const next = ensureLineShape(res.data);
        setLinesFromApi((prev) => prev.map((l) => (normId(l.id) === normId(editing.id) ? next : l)));
        invalidateLines();
      }
      closeEdit();
      return;
    }

    const patch = {
      name: payload.data.name,
      address: payload.data.address,
      active: payload.data.active,
      updatedAt: nowMs(),
    };
    const ok = localUpsertLine(editing.id, patch, { isNew: false });
    if (!ok) return showErrorAlert("فشل تعديل الخط محليًا.");
    closeEdit();
    });
  };

  const deleteLine = async (id) => {
    if (!canWriteLines) return showReadOnlyAlert();
    showConfirmAlert({
      message: "حذف الخط؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
          if (useLinesApi && token) {
            const res = await apiLinesDelete(token, id);
            if (!res.ok) return showErrorAlert(res.error || "فشل حذف الخط.");
            setLinesFromApi((prev) => prev.filter((l) => normId(l.id) !== normId(id)));
            invalidateLines();
            return;
          }
          const ok = localRemoveLine(id);
          if (!ok) showErrorAlert("فشل حذف الخط محليًا.");
        });
      },
    });
  };

  const toggleActive = async (id) => {
    if (!canWriteLines) return showReadOnlyAlert();
    const current = lines.find((l) => normId(l.id) === normId(id));
    if (!current) return;

    await execute(async () => {
    if (useLinesApi && token) {
      const res = await apiLinesUpdate(token, id, { active: !Boolean(current.active) });
      if (!res.ok) return showErrorAlert(res.error || "فشل تغيير الحالة.");
      if (res.data) {
        const next = ensureLineShape(res.data);
        setLinesFromApi((prev) => prev.map((l) => (normId(l.id) === normId(id) ? next : l)));
        invalidateLines();
      }
      return;
    }
    const ok = localToggleActive(id);
    if (!ok) showErrorAlert("فشل تغيير حالة الخط محليًا.");
    });
  };

  // =========================
  // Line Panel (Tabs: subs + dists) - Local Data
  // =========================
  const [linePanelOpen, setLinePanelOpen] = useState(false);
  const [linePanelLine, setLinePanelLine] = useState(null);

  const [linePanelTab, setLinePanelTab] = useState("subs");
  const [linePanelQ, setLinePanelQ] = useState("");

  const openLinePanel = (line) => {
    const l = ensureLineShape(line);
    setLinePanelLine(l);
    setLinePanelQ("");
    setLinePanelTab("subs");
    setLinePanelOpen(true);
  };

  const closeLinePanel = () => {
    setLinePanelOpen(false);
    setLinePanelLine(null);
    setLinePanelQ("");
    setLinePanelTab("subs");
  };

  const lineSubscribersFor = (line) => {
    const lid = normId(line?.id);
    return safeArray(subscribersSource).filter((s) => normId(s?.lineId) === lid);
  };

  const lineDistributorsFor = (line) => {
    const lid = normId(line?.id);
    return safeArray(distributorsSource).filter((d) => normId(d?.lineId) === lid);
  };

  const lineSubscribers = useMemo(() => {
    const l = linePanelLine;
    if (!l) return [];
    return lineSubscribersFor(l);
  }, [subscribersSource, linePanelLine]);

  const lineDistributors = useMemo(() => {
    const l = linePanelLine;
    if (!l) return [];
    return lineDistributorsFor(l);
  }, [distributorsSource, linePanelLine]);

  const panelFiltered = useMemo(() => {
    const qq = String(linePanelQ || "").trim().toLowerCase();
    if (!qq) return { subs: lineSubscribers, dists: lineDistributors };

    const subs = lineSubscribers.filter((s) => {
      const name = String(s?.name || "").toLowerCase();
      const phone = String(s?.phone || "").toLowerCase();
      const area = String(s?.area || "").toLowerCase();
      const address1 = String(s?.address1 || "").toLowerCase();
      const address2 = String(s?.address2 || "").toLowerCase();
      const ip = String(s?.deviceIpAddress || (isObj(s.device) ? s.device.ipAddress : "") || "").toLowerCase();
      return name.includes(qq) || phone.includes(qq) || area.includes(qq) || address1.includes(qq) || address2.includes(qq) || ip.includes(qq);
    });

    const dists = lineDistributors.filter((d) => {
      const name = String(d?.name || "").toLowerCase();
      const phone = String(d?.phone || "").toLowerCase();
      const address = String(d?.address || d?.area || "").toLowerCase();
      const notes = String(d?.notes || "").toLowerCase();
      return name.includes(qq) || phone.includes(qq) || address.includes(qq) || notes.includes(qq);
    });

    return { subs, dists };
  }, [linePanelQ, lineSubscribers, lineDistributors]);

  const subsCount = panelFiltered.subs.length;
  const distsCount = panelFiltered.dists.length;

  // ===== Responsive styles =====
  const pageWrapR = useMemo(() => ({ ...pageWrap, paddingBottom: isMobile ? 80 : 10 }), [isMobile]);
  const topRowR = useMemo(() => ({ ...topRow, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start" }), [isMobile]);
  const btnPrimaryR = useMemo(() => ({ ...btnPrimary, width: isMobile ? "100%" : undefined, justifyContent: "center" }), [isMobile]);
  const filtersRowR = useMemo(() => ({ ...filtersRow, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-end" }), [isMobile]);
  const gridR = useMemo(
    () => ({ ...grid, gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))" }),
    [isMobile, isNarrow]
  );
  const cardTopR = useMemo(
    () => ({ ...cardTop, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start", flexWrap: "wrap" }),
    [isMobile]
  );

  const overlayR = useMemo(() => ({ ...modalOverlay, padding: isMobile ? 10 : 14, alignItems: "center" }), [isMobile]);
  const modalR = useMemo(() => ({ ...modalContent, width: "100%", maxWidth: 1100, borderRadius: 20, padding: "18px 18px 16px", maxHeight: "90vh", overflow: "hidden" }), []);
  const modalBodyR = useMemo(() => ({ ...modalBody, maxHeight: isMobile ? "72vh" : "70vh" }), [isMobile]);

  const formGridR = useMemo(() => ({ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }), [isMobile]);
  const modalActionsR = useMemo(() => ({ ...modalActions, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 10 }), [isMobile]);

  const panelTopR = useMemo(() => ({ ...panelTop, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start" }), [isMobile]);
  const panelInfoR = useMemo(() => ({ ...panelInfo, minWidth: isMobile ? "100%" : 320 }), [isMobile]);
  const panelStatsR = useMemo(() => ({ ...panelStats, justifyContent: isMobile ? "flex-start" : "flex-end" }), [isMobile]);
  const tabsRowR = useMemo(() => ({ ...tabsRow, gap: 8 }), []);
  const tabBtnR = useMemo(() => ({ ...tabBtn, width: isMobile ? "100%" : undefined, justifyContent: "center" }), [isMobile]);
  const tabBtnActiveR = useMemo(() => ({ ...tabBtnR, ...tabBtnActive }), [tabBtnR]);

  const displayLoading = useMinLoadingTime(useLinesApi && linesApiLoading && linesFromApi.length === 0);
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
      <PageTipsModal open={showTips} slides={PAGE_TIPS[TIPS_PAGE_KEY]} onDone={handleTipsDone} onLinkClick={handleTipsLinkClick} />
      <LoadingOverlay visible={actionLoading} />
      {!canWriteLines && <ReadOnlyBanner />}
      <div style={topRowR}>
        <div>
          <h1 style={h1}>خطوط الشبكة</h1>
          <p style={textMuted}>هذه الصفحة مسؤولة عن اظهار جميع خطوط شبكتك مع ادارة لبياناتها وتحكم فيها</p>

          {/* ✅ تم حذف أي تحذير/اعتماد DB نهائياً */}
        </div>

        <button
          style={btnPrimaryR}
          onClick={() => { if (linesAtLimit) { showPlanLimitAlert(); return; } openAdd(); }}
          disabled={!canWriteLines || actionLoading}
          title={!canWriteLines ? READ_ONLY_MESSAGE : undefined}
        >
          + إضافة خط
        </button>
      </div>

      <div style={filtersCard}>
        <div style={filtersRowR}>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260 }}>
            <div style={miniLabel}>بحث</div>
            <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الخط / عنوان الخط..." />
          </div>

          <div style={{ minWidth: isMobile ? "100%" : 220 }}>
            <div style={miniLabel}>الحالة</div>
            <select style={input} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value="active">فعّال</option>
              <option value="inactive">غير فعّال</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 200 }}>
        {filteredLines.length === 0 ? (
          <div style={contentCenterWrap}>
            <div style={emptyText}>لا يوجد خطوط. اضغط "إضافة خط".</div>
          </div>
        ) : (
          <div style={gridR}>
          {filteredLines.map((l) => (
            <div key={l.id} style={card}>
              <div style={cardTopR}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={cardTitle}>{l.name || "—"}</div>
                  <div style={cardMeta}>
                    <span style={chip}>{l.active ? "فعّال" : "غير فعّال"}</span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    justifyContent: isMobile ? "flex-start" : "flex-end",
                    width: isMobile ? "100%" : undefined,
                  }}
                >
                  <button style={btnTinyPrimary} onClick={() => openLinePanel(l)}>
                    فتح
                  </button>

                  <button style={iconBtn} onClick={() => openEdit(l)} disabled={!canWriteLines || actionLoading} title={!canWriteLines ? READ_ONLY_MESSAGE : undefined}>
                    ✎
                  </button>
                </div>
              </div>

              <div style={cardBody}>
                <div style={row}>
                  <span style={k}>العنوان:</span>
                  <span style={v}>{l.address || "—"}</span>
                </div>
                <div style={row}>
                  <span style={k}>تاريخ الإضافة:</span>
                  <span style={v}>{new Date(Number(l.createdAt || 0)).toLocaleString("ar")}</span>
                </div>
              </div>

              <div style={cardActions}>
                <button style={l.active ? btnTinyOutline : btnTinyPrimary} onClick={() => toggleActive(l.id)} disabled={!canWriteLines || actionLoading} title={!canWriteLines ? READ_ONLY_MESSAGE : undefined}>
                  {l.active ? "تعطيل" : "تفعيل"}
                </button>
                <button style={btnTinyDanger} onClick={() => deleteLine(l.id)} disabled={!canWriteLines || actionLoading} title={!canWriteLines ? READ_ONLY_MESSAGE : undefined}>
                  حذف
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal overlayRef={overlayRef} title="إضافة خط" onClose={closeAdd} overlayStyle={overlayR} modalStyle={modalR} bodyStyle={modalBodyR}>
          <form onSubmit={addLine} style={formGridR}>
            <Field label="اسم الخط (مثال: خط 30)">
              <input style={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>

            <Field label="عنوان الخط">
              <input
                style={input}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="مثال: شارع كذا - مفترق كذا..."
              />
            </Field>

            <Field label="الحالة">
              <select style={input} value={form.active ? "1" : "0"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "1" }))}>
                <option value="1">فعّال</option>
                <option value="0">غير فعّال</option>
              </select>
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={{ ...btnOutline, width: isMobile ? "100%" : undefined }} onClick={closeAdd} disabled={actionLoading}>
                إلغاء
              </button>
              <button type="submit" style={{ ...btnPrimary, width: isMobile ? "100%" : undefined }} disabled={actionLoading}>
                حفظ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <Modal overlayRef={overlayRef} title="تعديل خط" onClose={closeEdit} overlayStyle={overlayR} modalStyle={modalR} bodyStyle={modalBodyR}>
          <form onSubmit={saveEdit} style={formGridR}>
            <Field label="اسم الخط">
              <input style={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>

            <Field label="عنوان الخط">
              <input style={input} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Field>

            <Field label="الحالة">
              <select style={input} value={form.active ? "1" : "0"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "1" }))}>
                <option value="1">فعّال</option>
                <option value="0">غير فعّال</option>
              </select>
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={{ ...btnOutline, width: isMobile ? "100%" : undefined }} onClick={closeEdit} disabled={actionLoading}>
                إلغاء
              </button>
              <button type="submit" style={{ ...btnPrimary, width: isMobile ? "100%" : undefined }} disabled={actionLoading}>
                حفظ التعديل
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ✅ Line Panel */}
      {linePanelOpen && linePanelLine && (
        <Modal
          overlayRef={overlayRef}
          title={`تفاصيل الخط: ${linePanelLine.name || "—"}`}
          onClose={closeLinePanel}
          overlayStyle={overlayR}
          modalStyle={modalR}
          bodyStyle={modalBodyR}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={panelTopR}>
              <div style={panelInfoR}>
                <div style={panelRow}>
                  <span style={panelK}>العنوان:</span>
                  <span style={panelV}>{linePanelLine.address || "—"}</span>
                </div>
                <div style={panelRow}>
                  <span style={panelK}>الحالة:</span>
                  <span style={panelV}>{linePanelLine.active ? "فعّال" : "غير فعّال"}</span>
                </div>
              </div>

              <div style={panelStatsR}>
                <span style={chip}>
                  مشتركين: <b>{subsCount}</b>
                </span>
                <span style={chip}>
                  موزعين: <b>{distsCount}</b>
                </span>
              </div>
            </div>

            <div style={filtersCard}>
              <div style={miniLabel}>بحث داخل محتوى الخط</div>
              <input style={input} value={linePanelQ} onChange={(e) => setLinePanelQ(e.target.value)} placeholder="بحث حسب التبويب..." />
            </div>

            <div style={tabsRowR}>
              <button type="button" style={linePanelTab === "subs" ? tabBtnActiveR : tabBtnR} onClick={() => setLinePanelTab("subs")}>
                المشتركين
              </button>
              <button type="button" style={linePanelTab === "dists" ? tabBtnActiveR : tabBtnR} onClick={() => setLinePanelTab("dists")}>
                الموزعين
              </button>
            </div>

            {linePanelTab === "subs" && (
              <div style={panelColWide}>
                <div style={panelTitle}>المشتركين على هذا الخط</div>
                {panelFiltered.subs.length === 0 ? (
                  <div style={contentCenterWrap}>
                    <div style={emptyText}>لا يوجد مشتركين مرتبطين بهذا الخط.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {panelFiltered.subs.map((s) => {
                      const device = isObj(s.device) ? s.device : {};
                      const ip = s.deviceIpAddress || device.ipAddress || "";
                      return (
                        <div key={String(s.id)} style={panelCard}>
                          <div style={panelCardTop}>
                            <div style={panelCardTitle}>{s.name || "—"}</div>
                            <span style={chip}>📞 {s.phone || "—"}</span>
                          </div>
                          <div style={panelCardBody}>
                            <div style={panelRow}>
                              <span style={panelK}>العنوان:</span>
                              <span style={panelV}>{[s.address1, s.address2].filter(Boolean).join(" - ") || "—"}</span>
                            </div>
                            <div style={panelRow}>
                              <span style={panelK}>الجهاز IP:</span>
                              <span style={panelV}>{ip || "—"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {linePanelTab === "dists" && (
              <div style={panelColWide}>
                <div style={panelTitle}>الموزعين على هذا الخط</div>
                {panelFiltered.dists.length === 0 ? (
                  <div style={contentCenterWrap}>
                    <div style={emptyText}>لا يوجد موزعين مرتبطين بهذا الخط.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {panelFiltered.dists.map((d) => {
                      const phone = cleanText(d?.phone) || cleanText(d?.mobile) || cleanText(d?.whatsapp) || "—";
                      const address = cleanText(d?.address) || cleanText(d?.area) || cleanText(d?.location) || "—";
                      const notes = cleanText(d?.notes) || cleanText(d?.note) || cleanText(d?.comment) || "—";
                      return (
                        <div key={String(d.id)} style={panelCard}>
                          <div style={panelCardTop}>
                            <div style={panelCardTitle}>{d.name || "—"}</div>
                            <span style={chip}>📞 {phone}</span>
                          </div>
                          <div style={panelCardBody}>
                            <div style={panelRow}>
                              <span style={panelK}>العنوان:</span>
                              <span style={panelV}>{address}</span>
                            </div>
                            <div style={panelRow}>
                              <span style={panelK}>ملاحظات:</span>
                              <span style={panelV}>{notes}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btnOutline} onClick={closeLinePanel}>
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function validate(form) {
  const name = String(form.name || "").trim();
  const address = String(form.address || "").trim();
  const active = Boolean(form.active);

  if (!name) return { ok: false, msg: "اسم الخط مطلوب." };
  if (!address) return { ok: false, msg: "عنوان الخط مطلوب." };

  return { ok: true, data: { name, address, active } };
}

/* ===== UI Helpers ===== */
function Modal({ overlayRef, title, onClose, children, overlayStyle, modalStyle, bodyStyle }) {
  return (
    <div ref={overlayRef} style={overlayStyle || modalOverlay} onMouseDown={(e) => e.target === overlayRef.current && onClose()}>
      <div style={modalStyle || modalRDefault}>
        <div style={modalHeader}>
          <div style={modalTitle}>{title}</div>
          <button style={xBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={bodyStyle || modalBody}>{children}</div>
      </div>
    </div>
  );
}

/* ===== Styles (page-specific; shared tokens imported above) ===== */
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const filtersCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };

const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 };
const modalRDefault = { ...modalContent, width: "100%", maxWidth: 1100, padding: "18px 18px 16px", maxHeight: "90vh", overflow: "hidden" };

const card = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const cardTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 };
const cardTitle = { fontSize: 16, fontWeight: 900, color: theme.text };
const cardMeta = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };

const cardBody = { display: "grid", gap: 6 };
const row = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const k = { fontSize: 12, color: theme.textMuted, fontWeight: 900 };
const v = { fontSize: 12, color: theme.text, fontWeight: 900 };

const cardActions = { display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" };
const btnTinyOutline = { padding: "8px 12px", borderRadius: 999, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text, fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const xBtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: theme.textMuted, padding: "6px 10px", borderRadius: 12 };
const modalBody = { overflowY: "auto", maxHeight: "70vh", paddingRight: 2 };
const modalActions = { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10 };

const panelTop = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" };
const panelInfo = { display: "grid", gap: 8, minWidth: 320, flex: 1 };
const panelStats = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };

const panelRow = { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" };
const panelK = { fontSize: 12, color: theme.textMuted, fontWeight: 900 };
const panelV = { fontSize: 12, color: theme.text, fontWeight: 900 };

const panelColWide = { border: `1px solid ${theme.border}`, borderRadius: 18, padding: 12, background: theme.surface, display: "flex", flexDirection: "column", gap: 10 };
const panelTitle = { fontSize: 14, fontWeight: 900, color: theme.text };

const panelCard = { border: `1px solid ${theme.border}`, borderRadius: 16, padding: 10, background: theme.surface, display: "flex", flexDirection: "column", gap: 8 };
const panelCardTop = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" };
const panelCardTitle = { fontSize: 13, fontWeight: 900, color: theme.text };
const panelCardBody = { display: "grid", gap: 6 };

const tabsRow = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const tabBtn = { padding: "10px 14px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const tabBtnActive = { ...tabBtn, border: `1px solid ${theme.primary}`, background: theme.surfaceAlt, color: theme.primary };
