globalThis.process ??= {}; globalThis.process.env ??= {};
import { r as renderers } from './chunks/_@astro-renderers_CVXl_z1Q.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_cia9Gnsk.mjs';
import { manifest } from './manifest_Cvm4aqll.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/case-studies/automation.astro.mjs');
const _page1 = () => import('./pages/case-studies/kiosk.astro.mjs');
const _page2 = () => import('./pages/case-studies/product-tour.astro.mjs');
const _page3 = () => import('./pages/case-studies/wrapped.astro.mjs');
const _page4 = () => import('./pages/contact.astro.mjs');
const _page5 = () => import('./pages/demos.astro.mjs');
const _page6 = () => import('./pages/projects.astro.mjs');
const _page7 = () => import('./pages/promotional_kiosk_case_study.astro.mjs');
const _page8 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["src/pages/case-studies/automation.astro", _page0],
    ["src/pages/case-studies/kiosk.astro", _page1],
    ["src/pages/case-studies/product-tour.astro", _page2],
    ["src/pages/case-studies/wrapped.astro", _page3],
    ["src/pages/contact.astro", _page4],
    ["src/pages/demos.astro", _page5],
    ["src/pages/projects.astro", _page6],
    ["src/pages/promotional_kiosk_case_study.md", _page7],
    ["src/pages/index.astro", _page8]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = undefined;
const _exports = createExports(_manifest);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
