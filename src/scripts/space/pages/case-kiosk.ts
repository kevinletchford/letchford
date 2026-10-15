// src/space/pages/case-kiosk.ts
// Promotional kiosk: a freestanding landscape touchscreen showing a grid of tiles, with taps rippling across it.
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";
import { HOLO_ACCENT, frameMesh, makeHolo, pill, roundedRect } from "../holo";

const loadKiosk: PageLoader = async ({ three: T }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  const bodyMat = makeHolo(T);
  const tileMat = makeHolo(T, HOLO_ACCENT);
  const rippleMat = makeHolo(T, HOLO_ACCENT, 0.6);
  const mats = [bodyMat, tileMat, rippleMat];

  // Landscape screen on a pole, standing on a base ring
  const W = 3.8, H = 2.4;
  const kiosk = new T.Group();
  const screen = new T.Group();
  screen.add(frameMesh(T, bodyMat, W, H, { radius: 0.2, border: 0.12, depth: 0.16 }));
  screen.position.y = 0.8;
  kiosk.add(screen);

  const pole = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 1.6, 24), bodyMat);
  pole.position.y = 0.8 - H / 2 - 0.8;
  kiosk.add(pole);
  // Base as a ring (a solid disc's flat top washes out under additive blending)
  const base = new T.Mesh(new T.TorusGeometry(0.9, 0.06, 12, 64), bodyMat);
  base.rotation.x = Math.PI / 2;
  base.position.y = pole.position.y - 0.8;
  kiosk.add(base);
  const foot = new T.Mesh(new T.CylinderGeometry(0.25, 0.3, 0.1, 32), bodyMat);
  foot.position.y = base.position.y;
  kiosk.add(foot);
  kiosk.position.y = 0.25; // centre the whole stand in view rather than the screen

  // Screen content: a header bar and a 3×2 grid of touch tiles
  screen.add(pill(T, tileMat, 1.4, -W / 2 + 0.3, H / 2 - 0.4, 0.07));
  const tileGeo = new T.ExtrudeGeometry(roundedRect(T, 1.0, 0.7, 0.1), {
    depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2,
  });
  tileGeo.translate(0, 0, -0.03);
  const tiles: InstanceType<typeof T.Mesh>[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const tile = new T.Mesh(tileGeo, tileMat);
      tile.position.set((col - 1) * 1.15, 0.2 - row * 0.85, 0);
      screen.add(tile);
      tiles.push(tile);
    }
  }

  // Tap ripple: expands from a tile, then jumps to the next one
  const ripple = new T.Mesh(new T.TorusGeometry(0.2, 0.02, 10, 48), rippleMat);
  ripple.position.z = 0.12;
  screen.add(ripple);
  const tapEvery = 1.6;

  group.add(kiosk);
  group.rotation.set(0.15, -0.3, 0);
  group.scale.set(0.75, 0.75, 0.75);
  group.position.set(-20, -30, 74);

  const uiText = await mountTextEffects();

  const updater = (_dt: number, t: number) => {
    if (cancelled) return;
    for (const m of mats) m.uniforms.uTime.value = t;

    kiosk.rotation.y = Math.sin(t * 0.3) * 0.5;

    const tap = Math.floor(t / tapEvery);
    const f = (t % tapEvery) / tapEvery;
    const target = tiles[(tap * 5) % tiles.length];
    ripple.position.x = target.position.x;
    ripple.position.y = target.position.y;
    ripple.scale.setScalar(1 + f * 3);
    rippleMat.uniforms.uAlpha.value = 0.6 * (1 - f);

    // The tapped tile presses in, then springs back
    for (const tile of tiles) tile.position.z = tile === target ? -0.08 * Math.max(0, 1 - f * 4) : 0;
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadKiosk;
