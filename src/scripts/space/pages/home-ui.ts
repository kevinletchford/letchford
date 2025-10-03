// src/space/pages/home-ui.ts
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Observer } from "gsap/Observer";

gsap.registerPlugin(ScrollToPlugin, Observer);

declare global {
  interface Window {
    currentSectionId?: string;
  }
  interface WindowEventMap {
    sectionchange: CustomEvent<{ id: string }>;
  }
}



export function mountHomeUI() {
  const ac = new AbortController();
  const { signal } = ac;

  const HEADER_OFFSET = 50; // your fixed header height
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isEditable = (el: EventTarget | null) =>
  !!el && (el as HTMLElement).closest?.('input,textarea,select,button,[contenteditable="true"]');

  const OBS_TARGET: Document | Element | Window = document;

  // ---------- tiny DOM helpers ----------
  const qs  = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
  const qsa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];

  // ---------- sections & nav ----------
  const sections = Array.from(document.querySelectorAll<HTMLElement>("article section[id]"));
  const sectionIds = sections.map(s => s.id);

  const navLinks: Map<string, HTMLAnchorElement> = new Map(
    Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
      .map(a => [a.getAttribute("href")!.slice(1), a])
  );

  const setActiveNav = (id: string) => {
    navLinks.forEach((a, key) => a.classList.toggle("is-active", key === id));
  };

  let lastHash = "";
  const updateHash = (id: string) => {
    if (!id || lastHash === id) return;
    history.replaceState(null, "", `#${id}`);
    lastHash = id;
  };

  const setActiveSection = (id: string, el: HTMLElement) => {
    sections.forEach(s => s.classList.remove("is-visible"));
    el.classList.add("is-visible");
    setActiveNav(id);
    updateHash(id);

    if (window.currentSectionId !== id) {
      window.currentSectionId = id;
      window.dispatchEvent(new CustomEvent("sectionchange", { detail: { id } }));
    }
  };

  // ---------- scrollTo (GSAP + optional ScrollSmoother) ----------
  const smoother = (window as any).ScrollSmoother?.get?.();
  const gsapScrollTo = (target: HTMLElement | number | string, immediate = false) => {
    if (smoother) {
      // ScrollSmoother supports an offset
      smoother.scrollTo(target, !reduceMotion && !immediate, HEADER_OFFSET);
      return;
    }
    const dur = reduceMotion || immediate ? 0 : 0.8;
    gsap.to(window, {
      duration: dur,
      ease: "power2.out",
      scrollTo: { y: target, offsetY: HEADER_OFFSET }
    });
  };

  const goToSectionById = (id: string, immediate = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    gsapScrollTo(el, immediate);
    toggleActiveNavItem(id);
  };

  // ---------- camera zoom (unchanged) ----------
  let initialLoad = false;
  let targetX = -20, targetY = -30, targetZ = 80;
  const setZoom = (id: string, delay = 0, duration = 1) => {
    switch (id) {
      case "header":     targetX = -20; targetY = -30; targetZ = 80;  break;
      case "skills":     initialLoad = false; targetX = -20; targetY = -30; targetZ = 70;  break;
      case "experience": targetX = -10; targetY = -40; targetZ = 70;  break;
      case "education":  targetX = -20; targetY = -30; targetZ = 100; break;
    }
    import("../manager").then(({ SpaceManager }) => {
      SpaceManager.zoomTo({ x: targetX, y: targetY, z: targetZ }, duration, delay);
    });
  };

  // ---------- nav dots ----------
  const toggleActiveNavItem = (navItem: string) => {
    const items = qsa<HTMLAnchorElement>('a[data-nav-item]');
    const item  = qs<HTMLAnchorElement>(`a[data-nav-item="${navItem}"]`);
    items.forEach(x => x.classList.remove("dot_active"));
    item?.classList.add("dot_active");
  };

  // ---------- determine active section from scroll ----------
  const getActiveSectionFromScroll = (): { id: string; el: HTMLElement } | null => {
    if (!sections.length) return null;
    const pos = (smoother ? smoother.scrollTop() : window.scrollY) + HEADER_OFFSET + window.innerHeight * 0.33;

    // Find the last section whose top is above our probe line
    let active: any = null;
    for (let i = 0; i < sections.length; i++) {
      const el = sections[i];
      const top = (smoother ? smoother.offset(el, "top") : el.getBoundingClientRect().top + (smoother ? 0 : window.scrollY));
      if (top <= pos) active = el;
      else break;
    }
    if (!active) active = sections[0];
      return active ? { id: active.id, el: active } : null;
  };

  // ---------- GSAP Observer (scroll + wheel + keys) ----------
  // We’ll manage:
  //  - on scroll: update active section & UI
  //  - on wheel/keys: snap to prev/next section
  const snapToIndex = (index: number) => {
    const i = Math.max(0, Math.min(sections.length - 1, index));
    const id = sections[i].id;
    goToSectionById(id);
  };

  const indexOfId = (id: string) => sections.findIndex(s => s.id === id);

  // Keep buttons in sync
  const prevBtn = qs<HTMLButtonElement>(".previous-section");
  const nextBtn = qs<HTMLButtonElement>(".next-section");
  const setDisabled = (btn: HTMLButtonElement | null, disabled: boolean) => {
    if (!btn) return;
    btn.setAttribute("aria-disabled", String(disabled));
    btn.classList.toggle("opacity-40", disabled);
    btn.classList.toggle("pointer-events-none", disabled);
  };
  const updateButtonsState = () => {
    const active = window.currentSectionId ?? sections[0]?.id;
    const i = indexOfId(active);
    setDisabled(prevBtn, i <= 0);
    setDisabled(nextBtn, i >= sections.length - 1);
  };

  // Observer for scroll changes (cheap) -> compute & set active
  const scrollObserver = Observer.create({
    target: window,
    type: "scroll,touch", // touch includes mobile fling scroll
    onChangeY: () => {
      const active = getActiveSectionFromScroll();
      if (!active) return;
      setActiveSection(active.id, active.el);
      toggleActiveNavItem(active.id);
      updateButtonsState();
    }
  });

  // Observer for intent-based navigation (wheel/keys/touch)
