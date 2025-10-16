globalThis.process ??= {}; globalThis.process.env ??= {};
import { r as renderers } from './chunks/_@astro-renderers_D7dcpnAi.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CQvIAXE6.mjs';
import { manifest } from './manifest_DxYpf-P2.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/about.astro.mjs');
const _page1 = () => import('./pages/article_automation_case_study_updated.astro.mjs');
const _page2 = () => import('./pages/case-studies/automation.astro.mjs');
const _page3 = () => import('./pages/case-studies/kiosk.astro.mjs');
const _page4 = () => import('./pages/case-studies/product-tour.astro.mjs');
const _page5 = () => import('./pages/contact.astro.mjs');
const _page6 = () => import('./pages/demos.astro.mjs');
const _page7 = () => import('./pages/promotional_kiosk_case_study.astro.mjs');
const _page8 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["src/pages/about.md", _page0],
    ["src/pages/article_automation_case_study_updated.md", _page1],
    ["src/pages/case-studies/automation.astro", _page2],
    ["src/pages/case-studies/kiosk.astro", _page3],
    ["src/pages/case-studies/product-tour.astro", _page4],
    ["src/pages/contact.astro", _page5],
    ["src/pages/demos.astro", _page6],
    ["src/pages/promotional_kiosk_case_study.md", _page7],
    ["src/pages/index.astro", _page8]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
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
