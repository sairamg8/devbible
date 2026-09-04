---
title: "Instrumentation is not free observation — `register()` runs on the path to server readiness, so everything you put in it is latency added to every cold start, and the client half runs before hydration, which puts your monitoring SDK inside the interaction metric it was installed to measure"
sidebar_label: "06 · What instrumentation costs"
sidebar_position: 6
description: "The performance half of instrumentation.ts: register() blocking readiness, why the docs tell you to import inside register rather than at the top, the NEXT_RUNTIME guard, the pre-hydration cost of instrumentation-client, and why the logging config is a development tool that cannot help you in production."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (`version: 16.3.4`, `lastUpdated: 2026-06-09`), [How to set up instrumentation](https://nextjs.org/docs/app/guides/instrumentation) (`2026-08-25`), [`instrumentation-client.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client) (`2026-07-28`), [OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) (`2026-08-25`) and [`logging`](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging) (`2026-02-12`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run** — no cold-start timings, span counts or log output are reproduced here, because nothing in this pass ran the server.

**Every other page in this chapter makes the application faster. This one is about the thing you add *last*, that makes it slower, and that you cannot ship production performance work without. `register()` is documented to run once per new server instance and to complete *before the server is ready to handle requests* — which is exactly the guarantee that makes it the right place to install an SDK, and exactly why an `await` on a network call there is added to every cold start you will ever have. `instrumentation-client.ts` runs after the document loads and before React hydration, which puts it in front of interactivity: a monitoring SDK installed there is measured by the very INP number it was installed to report. And the `logging` block in `next.config.js` — the one that looks like production log configuration — is scoped to development mode in its own title. This page is the cost side. The contracts themselves belong to chapter 16 and are linked, not repeated.**

## What this page owns, and what it hands over

Chapter 16 closed this material as observability. This page keeps only the part that is a performance decision.

| Question | Where it is answered |
|---|---|
| What does registration cost, and how do you bound it | here |
| Why the docs say to import *inside* `register` | here |
| What `instrumentation-client.ts` costs before hydration | here |
| What a trace costs per request, and how to read spans as measurements | [06b · The price of a span](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md) |
| The full `register` / `onRequestError` contract, the `digest` trap | [ch16 · 04 · Telemetry and `instrumentation.ts`](../16-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md) |
| `@vercel/otel` vs `NodeSDK`, the full span catalogue, `next.*` attributes | [ch16 · 04b · OpenTelemetry and the span catalogue](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md) |
| Which metrics to report from the browser and how | [05 · Core Web Vitals](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) |

If you are here to *set up* telemetry, start with chapter 16 and come back. If you are here because telemetry made something slower, you are in the right place.

## `register()` is on the critical path to readiness

The reference states the contract in one sentence, and every cost on this page follows from it:

> *"The file exports a `register` function that is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests. `register` can be an async function."*

Read *"once when a new Next.js server instance is initiated"* precisely. It is **not** once per deployment. A new server instance is created on:

- every serverless cold start, which means every scale-out event under load and every wake from idle;
- every container start, so every rolling deploy, every replica added by an autoscaler, every crash-loop restart;
- every `next dev` start and every dev-server restart, because *"Next.js calls `register` in all environments"*;
- every additional worker process your host runs, if it runs more than one.

So the cost of `register` is not amortised over the lifetime of your app. It is multiplied by how often you scale. The worst case is exactly the case you care about: a traffic spike creates new instances, each new instance pays registration before serving its first request, and the requests that hit those instances are the ones your p99 is made of.

### What belongs in `register`, and what does not

| Do | Do not |
|---|---|
| Register exporters, tracers, and error handlers — in-process object construction | `await` a remote configuration or feature-flag fetch |
| Read `process.env` | Open a database connection to "warm" a pool |
| Install a `process.on('uncaughtException')` handler | Run migrations, seed data, or check schema |
| Dynamically import the runtime-specific module you actually need | Import every SDK you might need in any runtime |

The rule that makes them separable: **registration should construct, not communicate.** Anything that talks to the network is unbounded on the one path that has no timeout you control.

```ts
// instrumentation.ts — registration constructs and returns.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

```ts
// instrumentation.node.ts
import { registerOTel } from '@vercel/otel'

registerOTel({ serviceName: 'sprintdesk' })
```

And the shape that quietly costs you a cold start every time you scale:

```ts
// instrumentation.ts — 🔴 do not do this.
export async function register() {
  // Every new instance now waits on a third-party HTTP round trip
  // before it is allowed to serve its first request.
  const flags = await fetch('https://flags.example.com/v1/sprintdesk').then((r) =>
    r.json()
  )
  globalThis.__flags = flags
}
```

The fix is not "make the fetch faster". It is to move the dependency off the readiness path entirely — start with a default, and let the first request that needs the value fetch it and cache it:

```ts
// lib/flags.ts
let cached: Promise<Flags> | undefined

export function getFlags(): Promise<Flags> {
  cached ??= fetch('https://flags.example.com/v1/sprintdesk')
    .then((r) => r.json())
    .catch(() => DEFAULT_FLAGS)
  return cached
}
```

Now the cost is paid once per instance by one request rather than by the instance itself, it is recoverable if the flag service is down, and — because it is inside a request — it appears in your traces as a span you can see instead of as unexplained cold-start latency.

## Why the docs tell you to import *inside* `register`

> *"We recommend importing the file from within the `register` function, rather than at the top of the file."*

The guide gives the code-organisation reason: colocating side effects and avoiding unintended consequences from importing globally. There is a second reason that is purely about startup, and it is the one that matters at this point in the chapter.

**A top-level `import` is evaluated when the instrumentation module is loaded, in every runtime, whatever `register` later decides.** An OpenTelemetry Node SDK is not one module; it is a graph of exporters, processors, resource detectors and semantic-convention packages. Hoisting that import to the top means every server instance parses and evaluates that whole graph before `register` even runs — including instances in a runtime that would have skipped it, and including the branch you guarded so carefully:

```ts
// 🔴 The guard is decorative: the import already ran.
import { NodeSDK } from '@opentelemetry/sdk-node'

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    new NodeSDK({ /* … */ }).start()
  }
}
```

```ts
// ✅ The guard actually gates the module graph.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    new NodeSDK({ /* … */ }).start()
  }
}
```

The correctness half of this is documented outright:

> *"Unlike `@vercel/otel`, `NodeSDK` is not compatible with edge runtime, so you need to make sure that you are importing them only when `process.env.NEXT_RUNTIME === 'nodejs'`."*

> *"Next.js calls `register` in all environments, so it's important to conditionally import any code that doesn't support specific runtimes."*

⚠️ `process.env.NEXT_RUNTIME` is still the documented way to branch inside `instrumentation` — *"The `instrumentation.js` file works in both the Node.js and Edge runtime, however, you can use `process.env.NEXT_RUNTIME` to target a specific runtime."* That is separate from the per-route `runtime = 'edge'` export, which is deprecated in 16.3; see [04 · Runtimes](04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md). The environment variable is a fact about where the code is executing; the route export was a choice you no longer make.

## The client half runs before interactivity

`instrumentation-client.ts` is documented to run at three points, in this order:

> *"1. **After** the HTML document is loaded 2. **Before** React hydration begins 3. **Before** user interactions are possible"*

That ordering is why error tracking installed there catches hydration failures — and it is also why it is a performance liability. Work in this file happens *between* the page appearing and the page becoming usable. It does not delay LCP if the LCP element is server-rendered, but it sits squarely in front of interactivity, which is the metric this chapter's board work is about.

Next.js puts a number on it, but only in development:

> *"Next.js monitors initialization time in development and will log warnings if it takes longer than 16ms, which could impact smooth page loading."*

16 ms is one frame at 60 Hz. Treat the warning as a budget, not a lint rule, and remember it is a *development* warning: in production nothing tells you the file got slower.

The second constraint is what happens if you try to escape the budget by going async:

> *"Only synchronous, top-level code is guaranteed to complete before hydration. Asynchronous work started here (a `Promise`, `import()`, or top-level `await`) is not awaited and may resolve after hydration has begun, so treat it as fire-and-forget."*

So you cannot have both. Either the SDK is installed synchronously and its initialisation cost is charged to interactivity, or it is imported dynamically and there is a window — of unspecified length — in which it is not yet listening. Choose deliberately per SDK: error tracking is worth the synchronous cost because the window it would miss is the one that breaks the page; a product-analytics library usually is not.

```ts
// instrumentation-client.ts
import { ErrorReporter } from './lib/error-reporter'

