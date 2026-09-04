---
title: "proxy.ts runs on Node.js and cannot be configured otherwise, so the Edge-runtime constraint everyone still repeats about middleware is gone — what replaced it is a deployment constraint that makes module-level state work perfectly in development and silently do nothing in production"
sidebar_label: "07 · `proxy.ts`: the deployment boundary"
sidebar_position: 7
description: "Why setting the runtime export throws even for 'nodejs', the documented escape hatch for anyone who still needs edge, the shared-module and globals trap that works in dev and silently does nothing in production, the two channels that do cross the boundary, and where proxy sits in the eight-step request pipeline."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`), [Proxy — getting started](https://nextjs.org/docs/app/getting-started/proxy) (`lastUpdated: 2025-12-20`), the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`) and the [Version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`, via the banked chapter-11 research pass).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**Every piece of folklore about `middleware.ts` starts with "it runs on the Edge runtime, so you can't use Node APIs." On 16 that sentence is simply false, and repeating it will make you design around a constraint that no longer exists. Proxy runs on Node.js. You cannot configure it to run anywhere else — setting the `runtime` export throws, and it throws even when you set it to `'nodejs'`. The constraint that replaced it is harder to see and much easier to ship: proxy is documented as something that may be *deployed separately from your app*, possibly to a CDN, so anything you keep in a module-level variable works flawlessly in `next dev` — where proxy and your render share one process — and silently does nothing in production, where they may not. There is no error. There is no warning. There is a feature that quietly stops working.**

## 🔴 The runtime correction

This is the claim most likely to be wrong in whatever you read before this page.

> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is **not available** in Proxy files. Setting the `runtime` config option in Proxy will **throw an error**."*

Read that carefully: the option is *unavailable*, not *fixed to a value you may restate*. `export const runtime = 'nodejs'` in `proxy.ts` throws, even though `'nodejs'` is what you get anyway.

The version history shows how recent this is:

| Version | Change, verbatim |
|---|---|
| `v16.0.0` | *"Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime"* |
| `v15.5.0` | *"Middleware can now use the Node.js runtime (stable)"* |
| `v15.2.0` | *"Middleware can now use the Node.js runtime (experimental)"* |
| `v13.1.0` | *"Advanced Middleware flags added"* |
| `v13.0.0` | *"Middleware can modify request headers, response headers, and send responses"* |
| `v12.2.0` | *"Middleware is stable"* |
| `v12.0.0` | *"Middleware (Beta) added"* |

So the Node runtime was already stable in **15.5**, and became the only option in **16.0**. Any advice written against 12–15.1 assumed a V8-isolate environment with an API allow-list; none of that applies now.

### If you genuinely still need `edge`

The v16 upgrade guide is the only place this migration path is stated, and it is not what people expect:

> *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. **If you want to continue using the `edge` runtime, keep using `middleware`.** We will follow up on a minor release with further `edge` runtime instructions."*

⚠️ So `middleware.ts` is deprecated *and* is explicitly the supported fallback for edge, with further instructions promised in a minor release. **I could not find any published reason for the Edge runtime's deprecation itself** — the docs instruct removal without giving a rationale, and a previous research pass on `/docs/messages/edge-runtime-deprecated` found none either. Treat "why" as unanswered rather than guessing at cold-start or bundle-size motivations.

## 🔴 The constraint that actually replaced it

Two sentences in the file-convention reference carry the whole risk, and they are printed as a *Good to know* rather than a warning:

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, **you should not attempt relying on shared modules or globals**."*

> *"To pass information from Proxy to your application, use headers, cookies, rewrites, redirects, or the URL."*

Combine that with the rename rationale — *"It can run outside of your application's main runtime"* — and the failure mode writes itself. In `next dev`, proxy and your route handlers execute in one process, so a module-level `Map` is genuinely shared and every test you write passes. In production, proxy may be a separate deployment artifact. The `Map` your route handler reads is a different `Map`, permanently empty.

```ts
// proxy.ts — 🔴 WRONG. Works in `next dev`. Does nothing in production.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { tenantCache } from './lib/tenant-cache' // a module-level Map

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  tenantCache.set(host, resolveTenant(host)) // the render never sees this
  return NextResponse.next()
}
```

```ts
// app/dashboard/page.tsx — reads a cache that is empty in production
import { tenantCache } from '@/lib/tenant-cache'

