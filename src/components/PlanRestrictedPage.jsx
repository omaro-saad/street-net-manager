// Shown when user tries to open a page not included in their plan (e.g. basic plan opening map via URL).
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ROUTES } from "../config/routes.js";
import { SUPPORT_MAILTO } from "../lib/api.js";
import { theme } from "../theme.js";
import { PLAN_LABELS } from "../constants/plans.js";
import { getTimeRemainingDays } from "../utils/helpers.js";

export default function PlanRestrictedPage({ moduleLabel }) {
  const { user, role, subscription, plan } = useAuth();
  const planName = PLAN_LABELS[subscription?.plan || plan] || subscription?.plan || plan || "—";
  const timeRemainingDays = getTimeRemainingDays(subscription?.endsAt);
  const timeRemainingDisplay = timeRemainingDays != null ? timeRemainingDays : "—";

  const profileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 16,
    maxWidth: 520,
    margin: "0 auto",
  };
  const profileCard = {
    padding: "18px 20px",
    borderRadius: 16,
    background: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  };
  const profileCardLabel = { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" };
  const profileCardValue = { fontSize: 18, fontWeight: 800, color: theme.text };

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        direction: "rtl",
        textAlign: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 28, alignItems: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 }}>
          هذه الصفحة مغلقة لخطتك
        </h2>

        <div style={profileGrid}>
          <div style={profileCard}>
            <div style={profileCardLabel}>اسم المستخدم</div>
            <div style={profileCardValue}>{user?.username ?? "—"}</div>
          </div>
          <div style={profileCard}>
            <div style={profileCardLabel}>الدور</div>
            <div style={profileCardValue}>{role === "oadmin" ? "مدير" : "مستخدم"}</div>
          </div>
          <div style={profileCard}>
            <div style={profileCardLabel}>الخطة</div>
            <div style={profileCardValue}>{planName}</div>
          </div>
          <div style={profileCard}>
            <div style={profileCardLabel}>المتبقي</div>
            <div style={{ ...profileCardValue, color: theme.primary }}>{timeRemainingDisplay}</div>
          </div>
        </div>

        <p style={{ fontSize: 17, fontWeight: 800, color: theme.text, margin: 0, lineHeight: 1.6 }}>
          هذه الصفحة غير متاحة في خطتك الحالية. يرجى الترقية للحصول على الوصول.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <a
            href={SUPPORT_MAILTO}
            style={{
              color: theme.primary,
              fontWeight: 800,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            تواصل مع الدعم للتفاصيل!
          </a>
          <Link
            to={ROUTES.HOME}
            style={{
              color: theme.primary,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
