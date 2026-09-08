---
title: "Every independently deployed frontend piece has to answer one question correctly or it 404s in production and nowhere else — when this bundle asks for its own chunk, what URL does it emit — and base is the whole of Vite's answer"
sidebar_label: "07 · base and asset URLs"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Building for Production](https://vite.dev/guide/build.md) (`base`, advanced base options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**A build served from the origin it was built for works whether or not anyone thought
about `base` at all — every relative path in the bundle resolves correctly by accident,
because the page loading the assets and the assets themselves share an origin. The moment
any piece of a microservices frontend moves — served under a path prefix behind a gateway,
served from a CDN on its own origin, loaded as a Module Federation remote into a host it
has never met — that accident stops covering for you, and every asset URL the bundle
emits has to be deliberately correct instead. `base` is Vite's single config key for that
question, and `import.meta.env.BASE_URL` is how your own code answers it consistently.
The continuation of this page —
[07b](07b-server-origin-manifest-and-the-router-basename.md) — covers
`experimental.renderBuiltUrl`, `server.origin` and `build.manifest`, the three mechanisms
that exist for the cases `base` alone cannot express.**

## `base` — the three shapes, and which deployment each is for

The guide states the default case plainly:

> *"If you are deploying your project under a nested public path, simply specify the
> `base` config option and all asset paths will be rewritten accordingly."*

That single option takes three genuinely different shapes, and each maps to a different
deployment topology in this topic.

**1. An absolute path — `/app-a/`.** The build is served from the same origin as the
page that loads it, but not from that origin's root — a gateway or reverse proxy routes
`https://example.com/app-a/*` to this bundle's files. Every asset URL Vite emits is
rewritten to carry that prefix: `assets/main-a1b2c3.js` becomes
`/app-a/assets/main-a1b2c3.js`. This is the ordinary shape for "many independent
frontends behind one gateway, one origin, path-based routing" — see
[04 · one repo, many Vite apps](04-one-repo-many-vite-apps.md) for the workspace side of
that topology.

```ts
// vite.config.ts — app-a served at https://example.com/app-a/
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/app-a/',
});
```

**2. An absolute URL — `https://cdn.example.com/app-a/`.** The build's HTML may still be
served from `example.com`, but its JS, CSS and every other asset ship from a different
origin entirely — a CDN, an object-storage bucket, or (the case
[05 · Module Federation on Vite](05-module-federation-on-vite.md) already walks through)
another app's own dev server or deploy target, when this bundle is itself a federation
remote. This shape is not decoration; it is the only one of the three that survives the
page loading the bundle being on a *different* origin than the bundle's own files, which
is exactly what happens once a federation host fetches a remote's `remoteEntry.js`.

```ts
// vite.config.ts — assets served from a CDN, HTML served from elsewhere
import { defineConfig } from 'vite';

export default defineConfig({
  base: 'https://cdn.example.com/app-a/',
});
```

**3. `'./'` — relative to each file.** The guide is explicit about what this produces:

> *"This will make all generated URLs to be relative to each file."*

Every asset resolves relative to the file that references it rather than to the page's
root, which is the one shape that works when the deploy location genuinely is not known
at build time — the same build artefact copied to several different path prefixes without
a rebuild, or opened directly from the filesystem. It is the right default for a
standalone widget or an embeddable fragment; it is the wrong choice for anything that
imports across chunk boundaries at depth, because "relative to each file" has to hold for
every file the bundler split output into, not just the entry.

```ts
// vite.config.ts — location-agnostic output, no known deploy path at build time
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
```

## Automatic rewriting stops at your own string concatenation — `import.meta.env.BASE_URL`

`base` rewrites the asset paths Vite itself emitted — the `<script src>` and
`<link href>` in the built HTML, the URLs baked into JS for statically imported assets.
It does **not** reach into a string your own code builds by concatenation, because Vite
never sees that string as an asset reference at all — to the bundler it is just a
runtime `string`, indistinguishable from any other. This is the single most common bug
in the whole area, precisely because it is invisible until the day someone changes `base`:

```ts
// BROKEN — works in dev, works at the site root, 404s under any base prefix
function iconUrl(name: string): string {
  return '/icons/' + name + '.svg';
}
```

That string is never rewritten. It survives `vite dev` because `base` there usually
defaults to `/` and a leading `/icons/` happens to resolve correctly. It survives a root
deploy for the same reason. It breaks the day the app moves to `/app-a/` in production,
because the browser requests `/icons/gear.svg` — the site root — when the file actually
lives at `/app-a/icons/gear.svg`. Nothing in the build log says so; the failure is a
runtime `404` from the browser, in production only, for every dynamically built asset URL
at once.

The guide's fix is `import.meta.env.BASE_URL`, which **is** kept in sync with whatever
`base` resolved to for this build:

```ts
// FIXED — respects whatever base this build was configured with
function iconUrl(name: string): string {
  return import.meta.env.BASE_URL + 'icons/' + name + '.svg';
}
```

There is a second fix that needs no `base` awareness at all, because it lets the bundler
resolve the reference itself instead of asking your runtime string to guess correctly:

```ts
// Also correct — the bundler resolves this at build time, base is irrelevant here
function iconUrl(name: string): URL {
  return new URL(`./icons/${name}.svg`, import.meta.url);
}
```

`new URL('./relative/path', import.meta.url)` is a URL construction Vite statically
analyses at build time — the referenced file is treated as an asset, fingerprinted, and
the resulting URL is correct regardless of `base`, because it was never a bare string in
the first place. Prefer it over `BASE_URL` concatenation wherever the asset's path is
knowable at the call site; reach for `BASE_URL` only when the path itself is genuinely
dynamic (built from user input, a CMS response, or a route parameter) and a static
`import.meta.url` reference cannot express it.

## Absolute-URL `base` and the cross-origin consequences

Choosing shape 2 — `base` as an absolute URL on a different origin than the page — buys
independent asset deployment, and it also imports every restriction browsers place on
cross-origin resource loading. A same-origin deploy never surfaces any of the following;
an absolute-`base` deploy hits all of them the first time a resource type that needs CORS
shows up in the bundle.

**Fonts.** `@font-face` resource fetches are always made in CORS mode by the browser,
regardless of whether the CSS itself came from the same origin — this is a font-loading
requirement at the web-platform level, not something Vite or the CDN opts into. A font
file served from `base`'s CDN origin without an `Access-Control-Allow-Origin` header on
the response is fetched, then silently discarded by the browser: no console error names
the font, the page simply falls back to the next font in the stack as if the `@font-face`
rule had never matched. The fix is on the CDN, not in `vite.config.ts` — the origin
serving the font files has to answer with `Access-Control-Allow-Origin` covering the
page's origin.

**Web workers.** `new Worker(new URL('./worker.js', import.meta.url))` resolves the
worker script's URL against `import.meta.url`, which under an absolute `base` is the CDN
origin, not the page's own. Worker scripts are restricted far more strictly than a
`<script>` tag or a stylesheet: browsers have historically required a classic worker's
script to be same-origin with the page, independent of any CORS headers the response
carries — CORS does not lift this restriction the way it does for fetches, images or
fonts. (Whether current browsers relax this specifically for **module** workers fetched
with CORS is not something this page can confirm without a primary source to hand — treat
worker scripts as needing the same origin as the host page unless you have verified your
target browsers' current behaviour directly.) The dependable fix is to keep worker
scripts same-origin with the page — build them as part of the host bundle, or proxy the
CDN's worker file through the host's own origin — rather than trying to solve it with CDN
response headers.

**Dynamic `import()`.** An ES module fetched via dynamic `import()` is, like a font, always
fetched in CORS mode by the module-loading algorithm — this is intrinsic to how the spec
treats module scripts, not a Vite behaviour. A chunk on `base`'s CDN origin without CORS
headers fails to load, and the failure the browser surfaces is deliberately opaque:
`error loading dynamically imported module` (the wording browsers use varies; that phrasing
is a known example) — no origin named, no CORS header named, no HTTP status code in the
message at all. This is the exact failure mode a Module Federation remote hits if its CDN
is misconfigured, because `React.lazy` and federation's own remote loading are both dynamic
`import()` under the hood; see
[05a · shared dependencies and singleton breakage](05a-shared-dependencies-and-singleton-breakage.md)
for the sibling failure that looks similar but has a different cause. The fix is again on
the serving origin: the CDN response for every `.js` chunk needs
`Access-Control-Allow-Origin` for the host's origin, and the emitted `<script type="module">`
or `<link rel="modulepreload">` tag generally needs a `crossorigin` attribute for the
browser to make that CORS request and — separately — to report a readable error rather
than the sanitised, origin-hiding error message browsers give uncaught exceptions thrown
by cross-origin scripts loaded without it.

**Sourcemaps.** Browser devtools resolve a script's sourcemap URL relative to the script
itself — under an absolute `base`, that means fetching the `.map` file from the CDN
origin too. Without CORS on that response, devtools fails to load the map silently: the
application keeps running correctly, because sourcemaps are a devtools-only concern, but
production debugging degrades to minified stack traces with no way to map them back to
source, and nothing in the running application signals that this happened.

For the general treatment of production sourcemap trade-offs, independent of the
cross-origin question raised here, see
[15 · shipping the build](../15-deployment-considerations/01-shipping-the-build.md).

## Gotchas

**★ Symptom: every dynamically built image or icon URL 404s in production, but the app
worked in every environment up to that point.** Cause: an asset URL built by string
concatenation (`'/icons/' + name + '.svg'`) instead of read from
`import.meta.env.BASE_URL` — `base` only rewrites URLs Vite itself emitted, never a
runtime string your own code assembled. Fix: prefix with
`import.meta.env.BASE_URL`, or — where the path is knowable at the call site — use
`new URL('./icons/${name}.svg', import.meta.url)` so the bundler resolves it statically
and `base` never enters into it.

**★ Symptom: a Module Federation remote's chunks fetch from the wrong origin once loaded
into a host.** Cause: `base` (or `server.origin` in dev) was left relative or set to a
path rather than the remote's own absolute origin — this exact failure and fix is
[05](05-module-federation-on-vite.md)'s first gotcha; this page is the general mechanism
behind it, not a duplicate of it.

**★ Symptom: a font referenced from CSS never renders, falls back to the next font in the
stack, and no console error names it.** Cause: `@font-face` resource fetches are always
made in CORS mode by the browser; a `base`-hosted font on a CDN without
`Access-Control-Allow-Origin` is fetched then silently discarded. Fix: add the header on
the CDN response for the page's origin — there is no client-side fix, because the browser
never surfaces the failure to application code at all.

**Symptom: `error loading dynamically imported module` (or an equivalent opaque
module-loading failure) in the console, for a chunk that exists and returns `200` when
requested directly.** Cause: dynamic `import()` fetches modules in CORS mode
unconditionally; a chunk served from an absolute-URL `base` on a CDN without
`Access-Control-Allow-Origin` fails the CORS check and the browser reports a generic
loading failure rather than a CORS-specific one. Fix: CORS headers on the CDN response,
plus a `crossorigin` attribute on the emitted `<script type="module">` / `<link
rel="modulepreload">` tags so cross-origin script errors also report readable stack
traces instead of the browser's sanitised message.

**Symptom: production stack traces in an error-tracking tool are all minified,
unreadable code — sourcemaps upload succeeded and dev-tools shows real source locally.**
Cause: the deployed app's `base` points scripts at a CDN origin, and devtools resolves
each script's sourcemap relative to the script's own URL — without CORS on the `.map`
response, the browser fails to load it silently, with no user-facing symptom because
sourcemaps are a devtools-only concern. Fix: CORS on the sourcemap files themselves,
independent of whatever headers the `.js` files already carry; see
[15 · shipping the build](../15-deployment-considerations/01-shipping-the-build.md) for
the wider production-sourcemap trade-offs.

**Symptom: a worker built with `new Worker(new URL('./worker.js', import.meta.url))`
throws immediately on construction once `base` points at a CDN origin, and no
`Access-Control-Allow-Origin` header fixes it.** Cause: worker scripts are restricted more
strictly than fetches, fonts or module imports — a classic worker's script has
historically had to be same-origin with the page regardless of the response's CORS
headers. Fix: keep worker scripts same-origin with the host page (bundle them into the
host, or proxy the CDN file through the host's own origin) rather than attempting to solve
it with response headers on the CDN side.

## Interview questions

**★ Why does a hand-built asset URL like `'/icons/' + name + '.svg'` survive dev and a
root deploy, then 404 only once the app moves under a `base` path prefix?**
Because `base` rewriting only ever touches URLs Vite itself emitted from static analysis
— `import`s, `<link>`/`<script>` references in the built HTML, `new URL()` calls. A
string your own code assembles at runtime is, to the bundler, indistinguishable from any
other `string`; nothing marks it as an asset reference to rewrite. It happens to resolve
correctly in dev and at a site root because a leading `/` and an unprefixed `base`
coincide there — the bug is dormant, not absent, until `base` actually carries a prefix.

**What's the difference between fixing that with `import.meta.env.BASE_URL` versus
`new URL('./icon.svg', import.meta.url)`, and when does each apply?**
`BASE_URL` is a build-time-substituted string equal to whatever `base` resolved to for
this build — it fixes concatenation by making the prefix correct, but the path after it
is still a runtime string the bundler never inspects, so the referenced file also has to
already exist at a predictable location relative to that prefix. `new URL('./relative',
import.meta.url)` is different in kind: the bundler statically analyses the call, treats
the referenced file as a real asset, fingerprints it, and rewrites the URL — `base` never
has to be reasoned about at the call site at all. Use the `new URL()` form whenever the
path is knowable at the call site; fall back to `BASE_URL` concatenation only when the
path itself is genuinely dynamic, built from data the bundler cannot see at build time.

**★ Why does an absolute-URL `base` introduce CORS failures that a same-origin,
path-prefix `base` never does?**
Because several browser resource types are fetched in CORS mode unconditionally, by
specification, independent of any header the requesting page's own origin carries: font
files referenced from `@font-face`, and ES modules loaded via dynamic `import()`. Under a
same-origin `base`, the "cross-origin" check trivially passes because there is no
cross-origin request being made at all. Under an absolute-URL `base`, every one of those
requests genuinely crosses an origin, and the serving origin — the CDN — has to opt every
one of them in with `Access-Control-Allow-Origin`, or the browser drops the response
before application code ever sees it.

---

← [Composition alternatives + decision](06b-composition-alternatives-and-the-decision.md) · [Vite overview](../../README.md) · Next → [server.origin, manifest & router basename](07b-server-origin-manifest-and-the-router-basename.md)
