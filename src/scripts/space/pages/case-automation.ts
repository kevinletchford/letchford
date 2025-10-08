// /src/ui/case-study-mount.ts
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Observer from "gsap/Observer";
import ScrollToPlugin from "gsap/ScrollToPlugin";

type Disposer = { dispose(): void };

const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

// Safe to call multiple times; GSAP ignores duplicate registrations
function registerPlugins() {
  gsap.registerPlugin(ScrollTrigger, Observer, ScrollToPlugin);
  // IMPORTANT: if another page set a custom scroller default, reset it here:
  ScrollTrigger.defaults({ scroller: undefined });
}

function buildCaseStudyTriggers(): Disposer {
  const ctx = gsap.context(() => {
    const sections = gsap.utils.toArray<HTMLElement>("section.horizontal");

    sections.forEach((sec, i) => {
      const pinWrap  = sec.querySelector<HTMLElement>(".pin-wrap");
      const animWrap = pinWrap?.querySelector<HTMLElement>(".animation-wrap");
      if (!pinWrap || !animWrap) return;

      pinWrap.style.overflowX = "hidden";

      const distance = () => Math.max(0, animWrap.scrollWidth - window.innerWidth);

      gsap.fromTo(
        animWrap,
        { x: () => (animWrap.classList.contains("to-right") ? 0 : -distance()) },
        {
          x: () => (animWrap.classList.contains("to-right") ? -distance() : 0),
          ease: "none",
          scrollTrigger: {
            id: `horiz-${i}`,
            trigger: sec,
            start: "top top",
            end: () => "+=" + distance(),
            pin: pinWrap,
            scrub: true,
            invalidateOnRefresh: true,
            // markers: true,
          },
        }
      );
    });
  });

  // Build done — ensure ST measures with current DOM
  ScrollTrigger.refresh();

  return {
    dispose() {
      ctx.revert(); // kills triggers/tweens created in this context & clears inline styles
    },
  };
}

// ------- Astro wiring (create per page, kill before swap) -------
let disposer: Disposer | null = null;

async function mount() {
  await nextFrame();
  registerPlugins();

  // Clean up any orphaned triggers from previous pages (defensive)
  ScrollTrigger.getAll().forEach(st => {
    if (!document.contains(st.trigger as Node)) st.kill(true);
  });

  disposer?.dispose();
  disposer = buildCaseStudyTriggers();
}

function beforeSwap() {
  // Kill your triggers cleanly
  disposer?.dispose();
  disposer = null;

  // Extra safety: remove any leftover global ST state
  ScrollTrigger.killAll(true);
  gsap.globalTimeline.clear();

  // If a router previously removed triggers mid-pin, unwrap orphans
  document.querySelectorAll<HTMLElement>(".pin-spacer").forEach(spacer => {
    const child = spacer.firstElementChild as HTMLElement | null;
    if (child) spacer.parentElement?.insertBefore(child, spacer);
    spacer.remove();
  });
}

// First page and subsequent swaps
addEventListener("astro:page-load", mount);
addEventListener("astro:before-swap", beforeSwap);
addEventListener("astro:after-swap", mount);
