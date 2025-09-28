import { SpaceManager } from "./manager";

export function boot() {
  SpaceManager.init({ canvasId: "webgl-canvas" });
  
    console.log('booting');
  const sync = () => SpaceManager.loadForPath(location.pathname);
  sync();

  // re-load per-page assets on client navigations
  addEventListener("astro:after-swap", sync);
  addEventListener("astro:page-load", sync);
}