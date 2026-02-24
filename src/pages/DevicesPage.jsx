// src/pages/DevicesPage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../DataContext";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAlert } from "../contexts/AlertContext.jsx";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useMinLoadingTime } from "../hooks/useMinLoadingTime.js";
import LoadingOverlay from "../components/LoadingOverlay.jsx";
import LoadingLogo from "../components/LoadingLogo.jsx";
import ReadOnlyBanner from "../components/ReadOnlyBanner.jsx";
import { READ_ONLY_MESSAGE, isApiMode, apiInventoryGet, apiInventorySet } from "../lib/api.js";
import { safeArray, safeObj, nowMs } from "../utils/helpers.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { theme } from "../theme.js";
import {
  pageWrap,
  h1,
  input,
  btnPrimary,
  btnOutline,
  btnTinyPrimary,
  btnTinyDanger,
  miniLabel,
  modalOverlay,
  modalContent,
  modalHeader,
  modalTitle,
  emptyText,
  grid2,
  textMuted,
  contentCenterWrap,
} from "../styles/shared.js";

const DEFAULT_SECTION_SUGGESTIONS = {
  "مستلزمات كهربائية": ["قاطع", "فيوز", "مقبس", "فيشة", "شريط كهرباء", "محول", "ريليه", "لمبة"],
  "مستلزمات انترنت": ["كونكتور RJ45", "كريمنج", "بنسة", "كابلات Patch", "UPS", "PoE Injector", "PoE Splitter"],
  اسلاك: ["Cat6", "Cat5e", "سلك كهرباء 2×1.5", "سلك كهرباء 2×2.5", "سلك تيليفون"],
  "قطع غيار": ["باور", "أنتينا", "بوردة", "مروحة", "زر", "شاحن"],
  "قطع للتصليح": ["تيب لاصق", "سلك لحام", "قصدير", "تركيبات", "براغي", "مشابك"],
  "قطع تالفة": ["راوتر تالف", "سويتش تالف", "مزود طاقة تالف"],
};

