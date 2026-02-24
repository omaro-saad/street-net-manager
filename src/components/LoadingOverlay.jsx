/**
 * Full-screen loading overlay for async operations (Create/Update/Delete/etc.).
 * Use with useAsyncAction: <LoadingOverlay visible={isLoading} />
 */
import React from "react";
import LoadingLogo from "./LoadingLogo.jsx";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9998,
  display: "flex",
  opacity: 0.96,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--app-surface)",
  backdropFilter: "blur(4px)",
};

const wrapStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

export default function LoadingOverlay({ visible, message }) {
  if (!visible) return null;

  return (
    <div style={overlayStyle} role="status" aria-live="polite" aria-label="جاري المعالجة">
      <div style={wrapStyle}>
        <LoadingLogo />
        {message ? (
          <span style={{ fontSize: 14, color: "var(--app-text)", fontWeight: 500 }}>{message}</span>
        ) : null}
      </div>
    </div>
  );
}
