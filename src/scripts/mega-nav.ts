/* megaNav.ts
   Stripe-like shared flyout with morphing size, caret, and staggered items.
   Works with your existing markup that uses:
     - [data-menu-root] as the shared flyout container (initially hidden)
     - [data-panel-bg], [data-panel-caret], [data-panel-content] inside the root
     - [data-menu-trigger="<key>"] on each trigger button
     - <template id="tpl-<key>"> for each panel's content
   Example keys: "case", "projects" → templates: #tpl-case, #tpl-projects
*/

type Key = string;

export interface MegaNavOptions {
  /** CSS selector for the shared root that contains bg, caret, and content host. */
  rootSelector?: string;
  /** CSS selector for all trigger buttons (each must have data-menu-trigger="<key>"). */
  triggerSelector?: string;
  /** Attribute used on triggers to specify the key. */
  triggerAttr?: string;
  /** Selector for the background card element. */
  bgSelector?: string;
  /** Selector for the caret/arrow element. */
  caretSelector?: string;
  /** Selector for the content host (the container that receives panel content). */
  contentHostSelector?: string;
  /** Template id prefix; final id is `${templatePrefix}${key}`. Default: "tpl-". */
  templatePrefix?: string;
  /** Attribute toggled on the active trigger (data-active="true"). */
  activeStateAttr?: string;
  /** Data attribute on items inside a panel to stagger in. */
  itemAttr?: string;
  /** Easing and timing tweaks. */
  timings?: {
    morphMs?: number;        // width/height morph duration
    fadeMs?: number;         // fade out duration on close
    bgPulseMs?: number;      // bg scale/opacity pulse duration
    caretMs?: number;        // caret fade duration
    staggerMs?: number;      // per-item delay
    easing?: string;         // cubic-bezier
  };
}

