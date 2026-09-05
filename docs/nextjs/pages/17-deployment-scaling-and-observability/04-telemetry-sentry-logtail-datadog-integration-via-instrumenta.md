---
title: "instrumentation.ts is not a Sentry file — it is the one place Next.js promises to run your code before the server accepts a request, and onRequestError is the only hook that sees a server error after React has already finished mangling it"
sidebar_label: "04 · Telemetry and instrumentation.ts"
sidebar_position: 7
description: "register() and its once-per-instance contract, runtime targeting with NEXT_RUNTIME, onRequestError's context object and the digest trap, instrumentation-client's pre-hydration window, and why the logging block in next.config never helps in production."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (`version: 16.3.4`, `lastUpdated: 2026-06-09`), [How to set up instrumentation](https://nextjs.org/docs/app/guides/instrumentation) (`2026-08-25`), [`instrumentation-client.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client) (`2026-07-28`) and [`logging`](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging) (`2026-02-12`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run**, no traces or timings reproduced. OpenTelemetry setup and the span catalogue are [04b](04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

**Two file conventions and one hook do all the work, and each has a contract that decides whether your observability is trustworthy. `register()` runs **once** per server instance and must finish before the server accepts a request — which makes it the only correct place to install an SDK, and a place where a slow network call delays every cold start. `onRequestError` is the server-error hook, and its most important documented caveat is that the error you receive may not be the error that was thrown, because React may have processed it during Server Components rendering; the `digest` property is how you get back to the real one. And `instrumentation-client.ts` runs after the document loads and before hydration, synchronously — anything asynchronous you start there is fire-and-forget. Meanwhile the `logging` block in `next.config.js` that looks like the production logging control is development-only, top to bottom.**

## `register()` — the contract

> *"The `instrumentation.js|ts` file is used to integrate observability tools into your application, allowing you to track the performance and behavior, and to debug issues in production."*

> *"To use it, place the file in the **root** of your application or inside a `src` folder if using one."*

> *"The file exports a `register` function that is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests. `register` can be an async function."*

Three consequences, in order of how often they bite.

**It blocks readiness.** An `await` on a slow network call in `register` is added to every cold start, and on serverless that is every scale-out event. Register SDKs; do not fetch configuration.

**It runs in every environment.** *"Next.js calls `register` in all environments, so it's important to conditionally import any code that doesn't support specific runtimes."*

**Where the file lives is load-bearing.** *"The `instrumentation` file should be in the root of your project and not inside the `app` or `pages` directory."* And a trap that produces total silence with no error: *"If you use the `pageExtensions` config option to add a suffix, you will also need to update the `instrumentation` filename to match."*

The documented import discipline is deliberate and worth adopting:

> *"We recommend importing the file from within the `register` function, rather than at the top of the file. By doing this, you can colocate all of your side effects in one place in your code, and avoid any unintended consequences from importing globally at the top of the file."*

The OpenTelemetry side of `register` — `@vercel/otel`, the manual `NodeSDK` path and what Next.js already emits — is [04b](04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./instrumentation-edge')
  }
}
```

## `onRequestError` — the error hook, and its two traps

> *"You can optionally export an `onRequestError` function to track **server** errors to any custom observability provider."*

The full documented signature:

```ts
export function onRequestError(
  error: unknown,
  request: {
    path: string
    method: string
    headers: { [key: string]: string | string[] }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'proxy'
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined
    renderType: 'dynamic' | 'dynamic-resume'
  }
): void | Promise<void>
```

🔴 **Trap one: the error is not necessarily the error.**

> *"The `error` instance might not be the original error instance thrown, as it may be processed by React if encountered during Server Components rendering. If this happens, you can use `digest` property on an error to identify the actual error type."*

🔴 **Trap two: unawaited async work is dropped.**

> *"If you're running any async tasks in `onRequestError`, make sure they're awaited. `onRequestError` will be triggered when the Next.js server captures the error."*

And the type is `unknown` for a reason — *"The caught value is typed as `unknown`. Narrow it before reading properties like `message` or `digest`."*

```ts
// instrumentation.ts
import { type Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const message = err instanceof Error ? err.message : String(err)
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err
      ? String(err.digest)
      : undefined

  // Awaited: an un-awaited promise here is discarded when the request ends.
  await fetch(process.env.ERROR_SINK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      digest,
      stack: err instanceof Error ? err.stack : undefined,
      path: request.path,
      method: request.method,
      // Never forward the whole header bag — it contains cookies.
      userAgent: request.headers['user-agent'],
      router: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      renderType: context.renderType,
      revalidateReason: context.revalidateReason,
    }),
  })
}
```

The `context` fields are what turn a stream of errors into a triage queue, and two of them are easy to misread. `revalidateReason` is `undefined` for *"a normal request without revalidation"* — so `'stale'` or `'on-demand'` means the failure happened during background regeneration, where no user was waiting and no user saw it. And `renderType` is `'dynamic-resume'` *"for PPR"*, which distinguishes a failure inside a resumed dynamic hole from one in the initial render.

`onRequestError` was introduced in `v15.0.0`, the same release in which `instrumentation` became stable.

## Client-side: `instrumentation-client.ts`

> *"The `instrumentation-client.js|ts` file allows you to add monitoring, analytics code, and other side-effects that run before your application becomes interactive."*

> *"Unlike server-side instrumentation, you do not need to export any specific functions."*

Its timing is the whole value proposition — *"**After** the HTML document is loaded"*, *"**Before** React hydration begins"*, *"**Before** user interactions are possible"* — and its sharpest caveat follows immediately:

> *"Only synchronous, top-level code is guaranteed to complete before hydration. Asynchronous work started here (a `Promise`, `import()`, or top-level `await`) is not awaited and may resolve after hydration has begun, so treat it as fire-and-forget."*

There is a budget, too: *"Next.js monitors initialization time in development and will log warnings if it takes longer than 16ms"*.

```ts
// instrumentation-client.ts
import { Monitor } from './lib/monitor'

