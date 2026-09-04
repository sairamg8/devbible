---
title: "The Edge-shaped constraint outlived the Edge runtime: Proxy now defaults to Node.js yet still forbids the `runtime` option outright, and the thing you must design around is where it is deployed, not what APIs it has"
sidebar_label: "04b · What survives the withdrawal"
sidebar_position: 19
description: "Proxy's runtime rules and why setting the option throws, the CDN-deployment constraint that replaces the old API-surface constraint, process.env.NEXT_RUNTIME in instrumentation, preferredRegion's successor-less deprecation, and the ordered audit."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js documentation — [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`version: 16.3.4`, `lastUpdated: 2026-08-25`, fetched for this page), the [`runtime` segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime) and [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) (`lastUpdated: 2026-04-30`). `NEXT_RUNTIME` and `register()` quotes reused from the corpus's chapter 16 verification of [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (`lastUpdated: 2026-06-09`) — not re-fetched here.
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run**, **no timings**.

**[04](04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md) closed the per-route runtime choice. This page is about the three places where something Edge-shaped still governs how you write code, and the surprise is that none of them is an API allow-list. Proxy is the sharpest case: as of v16.0 it *defaults to the Node.js runtime*, so the old "you cannot use Node APIs in middleware" rule is gone — and yet the `runtime` option is more restricted there than anywhere else, because setting it does not warn, it throws. What actually constrains Proxy now is a deployment property the documentation states plainly: it may be running somewhere your application is not. Then there is `process.env.NEXT_RUNTIME`, still branching in the documentation's own instrumentation examples, and `preferredRegion`, deprecated alongside `runtime = 'edge'` with no framework-level successor at all.**

## Proxy: the option is not deprecated there, it is unavailable

The `runtime` reference ends with a sentence that has no elaboration on its own page:

> *"This option cannot be used in Proxy."*

The Proxy reference has a whole section, and it is unambiguous about the severity:

> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*

🔴 **Three separate facts sit in those three sentences, and conflating them is the mistake.**

1. **Proxy runs on Node.js by default.** Not on a constrained runtime. This is a change, and it is dated in the version history.
2. **The option does not exist in `proxy.ts`.** Not "is deprecated" — is not available.
3. **Setting it throws.** Everywhere else in the App Router, `runtime = 'edge'` produces a warning and keeps building. In `proxy.ts` you get an error. This is the one file where a repo-wide search-and-replace can turn a silent deprecation into a hard failure.

The version history dates the change and shows how recent the whole arrangement is:

| Version | Change, verbatim |
|---|---|
| `v16.0.0` | *"Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime"* |
| `v15.5.0` | *"Middleware can now use the Node.js runtime (stable)"* |
| `v15.2.0` | *"Middleware can now use the Node.js runtime (experimental)"* |

**Read that table bottom-up and the shape of the last year is obvious**: Node.js in middleware went experimental → stable → default, and in the same release the Edge value was deprecated for routes. If your mental model is "middleware is Edge-only", it is accurate for 15.1 and wrong for everything since.

```ts
// proxy.ts — ❌ this throws. It is not a warning and not a no-op.
export const runtime = 'nodejs'

export function proxy(request: NextRequest) {
  return NextResponse.next()
}
```

```ts
// proxy.ts — ✅ correct. There is nothing to declare; Node.js is the default.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: '/dashboard/:path*',
}
```

Note that the wrong version above declares `'nodejs'` — the *non*-deprecated value — and still throws. The rule is about the option, not the value.

## The constraint that replaced the API constraint

If Proxy is Node.js now, what is left to design around? The documentation answers this directly, and it is a **deployment** property, not a language one:

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals."*

And, from the section explaining the rename:

> *"The term "proxy" implies a network boundary in front of the app, which is how this feature behaves. It can run outside of your application's main runtime and handle requests before they reach your app."*

**That is a stronger constraint than an API allow-list, and a much easier one to violate accidentally.** An unavailable API fails loudly at build or on first request. A shared module works perfectly in `next dev` — one process, one module registry — and then silently does nothing in production, because the proxy invocation and the render invocation are not the same runtime instance.

```ts
// lib/rate-limit.ts — ❌ a module-level Map is a shared global.
// In dev it is one object. In production, Proxy may not be co-resident
// with your rendering code at all, so this counts nothing useful.
const hits = new Map<string, number>()

export function bump(ip: string) {
  const n = (hits.get(ip) ?? 0) + 1
  hits.set(ip, n)
  return n
}
```

```ts
// proxy.ts — ✅ the documented channels. State goes over the network
// or onto the request; nothing is assumed to be shared in-process.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const allowed = await checkQuotaInSharedStore(ip) // network call, not a Map

  if (!allowed) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  // Pass information forward the documented way: headers, cookies, the URL.
  const headers = new Headers(request.headers)
  headers.set('x-client-ip', ip)
  return NextResponse.next({ request: { headers } })
}
```

