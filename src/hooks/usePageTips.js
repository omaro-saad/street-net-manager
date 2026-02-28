/**
 * Page tips: show only when this page is not yet seen.
 * Persistence: server (by public_id) + localStorage fallback so tips stay dismissed after refresh.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isApiMode, apiGetTips, apiMarkTipsSeen } from "../lib/api.js";

const STORAGE_KEY = "snm_tips_seen";
const seenPagesThisSession = new Set();

function getStoredSeen() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function setStoredSeen(pageKey) {
  try {
    const prev = getStoredSeen();
    if (prev[pageKey]) return;
    prev[pageKey] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
  } catch {
    // ignore
  }
}

export function usePageTips(pageKey) {
  const navigate = useNavigate();
  const { token, isLoggedIn } = useAuth();
  const [tipsChecked, setTipsChecked] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!pageKey || !isLoggedIn || tipsChecked) return;
    const stored = getStoredSeen();
    if (stored[pageKey]) {
      setTipsChecked(true);
      setShowTips(false);
      return;
    }
    if (seenPagesThisSession.has(pageKey)) {
      setTipsChecked(true);
      setShowTips(false);
      return;
    }
    if (!isApiMode() || !token) {
      setTipsChecked(true);
      setShowTips(false);
      return;
    }
    apiGetTips(token)
      .then((res) => {
        setTipsChecked(true);
        if (res.tips && typeof res.tips === "object") {
          for (const k of Object.keys(res.tips)) {
            if (res.tips[k] === true) {
              seenPagesThisSession.add(k);
              try {
                const prev = getStoredSeen();
                prev[k] = true;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
              } catch {}
            }
          }
        }
        if (getStoredSeen()[pageKey] || seenPagesThisSession.has(pageKey) || dismissedRef.current) {
          setShowTips(false);
          return;
        }
        if (!res.ok) {
          setShowTips(false);
          return;
        }
        setShowTips(true);
      })
      .catch(() => {
        setTipsChecked(true);
        setShowTips(false);
      });
  }, [pageKey, token, isLoggedIn, tipsChecked]);

  const handleTipsDone = async () => {
    if (pageKey) {
      seenPagesThisSession.add(pageKey);
      setStoredSeen(pageKey);
      dismissedRef.current = true;
    }
    setShowTips(false);
    if (isApiMode() && token && pageKey) {
      try {
        await apiMarkTipsSeen(token, pageKey);
      } catch {
        // localStorage already has it; will not show again after refresh
      }
    }
  };

  const handleTipsLinkClick = (path) => {
    handleTipsDone();
    navigate(path);
  };

  return { showTips, handleTipsDone, handleTipsLinkClick };
}
