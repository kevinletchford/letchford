// src/space/pages/case-automation.ts
// Article automation: a Google Doc feeding a CMS, with content flowing along the pipeline between them.
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";
import { HOLO_ACCENT, frameMesh, makeHolo, pill } from "../holo";

const loadAutomation: PageLoader = async ({ three: T }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  const bodyMat = makeHolo(T);
  const accentMat = makeHolo(T, HOLO_ACCENT);
  const mats = [bodyMat, accentMat];

  // The doc: a portrait page with a folded corner and lines of text
  const doc = new T.Group();
  const DW = 1.7, DH = 2.2;
  doc.add(frameMesh(T, bodyMat, DW, DH, { radius: 0.08, border: 0.08 }));
  const fold = new T.Mesh(new T.ConeGeometry(0.22, 0.04, 3), accentMat);
  fold.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  fold.position.set(DW / 2 - 0.2, DH / 2 - 0.2, 0);
  doc.add(fold);
  doc.add(pill(T, accentMat, 1.0, -DW / 2 + 0.25, DH / 2 - 0.4, 0.07));
  [1.2, 1.0, 1.15, 0.7, 1.1, 0.9].forEach((w, i) => doc.add(pill(T, bodyMat, w, -DW / 2 + 0.25, DH / 2 - 0.75 - i * 0.24, 0.035)));
  doc.position.set(-2.4, 0.3, 0);

  // The CMS: a published article in a browser window, with a hero image and copy
  const cms = new T.Group();
  const CW = 2.4, CH = 1.8;
  cms.add(frameMesh(T, bodyMat, CW, CH, { radius: 0.15, border: 0.08 }));
  cms.add(pill(T, bodyMat, CW - 0.3, -CW / 2 + 0.15, CH / 2 - 0.25, 0.045));
  const hero = frameMesh(T, accentMat, 0.9, 0.7, { radius: 0.06, border: 0.05, depth: 0.06 });
  hero.position.set(-CW / 2 + 0.65, -0.05, 0);
  cms.add(hero);
  [0.95, 0.8, 0.95, 0.6].forEach((w, i) => cms.add(pill(T, bodyMat, w, 0.05, 0.25 - i * 0.22, 0.035)));
  cms.position.set(2.2, -0.4, -0.4);
  cms.rotation.y = -0.25;

  // Pipeline: a curved tube from the doc's edge to the CMS
  const curve = new T.CatmullRomCurve3([
    new T.Vector3(-2.4 + DW / 2 + 0.05, 0.3, 0),
    new T.Vector3(-0.4, 1.0, 0.4),
    new T.Vector3(0.4, -0.9, 0.2),
    new T.Vector3(2.2 - CW / 2 + 0.05, -0.4, -0.2),
  ]);
  const pipe = new T.Mesh(new T.TubeGeometry(curve, 64, 0.03, 8, false), bodyMat);

  // Packets: the doc's metadata, images and embeds travelling to the CMS
  const packetGeo = new T.IcosahedronGeometry(0.11, 1);
  const packets = Array.from({ length: 4 }, () => new T.Mesh(packetGeo, accentMat));

  group.add(doc, cms, pipe, ...packets);
  group.rotation.set(0.2, 0.15, 0);
  group.scale.set(0.8, 0.8, 0.8);
  group.position.set(-20, -30, 74);

  const uiText = await mountTextEffects();

  const updater = (_dt: number, t: number) => {
    if (cancelled) return;
    for (const m of mats) m.uniforms.uTime.value = t;

    group.rotation.y = 0.15 + Math.sin(t * 0.25) * 0.35;
    doc.position.y = 0.3 + Math.sin(t * 0.8) * 0.06;
    cms.position.y = -0.4 + Math.sin(t * 0.8 + 1.5) * 0.06;

    packets.forEach((p, i) => {
      const u = (t * 0.22 + i / packets.length) % 1;
      curve.getPointAt(u, p.position);
      p.scale.setScalar(Math.sin(u * Math.PI) * 0.8 + 0.2); // grow out of the doc, shrink into the CMS
      p.rotation.x = t + i;
      p.rotation.y = t * 1.3 + i;
    });
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadAutomation;
