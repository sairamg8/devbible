---
sidebar_position: 10
title: "The Adapters API is the build-time contract that ended platform reverse-engineering — a typed description of your build, and a promise it only breaks on a major version"
sidebar_label: "The Adapters API — why it exists"
description: "What a Next.js adapter is, why the API was created, how adapterPath and NEXT_ADAPTER_PATH wire one in, the NextAdapter interface, and where the build-time contract stops and the runtime cache interfaces begin."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Adapters](https://nextjs.org/docs/app/api-reference/adapters), [Creating an Adapter](https://nextjs.org/docs/app/api-reference/adapters/creating-an-adapter), [Adapters · Configuration](https://nextjs.org/docs/app/api-reference/adapters/configuration), [`adapterPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath), [Adapters · Runtime Integration](https://nextjs.org/docs/app/api-reference/adapters/runtime-integration), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), and [Next.js Across Platforms: Adapters, OpenNext, and Our Commitments](https://nextjs.org/blog/nextjs-across-platforms) (25 March 2026).
> Target: **Next.js 16.3.4** (16.3 GA 2026-08-03; 16.3 = Active LTS, 15.5 = Maintenance LTS). Node.js `>= 20.9`, TypeScript floor 5.1, Turbopack default. The Adapter API went **stable in 16.2**.

**For years, hosting a Next.js app anywhere other than Vercel meant reading `.next/` and guessing. Providers parsed `routes-manifest.json` and `prerender-manifest.json`, inferred which files were function-shaped and which were CDN-shaped, and re-guessed after every minor release. The Adapters API replaces that with a typed, versioned description of the build that Next.js hands you, plus a promise that its shape only changes on a major version. An adapter is a single module exporting two optional functions — everything else in this section is a field on the object those functions receive. This page covers why the API exists, how a platform switches it on, the interface itself, and the hard line between what an adapter controls and what it does not.**

## Why this API exists, in the words of the people who needed it

The March 2026 announcement states the problem from the provider's side. Philippe Serhal, an engineer at Netlify, describes what happened when the Next.js team offered to discuss Netlify's challenges: the team began compiling a laundry list of specific issues to share, and it quickly became clear that the common thread among **90%** of those issues was a single thing — the absence of a documented, stable mechanism to configure and read build output. That, above everything else on the list, was what Netlify needed.

The framework team's own framing of the gap is the mirror image: the missing piece was an upstream, stable, public contract that providers could build against.

Two consequences of that framing matter more than the API surface itself.

The first is that there is no second, better API behind this one. Vercel's adapter uses the same public contract every other adapter uses — no private hooks, no special integration path — and Vercel's adapter is open source.

The second is the versioning promise. Adapters implement two hooks: `modifyConfig`, which runs when configuration loads, and `onBuildComplete`, which runs when the full build output is available. Breaking changes to that contract require a new major version of Next.js.

That last sentence is the value proposition. Before it, a Next.js patch release could reshape a manifest and break a provider's deploy path on a Tuesday. Now the shape of `onBuildComplete`'s argument is inside the semver contract.

The post also names the design principle for everything that follows. On build, Next.js now produces a typed, versioned description of your application: routes, prerenders, static assets, runtime targets, dependencies, caching rules and routing decisions. The adapter consumes that description and maps it onto a provider's infrastructure. Nothing in the adapter's job is inference — every fact it needs is a field it is handed.

## Wiring an adapter in — two mechanisms, two audiences

An **application developer** who wants a specific adapter points at it from the config:

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
const nextConfig = {
  adapterPath: require.resolve('./my-adapter.js'),
}

module.exports = nextConfig
```

A **platform** that wants its users to do nothing sets an environment variable in its build container instead. The docs give `NEXT_ADAPTER_PATH` as the alternative to `adapterPath`, and state its purpose plainly: it exists to enable zero-config usage in deployment platforms.

```bash filename="Terminal"
NEXT_ADAPTER_PATH=/opt/platform/adapter/dist/index.js next build
```

This is why a hosted build "just works" without a config edit — and why an adapter's behaviour can surprise you when you have never opened `next.config.js`. The wiring is not in your repository.

`require.resolve` rather than a bare string is the documented form for a good reason: the adapter path is resolved as a module specifier at build time, and a relative string is resolved against a working directory you do not control on a hosted builder.

## The interface

An adapter is a plain module. Nothing is registered and nothing is discovered by convention: the docs define an adapter as a module that exports an object implementing the `NextAdapter` interface, and that is the entire discovery mechanism.

```typescript
import type { NextAdapter } from 'next'
```

Both hooks are optional. An adapter that only wants to observe builds implements `onBuildComplete` alone; an adapter that only coerces configuration implements `modifyConfig` alone.

```typescript
export interface NextAdapter {
  name: string
  modifyConfig?: (
    config: NextConfigComplete,
    ctx: {
      phase: PHASE_TYPE
      nextVersion: string
      projectDir: string
    }
  ) => Promise<NextConfigComplete> | NextConfigComplete
  onBuildComplete?: (ctx: {
    routing: {
      beforeMiddleware: Array<Route>
      middlewareMatchers: Array<Route>
      beforeFiles: Array<Route>
      afterFiles: Array<Route>
      dynamicRoutes: Array<Route>
      onMatch: Array<Route>
      fallback: Array<Route>
      shouldNormalizeNextData: boolean
      rsc: RoutesManifest['rsc']
    }
    outputs: AdapterOutputs
    projectDir: string
    repoRoot: string
    distDir: string
    config: NextConfigComplete
    nextVersion: string
    buildId: string
  }) => Promise<void> | void
}
```

`Route` is deliberately flat — a compiled regex plus the matching conditions Next.js already evaluated:

```typescript
type Route = {
  source?: string
  sourceRegex: string
  destination?: string
  headers?: Record<string, string>
  has?: RouteHas[]
  missing?: RouteHas[]
  status?: number
  priority?: boolean
}
```

Note `sourceRegex`. You are never asked to reimplement Next.js's path-to-regexp dialect; the framework hands you the compiled expression it would have used itself. That single field is what makes a third-party routing layer defensible rather than an eternal source of subtle mismatches.

The `name` field is the only required member. It is what a platform surfaces in build logs and what a composing adapter reads to decide whether it has already been wrapped.

## Where the adapter stops

This is the single most common misconception about the API, and the runtime-integration page draws the boundary explicitly. The Deployment Adapter API is a **build-time** interface: it tells your platform what was built and how requests should be routed. **Runtime** behaviour — request handling, streaming and caching — is handled by the Next.js server itself and by two cache interfaces, `cacheHandler` and `cacheHandlers`. Nothing an adapter returns is consulted while a request is being served.

The docs split the responsibilities the same way. The **adapter**, at build time, processes build outputs, configures routing and sets up platform-specific infrastructure. The **cache interfaces**, at runtime, do the rest: `cacheHandler` manages ISR and server-cache storage and revalidation across instances, and `cacheHandlers` configures the backends for the `'use cache'` directive together with tag coordination.

So the complete integration surface is three things:

| Surface | When it runs | What it owns |
| --- | --- | --- |
| The adapter (`adapterPath`) | Build time | Outputs, routing table, platform packaging |
| `cacheHandler` (singular) | Runtime | ISR, route handlers, patched `fetch` / `unstable_cache`, image optimization |
| `cacheHandlers` (plural) | Runtime | `'use cache'` directive backends and tag coordination |

An adapter implementing only the build hook produces a working deployment on a single instance. It is the *multi-instance* case — revalidation propagating across servers — where the runtime cache interfaces stop being optional. The Deploying to Platforms matrix lists "Shared Cache" as **Recommended** for ISR (time-based and on-demand), PPR and Cache Components, and is precise about what "recommended" rather than "required" means: without a shared cache each instance maintains its own cache independently, so every feature still works correctly on each instance in isolation — what you lose is propagation, because a revalidation event on one instance does not reach the others.

## Before you write one: check whether you need one

The platform requirement Next.js actually states is far smaller than the adapter API suggests:

> *"To run Next.js, your platform needs a Node.js server. That's it."*

A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy and `after()`. The only extra dependency named anywhere in the requirements is `sharp`, which Image Optimization needs. An adapter is not how you make Next.js work; it is how you make Next.js work *as native primitives of your platform* — one function per route, static assets on object storage, routing executed at the CDN instead of inside the Node process.

The guide's own framing of what "supported" means is worth internalising before you invest in an adapter, because it splits into two claims that behave completely differently.

**Functional fidelity** means every Next.js feature works correctly. The adapter test suite is the contract: if a platform's adapter passes the tests, it supports Next.js. This claim is binary — it passes or it doesn't, with no partial credit.

**Performance fidelity** means features achieve their optimal performance characteristics. This one is a spectrum, and the docs say so directly: every platform will achieve it differently based on its architecture. A platform can sit anywhere on that spectrum and still be a fully supported target, because support is decided by the first claim, not the second.

## Gotchas

**★ `NEXT_ADAPTER_PATH` can silently win on a hosted build, and nothing in your repository says so.**
You configure `adapterPath` in `next.config.js`, ship, and the adapter that ran is a different one — or an adapter ran when you configured none. Hosting platforms inject `NEXT_ADAPTER_PATH` into the build environment precisely so that zero-config usage works. Log the adapter identity from `modifyConfig` before concluding your config was ignored, and check the platform's build-environment settings:

```js
async modifyConfig(config, { phase, nextVersion, projectDir }) {
  console.log(`[adapter] ${adapter.name} active — next ${nextVersion} @ ${projectDir}`)
  return config
}
```

The docs do not state a precedence order when both `adapterPath` and `NEXT_ADAPTER_PATH` are set. **I could not confirm which one wins** — treat setting both as undefined behaviour and set exactly one.

**★ An adapter cannot change runtime behaviour, so no amount of build-time work fixes cross-instance revalidation.**
Revalidation works on one instance and not others; `'use cache'` entries vanish on a cold start; you go looking for the adapter hook that controls it. There is none — nothing from `onBuildComplete` is loaded at request time. Ship a cache implementation alongside the adapter, and have `modifyConfig` wire it so the user does not have to:

```js
async modifyConfig(config, { phase }) {
  if (phase !== 'phase-production-build') return config
  config.cacheHandler = require.resolve('./platform-cache-handler.js')
  config.cacheHandlers = {
    default: require.resolve('./platform-use-cache-handler.js'),
  }
  return config
}
```

**★ Writing an adapter when a Node.js server would have done.**
Teams reach for the adapter API because it is the new, framework-blessed surface, then spend weeks packaging functions to land somewhere a container would have reached in an afternoon with full feature support. The guide's minimum requirement is one Node process plus `sharp`. Write an adapter when you are mapping onto platform-native primitives — per-route isolates, object-storage assets, CDN-executed routing — not to make features work.

**★ A relative string in `adapterPath` resolving against the wrong directory.**
`adapterPath: './my-adapter.js'` looks equivalent to `require.resolve('./my-adapter.js')` and is not: the documented form resolves the specifier through Node's resolver relative to the config file, while a bare string is at the mercy of the builder's working directory. On a hosted builder that runs `next build` from a workspace root, the two differ. Always use `require.resolve`.

**★ Assuming "verified adapter" means "every feature works".**
Verification means open source plus running the suite; it does not by itself assert a passing score. The docs describe the suite's purpose as giving visibility into which features work, which are in progress and where gaps remain — that is a status report, not a pass mark. And the Deploying page says publicly visible test results for each adapter are still coming, so at the time of writing there is no central scoreboard to read. Read the platform's own results, not the badge.

## Interview questions

**★ What problem did the Adapters API solve, and what did platforms do before it?**
Before 16.2 a platform that wanted to run Next.js on its own primitives had to reverse-engineer `.next/` — the routes manifest, the prerender manifest, the standalone trace — none of which were a public contract, and any release could change them. The API replaces that with a typed description of the build handed over by the framework plus a semver promise: breaking changes to the adapter contract require a new major version of Next.js. Netlify's own summary of the era was that 90% of the specific issues they had compiled shared one root cause, which was the lack of a documented, stable mechanism to configure and read build output.

**★ Is the adapter a runtime interface?**
No. It is explicitly build-time. Request handling, streaming and caching at runtime belong to the Next.js server and to `cacheHandler` (ISR, route handlers, patched `fetch` and `unstable_cache`, image optimization) and `cacheHandlers` (`'use cache'` backends and tag coordination). The full platform integration surface is the adapter plus those two cache interfaces — and a platform that ships only the adapter still works correctly on a single instance.

**★ Does Vercel's adapter have privileged access to the framework?**
No, and this is on the record twice. The platform guide states that there are no private framework hooks or integration paths and that Vercel's adapter uses the same public API as every other adapter. The `adapterPath` reference then points readers at `nextjs/adapter-vercel` as a full reference implementation, which is only meaningful because it is open source and uses nothing you cannot use.

**★ How does a platform enable an adapter without asking users to change their config?**
By setting `NEXT_ADAPTER_PATH` in the build environment. `adapterPath` in `next.config.js` is the developer-facing route; the environment variable is the platform-facing one, and the docs describe its purpose as enabling zero-config usage in deployment platforms — the user's repository stays untouched.

**★ What is the minimum a platform needs to run Next.js, adapter or not?**
A Node.js server, and the docs say nothing more is required. A single `next start` handles Server Components, ISR, PPR, Cache Components, Server Actions, Proxy and `after()` correctly. The one extra package is `sharp`, for Image Optimization. Streaming support is needed for PPR and Server Components to deliver progressively — without it responses are buffered and sent whole, which still works but loses the streaming benefit.

**★ What is the difference between functional fidelity and performance fidelity, and why does the distinction exist?**
Functional fidelity is binary: the adapter passes the compatibility suite or it does not, and passing means every feature works correctly — the suite is the contract that decides whether a platform supports Next.js. Performance fidelity is a spectrum — PPR's static shell served at CDN latency rather than origin latency, ISR revalidation propagating sub-second — and the docs say explicitly that every platform will achieve it differently based on its architecture. The distinction exists so that "supported" is a testable claim rather than a marketing one: a platform achieving functional fidelity is a fully supported deployment target regardless of where it sits on the performance spectrum.

**★ Why is `sourceRegex` on the `Route` type such an important design decision?**
Because it removes the largest source of divergence between Next.js and a third-party router. Route matching in Next.js involves a specific path-to-regexp dialect, catch-all and optional-catch-all segments, `has`/`missing` conditions and ordering across seven phases. Handing the platform a compiled regex plus the already-evaluated conditions means the platform executes Next.js's decision rather than re-deriving it — which is exactly the class of bug that made pre-adapter integrations drift after every release.

**★ Both hooks are optional. What is a legitimate adapter that implements only one?**
An observability or build-audit adapter implements `onBuildComplete` alone: it records route counts, output sizes and dependency traces for a platform's build analytics without changing anything. Conversely, an adapter that only needs to declare a platform capability — `supportsImmutableAssets`, a cache handler path, a forced `output` mode — implements `modifyConfig` alone and lets the platform's existing pipeline consume `.next/` as before.

---

← [**Project Milestone:** SprintDesk deployed twice](06-project-milestone-sprintdesk-deployed-twice.md) · [Chapter 16 overview](01-explanation.md) · Next → [The two adapter hooks in detail](11-modifyconfig-and-onbuildcomplete-the-two-hooks-in-detail.md)
