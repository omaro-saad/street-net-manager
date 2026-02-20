// src/pages/PlansPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../DataContext";
import { safeArray, safeObj, nowMs, genId, normId } from "../utils/helpers.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { theme } from "../theme.js";
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

export default function PlansPage() {
  const ctx = useData();
  const { data, setData } = ctx || {};

  const { isNarrow, isMobile } = useResponsive();

  // =========================
  // Local Source of Truth (NO DB)
  // =========================
  const lines = useMemo(() => {
    const raw = data?.lines?.items ?? data?.lines ?? [];
    return safeArray(raw).map(ensureLineShape);
  }, [data?.lines]);

  const subscribersSource = useMemo(() => safeArray(data?.subscribers ?? []), [data?.subscribers]);
  const distributorsSource = useMemo(() => safeArray(data?.distributors ?? []), [data?.distributors]);

  // ===== Local CRUD: Lines =====
  const localUpsertLine = (id, patch, { isNew } = { isNew: false }) => {
    if (typeof setData !== "function") {
      alert("⚠️ لا يمكن الحفظ: setData غير متوفر في DataContext.");
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
      alert("⚠️ لا يمكن الحذف: setData غير متوفر في DataContext.");
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
  // CRUD (LOCAL ONLY)
  // =========================
  const addLine = async (e) => {
    e.preventDefault();

    const payload = validate(form);
    if (!payload.ok) return alert(payload.msg);

    const newLine = ensureLineShape({
      id: genId("line"),
      name: payload.data.name,
      address: payload.data.address,
      active: payload.data.active,
      createdAt: nowMs(),
      updatedAt: nowMs(),
    });

    const ok = localUpsertLine(newLine.id, newLine, { isNew: true });
    if (!ok) return alert("فشل حفظ الخط محليًا.");

    closeAdd();
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;

    const payload = validate(form);
    if (!payload.ok) return alert(payload.msg);

    const patch = {
      name: payload.data.name,
      address: payload.data.address,
      active: payload.data.active,
      updatedAt: nowMs(),
    };

    const ok = localUpsertLine(editing.id, patch, { isNew: false });
    if (!ok) return alert("فشل تعديل الخط محليًا.");

    closeEdit();
  };

  const deleteLine = async (id) => {
    if (!window.confirm("حذف الخط؟")) return;

    const ok = localRemoveLine(id);
    if (!ok) alert("فشل حذف الخط محليًا.");
  };

  const toggleActive = async (id) => {
    const ok = localToggleActive(id);
    if (!ok) alert("فشل تغيير حالة الخط محليًا.");
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

  const overlayR = useMemo(() => ({ ...overlay, padding: isMobile ? 10 : 14, alignItems: "center" }), [isMobile]);
  const modalR = useMemo(() => ({ ...modal, maxWidth: 1100, borderRadius: 20, padding: "18px 18px 16px", maxHeight: "90vh", overflow: "hidden" }), []);
  const modalBodyR = useMemo(() => ({ ...modalBody, maxHeight: isMobile ? "72vh" : "70vh" }), [isMobile]);

  const formGridR = useMemo(() => ({ ...formGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }), [isMobile]);
  const modalActionsR = useMemo(() => ({ ...modalActions, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 10 }), [isMobile]);

  const panelTopR = useMemo(() => ({ ...panelTop, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start" }), [isMobile]);
  const panelInfoR = useMemo(() => ({ ...panelInfo, minWidth: isMobile ? "100%" : 320 }), [isMobile]);
  const panelStatsR = useMemo(() => ({ ...panelStats, justifyContent: isMobile ? "flex-start" : "flex-end" }), [isMobile]);
  const tabsRowR = useMemo(() => ({ ...tabsRow, gap: 8 }), []);
  const tabBtnR = useMemo(() => ({ ...tabBtn, width: isMobile ? "100%" : undefined, justifyContent: "center" }), [isMobile]);
  const tabBtnActiveR = useMemo(() => ({ ...tabBtnR, ...tabBtnActive }), [tabBtnR]);

  return (
    <div style={pageWrapR}>
      <div style={topRowR}>
        <div>
          <h1 style={h1}>خطوط الشبكة</h1>
          <p style={p}>هذه الصفحة مسؤولة عن اظهار جميع خطوط شبكتك مع ادارة لبياناتها وتحكم فيها</p>

          {/* ✅ تم حذف أي تحذير/اعتماد DB نهائياً */}
        </div>

        <button style={btnPrimaryR} onClick={openAdd}>
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

      <div style={gridR}>
        {filteredLines.length === 0 ? (
          <div style={empty}>لا يوجد خطوط. اضغط “إضافة خط”.</div>
        ) : (
          filteredLines.map((l) => (
            <div key={l.id} style={card}>
              <div style={cardTopR}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={cardTitle}>{l.name || "—"}</div>
                  <div style={cardMeta}>
                    <span style={chip2}>{l.active ? "فعّال" : "غير فعّال"}</span>
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

                  <button style={iconBtn} onClick={() => openEdit(l)}>
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
                <button style={l.active ? btnTinyOutline : btnTinyPrimary} onClick={() => toggleActive(l.id)}>
                  {l.active ? "تعطيل" : "تفعيل"}
                </button>
                <button style={btnTinyDanger} onClick={() => deleteLine(l.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))
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
              <button type="button" style={{ ...btnOutline, width: isMobile ? "100%" : undefined }} onClick={closeAdd}>
                إلغاء
              </button>
              <button type="submit" style={{ ...btnPrimary, width: isMobile ? "100%" : undefined }}>
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
              <button type="button" style={{ ...btnOutline, width: isMobile ? "100%" : undefined }} onClick={closeEdit}>
                إلغاء
              </button>
              <button type="submit" style={{ ...btnPrimary, width: isMobile ? "100%" : undefined }}>
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
                <span style={chip2}>
                  مشتركين: <b>{subsCount}</b>
                </span>
                <span style={chip2}>
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
                  <div style={empty}>لا يوجد مشتركين مرتبطين بهذا الخط.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {panelFiltered.subs.map((s) => {
                      const device = isObj(s.device) ? s.device : {};
                      const ip = s.deviceIpAddress || device.ipAddress || "";
                      return (
                        <div key={String(s.id)} style={panelCard}>
                          <div style={panelCardTop}>
                            <div style={panelCardTitle}>{s.name || "—"}</div>
                            <span style={chip2}>📞 {s.phone || "—"}</span>
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
                  <div style={empty}>لا يوجد موزعين مرتبطين بهذا الخط.</div>
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
                            <span style={chip2}>📞 {phone}</span>
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
    <div ref={overlayRef} style={overlayStyle || overlay} onMouseDown={(e) => e.target === overlayRef.current && onClose()}>
      <div style={modalStyle || modal}>
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
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={miniLabel}>{label}</div>
      {children}
    </div>
  );
}

/* ===== Styles ===== */
const pageWrap = { display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto", paddingBottom: 10, direction: "rtl", textAlign: "right" };
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const h1 = { fontSize: 26, fontWeight: 900, color: "#111827" };
const p = { fontSize: 14, color: "#6b7280", lineHeight: 1.6 };

const filtersCard = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12 };
const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };

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
  direction: "rtl",
  textAlign: "right",
};

const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 };
const empty = { fontSize: 13, color: "#9ca3af", padding: "6px 2px" };

const card = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const cardTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 };
const cardTitle = { fontSize: 16, fontWeight: 900, color: "#111827" };
const cardMeta = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const chip2 = { padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#111827", fontWeight: 900, fontSize: 12 };
const iconBtn = { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "8px 10px", cursor: "pointer", fontWeight: 900, color: "#111827" };

const cardBody = { display: "grid", gap: 6 };
const row = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const k = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const v = { fontSize: 12, color: "#111827", fontWeight: 900 };

const cardActions = { display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" };

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  backgroundColor: theme.primary,
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.15)",
  whiteSpace: "nowrap",
};
const btnOutline = { padding: "10px 16px", borderRadius: 999, border: "1px solid #d1d5db", backgroundColor: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" };
const btnTinyPrimary = { padding: "8px 12px", borderRadius: 999, border: "none", backgroundColor: theme.primary, color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const btnTinyOutline = { padding: "8px 12px", borderRadius: 999, border: "1px solid #d1d5db", backgroundColor: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const btnTinyDanger = { padding: "8px 12px", borderRadius: 999, border: "none", backgroundColor: "#dc2626", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };

const overlay = { position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, padding: 14 };
const modal = { width: "100%", maxWidth: 1100, backgroundColor: "#ffffff", borderRadius: 20, padding: "18px 18px 16px", boxShadow: "0 25px 50px rgba(15,23,42,0.35)", maxHeight: "90vh", overflow: "hidden", direction: "rtl", textAlign: "right" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 };
const modalTitle = { fontSize: 18, fontWeight: 900, color: "#111827" };
const xBtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#6b7280", padding: "6px 10px", borderRadius: 12 };
const modalBody = { overflowY: "auto", maxHeight: "70vh", paddingRight: 2 };

const formGrid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 12px" };
const modalActions = { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10 };

const panelTop = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" };
const panelInfo = { display: "grid", gap: 8, minWidth: 320, flex: 1 };
const panelStats = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };

const panelRow = { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" };
const panelK = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const panelV = { fontSize: 12, color: "#111827", fontWeight: 900 };

const panelColWide = { border: "1px solid #e5e7eb", borderRadius: 18, padding: 12, background: "#fff", display: "flex", flexDirection: "column", gap: 10 };
const panelTitle = { fontSize: 14, fontWeight: 900, color: "#111827" };

const panelCard = { border: "1px solid #e5e7eb", borderRadius: 16, padding: 10, background: "#fff", display: "flex", flexDirection: "column", gap: 8 };
const panelCardTop = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" };
const panelCardTitle = { fontSize: 13, fontWeight: 900, color: "#111827" };
const panelCardBody = { display: "grid", gap: 6 };

const tabsRow = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const tabBtn = { padding: "10px 14px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const tabBtnActive = { ...tabBtn, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3" };