function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(2)} ₪`;
}
export default function DevicesPage() {
  const { data, setData } = useData();
  const { token, getLimit, canWrite } = useAuth();
  const { showPlanLimitAlert, showReadOnlyAlert, showValidationAlert, showErrorAlert, showConfirmAlert } = useAlert();

  const useInventoryApi = isApiMode() && !!token;

  const { isNarrow, isMobile } = useResponsive();

  // =========================
  // Source: data.inventory (in-memory or synced from API)
  // =========================
  const inventory = useMemo(
    () => data?.inventory || { warehouses: [], sections: [], items: [] },
    [data?.inventory]
  );

  const warehouses = safeArray(inventory.warehouses);
  const sections = safeArray(inventory.sections);
  const items = safeArray(inventory.items);
  const devicesStoresLimit = getLimit("devicesStores");
  const devicesStoresAtLimit = devicesStoresLimit != null && warehouses.length >= devicesStoresLimit;
  const canWriteDevices = canWrite("devices");

  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Load inventory from API when in API mode
  useEffect(() => {
    if (!useInventoryApi || !token) {
      setInventoryLoading(false);
      return;
    }
    setInventoryLoading(true);
    let cancelled = false;
    (async () => {
      const res = await apiInventoryGet(token);
      if (cancelled) return;
      setInventoryLoading(false);
      if (res.ok && res.data) setData((prev) => ({ ...prev, inventory: res.data, updatedAt: nowMs() }));
    })();
    return () => { cancelled = true; };
  }, [useInventoryApi, token, setData]);

  // Updater: local context + persist to API when in API mode (sync for read path)
  const updateInventory = useCallback(
    (patch) => {
      const nextInv = {
        warehouses: inventory.warehouses ?? [],
        sections: inventory.sections ?? [],
        items: inventory.items ?? [],
        ...patch,
      };
      setData((prev) => ({ ...prev, inventory: nextInv, updatedAt: nowMs() }));
      if (useInventoryApi && token) {
        apiInventorySet(token, nextInv).then((res) => {
          if (!res.ok) showErrorAlert(res.error || "فشل حفظ المخزون.");
          else if (res.data) setData((prev) => ({ ...prev, inventory: res.data, updatedAt: nowMs() }));
        });
      }
    },
    [inventory, useInventoryApi, token, setData, showErrorAlert]
  );

  // Async updater for use inside execute (loading + min time)
  const applyInventoryUpdate = useCallback(
    async (patch) => {
      const nextInv = {
        warehouses: inventory.warehouses ?? [],
        sections: inventory.sections ?? [],
        items: inventory.items ?? [],
        ...patch,
      };
      setData((prev) => ({ ...prev, inventory: nextInv, updatedAt: nowMs() }));
      if (useInventoryApi && token) {
        const res = await apiInventorySet(token, nextInv);
        if (!res.ok) showErrorAlert(res.error || "فشل حفظ المخزون.");
        else if (res.data) setData((prev) => ({ ...prev, inventory: res.data, updatedAt: nowMs() }));
      }
    },
    [inventory, useInventoryApi, token, setData, showErrorAlert]
  );

  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  // =========================
  // ✅ State
  // =========================
  const [activeWarehouseId, setActiveWarehouseId] = useState("");

  const [filterQuery, setFilterQuery] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("all");
  const [sortKey, setSortKey] = useState("name"); // name | qty | price | value

  const activeWarehouse = useMemo(
    () => warehouses.find((w) => w.id === activeWarehouseId) || null,
    [warehouses, activeWarehouseId]
  );

  const sectionsForWarehouse = useMemo(() => {
    if (!activeWarehouseId) return [];
    return sections
      .filter((s) => s.warehouseId === activeWarehouseId)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [sections, activeWarehouseId]);

  const itemsForWarehouse = useMemo(() => {
    if (!activeWarehouseId) return [];

    let list = items.filter((it) => it.warehouseId === activeWarehouseId);

    if (filterSectionId !== "all") list = list.filter((it) => it.sectionId === filterSectionId);

    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      list = list.filter((it) => {
        const sec = String(it.sectionName || "").toLowerCase();
        const type = String(it.typeName || "").toLowerCase();
        const name = String(it.itemName || "").toLowerCase();
        const note = String(it.note || "").toLowerCase();
        return sec.includes(q) || type.includes(q) || name.includes(q) || note.includes(q);
      });
    }

    const getValue = (it) => (it.hasPrice ? safeNum(it.unitPrice, 0) * safeNum(it.quantity, 0) : -1);

    list = list.slice().sort((a, b) => {
      if (sortKey === "qty") return safeNum(b.quantity, 0) - safeNum(a.quantity, 0);
      if (sortKey === "price") return safeNum(b.unitPrice, -1) - safeNum(a.unitPrice, -1);
      if (sortKey === "value") return getValue(b) - getValue(a);
      return String(a.itemName || "").localeCompare(String(b.itemName || ""));
    });

    return list;
  }, [items, activeWarehouseId, filterSectionId, filterQuery, sortKey]);

  const totals = useMemo(() => {
    if (!activeWarehouseId) return { pricedCount: 0, totalValue: 0, itemCount: 0 };
    const list = itemsForWarehouse;
    const priced = list.filter((x) => x.hasPrice && Number.isFinite(Number(x.unitPrice)));
    const totalValue = priced.reduce((sum, x) => sum + safeNum(x.unitPrice, 0) * safeNum(x.quantity, 0), 0);
    return { pricedCount: priced.length, totalValue, itemCount: list.length };
  }, [itemsForWarehouse, activeWarehouseId]);

  const getWarehouseSummary = (warehouseId) => {
    const secCount = sections.filter((s) => s.warehouseId === warehouseId).length;
    const whItems = items.filter((x) => x.warehouseId === warehouseId);
    const itemCount = whItems.length;
    const priced = whItems.filter((x) => x.hasPrice && Number.isFinite(Number(x.unitPrice)));
    const totalValue = priced.reduce((sum, x) => sum + safeNum(x.unitPrice, 0) * safeNum(x.quantity, 0), 0);
    return { secCount, itemCount, pricedCount: priced.length, totalValue };
  };

  // =========================
  // ✅ Modals / Overlay
  // =========================
  const overlayRef = useRef(null);

  // Add warehouse
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ name: "", location: "" });

  const openAddWarehouse = () => {
    setWarehouseForm({ name: "", location: "" });
    setShowAddWarehouse(true);
  };
  const closeAddWarehouse = () => setShowAddWarehouse(false);

  const saveWarehouse = async (e) => {
    e.preventDefault();
    if (!canWriteDevices) {
      showReadOnlyAlert();
      return;
    }
    if (devicesStoresAtLimit) {
      showPlanLimitAlert();
      return;
    }
    const name = String(warehouseForm.name || "").trim();
    const location = String(warehouseForm.location || "").trim();
    if (!name) return showValidationAlert("اكتب اسم المخزن.", "اسم المخزن");

    const newW = {
      id: `wh_${nowMs()}_${Math.floor(Math.random() * 100000)}`,
      name,
      location,
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };

    await execute(async () => {
      try {
        await applyInventoryUpdate({ warehouses: [newW, ...safeArray(data?.inventory?.warehouses)] });
        setActiveWarehouseId(newW.id);
        openWarehouseModal(newW.id);
        closeAddWarehouse();
      } catch (err) {
        showErrorAlert(String(err?.message || err));
      }
    });
  };

  const deleteWarehouse = async (id) => {
    if (!canWriteDevices) return showReadOnlyAlert();
    const secCount = sections.filter((s) => s.warehouseId === id).length;
    const itemCount = items.filter((x) => x.warehouseId === id).length;
    const msg =
      secCount > 0 || itemCount > 0
        ? `هذا المخزن يحتوي على ${secCount} أقسام و ${itemCount} قطع. حذف المخزن سيحذف كل شيء داخله. متابعة؟`
        : "حذف المخزن؟";
    showConfirmAlert({
      message: msg,
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
          try {
            await applyInventoryUpdate({
              warehouses: warehouses.filter((w) => w.id !== id),
              sections: sections.filter((s) => s.warehouseId !== id),
              items: items.filter((x) => x.warehouseId !== id),
            });
            if (activeWarehouseId === id) setActiveWarehouseId("");
            if (warehouseModalOpen && warehouseModalId === id) closeWarehouseModal();
          } catch (err) {
            showErrorAlert(String(err?.message || err));
          }
        });
      },
    });
  };

  // Add section
  const [showAddSection, setShowAddSection] = useState(false);
  const [sectionForm, setSectionForm] = useState({ warehouseId: "", name: "" });

  const openAddSection = (forcedWarehouseId) => {
    const whId = forcedWarehouseId || activeWarehouseId || warehouses[0]?.id || "";
    if (!whId) return showErrorAlert("أضف مخزن أولاً.");
    setSectionForm({ warehouseId: whId, name: "" });
    setShowAddSection(true);
  };
  const closeAddSection = () => setShowAddSection(false);

  const saveSection = async (e) => {
    e.preventDefault();
    if (!canWriteDevices) return showReadOnlyAlert();
    const warehouseId = sectionForm.warehouseId;
    const name = String(sectionForm.name || "").trim();
    if (!warehouseId) return showValidationAlert("اختر مخزن.", "المخزن");
    if (!name) return showValidationAlert("اكتب اسم القسم.", "اسم القسم");

    const newS = {
      id: `sec_${nowMs()}_${Math.floor(Math.random() * 100000)}`,
      warehouseId,
      name,
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };

    try {
      updateInventory({ sections: [newS, ...sections] });
      setActiveWarehouseId(warehouseId);
      closeAddSection();
    } catch (err) {
      showErrorAlert(String(err?.message || err));
    }
  };

  const deleteSection = async (id) => {
    if (!canWriteDevices) return showReadOnlyAlert();
    const itemCount = items.filter((x) => x.sectionId === id).length;
    const msg = itemCount > 0 ? `هذا القسم يحتوي ${itemCount} قطع. حذف القسم سيحذف القطع داخله. متابعة؟` : "حذف القسم؟";
    showConfirmAlert({
      message: msg,
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
          try {
            await applyInventoryUpdate({
              sections: sections.filter((s) => s.id !== id),
              items: items.filter((x) => x.sectionId !== id),
            });
            if (filterSectionId === id) setFilterSectionId("all");
          } catch (err) {
            showErrorAlert(String(err?.message || err));
          }
        });
      },
    });
  };

  // Add/Edit item
  const [showItem, setShowItem] = useState(false);
  const [itemMode, setItemMode] = useState("add"); // add | edit
  const [editingItemId, setEditingItemId] = useState(null);

  const [itemForm, setItemForm] = useState({
    id: "",
    warehouseId: "",
    sectionId: "",
    sectionName: "",
    typeName: "",
    itemName: "",
    quantity: "1",
    unit: "قطعة",
    hasPrice: false,
    unitPrice: "",
    note: "",
    createdAt: null,
  });

  const syncSectionName = (secId, whId) => {
    const sec = sections.find((s) => s.id === secId && s.warehouseId === whId);
    return sec?.name || "";
  };

  const typeSuggestions = useMemo(() => {
    const secName = itemForm.sectionName || "";
    const base = DEFAULT_SECTION_SUGGESTIONS[secName] || [];
    const existing = items
      .filter((it) => it.sectionName === secName)
      .map((it) => it.typeName)
      .filter(Boolean);
    const set = new Set([...base, ...existing]);
    return Array.from(set).slice(0, 25);
  }, [itemForm.sectionName, items]);

  const openAddItem = (forcedWarehouseId) => {
    const whId = forcedWarehouseId || activeWarehouseId || warehouses[0]?.id || "";
    if (!whId) return showErrorAlert("أضف مخزن أولاً.");

    const secs = sections
      .filter((s) => s.warehouseId === whId)
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const secId = secs[0]?.id || "";
    const secName = secs[0]?.name || "";

    setItemMode("add");
    setEditingItemId(null);
    setItemForm({
      id: `item_${nowMs()}_${Math.floor(Math.random() * 100000)}`,
      warehouseId: whId,
      sectionId: secId,
      sectionName: secName,
      typeName: "",
      itemName: "",
      quantity: "1",
      unit: "قطعة",
      hasPrice: false,
      unitPrice: "",
      note: "",
      createdAt: nowMs(),
    });
    setShowItem(true);
  };

  const openEditItem = (it) => {
    setItemMode("edit");
    setEditingItemId(it.id);

    setItemForm({
      id: it.id,
      warehouseId: it.warehouseId || "",
      sectionId: it.sectionId || "",
      sectionName: it.sectionName || "",
      typeName: it.typeName || "",
      itemName: it.itemName || "",
      quantity: it.quantity != null ? String(it.quantity) : "1",
      unit: it.unit || "قطعة",
      hasPrice: !!it.hasPrice,
      unitPrice: it.hasPrice && it.unitPrice != null ? String(it.unitPrice) : "",
      note: it.note || "",
      createdAt: it.createdAt || nowMs(),
    });

    setShowItem(true);
  };

  const closeItem = () => {
    setShowItem(false);
    setItemMode("add");
    setEditingItemId(null);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    if (!canWriteDevices) return showReadOnlyAlert();

    const warehouseId = itemForm.warehouseId;
    const sectionId = itemForm.sectionId;
    const sectionName = syncSectionName(sectionId, warehouseId);

    const typeName = String(itemForm.typeName || "").trim();
    const itemName = String(itemForm.itemName || "").trim();
    const quantity = safeNum(itemForm.quantity, NaN);
    const unit = String(itemForm.unit || "").trim() || "قطعة";
    const hasPrice = !!itemForm.hasPrice;
    const unitPrice = hasPrice ? safeNum(itemForm.unitPrice, NaN) : null;
    const note = String(itemForm.note || "").trim();

    if (!warehouseId) return showValidationAlert("اختر مخزن.", "المخزن");
    if (!sectionId) return showValidationAlert("اختر قسم.", "القسم");
    if (!itemName) return showValidationAlert("اكتب اسم القطعة.", "اسم القطعة");
    if (!Number.isFinite(quantity) || quantity < 0) return showValidationAlert("الكمية غير صحيحة.", "الكمية");

    if (hasPrice) {
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return showValidationAlert("سعر الوحدة غير صحيح.", "سعر الوحدة");
    }

    const payload = {
      id: itemForm.id,
      warehouseId,
      sectionId,
      sectionName,
      typeName,
      itemName,
      quantity,
      unit,
      hasPrice,
      unitPrice: hasPrice ? unitPrice : null,
      note,
      createdAt: itemForm.createdAt || nowMs(),
      updatedAt: nowMs(),
    };

    await execute(async () => {
      try {
        if (itemMode === "edit" && editingItemId) {
          await applyInventoryUpdate({
            items: items.map((x) => (x.id === editingItemId ? { ...x, ...payload } : x)),
          });
        } else {
          await applyInventoryUpdate({ items: [{ ...payload }, ...items] });
        }

        setActiveWarehouseId(warehouseId);
        closeItem();
      } catch (err) {
        showErrorAlert(String(err?.message || err));
      }
    });
  };

  const deleteItem = async (id) => {
    if (!canWriteDevices) return showReadOnlyAlert();
    showConfirmAlert({
      message: "حذف القطعة؟",
      confirmLabel: "حذف",
      onConfirm: () => {
        execute(async () => {
          try {
            await applyInventoryUpdate({ items: items.filter((x) => x.id !== id) });
          } catch (err) {
            showErrorAlert(String(err?.message || err));
          }
        });
      },
    });
  };

  // ===== Warehouse Details Modal =====
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [warehouseModalId, setWarehouseModalId] = useState("");

  const openWarehouseModal = (id) => {
    setActiveWarehouseId(id);
    setWarehouseModalId(id);
    setWarehouseModalOpen(true);

    setFilterQuery("");
    setFilterSectionId("all");
    setSortKey("name");
  };

  const closeWarehouseModal = () => {
    setWarehouseModalOpen(false);
    setWarehouseModalId("");
    setFilterQuery("");
    setFilterSectionId("all");
    setSortKey("name");
  };

  const canActions = Boolean(warehouses.length);

  // =========================
  // ✅ Responsive derived styles
  // =========================
  const pageWrapR = useMemo(
    () => ({
      ...pageWrap,
      paddingBottom: isMobile ? 80 : 10,
    }),
    [isMobile]
  );

  const topRowR = useMemo(
    () => ({
      ...topRow,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );

  const headerActionsR = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      width: isMobile ? "100%" : undefined,
      justifyContent: isMobile ? "stretch" : "flex-end",
    }),
    [isMobile]
  );

  const btnPrimaryR = useMemo(
    () => ({
      ...btnPrimary,
      width: isMobile ? "100%" : undefined,
      justifyContent: "center",
    }),
    [isMobile]
  );

  const actionBarR = useMemo(
    () => ({
      ...actionBar,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );

  const cardsGridR = useMemo(
    () => ({
      ...cardsGrid,
      gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "repeat(1, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
    }),
    [isMobile, isNarrow]
  );

  const warehouseCardTopR = useMemo(
    () => ({
      ...warehouseCardTop,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );

  const warehouseCardButtonsR = useMemo(
    () => ({
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: isMobile ? "stretch" : "flex-end",
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );

  const btnTinyPrimaryR = useMemo(
    () => ({
      ...btnTinyPrimary,
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );

  const btnTinyDangerR = useMemo(
    () => ({
      ...btnTinyDanger,
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );

  const warnPillR = useMemo(
    () => ({
      ...warnPill,
      width: isMobile ? "100%" : undefined,
      textAlign: isMobile ? "center" : undefined,
    }),
    [isMobile]
  );

  const overlayR = useMemo(
    () => ({
      ...modalOverlay,
      padding: isMobile ? 10 : 14,
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );

  const modalR = useMemo(
    () => ({
      ...modalWide,
      borderRadius: isMobile ? 16 : 20,
      padding: isMobile ? "12px 12px 12px" : "18px 18px 16px",
      maxHeight: isMobile ? "96vh" : "92vh",
    }),
    [isMobile]
  );

  const modalHeaderR = useMemo(
    () => ({
      ...modalHeader,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
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

  const sectionsGridR = useMemo(
    () => ({
      ...sectionsGrid,
      gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
    }),
    [isMobile, isNarrow]
  );

  const itemRowR = useMemo(
    () => ({
      ...itemRow,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );

  const itemActionsR = useMemo(
    () => ({
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: isMobile ? "stretch" : "flex-end",
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );

  const btnTinyOutlineR = useMemo(
    () => ({
      ...btnTinyOutline,
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );

  const formGridR = useMemo(
    () => ({
      ...grid2,
      gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
    }),
    [isMobile]
  );

  const modalActionsR = useMemo(
    () => ({
      ...modalActions,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
      justifyContent: isMobile ? "stretch" : "flex-end",
    }),
    [isMobile]
  );

  const btnOutlineR = useMemo(
    () => ({
      ...btnOutline,
      width: isMobile ? "100%" : undefined,
    }),
    [isMobile]
  );

  const modalTopInfoR = useMemo(
    () => ({
      ...modalTopInfo,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
    }),
    [isMobile]
  );

  const totalsBarR = useMemo(
    () => ({
      ...totalsBar,
      justifyContent: isMobile ? "flex-start" : "flex-end",
    }),
    [isMobile]
  );

  const modalActionsBarR = useMemo(
    () => ({
      ...modalActionsBar,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
    }),
    [isMobile]
  );

  const displayLoading = useMinLoadingTime(useInventoryApi && inventoryLoading && warehouses.length === 0);
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
      {!canWriteDevices && <ReadOnlyBanner />}
      {/* Header */}
      <div style={topRowR}>
        <div>
          <h1 style={{ ...h1, fontSize: isMobile ? 22 : 26 }}>المعدات والمخازن</h1>
          <p style={textMuted}>السعر اختياري — إذا فعّلته، بنحسب قيمة القطعة تلقائياً (الكمية × سعر الوحدة).</p>
        </div>

        <div style={headerActionsR}>
          <button
            style={btnPrimaryR}
            onClick={() => { if (devicesStoresAtLimit) { showPlanLimitAlert(); return; } openAddWarehouse(); }}
            disabled={!canWriteDevices || actionLoading}
            title={!canWriteDevices ? READ_ONLY_MESSAGE : undefined}
          >
            + إضافة مخزن
          </button>
        </div>
      </div>

      {/* Actions bar */}
      <div style={actionBarR}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>
          <button
            style={{ ...btnOutlineR }}
            onClick={() => openAddSection(activeWarehouseId || warehouses[0]?.id)}
            disabled={!canActions || !canWriteDevices || actionLoading}
            title={!canWriteDevices ? READ_ONLY_MESSAGE : undefined}
          >
            + إضافة قسم
          </button>
          <button
            style={{ ...btnOutlineR }}
            onClick={() => openAddItem(activeWarehouseId || warehouses[0]?.id)}
            disabled={!canActions || !canWriteDevices || actionLoading}
            title={!canWriteDevices ? READ_ONLY_MESSAGE : undefined}
          >
            + إضافة قطعة
          </button>
        </div>

        <div style={actionHint}>
          {warehouses.length === 0 ? "ابدأ بإضافة مخزن أولاً." : "اضغط (فتح) على أي مخزن لعرض التفاصيل بنافذة كبيرة."}
        </div>
      </div>

      {/* Warehouses Cards */}
      <div style={cardsGridR}>
        {warehouses.length === 0 ? (
          <div style={contentCenterWrap}>
            <div style={emptyText}>لا يوجد مخازن. ابدأ بإضافة مخزن.</div>
          </div>
        ) : (
          warehouses.map((w) => {
            const sum = getWarehouseSummary(w.id);
            return (
              <div key={w.id} style={warehouseCard}>
                <div style={warehouseCardTopR}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={warehouseTitle}>{w.name || "—"}</div>
                    <div style={warehouseMeta}>{w.location ? `📍 ${w.location}` : "📍 —"}</div>

                    <div style={warehousePills}>
                      <span style={pill}>أقسام: {sum.secCount}</span>
                      <span style={pill}>قطع: {sum.itemCount}</span>
                      <span style={pill}>بسعر: {sum.pricedCount}</span>
                      <span style={pillStrong}>قيمة: {money(sum.totalValue)}</span>
                    </div>
                  </div>

                  <div style={warehouseCardButtonsR}>
                    <button style={btnTinyPrimaryR} onClick={() => openWarehouseModal(w.id)}>
                      فتح
                    </button>
                    <button style={btnTinyDangerR} onClick={() => deleteWarehouse(w.id)} disabled={actionLoading}>
                      حذف
                    </button>
                  </div>
                </div>

                <div style={warehouseCardHint}>عرض كامل ومنظم داخل نافذة كبيرة (تفاصيل + أقسام + قطع + بحث + ترتيب).</div>
              </div>
            );
          })
        )}
      </div>

      {/* Warehouse Details Modal */}
      {warehouseModalOpen && activeWarehouse ? (
        <Modal
          overlayRef={overlayRef}
          title={`تفاصيل المخزن: ${activeWarehouse.name || "—"}`}
          onClose={closeWarehouseModal}
          wide
          overlayStyle={overlayR}
          modalStyle={modalR}
          headerStyle={modalHeaderR}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={modalTopInfoR}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={blockTitle}>📦 {activeWarehouse.name}</div>
                <div style={blockSub}>{activeWarehouse.location ? `📍 ${activeWarehouse.location}` : "📍 —"}</div>
              </div>

              <div style={totalsBarR}>
                <span style={pill}>قطع: {totals.itemCount}</span>
                <span style={pill}>قطع بسعر: {totals.pricedCount}</span>
                <span style={pillStrong}>قيمة تقديرية: {money(totals.totalValue)}</span>
              </div>
            </div>

            {/* Modal actions */}
            <div style={modalActionsBarR}>
              <button style={btnOutlineR} onClick={() => openAddSection(activeWarehouse.id)}>
                + إضافة قسم
              </button>
              <button style={btnOutlineR} onClick={() => openAddItem(activeWarehouse.id)}>
                + إضافة قطعة
              </button>
            </div>

            {/* Filters */}
            <div style={filtersRowR}>
              <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260 }}>
                <div style={miniLabel}>بحث</div>
                <input
                  style={input}
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="اسم / نوع / قسم / ملاحظات..."
                />
              </div>

              <div style={{ minWidth: isMobile ? "100%" : 220 }}>
                <div style={miniLabel}>القسم</div>
                <select style={input} value={filterSectionId} onChange={(e) => setFilterSectionId(e.target.value)}>
                  <option value="all">الكل</option>
                  {sectionsForWarehouse.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: isMobile ? "100%" : 220 }}>
                <div style={miniLabel}>ترتيب</div>
                <select style={input} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                  <option value="name">الاسم</option>
                  <option value="qty">الكمية (الأعلى)</option>
                  <option value="price">سعر الوحدة (الأعلى)</option>
                  <option value="value">القيمة الإجمالية (الأعلى)</option>
                </select>
              </div>
            </div>

            {/* Sections strip */}
            <div style={sectionStrip}>
              <div style={panelTitle}>الأقسام</div>
              {sectionsForWarehouse.length === 0 ? (
                <div style={contentCenterWrap}>
                  <div style={emptyText}>لا يوجد أقسام داخل هذا المخزن.</div>
                </div>
              ) : (
                <div style={sectionsGridR}>
                  {sectionsForWarehouse.map((s) => (
                    <div key={s.id} style={sectionCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, color: "#111827" }}>{s.name}</div>
                        <button style={btnTinyDanger} onClick={() => deleteSection(s.id)} disabled={actionLoading}>
                          حذف
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        قطع: {items.filter((x) => x.sectionId === s.id).length}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items list */}
            <div style={listWrap}>
              <div style={listHeader}>
                <div style={listTitle}>قطع المخزن</div>
                <div style={listCount}>{itemsForWarehouse.length}</div>
              </div>

              <div style={itemsList}>
                {itemsForWarehouse.length === 0 ? (
                  <div style={contentCenterWrap}>
                    <div style={emptyText}>لا يوجد قطع حسب البحث/الفلترة.</div>
                  </div>
                ) : (
                  itemsForWarehouse.map((it) => {
                    const unitPrice = it.hasPrice ? safeNum(it.unitPrice, NaN) : NaN;
                    const totalValue = it.hasPrice ? safeNum(it.quantity, 0) * safeNum(it.unitPrice, 0) : NaN;

                    return (
                      <div key={it.id} style={itemRowR}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={badge("sale")}>{it.sectionName || "—"}</span>
                            {it.typeName ? <span style={badge("buy")}>{it.typeName}</span> : null}
                            <div style={itemName}>{it.itemName}</div>
                          </div>

                          <div style={itemMeta}>
                            <span>
                              📦 كمية: <strong>{it.quantity}</strong> {it.unit || ""}
                            </span>
                            <span>
                              💰 سعر الوحدة: <strong>{Number.isFinite(unitPrice) ? money(unitPrice) : "—"}</strong>
                            </span>
                            <span>
                              🧾 القيمة: <strong>{Number.isFinite(totalValue) ? money(totalValue) : "—"}</strong>
                            </span>
                          </div>

                          {it.note ? <div style={noteLine}>📝 {it.note}</div> : null}
                        </div>

                        <div style={itemActionsR}>
                          <button style={btnTinyOutlineR} onClick={() => openEditItem(it)} disabled={actionLoading}>
                            تعديل
                          </button>
                          <button style={btnTinyDangerR} onClick={() => deleteItem(it.id)} disabled={actionLoading}>
                            حذف
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button style={btnOutlineR} onClick={closeWarehouseModal}>
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Add Warehouse */}
      {showAddWarehouse && (
        <Modal
          overlayRef={overlayRef}
          title="إضافة مخزن"
          onClose={closeAddWarehouse}
          overlayStyle={overlayR}
          modalStyle={modalR}
          headerStyle={modalHeaderR}
        >
          <form onSubmit={saveWarehouse} style={formGridR}>
            <Field label="اسم المخزن" full>
              <input
                style={input}
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>

            <Field label="المكان (اختياري)" full>
              <input
                style={input}
                value={warehouseForm.location}
                onChange={(e) => setWarehouseForm((f) => ({ ...f, location: e.target.value }))}
              />
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={btnOutlineR} onClick={closeAddWarehouse} disabled={actionLoading}>
                إلغاء
              </button>
              <button type="submit" style={btnPrimaryR} disabled={actionLoading}>
                إضافة
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Section */}
      {showAddSection && (
        <Modal
          overlayRef={overlayRef}
          title="إضافة قسم"
          onClose={closeAddSection}
          overlayStyle={overlayR}
          modalStyle={modalR}
          headerStyle={modalHeaderR}
        >
          <form onSubmit={saveSection} style={formGridR}>
            <Field label="المخزن" full>
              <select
                style={input}
                value={sectionForm.warehouseId}
                onChange={(e) => setSectionForm((f) => ({ ...f, warehouseId: e.target.value }))}
              >
                <option value="">اختر...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="اسم القسم" full>
              <input
                style={input}
                value={sectionForm.name}
                onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="قسم الأسلاك | قسم المحولات | قسم الأجهزة | ..."
              />
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={btnOutlineR} onClick={closeAddSection} disabled={actionLoading}>
                إلغاء
              </button>
              <button type="submit" style={btnPrimaryR} disabled={actionLoading}>
                إضافة
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add/Edit Item */}
      {showItem && (
        <Modal
          overlayRef={overlayRef}
          title={itemMode === "edit" ? "تعديل قطعة" : "إضافة قطعة"}
          onClose={closeItem}
          wide
          overlayStyle={overlayR}
          modalStyle={modalR}
          headerStyle={modalHeaderR}
        >
          <form onSubmit={saveItem} style={formGridR}>
            <Field label="المخزن">
              <select
                style={input}
                value={itemForm.warehouseId}
                onChange={(e) => {
                  const whId = e.target.value;
                  const firstSec =
                    sections
                      .filter((s) => s.warehouseId === whId)
                      .slice()
                      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))[0] || null;

                  setItemForm((f) => ({
                    ...f,
                    warehouseId: whId,
                    sectionId: firstSec?.id || "",
                    sectionName: firstSec?.name || "",
                  }));
                }}
              >
                <option value="">اختر...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="قسم المخزن">
              <select
                style={input}
                value={itemForm.sectionId}
                onChange={(e) => {
                  const secId = e.target.value;
                  const secName = syncSectionName(secId, itemForm.warehouseId);
                  setItemForm((f) => ({ ...f, sectionId: secId, sectionName: secName }));
                }}
              >
                <option value="">اختر...</option>
                {sections.filter((s) => s.warehouseId === itemForm.warehouseId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="نوع القطعة (اقتراحات)">
              <input
                style={input}
                value={itemForm.typeName}
                onChange={(e) => setItemForm((f) => ({ ...f, typeName: e.target.value }))}
                list="typeSuggestions"
              />
              <datalist id="typeSuggestions">
                {typeSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>

            <Field label="اسم القطعة">
              <input
                style={input}
                value={itemForm.itemName}
                onChange={(e) => setItemForm((f) => ({ ...f, itemName: e.target.value }))}
              />
            </Field>

            <Field label="الكمية">
              <input
                style={input}
                value={itemForm.quantity}
                onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </Field>

            <Field label="الوحدة">
              <input
                style={input}
                value={itemForm.unit}
                onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="قطعة / متر / صندوق..."
              />
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={toggle}>
                <input
                  type="checkbox"
                  checked={!!itemForm.hasPrice}
                  onChange={(e) => setItemForm((f) => ({ ...f, hasPrice: e.target.checked }))}
                />
                <span>للقطعة سعر؟ (اختياري)</span>
              </label>
            </div>

            {itemForm.hasPrice ? (
              <Field label="سعر الوحدة (₪)">
                <input
                  style={input}
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm((f) => ({ ...f, unitPrice: e.target.value }))}
                />
              </Field>
            ) : (
              <div />
            )}

            <Field label="ملاحظات (اختياري)" full>
              <input
                style={input}
                value={itemForm.note}
                onChange={(e) => setItemForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Field>

            <div style={modalActionsR}>
              <button type="button" style={btnOutlineR} onClick={closeItem} disabled={actionLoading}>
                إلغاء
              </button>
              <button type="submit" style={btnPrimaryR} disabled={actionLoading}>
                {itemMode === "edit" ? "حفظ" : "إضافة"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ===== UI components ===== */
function Modal({ overlayRef, title, onClose, children, wide, overlayStyle, modalStyle, headerStyle }) {
  return (
    <div
      ref={overlayRef}
      style={overlayStyle || modalOverlay}
      onMouseDown={(e) => e.target === overlayRef.current && onClose()}
    >
      <div style={{ ...(modalStyle || modalWide), maxWidth: wide ? 1200 : 920 }}>
        <div style={headerStyle || modalHeader}>
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
function Field({ label, children, full }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={miniLabel}>{label}</div>
      {children}
    </div>
  );
}
function badge(kind) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontWeight: 900,
    fontSize: "12px",
    border: `1px solid ${theme.border}`,
    background: theme.surfaceAlt,
    color: theme.text,
    whiteSpace: "nowrap",
  };
  if (kind === "sale") return { ...base, background: "#eef2ff", borderColor: "#c7d2fe", color: "#3730a3" };
  if (kind === "buy") return { ...base, background: "#f1f5f9", borderColor: "#e2e8f0", color: "#0f172a" };
  return base;
}

/* ===== Page-specific styles (shared tokens imported above) ===== */
const topRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const actionBar = {
  border: `1px solid ${theme.border}`,
  borderRadius: 18,
  background: theme.surface,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};
const actionHint = { fontSize: 12, color: theme.textMuted, fontWeight: 900 };

const warnPill = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const btnTinyOutline = { padding: "8px 12px", borderRadius: 999, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text, fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };

const cardsGrid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };

const warehouseCard = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 14, display: "flex", flexDirection: "column", gap: 10 };
const warehouseCardTop = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const warehouseTitle = { fontSize: 16, fontWeight: 900, color: theme.text };
const warehouseMeta = { fontSize: 12, color: theme.textMuted, lineHeight: 1.6 };
const warehousePills = { display: "flex", gap: 8, flexWrap: "wrap" };
const warehouseCardHint = { fontSize: 12, color: theme.textMuted, lineHeight: 1.7, borderTop: `1px dashed ${theme.border}`, paddingTop: 10 };

const pill = { padding: "6px 10px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, fontWeight: 900, fontSize: 12, color: theme.text };
const pillStrong = { ...pill, borderColor: "#c7d2fe", background: "#eef2ff", color: "#3730a3" };

const filtersRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" };

const modalWide = { ...modalContent, width: "100%", maxHeight: "92vh", overflowY: "auto", padding: "18px 18px 16px" };
const modalTopInfo = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" };
const modalActionsBar = { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" };

const blockTitle = { fontSize: 18, fontWeight: 900, color: theme.text };
const blockSub = { fontSize: 13, color: theme.textMuted, marginTop: 2 };

const totalsBar = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };

const panelTitle = { fontSize: 14, fontWeight: 900, color: theme.text };
const sectionStrip = { display: "flex", flexDirection: "column", gap: 10 };
const sectionsGrid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const sectionCard = { border: `1px solid ${theme.border}`, borderRadius: 16, background: theme.surfaceAlt, padding: 12 };

const listWrap = { border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 12 };
const listHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 };
const listTitle = { fontSize: 15, fontWeight: 900, color: theme.text };
const listCount = { fontSize: 13, fontWeight: 900, color: theme.textMuted };

const itemsList = { display: "flex", flexDirection: "column", gap: 10 };
const itemRow = { border: `1px solid ${theme.border}`, borderRadius: 16, background: theme.surface, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const itemName = { fontWeight: 900, color: theme.text };
const itemMeta = { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: theme.textMuted, lineHeight: 1.6 };
const noteLine = { fontSize: 12, color: theme.text, background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "8px 10px", lineHeight: 1.6 };

const toggle = { display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: theme.text, flexWrap: "wrap" };

const xBtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: theme.textMuted, padding: "6px 10px", borderRadius: 12 };
const modalActions = { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
