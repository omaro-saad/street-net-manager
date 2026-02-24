/**
 * Banner shown at top of a page when user is in read-only mode for that module.
 * Makes it clear that add/edit/delete are not allowed.
 */
import { theme } from "../theme.js";

const bannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px",
  background: "var(--app-surface-alt)",
  border: `1px solid ${theme.warning}`,
  borderRadius: 12,
  marginBottom: 16,
  direction: "rtl",
  fontSize: 14,
  fontWeight: 700,
  color: theme.warning,
};

export default function ReadOnlyBanner() {
  return (
    <div style={bannerStyle} role="status" aria-live="polite">
      <span aria-hidden="true">🔒</span>
      <span>أنت في وضع القراءة فقط في هذه الصفحة. لا يمكنك الإضافة أو التعديل أو الحذف. تواصل مع المسؤول لطلب الصلاحيات.</span>
    </div>
  );
}
