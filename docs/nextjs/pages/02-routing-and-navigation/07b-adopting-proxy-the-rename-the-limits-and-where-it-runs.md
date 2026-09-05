---
title: "The middleware-to-proxy rename is a deprecation of the pattern and not just the filename — the documentation says in three separate places that you should avoid relying on this feature, and the codemod that renames your file will not touch the next.config key that renamed with it"
sidebar_label: "07b · Adopting proxy: rename, limits, platforms"
sidebar_position: 39
description: "Why middleware became proxy and what the docs are steering you away from, the codemod and the config key it does not rename, the one-file rule, the three documented use cases and the three anti-use-cases, the fetch options that silently do nothing, and the platform support table where static export is a flat No."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`), [Proxy — getting started](https://nextjs.org/docs/app/getting-started/proxy) (`lastUpdated: 2025-12-20`), the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`), the [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`) and the [Version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`, via the banked chapter-11 research pass).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**Most rename migrations are a `mv` plus a search-and-replace, and Next.js even ships a codemod for this one. The reason this page exists is that the rename is carrying an argument: the documentation says three separate times, in three separate places, that you should not put logic here if you can put it anywhere else. Read alongside the use-case list — headers, A/B rewrites, programmatic redirects, and nothing else — the picture is a feature the maintainers consider overused, given a new name that describes a network boundary rather than an application layer. This page is what adopting it actually involves: the mechanics the codemod covers, the config key it does not, the boundary of what the feature is for, and the deployment targets where it does not exist at all.**

## The rename, and the rationale the docs actually publish

`middleware.ts` became `proxy.ts` in **16.0**, and the file convention page opens with the deprecation note:

> *"The `middleware` file convention is deprecated and has been renamed to `proxy`."*

The v16 upgrade guide gives the one-line reason:

> *"The `middleware` filename is deprecated, and has been renamed to `proxy` to clarify network boundary and routing focus."*

The reference expands it into something more pointed, and it is worth reading in full because it is the docs telling you not to use the feature:

> *"The reason behind the renaming of `middleware` is that the term “middleware” can often be confused with Express.js middleware, leading to a misinterpretation of its purpose. Also, Middleware is highly capable, so it may encourage the usage; however, **this feature is recommended to be used as a last resort**."*

> *"Next.js is moving forward to provide better APIs with better ergonomics so that developers can achieve their goals without Middleware."*

> *"**We recommend users avoid relying on Middleware unless no other options exist.** Our goal is to give them APIs with better ergonomics so they can achieve their goals without Middleware."*

> *"The term “middleware” often confuses users with Express.js middleware, which can encourage misuse. To clarify our direction, we are renaming the file convention to “proxy.” This highlights that we are moving away from Middleware, breaking down its overloaded features, and making the Proxy clear in its purpose."*

🔴 **A rename is usually cosmetic; this one is a deprecation of the *pattern*, not just the filename.** The framework is not steering you towards `proxy.ts`, it is steering you away from putting logic in it at all. That is the frame to hold in a design review: every piece of work you push into proxy is work the maintainers expect you to move out again.

And the name itself is an assertion about topology:

> *"The name Proxy clarifies what Middleware is capable of. The term “proxy” implies a network boundary in front of the app, which is how this feature behaves. **It can run outside of your application's main runtime and handle requests before they reach your app.** These characteristics align better with the term “proxy” and provide a clearer purpose for the feature."*

That sentence is the source of the whole deployment constraint argued in [07](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md) — the name is not decoration, it is a warning about where the code runs.

The glossary keeps `Middleware` as an entry that redirects:

> **Middleware** — *"See Proxy."*
> **Proxy** — *"A file (`proxy.js`) that runs code on the server before request is completed. Used to implement server-side logic like logging, redirects, and rewrites. Formerly known as Middleware."*

## Migrating: the codemod, the export name, and the config keys

```bash
npx @next/codemod@canary middleware-to-proxy .
```

> *"Next.js provides a codemod to migrate from `middleware.ts` to `proxy.ts`."*
> *"The codemod will rename the file and the function name from `middleware` to `proxy`."*

