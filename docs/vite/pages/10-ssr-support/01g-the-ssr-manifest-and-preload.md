---
title: "The SSR manifest is emitted by the client build, not the server build, and that one fact explains both its path on disk and what it is for"
sidebar_label: "The SSR Manifest"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [SSR § Generating Preload Directives](https://vite.dev/guide/ssr), [SSR § Pre-Rendering / SSG](https://vite.dev/guide/ssr), [`build.ssrManifest`](https://vite.dev/config/build-options#build-ssrmanifest), [CLI](https://vite.dev/guide/cli). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> 🔴 Corrects the pre-validation import of this page, which named the output `dist/client/ssr-manifest.json`. The documented path is **`dist/client/.vite/ssr-manifest.json`**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The SSR Manifest and Preload Directives

**A server-rendered page arrives with its HTML already correct and its JavaScript not yet
requested. The window between "the user can see it" and "the user can interact with it" is
spent discovering which chunks the page needs. The SSR manifest closes that window — but it
is produced by the *client* build, and every confusion about it starts with expecting it
somewhere else.**

---

## 1. Under-The-Hood Mechanics

### Where it comes from, and the parenthesis that explains everything

> *"`vite build` supports the `--ssrManifest` flag which will generate `.vite/ssr-manifest.json` in build output directory"*

```diff
- "build:client": "vite build --outDir dist/client",
+ "build:client": "vite build --outDir dist/client --ssrManifest",
```

> *"The above script will now generate `dist/client/.vite/ssr-manifest.json` for the client build (Yes, the SSR manifest is generated from the client build because we want to map module IDs to client files). The manifest contains mappings of module IDs to their associated chunks and asset files."*

Read the parenthesis as the definition. The question the manifest answers is *"the server
rendered module X — which **client** files does the browser need for it?"* Only the client
build knows the answer, because only it produced those files and their hashes.

The config form, `build.ssrManifest` — **Type:** `boolean | string`, **Default:** `false`:

> *"Whether to generate a SSR manifest file for determining style links and asset preload directives in production."*
> *"When the value is a string, it will be used as the manifest file path relative to `build.outDir`. When set to `true`, the path would be `.vite/ssr-manifest.json`."*

### The half you have to supply

> *"To leverage the manifest, frameworks need to provide a way to collect the module IDs of the components that were used during a server render call."*

A manifest alone is a lookup table with no keys to look up. Something must record *which
modules this particular render touched*. The docs give the Vue case as the worked example:

> *"`@vitejs/plugin-vue` supports this out of the box and automatically registers used component module IDs on to the associated Vue SSR context"*

```js
const ctx = {}
const html = await vueServerRenderer.renderToString(app, ctx)
// ctx.modules is now a Set of module IDs that were used during the render
```

⚠️ **The documentation does not enumerate which other framework plugins expose an equivalent
collection mechanism.** If yours does not, the manifest is still generated and still correct;
you simply have no per-render key set to index it with, and preload injection has to fall back
to route-level knowledge you maintain yourself.

### What you do with it

> *"In the production branch of `server.js` we need to read and pass the manifest to the `render` function exported by `src/entry-server.js`. This would provide us with enough information to render preload directives for files used by async routes! … You can also use this information for [103 Early Hints](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/103)."*

### The same machinery, run at build time, is SSG

> *"If the routes and the data needed for certain routes are known ahead of time, we can pre-render these routes into static HTML using the same logic as production SSR. This can also be considered a form of Static-Site Generation (SSG)."*

Pre-rendering is not a different feature. It is the production SSR path invoked from a script
instead of from a request handler, writing HTML to disk instead of to a response.

---

## 2. Real-World Engineering Scenario

**A route split into thirty async chunks that loaded them one waterfall at a time.**

A dashboard code-splits per widget. Server-rendered HTML painted fast; interactivity did not,
because the browser parsed the entry chunk, discovered a dynamic import, fetched it, parsed
it, discovered the next, and so on. The team's first fix was to preload every chunk in the
manifest — which made the initial payload larger than the un-split bundle had been and moved
the problem rather than solving it.

The manifest's value is precision, not volume: it maps *the module IDs this render actually
used* to *the files those modules live in*. A dashboard render that touched six widgets
preloads six subtrees, not thirty. The team's remaining work was the half Vite does not do —
collecting the module IDs from the renderer — which for their framework meant threading a
context object through the render call, exactly as the Vue example does.

---

## 3. Production-Grade Code Example

```js
// src/entry-server.js — collect module IDs during the render
export async function render(url, manifest) {
  const ctx = {}
  const appHtml = await renderToString(createApp(url), ctx)
  const preloadLinks = renderPreloadLinks(ctx.modules ?? [], manifest)
  return { appHtml, preloadLinks }
}

function renderPreloadLinks(moduleIds, manifest) {
  const files = new Set()
  for (const id of moduleIds) {
    for (const file of manifest[id] ?? []) files.add(file)
  }

  let links = ''
  for (const file of files) {
    if (file.endsWith('.js')) {
      links += `<link rel="modulepreload" crossorigin href="${file}">`
    } else if (file.endsWith('.css')) {
      links += `<link rel="stylesheet" href="${file}">`
    }
  }
  return links
}
```

```js
// server.js (production branch) — read the manifest once, pass it per render
import fs from 'node:fs'
import path from 'node:path'

const root = import.meta.dirname

// Read + parse rather than `import ... from './…json'`: no import attribute
// needed, and the path stays a runtime value you can point at a deploy dir.
const manifest = JSON.parse(
  fs.readFileSync(
    path.resolve(root, 'dist/client/.vite/ssr-manifest.json'),
    'utf-8',
  ),
)

const template = fs.readFileSync(
  path.resolve(root, 'dist/client/index.html'),
  'utf-8',
)

const { render } = await import('./dist/server/entry-server.js')

app.use('*all', async (req, res, next) => {
  try {
    const { appHtml, preloadLinks } = await render(req.originalUrl, manifest)
    const html = template
      .replace('<!--preload-links-->', () => preloadLinks)
      .replace('<!--ssr-outlet-->', () => appHtml)
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
  } catch (e) {
    next(e)
  }
})
```

```json
{
  "scripts": {
    "build:client": "vite build --outDir dist/client --ssrManifest",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.js"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`--ssrManifest` belongs on the client command.** Putting it on the `--ssr` command produces
a manifest of server chunks, which is not a thing the browser can preload.

**A string value relocates the file, relative to `outDir`.** `build.ssrManifest: 'meta/ssr.json'` with `outDir: 'dist/client'` writes `dist/client/meta/ssr.json` — useful when
the leading dot in `.vite/` is inconvenient for a deploy tool that skips dotfiles.

**The manifest is a build artefact keyed by that build's hashes.** It is generated once, at
build time, and every filename in it carries a content hash from that specific build. Nothing
refreshes it: a server holding it in memory is holding the previous deploy's file names until
it re-reads or restarts.

**`103 Early Hints` needs the links before the body.** The docs point at it as a use of the
same data, which means computing preload links must not depend on having finished the render
— a route-level lookup can be sent early; a render-derived set cannot.

---

## Gotchas

**★ Symptom: `ENOENT` reading `dist/client/ssr-manifest.json`.**
Cause: the documented path has a `.vite/` segment. When `build.ssrManifest` is `true`,
*"the path would be `.vite/ssr-manifest.json`"*, relative to `build.outDir`. Fix: read the real
path, or set a string value to choose your own.
```js
const manifestPath = path.resolve(root, 'dist/client/.vite/ssr-manifest.json')
// or: build: { ssrManifest: 'ssr-manifest.json' }  → dist/client/ssr-manifest.json
```

**★ Symptom: the manifest exists but every lookup misses.**
Cause: `--ssrManifest` was passed to the **server** build, so the file maps server chunks.
Fix: move the flag to the client build — the manifest exists *"because we want to map module IDs to client files."*
```json
{ "scripts": { "build:client": "vite build --outDir dist/client --ssrManifest" } }
```

**★ Symptom: `ctx.modules` is empty, so no preload links are ever emitted.**
Cause: nothing collected module IDs during the render. Vite emits the table; the framework
plugin must supply the keys — *"frameworks need to provide a way to collect the module IDs of the components that were used during a server render call."* Fix: pass and read the render
context your framework supports.
```js
const ctx = {}
const html = await vueServerRenderer.renderToString(app, ctx)
// ctx.modules is now a Set of module IDs that were used during the render
```

**★ Symptom: preloading made the page slower.**
Cause: every entry in the manifest was preloaded rather than the subset this render used.
Preloading is a promise to the browser that a resource is needed now; over-promising competes
with the resources that genuinely are. Fix: index the manifest by the collected module IDs.
```js
const files = new Set()
for (const id of ctx.modules) for (const f of manifest[id] ?? []) files.add(f)
```

**★ Symptom: after a deploy, preload links point at chunk filenames that 404.**
Cause: the manifest was read once into memory and the process outlived the build that produced
it — its filenames carry the previous build's content hashes. Fix: read it at boot and restart
on deploy, or re-read when the file's mtime changes.
```js
let manifest = loadManifest()
fs.watchFile(manifestPath, () => { manifest = loadManifest() })
```

**★ Symptom: a deploy pipeline uploads `dist/client` and the manifest is missing in production.**
Cause: `.vite/` is a dotfile directory and many sync tools skip those by default. Fix: either
configure the tool, or move the manifest out of the dot directory with a string value.
```js
export default defineConfig({ build: { ssrManifest: 'ssr-manifest.json' } })
```

**★ Symptom: CSS that the server-rendered page needs arrives after first paint, causing a flash of unstyled content.**
Cause: only `.js` entries were turned into links. The manifest's purpose is stated as
*"determining style links and asset preload directives"* — styles are half of it. Fix: branch
on extension and emit a real stylesheet link for CSS, not a preload.
```js
if (file.endsWith('.css')) links += `<link rel="stylesheet" href="${file}">`
```

---

## Interview questions

**★ Why is the SSR manifest generated by the client build rather than the server build?**
Because the question it answers is about client files. The server render tells you *which
modules ran*; the browser needs *which files those modules ended up in*, with the hashed names
from the client build. Only the client build has that mapping. The docs anticipate the
surprise and answer it inline: *"(Yes, the SSR manifest is generated from the client build because we want to map module IDs to client files)."*

**★ Vite generates the manifest. What does the application still have to do?**
Supply the keys. A manifest is `moduleId → files`; without a per-render set of module IDs
there is nothing to look up. The docs make this the framework's job — *"frameworks need to provide a way to collect the module IDs of the components that were used during a server render call"* — and show the Vue mechanism, where the plugin registers used component ids onto a
context object passed into `renderToString`. If your framework has no equivalent, you can still
emit preload links, but from route-level knowledge you maintain, not from the render.

**★ Why not preload every chunk and skip the bookkeeping?**
Because preload is a priority signal, not a cache-warm. Telling the browser that thirty chunks
are needed immediately makes it contend for bandwidth and connections against the six that
actually are, and it downloads code the user may never reach. The value of the manifest is
that it makes the set *exact* — the docs frame the outcome as *"preload directives for files used by async routes"*, which is precisely the set that dynamic imports would otherwise
discover one round trip at a time.

**★ How does SSG relate to any of this?**
It is the same code path with a different trigger. The docs describe pre-rendering as using
*"the same logic as production SSR"* for routes whose data is known ahead of time: you import
the built server entry, call `render(url)` for each route in a script, and write the resulting
HTML to disk. The manifest is just as useful there — the preload links are computed once at
build time and baked into the static file, so the served HTML needs no server at all.

**★ What invalidates an SSR manifest, and how does that show up in production?**
A new build. Every filename in it carries a content hash, so a manifest from build *N* names
files that build *N+1* did not emit. A server process that read the file once at boot and
survives the deploy will keep emitting preload links for chunks that now 404 — and because
preload failures do not break rendering, the page still works while quietly losing the
optimisation and adding failed requests. Re-read on deploy, or restart the process, and treat
the manifest as versioned with the build rather than as configuration.

---

← [Building All Environments](01fa-building-all-environments.md) · [Vite overview](../../README.md) · Next → [SSR Plugin Logic](01h-ssr-specific-plugin-logic.md)
