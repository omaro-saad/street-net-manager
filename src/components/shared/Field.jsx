export default function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--app-text)",
          }}
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