```diff
// middleware.ts -> proxy.ts

- export function middleware() {
+ export function proxy() {
```

The named export must be `proxy`, or you can use a default export:

> *"The file must export a single function, either as a default export or named `proxy`. Note that multiple proxy from the same file are not supported."*

```ts
// proxy.ts — either of these is valid; both together is not
export function proxy(request: NextRequest) {}
// or
export default function proxy(request: NextRequest) {}
```

Two `next.config` keys govern the advanced behaviour, and one of them was renamed alongside the file — which a codemod running over your source tree will not touch:

| Before 16 | On 16 |
|---|---|
| `skipMiddlewareUrlNormalize` | **`skipProxyUrlNormalize`** |
| `skipTrailingSlashRedirect` | unchanged |

> *"In `v13.1` of Next.js two additional flags were introduced for proxy, `skipProxyUrlNormalize` (formerly `skipMiddlewareUrlNormalize`) and `skipTrailingSlashRedirect` to handle advanced use cases."*

The file goes at the project root, beside `app` or `pages` — not inside `app`:

> *"Create a `proxy.ts` (or `.js`) file in the project root, or inside `src` if applicable, so that it is located at the same level as `pages` or `app`."*

> *"If you've customized `pageExtensions`, for example to `.page.ts` or `.page.js`, name your file `proxy.page.ts` or `proxy.page.js` accordingly."*

That last rule catches teams with a `.page.tsx` convention: a plain `proxy.ts` in such a project is an ordinary module that is never invoked, and nothing tells you so.

## One file per project, and why

> *"While only one `proxy.ts` file is supported per project, you can still organize your proxy logic into modules. Break out proxy functionalities into separate `.ts` or `.js` files and import them into your main `proxy.ts` file. This allows for cleaner management of route-specific proxy, aggregated in the `proxy.ts` for centralized control. **By enforcing a single proxy file, it simplifies configuration, prevents potential conflicts, and optimizes performance by avoiding multiple proxy layers.**"*

The supported shape is therefore composition, with one matcher and one dispatch:

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { applyTenant } from './proxy/tenant'
import { applyAbTest } from './proxy/ab-test'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/app')) return applyTenant(request)
  if (pathname.startsWith('/marketing')) return applyAbTest(request)

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

## What proxy is for, and what it is not for

The documented use cases are short:

> *"Modifying headers for all pages or a subset of pages"*
> *"Rewriting to different pages based on A/B tests or experiments"*
> *"Programmatic redirects based on incoming request properties"*

And the anti-use-cases are stated just as plainly:

> *"For simple redirects, consider using the `redirects` configuration in `next.config.ts` first. Proxy should be used when you need access to request data or more complex logic."*

> *"Proxy is **not** intended for slow data fetching. While Proxy can be helpful for optimistic checks such as permission-based redirects, **it should not be used as a full session management or authorization solution**."*

> *"Using fetch with `options.cache`, `options.next.revalidate`, or `options.next.tags`, **has no effect in Proxy**."*

That last one is a genuine trap: the `fetch()` extensions you rely on everywhere else in the App Router are inert here. A `fetch` in proxy is a plain uncached network call on every matched request, and proxy runs on every matched request including prefetches.

The authentication guide draws the boundary precisely, and it is the sentence to quote in a security review:

> *"since Proxy runs on every route, including prefetched routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."*

> *"While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source."*

The two legitimate reasons the guide gives for reaching for proxy at all:

> *"To perform optimistic checks. Since Proxy runs on every route, it's a good way to centralize redirect logic and pre-filter unauthorized users."*
> *"To protect static routes that share data between users (e.g. content behind a paywall)."*