export default function Page() {
  const tenant = tenantCache.get(currentHost()) // undefined, always
  return <Dashboard tenant={tenant} />
}
```

The fix is the list the docs give: **headers, cookies, rewrites, redirects, or the URL.** Nothing else crosses the boundary.

```ts
// proxy.ts — ✅ RIGHT. The value travels on the request itself.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const tenant = resolveTenant(host)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant', tenant)

  // NOTE: `request:` — this makes the header visible UPSTREAM to your app.
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

```tsx
// app/dashboard/page.tsx — reads it back out of the request
import { headers } from 'next/headers'

export default async function Page() {
  const tenant = (await headers()).get('x-tenant')
  return <Dashboard tenant={tenant} />
}
```

There is a second, subtler version of the same mistake: **lazy initialisation**. A database pool, a feature-flag client or a config loader created at module scope in a file imported by both `proxy.ts` and your app is initialised twice — once per runtime — and neither instance can see the other's state. The dev process papers over it.

## Where proxy sits in the request pipeline

Proxy is **step 3 of eight**, and knowing the order is what tells you why a `next.config` redirect wins over a proxy redirect for the same path.

> *"Proxy will be invoked for **every route in your project**. Given this, it's crucial to use matchers to precisely target or exclude specific routes. The following is the execution order:"*

1. `headers` from `next.config.js`
2. `redirects` from `next.config.js`
3. **Proxy** (`rewrites`, `redirects`, etc.)
4. `beforeFiles` (`rewrites`) from `next.config.js`
5. Filesystem routes (`public/`, `_next/static/`, `pages/`, `app/`, etc.)
6. `afterFiles` (`rewrites`) from `next.config.js`
7. Dynamic Routes (`/blog/[slug]`)
8. `fallback` (`rewrites`) from `next.config.js`

Two consequences fall straight out of that list:

- **A `redirects` entry in `next.config.ts` runs before your proxy and your proxy never sees the request.** If a redirect appears to be ignoring your proxy logic, look at step 2 before you debug step 3.
- **Proxy runs before filesystem routing**, which is why it can rewrite to a path that does not exist as a file, and why it sees requests for `_next/static` unless you exclude them.

The getting-started guide is explicit that config redirects are the preferred tool where they suffice:

> *"For simple redirects, consider using the `redirects` configuration in `next.config.ts` first. Proxy should be used when you need access to request data or more complex logic."*

## Where the rest of proxy is taught

| Question | Page |
|---|---|
| The rename rationale, the codemod, what proxy is *for*, and where it runs at all | [07b · Adopting proxy: the rename, the limits and where it runs](07b-adopting-proxy-the-rename-the-limits-and-where-it-runs.md) |
| The matcher syntax, and why a variable in it is ignored | [07c · The matcher syntax](07c-the-matcher-and-what-it-silently-skips.md) |
| The Server Function trap, `_next/data`, prefetch coverage | [07d · What the matcher skips](07d-what-the-matcher-silently-skips.md) |
| The signature, `NextResponse`, cookies, header plumbing, RSC | [07e · Inside the proxy function](07e-inside-the-proxy-function.md) |
| The URL flags, the request-body buffer, unit testing | [07f · Flags, the body buffer, testing](07f-proxy-flags-the-body-buffer-and-testing.md) |
| A worked multi-tenant proxy with root params | [15 · 10b Tenant routing with proxy and root params](../15-databases-apis-and-full-stack-patterns/10b-tenant-routing-with-proxy-and-root-params.md) |
| Locale detection and prefixed routes in proxy | [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md) |

## Gotchas

**★ Symptom: `export const runtime = 'nodejs'` in `proxy.ts` throws at build.** Cause: the option is not available in proxy files at all — not merely fixed to one value. Verbatim: *"The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."* Fix: delete the export. Node is what you get.

```ts
// proxy.ts
- export const runtime = 'nodejs'   // throws
  export const config = { matcher: '/dashboard/:path*' }
```

**★ Symptom: a value set in proxy is `undefined` everywhere in the app, but only in production.** Cause: you passed it through a module-level global or a shared module, and proxy *"can run outside of your application's main runtime."* Verbatim: *"you should not attempt relying on shared modules or globals."* Fix: put it on the request, with `NextResponse.next({ request: { headers } })`, and read it back with `headers()`.

```ts
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-tenant', tenant)
return NextResponse.next({ request: { headers: requestHeaders } })
```

**★ Symptom: the header you set in proxy shows up in the browser's response, not in your Server Component.** Cause: you used the wrong argument shape. The docs call this out specifically. Verbatim: *"`NextResponse.next({ request: { headers: requestHeaders } })` to make `requestHeaders` available upstream"* and *"**NOT** `NextResponse.next({ headers: requestHeaders })` which makes `requestHeaders` available to clients."* Fix: the nested `request` key is what goes to your app; the flat one leaks to the network.

