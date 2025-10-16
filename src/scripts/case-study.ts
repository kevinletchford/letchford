export {};
declare global {
interface Window {
    currentSectionId?: string;
  }
  interface WindowEventMap {
    sectionchange: CustomEvent<{ id: string }>;
  }
}

// === Config ===
const WRAP_AROUND = false; // set true to wrap instead of disabling at ends

// --- Utilities ---
const qs = <T extends Element>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T | null;

const qsa = <T extends Element>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

// Smoothly scroll to a section by id and mark its nav dot active
function goToSection(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toggleActiveNavItem(id);
}

// Your provided helper (kept, just TS typed)
const toggleActiveNavItem = (navItem: string): void => {
  const items = qsa<HTMLAnchorElement>('a[data-nav-item]');
  const item = qs<HTMLAnchorElement>(`a[data-nav-item="${navItem}"]`);

  items.forEach((x) => x.classList.remove('dot_active'));
  item?.classList.add('dot_active');
};

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

  // ⬇️ only do these if we're managing the main vertical sections
  if (updateNav) {
    setActiveNav(id);
    updateHash(id);
  }

  // only notify if it changed
  if (window.currentSectionId !== id && updateNav) {
    window.currentSectionId = id;
    window.dispatchEvent(new CustomEvent('sectionchange', { detail: { id } }));
  }
};

  const io = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;

      // Helper: distance from element center to viewport (or root) center
      const distToCenter = (e: IntersectionObserverEntry) => {
        const rect = e.boundingClientRect;
        const root = e.rootBounds; // null when root is the viewport
        const viewportH = root ? root.height : window.innerHeight;
        const topRel = root ? rect.top - root.top : rect.top;
        const elCenterY = topRel + rect.height / 2;
        const vpCenterY = viewportH / 2;
        return Math.abs(elCenterY - vpCenterY);
      };

      // Choose the visible entry closest to center (tie-break by intersectionRatio)
      const top = visible
        .map(e => ({ e, d: distToCenter(e) }))
        .sort((a, b) => a.d - b.d || b.e.intersectionRatio - a.e.intersectionRatio)[0].e;

      const el = top.target as HTMLElement;
      setActiveSection(el.id, el);
    },
    {
      root: null,
    rootMargin: '0px -45% 0px -45%',
    threshold: [0, 0.25, 0.5, 0.75, 1],
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


document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = qs<HTMLButtonElement>('.previous-section');
  const nextBtn = qs<HTMLButtonElement>('.next-section');
  const dotLinks = qsa<HTMLAnchorElement>('a[data-nav-item]');

  // Ordered list of section ids based on the nav dots
  const sectionIds: string[] = dotLinks
    .map((a) => a.getAttribute('data-nav-item'))
    .filter((x): x is string => Boolean(x));

  const sections: HTMLElement[] = sectionIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));

  // Click dots -> smooth scroll + sync
  dotLinks.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-nav-item');
      if (id) goToSection(id);
    });
  });

  const getActiveIndex = (): number => {
    const active = qs<HTMLAnchorElement>('a[data-nav-item].dot_active');
    const id = active?.getAttribute('data-nav-item') ?? null;
    return id ? sectionIds.indexOf(id) : -1;
  };

  function setDisabled(btn: HTMLButtonElement | null, disabled: boolean): void {
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('opacity-40', disabled);
    btn.classList.toggle('pointer-events-none', disabled);
  }

  function updateButtonsState(): void {
    if (WRAP_AROUND) return; // no disabled state when wrapping
    const i = getActiveIndex();
    setDisabled(prevBtn, i <= 0);
    setDisabled(nextBtn, i >= sectionIds.length - 1);
  }

  // Button handlers
  prevBtn?.addEventListener('click', () => {
    const i = getActiveIndex();
    if (i < 0) return;
    if (WRAP_AROUND) {
      const j = (i - 1 + sectionIds.length) % sectionIds.length;
      goToSection(sectionIds[j]);
    } else if (i > 0) {
      goToSection(sectionIds[i - 1]);
    }
  });

  nextBtn?.addEventListener('click', () => {
    const i = getActiveIndex();
    if (i < 0) return;
    if (WRAP_AROUND) {
      const j = (i + 1) % sectionIds.length;
      goToSection(sectionIds[j]);
    } else if (i < sectionIds.length - 1) {
      goToSection(sectionIds[i + 1]);
    }
  });

  // Keep dots in sync when user scrolls manually
  const observer = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      const id = visible?.target instanceof HTMLElement ? visible.target.id : null;
      if (id) {
        toggleActiveNavItem(id);
        updateButtonsState();
      }
    },
    {
      root: null,
      rootMargin: '0px',
      threshold: [0.5],
    }
  );

  sections.forEach((sec) => observer.observe(sec));

  // Initialize state (use hash if present)
  const initialId = (location.hash?.replace('#', '') || sectionIds[0]) ?? null;
  if (initialId) toggleActiveNavItem(initialId);
  updateButtonsState();
});

// gallery.ts

type GalleryOpts = {
  wrapAround?: boolean; // set true to loop from end -> start and vice versa
  threshold?: number;   // % of an item visible to count as "active"; default 0.6
};

class GalleryController {
  private section: HTMLElement;
  private scroller: HTMLElement;
  private items: HTMLElement[];
  private prevBtn: HTMLButtonElement | null;
  private nextBtn: HTMLButtonElement | null;
  private observer: IntersectionObserver;
  private activeIndex = 0;
  private opts: Required<GalleryOpts>;

