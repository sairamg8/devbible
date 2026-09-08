---
title: "The modulepreload polyfill is imported automatically into a Vite-built index.html but not into a backend template you write by hand, and forgetting it only breaks the one browser you never test in"
sidebar_label: "01l · Module preload & the polyfill"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Build Options](https://vite.dev/config/build-options) (`build.modulePreload`), [Backend Integration](https://vite.dev/guide/backend-integration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**Vite's automatic `<link rel="modulepreload">` emission and its `resolveDependencies` hook are covered from the performance-mechanism angle in 11 · Optimization and performance at [`01g-preloading-and-cache-granularity.md`](../11-optimization-and-performance/01g-preloading-and-cache-granularity.md) — the waterfall it eliminates, the automatic rewriting of dynamic imports.** This chunk is narrower and specifically deployment-shaped: what `build.modulePreload`'s polyfill actually is, why a hand-written backend template — the same one from [01k](01k-manifest-and-backend-integration.md) — has to import it explicitly where a Vite-managed `index.html` never does, and how the decision connects back to [01g](01g-build-target-and-legacy-browsers.md)'s browser-support floor.

## The polyfill, and why a Vite-authored HTML entry never needs to think about it

`build.modulePreload` defaults to `{ polyfill: true }`, and the default behavior is silent because Vite handles it for you **when it owns the HTML file**: it automatically injects the polyfill script alongside the `<link rel="modulepreload">` tags it generates for entry chunks. There is nothing to configure for a standard SPA build with an `index.html` entry — this default is precisely why most Vite projects never encounter the polyfill as a concept at all.

- *"The polyfill can be disabled using `{ polyfill: false }`."* — [Build Options](https://vite.dev/config/build-options)
- **`resolveDependencies`** — *"Fine grained control over the dependencies list and their paths"* via a callback function, for cases where the default dependency list Vite computes isn't right for how you're serving the app (a non-standard `base`, a CDN rewrite, dependencies you want deliberately excluded from preloading).

The polyfill exists because `<link rel="modulepreload">` itself is not universally supported — a browser that doesn't understand the tag simply ignores it, which means no preloading happens and the page still works, just without the parallel-fetch optimization. The polyfill's job is different: it retrofits the *behavior* (fetching and caching the dependency graph ahead of need) in browsers that lack native support, using a JavaScript-based implementation instead of the native browser feature.

## Where it stops being automatic: a backend template you wrote yourself

`01k` established that a backend-rendered app's HTML is not a Vite build artifact — it's a template a human wrote, and it reads `build.manifest` to know what tags to emit. Because Vite never touches that template file, **the automatic polyfill injection that happens for a Vite-managed `index.html` does not happen here.** The guide states the obligation directly:

> *"If you haven't disabled the module preload polyfill, you also need to import the polyfill in your entry"* — `import 'vite/modulepreload-polyfill'`, placed *"at the beginning of your app entry."* — [Backend Integration](https://vite.dev/guide/backend-integration)

```javascript
// src/main.js — the very first line, before anything else runs
import 'vite/modulepreload-polyfill';

import { createApp } from './app';
createApp().mount('#root');
```

This is an easy step to miss precisely because nothing fails loudly when it's skipped. Every modern evergreen browser already supports `<link rel="modulepreload">` natively, so a backend integration that forgets the polyfill import will work correctly in ordinary manual testing — Chrome, Edge, Firefox, Safari — and only fail, silently losing the parallel-fetch benefit (never a hard error, since the tag is simply ignored where unsupported) on whatever fraction of traffic is on a browser without native support.

## The connection back to `build.target`

Whether the polyfill is worth carrying at all is the same question `01g` asks about `build.target` and `@vitejs/plugin-legacy`: **what does your actual browser-support floor include?** `<link rel="modulepreload">` has broader native support than some of the newer syntax Oxc might otherwise emit, so a project that has already pinned `build.target` to a reasonably modern, explicit floor may find that every browser in that floor supports the tag natively — making the polyfill dead weight, not a safety net.

```typescript
// vite.config.ts — disabling the polyfill deliberately, once the target floor is known
// to fully cover native <link rel="modulepreload"> support.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
    modulePreload: { polyfill: false },
  },
});
```

This is a decision to make deliberately, not a default to flip speculatively — disabling the polyfill without first confirming your actual `build.target` floor has native support is trading a small, invisible performance optimization on old browsers for total silence on those browsers if the assumption turns out to be wrong (the page still renders; it just never gets the parallel-fetch benefit, and there is no error to notice the gap by).

## `resolveDependencies` — when the default preload list is wrong for how you serve the app

The default dependency list Vite computes assumes assets are served from the same origin at the path Vite built them for. That assumption breaks under a couple of deployment shapes worth naming explicitly: assets served from a CDN with a different origin than the HTML, or a deliberate choice to exclude a large, rarely-needed chunk from preloading even though it is technically a static import.

```typescript
// vite.config.ts — rewriting preload paths for assets served from a separate CDN origin
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    modulePreload: {
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        return deps
          .filter((dep) => !dep.includes('rarely-used-admin-chunk'))
          .map((dep) => `https://cdn.acme.com/${dep}`);
      },
    },
  },
});
```

Getting this wrong produces preload requests pointed at URLs that 404 — the browser still renders the page correctly (a preload hint failing is not a fatal error, only a wasted request), which is exactly why this class of misconfiguration tends to sit unnoticed in a network tab full of red rather than surfacing as a user-visible bug.

## Gotchas

**★ Symptom: a Rails/Laravel/Django-rendered page works correctly on every browser the team actually tested, and an analytics dashboard later shows a slow-loading tail on some fraction of real traffic with no other explanation.** Cause: the backend template's entry script never imported `vite/modulepreload-polyfill`, so browsers without native `<link rel="modulepreload">` support silently skip the preload hints and fall back to discovering each dependency one round trip at a time — a real but invisible performance regression, not an error. Fix: add the import as the literal first line of the app entry, exactly as the backend integration guide specifies.
```javascript
import 'vite/modulepreload-polyfill';
```

**★ Symptom: `build.modulePreload: { polyfill: false }` was set to shave a few bytes, and the page is functionally fine everywhere the team tests it, so the change looked safe.** Cause: disabling the polyfill without first confirming that every browser in your actual `build.target` floor has native `<link rel="modulepreload">` support removes a fallback for browsers that might still be in scope — and because a missing preload hint fails silently rather than loudly, the gap would never surface as a bug report, only as unexplained tail latency. Fix: cross-check the disable against the explicit browser list from `build.target` (see [01g](01g-build-target-and-legacy-browsers.md)) before flipping it, not against "the browsers on my desk."

**★ Symptom: preload requests in the network tab point at URLs that 404, but the page renders and functions normally.** Cause: a custom `resolveDependencies` rewrite produced incorrect paths — commonly a CDN origin prefix applied inconsistently, or a filter that excluded a chunk the page still statically imports elsewhere. Fix: preload failures are non-fatal by design, which is exactly why they go unnoticed; audit `resolveDependencies`' output against the actual deployed asset paths rather than trusting it silently.

## Interview questions

**★ Why does a standard Vite SPA project never need to think about `vite/modulepreload-polyfill`, while a Rails or Laravel integration explicitly must import it?**
Because the polyfill injection is tied to Vite owning the HTML file it emits. In a standard SPA build, `index.html` is itself a build input, and Vite's build process injects both the `<link rel="modulepreload">` tags and the polyfill script into that file automatically as part of generating it — there is no manual step because there is no manual file. A backend-rendered app's HTML template is written by a human, outside any file Vite's build touches, so nothing Vite does can reach into it and add the polyfill import for you. The backend integration guide's fix is to move the responsibility into application code instead — importing the polyfill as literally the first statement in the JavaScript entry point, so it runs regardless of what HTML template loaded that entry.

**★ Someone disables `build.modulePreload`'s polyfill "because nobody uses old browsers anymore," and it works in every test the team runs. What's actually being risked, and why wouldn't a test catch it?**
What's being risked is silent, not broken, behavior on any browser without native `<link rel="modulepreload">` support: the tag is simply ignored by an unsupporting browser, the page still loads and functions correctly, it just loses the parallel dependency-fetch optimization and falls back to discovering imports one network round trip at a time. Because there is no error, no console warning, and no visual difference — only slightly higher latency before the app becomes interactive — no functional test would ever catch the regression; it would only show up as an unexplained tail in real-user performance monitoring on whatever fraction of traffic the team assumed didn't exist. The correct verification is checking the explicit `build.target` browser list, not personal testing habits, since `build.target` is the actual documented floor of what the site claims to support.

---

← [01k · Manifest & backend integration](01k-manifest-and-backend-integration.md) · [Vite overview](../../README.md) · Next → [01m · Content-Security-Policy](01m-content-security-policy.md)
