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
      const [{ SpaceManager }, smoother] = await Promise.all([
        import("../scripts/space/manager"),
        import("../scripts/scroll/smoother"),
      ]);
      if (!mounted) return;

      // 1) Init renderer/loop
      SpaceManager.init({ canvasId: id });

      // 2) Init ScrollSmoother (desktop only), slower scroll
      smoother.initSmoother({
        wrapper: "#wrapper",
        content: "#content",
        smooth: .01,       // raise to 3–4 for even slower
        smoothTouch: 0.2,  // keep phones responsive
        disableBelow: 768, // off on mobile
        effects: true,
      });


        // 👇 add this
        smoother.enableSectionSnapping({
          sectionSelector: ".snap-target",
          duration: 0.4,
          ease: "power5.inOut",
          directional: true,
          thresholds: {
            forward: 0.1,   // snap forward once 18% into next section
            backward: 0.1,  // require ~28% when going back (less jumpy)
          },
        });

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
          SpaceManager.loadForPath(p);
          lastPathRef.current = p;
        } catch (e) {
          console.error("[SpaceCanvas] loadForPath failed", e);
        }
      };

      queueMicrotask(() => sync("microtask"));
      requestAnimationFrame(() => sync("raf"));

      onAfterSwap  = () => requestAnimationFrame(() => { sync("after-swap");  smoother.refreshSmoother?.(); });
      onPageLoad   = () => requestAnimationFrame(() => { sync("page-load");   smoother.refreshSmoother?.(); });
      onPopState   = () => requestAnimationFrame(() => { sync("popstate");    smoother.refreshSmoother?.(); });
      onHashChange = () => requestAnimationFrame(() => { sync("hashchange");  smoother.refreshSmoother?.(); });

      document.addEventListener("astro:after-swap", onAfterSwap);
      document.addEventListener("astro:page-load",  onPageLoad);
      window.addEventListener("popstate", onPopState);
      window.addEventListener("hashchange", onHashChange);

      // If Astro emits before-swap while the island still exists, clean smoother first
      onBeforeSwap = () => smoother.destroySmoother();
      document.addEventListener("astro:before-swap", onBeforeSwap);

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

      // destroy smoother on unmount as a safety
      import("../scripts/scroll/smoother").then(m => m.destroySmoother());
    };
  }, [id, includeHash, includeSearch, pollMs]);

  return <canvas id={id} />;
}