// Synchronous: this must be listening before hydration can fail.
ErrorReporter.install({ dsn: process.env.NEXT_PUBLIC_ERROR_DSN })

// Fire-and-forget: analytics can miss the first 200 ms of a session
// without anybody being unable to use the product.
void import('./lib/product-analytics').then((m) => m.start())
```

The full contract — `onRouterTransitionStart`, `instrumentationClientInject` ordering, the double-initialisation trap — is [ch16 · 04](../16-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md). Reporting Web Vitals from the browser is [05](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md), and it belongs in its own client component rather than here.

## 🔴 The `logging` config cannot help you in production

This block is the most commonly mis-scoped thing in a Next.js observability setup, because it lives in `next.config.js` and reads like a production switch:

```js
// next.config.js
module.exports = {
  logging: {
    fetches: { fullUrl: true, hmrRefreshes: true },
    incomingRequests: { ignore: [/^\/api\/health$/] },
    serverFunctions: true,
  },
}
```

Its own reference page is titled *"Configure logging behavior in the terminal when running Next.js in **development mode**"*, and every option repeats the scope — *"whether the full URL is logged to the console when running Next.js in development mode"*, *"Server Function invocations are logged by default during development"*, and, most explicitly, *"Since this is only logged in development, this option doesn't affect production builds"*.

**It is still a performance tool — just a development one.** `logging.fetches.fullUrl` is the cheapest way to see a request waterfall while you are working: every `fetch` your server components make, printed with its full URL, in the order they were issued. Sequential awaits that should have been a `Promise.all` show up as a list. Requests you thought were cached show up at all. And `hmrRefreshes: true` reveals the fetches that were served from the Server Components HMR cache, which are otherwise *"not logged by default"* and therefore invisible while you convince yourself a route is fast.

What it is not is a source of production data. In production, request timing comes from spans — [06b](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md) — and errors come from `onRequestError`.

## Gotchas

**★ Symptom: p99 latency degrades exactly when traffic increases, and p50 is unchanged.** Cause: `register` does network I/O and *"must complete before the server is ready to handle requests"*, so it is charged to every new instance — and new instances only appear when you scale. The steady-state instances are already warm, so the median never sees it. Fix: move the network dependency behind a lazily-resolved promise, as in `lib/flags.ts` above, so the cost lands inside a request where a span can see it.

**★ Symptom: the edge build fails with a missing Node built-in even though the `NEXT_RUNTIME` guard is right there.** Cause: the SDK was imported at the top of `instrumentation.ts`, so the module graph is pulled in before `register` runs and before the guard can decide anything. Fix: dynamic import inside the branch.

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

**★ Symptom: `next dev` startup got noticeably slower after adding telemetry, and everyone assumes Turbopack regressed.** Cause: `register` runs in development too — *"Next.js calls `register` in all environments"* — and every dev-server restart re-pays it. Fix: gate the expensive exporter on an environment variable so local development registers a no-op, and keep the tracing you actually want in dev to a console exporter:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.OTEL_ENABLED !== '1') return
  await import('./instrumentation.node')
}
```