The documentation names the permitted channels explicitly:

> *"To pass information from Proxy to your application, use headers, cookies, rewrites, redirects, or the URL."*

**Where Proxy can run at all is also documented**, and it is worth knowing before you build a redirect strategy on it:

| Deployment option | Supported |
|---|---|
| Node.js server | Yes |
| Docker container | Yes |
| Static export | No |
| Adapters | Platform-specific |

## `process.env.NEXT_RUNTIME` — still in the docs, and still worth keeping

The instrumentation guidance branches on a runtime environment variable, and that guidance has not been withdrawn:

> *"Unlike `@vercel/otel`, `NodeSDK` is not compatible with edge runtime, so you need to make sure that you are importing them only when `process.env.NEXT_RUNTIME === 'nodejs'`."*
> *"We recommend importing the file from within the `register` function, rather than at the top of the file."*

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

**Keep this pattern, and understand what it is doing now.** Two honest observations, and one thing the documentation does not settle:

- The `register()` contract is what makes the dynamic import matter at all: *"The file exports a `register` function that is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests."* A top-level `import` of a Node-only SDK is evaluated when the module is loaded, before your guard can run — which is precisely why the documentation says to import inside `register`.
- The branch is a **guard**, not a fork. With `'edge'` deprecated for routes and Proxy defaulting to Node.js, the `'nodejs'` side is what you should expect to execute. It is still correct to write it, because you do not control every environment your instrumentation file is loaded in and the pattern costs nothing.
- 🔴 **What I could not confirm:** the documentation does not enumerate the full set of values `NEXT_RUNTIME` can take on 16.3.4, nor state what it is set to during a build. Do not write an `else` branch that assumes it is `'edge'` whenever it is not `'nodejs'`; write the positive check and let everything else fall through.

The full treatment of `register()`, `onRequestError` and OpenTelemetry belongs to [chapter 16 · 04](../16-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md); what instrumentation *costs* is [06 · `instrumentation.ts`](06-instrumentationts-for-opentelemetry-and-application-monitori.md) in this chapter.

## `preferredRegion`: deprecated, with nothing behind it

The second deprecated row in the options table is the one that hurts, because it was the answer to a question people still have.

> *"If deploying Next.js on Vercel, regions were previously only supported with `export const runtime = 'edge'`, which is now deprecated."*

**The two deprecations are one deprecation.** Region pinning was tied to the Edge value; the Edge value went, and the region export went with it. The documentation names **no framework-level successor** — region placement is now entirely a platform concern, configured wherever you deploy. Do not go looking for a new export, and do not invent one in a design document.

That leaves the interesting half of the problem untouched: *should* you place compute in multiple regions at all? Usually not, and the arithmetic for why is [chapter 16 · 03](../16-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md).

## The audit, in the order that avoids self-inflicted failures

1. **`proxy.ts` first, by hand.** Any `runtime` export there throws. Delete it before you run anything repo-wide.
2. **Then the sweep for `'edge'` and `'experimental-edge'`** across `app/` and `src/`, excluding `proxy.ts`. Delete the lines; do not rewrite them to `'nodejs'`.
3. **Then `preferredRegion`.** Same treatment, and note the placement decision has moved to the platform.
4. **Then `instrumentation.ts`.** Confirm Node-only SDKs are imported *inside* `register()` behind the `NEXT_RUNTIME` check, not at module top level.
5. **Then Cache Components**, if you are adopting it — it *"requires the Node.js runtime"*, and step 2 is its precondition.

```bash
# Steps 2 and 3, with proxy.ts excluded so a hard error cannot be introduced.
grep -rn --include=*.ts --include=*.tsx \
  -e "runtime *= *['\"]\(edge\|experimental-edge\)['\"]" \
  -e "preferredRegion" \
  app/ src/ | grep -v "proxy\."
```

## Gotchas

**★ Symptom: after a repo-wide "fix the deprecation" commit, the app fails to start with an error from `proxy.ts`.** Cause: the sweep rewrote `runtime = 'edge'` to `runtime = 'nodejs'` in every file including `proxy.ts`, and *"Setting the `runtime` config option in Proxy will throw an error"* — the restriction is on the option, so the non-deprecated value throws too. Fix: remove the export from `proxy.ts` entirely and exclude that file from future sweeps:

```ts
// proxy.ts — delete both of these lines, not just the 'edge' one
// export const runtime = 'edge'
// export const runtime = 'nodejs'
```

**★ Symptom: an in-memory rate limiter or feature-flag cache in Proxy works in development and does nothing in production.** Cause: *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN … you should not attempt relying on shared modules or globals."* Dev is one process, so the module-level `Map` is shared; production may not be. Fix: move the state to a shared store and pass the result forward through a documented channel — a header, a cookie, a rewrite or the URL — as in the `proxy.ts` example above.

