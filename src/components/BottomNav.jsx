// src/components/BottomNav.jsx
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "الرئيسية", icon: "🏠", end: true },
  { to: "/subscribers", label: "المشتركين", icon: "👥" },
  { to: "/distributors", label: "الموزعين", icon: "🚚" },
  { to: "/plans", label: "خطوط الشبكة", icon: "📶" },
  // ✅ نخلي الخريطة بالنص (مركز)
  { to: "/map", label: "الخريطة", icon: "🗺️", isMap: true },
  { to: "/packages", label: "الحزم", icon: "📦" },
  { to: "/devices", label: "الاجهزة", icon: "🖧" },
  { to: "/employee", label: "الموظفين", icon: "🧑‍💼" },
  { to: "/finance", label: "المالية", icon: "💰" },
  { to: "/settings", label: "الاعدادات", icon: "⚙️" },

];

export default function BottomNav() {
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
          // ✅ رفع 10px لفوق (كان 16)
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
          className="bn-scroll"
          style={{
            direction: "rtl",
            backgroundColor: "#ffffff",
            borderRadius: 20, // ✅ أصغر شوي
            boxShadow: "0 8px 22px rgba(0,0,0,0.10)",
            padding: "6px 10px", // ✅ أصغر
            maxWidth: 860, // ✅ أصغر شوي
            width: "calc(100% - 40px)", // ✅ أقل عرض
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "auto",

            // ✅ Responsive: سحب أفقي عند الضيق
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",

            justifyContent: "flex-start",
          }}
        >
          {navItems.map((item) =>
            item.isMap ? <NavItem key={item.to} {...item} /> : <NavItem key={item.to} {...item} />
          )}
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
      style={({ isActive }) => ({
        flex: "0 0 auto",
        // ✅ أصغر شوي
        minWidth: 70,
        textDecoration: "none",
        color: isActive ? "#7c3aed" : "#6b7280",
        fontSize: 11.5,
        textAlign: "center",
        padding: "6px 8px 4px",
        borderRadius: 14,
        scrollSnapAlign: "center",
        transition: "background 0.2s ease, color 0.2s ease",
        background: isActive ? "rgba(168,85,247,0.10)" : "transparent",
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
              backgroundColor: "#a855f7",
              transition: "width 0.22s ease-out, opacity 0.22s ease-out",
              opacity: isActive ? 1 : 0,
            }}
          />
        </div>
      )}
    </NavLink>
  );
}
 
