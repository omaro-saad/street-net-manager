export default function EmptyState({ message = "لا توجد بيانات", icon = "📭" }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 40,
        color: "var(--app-text-muted)",
        fontSize: 15,
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div>{message}</div>
    </div>
  );
}
