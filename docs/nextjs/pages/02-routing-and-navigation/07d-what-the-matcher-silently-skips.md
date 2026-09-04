---
title: "A Server Function is not a route in the matching chain but a POST to whichever route imported it, so excluding a path also excludes every Server Function called from it — and _next/data runs your proxy even when you exclude it, because Next.js decided that particular hole was too dangerous to let you dig"
sidebar_label: "07d · What the matcher skips"
sidebar_position: 165
description: "The Server-Function POST trap that silently removes auth coverage and survives refactors, the deliberate _next/data override of your own configuration, why prefetch requests run proxy too and what that costs, and asserting matcher coverage in a unit test with unstable_doesProxyMatch."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`) and the [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**A matcher looks like a complete statement of where proxy runs, and it is not. Three things break the correspondence between the pattern you wrote and the requests your proxy sees, and all three are silent. Server Functions have no URL of their own — they are POSTs to whatever route imported them, so a matcher exclusion removes proxy coverage from every action called on that page, and a refactor that moves a shared action to a different page changes its coverage with no change to the action's file. `_next/data` runs proxy whether you exclude it or not, deliberately. And prefetch requests are ordinary requests as far as the matcher is concerned, so every visible `<Link>` is paying whatever your proxy does. None of this produces an error; the first two produce a security hole and the third produces a bill.**

## 🔴 `_next/data` ignores your exclusion, on purpose

> *"Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental security issues where you might protect a page but forget to protect the corresponding data route."*

```ts
export const config = {
  matcher:
    '/((?!api|_next/data|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
}

// Proxy will still run for /_next/data/* routes despite being excluded
```

That is a deliberate override of your configuration, and it is the right call: the alternative is a page that redirects unauthenticated users while its data route serves them the same content as JSON.

## 🔴 The Server Function trap

This is the most valuable sentence on the whole proxy reference, and it is printed as a *Good to know*:

> *"**Server Functions are not separate routes in this chain.** They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."*

> *"A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. **Always verify authentication and authorization inside each Server Function** rather than relying on Proxy alone."*

Read the two together and the shape of the bug is clear. A Server Function has no URL of its own; it is a POST to whichever page or layout imported it. So:

- Excluding `/api` from your matcher does **not** exclude Server Functions — those are not under `/api`.
- Excluding `/reports` from your matcher **does** exclude every Server Function called from a component on `/reports`, including one imported from a shared module and used on five other pages.
- Moving a shared `deleteInvoice()` action from a component rendered on `/billing` to one rendered on `/admin/billing` changes which matcher rule covers it — with no change to the action's own file.

```ts
// app/reports/actions.ts
'use server'

import { getSession } from '@/lib/session'

export async function exportReport(id: string) {
  // 🔴 Do this here. The matcher above may or may not have run.
  const session = await getSession()
  if (!session?.canExport) throw new Error('Forbidden')

  return buildExport(id)
}
```

The corresponding matcher mistake, which looks harmless in review:

```ts
// 🔴 Excludes the reports UI from proxy — and every Server Function called from it
export const config = {
  matcher: ['/((?!api|reports|_next/static|_next/image).*)'],
}
```

## Prefetch requests run proxy too

> *"since Proxy runs on every route, including prefetched routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."*

With Partial Prefetching on, a page with links to five distinct routes prefetches five App Shells, and each of those is a request your proxy sees. Anything in proxy is therefore paid per *potential* navigation, not per actual one. That is the real cost model behind the "no slow data fetching" rule, and it is why `has`/`missing` on the prefetch headers exists as a matcher feature at all.

## Testing a matcher without running a server

Next.js ships assertion helpers for exactly this, and the docs flag them as experimental:

> *"Starting in Next.js 15.1, the `next/experimental/testing/server` package contains utilities to help unit test proxy files. Unit testing proxy can help ensure that it's only run on desired paths and that custom routing logic works as intended before code reaches production."*

> *"The `unstable_doesProxyMatch` function can be used to assert whether proxy will run for the provided URL, headers, and cookies."*

```js
import { unstable_doesProxyMatch } from 'next/experimental/testing/server'

