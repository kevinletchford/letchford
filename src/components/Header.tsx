import { useEffect, useRef, useState, type PointerEvent } from "react";
import AudioPlayer from "./AudioPlayer";
import { PROJECTS } from "../data/projects";

// Every on-site case study, in the same order as the Mars portals.
const CASE_STUDIES = PROJECTS.filter((p) => p.href.startsWith("/case-studies/"));
// Grace period so the pointer can cross the gap between the button and the panel.
const CLOSE_DELAY = 180;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Header() {
  // Mobile nav state (whole menu)
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop submenu state (Case Studies)
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const caseStudiesButtonRef = useRef<HTMLButtonElement | null>(null);
  const caseStudiesMenuRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  // Hover opens the menu without stealing focus; click and keyboard move focus in.
  const focusOnOpen = useRef(false);
  const [activeKey, setActiveKey] = useState(CASE_STUDIES[0]?.key);
  const active = CASE_STUDIES.find((p) => p.key === activeKey) ?? CASE_STUDIES[0];
  // The preview is sized from the list's height so a 16:9 screenshot fills it top to bottom.
  const caseStudiesListRef = useRef<HTMLUListElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState<number>();

  // --- Shared helpers
  const closeAll = () => {
    setMobileOpen(false);
    setSubmenuOpen(false);
  };

  // Close on outside click (mobile panel + desktop submenu)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;

      // If neither menu is open, ignore
      if (!mobileOpen && !submenuOpen) return;

      // Desktop submenu click outside
      if (submenuOpen) {
        if (
          caseStudiesMenuRef.current?.contains(t) ||
          caseStudiesButtonRef.current?.contains(t)
        ) {
          // inside submenu; do nothing
        } else {
          setSubmenuOpen(false);
        }
      }

      // Mobile drawer click outside
      if (mobileOpen) {
        if (
          mobilePanelRef.current?.contains(t) ||
          burgerRef.current?.contains(t)
        ) {
          // inside drawer; do nothing
        } else {
          setMobileOpen(false);
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [mobileOpen, submenuOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // If you’re using <ClientRouter />, close menus before page swap (Astro)
  useEffect(() => {
    const onBeforeSwap = () => closeAll();
    // @ts-ignore Astro will dispatch this event at runtime
    document.addEventListener("astro:before-swap", onBeforeSwap);
    return () => {
      // @ts-ignore
      document.removeEventListener("astro:before-swap", onBeforeSwap);
    };
  }, []);

  // Focus management when opening menus
  useEffect(() => {
    if (submenuOpen && focusOnOpen.current) {
      const firstLink = caseStudiesMenuRef.current?.querySelector<HTMLElement>(
        "a,button,[tabindex]:not([tabindex='-1'])"
      );
      firstLink?.focus();
    }
  }, [submenuOpen]);

  useEffect(() => {
    if (mobileOpen) {
      // Lock scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      // Move focus into the panel
      const firstLink = mobilePanelRef.current?.querySelector<HTMLElement>(
        "a,button,[tabindex]:not([tabindex='-1'])"
      );
      firstLink?.focus();
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    const list = caseStudiesListRef.current;
    if (!list) return;
    const PREVIEW_INSET = 24; // m-3 above and below the preview
    const ro = new ResizeObserver(() => {
      const h = list.offsetHeight - PREVIEW_INSET;
      if (h > 0) setPreviewWidth(Math.round((h * 16) / 9));
    });
    ro.observe(list);
    return () => ro.disconnect();
  }, []);

  const toggleSubmenu = () => {
    window.clearTimeout(closeTimer.current);
    focusOnOpen.current = true;
    setSubmenuOpen((v) => !v);
  };
  const openOnHover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return; // touch taps go through onClick
    window.clearTimeout(closeTimer.current);
    focusOnOpen.current = false;
    setSubmenuOpen(true);
  };
  const closeOnLeave = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setSubmenuOpen(false), CLOSE_DELAY);
  };
  const toggleMobile = () => setMobileOpen((v) => !v);

  return (
    <header className="fixed top-0 z-50 w-full bg-[linear-gradient(to_top,rgba(0,0,0,0),rgba(0,0,0,0.4))] p-4">
      <div className="grid grid-cols-3 items-center gap-2 md:flex justify-between lg:grid-cols-5 lg:grid">
        {/* Brand */}
        <a className="flex items-center gap-2 col-span-2 lg:col-span-1" href="/">
        <img src="/icons/logo.svg" width="45" className="opacity-90"/>
        <span className="flex flex-col">
          <span className="bold">Kevin Letchford</span>
          <span className="text-white/60">Design Engineer</span>
        </span>

        </a>

        {/* Desktop center nav (hidden on mobile) */}
        <div className="col-span-3 hidden items-center justify-center md:flex">
          <nav className="flex items-center justify-between gap-6 rounded-full border border-white/20 px-6 bg-black/20 md:backdrop-blur-md">
            <a className="py-2 text-white/70" href="/">
              About
            </a>

            <button
              ref={caseStudiesButtonRef}
              type="button"
              data-nav="case-studies"
              onClick={toggleSubmenu}
              onPointerEnter={openOnHover}
              onPointerLeave={closeOnLeave}
              aria-expanded={submenuOpen}
              aria-controls="menu-case-studies"
              className="nav-link inline-flex cursor-pointer items-center gap-x-1 py-2 text-white/70 "
            >
              <span>Case Studies</span>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className={cx("size-5 transition-transform", submenuOpen && "rotate-180")}
              >
                <path
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                  fillRule="evenodd"
                />
              </svg>
            </button>

            <a className="py-2 text-white/70" href="/projects/">
              Projects
            </a>
          </nav>
        </div>

        {/* Right controls (desktop) */}
        <div className="hidden items-center justify-end gap-4 md:flex">
          <a
            className="flex items-center justify-between gap-6 rounded-full border border-white/20 px-6 py-2 text-white/70 bg-black/20 md:backdrop-blur-md"
            href="/contact/"
          >
            Contact
          </a>
          <AudioPlayer src="/audio/space.m4a" title="space" />
        </div>

        {/* Burger (mobile only) */}
        <div className="flex items-center gap-3 justify-end md:hidden">
          <AudioPlayer src="/audio/space.m4a" title="space" />
          <button
            ref={burgerRef}
            type="button"
            onClick={toggleMobile}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/20 md:backdrop-blur-md"
          >
            {/* Burger / close icon */}
            <span className="relative block h-4 w-4">
              <span
                className={cx(
                  "absolute left-0 top-[1px] block h-[1px] w-4 bg-white transition-transform",
                  mobileOpen && "translate-y-[10px] rotate-45"
                )}
              />
              <span
                className={cx(
                  "absolute left-0 top-[7px] block h-[1px] w-4 bg-white transition-opacity",
                  mobileOpen && "opacity-0"
                )}
              />
              <span
                className={cx(
                  "absolute left-0 top-[14px] block h-[1px] w-4 bg-white transition-transform",
                  mobileOpen && "-translate-y-[6px] -rotate-45"
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Desktop Submenu (Case Studies): list on the left, preview of the hovered item on the right */}
      <div
        id="menu-case-studies"
        ref={caseStudiesMenuRef}
        role="region"
        aria-label="Case Studies"
        onPointerEnter={openOnHover}
        onPointerLeave={closeOnLeave}
        className={cx(
          "menu-section transition-all duration-500 ease-in-out left-4 right-4",
          submenuOpen ? "" : "menu-section_closed",
          // ensure hidden on small screens (submenu is only for desktop)
          "hidden md:block"
        )}
      >
        <div className="pt-4">
          <div className="-outline-offset-1 mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-b from-blue-900/10 to-cyan-500/10 text-sm/6 outline outline-1 outline-white/10 drop-shadow-2xl md:backdrop-blur-3xl lg:grid-cols-[minmax(0,1fr)_auto]">
            <ul ref={caseStudiesListRef} className="grid max-h-[70vh] grid-cols-2 content-start gap-1 overflow-y-auto p-3 lg:grid-cols-1">
              {CASE_STUDIES.map((p) => (
                <li key={p.key}>
                  <a
                    href={p.href}
                    onPointerEnter={() => setActiveKey(p.key)}
                    onFocus={() => setActiveKey(p.key)}
                    className={cx(
                      "group flex items-center gap-x-3 rounded-xl p-2 outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-white/40",
                      active?.key === p.key && "lg:bg-white/10"
                    )}
                  >
                    <img
                      src={p.screen}
                      alt=""
                      width={80}
                      height={45}
                      loading="lazy"
                      className="aspect-video w-20 flex-none rounded-md object-cover object-top opacity-70 outline outline-1 -outline-offset-1 outline-white/10 transition-opacity group-hover:opacity-100"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-white">{p.title}</span>
                      <span className="block truncate text-white/60">{p.blurb}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {active && (
              <a
                href={active.href}
                tabIndex={-1}
                aria-hidden="true"
                style={{ width: previewWidth }}
                className="m-3 ml-0 hidden aspect-video max-w-[60vw] self-start lg:block"
              >
                {/* 16:9 frame matching the screenshots, so nothing gets cropped */}
                <span className="holo-preview relative block h-full overflow-hidden rounded-2xl outline outline-1 -outline-offset-1 outline-white/10">
                  {CASE_STUDIES.map((p) => (
                    <img
                      key={p.key}
                      src={p.screen}
                      alt=""
                      loading="lazy"
                      className={cx(
                        "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                        p.key === active.key ? "opacity-100" : "opacity-0"
                      )}
                    />
                  ))}
                </span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE: full-screen drawer */}
      <div
        id="mobile-menu"
        className={cx(
          "md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Overlay */}
        <div
          className={cx(
            "fixed inset-0 z-20 transition-opacity bg-black/50",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          ref={mobilePanelRef}
          className={cx(
            "fixed inset-y-0 right-0 z-30 w-[88%] max-w-sm bg-black/70 p-6 md:backdrop-blur-2xl transition-transform",
            mobileOpen ? "translate-x-0" : "translate-x-full"
          )}
          role="dialog"
          aria-modal="true"
        >
          <nav className="mt-2 flex flex-col gap-2">
            <a href="/" className="rounded-xl px-3 py-2 text-lg text-white/90 hover:bg-white/10">
              About
            </a>

            {/* Mobile accordion for Case Studies */}
            <details open className="group rounded-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-lg text-white/90 hover:bg-white/10">
                <span>Case Studies</span>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5 transition-transform group-open:rotate-180">
                  <path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </summary>
              <div className="ml-2 flex flex-col gap-1 pl-2">
                {CASE_STUDIES.map((p) => (
                  <a key={p.key} href={p.href} className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10">
                    {p.title}
                  </a>
                ))}
              </div>
            </details>

            <a href="/projects/" className="rounded-xl px-3 py-2 text-lg text-white/90 hover:bg-white/10">
              Projects
            </a>

            <hr className="my-4 border-white/10" />

            <a
              href="/contact/"
              className="rounded-full border border-white/20 px-4 py-2 text-center text-white/80"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
