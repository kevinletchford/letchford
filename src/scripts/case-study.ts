export {};
declare global {
interface Window {
    currentSectionId?: string;
  }
  interface WindowEventMap {
    sectionchange: CustomEvent<{ id: string }>;
  }
}

console.log("case-study")

const toggleActiveNavItem = (navItem:string) =>{
    const items = document.querySelectorAll(`a[data-nav-item]`);
    const item = document.querySelector(`a[data-nav-item="${navItem}"]`);

    items.forEach( x =>{
      x.classList.remove('dot_active')
    })

    item?.classList.add('dot_active');
}


window.addEventListener('sectionchange', (e) => {
  const id = (e as CustomEvent<{ id: string }>).detail.id;
  toggleActiveNavItem(id);
});

const scrollObserver = (sectionSelectors:string, updateNav:boolean = true) => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections: NodeListOf<HTMLElement> = document.querySelectorAll(`${sectionSelectors}[id]`);

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
    if (window.currentSectionId !== id && updateNav) {
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
}

scrollObserver('article section');

scrollObserver('.gallery__item', false);