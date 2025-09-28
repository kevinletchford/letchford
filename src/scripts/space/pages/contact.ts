// src/space/pages/contact.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
const loadContact: PageLoader = ({ three: T }: Ctx): LoadResult => ({ group: new T.Group() });
export default loadContact;
