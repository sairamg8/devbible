---
title: "base has three shapes and stops at your own string concatenation, but a runtime CDN mapping, a backend-rendered dev server and a gateway composing several builds each need a different mechanism again — renderBuiltUrl, server.origin and the manifest"
sidebar_label: "07b · server.origin, manifest & router basename"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Building for Production](https://vite.dev/guide/build.md) (`experimental.renderBuiltUrl`), [Server Options](https://vite.dev/config/server-options.md) (`server.origin`), and [Backend Integration](https://vite.dev/guide/backend-integration.md) (manifest, dev/production tag order). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[07](07-base-and-asset-urls-across-origins.md) covers `base` and
`import.meta.env.BASE_URL` — the mechanism that answers "what URL does an emitted asset
carry" for the overwhelming majority of deployments. This page covers the three places
that answer isn't a single shared prefix at all: a CDN mapping decided by a runtime
function rather than a fixed string (`renderBuiltUrl`), a backend-rendered dev server with
no build-time prefix in play (`server.origin`), and a gateway composing a page out of
several independently built entries at once, none of which know the others exist
(`build.manifest`). It closes with the one place `base` gets blamed for a bug it did not
cause: a client-side router's own, separate basename.**

## `experimental.renderBuiltUrl` — one function for every emitted URL

`base` answers "what prefix does every asset URL share." `renderBuiltUrl` exists for the
narrower case where the answer isn't a single shared prefix at all — the guide's own
example is exactly the deployment
[07](07-base-and-asset-urls-across-origins.md) keeps returning to: HTML served from the
application's own origin, hashed JS and CSS served from a CDN reached through
application-specific logic rather than a fixed URL.

```ts
experimental: {
  renderBuiltUrl(filename, { hostType }) {
    if (hostType === 'js') {
      return { runtime: `window.__toCdnUrl(${JSON.stringify(filename)})` }
    } else {
      return { relative: true }
    }
  },
}
```

The function is called once per emitted asset reference, and it is given `hostType` to
distinguish where the reference is being written:

- **`hostType === 'js'`** — the reference is being written into JavaScript itself (a
  dynamic `import()` target, a `new URL()` call Vite rewrote). Returning
  `{ runtime: '...' }` hands back a JavaScript expression, evaluated at *runtime in the
  browser* rather than baked into the bundle at build time — the example resolves the
  actual URL by calling a global `window.__toCdnUrl` function the host page is expected to
  define, which lets the CDN mapping be decided outside the build entirely (an env
  var read at runtime, a lookup table shipped separately, whatever the deployment needs).
- **Anything else** (`'html'`, `'css'`) — a JavaScript runtime expression cannot appear
  inside an `href` attribute or a CSS `url(...)`, so the options differ: `{ relative: true }`
  emits a path relative to the referencing file, matching what `base: './'` would have
  produced for that one reference.

The guide adds one precise decoding note that matters if the function does any string
manipulation on `filename` before returning:

> *"The `filename` passed is a decoded URL, and if the function returns a URL string, it
> should also be decoded."*

🔴 **This option is documented under `experimental` in the source itself, not as a stable
label this page is adding.** That means the function signature, the `hostType` values, and
the accepted return shapes are all subject to change between Vite releases without the
same deprecation runway a stable API gets. Reach for it only when `base`'s single shared
prefix genuinely cannot express the deployment — the CDN-mapping-via-runtime-function case
above is the shape the guide itself demonstrates, not a general recommendation to prefer
this over `base`.

## `server.origin` — the dev-time and backend-integration case

`server.origin` answers a version of the same question, but scoped to the dev server and
independent of `base` entirely. The docs define it in one line:

> *"Defines the origin of the generated asset URLs during development."*

The case this exists for is a backend that renders the HTML — Rails, Laravel, Django, or
any server-owned template — while Vite serves the assets during development, with no
proxy sitting between the two. The backend's HTML has to reference the Vite dev server by
its actual origin, because there is nothing rewriting a relative path into that origin on
the backend's behalf. The guide's own required dev-mode tags:

```html
<script type="module" src="http://localhost:5173/@vite/client"></script>
<script type="module" src="http://localhost:5173/main.js"></script>
```

For React, the fast-refresh runtime is injected before both of those. In production the
same backend switches to a completely different code path — reading the build's manifest
rather than hardcoding the dev server's origin — and emits tags in a fixed order: CSS
links for the entry chunk, then CSS links for every chunk the entry statically imports
(recursively), then the entry's own `<script>`, then optional `modulepreload` links for
the entry's direct imports.

⚠️ **The backend-integration guide does not discuss `base` at all** — `server.origin` is
the only URL-resolution option it names, because the scenario it covers is dev-only asset
serving with no build-time path prefix in play. Do not read `server.origin` as a
production substitute for `base`; they solve adjacent problems in different phases of the
build.

The full worked backend-integration example — the manifest's exact JSON shape, a
line-by-line tag-generation helper, and the dev/production branching a template needs —
already exists at
[15 · manifest and backend integration](../15-deployment-considerations/01k-manifest-and-backend-integration.md).
This page does not repeat that worked example; the next section covers the manifest from
a different angle — a composition layer, not a single backend template.

## `build.manifest` — the map a composition layer needs

The manifest exists for exactly one reason relevant to this topic: after `vite build`
runs, nothing else in the filesystem states which hashed files a given entry actually
needs. `build.rolldownOptions.output` produces content-hashed filenames specifically so
two builds of the same entry never collide in a cache or a CDN — and that hashing is
precisely what makes the mapping unknowable without reading it back out.

- `build.manifest` — default `false`; generates `.vite/manifest.json` in `outDir` when
  enabled. [05 · build options](../05-build-system-rollup/01-build-options.md) covers
  the option itself alongside the rest of `build.*`.
- Each entry in the manifest is a `ManifestChunk`. The fields
  [15 · manifest and backend integration](../15-deployment-considerations/01k-manifest-and-backend-integration.md)
  already quotes directly from the docs — `file` (*"The output file name of this chunk /
  asset"*), `isEntry` (*"Whether this chunk or asset is an entry point"*), `imports`
  (*"The list of statically imported chunks by this chunk"*), and `css`. Two further
  fields the manifest carries are `assets` — the chunk's referenced non-JS, non-CSS static
  assets — and `isDynamicEntry` / `dynamicImports`, the counterpart pair marking chunks
  reached through a dynamic `import()` rather than a static one; the guide names these
  fields without giving each its own one-line definition the way it does for `file`,
  `isEntry` and `imports`.

A single backend rendering one page from one entry is [01k](../15-deployment-considerations/01k-manifest-and-backend-integration.md)'s
case. The reason this topic cares about the manifest at all is a step further: a
**composition layer or gateway** — the thing sitting in front of
[04 · one repo, many Vite apps](04-one-repo-many-vite-apps.md)'s independently built
frontends, deciding which fragments to stitch into one response — needs the *same*
lookup, but for several entries from several builds at once, and it needs it as data it
can consume programmatically rather than as a backend template's hand-written helper:

```js
// compose-tags.mjs — reads one app's manifest and emits the tag set for one entry,
// suitable for a gateway assembling several independently built fragments into one page
import { readFile } from 'node:fs/promises';

async function tagsForEntry(manifestPath, entryKey) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const chunk = manifest[entryKey];
  if (!chunk) {
    throw new Error(`No entry "${entryKey}" in ${manifestPath}`);
  }

  const css = new Set(chunk.css ?? []);
  for (const importKey of chunk.imports ?? []) {
    for (const cssFile of manifest[importKey]?.css ?? []) {
      css.add(cssFile);
    }
  }

  const modulepreload = (chunk.imports ?? [])
    .map((importKey) => manifest[importKey]?.file)
    .filter(Boolean);

  return {
    css: [...css],
    script: chunk.file,
    modulepreload,
  };
}

// A gateway composing a page from two independently deployed fragments:
const [checkout, nav] = await Promise.all([
  tagsForEntry('./dist-checkout/.vite/manifest.json', 'src/main.ts'),
  tagsForEntry('./dist-nav/.vite/manifest.json', 'src/main.ts'),
]);
```

The manifest is what makes that composition possible without either fragment's build
knowing the other exists — each build reports its own hashed output, and the gateway is
the only party that ever needs both manifests at once.

## `base` does not configure your router — one source of truth

`base` controls asset URLs — the files a `<script>`, `<link>` or `import()` fetches. It
has no effect on client-side routing whatsoever, because a router's route matching runs
entirely in the browser against `location.pathname`, a concern `base` was never involved
in. An app deployed under `/app-a/` with `base: '/app-a/'` correctly fetches its assets
from that prefix and then, with a router configured for root-relative paths, tries to
match `/app-a/checkout` against a route table that only knows `/checkout` — the initial
render (client-side navigation from `/app-a/`) can happen to work if the router falls
back gracefully, but a hard refresh on `/app-a/checkout` fails at the server/gateway
routing layer, or the router renders a blank page because nothing in its table matches
the full path.

The fix is not a router-specific trick, it is discipline: derive both `base` and the
router's basename from one value.

```ts
// vite.config.ts
import { defineConfig } from 'vite';

const DEPLOY_PATH = '/app-a/';

export default defineConfig({
  base: DEPLOY_PATH,
});
```

```tsx
// main.tsx — react-router, reading the same value back out of the built bundle
import { BrowserRouter } from 'react-router-dom';

// import.meta.env.BASE_URL is exactly the base this build was configured with —
// the same value that drove vite.config.ts's DEPLOY_PATH, not a second hand-copied string
<BrowserRouter basename={import.meta.env.BASE_URL}>
  <App />
</BrowserRouter>;
```

Reading `import.meta.env.BASE_URL` back into the router — rather than hand-copying
`'/app-a/'` into a second place — is the same fix
[07](07-base-and-asset-urls-across-origins.md) opened with, applied to a router's
configuration instead of a hand-built asset string: one value, one place it is declared,
every consumer reads it back rather than restating it.

## Gotchas

**Symptom: `renderBuiltUrl` stops matching its documented behaviour after a Vite minor
upgrade.** Cause: the option is documented under `experimental` in the source itself —
its signature and return shapes carry no stability guarantee across releases. Fix: pin
the Vite version this configuration was validated against, and re-check the option's
current shape in the changelog before upgrading past it, rather than assuming semver
covers it the way it does the rest of `build.*`.

**Symptom: a gateway's composition script silently returns `undefined` for `css` and
`script` on one fragment while every other fragment renders correctly.** Cause: each
app's manifest keys its entry by whatever string was given to `input` (or
`rolldownOptions.input`) — one app may key by `src/main.ts`, another by `main.ts` or an
absolute path, so a composition layer that assumes one shared key convention across every
fragment's manifest silently misses the ones that don't match. Fix: standardise the
entry-key convention across every app the gateway composes — see
[04b · shared packages and the deploy decision](04b-shared-packages-and-the-deploy-decision.md)
for the wider convention question — or read each manifest's own top-level keys
programmatically instead of hardcoding an assumed name per app.

**★ Symptom: the app renders correctly on client-side navigation but shows a blank page,
or a gateway 404, on a hard refresh at a nested route.** Cause: `base` and the router's
`basename` were configured independently and drifted apart, or the router was never given
a `basename` at all — `base` only ever governs asset URLs, never client-side route
matching. Fix: derive both from one value, and read the router's `basename` from
`import.meta.env.BASE_URL` rather than hand-copying the deploy path into a second place.

## Interview questions

**Why is `renderBuiltUrl` needed at all, given that `base` already rewrites every emitted
asset URL?**
Because `base` expresses exactly one shape of answer: every asset URL shares one prefix
(or is relative to its own file). Some deployments don't fit that shape — the guide's own
case is HTML served from the application's origin while hashed JS and CSS resolve through
CDN-mapping logic that only exists at runtime in the browser, not as a fixed string known
at build time. `renderBuiltUrl` is called per-reference and can return either a build-time
relative path or a runtime JavaScript expression evaluated in the browser, which `base`'s
single shared prefix cannot express. It is documented as experimental precisely because
it is the escape hatch for the cases the stable, simpler `base` option was not designed to
cover.

**★ Why does `server.origin` exist separately from `base`, and why does the
backend-integration guide use one but not the other?**
`server.origin` scopes to the dev server specifically — it answers what origin the *Vite
dev server itself* is reachable at, for a backend that renders the HTML by hand and needs
to hardcode a `<script src>` pointing at that dev server, with no proxy in between. `base`
scopes to the production build — what prefix or origin the *built, deployed* assets carry.
The backend-integration guide only needs the first, because in that scenario the
production path is handled by reading the manifest rather than by a build-time URL prefix
at all; `base` genuinely never enters into that particular integration.

**Why does a composition layer that assembles pages from several independently built
frontends need the manifest, when a single SPA never has to read it?**
A single SPA's `index.html` is itself a Vite build artefact — Vite rewrites the correct
hashed references directly into the HTML it produces, so nothing downstream ever needs to
look the hash up. A composition layer is assembling a response out of *other* builds'
output, entries it did not build and whose current hashes it cannot know in advance —
the manifest is the only artefact that states, for a given source entry, exactly which
hashed files that build produced this time. Without it, the composition layer would have
no way to know which `assets/main-<hash>.js` belongs to the entry it's trying to include.

**★ Why does setting `base` correctly not stop a hard refresh at `/app-a/checkout` from
breaking, if the assets themselves load fine?**
Because `base` and client-side routing solve unrelated problems. `base` only ever governs
where the browser fetches the bundle's own files from; a router's route matching runs
against `location.pathname` in the browser and has no awareness of `base` at all. If the
router isn't separately told its `basename`, it tries to match the *full* path — including
the `/app-a/` prefix the gateway is routing on — against a route table written for paths
without that prefix, and nothing matches. The fix has to name the basename explicitly and
read it from the same source `base` came from, not rely on `base` to have solved it.

---

← [base and asset URLs](07-base-and-asset-urls-across-origins.md) · [Vite overview](../../README.md) · Next → [The Environment API](08-the-environment-api-and-many-build-targets.md)
