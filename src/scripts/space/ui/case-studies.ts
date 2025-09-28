  // ==== globals / types (kept from your code) =================================
  declare global {
    interface Window { currentSectionId?: string; }
    interface WindowEventMap { sectionchange: CustomEvent<{ id: string }>; }
  }

// src/ui/case-study.ts
export type Disposer = { dispose: () => void };

/** tiny helper so we run after a swap when DOM is ready */
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
/** addEventListener with AbortSignal sugar */
const on = <K extends keyof DocumentEventMap>(
  t: Document | Window | HTMLElement,
  type: K,
  cb: (ev: DocumentEventMap[K] & Event) => any,
  signal: AbortSignal,
  opts: AddEventListenerOptions = {},
) => t.addEventListener(type, cb as EventListener, { ...opts, signal });

/** PUBLIC: mount all case-study behaviours; call once per case-study page */
export async function mountCaseStudyUI(): Promise<Disposer> {
  await nextFrame(); // ensure new page DOM exists

  const ac = new AbortController();
  const { signal } = ac;



  const WRAP_AROUND = false;
  const qs  = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
  const qsa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];

  const goToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    toggleActiveNavItem(id);
  };

  const toggleActiveNavItem = (navItem: string) => {
    const items = qsa<HTMLAnchorElement>('a[data-nav-item]');
    const item = qs<HTMLAnchorElement>(`a[data-nav-item="${navItem}"]`);
    items.forEach(x => x.classList.remove('dot_active'));
    item?.classList.add('dot_active');
  };

  // ===== SCROLL OBSERVER (re-usable) ==========================================
  const makeScrollObserver = (sectionSelectors: string, updateNav = true) => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sections: NodeListOf<HTMLElement> = document.querySelectorAll(`${sectionSelectors}[id]`);

    const navLinks: Map<string, HTMLAnchorElement> = new Map(
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
        .map(a => [a.getAttribute('href')!.slice(1), a])
    );

    const setActiveNav = (id: string) => {
      navLinks.forEach((a, key) => (key === id ? a.classList.add('is-active') : a.classList.remove('is-active')));
    };

    let lastHash = '';
    const updateHash = (id: string) => {
      if (!id || lastHash === id) return;
      history.replaceState(null, '', `#${id}`);
      lastHash = id;
    };

    const setActiveSection = (id: string, el: HTMLElement) => {
      sections.forEach(s => s.classList.remove('is-visible'));
      el.classList.add('is-visible');

      if (updateNav) {
        setActiveNav(id);
        updateHash(id);
      }

      if (updateNav && window.currentSectionId !== id) {
        window.currentSectionId = id;
        window.dispatchEvent(new CustomEvent('sectionchange', { detail: { id } }));
      }
    };

    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;

      const distToCenter = (e: IntersectionObserverEntry) => {
        const rect = e.boundingClientRect;
        const root = e.rootBounds;
        const viewportH = root ? root.height : innerHeight;
        const topRel = root ? rect.top - root.top : rect.top;
        const elCenterY = topRel + rect.height / 2;
        const vpCenterY = viewportH / 2;
        return Math.abs(elCenterY - vpCenterY);
      };

      const top = visible
        .map(e => ({ e, d: distToCenter(e) }))
        .sort((a, b) => a.d - b.d || b.e.intersectionRatio - a.e.intersectionRatio)[0].e;

      const el = top.target as HTMLElement;
      setActiveSection(el.id, el);
    }, {
      root: null,
      rootMargin: '0px -45% 0px -45%',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    sections.forEach(s => io.observe(s));

    // initialize from hash
    const initialId = location.hash?.slice(1);
    if (initialId) {
      const el = document.getElementById(initialId);
      if (el) setActiveSection(initialId, el);
    }

    // lightweight parallax for [data-speed]
    let ticking = false;
    const speedNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-speed]'));
    const speeds = new WeakMap<HTMLElement, number>();
    speedNodes.forEach(node => speeds.set(node, parseFloat(node.dataset.speed || '1')));

    const onScroll = () => {
      if (reduceMotion || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const vh = innerHeight;
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

    on(window, 'scroll', onScroll as any, signal, { passive: true });
    on(window, 'resize', onScroll as any, signal);
    onScroll();

    return () => { io.disconnect(); };
  };

  // Mount both observers
  const stopMainSections = makeScrollObserver('article section', true);
  const stopGalleryItems = makeScrollObserver('.gallery__item', false);

  // ===== NAV DOTS + PREV/NEXT =================================================
  const prevBtn = qs<HTMLButtonElement>('.previous-section');
  const nextBtn = qs<HTMLButtonElement>('.next-section');
  const dotLinks = qsa<HTMLAnchorElement>('a[data-nav-item]');

  const sectionIds: string[] = dotLinks
    .map(a => a.getAttribute('data-nav-item'))
    .filter((x): x is string => Boolean(x));

  const sectionsEls: HTMLElement[] = sectionIds
    .map(id => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));

  dotLinks.forEach(a => on(a, 'click', (e: Event) => {
    e.preventDefault();
    const id = a.getAttribute('data-nav-item');
    if (id) goToSection(id);
  }, signal));

  const getActiveIndex = (): number => {
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
    if (WRAP_AROUND) return;
    const i = getActiveIndex();
    setDisabled(prevBtn, i <= 0);
    setDisabled(nextBtn, i >= sectionIds.length - 1);
  };

  on(prevBtn!, 'click', () => {
    const i = getActiveIndex();
    if (i < 0) return;
    if (WRAP_AROUND) {
      const j = (i - 1 + sectionIds.length) % sectionIds.length;
      goToSection(sectionIds[j]);
    } else if (i > 0) {
      goToSection(sectionIds[i - 1]);
    }
  }, signal);

  on(nextBtn!, 'click', () => {
    const i = getActiveIndex();
    if (i < 0) return;
    if (WRAP_AROUND) {
      const j = (i + 1) % sectionIds.length;
      goToSection(sectionIds[j]);
    } else if (i < sectionIds.length - 1) {
      goToSection(sectionIds[i + 1]);
    }
  }, signal);

  const ioDots = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a,b)=> b.intersectionRatio - a.intersectionRatio)[0];
    const id = visible?.target instanceof HTMLElement ? visible.target.id : null;
    if (id) {
      toggleActiveNavItem(id);
      updateButtonsState();
    }
  }, { root: null, rootMargin: '0px', threshold: [0.5] });

  sectionsEls.forEach(sec => ioDots.observe(sec));
  updateButtonsState();

  // React to custom sectionchange (from main observer)
  on(window, 'sectionchange', (e: any) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    toggleActiveNavItem(id);
    updateButtonsState();
  }, signal);

  // ===== HORIZONTAL GALLERIES =================================================
  type GalleryOpts = { wrapAround?: boolean; threshold?: number; };

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
      if (!scroller) throw new Error('Gallery scroller (.gallery) not found');
      this.scroller = scroller;
      this.items = Array.from(section.querySelectorAll<HTMLElement>('.gallery__item'));
      if (!this.items.length) throw new Error('No .gallery__item elements found');

      this.prevBtn = section.querySelector<HTMLButtonElement>('.previous-slide');
      this.nextBtn = section.querySelector<HTMLButtonElement>('.next-slide');

      this.opts = { wrapAround: opts.wrapAround ?? false, threshold: opts.threshold ?? 0.6 };

      this.observer = new IntersectionObserver(this.setActiveByVisibility, {
        root: this.scroller,
        threshold: [this.opts.threshold],
      });

      // event bindings with AbortSignal
      on(this.section, 'keydown', this.onKeydown as any, signal);
      this.section.setAttribute('tabindex', this.section.getAttribute('tabindex') ?? '0');

      on(this.prevBtn!, 'click', () => this.handlePrev(), signal);
      on(this.nextBtn!, 'click', () => this.handleNext(), signal);

      this.items.forEach((el) => this.observer.observe(el));
      this.items.forEach((item, idx) => on(item, 'click', () => this.scrollToIndex(idx), signal));

      this.activeIndex = this.getNearestIndex();
      this.updateButtons();
    }

    destroy() { this.observer.disconnect(); }

    private onKeydown = (e: KeyboardEvent) => {
      if (document.activeElement !== this.section) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.handleNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.handlePrev(); }
    };

    private setActiveByVisibility = (entries: IntersectionObserverEntry[]) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b)=> b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible?.target) return;
      const idx = this.items.indexOf(visible.target as HTMLElement);
      if (idx !== -1 && idx !== this.activeIndex) { this.activeIndex = idx; this.updateButtons(); }
    };

    private getNearestIndex(): number {
      const viewportLeft = this.scroller.scrollLeft;
      const viewportCenter = viewportLeft + this.scroller.clientWidth / 2;
      let bestIdx = 0, bestDist = Infinity;
      this.items.forEach((item, idx) => {
        const rect = item.getBoundingClientRect();
        const scrollerRect = this.scroller.getBoundingClientRect();
        const itemCenter = this.scroller.scrollLeft + (rect.left - scrollerRect.left) + rect.width / 2;
        const dist = Math.abs(itemCenter - viewportCenter);
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
      });
      return bestIdx;
    }

    private scrollToIndex(idx: number) {
      const target = this.items[idx]; if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      this.activeIndex = idx; this.updateButtons();
    }

    private handlePrev() {
      const i = this.activeIndex;
      if (this.opts.wrapAround) this.scrollToIndex((i - 1 + this.items.length) % this.items.length);
      else if (i > 0) this.scrollToIndex(i - 1);
    }
    private handleNext() {
      const i = this.activeIndex;
      if (this.opts.wrapAround) this.scrollToIndex((i + 1) % this.items.length);
      else if (i < this.items.length - 1) this.scrollToIndex(i + 1);
    }

    private updateButtons() {
      if (this.opts.wrapAround) return;
      const atStart = this.activeIndex <= 0;
      const atEnd   = this.activeIndex >= this.items.length - 1;
      this.setDisabled(this.prevBtn, atStart);
      this.setDisabled(this.nextBtn, atEnd);
    }
    private setDisabled(btn: HTMLButtonElement | null, disabled: boolean) {
      if (!btn) return;
      btn.setAttribute('aria-disabled', String(disabled));
      btn.classList.toggle('opacity-40', disabled);
      btn.classList.toggle('pointer-events-none', disabled);
    }
  }

  // Mount all galleries found on the page and return a disposer for them too
  const gallerySections = Array.from(document.querySelectorAll<HTMLElement>('section:has(.gallery)'));
  const galleries = gallerySections.map(sec => new GalleryController(sec, { wrapAround: false, threshold: 0.6 }));

  return {
    dispose() {
      // disconnect observers & events
      galleries.forEach(g => g.destroy());
      ac.abort();
    }
  };
}
