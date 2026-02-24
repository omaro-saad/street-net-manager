/**
 * Global in-app alert: read-only, plan limit, validation, error, success.
 * Centered, responsive, matches app theme. Optional support link.
 */
import { theme } from "../theme.js";
import { SUPPORT_WHATSAPP_URL } from "../lib/api.js";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  minHeight: "100vh",
  minWidth: "100vw",
  background: "rgba(17, 24, 39, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  boxSizing: "border-box",
};

const cardStyle = {
  width: "min(440px, 100%)",
  maxWidth: "96vw",
  background: theme.surface,
  borderRadius: theme.borderRadius,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.shadowMd,
  padding: "24px 22px",
  direction: "rtl",
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const titleStyle = {
  fontSize: "clamp(16px, 4vw, 18px)",
  fontWeight: 900,
  color: theme.text,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const messageStyle = {
  fontSize: "clamp(14px, 3.5vw, 15px)",
  lineHeight: 1.7,
  color: theme.textMuted,
  margin: 0,
};

const fieldLabelStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: theme.primary,
  marginBottom: 4,
};

const linkStyle = {
  color: theme.primary,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 2,
  transition: "opacity 0.15s ease",
};

const TITLES = {
  readOnly: "وضع القراءة فقط",
  planLimit: "تم الوصول لحد الخطة",
  validation: "حقل مطلوب أو خطأ في الإدخال",
  error: "حدث خطأ",
  success: "تم",
  confirm: "تأكيد",
};

const DEFAULT_MESSAGES = {
  readOnly: "أنت في وضع القراءة فقط في هذه الصفحة. تواصل مع المسؤول لإجراء التغييرات.",
  planLimit: "لقد وصلت لحد الخطة الحالية. يرجى الترقية لزيادة الحدود أو تفعيل ميزات إضافية.",
  validation: "",
  error: "حدث خطأ غير متوقع.",
  success: "تمت العملية بنجاح.",
  confirm: "هل أنت متأكد؟",
};

const ICONS = { readOnly: "🔒", planLimit: "📊", validation: "✏️", error: "⚠️", success: "✅", confirm: "⚠️" };

function okButtonBg(variant) {
  if (variant === "error") return theme.error;
  if (variant === "success") return theme.success;
  return theme.primary;
}

const buttonBase = {
  border: "none",
  padding: "12px 24px",
  borderRadius: 999,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
  marginTop: 4,
};

export default function InAppAlert({ open, variant, message, fieldName, confirmLabel = "حذف", onClose, onConfirm }) {
  if (!open || !variant) return null;

  const title = TITLES[variant] || TITLES.error;
  const displayMessage = message || DEFAULT_MESSAGES[variant] || "";
  const showSupportLink =
    variant === "readOnly" || variant === "planLimit" || variant === "error";
  const isConfirm = variant === "confirm";

  return (
    <div
      style={overlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inapp-alert-title"
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 id="inapp-alert-title" style={titleStyle}>
          <span aria-hidden="true">{ICONS[variant] || "ℹ️"}</span>
          {variant === "validation" && fieldName ? `الحقل المطلوب: ${fieldName}` : title}
        </h2>
        {(displayMessage || (variant === "validation" && fieldName)) && (
          <div>
            {variant === "validation" && fieldName && (
              <div style={fieldLabelStyle}>الحقل: {fieldName}</div>
            )}
            <p style={messageStyle}>{displayMessage}</p>
          </div>
        )}
        {showSupportLink && (
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            تواصل مع فريق الدعم
          </a>
        )}
        <div style={{ display: "flex", gap: 12, flexDirection: "row-reverse", alignSelf: "flex-end", marginTop: 4 }}>
          {isConfirm && onConfirm ? (
            <>
              <button
                type="button"
                style={{ ...buttonBase, background: theme.error, color: "#fff" }}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
              <button
                type="button"
                style={{ ...buttonBase, background: theme.border, color: theme.text }}
                onClick={onClose}
              >
                إلغاء
              </button>
            </>
          ) : (
            <button
              type="button"
              style={{ ...buttonBase, background: okButtonBg(variant), color: "#fff" }}
              onClick={onClose}
            >
              موافق
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