  constructor(section: HTMLElement, opts: GalleryOpts = {}) {
    this.section = section;

    const scroller = section.querySelector<HTMLElement>('.gallery');
    if (!scroller) throw new Error('Gallery scroller (.gallery) not found in section');

    this.scroller = scroller;
    this.items = Array.from(section.querySelectorAll<HTMLElement>('.gallery__item'));

    if (this.items.length === 0) throw new Error('No .gallery__item elements found');

    this.prevBtn = section.querySelector<HTMLButtonElement>('.previous-slide');
    this.nextBtn = section.querySelector<HTMLButtonElement>('.next-slide');

    this.opts = {
      wrapAround: opts.wrapAround ?? false,
      threshold: opts.threshold ?? 0.6,
    };

    // Bindings
    this.handlePrev = this.handlePrev.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.setActiveByVisibility = this.setActiveByVisibility.bind(this);
    this.onKeydown = this.onKeydown.bind(this);

    this.observer = new IntersectionObserver(this.setActiveByVisibility, {
      root: this.scroller,           // observe visibility within the horizontal scroller
      rootMargin: '0px',
      threshold: [this.opts.threshold],
    });

    this.init();
  }

  private init(): void {
    // Observe each item inside the scroller
    this.items.forEach((el) => this.observer.observe(el));

    // add click events to all the slides to slide to it
    this.items.forEach((item, idx) => {
      item.addEventListener('click', () => {
        this.scrollToIndex(idx);
      });
    })

    // Wire buttons
    this.prevBtn?.addEventListener('click', this.handlePrev);
    this.nextBtn?.addEventListener('click', this.handleNext);

    // Optional: keyboard support when section is focused/hovered
    this.section.addEventListener('keydown', this.onKeydown);
    this.section.setAttribute('tabindex', this.section.getAttribute('tabindex') ?? '0');

    // Initialize to the first fully visible/nearest item
    // If scroller already has a scrollLeft (e.g., restored), pick nearest
    this.activeIndex = this.getNearestIndex();
    this.updateButtons();
  }

  destroy(): void {
    this.observer.disconnect();
    this.prevBtn?.removeEventListener('click', this.handlePrev);
    this.nextBtn?.removeEventListener('click', this.handleNext);
    this.section.removeEventListener('keydown', this.onKeydown);
  }

  private onKeydown(e: KeyboardEvent) {
    // Only respond when the section is the active element (has focus)
    if (document.activeElement !== this.section) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.handleNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.handlePrev();
    }
  }

  private setActiveByVisibility(entries: IntersectionObserverEntry[]) {
    // Pick the most visible intersecting entry
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible?.target) return;

    const idx = this.items.indexOf(visible.target as HTMLElement);
    if (idx !== -1 && idx !== this.activeIndex) {
      this.activeIndex = idx;
      this.updateButtons();
    }
  }

  private getNearestIndex(): number {
    // Compute which item is nearest to the scroller's viewport center
    const viewportLeft = this.scroller.scrollLeft;
    const viewportCenter = viewportLeft + this.scroller.clientWidth / 2;

    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;

    this.items.forEach((item, idx) => {
      const rect = item.getBoundingClientRect();
      const scrollerRect = this.scroller.getBoundingClientRect();
      // Item's left relative to scroller content space
      const itemCenter =
        this.scroller.scrollLeft + (rect.left - scrollerRect.left) + rect.width / 2;

      const dist = Math.abs(itemCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    return bestIdx;
  }

  private scrollToIndex(idx: number): void {
    const target = this.items[idx];
    if (!target) return;

    // With CSS scroll-snap and .scroll-smooth on the scroller, this will snap to center
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    this.activeIndex = idx;
    this.updateButtons();
  }

  private handlePrev(): void {
    const i = this.activeIndex;
    if (this.opts.wrapAround) {
      const j = (i - 1 + this.items.length) % this.items.length;
      this.scrollToIndex(j);
    } else if (i > 0) {
      this.scrollToIndex(i - 1);
    }
  }

  private handleNext(): void {
    const i = this.activeIndex;
    if (this.opts.wrapAround) {
      const j = (i + 1) % this.items.length;
      this.scrollToIndex(j);
    } else if (i < this.items.length - 1) {
      this.scrollToIndex(i + 1);
    }
  }

  private updateButtons(): void {
    if (this.opts.wrapAround) return; // no disabled state if wrapping
    const atStart = this.activeIndex <= 0;
    const atEnd = this.activeIndex >= this.items.length - 1;

    this.setDisabled(this.prevBtn, atStart);
    this.setDisabled(this.nextBtn, atEnd);
  }

  private setDisabled(btn: HTMLButtonElement | null, disabled: boolean): void {
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('opacity-40', disabled);
    btn.classList.toggle('pointer-events-none', disabled);
  }
}

// Initialize all galleries on the page.
// Assumes each gallery lives inside a <section> (like your example),
// with one pair of .previous-slide / .next-slide buttons per section.
export function initGalleries(opts: GalleryOpts = {}): void {
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>('section:has(.gallery)')
  );
  sections.forEach((section) => {
    // eslint-disable-next-line no-new
    new GalleryController(section, opts);
  });
}

// Example: call once on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initGalleries({
    wrapAround: false, // set to true if you want looping galleries
    threshold: 0.6,    // tweak if you need earlier/later activation while swiping
  });
});
