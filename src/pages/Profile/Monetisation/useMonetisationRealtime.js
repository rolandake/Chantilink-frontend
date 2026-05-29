import { useEffect, useRef } from "react";

export const MONETISATION_REFRESH_EVENT = "monetisation:refresh";

export const emitMonetisationRefresh = (scope = "all") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MONETISATION_REFRESH_EVENT, { detail: { scope } }));
};

export default function useMonetisationRealtime(refresh, scope = "all", intervalMs = 30000) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    let disposed = false;
    const run = () => {
      if (disposed || document.visibilityState === "hidden") return;
      refreshRef.current?.({ background: true });
    };

    const onRefresh = (event) => {
      const eventScope = event.detail?.scope || "all";
      if (eventScope === "all" || eventScope === scope) run();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    const interval = intervalMs > 0 ? window.setInterval(run, intervalMs) : null;
    window.addEventListener(MONETISATION_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (interval) window.clearInterval(interval);
      window.removeEventListener(MONETISATION_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scope, intervalMs]);
}
