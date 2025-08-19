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

    // read speed multiplier from attribute, fallback to 1
    const attr = this.textElement.getAttribute("data-speed");
    this.speed = attr ? parseFloat(attr) : 1;

    this.splitText();
  }

  private splitText(): void {
    this.splitter = new SplitText(this.textElement, { type: "words,chars" });
    this.chars = (this.splitter.chars as Element[]).map((el) => el as HTMLElement);
    this.originalChars = this.chars.map((char) => char.innerHTML);
  }

  public animate(): void {
    this.reset();

    this.chars.forEach((char, index) => {
      const initialHTML = char.innerHTML;
      let repeatCount = 0;

      gsap.fromTo(
        char,
        { opacity: 0 },
        {
          duration: 0.03 / this.speed, // faster/slower
          onStart: () => gsap.set(char, { "--opa": 1 } as any),
          onComplete: () => {
            gsap.delayedCall(0.03 / this.speed, () => {
              char.innerHTML = initialHTML;
            });
          },
          repeat: 3,
          onRepeat: () => {
            repeatCount++;
            if (repeatCount === 1) {
              gsap.set(char, { "--opa": 0 } as any);
            }
            char.innerHTML =
              lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];
          },
          repeatRefresh: true,
          repeatDelay: 0.04 / this.speed,
          delay: ((index + 1) * 0.07) / this.speed, // adjust stagger
          opacity: 1,
        }
      );
    });
  }

  public reset(): void {
    this.chars.forEach((char, i) => {
      gsap.killTweensOf(char);
      char.innerHTML = this.originalChars[i];
    });
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

  // Create animators (dedupe in case an element has both classes)
  const uniqueNodes = Array.from(new Set([...loadNodes, ...hoverNodes]));
  const animators = new Map<HTMLElement, TextAnimator>(
    uniqueNodes.map((el) => [el, new TextAnimator(el)])
  );

  // --- Hide load-effect text initially ---
  loadNodes.forEach((el) => {
    el.style.opacity = "0"; // will be revealed when animation starts
  });

  // Hover handlers
  const listeners: Array<() => void> = [];
  hoverNodes.forEach((el) => {
    const animator = animators.get(el)!;
    const onEnter = () => animator.animate();
    el.addEventListener("mouseenter", onEnter);
    listeners.push(() => el.removeEventListener("mouseenter", onEnter));
  });

  // Load-effect after window load
  const onLoad = () => {
    setTimeout(() => {
      loadNodes.forEach((el, i) => {
        const animator = animators.get(el)!;
        // reveal before animation starts
        el.style.opacity = "1";
        // stagger optional
        setTimeout(() => animator.animate(), i * 80);
      });
    }, 300);
  };
  window.addEventListener("load", onLoad);
  listeners.push(() => window.removeEventListener("load", onLoad));

  // Cleanup
  return () => {
    listeners.forEach((off) => off());
    animators.forEach((a) => a.destroy());
  };
};

// Auto-init
const destroyTextEffects = initTextEffects();
