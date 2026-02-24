import { modalOverlay, modalContent } from "../../styles/shared.js";

export default function Modal({ open, onClose, title, children, style }) {
  if (!open) return null;
  return (
    <div
      style={modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      <div style={{ ...modalContent, ...style }} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{title}</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
