// src/pages/MyMapPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState } from "reactflow";
import "reactflow/dist/style.css";
import { useData } from "../DataContext";
import { MentionsInput, Mention } from "react-mentions";
import { safeArray, nowMs, genId, normId } from "../utils/helpers.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { theme } from "../theme.js";
function cleanText(x) {
  const s = String(x ?? "").trim();
  return s ? s : "";
}
function clamp(n, a, b) {
  const x = Number(n);
  if (Number.isNaN(x)) return a;
  return Math.max(a, Math.min(b, x));
}
function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

// ✅ تطبيع عربي بسيط (عشان startsWith يصير منطقي)
function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function ensureLineShape(raw) {
  const x = raw && typeof raw === "object" ? raw : {};
  const id = normId(x.id) || "";
  return {
    id,
    name: String(x.name || x.title || x.label || "").trim(),
    createdAt: Number(x.createdAt) || 0,
    zone: String(x.zone || "").trim(),
    address: String(x.address || "").trim(),
    active: x.active === 0 ? false : Boolean(x.active ?? true),
  };
}

/* =========================
   ✅ Smart spacing for @
   ========================= */
function normalizeAtSpacing(value) {
  const s = String(value ?? "");
  let out = s.replace(/([^\s])@/g, "$1 @");
  out = out.replace(/\s+@/g, " @");
  return out;
}

/* =========================
   ✅ Mentions markup -> plain text
   ========================= */
function mentionsMarkupToPlain(s) {
  const raw = String(s ?? "");
  const out = raw.replace(/@\[(.+?)\]\((.+?)\)/g, (_m, display) => `@${String(display || "").trim()}`);
  return out;
}

/* =========================
   ✅ Ports normalize
   ========================= */
function normalizePorts(portsRaw, usedPorts) {
  const used = clamp(usedPorts, 1, 8);
  const arr = safeArray(portsRaw).map((p, i) => ({
    index: Number(p?.index) || i + 1,
    target: String(p?.target ?? ""),
  }));

  const map = new Map();
  arr.forEach((p) => map.set(Number(p.index) || 0, p));

  const out = [];
  for (let i = 1; i <= used; i++) {
    const p = map.get(i);
    out.push({
      index: i,
      target: String(p?.target ?? ""),
    });
  }
  return out;
}

/* =========================
   Node styling by ownership/disabled
   ========================= */
