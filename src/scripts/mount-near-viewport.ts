// Runs `init` only while `el` is on or near the screen, and tears it down once
// it scrolls well away, so heavy things (WebGL contexts) don't all stay alive
// at once. `init` returns its own cleanup. Returns a cleanup that unmounts too.
// Desktops have the memory to keep them, so there it mounts on first approach
// and stays: rebuilding a context mid-scroll (new canvas, shader compile,
// meshing) drops frames, and the inits already stop rendering off screen.
//
// Like the space scene's asset queue, mounts wait their turn: nothing starts
// until the sky and the page's scene are in, phones also wait for an idle
// moment, and mounts run one at a time with a frame between them.
import { SpaceManagerAPI } from "./space/manager";
import { getDeviceTier } from "./space/device";

const SETTLE_TIMEOUT = 8000; // never hold extras back forever if the space scene fails

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const idle = () =>
  new Promise<void>((r) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => r(), { timeout: 1500 });
    else setTimeout(r, 200);
  });

let queue: Promise<void> = Promise.resolve();
const enqueue = (task: () => void) => {
  const run = async () => {
    await Promise.race([SpaceManagerAPI.whenSettled(), new Promise((r) => setTimeout(r, SETTLE_TIMEOUT))]);
    if (getDeviceTier() !== "high") await idle();
    task();
    await nextFrame();
  };
  queue = queue.then(run, run);
};

export default function mountNearViewport(el: HTMLElement, init: (el: HTMLElement) => () => void, margin = "50%") {
  let near = false;
  let queued = false;
  let disposed = false;
  let unmount: (() => void) | undefined;

  const mount = () => {
    queued = false;
    if (near && !disposed && !unmount) unmount = init(el);
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      near = entry.isIntersecting;
      if (near && !unmount && !queued) {
        queued = true;
        enqueue(mount);
      } else if (!near && unmount && getDeviceTier() !== "high") {
        unmount();
        unmount = undefined;
      }
    },
    { rootMargin: `${margin} 0px` },
  );
  observer.observe(el);

  return () => {
    disposed = true;
    observer.disconnect();
    unmount?.();
    unmount = undefined;
  };
}
