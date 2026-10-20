// Makes a scrolling page of full-screen sections feel like slides:
// - each slide's content rises in as it arrives and lifts away as it leaves
// - scrolling is free; there's no snapping (see CaseStudiesScripts for the nav)
// - the URL hash follows the current slide, so a link or refresh opens on it
// Runs after CaseStudiesScripts, using the scroller defaults it sets.
// Returns a cleanup function.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function initSlideScroll(article: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const triggers: ScrollTrigger[] = [];
  const tweens: gsap.core.Tween[] = [];

  const sections = Array.from(article.querySelectorAll<HTMLElement>(":scope > section"));

  // A lighter catch-up than the smoother's default, so the slide
  // transitions keep up with the scroll.
  const smoother = (window as any).Smoother;
  const previousSmooth = smoother?.smooth();
  smoother?.smooth(0.5);

  if (!reduceMotion) {
    sections.forEach((section, i) => {
      const inner =
        section.querySelector<HTMLElement>("[data-slide-inner]") ?? (section.firstElementChild as HTMLElement | null);
      if (!inner) return;

      // The first slide is already in place when the page opens.
      if (i > 0) {
        tweens.push(
          gsap.fromTo(
            inner,
            { opacity: 0, y: 90, scale: 0.94 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "power2.out",
              scrollTrigger: { trigger: section, start: "top 90%", end: "top 20%", scrub: true },
            },
          ),
        );
      }
      // Venn circles drift in from apart and overlap as the slide settles.
      const circles = section.querySelectorAll<HTMLElement>("[data-venn-circle]");
      if (circles.length) {
        const enter = { trigger: section, start: "top 95%", end: "top 5%", scrub: true };
        circles.forEach((circle) => {
          const [x, y] = (circle.dataset.vennFrom ?? "0,0").split(",").map(Number);
          tweens.push(
            gsap.fromTo(
              circle,
              { xPercent: x, yPercent: y, scale: 0.8 },
              { xPercent: 0, yPercent: 0, scale: 1, ease: "power3.out", scrollTrigger: enter },
            ),
          );
        });
        const centre = section.querySelector("[data-venn-centre]");
        if (centre) {
          tweens.push(
            gsap.fromTo(
              centre,
              { opacity: 0, scale: 0.6 },
              {
                opacity: 1,
                scale: 1,
                ease: "back.out(2)",
                scrollTrigger: { ...enter, start: "top 35%", end: "top 5%" },
              },
            ),
          );
        }
      }

      // Screenshot stacks fan their layers apart as the slide settles.
      section.querySelectorAll<HTMLElement>("[data-screenshot-stack]").forEach((stack) => {
        tweens.push(
          gsap.fromTo(
            stack,
            { "--spread": 0.1 },
            {
              "--spread": 1,
              ease: "power2.out",
              scrollTrigger: { trigger: section, start: "top 80%", end: "top 10%", scrub: true },
            },
          ),
        );
      });

      // The closing slide arrives with a bang: the stars jump to warp, a
      // shockwave bursts and the headline, copy and call to action land in turn.
      if (section.hasAttribute("data-finale")) {
        const q = gsap.utils.selector(section);
        // The stars fade up with the scroll rather than appearing at the slide's edge.
        tweens.push(
          gsap.fromTo(
            q("[data-finale-warp]"),
            { opacity: 0 },
            {
              opacity: 1,
              ease: "none",
              scrollTrigger: { trigger: section, start: "top bottom", end: "top 15%", scrub: true },
            },
          ),
        );
        const finale = gsap.timeline({
          paused: true,
          defaults: { ease: "power3.out" },
        });
        finale
          .fromTo(
            q("[data-finale-ring]"),
            { scale: 0.2, opacity: 0.9 },
            { scale: 3.2, opacity: 0, duration: 1.4, ease: "expo.out", stagger: 0.18, immediateRender: false },
            0,
          )
          .from(
            q("[data-finale-word]"),
            {
              opacity: 0,
              y: 80,
              z: -300,
              rotateX: -70,
              filter: "blur(12px)",
              duration: 0.9,
              ease: "back.out(1.6)",
              stagger: 0.07,
              clearProps: "filter",
            },
            0.05,
          )
          .from(q("[data-finale-body] > *"), { opacity: 0, y: 30, duration: 0.7, stagger: 0.12 }, 0.45)
          .from(q("[data-finale-cta]"), { opacity: 0, scale: 0.5, duration: 1.1, ease: "elastic.out(1, 0.55)" }, 0.8);
        const warp = () => section.dispatchEvent(new CustomEvent("finale:warp"));
        const play = ScrollTrigger.create({
          trigger: section,
          start: "top 55%",
          onEnter: () => {
            warp();
            finale.restart();
          },
          onLeaveBack: () => finale.pause(0),
        });
        tweens.push(finale as unknown as gsap.core.Tween);
        triggers.push(play);
      }

      tweens.push(
        gsap.fromTo(
          inner,
          { opacity: 1, y: 0, scale: 1 },
          {
            opacity: 0,
            y: -90,
            scale: 0.94,
            ease: "power2.in",
            immediateRender: false,
            scrollTrigger: { trigger: section, start: "bottom 80%", end: "bottom 10%", scrub: true },
          },
        ),
      );
    });
  }

  // Keep the hash on the slide in view. The first slide clears it. The
  // router's history state is kept so back/forward still work. It holds off
  // until the opening jump, so the hero doesn't wipe a deep link first.
  const slideFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    return id ? sections.find((section) => section.id === id) : undefined;
  };
  let initialSlide = slideFromHash();
  let tracking = false;
  const setHash = (id: string) => {
    if (!tracking) return;
    const url = id === sections[0]?.id ? location.pathname + location.search : `#${id}`;
    if (url === (location.hash || location.pathname + location.search)) return;
    history.replaceState(history.state, "", url);
  };
  sections.forEach((section) => {
    if (!section.id) return;
    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: "top center",
        end: "bottom center",
        onToggle: (self) => self.isActive && setHash(section.id),
      }),
    );
  });

  // Jump straight to the slide named in the hash once everything is measured.
  const jumpTo = (target: HTMLElement | undefined, smooth: boolean) => {
    if (!target) return;
    if (smoother) smoother.scrollTo(target, smooth && !reduceMotion, "top top");
    else target.scrollIntoView({ behavior: smooth && !reduceMotion ? "smooth" : "auto" });
  };
  const onHashChange = () => jumpTo(slideFromHash(), true);
  window.addEventListener("hashchange", onHashChange);

  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    jumpTo(initialSlide, false);
    initialSlide = undefined;
    // Start tracking once the jump has settled.
    setTimeout(() => (tracking = true), 300);
  });

  return () => {
    if (previousSmooth !== undefined) smoother?.smooth(previousSmooth);
    window.removeEventListener("hashchange", onHashChange);
    tweens.forEach((t) => {
      t.scrollTrigger?.kill();
      t.kill();
    });
    triggers.forEach((t) => t.kill());
  };
}
