---
title: "Storing the Dev Server: the One-Line Note That Explains Every Plugin `TypeError` That Only Happens in CI"
sidebar_label: "Storing the Server"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `configureServer`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Storing the Dev Server

> *"Note `configureServer` is not called when running the production build so your other hooks need to guard against its absence."* — [Plugin API](https://vite.dev/guide/api-plugin)

One sentence, stated as a note, and it is the most consequential line in the whole `configureServer`
section. It explains a category of plugin failure that **passes every local check and fails the
first time CI runs `vite build`**.

---

## 1. Under-The-Hood Mechanics

### Why plugins store the server

> *"In some cases, other plugin hooks may need access to the dev server instance (e.g. accessing the WebSocket server, the file system watcher, or the module graph). This hook can also be used to store the server instance for access in other hooks."*

The documented idiom is the same closure-capture pattern as `configResolved`:

```js
const myPlugin = () => {
  let server
  return {
    name: 'configure-server',
    configureServer(_server) { server = _server },
    transform(code, id) {
      if (server) {
        // use server...
      }
    },
  }
}
```

🔴 **The `if (server)` in the docs' own example is not decoration.** It is the guard the note
requires, written into the sample so you copy it.

### The asymmetry that hides the bug

```
vite          → configureServer runs   → server is set      → every local check passes
vite build    → configureServer NEVER  → server undefined   → TypeError, in CI
```

Almost all local verification is `vite`. So the variable is populated in every developer's loop and
absent the first time the build runs — and the stack trace points into `transform`, which mentions
nothing about a dev server.

```
TypeError: Cannot read properties of undefined (reading 'moduleGraph')
    at transform (plugins/instrument.ts:14)      ← no mention of configureServer
```

That distance between cause and symptom is why this gets diagnosed as a race, a plugin-ordering
problem, or a Vite bug before anyone reads the note.

### What lives on the server, and therefore what vanishes

| Accessed via `server` | Present in a build? |
|---|---|
| `server.moduleGraph` | ⛔ no |
| `server.ws` / `server.hot` | ⛔ no |
| `server.watcher` | ⛔ no |
| `server.middlewares` | ⛔ no |
| `server.config` | ✅ available — but get it from `configResolved` instead |

The last row is the useful one: if all you needed was configuration, you never needed the server.
`configResolved` runs in **both** pipelines and hands you the same `ResolvedConfig`.

---


## 3. Production-Grade Code Example

```typescript
// The documented idiom, with the guard the note requires — and with the
// build path answered rather than merely guarded away.
import type { Plugin, ViteDevServer } from 'vite';

export function instrument(): Plugin {
  let server: ViteDevServer | undefined;

  return {
    name: 'instrument',

    // Global · sequential · NOT called during `vite build`.
    configureServer(s) { server = s },

    transform(code, id) {
      // 🔴 "configureServer is not called when running the production build so
      //    your other hooks need to guard against its absence."
      if (!server) {
        // ✅ Option 2: an explicit build-time equivalent. The behaviour survives
        //    the pipeline change instead of silently disappearing.
        const info = this.getModuleInfo(id);
        return (info?.importers.length ?? 0) > 1 ? instrumentCode(code) : null;
      }

      const mod = server.moduleGraph.getModuleById(id);
      return (mod?.importers.size ?? 0) > 1 ? instrumentCode(code) : null;
    },
  };
}
```

```typescript
// ✅ If all you needed was CONFIG, you never needed the server.
// `configResolved` runs in BOTH pipelines and hands you the same object.
export function usesConfigOnly(): Plugin {
  let config: import('vite').ResolvedConfig;
  return {
    name: 'uses-config-only',
    configResolved(c) { config = c },     // dev AND build
    transform(code, id) {
      return id.startsWith(config.root) ? rewrite(code, config.base) : null;
    },
  };
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Using the stored server without a guard

`configureServer` does not run in a build, so `server` is `undefined` there. An unguarded
`server.moduleGraph` in `transform` is a `TypeError` that appears only in CI.

### ⚠️ Pitfall 2 — Reaching for the server when you wanted the config

`server.config` is the same object `configResolved` gives you, and `configResolved` runs in both
pipelines. Using the server for configuration creates a build-time absence you did not need.

---

## Gotchas

**★ Symptom: `Cannot read properties of undefined (reading 'moduleGraph')` — only in `vite build`.** Cause: *"`configureServer` is not called when running the production build."* Fix: guard the stored server, and decide deliberately what the build path should do.

```ts
if (!server) return buildTimeEquivalent(code, id);
```

**★ Symptom: `server.ws.send` from `transform` throws in a build.** Cause: the same absence — there is no WebSocket server in a build. Fix: the same guard, and the same prior question about what the build should do instead.

**★ Symptom: a plugin needs `server.config` and crashes in the build.** Cause: the server was used as a route to configuration. Fix: `configResolved` gives you the same `ResolvedConfig` and runs in both pipelines. There was never a reason to go through the server for this.

**★ Symptom: `server.watcher` handlers never fire and nothing errors.** Cause: in a build there is no watcher, and the guard skipped registration silently. Fix: file-watching is inherently dev-only; scope the plugin with `apply: 'serve'` so the absence is structural rather than conditional.

**★ Symptom: a plugin works in `vite` and `vite preview` but not `vite build`.** Cause: `preview` is a server too — but it runs `configurePreviewServer`, not `configureServer`. Fix: check which of the three commands you actually verified; `preview` passing tells you nothing about the build's hooks, only about the artefact.

**★ Symptom: a plugin's build path was never executed by any test.** Cause: tests run through Vitest, which shares the dev transform. Fix: this is the same gap as [build-time env defects](../07-env-variables-and-modes/01a-build-time-vs-runtime-config.md) — assert against `dist/`, because no unit test can reach the build path.

---

## Interview questions

**★ Why does an unguarded stored server crash only in CI?**
Because `configureServer` *"is not called when running the production build"*, and local
verification is almost always `vite`, not `vite build`. So `server` is populated in every
developer's loop and `undefined` the first time CI builds — with a stack trace pointing into
`transform`, which mentions nothing about a dev server. The docs pair the fact with the instruction
in one sentence: *"your other hooks need to guard against its absence."* The distance between cause
and symptom is what makes it expensive; it is routinely diagnosed as a race or a Vite bug first.

**★ A plugin needs configuration in `transform`. Server or `configResolved`?**
`configResolved`, always. It runs in **both** pipelines and hands you the same `ResolvedConfig` that
`server.config` would have. Routing configuration access through the dev server creates a build-time
absence you did not need, and then a guard, and then a decision about what the build should do — for
a value that was available all along. The general rule is to reach for the narrowest hook that
supplies what you need, because every wider one you use imports its own availability constraints.

---

← [Server Hooks](01i-server-hooks.md) · [Vite overview](../../README.md) · Next → [The Guard Is Not the Fix](01k-the-guard-is-not-the-fix.md)
