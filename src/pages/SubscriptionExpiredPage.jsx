// Shown when subscription is expired. User cannot access any app page; only allowed navigation is to Login.
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../config/routes.js";
import { theme } from "../theme.js";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "../lib/api.js";
import { btnPrimary, btnOutline } from "../styles/shared.js";

const SUBSCRIPTION_EXPIRED_FLAG = "subscription_expired_shown";

const PLAN_LABELS = { basic: "أساسي", plus: "بلس", pro: "برو" };
const DURATION_LABELS = { monthly: "شهري", "3months": "٣ أشهر", yearly: "سنوي" };

const iconSize = 22;
const ICON_USER = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const ICON_SHIELD = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const ICON_DOC = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);
const ICON_CLOCK = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

// Same grid/card style as SettingsPage profile cards (lines 539–570)
const infoCardsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 16,
};
const profileCard = {
  padding: "18px 20px",
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  boxShadow: theme.shadowMd,
};
const profileCardIconWrap = { width: 28, height: 28, color: theme.textMuted, marginBottom: 4 };
const profileCardLabel = { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" };
const profileCardValue = { fontSize: 18, fontWeight: 800, color: theme.text };
const profileCardMeta = { fontSize: 12, color: theme.textMuted };

const pageRoot = {
  position: "fixed",
  inset: 0,
  minHeight: "100vh",
  overflowY: "auto",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch",
  background: `linear-gradient(160deg, ${theme.bg} 0%, ${theme.surface} 50%)`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "48px 24px 48px 24px",
  boxSizing: "border-box",
};
const wrap = {
  width: "100%",
  maxWidth: 520,
  flexShrink: 0,
  direction: "rtl",
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  alignItems: "stretch",
};
const titleBox = {
  padding: 20,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.shadowMd,
};
const title = { fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 };
const messageBox = {
  padding: 20,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.error}`,
  color: theme.text,
  fontSize: 15,
  lineHeight: 1.6,
};
const buttonRow = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "100%",
};

export default function SubscriptionExpiredPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const payload = location.state?.subscriptionExpired ?? null;
  const user = payload?.user ?? null;
  const org = payload?.org ?? null;
  const subscription = payload?.subscription ?? null;

  const goToLogin = () => {
    try {
      sessionStorage.removeItem(SUBSCRIPTION_EXPIRED_FLAG);
    } catch {}
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div style={pageRoot}>
      <div style={wrap}>
        <div style={titleBox}>
          <h1 style={{ ...title, color: theme.error, marginBottom: 4 }}>انتهى الاشتراك</h1>
          <p style={{ fontSize: 14, color: theme.textMuted, margin: 0 }}>
            لا يمكنك استخدام التطبيق حتى يتم تجديد الاشتراك. جميع بياناتك محفوظة. للعودة إلى تسجيل الدخول (بعد التجديد) استخدم الزر أدناه.
          </p>
        </div>

        {user && (
          <div style={infoCardsRow}>
            <div style={profileCard}>
              <div style={profileCardIconWrap}>{ICON_USER}</div>
              <div style={profileCardLabel}>الحساب</div>
              <div style={profileCardValue}>{user.username ?? "—"}</div>
              <div style={profileCardMeta}>اسم المستخدم</div>
            </div>
            <div style={profileCard}>
              <div style={profileCardIconWrap}>{ICON_SHIELD}</div>
              <div style={profileCardLabel}>الدور</div>
              <div style={profileCardValue}>{user.role === "oadmin" ? "مدير" : "مستخدم"}</div>
              <div style={profileCardMeta}>{user.role === "oadmin" ? "Admin" : "User"}</div>
            </div>
            <div style={profileCard}>
              <div style={profileCardIconWrap}>{ICON_DOC}</div>
              <div style={profileCardLabel}>الاشتراك</div>
              <div style={profileCardValue}>
                {subscription ? (PLAN_LABELS[subscription.plan] ?? subscription.plan) : "—"}
              </div>
              <div style={profileCardMeta}>
                {subscription ? (DURATION_LABELS[subscription.duration] ?? subscription.duration) : "—"}
              </div>
            </div>
            <div style={profileCard}>
              <div style={profileCardIconWrap}>{ICON_CLOCK}</div>
              <div style={profileCardLabel}>المتبقي</div>
              <div style={{ ...profileCardValue, color: theme.error }}>منتهي</div>
              <div style={profileCardMeta}>0 يوم — تجديد الاشتراك</div>
            </div>
          </div>
        )}

        {!user && (
          <div style={messageBox}>
            <p style={{ margin: 0 }}>
              انتهت مدة الاشتراك. جميع بياناتك محفوظة. يرجى التواصل مع الدعم الفني لتجديد الاشتراك.
            </p>
          </div>
        )}

        {user && (
          <div style={messageBox}>
            <p style={{ margin: 0 }}>
              يرجى التواصل مع الدعم الفني لتجديد الاشتراك. يمكنك استخدام الزر أدناه أو إرسال بريد إلى:
            </p>
            <a href={SUPPORT_MAILTO} style={{ color: theme.primary, fontWeight: 700, marginTop: 8, display: "inline-block" }}>
              {SUPPORT_EMAIL}
            </a>
          </div>
        )}

        <div style={buttonRow}>
          <button
            type="button"
            style={{ ...btnPrimary, width: "100%", padding: "14px 16px", fontSize: 15 }}
            onClick={goToLogin}
          >
            العودة إلى تسجيل الدخول
          </button>
          <a
            href={SUPPORT_MAILTO}
            style={{
              ...btnOutline,
              width: "100%",
              padding: "14px 16px",
              fontSize: 15,
              textAlign: "center",
              textDecoration: "none",
              color: theme.text,
              boxSizing: "border-box",
            }}
          >
            تواصل مع الدعم
          </a>
        </div>
      </div>
    </div>
  );
}
