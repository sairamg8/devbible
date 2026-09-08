---
title: "The dev proxy, the test runner, and the PWA setup are three CRA conveniences that were each doing more configuration work invisibly than their one-line CRA surface suggested, and each one needs an explicit Vite equivalent naming the parts CRA never made you think about"
sidebar_label: "01e · Proxy, tests, PWA"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [`server.proxy`](https://vite.dev/config/server-options.md), the Create React App documentation — [Making a Progressive Web App](https://create-react-app.dev/docs/making-a-progressive-web-app/), and the [Vite PWA](https://vite-pwa-org.netlify.app/guide/) documentation. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The dev proxy, tests, and the PWA setup: three one-line CRA features that were never actually one line

**Each of these three CRA features looks trivial in `package.json` or `src/index.js` and hides real configuration surface behind that simplicity.** CRA's `"proxy"` field is one string; `server.proxy` in Vite needs the per-path rules CRA's `setupProxy.js` escape hatch already required for anything non-trivial. `react-scripts test` looks like it needs no config at all, because the config was never a file you could open. CRA's service worker toggle is a single function call whose actual behaviour — a deliberately conservative update strategy — is easy to misread as a bug. This chunk covers all three at migration depth; the test section stays short and points at where this corpus already covers Vitest in full.

## The dev proxy: CRA's one string, or `setupProxy.js`, become `server.proxy`

CRA's `package.json` `"proxy"` field is the whole story for the simple case: one origin, every unmatched request forwarded to it.

```json
// package.json — CRA, the simple case: ONE backend, no path rules
{
  "proxy": "http://localhost:5000"
}
```

Anything beyond a single blanket target — multiple backends, path rewriting, custom headers — required CRA's other mechanism, `src/setupProxy.js`, a file exporting a function that wires up `http-proxy-middleware` by hand:

```javascript
// src/setupProxy.js — CRA's escape hatch once "proxy": "..." wasn't enough
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    }),
  );
};
```

Vite's `server.proxy` covers both cases in one config shape — a map from path pattern to target, string or options object:

> *"an object of `{ key: options }` pairs"* — [`server.proxy`](https://vite.dev/config/server-options.md), type `Record<string, string | ProxyOptions>`. Keys starting with `^` are RegExp patterns; matched requests bypass Vite's own transform pipeline entirely.

```typescript
// vite.config.ts — the CRA app's two proxy behaviours, unified into one config
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // simple string form — equivalent to CRA's whole-app "proxy" field,
      // but scoped to one path prefix instead of catching everything unmatched
      '/legacy': 'http://localhost:4567',

      // options form — equivalent to the setupProxy.js rewrite above
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },

      // RegExp key form — for path SHAPES rather than a fixed literal prefix
      '^/fallback/.*': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fallback/, ''),
      },

      // WebSocket proxying — setupProxy.js needed `ws: true` on the middleware too;
      // Vite's shape is the same option, just declared here instead
      '/socket.io': {
        target: 'ws://localhost:5174',
        ws: true,
      },
    },
  },
});
```

`changeOrigin` rewrites the outbound request's `Host` header to match the target, which most local backends expect and CRA's proxy set by default for the simple string form — an options-object migration from `setupProxy.js` needs to set it explicitly, since it is not implied by giving a `target`. `rewrite` is a function over the path string, direct equivalent to `http-proxy-middleware`'s `pathRewrite` map — the difference is shape (a function versus a regex-keyed object), not behaviour.

## Tests: `react-scripts test` had invisible Jest config; Vitest reuses your real config

CRA bundled Jest configuration inside `react-scripts` itself — there was never a `jest.config.js` to open, because the whole point of CRA was that you did not configure it. Moving to Vite means adopting an actual test runner, and Vitest is the natural pick specifically because it reads `vite.config.ts` directly rather than needing a second, separately-maintained transform pipeline:

```typescript
// vite.config.ts — adding a `test` block is the whole migration step at this level
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

```json
// package.json
{
  "scripts": {
    "test": "vitest"
  }
}
```

**Every real difference between Jest's behaviour and Vitest's — globals, mock factory shape, `__mocks__` auto-loading, hook ordering, fake timers, `moduleNameMapper` → `resolve.alias` — is already written up at migration depth in this corpus and is not repeated here:** **[14 · Migrating from Jest](../14-testing-integration/01i-migrating-from-jest.md)**. Read that chunk before touching a single test file; the failures it documents (a `jest.mock` → `vi.mock` rename that silently returns `undefined`, hook ordering flips) are exactly what a CRA test suite hits first.

## Service worker and `manifest.json`: CRA's opt-in toggle, Vite's plugin-generated equivalent

CRA's default template registers **no** service worker — offline support was opt-in, a single function-call flip a developer had to make deliberately:

> *"switching `serviceWorker.unregister()` to `serviceWorker.register()` will opt you in to using the service worker."* — [Making a Progressive Web App](https://create-react-app.dev/docs/making-a-progressive-web-app/)

The behaviour once registered is deliberately conservative about updates, which is worth restating exactly because it reads like a bug the first time a team hits it:

> *"the default behavior is to conservatively keep the updated service worker in the 'waiting' state. This means that users will end up seeing older content until they close (reloading is not enough) their existing, open tabs."*

`manifest.json` is a static file CRA scaffolds and expects you to hand-edit:

> *"The default configuration includes a web app manifest located at `public/manifest.json`, that you can customize with details specific to your web application."*

Vite's equivalent, `vite-plugin-pwa`, moves the manifest from a hand-maintained static file into config, generating both the manifest and the service worker from it:

```bash
npm install --save-dev vite-plugin-pwa
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Acme Dashboard',
        short_name: 'Acme',
        description: 'Internal operations dashboard',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

> *"your application is now able to generate the Web App Manifest and inject it at the entry point, generate the service worker and register it in the browser."* — [Vite PWA — Getting Started](https://vite-pwa-org.netlify.app/guide/)

The `manifest` object above **replaces** `public/manifest.json` as the source of truth — delete the static file once the fields are ported into config, rather than keeping both. `registerType` is the direct decision CRA's `register()`/`unregister()` toggle made implicitly: `'prompt'` mirrors CRA's conservative default (an update sits waiting until the user is told and acts), `'autoUpdate'` forces immediate activation of a new service worker on the next load — the opposite default from CRA's, and worth choosing deliberately rather than defaulting to during a migration, since it changes what "old content until you close every tab" actually means for your users.

## Gotchas

**★ Symptom: `setupProxy.js`'s `pathRewrite: { '^/api': '' }` has no direct equivalent field in `server.proxy`'s options object, and someone leaves the rewrite out entirely, breaking every proxied request's path.** Cause: the field is named differently and shaped differently — a function over the path string, not a regex-keyed replacement map. Fix: port each `pathRewrite` entry to a `rewrite` function.
```typescript
rewrite: (path) => path.replace(/^\/api/, ''),
```

**★ Symptom: a proxied request that worked under `setupProxy.js` now gets rejected by the target backend with a Host-header mismatch error.** Cause: CRA's simple string-form `"proxy"` field set `changeOrigin`-equivalent behaviour implicitly; a migrated options-object entry in `server.proxy` does not unless you set `changeOrigin: true` yourself. Fix: add it explicitly to every options-object proxy entry pointed at a backend that checks its `Host` header.

**★ Symptom: `git mv`-ing `src/setupProxy.js` out of the project and deleting `http-proxy-middleware` from `package.json` breaks a WebSocket connection that used to work.** Cause: `setupProxy.js` needed `ws: true` passed to `createProxyMiddleware` explicitly for WebSocket upgrade support; `server.proxy` needs the exact same explicit `ws: true` on the matching entry, and it is easy to port the HTTP rules and miss the WebSocket-specific one during the same pass. Fix: check every `setupProxy.js` middleware call for `ws: true` before deleting the file, and carry it over.
```typescript
'/socket.io': { target: 'ws://localhost:5174', ws: true },
```

**★ Symptom: a migrated Jest suite passes locally under `vitest` but a mocked module now returns `undefined` where a value was mocked correctly under Jest.** Cause: this is the Jest/Vitest mock-factory return-shape difference, not a proxy or PWA issue — full diagnosis and fix in **[14 · Migrating from Jest](../14-testing-integration/01i-migrating-from-jest.md)**. Fix: read that chunk before auditing test files one at a time; the failure pattern is already catalogued there.

**★ Symptom: after adding `vite-plugin-pwa` with `registerType: 'autoUpdate'`, users report the app "changed under them" mid-session — a form they were filling in reset, or a modal closed unexpectedly.** Cause: `autoUpdate` activates a new service worker immediately, which is the opposite default from CRA's conservative "wait until every tab is closed" behaviour; a CRA app migrating without deciding on this deliberately inherits a meaningfully different update experience than the one CRA shipped for years. Fix: use `registerType: 'prompt'` if the CRA app relied on the conservative default, and surface the "an update is available" state to the user explicitly rather than silently swapping content underneath them.

**★ Symptom: `public/manifest.json` still exists after adding `VitePWA({ manifest: {...} })`, and its fields disagree with the ones in `vite.config.ts` — different icon paths, different `theme_color`.** Cause: leaving the static file in place after porting its fields into config creates two sources of truth for the same data, and depending on build ordering, either one can end up referenced by different parts of the app. Fix: delete `public/manifest.json` once every field is ported into the `manifest` config object — the plugin generates the file for you at build time.

## Interview questions

**★ Why does `server.proxy` need `changeOrigin: true` set explicitly when CRA's simple `"proxy": "http://localhost:5000"` field didn't require anything like it?**
Because CRA's single-string proxy field is a fixed, opinionated preset built specifically for the common local-backend case, and it applied `changeOrigin`-equivalent behaviour as part of that preset without exposing the option at all. Vite's `server.proxy` is the general-purpose configuration surface — the same shape used for the RegExp-keyed, `rewrite`-function, WebSocket-proxying cases that CRA needed a whole separate file (`setupProxy.js`) to express — and a general-purpose tool does not silently assume a default that's only correct for the simplest case. The cost of that generality is that every option, including the one CRA's simple form gave you for free, needs to be named.

**★ Why is `vite-plugin-pwa`'s `registerType: 'autoUpdate'` a meaningfully risky default to reach for during a migration, specifically, rather than in a brand-new app?**
Because a CRA app that had a service worker registered at all was, by CRA's own default, running the conservative update strategy — new content held in a "waiting" state until every open tab closes, specifically to avoid yanking content out from under an active user session. `autoUpdate` is the opposite policy: it activates new content immediately. A brand-new app choosing `autoUpdate` from day one is a deliberate, informed choice about what "immediately" means for that specific app's users. A migrated app inheriting `autoUpdate` as an unexamined default is silently *changing* a production behaviour real users have been depending on, which is a different risk profile than picking a policy for a system that has no existing users' expectations to violate.

**★ A team wants to know exactly what changed in test behaviour after moving from `react-scripts test` to `vitest`, without reading every diff by hand. What's the fastest way to find out?**
There isn't a diff to read, because CRA's Jest configuration was never a file — `react-scripts test` bundled its Jest config internally, invisible to the project, so there is no "before" config to compare a "after" `vite.config.ts` `test` block against. The fastest actual path is **[14 · Migrating from Jest](../14-testing-integration/01i-migrating-from-jest.md)**, which catalogues every documented default-shape mismatch between Jest and Vitest (globals, mock factories, `__mocks__` auto-loading, hook ordering, fake timers, `moduleNameMapper`) directly from Vitest's own migration guide plus the gaps that guide does not cover — that list *is* the diff, reconstructed from what changed structurally rather than from any file this migration could have compared.

---

← [01d · SVG imports](01d-svg-imports.md) · [Vite overview](../../README.md) · Next → [01f · Eject and CRACO apps](01f-eject-and-craco-codebases.md)
