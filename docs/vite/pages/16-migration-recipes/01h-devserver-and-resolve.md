---
title: "devServer.proxy Ports Almost Unchanged and devServer.historyApiFallback Disappears Because SPA Fallback Is the Vite Default — Resolve Aliasing Is a Bigger Topic Than Fits Here"
sidebar_label: "01h · devServer → server"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Server Options](https://vite.dev/config/server-options), [Shared Options](https://vite.dev/config/shared-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · webpack 5.110.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `devServer` → `server`, and Where Resolve Aliasing Lives

**`devServer.proxy` is the one piece of a webpack dev-server config that ports almost
unchanged; `devServer.historyApiFallback` disappears because Vite does the same thing by
default.** `resolve.alias` and `resolve.extensions` also need translating in a real
migration, but they are large enough subjects with their own failure modes that they have a
dedicated topic — this chunk gives the one-line mapping and sends you there for the depth.

## `devServer.proxy` → `server.proxy`

The shape survives almost intact, because Vite's proxy is the same underlying mechanism
(an HTTP proxy keyed by path prefix) webpack's dev server used.

> *"Configure custom proxy rules for the dev server. Expects an object of `{ key: options }`
> pairs. Any requests whose request path starts with that key will be proxied to the
> specified target. If the key starts with `^`, it will be interpreted as a `RegExp`."* —
> [Server Options](https://vite.dev/config/server-options)

```javascript
// BEFORE — webpack.config.js
module.exports = {
  devServer: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket': { target: 'ws://localhost:4000', ws: true },
    },
  },
};
```

```typescript
// AFTER — vite.config.ts. Same keys, same values, different home.
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket': { target: 'ws://localhost:4000', ws: true },
    },
  },
});
```

`target`, `changeOrigin`, `ws` and `rewrite` all mean what they meant under webpack, because
both sit on top of the same proxy machinery. **`configure`** — a callback with direct access
to the underlying proxy instance for anything not covered by the declarative options — is
the escape hatch on both sides.

## `devServer.historyApiFallback` → nothing, because it is the default

webpack's dev server needed telling to serve `index.html` for any path it could not match to
a real file, so that client-side routing (React Router, etc.) worked on a hard refresh of a
deep link. Vite calls this `appType` and defaults to exactly that behaviour:

> *"`'spa'`: include HTML middlewares and use SPA fallback. Configure
> [sirv](https://github.com/lukeed/sirv) with `single: true` in preview"* — [Shared Options](https://vite.dev/config/shared-options), `appType`, default `'spa'`

```javascript
// BEFORE — explicit, because webpack's default was NOT to fall back
module.exports = { devServer: { historyApiFallback: true } };
```

```typescript
// AFTER — nothing to write. appType: 'spa' is already the default.
import { defineConfig } from 'vite';
export default defineConfig({});
```

You only touch `appType` at all if you are **not** building a client-routed SPA — a
multi-page app wants `'mpa'` (no fallback, every path must be a real HTML file), and a
custom server integration wants `'custom'` (no HTML middlewares at all, you wire serving
yourself).

## `resolve.alias` and `resolve.extensions` — mapped, not re-explained here

webpack's `resolve.alias` and `resolve.extensions` have direct-named Vite equivalents under
`resolve`, but the failure modes — array-form aliasing needed for `RegExp` matches, alias
ordering and shadowing, the exact cost of each entry in `extensions`, `mainFields` and the
`browser` field, monorepo symlinks, dedupe, the `exports`/`imports` fields, Node built-ins —
are a whole topic on their own: **[topic 12, path resolution and
aliases](../12-path-resolution-and-aliases/01-resolve-options.md)**.

The one-line mapping, so this chunk is still useful standalone:

```javascript
// BEFORE — webpack.config.js
module.exports = {
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
};
```

```typescript
// AFTER — vite.config.ts
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
});
```

For the mechanics of `resolve.alias` itself — including why it is string substitution
*before* resolution, not resolution — see
[topic 12, chunk 1](../12-path-resolution-and-aliases/01-resolve-options.md). For the
per-entry cost of `resolve.extensions` and why growing the list is usually the wrong fix, see
[chunk 1c](../12-path-resolution-and-aliases/01c-resolve-extensions.md).

---

## Gotchas

**★ Symptom: a proxied WebSocket connection under Vite's dev server drops immediately, though the same config worked under webpack.** Cause: `ws: true` alone proxies the WebSocket upgrade but the *origin* header some backends validate is still the dev server's own origin. Fix: add `changeOrigin: true` alongside `ws: true`, or `rewriteWsOrigin: true` if the backend specifically checks the WebSocket's `Origin` header rather than a generic proxy header.

**★ Symptom: a deep-linked client-side route 404s in production but worked fine in `vite dev`.** Cause: `appType: 'spa'`'s fallback is a **dev-server (and preview) behaviour**, not something the static build produces — the production host serving `dist/` needs its own SPA-fallback configuration (nginx `try_files`, a static host's rewrite rule), which webpack's `devServer.historyApiFallback` never had to teach you because webpack devs rarely think about the production host's config at all. Fix: configure the fallback at the hosting layer; Vite's `appType` only covers `vite dev`/`vite preview`.

**★ Symptom: an explicit `devServer.historyApiFallback: false` (an MPA that intentionally wants real 404s) silently regains SPA fallback after migrating.** Cause: `appType` defaults to `'spa'`, and a migration that only ports the fields it recognises drops a `false` value with no direct-named target. Fix: set `appType: 'mpa'` explicitly — the absence of a webpack-shaped `false` does not mean there is nothing to configure.

**★ Symptom: `server.proxy`'s `target` uses `https` and the browser reports a certificate error only under Vite.** Cause: Node's proxy implementation validates certificates by default where some webpack-era setups had `secure: false` baked into a wrapper config that was silently dropped in translation. Fix: add `secure: false` to the specific proxy entry if the target's certificate is genuinely self-signed or internal — never globally, and never as a first response to an unrelated proxy error.

---

## Interview questions

**★ Why does `devServer.historyApiFallback` have no Vite option, while `devServer.proxy` translates almost field for field?**
Because one is a default and the other is a feature. webpack's dev server treated "serve
`index.html` for unmatched paths" as opt-in, so a config needed an explicit flag; Vite made
the same behaviour the default for `appType: 'spa'`, so a ported config that keeps looking
for the flag finds nothing to port — there is nothing missing, the default already does it.
`server.proxy`, in contrast, is genuinely configuring an HTTP proxy with target-specific
options, and both tools expose essentially the same underlying mechanism, so the object you
already wrote is close to correct as-is.

**★ A team ports `resolve.alias` and `resolve.extensions` by copying the webpack object shape into `vite.config.ts` and calls the resolve migration done. What is missing?**
Everything that only shows up under load or on a specific platform: array-form aliasing for
`RegExp` matches (the object form cannot express one), alias *ordering* when one alias's key
is a prefix of another's, the actual filesystem cost of each `extensions` entry, `mainFields`
and the legacy `browser` field's object-form stubbing, symlinked monorepo packages, and
dependency deduplication. None of that is visible from a config that merely has the right
keys — it is visible from imports that resolve to the wrong file, silently, which is
precisely why it is a dedicated topic rather than one paragraph here.

---

← [01g · entry & output → index.html](01g-entry-output-and-base.md) · [Vite overview](../../README.md) · Next → [01i · require.context → import.meta.glob](01i-require-context-to-import-meta-glob.md)
