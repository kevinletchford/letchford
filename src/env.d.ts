import type { SpaceManager } from "@scripts/space/manager";

// src/env.d.ts  (add once)
declare global { 
    interface Window { 
        __spaceBooted?: boolean,
        SpaceManager: typeof SpaceManager;
        gsap: typeof import("gsap").gsap;
        ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger; 
        Observer: typeof import("gsap/Observer").Observer;
        ScrollToPlugin: typeof import("gsap/ScrollToPlugin").ScrollToPlugin;
         ScrollToPluginx: typeof import("gsap/ScrollToPlugin").ScrollToPlugin;
         ctx: typeof import("gsap").context;
    }};