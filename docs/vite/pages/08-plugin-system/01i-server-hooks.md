---
title: "`configureServer` and `configurePreviewServer`: Middleware Ordering by Return Value, and the Hook That Never Runs in a Build"
sidebar_label: "Server Hooks"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `configureServer`](https://vite.dev/guide/api-plugin), [§ `configurePreviewServer`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `configureServer` and `configurePreviewServer`

Both hooks give a plugin the server. Both are `async`, `sequential`, **Global** scope. This chunk is about the one that
surprises people first: **middleware ordering is expressed by whether you return a function**, and
there is no `order` option. The other surprise — that `configureServer` never runs in a build — is
[chunk 1j](01j-storing-the-server.md).

---

## 1. Under-The-Hood Mechanics

### `configureServer`

* **Type:** `(server: ViteDevServer) => (() => void) | void | Promise<(() => void) | void>`
* **Kind:** `async`, `sequential` · **Scope:** Global

> *"Hook for configuring the dev server. The most common use case is adding custom middlewares to the internal [connect](https://github.com/senchalabs/connect) app."*

### 🔴 Ordering is the return value

> *"The `configureServer` hook is called before internal middlewares are installed, so the custom middlewares will run **before** internal middlewares by default. If you want to inject a middleware **after** internal middlewares, you can return a function from `configureServer`, which will be called after internal middlewares are installed."*

```
configureServer(server) {              PRE  — runs before Vite's own middlewares
  server.middlewares.use(mw)                 (transform, HMR, SPA fallback, static)
}

configureServer(server) {
  return () => {                       POST — runs after all of them
    server.middlewares.use(mw)
  }
}
```

**There is no `order` option here.** The distinction is structural: *use it now* means pre, *return a
closure* means post. That is unusual API design and it is why so many middlewares end up on the
wrong side by accident — the pre form is what you write without thinking.

Which side you want has a reliable test:

```
intercepting a request Vite would otherwise handle?   → PRE   (auth gate, mock API, redirect)
handling what Vite did NOT handle?                    → POST  (custom 404, fallback route)
```

A POST middleware never sees a request the SPA fallback already answered, which is the usual reason
a "catch-all" middleware appears dead.

### `configurePreviewServer`

* **Type:** `(server: PreviewServer) => (() => void) | void | Promise<(() => void) | void>`
* **Kind:** `async`, `sequential` · **Scope:** Global

> *"Same as [`configureServer`](https://vite.dev/guide/api-plugin#configureserver) but for the preview server. Similarly to `configureServer`, the `configurePreviewServer` hook is called before other middlewares are installed. If you want to inject a middleware **after** other middlewares, you can return a function."*

Same shape, different server. Worth knowing because `vite preview` serves the **built** artefact, so
a middleware you added in `configureServer` is absent there — a dev-only mock API silently
disappears in preview, which is usually correct and occasionally a surprise.

---


## 3. Production-Grade Code Example

```typescript
// PRE middleware — runs BEFORE Vite's internal middlewares.
// Correct for anything that must INTERCEPT a request Vite would handle.
import type { Plugin } from 'vite';

export function mockApi(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      // No return value → installed before Vite's transform/HMR/static middlewares.
      server.middlewares.use('/api', (req, res, next) => {
        const fixture = fixtures[req.url ?? ''];
        if (!fixture) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(fixture));
      });
    },
  };
}
```

```typescript
// POST middleware — runs AFTER Vite's internal middlewares.
// Correct for anything that handles what Vite did NOT handle.
export function customNotFound(): Plugin {
  return {
    name: 'custom-404',
    configureServer(server) {
      // 🔴 Returning a function is the ONLY way to order this after
      //    the SPA fallback. There is no `order` option on this hook.
      return () => {
        server.middlewares.use((req, res) => {
          res.statusCode = 404;
          res.end(renderNotFound(req.url));
        });
      };
    },
  };
}
```

```typescript
// configurePreviewServer — same shape, and it serves the BUILT artefact,
// so dev-only middlewares are legitimately absent here.
export function previewBanner(): Plugin {
  return {
    name: 'preview-banner',
    configurePreviewServer(server) {
      return () => {   // post, same convention
        server.middlewares.use((req, res, next) => {
          res.setHeader('X-Environment', 'preview');
          next();
        });
      };
    },
  };
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Expecting a catch-all middleware to fire

Installed pre (the default), it runs before Vite's SPA fallback, which answers nearly everything.
Return a function to install it post.

### ⚠️ Pitfall 2 — Expecting an interceptor to work from post

The mirror image: a post middleware never sees a request Vite already handled. An auth gate or a
mock API must be pre.

### ⚠️ Pitfall 3 — Expecting `configureServer` middlewares in `vite preview`

`preview` serves the built artefact and uses `configurePreviewServer`. A dev mock API is absent
there by design — which is usually what you want and occasionally a surprise during QA.

### ⚠️ Pitfall 4 — Assuming the hook runs per environment

It is documented **Global**. One call, one server, regardless of how many environments exist.

---

## Gotchas

**★ Symptom: a custom 404 middleware never runs.** Cause: it was installed pre — the default — so Vite's SPA fallback answered the request first. Fix: return a function from `configureServer` to install it post. There is no `order` option on this hook.

**★ Symptom: an auth-gate middleware is bypassed for module requests.** Cause: it was installed post, after Vite's transform middleware already served the module. Fix: install it pre, by calling `server.middlewares.use` directly rather than returning a closure.

**★ Symptom: a plugin's dev mock API disappears under `vite preview`.** Cause: `preview` runs `configurePreviewServer`, not `configureServer`. Fix: expected. If the mock is genuinely needed in preview, implement the preview hook too — but consider whether previewing against mocks defeats the point.

**★ Symptom: middleware ordering changes when a plugin is moved in the array.** Cause: `configureServer` is `sequential`, so plugins install middlewares in plugin order — and `enforce` moves plugins between bands. Fix: this is real and load-bearing; if two middlewares must be ordered relative to each other, put them in one plugin.

**★ Symptom: a middleware runs on requests for `/@vite/client` and other internals.** Cause: a pre middleware sees every request, including Vite's own. Fix: filter on the URL prefix, and remember that `/@` and `/node_modules/.vite/` are Vite's namespace rather than your app's.

**★ Symptom: two plugins both return post functions and their order surprises someone.** Cause: post functions run after internal middlewares, still in plugin order. Fix: it is deterministic but doubly indirect — plugin order, then post-phase. Prefer one plugin owning a middleware chain whose order matters.

---

## Interview questions

**★ How do you control whether a middleware runs before or after Vite's internal middlewares?**
By whether you return a function. Calling `server.middlewares.use` directly installs pre, because
*"the `configureServer` hook is called before internal middlewares are installed"*; returning a
closure defers installation until after them. There is no `order` option — the ordering is expressed
structurally, which is unusual and is why so many middlewares end up on the wrong side. The test for
which you want is simple: intercepting a request Vite would otherwise handle is pre (auth, mocks,
redirects), and handling what Vite did *not* handle is post (a custom 404, a fallback route). A
catch-all installed pre appears dead because the SPA fallback answers nearly everything.

**★ What is the relationship between `configureServer` and `configurePreviewServer`?**
Same shape, different server, same post-middleware convention. `configureServer` runs for `vite`
(the dev server, serving unbundled source); `configurePreviewServer` runs for `vite preview`, which
serves the **built artefact**. The consequence people meet is that dev-only middlewares — a mock
API, a fixture endpoint — are absent in preview, which is usually correct, because previewing
against mocks defeats the purpose of previewing a production build. Implementing both is legitimate
for cross-cutting concerns like a header or a log line, and suspicious for anything that changes what
the app receives.

**★ Two plugins each add a middleware and their relative order matters. How do you make that reliable?**
Do not rely on it. `configureServer` is `sequential`, so middlewares are installed in plugin order —
which is real and deterministic — but ⚠️ the docs never state the order *within* an `enforce` band, and a preset
can change it invisibly by expanding to several plugins. If two middlewares genuinely have an
ordering dependency, put them in **one plugin** and install them in the order you want, which makes
the dependency local and visible. That is the same principle as eliminating cross-plugin coupling:
prefer arrangements where the ordering cannot be disturbed by something outside the code that needs
it.

**★ A pre middleware is running on requests you did not expect. Why?**
Because a pre middleware sees **every** request the dev server receives, including Vite's own —
`/@vite/client`, `/@id/...`, `/node_modules/.vite/deps/...`, HMR pings. It is installed before the
middlewares that would have claimed them, so nothing has filtered them out yet. The fix is to filter
by URL prefix and to know Vite's namespace: anything beginning `/@` is internal, as is
`/node_modules/.vite/`. This is also a good reason to prefer `server.middlewares.use('/api', fn)`
with a mount path over an unmounted middleware plus a manual check.

---

← [Eliminating Coupling](01h-eliminating-cross-plugin-coupling.md) · [Vite overview](../../README.md) · Next → [Storing the Server](01j-storing-the-server.md)
