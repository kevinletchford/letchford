// src/ui/text-animator.ts
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(SplitText, TextPlugin);

const lettersAndSymbols = [
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
  "!","@","#","$","%","^","&","*","-","_","+","=",";",":","<",">",","
];

export class TextAnimator {
  private textElement: HTMLElement;
  private splitter!: SplitText;
  private chars: HTMLElement[] = [];
  private originalChars: string[] = [];
  private speed: number; // speed multiplier

  constructor(textElement: HTMLElement) {
    if (!textElement || !(textElement instanceof HTMLElement)) {
      throw new Error("Invalid text element provided.");
    }
    this.textElement = textElement;

    const attr = this.textElement.getAttribute("data-speed");
    this.speed = attr ? parseFloat(attr) : 1;

    this.splitText();
  }

  private splitText(): void {
    this.splitter = new SplitText(this.textElement, { type: "lines,words,chars" });
    this.chars = (this.splitter.chars as Element[]).map((el) => el as HTMLElement);
    this.originalChars = this.chars.map((char) => char.innerHTML);

    gsap.set(this.chars, { display: "inline-block", willChange: "opacity,transform" });
  }

  private freezeLines(): void {
    const rect = this.textElement.getBoundingClientRect();
    gsap.set(this.textElement, { height: rect.height, display: "inline-block" });

    const lines = (this.splitter.lines as HTMLElement[]) || [];
    lines.forEach((line) => {
      const h = line.getBoundingClientRect().height;
      gsap.set(line, { height: h, overflow: "hidden" });
    });
  }

  private unfreezeLines(): void {
    gsap.set(this.textElement, { clearProps: "height,display" });
    const lines = (this.splitter.lines as HTMLElement[]) || [];
    lines.forEach((line) => gsap.set(line, { clearProps: "height,overflow" }));
  }

  public animate(): void {
    this.reset();
    this.freezeLines();

    const repeats = 3;
    const perCharDur = 0.03 / this.speed;
    const perCharDelay = 0.07 / this.speed;
    const repeatDelay = 0.04 / this.speed;
    const lastIndex = this.chars.length - 1;
    const lastCharEnd =
      ((lastIndex + 1) * perCharDelay) +
      repeats * (perCharDur + repeatDelay) +
      perCharDur + 0.2;

    this.chars.forEach((char, index) => {
      const initialHTML = char.innerHTML;
      let repeatCount = 0;

      gsap.fromTo(
        char,
        { opacity: 0 },
        {
          duration: perCharDur,
          onStart: () => { gsap.set(char, { "--opa": 1 } as any); },
          onComplete: () => {
            gsap.delayedCall(perCharDur, () => {
              char.innerHTML = initialHTML;
            });
          },
          repeat: repeats,
          onRepeat: () => {
            repeatCount++;
            if (repeatCount === 1) { gsap.set(char, { "--opa": 0 } as any); }
            char.innerHTML =
              lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];
          },
          repeatRefresh: true,
          repeatDelay,
          delay: ((index + 1) * perCharDelay),
          opacity: 1,
        }
      );
    });

    gsap.delayedCall(lastCharEnd, () => this.unfreezeLines());
  }

  public reset(): void {
    this.chars.forEach((char, i) => {
      gsap.killTweensOf(char);
      char.innerHTML = this.originalChars[i];
    });
    this.unfreezeLines();
  }

  public destroy(): void {
    this.reset();
    this.splitter.revert();
  }
}

// ---------- Mount / Dispose API ----------

type Disposer = { dispose: () => void };

// tiny helpers
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const on = <T extends keyof HTMLElementEventMap>(
  target: HTMLElement | Window | Document,
  type: T,
  handler: (ev: HTMLElementEventMap[T]) => any,
  signal: AbortSignal,
  opts: AddEventListenerOptions = {}
) => {
  target.addEventListener(type, handler as EventListener, { ...opts, signal });
};

/**
 * Mount text effects on the current page.
 * - Finds elements with `.load-effect` and `.hover-effect`
 * - Staggers the "load" animation
 * - Re-animates on hover
 * - Returns a disposer that removes listeners and destroys all SplitText instances
 */
export async function mountTextEffects(): Promise<Disposer> {
  await nextFrame(); // ensure the swapped DOM is present

  const ac = new AbortController();
  const { signal } = ac;

  // Collect targets
  const loadNodes = Array.from(document.querySelectorAll<HTMLElement>(".load-effect"));
  const hoverNodes = Array.from(document.querySelectorAll<HTMLElement>(".hover-effect"));
  const uniqueNodes = Array.from(new Set([...loadNodes, ...hoverNodes]));

  // Build animators
  const animators = new Map<HTMLElement, TextAnimator>(
    uniqueNodes.map((el) => [el, new TextAnimator(el)])
  );

  // Load stagger
  loadNodes.forEach((el) => (el.style.opacity = "0"));
  const runLoad = () => {
    setTimeout(() => {
      loadNodes.forEach((el, i) => {
        const animator = animators.get(el)!;
        el.style.opacity = "1";
        setTimeout(() => animator.animate(), i * 80);
      });
    }, 300);
  };

  // Fire immediately (no window load dependency)
  runLoad();

  // Hover re-trigger
  hoverNodes.forEach((el) => {
    const animator = animators.get(el)!;
    const onEnter = () => animator.animate();
    on(el, "mouseenter", onEnter as any, signal);
  });

  // If you dynamically inject text later and want to re-run:
  // document.addEventListener('astro:after-swap', runLoad, { signal }); // optional

  return {
    dispose() {
      // Abort all listeners
      ac.abort();
      // Kill all animations & revert SplitText
      animators.forEach((a) => a.destroy());
    },
  };
}
