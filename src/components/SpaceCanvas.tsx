// src/components/SpaceCanvas.tsx
import { useEffect, useRef } from "react";

// Tip: keep SpaceManager import dynamic so SSR never touches window
// and so the component works even if SpaceManager accesses DOM at import time.

type Props = {
  id?: string;            // canvas id
  pollMs?: number;        // safety poll interval
  includeSearch?: boolean;// include ?query in path key
  includeHash?: boolean;  // include #hash in path key
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

    (async () => {
      const { SpaceManager } = await import("../scripts/space/manager");
      if (!mounted) return;

      // Initialise renderer/loop
      SpaceManager.init({ canvasId: id });

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
          SpaceManager.loadForPath(p);
          lastPathRef.current = p;
          // console.debug("[SpaceCanvas] sync", tag, p);
        } catch (e) {
          console.error("[SpaceCanvas] loadForPath failed", e);
        }
      };

      // Initial syncs
      queueMicrotask(() => sync("microtask"));
      requestAnimationFrame(() => sync("raf"));

      // Wire up lifecycle + navigation
      onAfterSwap = () => requestAnimationFrame(() => sync("after-swap"));
      onPageLoad = () => requestAnimationFrame(() => sync("page-load"));
      onPopState = () => requestAnimationFrame(() => sync("popstate"));
      onHashChange = () => requestAnimationFrame(() => sync("hashchange"));

      document.addEventListener("astro:after-swap", onAfterSwap);
      document.addEventListener("astro:page-load", onPageLoad);
      window.addEventListener("popstate", onPopState);
      window.addEventListener("hashchange", onHashChange);

      intervalRef.current = window.setInterval(() => sync("poll"), pollMs);
    })();

    return () => {
      mounted = false;
      if (onAfterSwap) document.removeEventListener("astro:after-swap", onAfterSwap);
      if (onPageLoad) document.removeEventListener("astro:page-load", onPageLoad);
      if (onPopState) window.removeEventListener("popstate", onPopState);
      if (onHashChange) window.removeEventListener("hashchange", onHashChange);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [id, includeHash, includeSearch, pollMs]);

  return <canvas id={id} />;
}

/* ------------------------------------------------------------------
Usage in Astro (keeps your transition:persist wrapper):
-------------------------------------------------------------------*/
// src/components/PersistedSpace.astro
// ---
// import SpaceCanvas from "./SpaceCanvas";
// ---
// <div id="space-root" transition:persist="space" class="fixed inset-0">
//   <SpaceCanvas client:load id="webgl-canvas" />
// </div>

/* Optional styles (global or component-scoped):
#space-root { position: fixed; inset: 0; }
#space-root canvas { display:block; width:100%; height:100%; }
*/