const intentObserver = Observer.create({
  target: OBS_TARGET,
  type: "wheel,keydown",

  // keep this off so we can conditionally call preventDefault in handlers
  preventDefault: false,

  onPress: (e) => {
    // If focus is in an editable control, let the browser handle it
    if (isEditable(e.target)) return;

    // Optionally block paging keys right away
    const code = (e as KeyboardEvent).code;
    if (code === "Space" || code === "PageDown" || code === "PageUp") e.preventDefault();
  },

  onKeyDown: (e) => {
    if (gsap.isTweening(window)) return;      // don't handle during scroll tween
    if (isEditable(e.target)) return;         // ignore typing in fields

    const code = (e as KeyboardEvent).code;
    const active = window.currentSectionId ?? sections[0]?.id;
    let i = sections.findIndex(s => s.id === active);

    if (code === "ArrowDown" || code === "PageDown" || code === "Space") {
      e.preventDefault();
      if (i < sections.length - 1) snapToIndex(i + 1);
    } else if (code === "ArrowUp" || code === "PageUp") {
      e.preventDefault();
      if (i > 0) snapToIndex(i - 1);
    } else if (code === "Home") {
      e.preventDefault();
      snapToIndex(0);
    } else if (code === "End") {
      e.preventDefault();
      snapToIndex(sections.length - 1);
    }
  },

  onWheel: (e) => {
    if (reduceMotion) return;                 // let natural scrolling happen
    if (gsap.isTweening(window)) return;
    if (isEditable(e.target)) return;

    const dy = (e as WheelEvent).deltaY;
    if (Math.abs(dy) < 20) return;

    const active = window.currentSectionId ?? sections[0]?.id;
    let i = sections.findIndex(s => s.id === active);

    if (dy > 0 && i < sections.length - 1) {
      (e as WheelEvent).preventDefault();
      snapToIndex(i + 1);
    } else if (dy < 0 && i > 0) {
      (e as WheelEvent).preventDefault();
      snapToIndex(i - 1);
    }
  }
});

  // ---------- dot links ----------
  const dotLinks = qsa<HTMLAnchorElement>('a[data-nav-item]');
  dotLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.getAttribute("data-nav-item");
      if (id) goToSectionById(id);
    }, { signal });
  });

  // ---------- prev/next buttons ----------
  prevBtn?.addEventListener("click", () => {
    const active = window.currentSectionId ?? sections[0]?.id;
    const i = indexOfId(active);
    if (i > 0) snapToIndex(i - 1);
  }, { signal });

  nextBtn?.addEventListener("click", () => {
    const active = window.currentSectionId ?? sections[0]?.id;
    const i = indexOfId(active);
    if (i >= 0 && i < sections.length - 1) snapToIndex(i + 1);
  }, { signal });

  // ---------- sectionchange -> zoom + dot highlight ----------
  const onSectionChange = (e: Event) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    if (id !== "header" || initialLoad === false) setZoom(id);
    toggleActiveNavItem(id);
    updateButtonsState();
  };
  window.addEventListener("sectionchange", onSectionChange, { signal });

  // ---------- optional parallax with GSAP ticker ----------
  if (!reduceMotion) {
    const speedNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-speed]"));
    const speeds = new WeakMap<HTMLElement, number>();
    speedNodes.forEach(node => speeds.set(node, parseFloat(node.dataset.speed || "1")));

    const ticker = gsap.ticker.add(() => {
      const active = window.currentSectionId ? document.getElementById(window.currentSectionId) : sections[0];
      if (!active) return;

      const rect = active.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - Math.min(Math.max(rect.top / vh, 0), 1);

      speedNodes.forEach(node => {
        if (!active.contains(node)) return;
        const speed = speeds.get(node) ?? 1;
        const y = Math.round((progress - 0.5) * 40 * speed);
        node.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    });
    // cleanup ticker in dispose (via gsap.ticker.remove) – see below.
  }

  // ---------- initial state / deep-link ----------
  const initialId = (location.hash?.replace("#", "") || sectionIds[0]) ?? null;
  if (initialId) {
    // jump immediately (no animation), set state
    goToSectionById(initialId, true);
    const el = document.getElementById(initialId);
    if (el) setActiveSection(initialId, el);
    toggleActiveNavItem(initialId);
  } else if (sections[0]) {
    setActiveSection(sections[0].id, sections[0]);
    toggleActiveNavItem(sections[0].id);
  }
  updateButtonsState();

  // ---- return disposer ----
  return {
    dispose() {
      ac.abort(); // removes DOM listeners (clicks, custom event)
      scrollObserver?.kill();
      intentObserver?.kill();
      // remove any custom GSAP tickers (parallax)
      // We added an anonymous function to gsap.ticker via .add(() => {...})
      // The simplest safe approach is to clear all transforms we set:
      qsa<HTMLElement>("[data-speed]").forEach(n => (n.style.transform = ""));
      // Cancel any in-flight scrollTo tweens
      gsap.killTweensOf(window);
    }
  };
}
