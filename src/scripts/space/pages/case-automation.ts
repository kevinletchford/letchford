// src/space/pages/case-automation.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
const loadCaseAutomation: PageLoader = ({ three: T }: Ctx): LoadResult => ({ group: new T.Group() });
export default loadCaseAutomation;
