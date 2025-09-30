// src/scroll/smoother.ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { Observer } from "gsap/Observer"; 
gsap.registerPlugin(ScrollTrigger, ScrollSmoother, Observer);

/** Global instances so we can clean up reliably */
let smoother: ScrollSmoother | null = null;
let smootherMM: gsap.MatchMedia | null = null;

let snapTrigger: ScrollTrigger | null = null;
let snapMM: gsap.MatchMedia | null = null;

/** Options for smooth scrolling */
export type SmootherOpts = {
  /** Selector for the viewport wrapper (ScrollSmoother moves #content inside this) */
  wrapper?: string;          // default "#wrapper"
  /** Selector for the content element ScrollSmoother transforms */
  content?: string;          // default "#content"
  /** Desktop smoothing seconds (higher = slower, floatier) */
  smooth?: number;           // default 2.5
  /** Touch smoothing (use something small; 0..0.3 keeps phones responsive) */
  smoothTouch?: number;      // default 0.2
  /** Disable Smoother below this width (px). Ex: 768 = “desktop only” */
  disableBelow?: number;     // default 768
  /** Enable data-speed/data-lag parallax effects */
  effects?: boolean;         // default true
};

/** Initialize ScrollSmoother (desktop-only by default). Safe to call more than once. */
export function initSmoother(opts: SmootherOpts = {}) {
  if (typeof window === "undefined") return;      // SSR guard
  if (smoother) return;                           // already running

  const {
    wrapper = "#wrapper",
    content = "#content",
    smooth = 2.5,
    smoothTouch = 0.2,
    disableBelow = 768,
    effects = true,
  } = opts;

  smootherMM = gsap.matchMedia();
  smootherMM.add(
    {
      desktop: `(min-width: ${disableBelow}px)`,
      reduce: "(prefers-reduced-motion: reduce)",
    },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions as { desktop: boolean; reduce: boolean };
      if (!desktop || reduce) return;

      smoother = ScrollSmoother.create({
        wrapper,
        content,
        smooth,
        smoothTouch,
        effects,
        normalizeScroll: true,
      });

      // cleanup for this media context
      return () => {
        smoother?.kill();
        smoother = null;
      };
    }
  );
}

/** Kill Smoother and snapping (idempotent). */
export function destroySmoother() {
  // kill snapping first (it may rely on smoother’s proxy)
  snapTrigger?.kill();
  snapTrigger = null;
  snapMM?.revert();
  snapMM = null;

  // then kill smoother
  smootherMM?.revert();
  smootherMM = null;
  smoother?.kill();
  smoother = null;
}

/** Ask ScrollTrigger to recompute measurements (use after DOM changes). */
export function refreshSmoother() {
  ScrollTrigger.refresh();
}

/* ────────────────────── Section Snapping (desktop-only) ───────────────────── */

export type SectionSnapOpts = {
  /** Selector for the sections to snap to (each should represent one “screen”) */
  sectionSelector?: string;                // default ".snap-target"
  /** Container element that holds the sections (not critical; for clarity) */
  container?: string;                      // default "#content"
  /** Disable snapping under this width (px) */
  disableBelow?: number;                   // default 768
  /** Snap animation duration (seconds) */
  duration?: number;                       // default 0.6
  /** Snap easing (string) */
  ease?: string;                           // default "power2.out"
  /** Offset in px if you have a fixed header overlapping the top */
  topOffset?: number;
  /** Prefer snapping in the scrolling direction */
  directional?: boolean;               // default true
  /** Thresholds for deciding when to snap forward/back (0..0.5) */
  thresholds?: { forward?: number; backward?: number }; // defaults forward .2, backward .3
};

/**
 * Enable gentle snapping to the nearest section after scroll ends.
 * Safe to call multiple times; previous snap is replaced.
 */
