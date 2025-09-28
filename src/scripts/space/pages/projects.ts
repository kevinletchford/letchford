// src/space/pages/projects.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
const loadProjects: PageLoader = ({ three: T }: Ctx): LoadResult => ({ group: new T.Group() });
export default loadProjects;