```ts
// leaks to the browser
return NextResponse.next({ headers: requestHeaders })

// reaches your app
return NextResponse.next({ request: { headers: requestHeaders } })
```

**★ Symptom: a `next.config.ts` redirect fires and your proxy never runs for that path.** Cause: `redirects` is step 2 and proxy is step 3. Fix: either move the rule into proxy, or accept the config redirect — but do not write both for the same path and expect proxy to win.

**Symptom: `fetch(url, { next: { revalidate: 60 } })` inside proxy re-fetches on every request.** Cause: the App Router `fetch` extensions do not apply here. Verbatim: *"Using fetch with `options.cache`, `options.next.revalidate`, or `options.next.tags`, has no effect in Proxy."* Fix: do not fetch in proxy. If you must resolve something remote per request, cache it in a store you control and accept that the module-level variable trap above applies to any in-process cache.

**Symptom: you keep `middleware.ts` because you need `edge`, and a deprecation warning appears.** Cause: `middleware` is deprecated but is still the documented path for edge. Verbatim: *"If you want to continue using the `edge` runtime, keep using `middleware`. We will follow up on a minor release with further `edge` runtime instructions."* Fix: this is a supported state, not a mistake — pin the decision in a comment so the next person does not "fix" it by running the codemod.

**Symptom: a `console.log` of `request.headers` in proxy never shows `rsc` or `next-router-state-tree`.** Cause: Next.js deliberately strips them. Verbatim: *"During RSC requests, Next.js strips internal Flight headers from the `request` instance in Proxy. ... This is to prevent accidentally handling an RSC request differently than the HTML request as both need to align."* Fix: do not branch on Flight headers. If you are hand-rolling a rewrite with `fetch()` rather than `NextResponse.rewrite()`, this is exactly where RSC headers go missing — see [07e](07e-inside-the-proxy-function.md).


## Interview questions

**★ Does middleware run on the Edge runtime?**
Not on Next.js 16. The file is called `proxy.ts` now, it defaults to the Node.js runtime, and the `runtime` route segment config is *"not available in Proxy files"* — setting it throws, and it throws even for `'nodejs'`. The Node runtime went stable for middleware in 15.5 and became the only option in 16.0. If you genuinely need the `edge` runtime, the documented answer is to keep using the deprecated `middleware` filename, because *"the `edge` runtime is NOT supported in `proxy`."* Anyone still designing around a V8-isolate API allow-list is optimising against a constraint that was removed a major version ago.

**★ If the runtime constraint is gone, what constraint replaced it?**
A deployment one, and it is nastier because it produces no error. The docs say proxy *"is meant to be invoked separately of your render code and in optimized cases deployed to your CDN"* and that it *"can run outside of your application's main runtime."* From that follows the rule they state outright: *"you should not attempt relying on shared modules or globals."* In `next dev` proxy and your renders share a process, so a module-level cache, a lazily-created client or a global counter all work. In production they may be separate artifacts, and the shared state simply is not shared. The only supported channels between proxy and your app are headers, cookies, rewrites, redirects and the URL.

**★ You need the tenant ID resolved in proxy to be available in a Server Component. How?**
Set it as a *request* header and read it with `headers()`. The critical detail is the argument shape: `NextResponse.next({ request: { headers } })` makes the header visible upstream to your application, while `NextResponse.next({ headers })` sets a *response* header that goes to the browser instead — which is both useless to your render and a potential information leak. The docs flag this pair explicitly. The alternative channel is a rewrite into a path segment, which is what the multi-tenant chapter does, and it has the advantage of being visible in the route tree rather than in an invisible header.

**★ Where does proxy sit relative to `next.config` redirects and rewrites, and why does it matter?**
It is third of eight. The order is `headers`, then `redirects`, then proxy, then `beforeFiles` rewrites, then filesystem routes, then `afterFiles` rewrites, then dynamic routes, then `fallback` rewrites. It matters in both directions: a `redirects` entry in `next.config.ts` fires before proxy is ever invoked, so a proxy rule for the same path is dead code; and because proxy runs *before* filesystem routing, it sees requests for `_next/static` and `public/` assets unless the matcher excludes them, which is how a naive auth redirect ends up blocking your own CSS.

---

← [06d · Block, and opting out honestly](06d-block-and-opting-out-honestly.md) · [Chapter 2 overview](01-explanation.md) · Next → [07b · Adopting proxy: the rename, the limits and where it runs](07b-adopting-proxy-the-rename-the-limits-and-where-it-runs.md)
