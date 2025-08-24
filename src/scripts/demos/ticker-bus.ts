// ticker-bus.ts
import gsap from "gsap";
type Updater = (deltaRatio: number) => void;

declare global {
  interface Window {
    __canvasBus?: {
      subs: Set<Updater>;
      attached: boolean;
      subscribe: (fn: Updater) => void;
      unsubscribe: (fn: Updater) => void;
    };
  }
}

const TARGET_FPS = 60;

const bus = (() => {
  if (window.__canvasBus) return window.__canvasBus;

  const subs = new Set<Updater>();
  const master = () => {
    const deltaRatio = gsap.ticker.deltaRatio(TARGET_FPS); // ~1 at 60fps
    for (const fn of subs) fn(deltaRatio);
  };

  let attached = false;
  const attach = () => { if (!attached) { gsap.ticker.add(master); attached = true; } };
  const detach = () => { if (attached) { gsap.ticker.remove(master); attached = false; } };

  const api = {
    subs,
    attached,
    subscribe(fn: Updater) { subs.add(fn); attach(); },
    unsubscribe(fn: Updater) { subs.delete(fn); if (subs.size === 0) detach(); },
  };

  window.__canvasBus = api;

  if (import.meta.hot) {
    import.meta.hot.dispose(() => { subs.clear(); detach(); });
  }

  return api;
})();

export default bus;
