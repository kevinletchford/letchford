// src/space/pages/case-product-tour.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
const loadCaseProductTour: PageLoader = ({ three: T }: Ctx): LoadResult => ({ group: new T.Group() });
export default loadCaseProductTour;
