// Remembers which project was entered through the Mars hologram, so the project page can offer
// a way back and the home page can land straight on the surface with that project picked.
// The home page's inline script reads the same key (index.astro).
export const PORTAL_RETURN_KEY = "portal:return";

export function rememberPortal(key: string) {
  try {
    sessionStorage.setItem(PORTAL_RETURN_KEY, key);
  } catch {}
}

export function peekPortal(): string | null {
  try {
    return sessionStorage.getItem(PORTAL_RETURN_KEY);
  } catch {
    return null;
  }
}

export function forgetPortal() {
  try {
    sessionStorage.removeItem(PORTAL_RETURN_KEY);
  } catch {}
}
