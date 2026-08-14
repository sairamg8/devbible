---
title: "The renderer packages"
sidebar_label: "14 · The renderer packages"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — reactjs/rfcs
> [RFC 0227 · Server Module Conventions](https://github.com/reactjs/rfcs/blob/main/text/0227-server-module-conventions.md)
> (the `"react-server"` export condition, the fork example, and the duplicated-resolution
> consequence), react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) (the stability
> note), the two December 2025 advisories (the three package names and their versions), and
> [React Router · React Server Components](https://reactrouter.com/how-to/react-server-components)
> (the `@vitejs/plugin-rsc` peer dependency and the three entry points).
> ⚠️ **`"react-server"` is *not* in Node's community conditions list** — checked against
> [nodejs.org/api/packages.html](https://nodejs.org/api/packages.html), which documents only
> `types`, `browser`, `development` and `production`. It is a React convention that bundlers
> implement.
> No sandbox script backs this page; claims are cited, not measured.

**The three packages nobody installs on purpose.** You almost certainly have one of them, it
arrived through your framework, and December 2025 made knowing that non-optional
([topic 12](12-december-2025-advisories.md)).

## The three packages

| Package | Bundler |
|---|---|
| `react-server-dom-webpack` | webpack |
| `react-server-dom-turbopack` | Turbopack |
| `react-server-dom-parcel` | Parcel |

One implementation of the RSC renderer per bundler, because the renderer has to know how the
bundler references a module — the payload carries *"placeholders for where Client Components
should be rendered and references to their JavaScript files"*
([topic 13](13-the-rsc-payload.md)), and "reference to a JavaScript file" means something
bundler-specific.

There is also `@vitejs/plugin-rsc`, which React Router names as a **peer dependency** for its
RSC support — the Vite-side equivalent of the same job.

⚠️ **You did not put these in `package.json`.** react.dev's advisory wording is that
frameworks *"depended on, had peer dependencies for, or included"* them, naming `next`,
`react-router`, `waku`, `@parcel/rsc`, `@vitejs/plugin-rsc` and `rwsdk`. Audit the resolved
lockfile, not your direct dependencies.

## 🔴 The `"react-server"` export condition

This is the mechanism that lets one package name resolve to different code in the RSC
environment than in the client or SSR one.

> **The `"react-server"` condition applies only React Server Component environments.**

```json
"exports": {
  ".": {
    "react-server": {
      "browser": "./debugger-polyfill.server.js",
      "node": "./native-impl.server.js"
    },
    "default": {
      "browser": "./browser-impl.client.js",
      "node": "./node-polyfill.client.js"
    }
  }
}
```

Two dimensions at once: **which React environment** (`react-server` versus everything else)
and **which JavaScript environment** (`browser` versus `node`). The RFC's own example notes
that the RSC environment can itself run in a browser for debugging, which is why the two
axes cannot be collapsed into one.

### The consequence that explains the whole build

> **Because of the `"react-server"` export condition, the correct way to implement a module
> graph requires duplicating module resolution on the server.**
>
> **If module A imports module B which is forked based on `"react-server"`, then there has to
> be two copies of module A.**

**Resolution happens twice, and the duplication is contagious upward.** Module A did not fork
anything — it merely imports something that did, so it needs one build for the RSC pass and
one for SSR.

That single paragraph explains several things you otherwise meet as mysteries:

- Why RSC support is a **bundler feature** rather than a library you install. Nothing in
  userland can duplicate a bundler's resolution graph.
- Why the RSC renderer is **one package per bundler**.
- Why build times and memory rise when a project adopts RSC.
- Why a library that forks on `"react-server"` can behave differently in an RSC render and an
  SSR render of the same page, with no code of yours differing.

## Why the directive, rather than a file extension

> **No more file extension conventions. A `"use client"` directive at the top of a file
> defines that it's a boundary between server and client.**

Earlier proposals used `.client.js` / `.server.js` suffixes. The directive won because a
boundary is a property of the *module*, not of its filename — and because a filename
convention cannot travel through a published package the way a directive in the shipped file
does ([topic 03](03-use-client.md)).

## What a bundler has to implement

Assembling the pieces from this phase, RSC support means at minimum:

1. **Resolve with the `"react-server"` condition** for the server graph, and without it for
   the client and SSR graphs — accepting the duplicated resolution above.
2. **Understand `'use client'`** as a boundary: stop following the import into the server
   graph, and create a client entry point and a stable module reference for it.
3. **Understand `'use server'`**: turn each exported function into a callable reference and
   route requests back to it ([topic 04](04-use-server.md)).
4. **Preserve directives through the pipeline.** Minifiers and transpilers that strip a
   leading string literal silently break the boundary — which is why library authors have to
   configure their build tools to keep it.
5. **Wire the renderer** — the `react-server-dom-*` package for that bundler — to produce and
   consume the payload.

React Router's setup shows the shape a framework builds on top: an **RSC server entry** that
matches the request and generates payloads, an **SSR entry** that turns a payload into HTML
for document requests, and a **browser entry** that hydrates and installs `callServer` for
post-hydration Server Functions.

## Stability — and why the pinning advice exists here

> **While React Server Components in React 19 are stable and will not break between minor
> versions, the underlying APIs used to implement a React Server Components bundler or
> framework do not follow semver and may break between minors in React 19.x.**
>
> **To support React Server Components as a bundler or framework, we recommend pinning to a
> specific React version, or using the Canary release.**

**These packages are that boundary made concrete.** Application code sees a stable feature;
whoever integrates the renderer sees an unstable API. React Router says the same thing in its
own words — its RSC support is *"experimental and subject to breaking changes in minor/patch
releases"*, with every API still `unstable_`-prefixed.

And the pinning advice cuts both ways after December 2025: pin deliberately, then keep
watching, because the patched versions were 19.0.1/19.1.2/19.2.1 and then 19.0.4/19.1.5/19.2.4
([topic 12](12-december-2025-advisories.md)).

## Gotchas

**Symptom:** `react-server-dom-*` is not in `package.json`, so the December advisories look
irrelevant.
**Cause:** frameworks depend on, peer-depend on, or include it.
**Fix:** audit the resolved lockfile.

**Symptom:** a library behaves differently in a Server Component than in a Client Component
with identical code.
**Cause:** it forks its exports on the `"react-server"` condition.
**Fix:** read its `exports` map; this is intended behaviour, not a bug.

**Symptom:** a published component library's `'use client'` stopped working for consumers.
**Cause:** a build step stripped the leading directive.
**Fix:** configure the bundler to preserve it — the reason library build configs carry a
banner setting for exactly this.

**Symptom:** build times and memory jumped after adopting RSC.
**Cause:** module resolution is duplicated, and the duplication propagates to every importer
of a forked module.
**Fix:** expected; budget for it rather than hunting a regression.

**Symptom:** an attempt to add RSC support to an unsupported bundler stalls.
**Cause:** it needs the `"react-server"` condition, a second resolution pass, directive
handling and a matching renderer package.
**Fix:** use a supported bundler ([topic 18](18-without-a-framework.md)).

**Symptom:** a patch-level upgrade of a framework's RSC plugin broke the build.
**Cause:** the bundler-facing APIs explicitly do not follow semver in 19.x.
**Fix:** pin the exact React version the plugin expects, and review it deliberately.

## Interview questions

**★ What are `react-server-dom-webpack`, `-turbopack` and `-parcel`?**
The RSC renderer, one build per bundler. The renderer has to emit references to Client
Component JavaScript files inside the payload, and "reference to a module" is
bundler-specific — hence one package each. Nobody installs them directly; they arrive through
a framework, which is exactly why the December 2025 advisories caught people who had never
heard of them.

**★ What is the `"react-server"` export condition?**
A conditional export that *"applies only React Server Component environments"*, letting one
package name resolve to different implementations in the RSC pass than in the client or SSR
pass. It composes with `browser`/`node`, because an RSC environment can itself run in a
browser for debugging.

**★ What is its most important consequence?**
That module resolution must happen **twice**. Per the RFC: if module A imports module B which
forks on `"react-server"`, there have to be two copies of module A. The duplication spreads
upward to every importer — which is why RSC support has to live in the bundler, why the
renderer is one package per bundler, and why builds get heavier.

**★ Why a directive instead of `.server.js` / `.client.js` filenames?**
Because the boundary is a property of the module rather than of its filename, and a directive
survives publishing to npm in a way a filename convention does not. The trade-off is that
build tooling must preserve a leading string literal — strip it and the boundary silently
disappears.

**What does a bundler actually have to implement for RSC?**
Resolution with the `"react-server"` condition for the server graph and without it elsewhere;
`'use client'` as a boundary that produces a client entry point and a stable module
reference; `'use server'` as a callable reference plus request routing; preservation of
directives through the pipeline; and the matching renderer package to produce and consume the
payload.

**How stable is any of this?**
Stable for application code in React 19, explicitly not semver for the bundler and framework
integration APIs, which may break between 19.x minors — the docs recommend pinning an exact
version or tracking Canary. React Router's own RSC support is still experimental with every
API `unstable_`-prefixed, which is a fair reading of the ecosystem's maturity.

---

← Prev: [The RSC payload](13-the-rsc-payload.md) ·
Index: [Phase 10](README.md) ·
Next → [Data fetching in RSC](15-data-fetching-in-rsc.md)
