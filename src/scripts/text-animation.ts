// TextAnimator.ts
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
          onStart: () => { gsap.set(char, { "--opa": 1 } as any); }, // <- wrap in { }
          onComplete: () => {
            gsap.delayedCall(perCharDur, () => {
              char.innerHTML = initialHTML;
            });
          },
          repeat: repeats,
          onRepeat: () => {
            repeatCount++;
            if (repeatCount === 1) { gsap.set(char, { "--opa": 0 } as any); } // already void (block form)
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

type Cleanup = () => void;

export const initTextEffects = (): Cleanup => {
  const loadNodes = Array.from(document.querySelectorAll<HTMLElement>(".load-effect"));
  const hoverNodes = Array.from(document.querySelectorAll<HTMLElement>(".hover-effect"));

  const uniqueNodes = Array.from(new Set([...loadNodes, ...hoverNodes]));
  const animators = new Map<HTMLElement, TextAnimator>(
    uniqueNodes.map((el) => [el, new TextAnimator(el)])
  );

  loadNodes.forEach((el) => {
    el.style.opacity = "0";
  });

  const listeners: Array<() => void> = [];
  hoverNodes.forEach((el) => {
    const animator = animators.get(el)!;
    const onEnter = () => animator.animate();
    el.addEventListener("mouseenter", onEnter);
    listeners.push(() => el.removeEventListener("mouseenter", onEnter));
  });

  const onLoad = () => {
    setTimeout(() => {
      loadNodes.forEach((el, i) => {
        const animator = animators.get(el)!;
        el.style.opacity = "1";
        setTimeout(() => animator.animate(), i * 80);
      });
    }, 300);
  };
  window.addEventListener("load", onLoad);
  listeners.push(() => window.removeEventListener("load", onLoad));

  return () => {
    listeners.forEach((off) => off());
    animators.forEach((a) => a.destroy());
  };
};

const destroyTextEffects = initTextEffects();