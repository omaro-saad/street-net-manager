/**
 * Shared layout for list pages: loading state, empty state, or children.
 * Keeps pages light and consistent.
 */
import LoadingLogo from "../LoadingLogo.jsx";
import EmptyState from "./EmptyState.jsx";

const centerWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 200,
  width: "100%",
};

export default function ListPageFrame({
  loading = false,
  empty = false,
  emptyMessage = "لا توجد بيانات",
  emptyIcon = "📭",
  children,
}) {
  if (loading) {
    return (
      <div style={centerWrap}>
        <LoadingLogo />
      </div>
    );
  }
  if (empty) {
    return (
      <div style={centerWrap}>
        <EmptyState message={emptyMessage} icon={emptyIcon} />
      </div>
    );
  }
  return children;
}
