// src/space/pages/projects.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";

  const loadProjects: PageLoader = async ({ three: T, camera }: Ctx): Promise<LoadResult> => {
    const group = new T.Group();
    let cancelled = false;
  
  
    const uiText = await mountTextEffects();
  
    const updater = (dt: number, t: number) => {
      if (cancelled) return;
    };
  
    const dispose = () => {
      cancelled = true;
      uiText.dispose();
    };
  
    return { group, dispose, updater };
  };

  export default loadProjects;