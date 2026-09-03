---
sidebar_position: 13
title: "Next.js routing is seven ordered phases, and an adapter either replays them exactly or ships subtle 404s — which is why @next/routing exists"
sidebar_label: "Adapter routing and @next/routing"
description: "The seven routing phases exposed in onBuildComplete, the common route fields, and how resolveRoutes from @next/routing reproduces Next.js route matching without reimplementing it."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Adapters · Routing Information](https://nextjs.org/docs/app/api-reference/adapters/routing-information), [Adapters · Routing with `@next/routing`](https://nextjs.org/docs/app/api-reference/adapters/routing-with-next-routing), [Adapters · API Reference](https://nextjs.org/docs/app/api-reference/adapters/api-reference), and the [`@next/routing` package](https://www.npmjs.com/package/@next/routing).
> Target: **Next.js 16.3.4**. Adapter API stable since 16.2. Prior page: [12 · Adapter output types](12-adapter-output-types-what-a-build-actually-is.md).

**Routing is where pre-adapter integrations died. Next.js resolves a request through seven ordered phases — headers and redirects, middleware matching, rewrites before the filesystem, the filesystem itself, dynamic matchers, post-match rules, then fallback rewrites — and getting the *order* wrong produces failures that only appear on the one route where two rules overlap. The `routing` object on `onBuildComplete` hands a platform each phase as an array of compiled regexes with their conditions already evaluated. `@next/routing` goes further and hands you the resolver itself, so an adapter never has to own this logic at all.**

## The seven phases, in order

```typescript
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
```

What the reference says each phase holds:

| Phase | Meaning |
| --- | --- |
| `beforeMiddleware` | Routes applied **before** middleware executes. These include the generated header and redirect behaviour. |
| `middlewareMatchers` | The middleware matcher definitions emitted for this build. A platform uses them to decide whether middleware should be invoked for a given request at all. |
| `beforeFiles` | Rewrite routes checked **before** filesystem route matching. |
| `afterFiles` | Rewrite routes checked **after** filesystem route matching. |
| `dynamicRoutes` | Dynamic matchers generated from route segments such as `[slug]`, and from catch-all routes. |
| `onMatch` | Routes that apply *after* a successful match — the reference's own example is immutable cache headers for hashed static assets. |
| `fallback` | The final rewrite routes, checked only when none of the earlier phases produced a match. |

Two of these correspond to the two halves of `rewrites()` in `next.config.js` — `beforeFiles` and `afterFiles` — and their ordering relative to the filesystem is the entire reason the config takes an object with those keys instead of a flat array. `fallback` is the third key, checked only when nothing else matched.

`onMatch` is the one most adapters overlook, and the API reference's canonical example of it is exactly the case that hurts: rules applied after a successful match, such as the immutable cache headers for hashed static assets. If your platform serves `/_next/static/*` directly from object storage and never consults `onMatch`, those assets go out without `Cache-Control: public, max-age=31536000, immutable` and every browser re-downloads the entire bundle on every visit.

## Common route fields

Each entry in every phase can carry the following, as the reference describes them:

- `source` — the original route pattern. It is **optional**, because internally generated rules may not have one.
- `sourceRegex` — the compiled regex used to match requests.
- `destination` — the internal destination, or the redirect destination.
- `headers` — headers to apply.
- `has` — the positive matching conditions.
- `missing` — the negative matching conditions.
- `status` — the redirect status code.
- `priority` — an internal route priority flag.

`source` being optional is the tell that some of these rules were generated rather than authored. A rule from `headers()` in `next.config.js` has a `source`; an internal rule Next.js synthesised may not. Never key logic on `source` — match on `sourceRegex`.

`shouldNormalizeNextData` is the Pages Router compatibility switch. It states whether `/_next/data/<buildId>/...` URLs should be normalized during matching. A platform that skips this will fail to route client-side data requests on Pages Router apps.

## `@next/routing` — do not reimplement this

The docs' own recommendation is to stop here and take the library: `@next/routing` exists to reproduce Next.js route matching behaviour using the data `onBuildComplete` already handed you. Nothing else needs to be derived.

The package takes the pathnames of every routable output plus the `routing` object, and returns a routing decision:

```typescript
import { resolveRoutes } from '@next/routing'

const pathnames = [
  ...outputs.pages,
  ...outputs.pagesApi,
  ...outputs.appPages,
  ...outputs.appRoutes,
  ...outputs.staticFiles,
].map((output) => output.pathname)

const result = await resolveRoutes({
  url: new URL(requestUrl),
  buildId,
  basePath: config.basePath || '',
  i18n: config.i18n,
  headers: new Headers(requestHeaders),
  requestBody, // ReadableStream
  pathnames,
  routes: routing,
  invokeMiddleware: async (ctx) => {
    // platform-specific middleware invocation
    return {}
  },
})
```

`invokeMiddleware` is the seam: the resolver knows *when* middleware should run, and calls back into the platform to actually run it. That inversion is what lets one resolver serve a Lambda-based platform, a Workers-based platform and a plain Node process.

### What `resolveRoutes()` returns

- `middlewareResponded` — `true` when middleware has **already sent a response**, in which case the adapter must not go on to invoke an entrypoint.
- `externalRewrite` — a `URL`, present when routing resolved to an external rewrite destination.
- `redirect` — an object carrying `url` (a `URL`) and `status`, present when the request should be redirected.
- `resolvedPathname` — the route pathname Next.js routing selected. For a dynamic route this is the matched route *template*, such as `/blog/[slug]`.
- `resolvedQuery` — the final query, after rewrites or middleware have added or replaced search params.
- `invocationTarget` — the concrete pathname and query to invoke for the matched route.
- `resolvedHeaders` — a `Headers` object containing any headers added or modified during routing.
- `status` — an HTTP status code set by routing, for example by a redirect or a rewrite rule.
- `routeMatches` — a record of the named matches extracted from the dynamic route segments.

### The distinction that catches everyone

The docs illustrate it with one request. Take `/blog/post-1?draft=1` matching the route `/blog/[slug]` with `slug=post-1`: `resolvedPathname` comes back as `/blog/[slug]`, while `invocationTarget.pathname` comes back as `/blog/post-1`.

`resolvedPathname` is the **template** — the identity you use to look up which function to invoke and which prerender group applies. `invocationTarget` is the **concrete URL** you hand that function. Swapping them produces one of two failures: invoking with the template (the route handler sees a literal `[slug]`) or looking up the function by the concrete path (nothing matches, 404 on every dynamic route). Both are trivially reproducible and both have shipped.

### Wiring it into a request path

```ts
async function handleRequest(request, { routing, outputs, buildId, config }) {
  const result = await resolveRoutes({
    url: new URL(request.url),
    buildId,
    basePath: config.basePath || '',
    i18n: config.i18n,
    headers: request.headers,
    requestBody: request.body,
    pathnames: routableOutputPathnames,
    routes: routing,
    invokeMiddleware: (ctx) => runMiddlewareFunction(ctx),
  })

  if (result.middlewareResponded) return // middleware already answered
  if (result.redirect) {
    return Response.redirect(result.redirect.url, result.redirect.status)
  }
  if (result.externalRewrite) {
    return fetch(result.externalRewrite, request)
  }

  // Look up by the TEMPLATE, invoke with the CONCRETE target.
  const output = outputsByPathname.get(result.resolvedPathname)
  return invokeEntrypoint(output, result.invocationTarget, result.resolvedHeaders)
}
```

## The `rsc` field

`routing.rsc` is described only as the route metadata used for React Server Components routing behaviour. The reference does not enumerate its shape on this page. **I could not confirm the full structure of `routing.rsc` from the documentation**; treat it as opaque data to be passed through to `resolveRoutes` rather than something to interpret yourself. The related concern — which request headers make an RSC response differ — is set out on the CDN Caching guide, which names `rsc`, `next-router-state-tree`, `next-router-prefetch`, `next-router-segment-prefetch` and `next-url` as the `Vary` headers App Router responses carry.

## Gotchas

**★ Evaluating rewrites before redirects, or filesystem before `beforeFiles`.**
The phases are ordered and the order is the specification. A `beforeFiles` rewrite deliberately shadows a real file; running the filesystem first makes that rewrite dead code, and the symptom is one route out of two hundred behaving differently in production than in `next dev`. Evaluate strictly: `beforeMiddleware` → middleware (if `middlewareMatchers` matched) → `beforeFiles` → filesystem → `afterFiles` → `dynamicRoutes` → `onMatch` → `fallback`.

**★ Skipping `onMatch` and shipping static assets without cache headers.**
`onMatch` is where the `Cache-Control: public, max-age=31536000, immutable` rule for hashed assets lives. A platform that serves `/_next/static/*` straight from object storage and never applies `onMatch` produces a site that re-downloads its whole JavaScript bundle on every navigation to a cold cache. Apply `onMatch` headers to the response even when the body came from storage rather than from a function.

**★ Using `invocationTarget.pathname` to look up the function.**
`invocationTarget` is `/blog/post-1`; the output's `pathname` is the template. The lookup misses and every dynamic route 404s while static ones work — which reads like a routing table bug and is actually a two-field confusion. Look up on `resolvedPathname`, invoke with `invocationTarget`.

**★ Invoking an entrypoint after `middlewareResponded` came back `true`.**
Middleware that returned a 401 or a rewrite response has already produced the answer. Invoking the page anyway either double-sends or discards the middleware response — and in the 401 case, ships the protected page's body. Check `middlewareResponded` before anything else in the result.

**★ Keying routing logic on `source` instead of `sourceRegex`.**
The reference marks `source` as optional precisely because internally generated rules do not have one, so any rule Next.js synthesised may arrive without it. Code that does `route.source.startsWith('/api')` throws on internal rules; code that filters on `source` silently drops them. `sourceRegex` is always present.

**★ Forgetting `shouldNormalizeNextData` on a Pages Router app.**
Client-side navigations in the Pages Router request `/_next/data/<buildId>/path.json`. Without normalization during matching, those URLs do not match any route and every client-side navigation falls back to a full document load — a performance regression that no error surfaces.

**★ Reimplementing the matcher instead of shipping `@next/routing`.**
Catch-all segments, optional catch-alls, `has`/`missing` conditions, `basePath`, `i18n` locale prefixes, trailing-slash normalization and priority flags interact in ways that take a long time to get exactly right and no time at all to get subtly wrong. The package exists because the framework team concluded the same thing. Use it, and spend your effort on `invokeMiddleware` and on invoking entrypoints.

**★ Passing the raw request query to the entrypoint instead of `resolvedQuery`.**
Rewrites and middleware can add or replace search params — a rewrite from `/blog/post-1` to `/blog/[slug]` supplies `slug=post-1`. `resolvedQuery` is defined as the final query *after* rewrites or middleware have added or replaced search params; the original URL's query is not that. A page whose `searchParams` are missing a value the rewrite injected is this bug.

## Interview questions

**★ Name the routing phases in order and say what each one is for.**
`beforeMiddleware` (generated header and redirect behaviour), then middleware itself if `middlewareMatchers` matched, then `beforeFiles` rewrites (checked before the filesystem, so they can shadow real files), then filesystem matching, then `afterFiles` rewrites (checked after, so real files win), then `dynamicRoutes` (matchers generated from `[slug]` and catch-all segments), then `onMatch` (rules applied after a successful match, such as immutable cache headers), then `fallback` (final rewrites when nothing matched).

**★ What is the difference between `resolvedPathname` and `invocationTarget.pathname`?**
`resolvedPathname` is the route template Next.js selected — `/blog/[slug]` — and is the identity you use to find the function and the prerender group. `invocationTarget.pathname` is the concrete URL — `/blog/post-1` — and is what you hand the function so it renders the right content. The documentation gives exactly this example, using the request `/blog/post-1?draft=1`.

**★ Why does `resolveRoutes` take an `invokeMiddleware` callback rather than running middleware itself?**
Because *how* middleware runs is the platform's business — a Lambda invocation, a Worker call, a local function in the same process — while *when* it runs is Next.js's. Inverting control at that seam is what lets one resolver serve every platform without knowing anything about their runtimes.

**★ An adapter serves hashed static assets from object storage and users report the whole bundle re-downloading on every visit. Where is the bug?**
The `onMatch` phase. It carries the `Cache-Control: public, max-age=31536000, immutable` rule for hashed assets, and a platform that bypasses the routing phases for static content never applies it. The assets are content-addressed and safe to cache for a year; without the header the browser has no way to know that.

**★ Why is `source` optional on a `Route` but `sourceRegex` is not?**
Because not every rule was authored by the user. Next.js generates internal routing rules — header application, data-URL normalization, RSC handling — that have no original pattern to report. `sourceRegex` is the compiled matcher and is always present, which makes it the only field safe to branch on.

**★ What does `shouldNormalizeNextData` control, and which router does it affect?**
Whether `/_next/data/<buildId>/...` URLs are normalized during matching. It affects the Pages Router, whose client-side navigations fetch page data from those URLs. Without normalization they match nothing, and every client-side navigation silently degrades to a full page load.

**★ Your platform runs middleware at the CDN edge. Which field decides whether to invoke it, and why is it pre-compiled?**
`outputs.middleware.config.matchers`, and separately `routing.middlewareMatchers`. Each carries a `sourceRegex` plus `has`/`missing` conditions. They are pre-compiled so the edge can decide *not* to invoke the function — the decision has to be cheaper than the invocation, or matchers would be pointless.

{/* FOOTER */}
