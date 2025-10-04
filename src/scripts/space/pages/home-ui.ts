// src/space/pages/home-ui.ts
import { gsap } from "gsap";
import { ScrollTrigger, Observer, ScrollToPlugin } from "gsap/all";
import { SpaceManager } from "../manager";
gsap.registerPlugin(ScrollToPlugin, Observer, ScrollTrigger);

export function mountHomeUI() {
  let ctx: gsap.Context | null = null;
  let disposed = false;
  let uiCleanup: (() => void) | null = null; // <-- store cleanup here (not on ctx)

  // map of sections to camera targets (keys match data-nav-item)
  const sectionDefs = [
    { key: "header",     sel: "#header",     pos: { x: -20, y: -30, z: 80 } },
    { key: "skills",     sel: "#skills",     pos: { x: -20, y: -30, z: 70 } },
    { key: "experience", sel: "#experience", pos: { x: -10, y: -40, z: 70 } },
    { key: "education",  sel: "#education",  pos: { x: -20, y: -30, z: 100 } },
  ] as const;

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  SpaceManager.whenReady().then(() => {
    if (disposed) return;

    const camera = SpaceManager.getCamera();
    const scroller = document.querySelector<HTMLElement>("#wrapper") || undefined;
    if (scroller) ScrollTrigger.defaults({ scroller });

    // ---- UI elements ----
    const prevBtn = document.querySelector<HTMLButtonElement>(".previous-section");
    const nextBtn = document.querySelector<HTMLButtonElement>(".next-section");
    const navMap = new Map<string, HTMLElement>();
    sectionDefs.forEach(({ key }) => {
      const el = document.querySelector<HTMLElement>(`[data-nav-item="${key}"]`);
      if (el) navMap.set(key, el);
    });

    let currentIndex = 0;
    const setActiveDot = (idx: number) => {
      sectionDefs.forEach(({ key }, i) => {
        const dot = navMap.get(key);
        if (!dot) return;
        dot.classList.toggle("dot_active", i === idx);
      });
    };
    const updateButtons = (idx: number) => {
      const atStart = idx <= 0;
      const atEnd = idx >= sectionDefs.length - 1;
      if (prevBtn) {
        prevBtn.toggleAttribute("disabled", atStart);
        prevBtn.setAttribute("aria-disabled", String(atStart));
        prevBtn.classList.toggle("is-disabled", atStart);
      }
      if (nextBtn) {
        nextBtn.toggleAttribute("disabled", atEnd);
        nextBtn.setAttribute("aria-disabled", String(atEnd));
        nextBtn.classList.toggle("is-disabled", atEnd);
      }
    };
    const scrollToIndex = (idx: number) => {
      idx = clamp(idx, 0, sectionDefs.length - 1);
      const target = document.querySelector<HTMLElement>(sectionDefs[idx].sel);
      if (!target) return;
      gsap.to(scroller || window, {
        duration: 0.8,
        ease: "power2.out",
        scrollTo: { y: target, autoKill: true },
        onComplete: () => {
          currentIndex = idx;
          setActiveDot(idx);
          updateButtons(idx);
        },
      });
    };
    const getNearestIndex = () => {
      const top = scroller
        ? scroller.scrollTop
        : (window.pageYOffset || document.documentElement.scrollTop || 0);
      const viewportH = scroller ? scroller.clientHeight : window.innerHeight;

      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < sectionDefs.length; i++) {
        const el = document.querySelector<HTMLElement>(sectionDefs[i].sel);
        if (!el) continue;
        const elTop = scroller
          ? el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
          : el.getBoundingClientRect().top + top;
        const dist = Math.abs(elTop - (top + viewportH / 2));
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      return bestIdx;
    };

    // --- camera proxy (tracks scroll instantly) + camera follow smoothing ---
    const camProxy = { x: camera.position.x, y: camera.position.y, z: camera.position.z, ox: 0, oy: 0 };

    // Smooth-follow tweeners for the REAL camera (tweens between last and next)
    const qCamX = gsap.quickTo(camera.position, "x", { duration: 0.22, ease: "power3.out" });
    const qCamY = gsap.quickTo(camera.position, "y", { duration: 0.22, ease: "power3.out" });
    const qCamZ = gsap.quickTo(camera.position, "z", { duration: 0.32, ease: "power3.out" });

    const updateCamera = () => {
      qCamX(camProxy.x + camProxy.ox);
      qCamY(camProxy.y + camProxy.oy);
      qCamZ(camProxy.z);
      camera.updateMatrixWorld();
    };

    // pointer parallax (tiny camera offsets)
    const qOx = gsap.quickTo(camProxy, "ox", { duration: 4, ease: "power3.out" });
    const qOy = gsap.quickTo(camProxy, "oy", { duration: 4, ease: "power3.out" });
    const getBounds = () =>
      (scroller as HTMLElement)?.getBoundingClientRect?.() ?? new DOMRect(0, 0, innerWidth, innerHeight);
    let bounds = getBounds();
    const updateBounds = () => (bounds = getBounds());
    const map = gsap.utils.mapRange;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      qOx(map(0, bounds.width, -1, 1, x));
      qOy(map(0, bounds.height, 0.5, -0.5, y));
    };

    // ================ GSAP context ================
    ctx = gsap.context(() => {
      // Camera follows the proxy every frame (smoothly)
      gsap.ticker.add(updateCamera);

      // Section camera mapping (proxy follows scroll instantly; no baked-in lag)
      sectionDefs.forEach(({ sel, pos }, i) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return;
        const nextSel = sectionDefs[i + 1]?.sel;
        const nextEl = nextSel ? document.querySelector<HTMLElement>(nextSel) : null;

        gsap.to(camProxy, {
          ...pos,
          overwrite: "auto",
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: "top center",
            endTrigger: nextEl || undefined,         // reduce overlap/fighting
            end: nextEl ? "top center" : "bottom center",
            scrub: true,                              // proxy tracks scroll instantly
            invalidateOnRefresh: true,
            toggleClass: { targets: el, className: "is-active" },
            // markers: true,
          },
        });
      });

      // 🔭 GLOBAL WATCHER: keep nav state in sync at ALL scroll positions
      ScrollTrigger.create({
        scroller: scroller || undefined,
        start: 0,
        end: () => ScrollTrigger.maxScroll(scroller || window),
        onUpdate: () => {
          const idx = getNearestIndex();
          if (idx !== currentIndex) {
            currentIndex = idx;
            setActiveDot(idx);
            updateButtons(idx);
          }
        },
      });

      // DOM parallax elements
      const pEls = gsap.utils.toArray<HTMLElement>("[data-parallax]");
      const setters = pEls.map((el) => ({
        setX: gsap.quickSetter(el, "x", "px"),
        setY: gsap.quickSetter(el, "y", "px"),
        sx: parseFloat(el.dataset.speedX ?? "0"),
        sy: parseFloat(el.dataset.speed ?? el.dataset.speedY ?? "0.3"),
      }));
      ScrollTrigger.create({
        onUpdate(self) {
          const s = self.scroll();
          for (const { setX, setY, sx, sy } of setters) {
            if (sx) setX(-s * sx);
            if (sy) setY(-s * sy);
          }
        },
        invalidateOnRefresh: true,
      });

      // initial sync after layout
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        const idx = getNearestIndex();
        currentIndex = idx;
        setActiveDot(idx);
        updateButtons(idx);
      });

      // pointer listeners
      const moveTarget: EventTarget = scroller || window;
      const onPrev = (e?: Event) => { e?.preventDefault(); scrollToIndex(currentIndex - 1); };
      const onNext = (e?: Event) => { e?.preventDefault(); scrollToIndex(currentIndex + 1); };

      moveTarget.addEventListener("mousemove", onMove, { passive: true });
      addEventListener("resize", updateBounds);
      prevBtn?.addEventListener("click", onPrev);
      nextBtn?.addEventListener("click", onNext);

      // nav dot handlers (store them so we can remove cleanly)
      const dotHandlers = new Map<HTMLElement, (e: Event) => void>();
      navMap.forEach((el, key) => {
        const handler = (e: Event) => {
          e.preventDefault();
          const idx = sectionDefs.findIndex((d) => d.key === key);
          if (idx >= 0) scrollToIndex(idx);
        };
        dotHandlers.set(el, handler);
        el.addEventListener("click", handler);
      });

      // ---- pack cleanup (no refs to ctx here) ----
      uiCleanup = () => {
        (moveTarget as any).removeEventListener?.("mousemove", onMove as any);
        removeEventListener("resize", updateBounds);
        gsap.ticker.remove(updateCamera);
        prevBtn?.removeEventListener("click", onPrev);
        nextBtn?.removeEventListener("click", onNext);
        dotHandlers.forEach((handler, el) => el.removeEventListener("click", handler));
      };
    });
  });

  return {
    dispose() {
      disposed = true;
      // kill GSAP-created stuff (tweens, ScrollTriggers)
      ctx?.revert();
      // remove our DOM/ticker listeners
      uiCleanup?.();
      // stop any remaining camera tweens (paranoia)
      try { gsap.killTweensOf(SpaceManager.getCamera().position); } catch {}
    },
  };
}