function getNodeVisualStyle({ ownership, disabled }) {
  const own = ownership === "customer" ? "customer" : "company";
  const dis = Boolean(disabled);

  if (dis) {
    return { background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b" };
  }
  if (own === "customer") {
    return { background: "#ecfeff", border: "1px solid #cffafe", color: "#111827" };
  }
  return { background: "#ede9fe", border: "1px solid #ddd6fe", color: "#111827" };
}

function buildNodeLabel(profile) {
  const raw = String(profile?.displayName ?? "").trim();
  const plain = cleanText(normalizeAtSpacing(mentionsMarkupToPlain(raw)));
  if (plain) return plain;

  const ip = String(profile?.ipAddress ?? "").trim();
  if (ip) return ip;

  return "—";
}

/* =========================
   Node data shape
   ========================= */
function emptyNodeProfile() {
  return {
    displayName: "",
    ownership: "company", // company | customer
    disabled: false,
    powerSource: "",

    type: "",
    ipAddress: "",
    ssid: "",
    upstreamDeviceId: "",
    upstreamRouter: "",
    health: "جيد",
    adminUsername: "",
    adminPassword: "",
    usedPorts: 1,
    ports: [{ index: 1, target: "" }],
    notes: "",
    updatedAt: nowMs(),
  };
}

function coerceNodeProfile(d) {
  const x = d && typeof d === "object" ? d : {};
  const usedPorts = clamp(x.usedPorts ?? 1, 1, 8);
  const ports = normalizePorts(x.ports, usedPorts);

  return {
    displayName: String(x.displayName ?? ""),
    ownership: x.ownership === "customer" ? "customer" : "company",
    disabled: Boolean(x.disabled),
    powerSource: cleanText(x.powerSource),

    type: cleanText(x.type),
    ipAddress: String(x.ipAddress ?? ""),
    ssid: cleanText(x.ssid),
    upstreamDeviceId: cleanText(x.upstreamDeviceId),
    upstreamRouter: cleanText(x.upstreamRouter),
    health: cleanText(x.health) || "جيد",
    adminUsername: cleanText(x.adminUsername),
    adminPassword: cleanText(x.adminPassword),
    usedPorts,
    ports,
    notes: cleanText(x.notes),
    updatedAt: Number(x.updatedAt) || nowMs(),
  };
}

/* =========================
   Modal + Field
   ========================= */
function Modal({ overlayRef, title, onClose, children, overlayStyle, modalStyle }) {
  return (
    <div ref={overlayRef} style={overlayStyle || overlay} onMouseDown={(e) => e.target === overlayRef.current && onClose()}>
      <div style={modalStyle || modal}>
        <div style={modalHeader}>
          <div style={modalTitle}>{title}</div>
          <button style={xBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>
        {children}
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

/* =========================
   External open helper
   ========================= */
function openExternalUrl(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {}
}

/* =========================
   ✅ Mentions UI
   ========================= */
const MENTION_MARKUP = "@[__display__](__id__)";

function renderSubSuggestion(entry, _search, highlightedDisplay, _index, focused) {
  const ip = entry?.ip ? `IP: ${entry.ip}` : "—";
  return (
    <div
      style={{
        padding: "10px 10px",
        borderRadius: 14,
        border: focused ? "1px solid #ddd6fe" : "1px solid transparent",
        background: focused ? "#f5f3ff" : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontWeight: 900, color: focused ? "#4c1d95" : "#111827" }}>{highlightedDisplay}</div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>{ip}</div>
    </div>
  );
}

function makeSimpleMentionsStyle(baseBoxStyle, { multiline } = { multiline: true }) {
  const pad = baseBoxStyle?.padding ?? "10px 12px";
  const radius = baseBoxStyle?.borderRadius ?? 14;
  const border = baseBoxStyle?.border ?? "1px solid #d1d5db";
  const bg = baseBoxStyle?.backgroundColor ?? "#fff";
  const fontSize = baseBoxStyle?.fontSize ?? 14;
  const lineHeight = baseBoxStyle?.lineHeight ?? (multiline ? 1.5 : 1.6);
  const fontFamily = baseBoxStyle?.fontFamily ?? "inherit";

  const height = baseBoxStyle?.height;
  const minHeight = baseBoxStyle?.minHeight;

  return {
    control: {
      borderRadius: radius,
      border,
      backgroundColor: bg,
      width: "100%",
      boxSizing: "border-box",
      padding: 0,
      direction: "rtl",
      textAlign: "right",
    },
    highlighter: {
      padding: pad,
      fontSize,
      lineHeight,
      fontFamily,
      color: "transparent",
      whiteSpace: multiline ? "pre-wrap" : "pre",
      ...(height ? { height } : null),
      ...(minHeight ? { minHeight } : null),
      boxSizing: "border-box",
    },
    input: {
      padding: pad,
      fontSize,
      lineHeight,
      fontFamily,
      color: "#111827",
      background: "transparent",
      border: "none",
      outline: "none",
      whiteSpace: multiline ? "pre-wrap" : "pre",
      ...(height ? { height } : null),
      ...(minHeight ? { minHeight } : null),
      boxSizing: "border-box",
    },
    suggestions: {
      list: {
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 22px 55px rgba(15,23,42,0.22)",
        padding: 6,
        marginTop: 8,
        minWidth: 260,
        maxWidth: 460,
      },
      item: { padding: 0 },
      itemFocused: { backgroundColor: "transparent" },
    },
  };
}

/* =========================
   ✅ Download JSON helper
   ========================= */
function downloadJsonFile(filename, obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    return true;
  } catch (e) {
    console.error("downloadJsonFile failed", e);
    return false;
  }
}

function defaultMapState(lineId) {
  return {
    lineId: normId(lineId),
    updatedAt: nowMs(),
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  };
}

/* =========================
   ✅ MyMapPage (NO DB)
   ========================= */
export default function MyMapPage() {
  const ctx = useData();
  const gate = ctx?.gate;

  const { isMobile } = useResponsive();

  // =========================
  // ✅ Lines from Context
  // =========================
  const [dbLines, setDbLines] = useState([]);
  const [dbLinesErr, setDbLinesErr] = useState("");

  const loadLines = useCallback(async () => {
    try {
      if (gate?.lines?.isReady && typeof gate.lines.list === "function") {
        const rows = await gate.lines.list();
        setDbLines(safeArray(rows));
        setDbLinesErr("");
        return;
      }
      setDbLines([]);
      setDbLinesErr("lines.list غير متوفر (Gate غير جاهز)"); // المفروض ما تصير بعد DataContext الجديد
    } catch (e) {
      setDbLinesErr(String(e?.message || e || "Lines error"));
      setDbLines([]);
    }
  }, [gate]);

  useEffect(() => {
    loadLines();
    let off = null;
    try {
      if (gate?.lines?.onChanged) off = gate.lines.onChanged(() => loadLines());
    } catch {}
    return () => {
      try {
        if (typeof off === "function") off();
      } catch {}
    };
  }, [loadLines, gate]);

  const lines = useMemo(() => {
    const shaped = safeArray(dbLines).map(ensureLineShape).filter((l) => l.id);
    shaped.sort((a, b) => (Number(a.createdAt || 0) || 0) - (Number(b.createdAt || 0) || 0));
    return shaped;
  }, [dbLines]);

  const [selectedLineId, setSelectedLineId] = useState("");
  const selectedLine = useMemo(() => lines.find((l) => normId(l.id) === normId(selectedLineId)) || null, [lines, selectedLineId]);

  useEffect(() => {
    if (selectedLineId) return;
    if (lines.length) setSelectedLineId(String(lines[0].id));
  }, [lines, selectedLineId]);

  // =========================
  // ✅ React Flow state
  // =========================
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);

  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");

  // ✅ Node Editor Modal
  const overlayRef = useRef(null);
  const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState("");
  const [nodeForm, setNodeForm] = useState(emptyNodeProfile());

  // =========================
  // ✅ Map from Context (NO DB)
  // =========================
  const [mapErr, setMapErr] = useState("");
  const pendingViewportRef = useRef(null);

  const applyViewport = useCallback(
    (vp) => {
      try {
        if (!rfInstance || !vp) return;
        rfInstance.setViewport(vp, { duration: 0 });
      } catch {}
    },
    [rfInstance]
  );

  useEffect(() => {
    if (!rfInstance) return;
    if (pendingViewportRef.current) {
      applyViewport(pendingViewportRef.current);
      pendingViewportRef.current = null;
    }
  }, [rfInstance, applyViewport]);

  useEffect(() => {
    const lid = normId(selectedLineId);
    if (!lid) return;

    let alive = true;

    async function loadMap() {
      setMapErr("");
      try {
        if (!gate?.maps?.isReady || typeof gate.maps.get !== "function") {
          setNodes([]);
          setEdges([]);
          setSelectedNodeId("");
          setSelectedEdgeId("");
          setMapErr("maps.get غير متوفر (Gate maps غير جاهز)");
          return;
        }

        const row = await gate.maps.get(lid);
        if (!alive) return;

        const payload = isObj(row?.payload) ? row.payload : null;
        const effective = payload && (payload.nodes || payload.edges || payload.viewport) ? payload : defaultMapState(lid);

        setNodes(safeArray(effective.nodes));
        setEdges(safeArray(effective.edges));
        setSelectedNodeId("");
        setSelectedEdgeId("");

        if (effective.viewport) {
          pendingViewportRef.current = effective.viewport;
          applyViewport(effective.viewport);
        } else {
          pendingViewportRef.current = null;
        }

        setTimeout(() => {
          try {
            const empty = safeArray(effective.nodes).length === 0 && safeArray(effective.edges).length === 0;
            if (rfInstance && empty) rfInstance.fitView({ padding: 0.2, duration: 0 });
          } catch {}
        }, 0);
      } catch (e) {
        console.warn("load map failed", e);
        setNodes([]);
        setEdges([]);
        setSelectedNodeId("");
        setSelectedEdgeId("");
        setMapErr(String(e?.message || e || "Map error"));
      }
    }

    loadMap();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLineId, applyViewport, gate]);

  // =========================
  // ✅ Subscribers for mentions (Context)
  // =========================
  const [subs, setSubs] = useState([]);
  const [subsErr, setSubsErr] = useState("");

  const loadSubs = useCallback(async () => {
    try {
      if (gate?.subscribers?.isReady && typeof gate.subscribers.list === "function") {
        const rows = await gate.subscribers.list();
        setSubs(safeArray(rows));
        setSubsErr("");
        return;
      }
      setSubs([]);
      setSubsErr("subscribers.list غير متوفر (Gate غير جاهز)");
    } catch (e) {
      setSubs([]);
      setSubsErr(String(e?.message || e || "Subscribers error"));
    }
  }, [gate]);

  useEffect(() => {
    loadSubs();
    let off = null;
    try {
      if (gate?.subscribers?.onChanged) off = gate.subscribers.onChanged(() => loadSubs());
    } catch {}
    return () => {
      try {
        if (typeof off === "function") off();
      } catch {}
    };
  }, [loadSubs, gate]);

  const mentionEntries = useMemo(() => {
    return safeArray(subs)
      .map((s) => {
        const name = String(s?.name || "").trim();
        if (!name) return null;
        const ip = String(s?.device?.ipAddress || s?.deviceIpAddress || "").trim();
        return { id: String(s.id), display: name, ip };
      })
      .filter(Boolean);
  }, [subs]);

  const mentionDataProvider = useCallback(
    (query, callback) => {
      const q = normName(query || "");
      if (!q) return callback(mentionEntries.slice(0, 50));
      const filtered = mentionEntries.filter((x) => normName(x.display).startsWith(q));
      callback(filtered.slice(0, 50));
    },
    [mentionEntries]
  );

  // =========================
  // Actions
  // =========================
  const addNode = () => {
    const lid = normId(selectedLineId);
    if (!lid) return alert("اختر خط أولاً.");

    const id = genId("node");
    const profile = emptyNodeProfile();
    const label = buildNodeLabel(profile);
    const visual = getNodeVisualStyle(profile);

    const newNode = {
      id,
      type: "default",
      position: { x: 80 + Math.random() * 220, y: 80 + Math.random() * 220 },
      data: { label, ...profile },
      style: { ...visual, borderRadius: 14, padding: 10, fontWeight: 900 },
    };

    setNodes((nds) => [newNode, ...nds]);
  };

  const deleteSelected = () => {
    if (selectedNodeId) {
      const nid = normId(selectedNodeId);
      setNodes((nds) => nds.filter((n) => normId(n.id) !== nid));
      setEdges((eds) => eds.filter((e) => normId(e.source) !== nid && normId(e.target) !== nid));
      setSelectedNodeId("");
      if (normId(editingNodeId) === nid) {
        setNodeEditorOpen(false);
        setEditingNodeId("");
      }
      return;
    }

    if (selectedEdgeId) {
      const eid = normId(selectedEdgeId);
      setEdges((eds) => eds.filter((e) => normId(e.id) !== eid));
      setSelectedEdgeId("");
      return;
    }

    alert("حدد Node أو Edge أولاً.");
  };

  const manualSave = async () => {
    const lid = normId(selectedLineId);
    if (!lid) return alert("اختر خط أولاً.");

    const viewport = rfInstance?.getViewport?.() || { x: 0, y: 0, zoom: 1 };
    const payload = { lineId: lid, updatedAt: nowMs(), viewport, nodes, edges };

    try {
      if (!gate?.maps?.isReady || typeof gate.maps.save !== "function") return alert("maps.save غير متوفر (Gate maps غير جاهز)");
      await gate.maps.save(lid, payload);
      alert("✅ تم حفظ الخريطة (In-Memory — بدون قواعد بيانات)");
    } catch (e) {
      console.error(e);
      alert(`فشل الحفظ: ${String(e?.message || e)}`);
    }
  };

  const clearAllContent = async () => {
    const lid = normId(selectedLineId);
    if (!lid) return alert("اختر خط أولاً.");

    const lineName = selectedLine?.name || `Line ${lid}`;
    const ok = window.confirm(`تحذير: هذا سيمسح كل Nodes/Edges لهذا الخط فقط (${lineName}).\n\nمتأكد؟`);
    if (!ok) return;

    try {
      if (!gate?.maps?.isReady || typeof gate.maps.save !== "function") return alert("maps.save غير متوفر (Gate maps غير جاهز)");

      const viewport = rfInstance?.getViewport?.() || { x: 0, y: 0, zoom: 1 };
      const empty = { ...defaultMapState(lid), viewport };
      await gate.maps.save(lid, empty);

      setNodes([]);
      setEdges([]);
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setNodeEditorOpen(false);
      setEditingNodeId("");
      setNodeForm(emptyNodeProfile());
      alert("✅ تم مسح الخريطة لهذا الخط (In-Memory)");
    } catch (e) {
      console.error(e);
      alert(`فشل مسح الخريطة: ${String(e?.message || e)}`);
    }
  };

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, id: genId("e") }, eds)), [setEdges]);

  const onSelectionChange = useCallback((sel) => {
    const n = safeArray(sel?.nodes);
    const e = safeArray(sel?.edges);
    setSelectedNodeId(n[0]?.id ? String(n[0].id) : "");
    setSelectedEdgeId(e[0]?.id ? String(e[0].id) : "");
  }, []);

  const openNodeEditor = (node) => {
    const nid = normId(node?.id);
    if (!nid) return;

    const shaped = coerceNodeProfile(node?.data || {});
    setEditingNodeId(nid);
    setNodeForm(shaped);
    setNodeEditorOpen(true);
  };

  const closeNodeEditor = () => {
    setNodeEditorOpen(false);
    setEditingNodeId("");
    setNodeForm(emptyNodeProfile());
  };

  const setUsedPorts = (val) => {
    const used = clamp(val, 1, 8);
    setNodeForm((f) => {
      const nextPorts = normalizePorts(f.ports, used);
      return { ...f, usedPorts: used, ports: nextPorts };
    });
  };

  const setPortTarget = (index, target) => {
    setNodeForm((f) => {
      const ports = normalizePorts(f.ports, f.usedPorts).map((p) => (p.index === index ? { ...p, target: normalizeAtSpacing(String(target ?? "")) } : p));
      return { ...f, ports };
    });
  };

  const validateNodeForm = (f) => {
    const displayName = String(f.displayName ?? "");
    const ownership = f.ownership === "customer" ? "customer" : "company";
    const disabled = Boolean(f.disabled);
    const powerSource = cleanText(f.powerSource);

    const type = cleanText(f.type);
    const ipAddress = String(f.ipAddress ?? "").trim();
    const ssid = cleanText(f.ssid);
    const health = cleanText(f.health) || "جيد";

    if (!displayName.trim()) return { ok: false, msg: "الإسم الظاهر للجهاز مطلوب." };
    if (!type) return { ok: false, msg: "نوع الجهاز مطلوب." };
    if (!ipAddress) return { ok: false, msg: "عنوان الـ IP مطلوب." };
    if (!ssid) return { ok: false, msg: "اسم الشبكة (SSID) مطلوب." };

    const usedPorts = clamp(f.usedPorts, 1, 8);
    const ports = normalizePorts(f.ports, usedPorts);

    return {
      ok: true,
      data: {
        displayName: normalizeAtSpacing(displayName),
        ownership,
        disabled,
        powerSource,

        type,
        ipAddress,
        ssid,
        upstreamDeviceId: cleanText(f.upstreamDeviceId),
        upstreamRouter: cleanText(f.upstreamRouter),
        health,
        adminUsername: cleanText(f.adminUsername),
        adminPassword: cleanText(f.adminPassword),
        usedPorts,
        ports,
        notes: cleanText(f.notes),
        updatedAt: nowMs(),
      },
    };
  };

  // ✅ Edge تلقائي: current -> upstream
  const syncAutoUpstreamEdge = (currentId, upstreamId) => {
    const cid = normId(currentId);
    const uid = normId(upstreamId);

    setEdges((eds) => {
      const cleaned = safeArray(eds).filter((e) => {
        const isAuto = Boolean(e?.data?.autoUpstream);
        if (!isAuto) return true;
        return normId(e.source) !== cid;
      });

      if (!uid || uid === cid) return cleaned;

      const exists = cleaned.some((e) => normId(e.source) === cid && normId(e.target) === uid);
      if (exists) return cleaned;

      const edge = { id: `auto_up_${cid}_${uid}`, source: cid, target: uid, data: { autoUpstream: true } };
      return addEdge(edge, cleaned);
    });
  };

  const saveNodeProfile = (e) => {
    e.preventDefault();
    const nid = normId(editingNodeId);
    if (!nid) return;

    const payload = validateNodeForm(nodeForm);
    if (!payload.ok) return alert(payload.msg);

    const label = buildNodeLabel(payload.data);
    const visual = getNodeVisualStyle(payload.data);

    setNodes((nds) =>
      nds.map((n) => {
        if (normId(n.id) !== nid) return n;

        const nextData = { ...(n.data || {}), label, ...payload.data };
        return { ...n, data: nextData, style: { ...(n.style || {}), ...visual, borderRadius: 14, padding: 10, fontWeight: 900 } };
      })
    );

    if (payload.data.upstreamDeviceId) syncAutoUpstreamEdge(nid, payload.data.upstreamDeviceId);
    else syncAutoUpstreamEdge(nid, "");

    closeNodeEditor();
  };

  const openIpLink = () => {
    const raw = String(nodeForm.ipAddress || "").trim();
    const ipMatch = raw.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
    const ip = ipMatch ? ipMatch[0] : cleanText(raw);

    if (!ip) return alert("حط عنوان IP أولاً.");
    openExternalUrl(`http://${ip}`);
  };

  // ✅ mention styles
  const displayMentionsStyle = useMemo(() => makeSimpleMentionsStyle(input, { multiline: true }), []);
  const portMentionsStyle = useMemo(() => makeSimpleMentionsStyle(portTextareaFixed, { multiline: true }), []);

  // ✅ زر تنزيل JSON (الخريطة الحالية للخط)
  const downloadMapJson = () => {
    const lid = normId(selectedLineId);
    if (!lid) return alert("اختر خط أولاً.");

    const viewport = rfInstance?.getViewport?.() || { x: 0, y: 0, zoom: 1 };

    const payload = {
      exportedAt: new Date().toISOString(),
      line: selectedLine
        ? {
            id: String(selectedLine.id),
            name: selectedLine.name || "",
            zone: selectedLine.zone || "",
            address: selectedLine.address || "",
            active: Boolean(selectedLine.active),
            createdAt: Number(selectedLine.createdAt || 0),
          }
        : { id: lid },
      map: { lineId: lid, viewport, nodes, edges },
    };

    const safeName = (selectedLine?.name || `line_${lid}`).replace(/[\\/:*?"<>|]+/g, "_").trim();
    const filename = `network_map_${safeName || lid}.json`;

    const ok = downloadJsonFile(filename, payload);
    if (!ok) alert("فشل تنزيل JSON.");
  };

  // ===== Layout: 60/40 =====
  const layoutR = useMemo(() => ({ ...layout, flexDirection: isMobile ? "column" : "row" }), [isMobile]);

  const leftPaneR = useMemo(() => ({ ...leftPane, width: isMobile ? "100%" : "60%", minHeight: isMobile ? 360 : "calc(100vh - 140px)" }), [isMobile]);

  const rightPaneR = useMemo(() => ({ ...rightPane, width: isMobile ? "100%" : "40%", minHeight: isMobile ? 280 : "calc(100vh - 140px)", overflow: "hidden" }), [isMobile]);

  const rightScrollAreaR = useMemo(() => ({ ...rightScrollArea, maxHeight: isMobile ? 420 : "calc(100vh - 200px)" }), [isMobile]);

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={topRow}>
        <div>
          <h1 style={h1}>خريطة شبكتي</h1>
          <p style={p}>كل خط له خريطة مستقلة (بدون قواعد بيانات)</p>

          {(dbLinesErr || mapErr || subsErr) && (
            <div style={warnBox}>
              {dbLinesErr ? <div>⚠️ Lines: {dbLinesErr}</div> : null}
              {mapErr ? <div>⚠️ Maps: {mapErr}</div> : null}
              {subsErr ? <div>⚠️ Subscribers: {subsErr}</div> : null}
            </div>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={layoutR}>
        {/* RIGHT */}
        <div style={rightPaneR}>
          <div style={paneTitleRow}>
            <div style={paneTitle}>لوحة التحكم</div>
          </div>

          <div style={rightScrollAreaR}>
            <div style={cardBox}>
              <div style={miniLabel}>اختيار الخط (من الـ Context)</div>
              <select style={input} value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)}>
                {lines.length === 0 ? (
                  <option value="">لا يوجد خطوط</option>
                ) : (
                  lines.map((l) => (
                    <option key={String(l.id)} value={String(l.id)}>
                      {l.name || `Line ${l.id}`}
                    </option>
                  ))
                )}
              </select>

              {selectedLine ? (
                <div style={hintText}>
                  المنطقة: <b>{selectedLine.zone || "—"}</b> | العنوان: <b>{selectedLine.address || "—"}</b>
                </div>
              ) : null}
            </div>

            <div style={cardBox}>
              <div style={miniLabel}>عمليات سريعة</div>

              <div style={btnRow}>
                <button type="button" style={btnTinyPrimary} onClick={addNode} disabled={!selectedLine}>
                  + إضافة نود
                </button>
                <button type="button" style={btnTinyDanger} onClick={deleteSelected} disabled={!selectedLine}>
                  حذف المحدد
                </button>
                <button type="button" style={btnTinyOutline} onClick={manualSave} disabled={!selectedLine}>
                  حفظ الآن
                </button>
              </div>

              <button type="button" style={btnDangerWide} onClick={clearAllContent} disabled={!selectedLine} title="يمسح كل الخريطة لهذا الخط فقط">
                ⚠️ حذف كل المحتوى لهذا الخط
              </button>

              <div style={hintText}>
                اكتب طبيعي زي: <b>خروج على المشترك @احمد</b>
              </div>
            </div>

            <div style={cardBox}>
              <div style={miniLabel}>المحدد حالياً</div>
              <div style={kvRow}>
                <span style={k}>Node:</span>
                <span style={v}>{selectedNodeId || "—"}</span>
              </div>
              <div style={kvRow}>
                <span style={k}>Edge:</span>
                <span style={v}>{selectedEdgeId || "—"}</span>
              </div>
            </div>

            <div style={cardBox}>
              <div style={miniLabel}>إحصائيات</div>
              <div style={statRow}>
                <span style={statChip}>
                  Nodes: <b>{nodes.length}</b>
                </span>
                <span style={statChip}>
                  Edges: <b>{edges.length}</b>
                </span>
              </div>
            </div>

            <div style={cardBox}>
              <div style={miniLabel}>تصدير</div>
              <button type="button" style={btnPrimaryWide} onClick={downloadMapJson} disabled={!selectedLine}>
                ⬇️ تنزيل خريطة الشبكة (JSON)
              </button>
              <div style={hintText}>ينزل ملف JSON يحتوي على الخط + viewport + nodes + edges.</div>
            </div>
          </div>
        </div>

        {/* LEFT */}
        <div style={leftPaneR}>
          <div style={paneTitleRow}>
            <div style={paneTitle}>مساحة العرض</div>
          </div>

          <div style={flowBox}>
            {!selectedLine ? (
              <div style={canvasHint}>لا يوجد خطوط. أضف خطوط من صفحة خطوط الشبكة أولاً.</div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onInit={setRfInstance}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onSelectionChange={onSelectionChange}
                onNodeClick={(_e, node) => openNodeEditor(node)}
                proOptions={{ hideAttribution: true }}
                onlyRenderVisibleElements
              >
                <Background />
                <Controls />
              </ReactFlow>
            )}
          </div>
        </div>
      </div>

      {/* Node Editor Modal */}
      {nodeEditorOpen && (
        <Modal overlayRef={overlayRef} title="تخصيص النود" onClose={closeNodeEditor} overlayStyle={overlay} modalStyle={modal}>
          <form onSubmit={saveNodeProfile} style={formGrid}>
            <Field label="الإسم الظاهر للجهاز (هذا الذي يظهر على النود)">
              <MentionsInput
                value={String(nodeForm.displayName ?? "")}
                onChange={(_e, newValue) => setNodeForm((f) => ({ ...f, displayName: normalizeAtSpacing(newValue) }))}
                singleLine
                style={displayMentionsStyle}
                placeholder="مثال: خروج على المشترك @احمد أو 192.168.30.20"
              >
                <Mention trigger="@" data={mentionDataProvider} markup={MENTION_MARKUP} displayTransform={(_id, display) => `@${display}`} renderSuggestion={renderSubSuggestion} appendSpaceOnAdd />
              </MentionsInput>

              <div style={hintText}>✅ اللي تكتبه هنا هو اللي يظهر على النود من الخارج.</div>
            </Field>

            <Field label="الجهاز (تبع لمين؟)">
              <select style={input} value={nodeForm.ownership} onChange={(e) => setNodeForm((f) => ({ ...f, ownership: e.target.value === "customer" ? "customer" : "company" }))}>
                <option value="company">تابع للشركة</option>
                <option value="customer">تابع لزبون</option>
              </select>

              <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, fontWeight: 900, color: "#111827" }}>
                <input type="checkbox" checked={Boolean(nodeForm.disabled)} onChange={(e) => setNodeForm((f) => ({ ...f, disabled: Boolean(e.target.checked) }))} />
                الجهاز معطل (يصير لونه أحمر)
              </label>
            </Field>

            <Field label="مصدر الكهرباء">
              <input style={input} value={nodeForm.powerSource} onChange={(e) => setNodeForm((f) => ({ ...f, powerSource: e.target.value }))} placeholder="مثال: UPS / مولد..." />
            </Field>

            <Field label="نوع الجهاز">
              <input style={input} value={nodeForm.type} onChange={(e) => setNodeForm((f) => ({ ...f, type: e.target.value }))} placeholder="مثال: Tp-link / Switch ..." />
            </Field>

            <Field label="عنوان الـ IP (للجهاز نفسه)">
              <input style={input} value={nodeForm.ipAddress} onChange={(e) => setNodeForm((f) => ({ ...f, ipAddress: e.target.value }))} placeholder="192.168.x.x" />
            </Field>

            <Field label="اسم الشبكة (SSID)">
              <input style={input} value={nodeForm.ssid} onChange={(e) => setNodeForm((f) => ({ ...f, ssid: e.target.value }))} placeholder="SSID" />
            </Field>

            <Field label="صحة الجهاز">
              <select style={input} value={nodeForm.health} onChange={(e) => setNodeForm((f) => ({ ...f, health: e.target.value }))}>
                <option value="جيد">جيد</option>
                <option value="متوسط">متوسط</option>
                <option value="سيء">سيء</option>
                <option value="غير معروف">غير معروف</option>
              </select>
            </Field>

            <Field label="الراوتر السابق (اختيار من نودات موجودة)">
              <select style={input} value={nodeForm.upstreamDeviceId} onChange={(e) => setNodeForm((f) => ({ ...f, upstreamDeviceId: e.target.value }))}>
                <option value="">— بدون —</option>
                {safeArray(nodes)
                  .map((n) => ({ id: String(n.id), label: buildNodeLabel(coerceNodeProfile(n.data || {})) }))
                  .filter((x) => normId(x.id) !== normId(editingNodeId))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label || x.id}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="الراوتر السابق (يدوي إذا مش موجود كنود)">
              <input style={input} value={nodeForm.upstreamRouter} onChange={(e) => setNodeForm((f) => ({ ...f, upstreamRouter: e.target.value }))} placeholder="مثال: 192.168.30.1" />
            </Field>

            <Field label="Admin - username (يدوي)">
              <input style={input} value={nodeForm.adminUsername} onChange={(e) => setNodeForm((f) => ({ ...f, adminUsername: e.target.value }))} placeholder="admin" />
            </Field>

            <Field label="Admin - password (يدوي)">
              <input style={input} value={nodeForm.adminPassword} onChange={(e) => setNodeForm((f) => ({ ...f, adminPassword: e.target.value }))} placeholder="password" />
            </Field>

            <Field label="كم مدخل مستعمل (1 - 8)">
              <select style={input} value={String(nodeForm.usedPorts)} onChange={(e) => setUsedPorts(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="تحكم بجهازك">
              <button type="button" style={inputAsBtn} onClick={openIpLink} title="فتح رابط الجهاز على الشبكة حسب IP">
                فتح جهازك (IP)
              </button>
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ ...miniLabel, marginBottom: 8 }}>
                تفاصيل المداخل — اكتب طبيعي: <b>خروج على المشترك @احمد</b>
              </div>

              <div style={portsGridOne}>
                {normalizePorts(nodeForm.ports, nodeForm.usedPorts).map((p) => (
                  <div key={p.index} style={portChip}>
                    <div style={portHeadRow}>
                      <span style={portIndex}>#{p.index}</span>
                    </div>

                    <MentionsInput value={String(p.target ?? "")} onChange={(_e, newValue) => setPortTarget(p.index, newValue)} style={portMentionsStyle} placeholder="مثال: خروج على المشترك @احمد">
                      <Mention trigger="@" data={mentionDataProvider} markup={MENTION_MARKUP} displayTransform={(_id, display) => `@${display}`} renderSuggestion={renderSubSuggestion} appendSpaceOnAdd />
                    </MentionsInput>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="ملاحظات">
                <input style={input} value={nodeForm.notes} onChange={(e) => setNodeForm((f) => ({ ...f, notes: e.target.value }))} placeholder="أي تفاصيل إضافية..." />
              </Field>
            </div>

            <div style={modalActions}>
              <button type="button" style={btnOutline} onClick={closeNodeEditor}>
                إلغاء
              </button>
              <button type="submit" style={btnPrimary}>
                حفظ + ربط
              </button>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={hintBox}>
                <b>معلومة:</b> لو كتبت <b>بدون مسافة</b> زي <b>المشترك@احمد</b>، النظام تلقائياً يصيرها <b>المشترك @احمد</b>.
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* =========================
   Styles
   ========================= */
const pageWrap = { display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto", paddingBottom: 80, direction: "rtl", textAlign: "right" };
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const h1 = { fontSize: 26, fontWeight: 900, color: "#111827", margin: 0 };
const p = { fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0, marginTop: 6 };

const warnBox = { marginTop: 10, border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 14, padding: 10, color: "#9a3412", fontWeight: 900, fontSize: 12, lineHeight: 1.7 };

const layout = { display: "flex", gap: 12, width: "100%", alignItems: "stretch" };

const pane = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 };
const leftPane = { ...pane };
const rightPane = { ...pane };

const paneTitleRow = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" };
const paneTitle = { fontSize: 14, fontWeight: 900, color: "#111827" };

const flowBox = { border: "1px dashed #e5e7eb", borderRadius: 18, background: "#fff", flex: 1, minHeight: 360, overflow: "hidden" };

const canvasHint = { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, fontSize: 13, color: "#6b7280", fontWeight: 900, textAlign: "center", lineHeight: 1.8 };

const rightScrollArea = { display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 2, paddingBottom: 2, maxHeight: "calc(100vh - 200px)" };

const cardBox = { border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 };

const miniLabel = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const hintText = { fontSize: 12, color: "#6b7280", lineHeight: 1.7, fontWeight: 700 };

const input = { padding: "10px 12px", borderRadius: 14, border: "1px solid #d1d5db", fontSize: 14, outline: "none", backgroundColor: "#ffffff", width: "100%", boxSizing: "border-box", direction: "rtl", textAlign: "right" };

const inputAsBtn = { padding: "10px 12px", borderRadius: 14, border: "1px solid #d1d5db", fontSize: 14, outline: "none", backgroundColor: "#ffffff", width: "100%", boxSizing: "border-box", cursor: "pointer", fontWeight: 900, color: "#111827", textAlign: "center" };

const btnRow = { display: "flex", gap: 8, flexWrap: "wrap" };

const btnPrimary = { padding: "10px 16px", borderRadius: 999, border: "none", backgroundColor: theme.primary, color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.15)", whiteSpace: "nowrap" };
const btnPrimaryWide = { padding: "10px 12px", borderRadius: 14, border: "none", backgroundColor: theme.primary, color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 13, boxShadow: "0 12px 30px rgba(15,23,42,0.15)" };
const btnOutline = { padding: "10px 16px", borderRadius: 999, border: "1px solid #d1d5db", backgroundColor: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" };
const btnTinyPrimary = { padding: "8px 12px", borderRadius: 999, border: "none", backgroundColor: theme.primary, color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const btnTinyOutline = { padding: "8px 12px", borderRadius: 999, border: "1px solid #d1d5db", backgroundColor: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", color: "#111827" };
const btnTinyDanger = { padding: "8px 12px", borderRadius: 999, border: "none", backgroundColor: "#dc2626", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
const btnDangerWide = { padding: "10px 12px", borderRadius: 14, border: "1px solid #fecaca", backgroundColor: "#fff", color: "#dc2626", fontWeight: 900, cursor: "pointer", fontSize: 13 };

const kvRow = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const k = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const v = { fontSize: 12, color: "#111827", fontWeight: 900 };

const statRow = { display: "flex", gap: 10, flexWrap: "wrap" };
const statChip = { padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 900, fontSize: 12, color: "#111827" };

/* Modal styles */
const overlay = { position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, padding: 14 };
const modal = { width: "100%", maxWidth: 980, backgroundColor: "#ffffff", borderRadius: 20, padding: "18px 18px 16px", boxShadow: "0 25px 50px rgba(15,23,42,0.35)", maxHeight: "90vh", overflowY: "auto", direction: "rtl", textAlign: "right" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 };
const modalTitle = { fontSize: 18, fontWeight: 900, color: "#111827" };
const xBtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#6b7280", padding: "6px 10px", borderRadius: 12 };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 12px" };
const modalActions = { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };

/* Ports UI */
const portsGridOne = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 };
const portChip = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 10, background: "#fff", display: "flex", flexDirection: "column", gap: 8 };
const portHeadRow = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const portIndex = { fontWeight: 900, fontSize: 12, color: "#111827" };

const portTextareaFixed = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none",
  backgroundColor: "#ffffff",
  width: "100%",
  boxSizing: "border-box",
  height: 72,
  resize: "none",
  lineHeight: 1.5,
  fontFamily: "inherit",
  whiteSpace: "pre-wrap",
  direction: "rtl",
  textAlign: "right",
};

const hintBox = { border: "1px dashed #e5e7eb", borderRadius: 16, padding: 10, background: "#fff", fontSize: 12, color: "#374151", lineHeight: 1.8 };
