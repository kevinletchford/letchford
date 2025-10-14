// src/components/AudioPlayer.tsx
import { useEffect, useRef, useState } from "react";

export default function AudioPlayer({
  src = "/audio/space.m4a",
  title = "Now Playing",
}: { src?: string; title?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep button state in sync if user uses OS media keys, etc.
  useEffect(() => {
    const el = audioRef.current!;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current!;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch (e) {
    }

  };

  return (
    <div>
        <button
          onClick={toggle}
          className="px-3 py-3 rounded-full border backdrop-blur-3xl border-white/20 text-sm cursor-pointer"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"  width="18" height="18"><path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L351.9 318.2L351.9 130.9C351.9 111.7 336.3 96.1 317.1 96.1C308.6 96.1 300.4 99.2 294 104.9L211.8 178L73 39.1zM122.2 224L112 224C85.5 224 64 245.5 64 272L64 368C64 394.5 85.5 416 112 416L160 416L294.1 535.2C300.5 540.9 308.7 544 317.2 544C336.4 544 352 528.4 352 509.2L352 453.8L122.2 224zM471.3 174.4C462.9 184.7 464.5 199.8 474.8 208.2C507.3 234.6 528 274.9 528 320C528 353 516.9 383.4 498.2 407.7L532.4 441.9C559.6 408.8 576 366.3 576 320C576 259.9 548.3 206.2 505.1 171C494.8 162.6 479.7 164.2 471.3 174.5zM428.5 338L463.8 373.3C474 358.1 480 339.7 480 320C480 289.9 466.1 263.1 444.5 245.5C434.2 237.1 419.1 238.7 410.7 249C402.3 259.3 403.9 274.4 414.2 282.8C425.1 291.6 431.9 305 431.9 320.1C431.9 326.5 430.7 332.5 428.4 338.1z" fill="#fff"/></svg>) 
                     : (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18"><path d="M272 64C280.8 64 288 71.2 288 80L288 528C288 536.8 280.8 544 272 544C263.2 544 256 536.8 256 528L256 80C256 71.2 263.2 64 272 64zM464 128C472.8 128 480 135.2 480 144L480 464C480 472.8 472.8 480 464 480C455.2 480 448 472.8 448 464L448 144C448 135.2 455.2 128 464 128zM176 160C184.8 160 192 167.2 192 176L192 432C192 440.8 184.8 448 176 448C167.2 448 160 440.8 160 432L160 176C160 167.2 167.2 160 176 160zM368 192C376.8 192 384 199.2 384 208L384 400C384 408.8 376.8 416 368 416C359.2 416 352 408.8 352 400L352 208C352 199.2 359.2 192 368 192zM80 256C88.8 256 96 263.2 96 272L96 336C96 344.8 88.8 352 80 352C71.2 352 64 344.8 64 336L64 272C64 263.2 71.2 256 80 256zM560 256C568.8 256 576 263.2 576 272L576 336C576 344.8 568.8 352 560 352C551.2 352 544 344.8 544 336L544 272C544 263.2 551.2 256 560 256z" fill="#fff"/></svg>) }
        </button>
      <audio ref={audioRef} src={src} preload="auto" loop={true} />
    </div>
  );
}