Monitor.initialize({ dsn: process.env.NEXT_PUBLIC_MONITOR_DSN })

export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse'
) {
  Monitor.pushEvent({ message: `Navigation to ${url}`, category: navigationType })
}
```

> *"Hook errors are isolated and do not affect navigation or other hooks."*

⚠️ If you also use a `next.config.js` wrapper such as `withSentry`, it may register its own client module via `instrumentationClientInject`; the docs state those *"run before this file, in array order"*. Two initialisations of the same SDK is the usual result of not knowing that.

## 🔴 `logging` in `next.config.js` is a development feature

This block looks like production logging configuration and is not:

```js
// next.config.js
module.exports = {
  logging: {
    fetches: { fullUrl: true, hmrRefreshes: true },
    incomingRequests: { ignore: [/^\/api\/health$/] },
    serverFunctions: true,
    browserToTerminal: 'warn',
  },
}
```

The reference's own description scopes it: *"Configure logging behavior in the terminal when running Next.js in **development mode**"*. Each option repeats the scope — *"whether the full URL is logged to the console when running Next.js in development mode"*, *"Server Function invocations are logged by default during development"*, *"By default all the incoming requests will be logged in the console during development … Since this is only logged in development, this option doesn't affect production builds"*, *"forward browser console logs … to the terminal during development"*.

So it is a superb debugging tool and never an observability strategy. Production request logging comes from your platform's log drain or from spans; production error reporting comes from `onRequestError`.

`browserToTerminal` moved out of `experimental` in **v16.2.0**; `incomingRequests` arrived in v15.2.0 and `logging: false` in v15.0.0.

## Gotchas

**★ Symptom: `instrumentation.ts` never runs and there is no error.** Cause: the file is in the wrong place, or `pageExtensions` added a suffix the filename does not match — the docs require it at the project root (or in `src`), *not* inside `app/` or `pages/`, and require the filename to follow `pageExtensions`. Fix: move it to the root and, if you set `pageExtensions: ['page.tsx']`, rename accordingly:

```text
src/instrumentation.page.ts     ← when pageExtensions adds a suffix
```

**★ Symptom: cold starts got noticeably slower after adding telemetry.** Cause: `register` *"must complete before the server is ready to handle requests"*, and something in it is doing network I/O. Fix: register exporters and let them flush in the background; never `await` a config fetch there:

```ts
export function register() {
  registerOTel({ serviceName: 'sprintdesk' })   // synchronous registration
}
```

**★ Symptom: errors reach `onRequestError` with a generic message and a useless stack.** Cause: React processed the error during Server Components rendering, so *"the `error` instance might not be the original error instance thrown"*. Fix: read `digest` and correlate — it is the documented way to identify the actual error type, and it is also what the client-side error boundary shows the user, so it is the join key between a support ticket and a log line.

**★ Symptom: some errors never arrive at your provider, intermittently.** Cause: async work in `onRequestError` was not awaited, so the request completed and the pending send was discarded. Fix: `await` it — and on a hot path, batch through a queue rather than one fetch per error, but still await the enqueue.

**★ Symptom: your error dashboard is dominated by failures nobody experienced.** Cause: `revalidateReason` is being ignored. A value of `'stale'` or `'on-demand'` means the error happened during background regeneration, not while a user waited; `undefined` is *"a normal request without revalidation"*. Fix: split the queue on that field. Revalidation failures are real and need fixing, but they are a different alert with a different urgency.

**★ Symptom: `logging.fetches.fullUrl` changed nothing in production.** Cause: the whole `logging` block is development-only; the reference says so in its description and again per option. Fix: use spans or a platform log drain for production. If you needed the URLs to debug a caching problem, reproduce it in development where the option applies.

**★ Symptom: the monitoring SDK initialises twice on the client.** Cause: a `next.config.js` plugin injected its own client instrumentation module via `instrumentationClientInject`, and those *"run before this file, in array order"*, while your `instrumentation-client.ts` initialises it again. Fix: pick one — either the plugin's wrapper or your own file — and delete the other.

**Symptom: a polyfill installed in `instrumentation-client.ts` is sometimes too late.** Cause: it was loaded with a dynamic `import()`, and asynchronous work there is fire-and-forget — *"may resolve after hydration has begun"*. Fix: import it statically and apply it synchronously after feature detection, accepting that the import then ships to every visitor.

**Symptom: the header bag in your error sink contains session cookies.** Cause: `request.headers` was forwarded wholesale to a third party. Fix: allow-list the fields you need, as in the `onRequestError` example above. This is a data-protection incident, not a logging preference.

## Interview questions

**★ What exactly does `register()` guarantee, and what does that guarantee cost?**
It is called once when a new server instance is initiated and must complete before the server is ready to handle requests. That is what makes it correct for installing an SDK: no request can be served by an uninstrumented process. The cost is that it sits on the critical path of every cold start, and on serverless every scale-out event is a cold start. So it should register and return — anything that waits on the network there is latency you pay per instance, permanently.

**★ Why does the documentation recommend importing side-effecting modules *inside* `register` rather than at the top of the file?**
Because a top-level import runs when the module is evaluated, in every runtime, regardless of what `register` decides — which defeats the `NEXT_RUNTIME` guard that is the whole reason for the pattern. The docs frame it as colocating side effects in one place and avoiding unintended consequences from importing globally; the sharp version is that a top-level `import` of `@opentelemetry/sdk-node` will break the edge build even if `register` would never have called it.

**★ `onRequestError` receives an error that "might not be the original error instance thrown". What do you do about it?**
Read `digest`. The documentation names it as the way to identify the actual error type when React has processed the error during Server Components rendering. Practically, the digest is also what the user-facing error boundary displays, so it is the correlation key between a screenshot in a support ticket and the log entry that has the real stack. Any error pipeline that discards `digest` in favour of `message` has thrown away the only stable identifier.

**★ Two entries in `onRequestError`'s `context` change how urgently you should treat an error. Which, and why?**
`revalidateReason` and `routeType`. A `revalidateReason` of `'stale'` or `'on-demand'` means the error occurred during background regeneration — nobody was waiting on it, and the stale content was still served — whereas `undefined` means a normal request, so a user saw the failure. `routeType` separates `'render'`, `'route'`, `'action'` and `'proxy'`: an `'action'` failure is a mutation the user attempted and believes may have half-happened, which is a different class of incident from a render failure on a page they can reload.

**★ Someone adds `logging: { fetches: { fullUrl: true } }` to diagnose a production caching problem. What do you tell them?**
That it will do nothing. The `logging` reference describes itself as configuring terminal logging in development mode, and repeats the scope on every option — incoming request logging explicitly "doesn't affect production builds". In production, use the `fetch [http.method] [http.url]` span, which carries `http.url` and `net.peer.name` as OpenTelemetry attributes, or the `x-nextjs-cache` response header for cache state. The config option is for the terminal you are looking at while you work.

**★ What does `instrumentation-client.ts` buy you that a `useEffect` in the root layout does not?**
Ordering. It executes after the document loads but *before* React hydration begins and before any user interaction is possible, so error tracking installed there catches failures during hydration itself — precisely the window a `useEffect` cannot cover, because the effect only runs once hydration succeeds. The trade is a strict one: only synchronous top-level code is guaranteed to finish in time, anything asynchronous is fire-and-forget, and there is a 16 ms initialisation budget that development warns about.


---

← [Multi-region and data locality](03-multi-region-strategies-and-data-locality-patterns.md) · [Chapter 17 overview](01-explanation.md) · Next → [OpenTelemetry and the span catalogue](04b-opentelemetry-the-span-catalogue-and-trace-volume.md)