export function initMegaNav(opts: MegaNavOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const {
    rootSelector = "[data-menu-root]",
    triggerSelector = "[data-menu-trigger]",
    triggerAttr = "menuTrigger",
    bgSelector = "[data-panel-bg]",
    caretSelector = "[data-panel-caret]",
    contentHostSelector = "[data-panel-content]",
    templatePrefix = "tpl-",
    activeStateAttr = "active",
    itemAttr = "animItem",
    timings = {},
  } = opts;

  const {
    morphMs = 200,
    fadeMs = 120,
    bgPulseMs = 180,
    caretMs = 120,
    staggerMs = 30,
    easing = "cubic-bezier(.2,.8,.2,1)",
  } = timings;
    
  const root = document.querySelector<HTMLElement>(rootSelector)!;
  if (!root) return;
  
  const bg = root?.querySelector<HTMLElement>(bgSelector);
  const caret = root?.querySelector<HTMLElement>(caretSelector);
  const contentHost = root?.querySelector<HTMLElement>(contentHostSelector);

    const host = contentHost as HTMLElement;
    const panelBg = bg as HTMLElement;
    const panelCaret = caret as HTMLElement;
  const triggers = Array.from(
    document.querySelectorAll<HTMLButtonElement>(triggerSelector)
  );

  if (!root || !bg || !caret || !contentHost || triggers.length === 0) {
    // Silently bail if required nodes are missing (keeps SSR happy).
    return;
  }

  let open = false;
  let active: Key | null = null;

  // ---------- Utilities ----------
  function getKey(btn: Element): Key {
    // data-menu-trigger => dataset.menuTrigger
    const key = (btn as HTMLElement).dataset[triggerAttr as keyof DOMStringMap];
    return key ?? "";
  }

  function setTriggerState(name: Key | ""): void {
    for (const btn of triggers) {
      const isActive = open && getKey(btn) === name;
      (btn as HTMLElement).dataset[activeStateAttr as keyof DOMStringMap] = isActive ? "true" : "false";
      btn.setAttribute("aria-expanded", String(isActive));
    }
  }

  function getTemplate(key: Key): HTMLTemplateElement | null {
    return document.getElementById(`${templatePrefix}${key}`) as HTMLTemplateElement | null;
  }

  function swapContent(key: Key): void {
    const tpl = getTemplate(key);
    if (!tpl) return;
    const frag = tpl.content.cloneNode(true);
    host.innerHTML = "";
    host.appendChild(frag);
  }

  function animateItems(): void {
    const items = host.querySelectorAll<HTMLElement>(`[data-${itemAttr}]`);
    items.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 200, delay: staggerMs * i, easing, fill: "both" }
      );
    });
  }

  function measureFragment(node: HTMLElement): { width: number; height: number } {
    node.style.position = "absolute";
    node.style.visibility = "hidden";
    node.style.pointerEvents = "none";
    node.style.inset = "0";
    document.body.appendChild(node);
    const rect = node.getBoundingClientRect();
    node.remove();
    return { width: rect.width, height: rect.height };
  }

  function morphTo(key: Key): void {
    // Prepare ghost content for measurement
    const tpl = getTemplate(key);
    if (!tpl) return;
    const ghostWrap = document.createElement("div");
    ghostWrap.appendChild(tpl.content.cloneNode(true));
    const { width, height } = measureFragment(ghostWrap);

    // Animate wrapper (the parent containing bg + content)
    const frame = host.parentElement as HTMLElement;
    const currentRect = frame.getBoundingClientRect();

    frame.animate(
      [
        { width: `${currentRect.width}px`, height: `${currentRect.height}px` },
        { width: `${width}px`, height: `${height}px` },
      ],
      { duration: morphMs, easing, fill: "forwards" }
    );

    // Background card subtle pulse (scale/opacity)
    panelBg.animate(
      [
        { opacity: open ? 1 : 0, transform: `scale(${open ? 1 : 0.98})` },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: bgPulseMs, easing, fill: "forwards" }
    );

    // Caret fade in
    panelCaret.animate([{ opacity: open ? 1 : 0 }, { opacity: 1 }], {
      duration: caretMs,
      easing: "linear",
      fill: "forwards",
    });

    // Swap content and stagger items
    swapContent(key);
    requestAnimationFrame(animateItems);
    setTriggerState(key);
  }

  function openMenu(key: Key): void {
    if (open && active === key) return;
    root.hidden = false;
    open = true;
    active = key;
    morphTo(key);

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
  }

  function closeMenu(): void {
    open = false;
    active = null;
    setTriggerState("");

    // Fade out content, then hide root.
    host
      .animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(4px)" },
        ],
        { duration: fadeMs, fill: "forwards" }
      )
      .finished.catch(() => void 0);

    panelBg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, fill: "forwards" });
    panelCaret.animate([{ opacity: 1 }, { opacity: 0 }], { duration: caretMs - 20, fill: "forwards" });

    // Hide a beat after animations
    window.setTimeout(() => {
      root.hidden = true;
    }, fadeMs + 10);

    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKeyDown);
  }

  // ---------- Events ----------
  function onDocClick(e: MouseEvent): void {
    const t = e.target as Node;
    const clickedTrigger = triggers.some((b) => b.contains(t));
    if (!clickedTrigger && !root.contains(t)) closeMenu();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") closeMenu();
    // Optional: arrow left/right to swap tabs when open
    if (open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const idx = triggers.findIndex((b) => getKey(b) === active);
      if (idx >= 0) {
        const next =
          e.key === "ArrowRight"
            ? triggers[(idx + 1) % triggers.length]
            : triggers[(idx - 1 + triggers.length) % triggers.length];
        const key = getKey(next);
        if (key && key !== active) morphTo(key);
        next.focus();
      }
    }
  }

  // Hook up triggers (click toggles; hover morphs when open; focus opens)
  for (const btn of triggers) {
    const key = getKey(btn);
    // Ensure ARIA
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (open && active === key) closeMenu();
      else openMenu(key);
    });

    btn.addEventListener("mouseenter", () => {
      if (open && active !== key) morphTo(key);
    });

    btn.addEventListener("focus", () => {
      if (!open) openMenu(key);
      else if (active !== key) morphTo(key);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMegaNav();
});

