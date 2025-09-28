// src/space/pages/case-kiosk.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
const loadCaseKiosk: PageLoader = ({ three: T }: Ctx): LoadResult => ({ group: new T.Group() });
export default loadCaseKiosk;
