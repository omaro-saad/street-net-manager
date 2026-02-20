import { useEffect, useState } from "react";

const NARROW = 980;
const MOBILE = 640;

export function useResponsive() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    isNarrow: width < NARROW,
    isMobile: width < MOBILE,
    width,
  };
}
