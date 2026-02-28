/**
 * Page tips linked to first login: show only until user has dismissed tips once, then never again.
 * If onboardingDone (user saw tips before), never show. Else show for this page if not yet seen.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isApiMode, apiGetTips, apiMarkTipsSeen } from "../lib/api.js";

export function usePageTips(pageKey) {
  const navigate = useNavigate();
  const { token, isLoggedIn } = useAuth();
  const [tipsChecked, setTipsChecked] = useState(false);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    if (!pageKey || !isApiMode() || !token || !isLoggedIn || tipsChecked) return;
    apiGetTips(token)
      .then((res) => {
        setTipsChecked(true);
        if (!res.ok) return;
        if (res.onboardingDone) {
          setShowTips(false);
          return;
        }
        if (!res.tips[pageKey]) setShowTips(true);
      })
      .catch(() => {
        setTipsChecked(true);
        setShowTips(false);
      });
  }, [pageKey, token, isLoggedIn, tipsChecked]);

  const handleTipsDone = () => {
    if (isApiMode() && token && pageKey) {
      apiMarkTipsSeen(token, pageKey).catch(() => {});
    }
    setShowTips(false);
  };

  const handleTipsLinkClick = (path) => {
    handleTipsDone();
    navigate(path);
  };

  return { showTips, handleTipsDone, handleTipsLinkClick };
}
