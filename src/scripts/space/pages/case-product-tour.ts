// src/space/pages/case-product-tour.ts
// Product tour video: a player with a pulsing play button and a playhead running along the timeline.
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";
import { HOLO_ACCENT, frameMesh, makeHolo, pill } from "../holo";

const loadProductTour: PageLoader = async ({ three: T }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  const bodyMat = makeHolo(T);
  const accentMat = makeHolo(T, HOLO_ACCENT);
  const mats = [bodyMat, accentMat];

  // 16:9 player
  const W = 4, H = 2.25;
  const player = new T.Group();
  player.add(frameMesh(T, bodyMat, W, H, { radius: 0.2, border: 0.1, depth: 0.14 }));

  // Play button: a triangle inside a ring
  const play = new T.Group();
  const triangle = new T.Shape();
  triangle.moveTo(-0.18, -0.24);
  triangle.lineTo(0.28, 0);
  triangle.lineTo(-0.18, 0.24);
  triangle.closePath();
  const triGeo = new T.ExtrudeGeometry(triangle, {
    depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2,
  });
  triGeo.translate(0, 0, -0.04);
  play.add(new T.Mesh(triGeo, accentMat));
  play.add(new T.Mesh(new T.TorusGeometry(0.5, 0.035, 12, 64), accentMat));
  play.position.y = 0.15;
  player.add(play);

  // Timeline with a playhead and the played portion
  const trackLeft = -W / 2 + 0.3, trackLength = W - 0.6, trackY = -H / 2 + 0.3;
  player.add(pill(T, bodyMat, trackLength, trackLeft, trackY, 0.025));
  const played = pill(T, accentMat, 1, 0, trackY, 0.045);
  player.add(played);
  const playhead = new T.Mesh(new T.SphereGeometry(0.09, 24, 24), accentMat);
  playhead.position.y = trackY;
  player.add(playhead);

  // Feature "chapters" the tour cuts between, orbiting the player
  const orbit = new T.Group();
  const cards = [0, 1, 2].map((i) => {
    const card = frameMesh(T, bodyMat, 0.8, 0.5, { radius: 0.06, border: 0.05, depth: 0.05 });
    const a = (i / 3) * Math.PI * 2;
    card.position.set(Math.cos(a) * 3.3, Math.sin(a * 2) * 0.5, Math.sin(a) * 2);
    orbit.add(card);
    return card;
  });

  group.add(player, orbit);
  group.rotation.set(0.2, -0.2, 0);
  group.scale.set(0.8, 0.8, 0.8);
  group.position.set(-20, -30, 74);

  const uiText = await mountTextEffects();
  const duration = 8; // seconds per loop of the "video"

  const updater = (dt: number, t: number) => {
    if (cancelled) return;
    for (const m of mats) m.uniforms.uTime.value = t;

    player.rotation.y = Math.sin(t * 0.3) * 0.4;
    play.scale.setScalar(1 + Math.sin(t * 2.5) * 0.06);

    const progress = (t % duration) / duration;
    const len = Math.max(trackLength * progress, 0.001);
    played.scale.y = len; // capsule length runs along its local y
    played.position.x = trackLeft + len / 2;
    playhead.position.x = trackLeft + len;

    orbit.rotation.y += 0.2 * dt;
    for (const card of cards) card.rotation.y = -orbit.rotation.y; // keep facing the camera
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadProductTour;
