// src/space/pages/home-ui.ts
import { gsap } from "gsap";
declare global {
  interface Window {
    currentSectionId?: string;
  }
  interface WindowEventMap {
    sectionchange: CustomEvent<{ id: string }>;
  }
}

export function mountHomeUI() {
     console.log("mount ui");
  const ac = new AbortController(); // everything added with this signal will be auto-removed
  const { signal } = ac;

  // You’re in a client-routed page; DOM is already swapped in.
  // If you want to be extra safe, you can await a frame:
  // await new Promise(r => requestAnimationFrame(r));

  // ----- helpers -----
  const qs  = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
  const qsa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sections: NodeListOf<HTMLElement> = document.querySelectorAll('article section[id]');

  const navLinks: Map<string, HTMLAnchorElement> = new Map(
    Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
      .map(a => [a.getAttribute('href')!.slice(1), a])
  );

  const setActiveNav = (id: string) => {
    navLinks.forEach((a, key) => {
      if (key === id) a.classList.add('is-active');
      else a.classList.remove('is-active');
    });
  };

  let lastHash = '';
  const updateHash = (id: string) => {
    if (!id || lastHash === id) return;
    history.replaceState(null, '', `#${id}`);
    lastHash = id;
  };

  const setActiveSection = (id: string, el: HTMLElement) => {
    // remove old classes
    sections.forEach(s => s.classList.remove('is-visible'));
    // set new active
    el.classList.add('is-visible');

    // update nav + hash
    setActiveNav(id);
    updateHash(id);

    // only notify if it changed
    if (window.currentSectionId !== id) {
      window.currentSectionId = id;
      // 🔔 dispatch a typed custom event
      window.dispatchEvent(new CustomEvent('sectionchange', { detail: { id } }));
    }
  };

  const io = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;

      // Choose the most visible section
      const top = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const el = top.target as HTMLElement;
      const id = el.id;
      setActiveSection(id, el);
    },
    {
      root: null,
      rootMargin: '0px 0px -40% 0px',
      threshold: reduceMotion ? 0 : [0.15, 0.35, 0.55, 0.75]
    }
  );

  sections.forEach(s => io.observe(s));

  // Optional: initialize active based on current hash (if present)
  const initialId = location.hash?.slice(1);
  if (initialId) {
    const el = document.getElementById(initialId);
    if (el) setActiveSection(initialId, el);
  }

  // Optional parallax
  if (!reduceMotion) {
    const speedNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-speed]'));
    const speeds = new WeakMap<HTMLElement, number>();
    speedNodes.forEach(node => speeds.set(node, parseFloat(node.dataset.speed || '1')));

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const vh = window.innerHeight;
        sections.forEach(section => {
          if (!section.classList.contains('is-visible')) return;
          const rect = section.getBoundingClientRect();
          const progress = 1 - Math.min(Math.max(rect.top / vh, 0), 1);
          speedNodes.forEach(node => {
            if (!section.contains(node)) return;
            const speed = speeds.get(node) ?? 1;
            node.style.transform = `translate3d(0, ${Math.round((progress - 0.5) * 40 * speed)}px, 0)`;
          });
        });
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }
})();


  let initialLoad = true;
  let targetX = 0, targetY = -30, targetZ = 0;

  const setZoom = (id: string, delay = 0, duration = 1) => {
   console.log(id)
    switch (id) {
      case "header":     targetX = 0;  targetY = -30; targetZ = 0;  break;
      case "skills":     initialLoad = false; targetY = -20; targetZ = 0;  break;
      case "experience": targetY = -20; targetZ = 10; break;
      case "education":  targetY = -60; targetZ = 10; break;
    }
    // delegate camera tween to your SpaceManager
    import("../manager").then(({ SpaceManager }) => {
      SpaceManager.zoomTo({ x: targetX, y: targetY, z: targetZ }, duration, delay);
    });
  };

  const toggleActiveNavItem = (navItem: string): void => {
    const items = qsa<HTMLAnchorElement>('a[data-nav-item]');
    const item  = qs<HTMLAnchorElement>(`a[data-nav-item="${navItem}"]`);
    items.forEach(x => x.classList.remove('dot_active'));
    item?.classList.add('dot_active');
  };

  // ----- event wiring -----

  // sectionchange -> zoom & nav highlight
  const onSectionChange = (e: Event) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    console.log(id);
    if (id !== 'header' || initialLoad === false) setZoom(id);
    toggleActiveNavItem(id);
  };
  window.addEventListener('sectionchange', onSectionChange, { signal });

  // dot clicks (delegated or individual)
  const dotLinks = qsa<HTMLAnchorElement>('a[data-nav-item]');
  const goToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toggleActiveNavItem(id);
    }
  };
  dotLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-nav-item');
      if (id) goToSection(id);
    }, { signal });
  });

  // prev/next buttons
  const prevBtn = qs<HTMLButtonElement>('.previous-section');
  const nextBtn = qs<HTMLButtonElement>('.next-section');

  const sectionIds = dotLinks.map(a => a.getAttribute('data-nav-item')).filter(Boolean) as string[];
  const getActiveIndex = () => {
    const active = qs<HTMLAnchorElement>('a[data-nav-item].dot_active');
    const id = active?.getAttribute('data-nav-item') ?? null;
    return id ? sectionIds.indexOf(id) : -1;
  };
  const setDisabled = (btn: HTMLButtonElement | null, disabled: boolean) => {
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('opacity-40', disabled);
    btn.classList.toggle('pointer-events-none', disabled);
  };
  const updateButtonsState = () => {
    const i = getActiveIndex();
    setDisabled(prevBtn, i <= 0);
    setDisabled(nextBtn, i >= sectionIds.length - 1);
  };

  prevBtn?.addEventListener('click', () => {
    const i = getActiveIndex();
    if (i > 0) goToSection(sectionIds[i - 1]);
  }, { signal });

  nextBtn?.addEventListener('click', () => {
    const i = getActiveIndex();
    if (i >= 0 && i < sectionIds.length - 1) goToSection(sectionIds[i + 1]);
  }, { signal });

  // IntersectionObserver (disconnect in dispose)
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    const id = visible?.target instanceof HTMLElement ? visible.target.id : null;
    if (id) {
      toggleActiveNavItem(id);
      updateButtonsState();
    }
  }, { root: null, rootMargin: '0px', threshold: [0.5] });

  const sections = sectionIds
    .map(id => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);

  sections.forEach(sec => observer.observe(sec));

  // initial state
  const initialId = (location.hash?.replace('#', '') || sectionIds[0]) ?? null;
  if (initialId) toggleActiveNavItem(initialId);
  updateButtonsState();

  // Call the intro zoom once the page content is mounted
  setZoom('header', 0.5, 3);

  // ---- return disposer ----
  return {
    dispose() {
      ac.abort();          // removes ALL event listeners added with { signal }
      observer.disconnect(); // clean up observers
      // any timers/raf? clear them here.
    }
  };
}
