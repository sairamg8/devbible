---
title: "Production SSR is two builds and one branch in your server, and every one of the four differences between the branches is a place teams get it wrong"
sidebar_label: "The Two Builds"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [SSR § Building for Production](https://vite.dev/guide/ssr), [`build.ssr`](https://vite.dev/config/build-options#build-ssr), [`build.minify`](https://vite.dev/config/build-options#build-minify), [`build.ssrEmitAssets`](https://vite.dev/config/build-options#build-ssremitassets), [`build.emitAssets`](https://vite.dev/config/build-options#build-emitassets), [CLI](https://vite.dev/guide/cli), [`appType`](https://vite.dev/config/shared-options#apptype). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Two Builds and the Branch Between Them

**In development one process serves everything and Vite transforms on demand. In production
nothing is transformed on demand: you ship two build outputs and your server chooses between
four different behaviours depending on which mode it is in. The primitives make that branch
your responsibility, and the four differences are not symmetric — three change *where a file
comes from* and one changes *what the server does at all*.**

> *"To ship an SSR project for production, we need to:"*
> *"1. Produce a client build as normal;"*
> *"2. Produce an SSR build, which can be directly loaded via `import()` so that we don't have to go through Vite's `ssrLoadModule`;"*

---

## 1. Under-The-Hood Mechanics

### The two commands

```json
{
  "scripts": {
    "dev": "node server",
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.js"
  }
}
```

> *"Note the `--ssr` flag which indicates this is an SSR build. It should also specify the SSR entry."*

The CLI table types it as `--ssr [entry]` — *"Build specified entry for server-side rendering"*. The config equivalent is `build.ssr`, **Type:** `boolean | string`, **Default:** `false`:

> *"Produce SSR-oriented build. The value can be a string to directly specify the SSR entry, or `true`, which requires specifying the SSR entry via [`input`](https://vite.dev/config/shared-options#input) or `build.rolldownOptions.input`."*

### The four differences in the server branch

The guide enumerates three, and the fourth is the branch itself:

> *"Instead of reading the root `index.html`, use the `dist/client/index.html` as the template, since it contains the correct asset links to the client build."*
> *"Instead of `await vite.ssrLoadModule('/src/entry-server.js')`, use `import('./dist/server/entry-server.js')` (this file is the result of the SSR build)."*
> *"Move the creation and all usage of the `vite` dev server behind dev-only conditional branches, then add static file serving middlewares to serve files from `dist/client`."*

That third bullet is doing two jobs. **Not creating the dev server** matters most: a Vite dev
server in production means the config loader, the watcher and the optimiser all running in a
process that will never transform anything. And **serving `dist/client`** matters because in
dev those requests were answered by `vite.middlewares`, which no longer exists.

`transformIndexHtml` also disappears from the production path — the client build already
applied every HTML transform and rewrote asset links into `dist/client/index.html`.

### Defaults that differ between the two builds

`build.minify` — **Type:** `boolean | 'oxc' | 'terser' | 'esbuild'`:

> *"**Default:** `'oxc'` for client build, `false` for SSR build"*

Server code is not shipped over the wire, so minifying it buys nothing and costs stack-trace
quality. Note also that *"`build.minify: 'esbuild'` is deprecated and will be removed in the future"* — Vite 8 minifies with Oxc.

Assets are asymmetric too:

> *"During the SSR build, static assets aren't emitted as it is assumed they would be emitted as part of the client build. This option allows frameworks to force emitting them in both the client and SSR build. It is responsibility of the framework to merge the assets with a post build step. This option will be replaced by `build.emitAssets` once Environment API is stable."*

The successor, `build.emitAssets`, is the same idea generalised past two environments:

> *"During non-client builds, static assets aren't emitted as it is assumed they would be emitted as part of the client build."*

---

## 2. Real-World Engineering Scenario

**A deploy that served a blank page with a 200.**

CI ran `build:client`, deployed `dist/`, and started the server. The server started, rendered,
and returned HTML — with `<script type="module" src="/src/entry-client.js">` in it, because
the production branch was still reading the **root** `index.html` rather than
`dist/client/index.html`. In dev that path is correct and Vite rewrites it on the fly. In
production nothing rewrites it, the browser requests a source path that does not exist, and
the page renders server markup that never hydrates. Every monitor was green: the HTML was
served, the status was 200, and the server-rendered content was present.

The second incident on the same service was the mirror: `build:server` had been dropped from
the pipeline during a refactor. The server booted, `import('./dist/server/entry-server.js')`
threw `ERR_MODULE_NOT_FOUND`, and that one at least failed loudly.

---

## 3. Production-Grade Code Example

```js
// server.js — one file, both modes, branching once at boot
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { ssrHandler } from './ssr-handler.js'

const isProd = process.env.NODE_ENV === 'production'
const root = import.meta.dirname
const app = express()

let vite = null

if (!isProd) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })
  app.use(vite.middlewares)
} else {
  // In dev, vite.middlewares served these. In prod, nothing does unless
  // you say so. `index: false` keeps sirv/static from answering '/'.
  const sirv = (await import('sirv')).default
  app.use(sirv(path.resolve(root, 'dist/client'), { extensions: [] }))
}

if (isProd) {
  // Read the BUILT template once — it carries hashed asset links.
  const template = fs.readFileSync(
    path.resolve(root, 'dist/client/index.html'),
    'utf-8',
  )
  // Import the BUILT server bundle directly. No ssrLoadModule in prod.
  const { render } = await import('./dist/server/entry-server.js')

  app.use('*all', async (req, res, next) => {
    try {
      const appHtml = await render(req.originalUrl)
      res
        .status(200)
        .set({ 'Content-Type': 'text/html' })
        .end(template.replace('<!--ssr-outlet-->', () => appHtml))
    } catch (e) {
      next(e)
    }
  })
} else {
  app.use('*all', ssrHandler(vite))
}

app.listen(process.env.PORT ?? 5173)
```

```js
// vite.config.js — the two builds, expressed as config rather than CLI flags
import { defineConfig } from 'vite'

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    outDir: isSsrBuild === true ? 'dist/server' : 'dist/client',
    ssr: isSsrBuild === true ? 'src/entry-server.js' : false,
    // Explicit rather than implied: SSR output defaults to no minification.
    minify: isSsrBuild === true ? false : 'oxc',
  },
}))
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`appType: 'custom'` also changes `vite preview`.** The `'spa'` note about configuring sirv
with `single: true` is what makes a preview server fall back to `index.html`; a custom app
gets no fallback, so previewing a production SSR build means running your own production
server, not `vite preview` — unless you attach SSR middleware to it (see the last question).

**`isSsrBuild` may be `undefined`.** The conditional-config docs warn that *"Some tools that load the Vite config may not support these flags and will pass `undefined` instead. Hence, it's recommended to use explicit comparison against `true` and `false`."* That is why the example
writes `isSsrBuild === true` rather than a truthiness check.

**The two builds write to different `outDir`s and one of them will clear the other.** Nesting
both under `dist/` (`dist/client`, `dist/server`) is the documented layout precisely because a
shared `outDir` means the second build removes the first.

---

## Gotchas

**★ Symptom: production serves rendered HTML that never hydrates; the browser 404s on `/src/entry-client.js`.**
Cause: the production branch reads the root `index.html` instead of the built one, so the
template still points at source paths. Fix: read the client build's output — it is the file
with hashed asset links.
```js
const template = fs.readFileSync(
  path.resolve(root, 'dist/client/index.html'), 'utf-8')
```

**★ Symptom: `ERR_MODULE_NOT_FOUND` for `dist/server/entry-server.js` on boot.**
Cause: only the client build ran. Two builds are two commands; a pipeline that runs `vite build` alone produces half the app. Fix: run both, and make the server build's failure fail
the pipeline.
```json
{ "scripts": { "build": "npm run build:client && npm run build:server" } }
```

**★ Symptom: production works but memory and boot time look like a dev server's.**
Cause: `createServer` from `vite` is being called in production. Fix: the dev server must sit
behind a branch — and importing it dynamically keeps `vite` out of the production module graph
entirely.
```js
if (!isProd) {
  const { createServer } = await import('vite')
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  app.use(vite.middlewares)
}
```

**★ Symptom: every asset 404s in production while HTML renders fine.**
Cause: in dev `vite.middlewares` served `/assets/*`; in production nothing does. The guide's
third bullet says to *"add static file serving middlewares to serve files from `dist/client`"*.
Fix: mount a static server for the client output in the production branch only.

**★ Symptom: a production SSR stack trace is unreadable, with one-letter identifiers.**
Cause: minification was turned on globally, overriding the SSR build's `false` default. Fix:
keep the documented asymmetry — minify the client, not the server.
```js
build: { minify: isSsrBuild === true ? false : 'oxc' }
```

**★ Symptom: an image or font imported only from a server component is missing from `dist/`.**
Cause: *"During the SSR build, static assets aren't emitted as it is assumed they would be emitted as part of the client build."* Fix: opt in — and note the docs' condition, that merging
the two outputs is then your job.
```js
build: { ssrEmitAssets: true } // successor: build.emitAssets
```

**★ Symptom: the second build wipes the first build's output.**
Cause: both builds target the same `outDir`. Fix: separate directories, which is why the
documented scripts pass `--outDir dist/client` and `--outDir dist/server`.

**★ Symptom: a config that branches on `isSsrBuild` behaves as if it were always the client build under a non-Vite tool.**
Cause: the flag arrived as `undefined` and a truthiness check treated that as "not SSR". Fix:
compare explicitly, as the docs recommend.
```js
export default defineConfig(({ isSsrBuild }) => ({
  build: { ssr: isSsrBuild === true ? 'src/entry-server.js' : false },
}))
```

---

## Interview questions

**★ Why does production import the built server bundle directly instead of using `ssrLoadModule`?**
Because `ssrLoadModule` exists to *transform on demand*, and in production there is nothing
left to transform — the SSR build already produced JavaScript Node can execute. The docs put
the purpose in the requirement itself: an SSR build *"can be directly loaded via `import()` so that we don't have to go through Vite's `ssrLoadModule`"*. Keeping the dev path in production
would mean running the entire Vite dev server — config loading, watching, the plugin container,
the optimiser — to re-derive per request what the build already computed once.

**★ Why is the SSR build's `minify` default `false` when the client's is `'oxc'`?**
Because minification trades readability for bytes over the network, and server code is never
sent over the network. Nobody downloads `dist/server/entry-server.js`; it is read once from
local disk. What you would pay is stack-trace quality in the one place where a stack trace is
your only diagnostic. The default encodes that trade, and overriding `build.minify` globally
is the usual way it gets silently reversed.

**★ Why are static assets not emitted by the SSR build, and when is that wrong?**
Because both builds see the same imports, so emitting from both would duplicate every asset,
and the client build is the one whose output is actually served — hence *"it is assumed they would be emitted as part of the client build."* It is wrong when an asset is reachable only
from server code: a font the renderer inlines, an image referenced by an OG-tag helper that no
client module imports. Then `build.ssrEmitAssets` (or `build.emitAssets`) is the opt-in, and
the docs are explicit that merging the outputs afterwards is your responsibility.

**★ What breaks if you forget the static-file middleware in the production branch?**
HTML renders, the server looks healthy, and every asset 404s — because in development those
requests were served by `vite.middlewares`, which the production branch deliberately does not
create. It is the clearest example of the general hazard in this chunk: the dev server is
providing services beyond transformation, and removing it removes all of them at once.

**★ Is `vite dev` genuinely unusable for an SSR app, then?**
No — it is a second, less common wiring. The SSR guide's final section says the CLI commands
*"can also be used for SSR apps"*, with your SSR middleware attached through `configureServer`
for dev and `configurePreviewServer` for preview. The catch is the same ordering problem in
plugin form, and the docs give the rule:
> *"Use a post hook so that your SSR middleware runs *after* Vite's middlewares."*
That means returning a function from the hook rather than adding the middleware inline. Pick
this shape when Vite owns the process and you only need to intercept HTML; pick middleware
mode when your own server owns the process.

---

← [`ssr.target` & Conditions](01e-ssr-target-and-resolve-conditions.md) · [Vite overview](../../README.md) · Next → [Building All Environments](01fa-building-all-environments.md)
