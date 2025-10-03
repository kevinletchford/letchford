// src/space/pages/home-ui.ts
import { gsap } from "gsap";
import { ScrollTrigger, Observer, ScrollToPlugin } from "gsap/all";
import { SpaceManager } from "../manager";
gsap.registerPlugin(ScrollToPlugin, Observer, ScrollTrigger);

export function mountHomeUI() {
  let ctx: gsap.Context | null = null;
  let disposed = false;

  // map of sections to camera targets
  const sectionDefs = [
    { sel: "#header",     pos: { x: -20, y: -30, z: 80 } },
    { sel: "#skills",     pos: { x: -20, y: -30, z: 70 } },
    { sel: "#experience", pos: { x: -10, y: -40, z: 70 } },
    { sel: "#education",  pos: { x: -20, y: -30, z: 100 } },
  ];

  SpaceManager.whenReady().then(() => {
    if (disposed) return;
    const camera = SpaceManager.getCamera();

    // If your page scrolls inside #wrapper, tell ScrollTrigger
    const scroller = document.querySelector<HTMLElement>("#wrapper") || undefined;
    if (scroller) ScrollTrigger.defaults({ scroller });

    // --- camera proxy so parallax offsets don't fight section scrubbing ---
    const camProxy = { x: camera.position.x, y: camera.position.y, z: camera.position.z, ox: 0, oy: 0 };
    const applyCam = () => {
      camera.position.set(camProxy.x + camProxy.ox, camProxy.y + camProxy.oy, camProxy.z);
      camera.updateMatrixWorld();
    };

    // pointer parallax (tiny camera offsets that ease nicely)
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
      // tweak these ranges to taste (±2 world units, invert Y for “depthy” feel)
      qOx(map(0, bounds.width,  -1,  1, x));
      qOy(map(0, bounds.height,  0.5, -0.5, y));
    };

    ctx = gsap.context(() => {
      // --- section camera scrub (now tweens camProxy, not camera directly) ---
      sectionDefs.forEach(({ sel, pos }) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return;

        gsap.to(camProxy, {
          ...pos,
          overwrite: "auto",
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: "top center",
            end: "+=400",
            scrub: 4,                  // smooth follow; easing ignored with scrub
            invalidateOnRefresh: true,
            onUpdate: applyCam,        // commit proxy -> real camera
          },
        });
      });

      // --- DOM parallax: any element with data-parallax gets shifted by scroll ---
      // Usage examples:
      //   <img data-parallax data-speed="0.3" />          // vertical parallax
      //   <div data-parallax data-speed-x="0.1" />        // horizontal parallax
      const pEls = gsap.utils.toArray<HTMLElement>("[data-parallax]");
      const setters = pEls.map((el) => ({
        setX: gsap.quickSetter(el, "x", "px"),
        setY: gsap.quickSetter(el, "y", "px"),
        sx: parseFloat(el.dataset.speedX ?? "0"),
        sy: parseFloat(el.dataset.speed ?? el.dataset.speedY ?? "0.3"),
      }));

      ScrollTrigger.create({
        onUpdate(self) {
          const s = self.scroll(); // current scrollTop for the active scroller
          for (const { setX, setY, sx, sy } of setters) {
            if (sx) setX(-s * sx);
            if (sy) setY(-s * sy);
          }
        },
        invalidateOnRefresh: true,
        // scroller is inherited from defaults (if set)
      });

      // do a refresh after layout paints to lock measurements
      requestAnimationFrame(() => ScrollTrigger.refresh());

      // pointer listeners (attach to scroller if present, else window)
      const moveTarget: EventTarget = scroller || window;
      moveTarget.addEventListener("mousemove", onMove, { passive: true });
      addEventListener("resize", updateBounds);

      // ensure camera applies proxy each tick too (in case nothing else updates)
      gsap.ticker.add(applyCam);

      // cleanup listeners when ctx reverts
      gsap.delayedCall(0, () => {
        // store disposers on ctx so revert() removes them
        (ctx as any)._parallaxCleanup = () => {
          moveTarget.removeEventListener("mousemove", onMove as any);
          removeEventListener("resize", updateBounds);
          gsap.ticker.remove(applyCam);
        };
      });
    });
  });

  return {
    dispose() {
      disposed = true;
      // revert animations/triggers
      ctx?.revert();
      // call our extra cleanup if set
      (ctx as any)?._parallaxCleanup?.();
      // stop any remaining camera tweens
      try { gsap.killTweensOf(SpaceManager.getCamera().position); } catch {}
    },
  };
}