**★ Symptom: registration "works" locally and silently does nothing in production, with no error anywhere.** Cause: the file is not where the convention requires it. It must be *"in the **root** of your application or inside a `src` folder"*, and *"not inside the `app` or `pages` directory"*; if `pageExtensions` adds a suffix, *"you will also need to update the `instrumentation` filename to match"*. Fix: move it and rename it. There is no warning for this — the absence of a convention file is indistinguishable from not wanting one.

**★ Symptom: a cold start is fast in staging and slow in production, same image.** Cause: registration depends on something that resolves differently per environment — a collector hostname that fails DNS and falls back, an exporter endpoint behind a private link. Any of those turn a construction call into a network wait. Fix: never let the exporter's connectivity block `register`; construct the exporter and let it buffer or drop. If your SDK's constructor connects eagerly, that is an argument for the batching-processor setup described in [ch16 · 04b](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

**★ Symptom: INP got worse on the release that added client monitoring, and the monitoring says INP got worse.** Cause: `instrumentation-client.ts` runs *"before React hydration begins"* and *"before user interactions are possible"*, so a heavy synchronous SDK install delays the moment the page can respond at all — and the tool reporting the regression is the thing causing part of it. Fix: keep only what must be listening before hydration synchronous, and make the rest fire-and-forget, accepting the documented gap.

**Symptom: a polyfill or SDK installed in `instrumentation-client.ts` is intermittently missing during the first interaction.** Cause: it was loaded with `import()`, and *"asynchronous work started here … is not awaited and may resolve after hydration has begun"*. Fix: if it must be there, import it statically and pay the cost; the documentation offers no third option.

**Symptom: `logging.fetches.fullUrl` produces nothing in production and someone concludes fetch logging is broken.** Cause: the whole `logging` block is development-only by its own reference title. Fix: reproduce the problem in `next dev` where the option applies, or use the fetch span in production — see [06b](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md).

**Symptom: a route that was previously static now renders on every request, and it started with a telemetry change.** Cause: something added to instrumentation or to a shared module reads request-scoped data at module scope, dragging the route to request time. Fix: keep instrumentation out of the module graph your routes import — `instrumentation.ts` is a convention file, not a library to import from — and if you need request-scoped correlation IDs, take them from the span context inside the request, not from a module-level variable.

**Symptom: two instances of your APM report as two services with the same name and different resource attributes.** Cause: registration ran once per worker process and each worker detected resources independently. Fix: this is expected, not a bug — set an explicit `serviceName` and a stable instance identifier in `registerOTel` so the backend groups them, rather than relying on auto-detection.

## Interview questions

**★ Why does putting an `await fetch(...)` in `register()` hurt p99 but not p50?**
Because `register` runs once per *new server instance*, not once per deployment, and must complete before that instance can serve anything. Instances that are already warm never re-pay it, so the median request — served by a warm instance — is unaffected. New instances appear when you scale out or wake from idle, which is precisely when traffic is high, so the requests that pay the registration delay land in the tail. That makes it one of the harder latency problems to reproduce: it is invisible under the load you can generate on a laptop, and it is worst under the load you cannot.

**★ The documentation recommends importing inside `register` rather than at the top of the file. Give the performance argument, not the tidiness argument.**
A top-level import is evaluated when the module is loaded, which is before `register` is called and regardless of what `register` would have decided. For an OpenTelemetry Node SDK that is a large module graph — exporters, processors, resource detectors — parsed and evaluated on every instance start including instances that will never use it. Moving it to a dynamic `import()` inside the runtime guard means the graph is only loaded where it is used, so the guard gates evaluation cost as well as compatibility. The compatibility failure is loud; the evaluation cost is silent, which is why the tidiness framing undersells it.

**★ Where does `instrumentation-client.ts` sit relative to hydration, and what does that mean for the metric you are trying to improve?**
It runs after the HTML document is loaded, before React hydration begins, and before user interactions are possible. That ordering is the value — an error reporter installed there can see hydration itself failing, which a `useEffect` cannot, because effects only run once hydration succeeds. It is also the cost: everything synchronous in that file is executed before the page can respond to input, so it is directly in front of interaction readiness. Next.js warns in development past 16 ms, which is a single frame. The escape hatch — going async — is explicitly not a guarantee: asynchronous work there is not awaited and may resolve after hydration has begun.

**★ Someone asks you to turn on `logging.fetches.fullUrl` in production to debug a caching problem. What do you say?**
That the option does not exist in production. The `logging` reference is titled as configuring terminal logging in development mode and repeats that scope on every option, including stating outright that incoming-request logging does not affect production builds. The right answer in production is the `fetch` span, which carries the URL as an OpenTelemetry attribute, or the platform's log drain. The right answer in development is to turn the option on there — and to also set `hmrRefreshes: true`, because fetches restored from the Server Components HMR cache are not logged by default and their absence is exactly what makes a slow route look fast while you are working on it.

**Why is `process.env.NEXT_RUNTIME` still relevant in 16.3 when `runtime = 'edge'` is deprecated?**
They are different things. The deprecated item is the per-route `runtime` export — the architectural choice of running a given route on the edge — and the documented migration is to remove that export, since `'nodejs'` is already the default. `NEXT_RUNTIME` is an environment variable describing where the currently-executing code is running, and the instrumentation reference still documents branching on it, because `instrumentation.js` runs in both runtimes and because `NodeSDK` is documented as incompatible with the edge one. Removing the guard because the route export is deprecated is a real way to break a build.

**What is the general principle behind "registration should construct, not communicate"?**
That the readiness path has no timeout you control and no retry you can observe. Inside a request, a slow dependency produces a slow request, which appears in traces, can be retried, and can be given a deadline. On the readiness path it produces an instance that is not serving, which appears as latency with no owner — and if the dependency is down, potentially as an instance that never becomes ready at all. Constructing objects is bounded work with no failure mode worth planning for; talking to the network is neither. So the pattern is to register synchronously and defer anything that needs a network to the first request that needs it, memoised at module scope.

**How would you decide whether a given SDK belongs in `instrumentation-client.ts` at all?**
By asking what it misses if it starts late. Error and crash reporting must be synchronous there because the window it would otherwise miss — hydration — is the failure it exists to catch. Session replay and product analytics can start after hydration with no meaningful loss, so they belong behind a fire-and-forget dynamic import, or in a client component mounted normally. Web Vitals reporting is a third case: it belongs in its own small client component imported by the root layout, which is what the analytics guide recommends so that the client boundary is confined to that component.

**What happens if `register()` throws?**
The reference does not say, and I could not settle it from the documentation. What it does state is that `register` is called once when a new server instance is initiated and must complete before the server is ready to handle requests — so the safe assumption is that a throw there is at best an instance that starts uninstrumented and at worst an instance that does not start. Treat it as unspecified and remove the question: wrap the body in a `try`/`catch` that logs and returns, so a failing telemetry vendor can never be the reason your application will not boot. That is the right shape regardless of which way the framework actually behaves.

**Your host runs four worker processes per container. How many times does `register` run?**
The documented rule is once per *new Next.js server instance*, and the docs do not enumerate what a multi-process host counts as. Practically, a process that constructs its own server instance runs it, so the honest answer in an interview is "once per server instance, and on a multi-worker host that usually means once per worker — which I would verify for the specific host rather than assume." The consequence is what matters and does not depend on the count: registration cost is multiplied by however many instances exist, and anything that must happen exactly once globally — a schema migration, a leader election — does not belong in `register` at all.

---

← [05 · Core Web Vitals](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) · [Chapter 11 overview](01-explanation.md) · Next → [06b · The price of a span](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md)
