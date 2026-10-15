// src/space/pages/case-labs.ts
// Sitebulb Labs: a browser window being read by an AI agent (a probe orbits it while a scan bar sweeps the page).
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";
import { HOLO_ACCENT, frameMesh, makeHolo } from "../holo";

const loadLabs: PageLoader = async ({ three: T }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  const frameMat = makeHolo(T);
  const accentMat = makeHolo(T, HOLO_ACCENT);
  const mats = [frameMat, accentMat];

  const W = 4, H = 2.8;
  const frame = frameMesh(T, frameMat, W, H);

  const browser = new T.Group();
  browser.add(frame);

  // Toolbar divider, window dots and address bar
  const toolbarY = H / 2 - 0.42;
  const divider = new T.Mesh(new T.BoxGeometry(W - 0.2, 0.05, 0.1), frameMat);
  divider.position.y = toolbarY;
  browser.add(divider);

  const dotGeo = new T.SphereGeometry(0.07, 24, 24);
  for (let i = 0; i < 3; i++) {
    const dot = new T.Mesh(dotGeo, accentMat);
    dot.position.set(-W / 2 + 0.3 + i * 0.22, H / 2 - 0.21, 0);
    browser.add(dot);
  }
  const address = new T.Mesh(new T.CapsuleGeometry(0.08, 2, 6, 16), frameMat);
  address.rotation.z = Math.PI / 2;
  address.position.set(0.25, H / 2 - 0.21, 0);
  browser.add(address);

  // Page content: a heading block and lines of text
  const heading = new T.Mesh(new T.BoxGeometry(1.6, 0.22, 0.08), accentMat);
  heading.position.set(-W / 2 + 0.25 + 0.8, toolbarY - 0.4, 0);
  browser.add(heading);
  const lineWidths = [3.2, 2.8, 3.4, 2.2, 3.0];
  lineWidths.forEach((w, i) => {
    const line = new T.Mesh(new T.BoxGeometry(w, 0.08, 0.06), frameMat);
    line.position.set(-W / 2 + 0.25 + w / 2, toolbarY - 0.8 - i * 0.28, 0);
    browser.add(line);
  });

  // Scan bar the agent sweeps down the page
  const scanTop = toolbarY - 0.15, scanBottom = -H / 2 + 0.15;
  const scan = new T.Mesh(new T.CapsuleGeometry(0.035, W - 0.4, 6, 12), accentMat);
  scan.rotation.z = Math.PI / 2;
  scan.position.z = 0.12;
  browser.add(scan);

  // The agent: a probe orbiting the window
  const pivot = new T.Group();
  const agent = new T.Mesh(new T.IcosahedronGeometry(0.32, 1), accentMat);
  const halo = new T.Mesh(new T.TorusGeometry(0.5, 0.025, 12, 64), frameMat);
  agent.add(halo);
  agent.position.set(3.1, 0.6, 0);
  pivot.add(agent);

  group.add(browser);
  group.add(pivot);

  group.rotation.set(0.2, -0.3, 0);
  group.scale.set(0.8, 0.8, 0.8);
  group.position.set(-20, -30, 74);

  const uiText = await mountTextEffects();

  const updater = (dt: number, t: number) => {
    if (cancelled) return;
    for (const m of mats) m.uniforms.uTime.value = t;

    // Gentle sway so the panels catch the light
    browser.rotation.y = Math.sin(t * 0.3) * 0.5;
    browser.rotation.x = Math.sin(t * 0.21) * 0.12;

    // Sweep top → bottom, then restart
    const k = (t * 0.25) % 1;
    scan.position.y = scanTop + (scanBottom - scanTop) * k;

    pivot.rotation.y += 0.35 * dt;
    agent.rotation.x += 0.4 * dt;
    agent.rotation.y += 0.6 * dt;
    halo.rotation.x = Math.PI / 2 + Math.sin(t) * 0.3;
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadLabs;
