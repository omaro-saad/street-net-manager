// src/components/BottomNav.jsx
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../config/routes.js";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function BottomNav() {
  const { canAccess } = useAuth();
  const items = NAV_ITEMS.filter((item) => item.moduleKey == null || canAccess(item.moduleKey));

  return (
    <>
      <style>{`
        .bn-scroll::-webkit-scrollbar { height: 0px; }
        .bn-scroll { scrollbar-width: none; -ms-overflow-style: none; }

        /* على الشاشات الواسعة: ما في سحب، توزيع طبيعي */
        @media (min-width: 900px) {
          .bn-scroll { overflow-x: hidden !important; justify-content: space-between !important; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          bottom: 26,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        <nav
          className="bn-scroll bn-nav"
          style={{
            direction: "rtl",
            backgroundColor: "var(--app-surface)",
            borderRadius: 20,
            boxShadow: "var(--app-shadow-md)",
            padding: "6px 10px",
            maxWidth: 860,
            width: "calc(100% - 40px)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "auto",
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            justifyContent: "flex-start",
          }}
        >
          {items.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>
    </>
  );
}

function NavItem({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="bn-link"
      style={({ isActive }) => ({
        flex: "0 0 auto",
        minWidth: 70,
        textDecoration: "none",
        color: isActive ? "var(--app-primary)" : "var(--app-text-muted)",
        fontSize: 11.5,
        textAlign: "center",
        padding: "6px 8px 4px",
        borderRadius: 14,
        scrollSnapAlign: "center",
        transition: "background 0.2s ease, color 0.2s ease",
        background: isActive ? "rgba(124,58,237,0.18)" : "transparent",
      })}
    >
      {({ isActive }) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, lineHeight: 1 }}>
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span style={{ whiteSpace: "nowrap", fontWeight: isActive ? 900 : 800, fontSize: 11 }}>
            {label}
          </span>
          <span
            style={{
              marginTop: 4,
              height: 3,
              width: isActive ? 20 : 0,
              borderRadius: 999,
              backgroundColor: "var(--app-primary)",
              transition: "width 0.22s ease-out, opacity 0.22s ease-out",
              opacity: isActive ? 1 : 0,
            }}
          />
        </div>
      )}
    </NavLink>
  );
}
 