expect(
  unstable_doesProxyMatch({
    config,
    nextConfig,
    url: '/test',
  })
).toEqual(false)
```

This is the only mechanism the docs give for turning "I think the matcher covers that" into a checked assertion, and given the Server-Function trap above it earns its place in a test suite. Asserting on the *function's* behaviour is covered in [07e](07e-inside-the-proxy-function.md).

## Gotchas

**★ Symptom: an authenticated Server Action succeeds for a logged-out user.** Cause: the matcher excludes the route the action is used on, and a Server Function is a POST to that route rather than a route of its own. Verbatim: *"a Proxy matcher that excludes a path will also skip Server Function calls on that path."* Fix: check the session inside the function, which the docs mandate regardless — *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*

```ts
'use server'
export async function deleteInvoice(id: string) {
  const session = await getSession()
  if (!session?.userId) throw new Error('Unauthorized')
  await db.invoices.delete(id)
}
```

**★ Symptom: a refactor that moved a component broke authorization, and nothing in the auth code changed.** Cause: the Server Function moved to a route covered by a different matcher rule. Verbatim: *"A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage."* Fix: the same one — the check belongs in the function, so that where it is rendered stops mattering.

**★ Symptom: proxy runs on `/_next/data/...` even though you excluded it.** Cause: it is not a bug. Verbatim: *"Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental security issues where you might protect a page but forget to protect the corresponding data route."* Fix: nothing to fix — but make sure your proxy function handles that path shape gracefully rather than assuming every request is a page request.

**Symptom: every prefetch on a link-heavy page hits your session database.** Cause: proxy runs on prefetch requests too. Fix: read the cookie only, or exclude prefetches with a `missing` condition on the prefetch headers if the work genuinely should not run ahead of a click.

```ts
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image).*)',
      missing: [{ type: 'header', key: 'purpose', value: 'prefetch' }],
    },
  ],
}
```

**Symptom: nobody can say with confidence whether a given URL is covered.** Cause: negative lookaheads combined with `has`/`missing` are not readable by inspection. Fix: assert it, with the experimental helper, in an ordinary unit test — no server, no build.

```js
import { unstable_doesProxyMatch } from 'next/experimental/testing/server'
import { config } from '../proxy'
import nextConfig from '../next.config'

expect(unstable_doesProxyMatch({ config, nextConfig, url: '/dashboard/x' })).toEqual(true)
expect(unstable_doesProxyMatch({ config, nextConfig, url: '/_next/static/a.css' })).toEqual(false)
```

## Interview questions

**★ You excluded `/reports` from the matcher for performance. What did you just break?**
Potentially every Server Function called from anything rendered on `/reports`. Server Functions are not routes in the matching chain — *"They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."* If your proxy was doing an auth pre-filter, those actions are now reachable without it. Worse, the coupling is invisible: the action's own file did not change, and a later refactor that moves a shared action to a component on a different route silently changes its coverage in the other direction. The documented conclusion is that proxy coverage is not an authorization mechanism at all — *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*

**★ Why does proxy still run for `_next/data` when you have explicitly excluded it?**
Because the framework decided that particular exclusion is more often a mistake than an intention. Verbatim: *"This is intentional behavior to prevent accidental security issues where you might protect a page but forget to protect the corresponding data route."* The scenario it defends against is a proxy that redirects unauthenticated users away from `/dashboard` while the corresponding data route happily serves the same content as JSON to anyone who asks. It is one of the few places in Next.js where your configuration is deliberately overridden, and it is a good override.

**How would you prove, in CI, that a matcher covers what you think it covers?**
With `unstable_doesProxyMatch` from `next/experimental/testing/server`, which the docs describe as being able to *"assert whether proxy will run for the provided URL, headers, and cookies."* You import your real `config` and your real `next.config`, and assert `true` for the paths that must be guarded and `false` for the asset prefixes that must not be. It needs no server and no build, so it is cheap enough to run on every commit — and given that the matcher is the boundary determining which Server Function calls are covered, it is closer to a security test than a routing test.

---

← [07c · The matcher syntax](07c-the-matcher-and-what-it-silently-skips.md) · [Chapter 2 overview](01-explanation.md) · Next → [07e · Inside the proxy function](07e-inside-the-proxy-function.md)
