// src/scripts/nav-menu.ts
// Re-bind safely on every routed navigation without stacking duplicates
// (AbortController lets us remove old handlers before adding new ones)
let controller: AbortController | null = null;

function bind() {
  controller?.abort();               // cleanup any previous bind
  controller = new AbortController();

  const signal = controller.signal;
  const menu = document.querySelector<HTMLElement>('#menu-case-studies');

  // Use event delegation so it still works if the header is re-rendered
  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as HTMLElement | null)?.closest('[data-nav="case-studies"]');
      if (!target) return;

      e.preventDefault();
      menu?.classList.toggle('menu-section_closed');
    },
    { signal }
  );
}

// First paint + every client-side navigation
document.addEventListener('astro:page-load', bind);
// Optional: clean up before DOM swap if you need it
document.addEventListener('astro:before-swap', () => controller?.abort());