export function enableSectionSnapping(opts: SectionSnapOpts = {}) {
  if (typeof window === "undefined") return;

  const {
    sectionSelector = ".snap-target",
    container = "#content",
    disableBelow = 768,
    duration = 0.9,
    ease = "power5.inOut",
    topOffset = 0,
    directional = true,
    thresholds = { forward: 0.2, backward: 0.3 },   // tweak here
  } = opts;

  snapTrigger?.kill();
  snapTrigger = null;
  snapMM?.revert();
  snapMM = null;

  snapMM = gsap.matchMedia();
  snapMM.add(
    {
      desktop: `(min-width: ${disableBelow}px)`,
      reduce: "(prefers-reduced-motion: reduce)",
    },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions as { desktop: boolean; reduce: boolean };
      if (!desktop || reduce) return;

      const contentEl = document.querySelector<HTMLElement>(container);
      const sections = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector));
      if (!contentEl || sections.length === 0) return;

      // Track last scroll direction with Observer (wheel/touch/scroll)
      let lastDir = 1; // 1 = down/forward, -1 = up/backward

      const obs = Observer.create({
        target: window,
        type: "wheel,touch,scroll", // listen for all input types
        tolerance: 1,
        onChange: (self) => {
          if (self.deltaY > 0) lastDir = 1;
          else if (self.deltaY < 0) lastDir = -1;
        },
        onDown: () => (lastDir = 1),
        onUp:   () => (lastDir = -1),
      });

      // Scroll getters compatible with Smoother or native scroll
      const getScroll = (): number =>
        (ScrollSmoother.get() ? ScrollSmoother.get()!.scrollTop() : window.scrollY) || 0;
      const getMax = () => ScrollTrigger.maxScroll(window) || 1;

      // Build normalized [0..1] snap points
      const computeSnapPoints = () => {
        const maxScroll = getMax();
        const pts = sections
          .map((s) => {
            const top = s.getBoundingClientRect().top + getScroll() - topOffset;
            return Math.min(Math.max(top / maxScroll, 0), 1);
          })
          .sort((a, b) => a - b);
        const out: number[] = [];
        for (let i = 0; i < pts.length; i++) {
          if (i === 0 || Math.abs(pts[i] - pts[i - 1]) > 1e-3) out.push(pts[i]);
        }
        return out;
      };

      let snapPoints = computeSnapPoints();

      snapTrigger = ScrollTrigger.create({
        start: 0,
        end: getMax,
        snap: {
          snapTo: (value: number) => {
            if (!snapPoints.length) snapPoints = computeSnapPoints();

            // find [a,b] around current value
            let i = 0;
            while (i < snapPoints.length - 1 && value > snapPoints[i + 1]) i++;
            const a = snapPoints[Math.max(0, i)];
            const b = snapPoints[Math.min(snapPoints.length - 1, i + 1)];
            if (a === b) return a;

            const t = (value - a) / (b - a); // 0..1 progress between sections
            const thForward  = thresholds.forward  ?? 0.2;
            const thBackward = thresholds.backward ?? 0.3;

            if (lastDir >= 0) {
              return t >= thForward ? b : a;     // scrolling down
            } else {
              return t <= 1 - thBackward ? a : b; // scrolling up
            }
          },
          duration,
          delay: 0,
          ease,
          directional, // additional ScrollTrigger bias
        },
        onRefreshInit: () => {
          snapPoints = computeSnapPoints();
        },
      });

      // keep measurements fresh (no recursive refresh!)
      const onSTRefresh = () => {
        snapPoints = computeSnapPoints();
      };
      const onResize = () => {
        ScrollTrigger.refresh();
      };

      window.addEventListener("resize", onResize);
      ScrollTrigger.addEventListener("refresh", onSTRefresh);

      // cleanup for this media context
      return () => {
        obs?.kill();
        window.removeEventListener("resize", onResize);
        ScrollTrigger.removeEventListener("refresh", onSTRefresh);
        snapTrigger?.kill();
        snapTrigger = null;
      };
    }
  );
}
