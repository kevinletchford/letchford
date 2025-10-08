// src/components/SpaceCanvas.tsx
import { useEffect, useRef } from "react";

type Props = {
  id?: string;
  pollMs?: number;
  includeSearch?: boolean;
  includeHash?: boolean;
};

export default function SpaceCanvas({
  id = "webgl-canvas",
  pollMs = 500,
  includeSearch = false,
  includeHash = false,
}: Props) {
  const bootedRef = useRef(false);
  const lastPathRef = useRef<string>("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    if (bootedRef.current) return;
    bootedRef.current = true;

    let onAfterSwap: (() => void) | undefined;
    let onPageLoad: (() => void) | undefined;
    let onPopState: (() => void) | undefined;
    let onHashChange: (() => void) | undefined;
    let onBeforeSwap: (() => void) | undefined;

    (async () => {

      if (!mounted) return;

      // 1) Init renderer/loop
      window.SpaceManager.init({ canvasId: id });

      // 3) Routing sync
      const path = () => {
        let p = location.pathname;
        if (includeSearch) p += location.search;
        if (includeHash) p += location.hash;
        return p.replace(/\/+/, "/");
      };

      const sync = (tag = "") => {
        const p = path();
        if (p === lastPathRef.current) return;
        try {
          window.SpaceManager.loadForPath(p);
          lastPathRef.current = p;
        } catch (e) {
          console.error("[SpaceCanvas] loadForPath failed", e);
        }
      };

      queueMicrotask(() => sync("microtask"));
      requestAnimationFrame(() => sync("raf"));

      onAfterSwap  = () => requestAnimationFrame(() => { sync("after-swap"); });
      onPageLoad   = () => requestAnimationFrame(() => { sync("page-load");  });
      onPopState   = () => requestAnimationFrame(() => { sync("popstate");   });
      onHashChange = () => requestAnimationFrame(() => { sync("hashchange"); });

      document.addEventListener("astro:after-swap", onAfterSwap);
      document.addEventListener("astro:page-load",  onPageLoad);
      window.addEventListener("popstate", onPopState);
      window.addEventListener("hashchange", onHashChange);

      intervalRef.current = window.setInterval(() => sync("poll"), pollMs);
    })();

    return () => {
      mounted = false;
      // listeners
      if (onAfterSwap)  document.removeEventListener("astro:after-swap", onAfterSwap);
      if (onPageLoad)   document.removeEventListener("astro:page-load",  onPageLoad);
      if (onPopState)   window.removeEventListener("popstate", onPopState);
      if (onHashChange) window.removeEventListener("hashchange", onHashChange);
      if (onBeforeSwap) document.removeEventListener("astro:before-swap", onBeforeSwap);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [id, includeHash, includeSearch, pollMs]);

  return <canvas id={id} />;
}