```ts
// proxy.ts — the documented shape: decrypt a cookie, redirect, nothing else
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/app/lib/session'

const protectedRoutes = ['/dashboard']
const publicRoutes = ['/login', '/signup', '/']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  // `includes` is exact string equality: it would leave /dashboard/billing UNPROTECTED.
  // Match the prefix, and anchor the segment so /dashboard-public is not caught by /dashboard.
  const isProtectedRoute = protectedRoutes.some(
    (r) => path === r || path.startsWith(`${r}/`),
  )
  const isPublicRoute = publicRoutes.includes(path)

  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublicRoute && session?.userId && !path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

⚠️ **The documented snippet uses `protectedRoutes.includes(path)`, and that is exact string
equality.** With `protectedRoutes = ['/dashboard']` it matches `/dashboard` and **not**
`/dashboard/billing`, so every nested route under a protected prefix is silently unprotected by
this filter. The version above matches the prefix instead, anchored on a `/` so `/dashboard-public`
is not swept in by `/dashboard`. This is exactly why the page's thesis holds: **the proxy is a
coarse filter and never the authorization boundary** — a bug of this shape in the filter is a UX
regression when the real check sits at the data layer, and a breach when it does not.

## Where proxy runs at all

| Deployment option | Supported |
|---|---|
| Node.js server | Yes |
| Docker container | Yes |
| **Static export** | **No** |
| Adapters | Platform-specific |

🔴 **Static export has no proxy.** If your deployment target is `output: 'export'`, everything on this page and the two around it is unavailable, and any auth pre-filter, tenant resolution or A/B rewrite has to move to the client or to whatever is actually serving the files. The build will not warn you; there is simply no server in the request path to invoke the function.

"Adapters — platform-specific" is the row that needs a real answer from your host rather than from these docs. **I could not confirm from the Next.js documentation what any individual adapter does with proxy**; the table says platform-specific and leaves it there.

## Gotchas

**★ Symptom: the codemod ran clean but the build fails on an unknown `next.config` key.** Cause: `middleware-to-proxy` renames the file and the function; it does not rename config keys, and `next.config.ts` is usually outside the path you gave it anyway. Fix: rename `skipMiddlewareUrlNormalize` to `skipProxyUrlNormalize` by hand.

```js
// next.config.js
module.exports = {
- skipMiddlewareUrlNormalize: true,
+ skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,
}
```

**★ Symptom: `proxy.ts` exists at the project root and is never invoked.** Cause: you customised `pageExtensions`. Verbatim: *"If you've customized `pageExtensions`, for example to `.page.ts` or `.page.js`, name your file `proxy.page.ts` or `proxy.page.js` accordingly."* Fix: match the extension convention, or the file is just a module nobody imports.

```bash
mv proxy.ts proxy.page.ts
```

**Symptom: two proxy files, and only one of them ever runs.** Cause: only one is supported per project. Verbatim: *"While only one `proxy.ts` file is supported per project, you can still organize your proxy logic into modules."* Fix: compose. Import your rule modules into a single root `proxy.ts` and dispatch on `request.nextUrl.pathname` inside it.

**★ Symptom: proxy works locally and is skipped entirely on your host.** Cause: platform support is not universal — static export is a flat **No**, and adapters are *"Platform-specific."* Fix: check the deployment table before you design around proxy, not after. If you self-host on Node, read the self-hosting guide's Proxy section; if you export statically, move the logic out entirely.

**★ Symptom: someone puts a session-database lookup in proxy and the whole site slows down.** Cause: proxy runs on every matched request, *including prefetches*. Verbatim: *"Proxy is not intended for slow data fetching"*, *"it should not be used as a full session management or authorization solution"*, and *"it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."* Fix: decrypt the cookie, redirect, and do the real authorization at the data access layer.

```ts
// Wrong — a round trip per matched request, prefetches included
const user = await db.users.findBySession(cookie)

