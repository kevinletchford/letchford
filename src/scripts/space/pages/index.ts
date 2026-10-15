// src/space/pages/index.ts
import type { PageLoader } from "../types";

// Exact-key map for your routes
export const lazyLoaders: Record<string, () => Promise<{ default: PageLoader }>> = {
  "home":                   () => import("./home").then(m => ({ default: m.default })),            // /
  "case-kiosk":             () => import("./case-kiosk").then(m => ({ default: m.default })),      // /case-studies/kiosk/
  "case-automation":        () => import("./case-automation").then(m => ({ default: m.default })), // /case-studies/automation/
  "case-product-tour":      () => import("./case-product-tour").then(m => ({ default: m.default })),// /case-studies/product-tour/
  "case-labs":              () => import("./case-labs").then(m => ({ default: m.default })),       // /case-studies/labs/
  "case-open-crawl":        () => import("./case-open-crawl").then(m => ({ default: m.default })), // /case-studies/open-crawl/
  "projects":               () => import("./projects").then(m => ({ default: m.default })),        // /projects/
  "contact":                () => import("./contact").then(m => ({ default: m.default })),         // /contact/
};
