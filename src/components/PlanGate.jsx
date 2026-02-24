// PlanGate: show children only if user can access module; otherwise show plan-restricted page.
import { useAuth } from "../contexts/AuthContext.jsx";
import PlanRestrictedPage from "./PlanRestrictedPage.jsx";

export default function PlanGate({ moduleKey, children }) {
  const { canAccess } = useAuth();
  if (!moduleKey || canAccess(moduleKey)) return children;
  return <PlanRestrictedPage moduleLabel={moduleKey} />;
}