// Right — no I/O; the cookie is self-describing
const session = await decrypt(cookie)
if (isProtectedRoute && !session?.userId) {
  return NextResponse.redirect(new URL('/login', req.nextUrl))
}
```

**Symptom: `fetch(url, { next: { revalidate: 60 } })` in proxy re-fetches on every request.** Cause: the App Router `fetch` extensions do not apply here. Verbatim: *"Using fetch with `options.cache`, `options.next.revalidate`, or `options.next.tags`, has no effect in Proxy."* Fix: do not fetch in proxy. And note the compounding problem — an in-process cache you write yourself hits the shared-module trap from [07](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md), so there is no easy workaround here, only a redesign.

**Symptom: a simple path-to-path redirect was written in proxy and behaves inconsistently with trailing slashes.** Cause: it did not need to be in proxy, and the config layer handles normalisation. Verbatim: *"For simple redirects, consider using the `redirects` configuration in `next.config.ts` first."* Fix: move it, and remember `redirects` is step 2 in the pipeline while proxy is step 3 — the config entry would have won anyway.

## Interview questions

**★ Why was middleware renamed rather than just left alone?**
Two stated reasons and one that the docs make plain without labelling it a reason. The published reasons are that *"the term “middleware” can often be confused with Express.js middleware, leading to a misinterpretation of its purpose"*, and that "proxy" *"implies a network boundary in front of the app, which is how this feature behaves."* The third is that they want you to use it less: *"Middleware is highly capable, so it may encourage the usage; however, this feature is recommended to be used as a last resort"* and *"We recommend users avoid relying on Middleware unless no other options exist."* The migration section says the direction out loud — *"we are moving away from Middleware, breaking down its overloaded features."* The rename is a signpost pointing away from the file, not towards it.

**★ Is proxy an acceptable place to do authorization?**
Only as an optimistic pre-filter. The getting-started page says it *"should not be used as a full session management or authorization solution"*, and the file convention reference adds that you should *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."* The authentication guide gives the mechanism behind the advice: proxy runs on every route *including prefetched ones*, so *"it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues"* — a database call there is a database call per prefetch. It closes with the architectural rule: *"The majority of security checks should be performed as close as possible to your data source."* So: cookie-shaped redirect in proxy, real check in the data access layer.

**★ Your app is deployed as a static export. What happens to `proxy.ts`?**
Nothing runs. The platform support table lists static export as a flat **No**, alongside Yes for a Node.js server and Yes for Docker, with adapters marked platform-specific. There is no server in the request path to invoke it, so any redirect, rewrite, header injection or auth pre-filter you put there simply does not exist in that deployment. The failure is silent in the worst way — the build succeeds and the file is present in the repository, so a reviewer sees auth logic that is not running.

**★ Why is there only one `proxy.ts` per project?**
Because the framework wants exactly one network-boundary layer, not a stack of them. The docs give the reasoning: *"By enforcing a single proxy file, it simplifies configuration, prevents potential conflicts, and optimizes performance by avoiding multiple proxy layers."* The supported way to keep it maintainable is composition rather than multiple files — break the rules into modules and import them into the single root file, dispatching on `request.nextUrl.pathname`. That also keeps the matcher in one place, which matters a great deal once you learn what the matcher silently excludes.

**When should a rule live in `next.config` rather than in proxy?**
Whenever it does not need request data. The getting-started guide is explicit — *"For simple redirects, consider using the `redirects` configuration in `next.config.ts` first. Proxy should be used when you need access to request data or more complex logic."* The pipeline order reinforces it: `headers` and `redirects` from the config both run *before* proxy, so a config rule for the same path wins and your proxy branch is dead code. The practical test is whether the decision depends on a cookie, a header, a geo hint or the request method. If it depends only on the path, it belongs in the config, where it is declarative, statically analysable and cannot be broken by a runtime error.

**The docs say to avoid proxy "unless no other options exist." What are the other options, concretely?**
For a fixed path-to-path redirect or a fixed header, `next.config`'s `redirects`, `rewrites` and `headers`. For per-route CORS, the Route Handler's own CORS support, which the docs point at directly. For authorization, a data access layer that checks on every read, plus a check inside each Server Function. For tenant or locale resolution that only affects rendering, a dynamic segment and `generateStaticParams` rather than a rewrite. Proxy earns its place when the decision must be made *before routing* and *from request data* — an A/B split, a host-based tenant rewrite, a cookie-shaped auth pre-filter across many routes — and even then the docs want the real work to happen downstream.

---

← [07 · `proxy.ts`: the deployment boundary](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md) · [Chapter 2 overview](01-explanation.md) · Next → [07c · The matcher, and what it silently skips](07c-the-matcher-and-what-it-silently-skips.md)
