import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Observer from "gsap/Observer";
import ScrollToPlugin from "gsap/ScrollToPlugin";
gsap.registerPlugin(ScrollToPlugin, Observer, ScrollTrigger);

// ==== globals / types =================================
declare global {
  interface Window { currentSectionId?: string }
  interface WindowEventMap { sectionchange: CustomEvent<{ id: string }> }
}
export type Disposer = { dispose: () => void };
  const scroller = null; // if case-study uses window, keep null
  ScrollTrigger.defaults({ scroller: scroller || undefined }); // reset to window
// run after a swap when DOM is ready
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

export async function mountCaseStudyUI(): Promise<Disposer> {
  let ctx: gsap.Context | null = null;
  let disposed = false;

  await nextFrame(); // ensure new page DOM exists

  // 1) Kill orphaned triggers from the previous page
  ScrollTrigger.getAll().forEach(st => {
    if (!document.contains(st.trigger as Node)) st.kill(true);
  });

  const ac = new AbortController();
  const { signal } = ac;

  ctx = gsap.context(() => {
    const horizontalSections = gsap.utils.toArray<HTMLElement>("section.horizontal");

    horizontalSections.forEach((sec, i) => {
      const thisPinWrap = sec.querySelector<HTMLElement>(".pin-wrap");
      if (!thisPinWrap) return;
      const thisAnimWrap = thisPinWrap.querySelector<HTMLElement>(".animation-wrap");
      if (!thisAnimWrap) return;

      // Prevent native x scroll from fighting the pin
      thisPinWrap.style.overflowX = "hidden";

      const getDistance = () =>
        Math.max(0, thisAnimWrap.scrollWidth - window.innerWidth);

      gsap.fromTo(
        thisAnimWrap,
        { x: () => (thisAnimWrap.classList.contains("to-right") ? 0 : -getDistance()) },
        {
          x: () => (thisAnimWrap.classList.contains("to-right") ? -getDistance() : 0),
          ease: "none",
          scrollTrigger: {
            trigger: sec,
            start: "top top",
            end: () => "+=" + getDistance(),
            pin: thisPinWrap,
            scrub: true,
            invalidateOnRefresh: true,
            markers: true,
          },
        }
      );
    });
  });

  // 2) Make sure ST recalculates after mount
  ScrollTrigger.refresh();

  return {
    dispose() {
      disposed = true;
      ctx?.revert();     // kills triggers/tweens in this context & clears inline styles
      ac.abort();        // (in case you later add listeners with {signal})
    },
  };
}