**★ Symptom: a colleague insists middleware cannot use Node APIs, and blocks a PR on it.** Cause: that was true before 15.2 and is stale. The version history is explicit: Node.js runtime became experimental in `v15.2.0`, stable in `v15.5.0`, and *"Proxy defaults to the Node.js runtime"* in `v16.0.0`. Fix: cite the version history table; the remaining constraint is deployment shape, not API surface.

**Symptom: `instrumentation.ts` crashes the server on boot after adding an OpenTelemetry SDK.** Cause: the SDK was imported at the top of the file, so it is evaluated when the module loads — before the `NEXT_RUNTIME` guard inside `register()` can run — and `register()` *"must complete before the server is ready to handle requests"*, so a failure there fails startup rather than one request. Fix: dynamic-import inside the guard:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node') // evaluated only on this branch
  }
}
```

**Symptom: you removed `preferredRegion` and now cannot find where to set the region.** Cause: there is no replacement export; the documentation names none. Fix: configure regions on the deployment platform, and re-check whether you want multiple regions at all before you do — see [chapter 16 · 03](../16-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md).

**Symptom: Proxy is not running for a route you thought it covered, so an auth check silently disappears.** Cause: `matcher` scoping, and specifically Server Functions — *"Server Functions are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."* Fix: the documentation's own instruction — *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."* Chapter 10 owns this: [04 · Proxy as a coarse filter](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md).

**Symptom: a static export build has no proxy behaviour at all and no error explains it.** Cause: the platform support table lists Static export as **No** for Proxy. Fix: if the redirects are structural, move them to `redirects` in `next.config.js`, which runs earlier in the documented execution order and does not depend on Proxy existing.

## Interview questions

**★ Middleware used to be Edge-only. What is true in Next.js 16, and what constraint replaced the old one?**
Middleware was renamed to Proxy in 16.0, and in the same release it started defaulting to the Node.js runtime — the version history dates the Node.js runtime as experimental in 15.2 and stable in 15.5. So the old "no Node APIs here" constraint is gone. What replaced it is a deployment constraint the documentation states directly: Proxy is invoked separately from your render code and in optimised cases is deployed to the CDN, so you should not rely on shared modules or globals. That is a subtler rule, because violating it is invisible in development, where everything is one process.

**★ Why does setting `runtime` in `proxy.ts` throw, when the same line in a route file only warns?**
Because they are different restrictions. In a route file, `runtime` is a supported segment config and only the `'edge'` value is deprecated — a deprecated value produces a warning and the build continues. In `proxy.ts` the option is *not available at all*: the documentation says the config option is not available in Proxy files and that setting it will throw an error. That means even `runtime = 'nodejs'`, which is the current non-deprecated value, throws there. It is the one file where the tidy-up commit can convert a warning into an outage, which is why it should be handled by hand before any repo-wide sweep.

**Should you still write `if (process.env.NEXT_RUNTIME === 'nodejs')` in `instrumentation.ts` now that the Edge runtime is deprecated?**
Yes, and for two reasons that are not about Edge. First, the documentation still shows that guard and still says Node-only SDKs must be imported only under it. Second, the guard's real job is to keep a Node-only module from being evaluated at module load — `register()` runs once per server instance and must complete before the server accepts requests, so a top-level import that fails takes down startup rather than one request. The pattern to write is a positive check with a dynamic `import()` inside it. What you should *not* write is an `else` branch that assumes anything about the other case; the docs do not enumerate the possible values of `NEXT_RUNTIME`.

**★ A team wants to run their auth check in Proxy because "it's at the edge and it's fast". What do you tell them?**
Two things. First, the premise about placement is out of date: Proxy defaults to the Node.js runtime, and the framework no longer offers a per-route or per-region placement API at all — `preferredRegion` is deprecated with no successor. Second, and more importantly, Proxy is the wrong place for the authoritative check regardless of speed. The documentation warns that Server Functions are handled as POSTs to the route they are used on, so a matcher that excludes a path also skips the Server Functions on it, and it tells you to verify authentication and authorization inside each Server Function rather than relying on Proxy alone. Proxy is a coarse filter and a redirect layer; the real gate goes next to the data.

**What is the relationship between the `runtime = 'edge'` deprecation and the `preferredRegion` deprecation?**
They are the same withdrawal seen from two sides. Region selection on Vercel was previously only supported with `export const runtime = 'edge'` — the documentation says so directly — so when the Edge value went, the mechanism that made region pinning meaningful went with it, and `preferredRegion` is marked deprecated in the same options table. The important consequence for design work is that the framework now names no successor: placement is configured on the platform. Anyone who claims there is a new export for it should be asked to cite it.

---

← [04 · The withdrawn runtime choice](04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md) · [Chapter index](01-explanation.md) · Next → [05 · Core Web Vitals](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md)
