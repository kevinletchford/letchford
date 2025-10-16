import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollToPlugin, Observer, ScrollTrigger);

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

export function initSectionPaging() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("article > section"));
  if (!sections.length) return;

  // Make each section fill the viewport (svh avoids mobile address-bar jumps)
  sections.forEach(s => s.style.minHeight = "100svh");

  // Entrance animations (no snap here)
  sections.forEach((section) => {
    const elems = section.querySelectorAll<HTMLElement>("h1,h2,h3,p,ul,li,a");
    gsap.set(elems, { opacity: 0, y: 24 });
    ScrollTrigger.create({
      trigger: section,
      start: "top 70%",
      onEnter: () => gsap.to(elems, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.05 }),
      onEnterBack: () => gsap.to(elems, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.04 }),
    });
  });

  let index = 0;
  let animating = false;

  function scrollToIndex(i: number) {
    if (animating) return;
    index = clamp(i, 0, sections.length - 1);
    animating = true;
    const y = sections[index].offsetTop;
    gsap.to(window, {
      scrollTo: { y, autoKill: true },
      duration: 0.6,
      ease: "power2.out",
      onComplete: () => { animating = false; }
    });
  }

  // Keep index in sync when user jumps (e.g., via hash or programmatic scroll)
  const syncIndex = gsap.utils.throttle(() => {
    const scrollY = window.scrollY + innerHeight / 2;
    const i = sections.findIndex(s => scrollY >= s.offsetTop && scrollY < s.offsetTop + s.offsetHeight);
    if (i >= 0) index = i;
  }, 150);
  window.addEventListener("scroll", syncIndex);
  window.addEventListener("resize", () => ScrollTrigger.refresh());

Observer.create({
  target: window,
  type: "wheel,touch,pointer,scroll",
  wheelSpeed: 1,
  tolerance: 8,
  preventDefault: true,
  onDown: () => scrollToIndex(index + 1),
  onUp: () => scrollToIndex(index - 1),
  onChangeY: (self) => {
    if (Math.abs(self.deltaY) > 30) {
      scrollToIndex(index + (self.deltaY > 0 ? 1 : -1));
    }
  }
});

// add keyboard separately
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
    scrollToIndex(index + 1);
  }
  if (e.key === "ArrowUp" || e.key === "PageUp") {
    scrollToIndex(index - 1);
  }
  if (e.key === "Home") {
    scrollToIndex(0);
  }
  if (e.key === "End") {
    scrollToIndex(sections.length - 1);
  }
});

  // Respect reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ScrollTrigger.getAll().forEach(st => st.disable());
  }
}

initSectionPaging();
