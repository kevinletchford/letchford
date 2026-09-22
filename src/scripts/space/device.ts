// src/space/device.ts

export type DeviceTier = "low" | "mid" | "high";

export const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia('(max-width: 1024px), (pointer: coarse), (hover: none)').matches;
};

let cachedTier: DeviceTier | null = null;

/**
 * low  → data saver / 2g / very little memory or cores: drop secondary assets
 * mid  → mobile: smaller assets, throttled GPU uploads
 * high → desktop: full quality, no throttling
 *
 * Override for testing with `?tier=low|mid|high`.
 */
export function getDeviceTier(): DeviceTier {
  if (cachedTier) return cachedTier;
  if (typeof window === "undefined") return "high";

  const forced = new URLSearchParams(location.search).get("tier");
  if (forced === "low" || forced === "mid" || forced === "high") return (cachedTier = forced);

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const slowNetwork = !!nav.connection?.saveData || /2g$/.test(nav.connection?.effectiveType ?? "");
  const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory <= 2;
  const fewCores = nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2;

  if (slowNetwork || lowMemory || fewCores) cachedTier = "low";
  else if (isMobileDevice()) cachedTier = "mid";
  else cachedTier = "high";
  return cachedTier;
}

/** Pick a value for the current tier; low falls back to mid, mid falls back to high. */
export function byTier<T>(tier: DeviceTier, v: { high: T; mid?: T; low?: T }): T {
  if (tier === "low") return v.low ?? v.mid ?? v.high;
  if (tier === "mid") return v.mid ?? v.high;
  return v.high;
}
