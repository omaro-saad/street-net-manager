/**
 * Shared style objects - use across all pages for consistency
 */
import { theme } from "../theme.js";

export const pageWrap = {
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

export const input = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${theme.border}`,
  borderRadius: theme.borderRadiusSm,
  fontSize: 14,
  direction: "rtl",
  backgroundColor: theme.surface,
  outline: "none",
  boxSizing: "border-box",
  color: "white",
};

export const btnPrimary = {
  border: "none",
  background: theme.primaryGradient || theme.primary,
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 999,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.15)",
  whiteSpace: "nowrap",
};

export const btnSecondary = {
  border: `1px solid ${theme.border}`,
  background: theme.surface,
  color: theme.text,
  padding: "10px 16px",
  borderRadius: theme.borderRadiusSm,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

export const btnOutline = {
  padding: "10px 16px",
  borderRadius: 999,
  border: `1px solid ${theme.border}`,
  backgroundColor: theme.surface,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

export const btnGhost = {
  padding: "10px 16px",
  borderRadius: 999,
  border: `1px solid ${theme.border}`,
  backgroundColor: theme.surface,
  color: theme.text,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
};

export const btnDanger = {
  border: "none",
  background: theme.error,
  color: "#fff",
  padding: "10px 16px",
  borderRadius: theme.borderRadiusSm,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

export const btnTinyPrimary = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  background: theme.primaryGradient || theme.primary,
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
};

export const btnTinyDanger = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  backgroundColor: theme.error,
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
};

export const btnTiny = {
  padding: "8px 12px",
  borderRadius: 999,
  border: `1px solid ${theme.border}`,
  backgroundColor: theme.surface,
  color: theme.text,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
};

export const iconBtn = {
  border: `1px solid ${theme.border}`,
  background: theme.surface,
  borderRadius: 12,
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 900,
  color: theme.text,
};

/** Full-screen center for modals/popups — middle of screen */
export const modalOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 9998,
  minHeight: "100vh",
  minWidth: "100vw",
  background: "rgba(17,24,39,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  boxSizing: "border-box",
};

/** Center content in the tab/content area (loading, empty state) */
export const contentCenterWrap = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 280,
  width: "100%",
};

export const modalContent = {
  width: "min(560px, 96vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: theme.surface,
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
  direction: "rtl",
};

export const modalCard = {
  width: "min(860px, 96vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: theme.surface,
  borderRadius: theme.borderRadius,
  border: `1px solid ${theme.border}`,
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  padding: 14,
};

export const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

export const modalTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: theme.text,
};

export const chip = {
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${theme.border}`,
  background: theme.surfaceAlt,
  color: theme.text,
  fontWeight: 900,
  fontSize: 12,
};

export const chipPrimary = {
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${theme.primary}`,
  background: theme.surfaceAlt,
  color: theme.primary,
  fontWeight: 900,
  fontSize: 12,
};

export const chipIncome = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #a7f3d0",
  background: "#ecfdf5",
  color: "#065f46",
  fontWeight: 900,
  fontSize: 12,
};

export const chipExpense = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 12,
};

export const miniLabel = {
  fontSize: 12,
  color: theme.textMuted,
  fontWeight: 900,
};

export const emptyText = {
  fontSize: 13,
  color: theme.textLight,
  padding: "6px 2px",
};

export const tinyNote = {
  fontSize: 12,
  color: theme.textMuted,
  lineHeight: 1.7,
  marginTop: 6,
};

export const emptyBox = {
  border: "1px dashed " + theme.border,
  background: theme.surfaceAlt,
  borderRadius: theme.borderRadius,
  padding: 14,
  fontSize: 13,
  color: theme.textMuted,
  lineHeight: 1.7,
};

export const h1 = { fontSize: 26, fontWeight: 900, color: theme.text };
export const textMuted = { fontSize: 14, color: theme.textMuted, lineHeight: 1.6 };

export const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};
