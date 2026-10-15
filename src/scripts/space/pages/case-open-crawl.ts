// src/space/pages/case-open-crawl.ts
// OpenCrawl: the concentric maze from its logo, with a crawler working its way through the rings.
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";
import { HOLO_ACCENT, makeHolo } from "../holo";

const loadOpenCrawl: PageLoader = async ({ three: T }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  const wallMat = makeHolo(T);
  const crawlerMat = makeHolo(T, HOLO_ACCENT, 0.5);

  // Each ring is a torus arc with a gap (the way through); rings spin at their own pace
  const tube = 0.06;
  const ringDefs = [
    { r: 0.55, gap: 1.1, start: 0.4, speed: 0.5 },
    { r: 1.05, gap: 0.8, start: 2.3, speed: -0.3 },
    { r: 1.55, gap: 0.6, start: 4.1, speed: 0.22 },
    { r: 2.05, gap: 0.5, start: 1.2, speed: -0.16 },
    { r: 2.55, gap: 0.42, start: 5.0, speed: 0.11 },
  ];
  const rings = ringDefs.map(({ r, gap, start, speed }) => {
    const ring = new T.Group();
    const wall = new T.Mesh(new T.TorusGeometry(r, tube, 12, Math.round(48 * r), Math.PI * 2 - gap), wallMat);
    ring.add(wall);
    // A short spoke out to the next ring, so it reads as a maze rather than targets
    const spoke = new T.Mesh(new T.CylinderGeometry(tube, tube, 0.5, 10), wallMat);
    const a = (Math.PI * 2 - gap) * 0.55;
    spoke.position.set(Math.cos(a) * (r + 0.25), Math.sin(a) * (r + 0.25), 0);
    spoke.rotation.z = a - Math.PI / 2;
    ring.add(spoke);
    ring.rotation.z = start;
    group.add(ring);
    return { ring, speed };
  });

  // Centre hub
  const hub = new T.Mesh(new T.SphereGeometry(0.18, 32, 32), wallMat);
  group.add(hub);

  // Crawler: hops inward ring by ring, then starts again from the outside
  const crawler = new T.Mesh(new T.IcosahedronGeometry(0.16, 1), crawlerMat);
  const trail = Array.from({ length: 6 }, (_, i) => {
    const m = new T.Mesh(new T.SphereGeometry(0.07 - i * 0.008, 12, 12), crawlerMat);
    group.add(m);
    return m;
  });
  group.add(crawler);
  const history: [number, number][] = [];

  group.rotation.set(-0.5, 0.35, 0);
  group.scale.set(0.75, 0.75, 0.75);
  group.position.set(-20, -30, 74);

  const lanes = ringDefs.map((d, i) => (i === 0 ? d.r * 0.5 : (d.r + ringDefs[i - 1].r) / 2)).reverse();
  lanes.unshift(ringDefs[ringDefs.length - 1].r + 0.25);
  const lapTime = 2.4; // seconds per lane

  const uiText = await mountTextEffects();

  const updater = (dt: number, t: number) => {
    if (cancelled) return;
    wallMat.uniforms.uTime.value = t;
    crawlerMat.uniforms.uTime.value = t;

    for (const { ring, speed } of rings) ring.rotation.z += speed * dt;
    hub.rotation.y += 0.5 * dt;

    // Ease between lanes so the crawler drops through a gap, then circles
    const cycle = t / lapTime;
    const lane = Math.floor(cycle) % lanes.length;
    const next = Math.min(lane + 1, lanes.length - 1);
    const f = cycle % 1;
    const drop = f > 0.75 ? (f - 0.75) / 0.25 : 0;
    const r = lanes[lane] + (lanes[next] - lanes[lane]) * drop * drop * (3 - 2 * drop);
    const angle = t * 1.4;
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    crawler.position.set(x, y, 0);
    crawler.rotation.x += 1.2 * dt;
    crawler.rotation.y += 0.9 * dt;

    history.unshift([x, y]);
    if (history.length > trail.length * 4) history.pop();
    trail.forEach((m, i) => {
      const h = history[Math.min((i + 1) * 4, history.length - 1)];
      m.position.set(h[0], h[1], 0);
    });

    // Slow wobble so the rings catch the fresnel edge
    group.rotation.y = 0.35 + Math.sin(t * 0.25) * 0.35;
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadOpenCrawl;
