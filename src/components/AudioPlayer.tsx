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
        console.log("click")
    const el = audioRef.current!;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch (e) {
      // autoplay blocked until user interacts
      console.warn(e);
    }

  };

  return (
    <div
      className="fixed left-4 right-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl bg-white/80 backdrop-blur p-3 shadow-lg border z-50" // 👈 keep this island alive across navigations
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
        </div>
        <button
          onClick={toggle}
          className="px-4 py-2 rounded-xl border text-sm cursor-pointer"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>

      <audio ref={audioRef} src={src} preload="auto" />
    </div>
  );
}
