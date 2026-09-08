---
title: "Every asset URL Vite emits is prefixed with base, and a mismatch between that value and the real deployment path is the single most common way a green build ships a blank page"
sidebar_label: "01 · base and the deploy path"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Public Base Path](https://vite.dev/guide/build#public-base-path), [`base` config](https://vite.dev/config/shared-options#base), [Command Line Interface](https://vite.dev/guide/cli), [Advanced Base Options](https://vite.dev/guide/build#advanced-base-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `base`: the config that decides whether your build even loads

**`base` is the one setting Vite rewrites into every generated URL, and it has no way to detect that you got it wrong.** Vite does not know where you're going to deploy the build — it only knows what you told it in `vite.config.ts` or on the CLI. If that value does not exactly match the path the file server actually exposes, every `<script>`, `<link>`, and CSS `url()` in the output points at a URL that does not exist. The build succeeds, the deploy succeeds, and the page that loads is blank, because none of its JavaScript ever ran. This chunk is the mechanism behind that failure and every variant of it. The shape of `dist/` is **[01a](01a-outdir-assetsdir-and-the-dist-shape.md)**, the `public/` directory is **[01b](01b-public-directory-and-publicdir.md)**, `vite preview` is **[01c](01c-vite-preview-is-not-a-production-server.md)**, host-specific SPA routing is **[01d](01d-spa-fallback-hosted-platforms.md)** and **[01e](01e-spa-fallback-self-managed-infrastructure.md)**, and cache headers are **[01f](01f-caching-strategy-and-library-mode-deployment.md)**.

## What `base` actually rewrites

> *"If you are deploying your project under a nested public path, simply specify the [`base` config option](https://vite.dev/config/shared-options.md#base) and all asset paths will be rewritten accordingly. This option can also be specified as a command line flag, e.g. `vite build --base=/my/public/path/`."*

> *"JS-imported asset URLs, CSS `url()` references, and asset references in your `.html` files are all automatically adjusted to respect this option during build."*

That is the full scope: static imports, CSS `url()`, and the references Vite itself writes into `index.html` (`<script type="module" src="...">`, `<link rel="stylesheet">`, `<link rel="modulepreload">`). It is a build-time text rewrite — Vite has already resolved every reference by the time it emits the file, and it prepends `base` to each one it controls.

What it does **not** rewrite: any URL your own code constructs at runtime that isn't one of the forms above — a hand-written `fetch('/api/users')`, a string built by concatenating a path yourself, or a URL baked into a config file that isn't part of the module graph. Those need the explicit escape hatch below, and this is the split most people miss:

```ts
// ❌ WRONG — this string is never touched by base rewriting. It always resolves
// against the domain root, regardless of what base is set to.
fetch('/data/report.json')

// ✅ CORRECT — import.meta.env.BASE_URL is the public base path, statically
// available at both dev and build time.
fetch(`${import.meta.env.BASE_URL}data/report.json`)
```

> *"The exception is when you need to dynamically concatenate URLs on the fly. In this case, you can use the globally injected `import.meta.env.BASE_URL` variable which will be the public base path. Note this variable is statically replaced during build so it must appear exactly as-is (i.e. `import.meta.env['BASE_URL']` won't work)."*

That last sentence is a hard constraint, not a stylistic preference — `import.meta.env['BASE_URL']` compiles, runs in dev, and then silently is **not** replaced at build time because the replacement is a textual match on `import.meta.env.BASE_URL`, not a general property-access analysis.

## Valid values, and what each one buys you

> *"Base public path when served in development or production. Valid values include:
> * Absolute URL pathname, e.g. `/foo/`
> * Full URL, e.g. `https://bar.com/foo/` (The origin part won't be used in development so the value is the same as `/foo/`)
> * Empty string or `./` (for embedded deployment)"*

Default is `/`.

```ts
// vite.config.ts — three real shapes, pick the one that matches the target
import { defineConfig } from 'vite';

export default defineConfig({
  // Root-domain deploy: https://example.com/
  base: '/',
});
```

```ts
// vite.config.ts — sub-path deploy: https://example.com/my-app/
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/my-app/', // trailing slash included — every emitted URL is prefixed with this exact string
});
```

```ts
// vite.config.ts — a full origin is legal too. In dev the origin part is dropped,
// so this behaves exactly like base: '/my-app/' locally, and only pins the CDN
// origin into every asset URL once you actually build.
import { defineConfig } from 'vite';

export default defineConfig({
  base: 'https://cdn.example.com/my-app/',
});
```

## Setting `base` per environment: the CLI flag, not a second config file

`base` does not have to be a static string in `vite.config.ts`. The CLI flag overrides it for a single invocation, which is how one build command produces different output for a preview deployment on a PR-numbered sub-path versus the production root:

```bash
# Preview build for PR #482, deployed under /preview/482/
vite build --base=/preview/482/

# Production build for the root domain
vite build --base=/
```

The `--base <path>` flag exists identically on `vite`, `vite build`, `vite optimize`, and — the one people forget — `vite preview`, all documented in the [CLI reference](https://vite.dev/guide/cli) as *"Public base path (default: `/`)"*. A local sanity check that does not pass the same `--base` the real deploy will use is not actually checking anything; see **[01c](01c-vite-preview-is-not-a-production-server.md)**.

## Relative base — `'./'` or `''`

> *"If you don't know the base path in advance, you may set a relative base path with `"base": "./"` or `"base": ""`. This will make all generated URLs to be relative to each file."*

This is the right answer when the same build artifact gets deployed to an unpredictable or varying path — embedded in a CMS, mounted under a customer-specific prefix, shipped inside another app's static assets. The cost:

> *"`import.meta` support is required for relative bases. If you need to support browsers that do not support `import.meta`, you can use [the `legacy` plugin](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)."*

And there is a second, sharper cost that the docs state as a side effect of `build.modulePreload` rather than as a warning of its own:

> *"By default, an absolute path including the `base` will be used when loading these dependencies. If the `base` is relative (`''` or `'./'`), `import.meta.url` is used at runtime to avoid absolute paths that depend on the final deployed base."*

Vite compensates for its own module-preload links by switching to `import.meta.url` resolution — but a relative `<script>` or `<link>` written by anything **other** than Vite's own emitted references still resolves against the *current document's URL*, not the site root. That is ordinary browser URL resolution, and it is why relative base and client-side routing interact badly — see the first Gotcha below.

## Advanced base options — splitting entry HTML, assets, and `public/` across paths

⚠️ **Experimental** as of this writing. A single static `base` assumes the entry HTML, the hashed JS/CSS, and the copied `public/` files all live under one path. If you're serving hashed assets from a CDN origin but keeping `index.html` on your own domain — a common split for the caching reasons covered in **[01f](01f-caching-strategy-and-library-mode-deployment.md)** — one `base` cannot express that, and `experimental.renderBuiltUrl` can:

```ts
// vite.config.ts — hashed assets and public/ files served from different origins
import type { UserConfig } from 'vite';

const config: UserConfig = {
  experimental: {
    renderBuiltUrl(filename, { hostId, hostType, type }) {
      if (type === 'public') {
        return 'https://www.example.com/' + filename;
      } else if (hostType === 'js') {
        return { runtime: `window.__assetsPath(${JSON.stringify(filename)})` };
      } else {
        return 'https://cdn.example.com/assets/' + filename;
      }
    },
  },
};
export default config;
```

Treat a change to this as reversible tuning specifically because it is flagged experimental — do not build a deploy pipeline that depends on its exact shape staying stable across minors.

## Gotchas

**★ Symptom: build succeeds, deploy succeeds, live site is a blank page with a console full of 404s for `/assets/*.js`.** Cause: `base` was left at its default `'/'` while the app is served from a sub-path (GitHub Pages under a repo name is the textbook case: `https://team.github.io/project-name/` with `base` still `'/'`). Every emitted asset URL points at `https://team.github.io/assets/...` instead of `https://team.github.io/project-name/assets/...`. Fix: set `base` to the exact sub-path, trailing slash included: `base: '/project-name/'`.

**★ Symptom: assets load fine at the site root, but a client-side route two levels deep (`/app/settings/profile`) shows a blank page after a full-page reload or a direct link, while the same route works fine navigated to from within the app.** Cause: `base` is set to a relative value (`'./'`), and a `<script src="./assets/main.js">` resolves against the *current document URL*, not the site root — a page served at `/app/settings/profile` resolves `./assets/main.js` to `/app/settings/assets/main.js`, which does not exist. This is a straightforward consequence of *"all generated URLs to be relative to each file"* combined with ordinary browser relative-URL resolution, not a bug. Fix: relative base is only safe when every entry point is served from the same directory depth — an SPA with history-mode routing and a rewrite rule that serves `index.html` at arbitrary depths (see **[01d](01d-spa-fallback-hosted-platforms.md)**) needs an absolute or full-URL `base`, not a relative one.

**★ Symptom: `import.meta.env.BASE_URL` compiles and runs correctly in `vite dev`, then the build output still contains the literal string `import.meta.env.BASE_URL` unreplaced, or a runtime `undefined`.** Cause: the replacement is a static textual match, and the reference was written in a form the replacer doesn't recognise — bracket notation (`import.meta.env['BASE_URL']`), destructuring (`const { BASE_URL } = import.meta.env`), or building the property name dynamically. The docs are explicit that it *"must appear exactly as-is."* Fix: always write it as the literal dotted expression `import.meta.env.BASE_URL` at the call site.

**★ Symptom: a locally-run `vite build && vite preview` looks perfect, and the identical artifact 404s on the real host.** Cause: the local preview was never given the same `--base` the production deployment path requires — by default `vite preview` serves the build at the domain root, which matches a `base: '/'` build but not a `base: '/project-name/'` one. Fix: `vite build --base=/project-name/ && vite preview --base=/project-name/` — matching flags, not just a re-run. Full treatment in **[01c](01c-vite-preview-is-not-a-production-server.md)**.

**★ Symptom: the app was fine locally and in a manual deploy, then broke the moment CI started producing preview builds for every PR under a numbered sub-path.** Cause: `base` was hardcoded in `vite.config.ts` for the one path that existed when the project was set up, and a config file cannot know a PR number at write time. Fix: leave the config file's `base` as the production value and override it at build time from CI, per-environment: `vite build --base=/preview/${PR_NUMBER}/` for preview jobs, plain `vite build` (using the config default) for the production job.

**★ Symptom: someone "future-proofed" `base` by setting it to a full CDN URL, and now every environment — including local dev — has to reach that CDN to load a single script tag.** Cause: a full URL is a legal `base` value, but *"the origin part won't be used in development so the value is the same as `/foo/`"* only for dev — at build time the full origin **is** baked into every emitted reference, so moving hosts, or testing against a staging CDN, means rebuilding rather than reconfiguring the server. Fix: keep `base` as an absolute path (`/foo/`) unless you specifically need assets pinned to a fixed CDN origin that will not change without a redeploy anyway.

## Interview questions

**★ Why does Vite need a `base` setting at all — doesn't the browser already know its own URL?**
The browser knows the URL of the page it loaded, but Vite has to decide, at build time, what URL string to write into `<script src="...">`, `<link href="...">`, and every CSS `url()` — those strings are static text in files that get uploaded somewhere Vite has no visibility into. If the build always emitted root-relative paths (`/assets/main.js`) and the site is served from a sub-path, that reference is simply wrong regardless of what the browser later does with it. `base` is Vite's only signal for "this is where these files will actually live," supplied at build time because the deploy target is not otherwise knowable from the source tree.

**★ What's the practical difference between `base: '/my-app/'` and `base: 'https://cdn.example.com/my-app/'`?**
Both work identically for the browser once assets are prefixed. The difference is what happens in development and what happens if you change hosts. In dev, a full URL's origin is dropped and it behaves exactly like the absolute-path form — so you cannot use it to test against a real CDN locally. In production, the full URL is what actually gets written into the bundle, which means the CDN origin is compiled into the artifact: moving to a different CDN, or serving the same build from two different domains, requires a rebuild, not a config change on the server. An absolute path keeps the origin decision at the server/proxy layer instead of baking it into the JavaScript.

**★ A relative base (`'./'`) works when you load the app at `/`, and breaks when a deep link (`/app/settings`) is opened directly. Why, mechanically?**
Because `base: './'` makes every emitted reference relative to the HTML document that contains it, and relative URLs resolve against the *current document's location*, not the site root. When the deep link is served — typically by a host-level SPA fallback rule that returns the same `index.html` for any unmatched path — the browser is looking at a document whose URL is `/app/settings`, so `./assets/main.js` resolves to `/app/assets/main.js`, one directory off from where the file actually lives. It only ever worked at `/` because `/` and the site root happen to coincide there. The fix is either an absolute `base` (`/`) or a full-URL `base`, both of which resolve identically no matter what path the browser thinks it's looking at.

**★ `vite build --base=/preview/482/` and a `base` value already set in `vite.config.ts` — which one wins, and why does the CLI flag exist at all if the config file already has the answer?**
The CLI flag overrides the config value for that invocation. It exists because `base` is frequently environment-dependent in a way a single static config value cannot express — a monorepo deploying dozens of numbered preview environments under different sub-paths from one CI pipeline cannot hardcode all of them, and does not want to template `vite.config.ts` per build. Passing `--base` at build time keeps the config file describing the *production* shape while letting CI supply the one value that actually varies per run.

**★ Why does the GitHub Pages sub-path mistake produce a completely blank page instead of a partially broken one?**
Because the failure is in loading the JavaScript itself, not in something the JavaScript does. `index.html` loads fine — it's served correctly regardless of `base`, since the host is just returning a static file at a known path. But every `<script type="module" src="...">` inside it points at the wrong URL, so the browser's very first request for the app's code 404s. Nothing in the SPA ever executes: no router, no component tree, no fallback UI, because there was never any JavaScript running to produce one. The `<body>` renders whatever static markup was in `index.html` before the app mounts — usually nothing — which is why the failure mode is specifically a blank page rather than a broken-looking one.

---

← [01i · Migrating from Jest](../14-testing-integration/01i-migrating-from-jest.md) · [Vite overview](../../README.md) · Next → [01a · The shape of dist/](01a-outdir-assetsdir-and-the-dist-shape.md)
