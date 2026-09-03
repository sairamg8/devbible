---
title: "Route Handlers have not been cached by default since Next 15, and every write-up that says a GET handler is statically evaluated unless you read a search param is describing a version you are not running"
sidebar_label: "01d · Route Handlers"
sidebar_position: 3
description: "route.ts as a Web-standard request handler: the supported verbs, why params is a Promise, the real caching default and how to opt back into static, what Cache Components changes, and why request memoization does not reach here."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) (docs `lastUpdated` 2026-03-03), [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`lastUpdated` 2026-04-30) and [`fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A `route.ts` file exports functions named after HTTP verbs, each receiving a Web-standard `Request` (extended as `NextRequest`) and returning a Web-standard `Response` (extended as `NextResponse`). It is the App Router's replacement for Pages Router API routes, and it is built on Fetch API primitives rather than Node's `req`/`res`. Two things about it are commonly taught wrong, both because they were true in Next 14 and stopped being true in the 15 release candidate: `context.params` is now a **promise** you must await, and `GET` handlers are **no longer cached by default**. The second correction inverts the advice: you do not have to work to make a handler dynamic, you have to work to make it static. Cache Components changes that back again, but only when you turn it on.**

## The convention, and what a route is not

Route Handlers live in `route.js|ts` inside `app`, and can be nested anywhere `page.js` can. Two structural rules:

- There **cannot** be a `route.js` at the same route segment level as `page.js`. Each file takes over all HTTP verbs for that route, so the two would conflict.
- A route **does not** participate in layouts or client-side navigations the way a page does. It is the lowest-level routing primitive in the App Router.

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS`. An unsupported method gets a **`405 Method Not Allowed`** from the framework. If you do not define `OPTIONS`, Next.js implements it for you and sets the `Allow` header from the other methods in the file — which is why the CORS preflight for a handler you never wrote an `OPTIONS` for often works anyway.

```typescript
// app/api/products/route.ts
export async function GET(request: Request) {}
export async function POST(request: Request) {}
```

## `params` is a promise

```typescript
// app/api/products/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return new Response('Not Found', { status: 404 })
  return Response.json(product)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteProduct(id)
  return new Response(null, { status: 204 })
}
```

This changed in `v15.0.0-RC` and a codemod exists for the migration. The shapes are exactly as documented: `app/dashboard/[team]/route.js` at `/dashboard/1` yields `Promise<{ team: '1' }>`; a catch-all `app/blog/[...slug]/route.js` at `/blog/1/2` yields `Promise<{ slug: ['1', '2'] }>`.

TypeScript has a globally available helper that saves writing the promise type by hand:

```typescript
// app/users/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

`RouteContext` is generated during `next dev`, `next build` or `next typegen` and needs no import once generation has run — which also means a clean checkout that has never run any of the three will not have it.

## 🔴 The caching default, corrected

> *"Route Handlers are not cached by default. You can, however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached."*

The `v15.0.0-RC` release changed the default caching for `GET` handlers **from static to dynamic**. Everything written before that — and a great deal written since, copied from it — teaches the reverse: that a `GET` with no dynamic API usage is statically evaluated at build time, and that reading a search param or adding a `POST` sibling is what makes it dynamic. On 16.3.4 that is wrong twice over. The handler is dynamic already, and a `POST` sibling has no effect on a `GET` you *have* opted into caching — the documentation states that other supported HTTP methods are **not** cached even when placed alongside a cached `GET` in the same file, which is a statement about them, not about the `GET`.

To cache a `GET`, say so with a route segment config option:

```typescript
// app/api/feature-flags/route.ts
export const dynamic = 'force-static'

export async function GET() {
  const res = await fetch('https://config.acme.com/flags')
  const flags = await res.json()
  return Response.json(flags)
}
```

Route Handlers accept the same [route segment configuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) as pages and layouts — `dynamic`, `dynamicParams`, `revalidate`, `fetchCache`, `runtime`, and the deprecated `preferredRegion`. `export const revalidate = 60` on a handler is the ISR equivalent.

Search-param reading no longer needs to be *defended against*; it is simply the normal case:

```typescript
// app/api/search/route.ts
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) return Response.json({ error: 'Missing query parameter "q"' }, { status: 400 })
  return Response.json(await searchDatabase(query))
}
```

One exception worth knowing: **special** Route Handlers — `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx` and the other metadata file conventions — remain **static by default** unless they use Request-time APIs or dynamic config options. The general default flipped; theirs did not.

## What Cache Components changes

With `cacheComponents: true`, `GET` Route Handlers follow the same model as normal UI routes: they run at request time by default, **can be prerendered when they do not access uncached or runtime data**, and `use cache` lets you pull uncached data into the static response.

```tsx
// app/api/project-info/route.ts — prerendered at build: no uncached or runtime data
export async function GET() {
  return Response.json({ projectName: 'Next.js' })
}
```

Prerendering **stops** — deferring to request-time rendering — if the `GET` handler touches any of: network requests, database queries, async file system operations, request object properties (`req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs such as `cookies()`, `headers()` or `connection()`, or non-deterministic operations like `Math.random()`.

To include a database read in the prerendered response, cache it — and note the constraint that catches everyone:

```tsx
// app/api/products/route.ts
import { cacheLife } from 'next/cache'

export async function GET() {
  const products = await getProducts()
  return Response.json(products)
}

async function getProducts() {
  'use cache'   // 🔴 cannot go directly in the handler body — it must be a helper
  cacheLife('hours')
  return await db.query('SELECT * FROM products')
}
```

Cached responses revalidate according to `cacheLife` when a new request arrives. For dynamic segments, `generateStaticParams` prerenders the params you list; combined with `use cache` it enables data caching for both prerendered and runtime params.

## Request memoization does not reach here

The per-render deduplication described on [01](01-explanation.md) is documented as **not applying in Route Handlers, since they are not part of the React component tree**. Two identical `fetch` calls in one handler are two network requests. If a handler genuinely needs the same loader twice, memoize it yourself:

```typescript
import { cache } from 'react'

const getProduct = cache(async (id: string) => {
  const res = await fetch(`${API}/products/${id}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`)
  return res.json()
})
```

`fetch`'s own persistent cache still applies inside a handler; it is only the render-pass memoization that does not.

## Returning a response

A handler must return a real `Response`. `Response.json(data, init?)` is the built-in shorthand; `NextResponse.json` adds Next-specific conveniences such as cookie helpers and redirect construction. Reading a body uses the standard Web methods — `await request.json()`, `await request.formData()`, `await request.text()` — with no `bodyParser` configuration, unlike Pages Router API routes.

```typescript
export async function POST(request: Request) {
  const body = await request.json()
  return Response.json({ received: body }, { status: 201 })
}
```

## Gotchas

**★ Symptom: your `GET` handler runs on every request in production, and a blog post promised it would be statically cached.** Cause: the default caching for `GET` handlers changed from static to dynamic in `v15.0.0-RC`. Route Handlers are not cached by default on 16.3.4. Fix: opt in explicitly if that is what you want.

```typescript
export const dynamic = 'force-static'   // or: export const revalidate = 60
```

**★ Symptom: the opposite — a `GET` handler you *did* cache never re-executes, and a `console.log` you added for observability only fires at build.** Cause: `force-static` means what it says. Fix: decide which you want per handler; observability that must fire per request belongs in a handler you have not opted into caching, or in a `POST`, which is never cached.

**★ Symptom: `params.id` is `undefined`, or TypeScript complains that `Promise<{ id: string }>` has no property `id`.** Cause: `context.params` became a promise in `v15.0.0-RC`. Fix: await it — and let the generated helper write the type.

```typescript
export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

**★ Symptom: `RouteContext` is not defined, in a checkout that "should" have it.** Cause: the types are generated during `next dev`, `next build` or `next typegen`; a fresh clone with a cold CI cache has never run any of them. Fix: run `next typegen` before typechecking in CI, or write the promise type by hand in code that must compile from a clean tree.

**★ Symptom: you added a `POST` next to a cached `GET` expecting the whole segment to go dynamic, and the `GET` still serves a stale body.** Cause: this is the pre-15 rule and it does not hold. Other HTTP methods are not cached even when placed alongside a cached `GET` in the same file, and their presence does not un-cache the `GET`. Fix: invalidate deliberately from the mutation — `revalidatePath` on the handler's path, or a tag the handler's own `fetch` sets.

**★ Symptom: two identical `fetch` calls in one Route Handler produce two upstream requests, although the same pair in a page produces one.** Cause: memoization does not apply in Route Handlers, because they are not part of the React component tree. Fix: wrap the loader in `React.cache()`, or restructure so the call happens once.

**★ Symptom: returning a plain object from a handler throws at runtime.** Cause: a handler must return a `Response`; there is no `res.json(data)` to write to as there was in Pages Router API routes. Fix: construct one.

```typescript
export async function GET() {
  return Response.json({ status: 'ok' })   // not: return { status: 'ok' }
}
```

**★ Symptom: under Cache Components, a handler you expected to prerender defers to request time and you cannot see why.** Cause: the list of things that stop prerendering is broader than "reads a cookie" — it includes any network request, database query, async filesystem operation, any access to `req.url`, `request.headers`, `request.cookies` or `request.body`, `connection()`, and non-deterministic calls like `Math.random()`. Fix: move the data access into a `use cache` helper, or accept the request-time render deliberately.

**Symptom: `'use cache'` at the top of a `GET` body is rejected.** Cause: it cannot be used directly inside a Route Handler body. Fix: extract the cached work into a helper function and call it from the handler — as in `getProducts()` above.

**Symptom: a route and a page fight over the same URL and the build fails.** Cause: there cannot be a `route.js` at the same segment as `page.js`; each takes over every HTTP verb for that route. Fix: nest the handler under a distinct segment — `app/products/page.tsx` plus `app/api/products/route.ts`, not both at `app/products/`.

**Symptom: a CORS preflight succeeds against a handler that has no `OPTIONS` export, and you conclude preflight is not being checked.** Cause: if `OPTIONS` is not defined, Next.js implements it and sets the `Allow` header from the other methods in the file. Fix: nothing is broken — but the automatic `OPTIONS` does not set `Access-Control-Allow-*`, so a genuine cross-origin handler still needs those headers set explicitly, or configured centrally in `next.config.js`.

**Symptom: a client hits your handler with `PATCH` and gets a `405` you did not write.** Cause: an unsupported method returns `405 Method Not Allowed` from the framework. Fix: export the verb, or fix the caller — but do not go looking for the middleware that "must be" rejecting it.

**Symptom: `sitemap.ts` is static in production while your `/api` handlers are all dynamic, and you cannot reconcile the two.** Cause: special Route Handlers — sitemap, Open Graph images, app icons and the other metadata file conventions — remain static by default unless they use Request-time APIs or dynamic config. The general `GET` default and the metadata default are two different rules. Fix: none needed; know that they differ before you spend an afternoon on it.

## Interview questions

**★ Are `GET` Route Handlers cached by default? Answer for the version you are running and say when it changed.**
No. On 16.3.4 Route Handlers are not cached by default, and other HTTP methods cannot be cached at all. The default for `GET` changed from static to dynamic in `v15.0.0-RC`, at the same release that made `context.params` a promise. The pre-15 model — a `GET` is statically evaluated unless it reads a dynamic API — is what most tutorials still describe, which is why "my handler is caching and I never asked it to" was a Next 13/14 problem and "my handler is not caching and I assumed it would" is a Next 15/16 one.

**★ How do you make a `GET` handler static again, and what does adding a `POST` beside it do?**
Opt in with a route segment config option — `export const dynamic = 'force-static'`, or `export const revalidate = 60` for an ISR-style window. Adding a `POST` does nothing to the `GET`: other methods are not cached even when placed alongside a cached `GET` in the same file, and their presence does not make the `GET` dynamic. If the `POST` mutates data the `GET` serves, you invalidate it explicitly.

**★ Why is `context.params` a promise, and what breaks if you forget?**
It is part of the same move that made `cookies()`, `headers()` and `searchParams` async: request-scoped values are made awaitable so that a render can begin before they are known and defer only the parts that need them. What breaks if you forget is quiet in JavaScript and loud in TypeScript — `params.id` on a promise is `undefined`, so a lookup silently 404s, while the compiler will tell you the property does not exist if you have typed it correctly. Using the generated `RouteContext<'/users/[id]'>` helper makes it hard to get wrong.

**★ Two components fetching the same URL in a page make one request; two in a Route Handler make two. Why?**
Request memoization is a property of the React render pass, and a Route Handler is not part of the React component tree — the documentation states the exclusion explicitly. The persistent `fetch` cache still applies inside a handler, so a `force-cache` or `revalidate` fetch can still be served from cache; it is only the render-scoped deduplication that is absent. If you need it, `React.cache()` around the loader gives you the same effect within the handler's invocation.

**★ Under Cache Components, what makes a `GET` handler prerender, and what stops it?**
It prerenders when it accesses no uncached and no runtime data — a handler that returns a constant, for instance. It stops at the first network request, database query, async filesystem operation, access to a request object property such as `req.url` or `request.headers`, runtime API such as `cookies()`, `headers()` or `connection()`, or non-deterministic operation such as `Math.random()`. To bring data into the prerendered response you wrap the data access in `use cache` — in a helper function, because the directive is not allowed directly in the handler body.

**When should a Route Handler exist at all, given Server Components can fetch directly?**
When something that is not your React tree needs the data over HTTP: a browser doing client-side revalidation or polling, a webhook from a third party, a mobile client, a `sitemap.xml` or RSS feed, a signed-upload endpoint. Fetching from a Server Component through your own Route Handler is a round trip out to your public domain to reach code in the same process — call the loader function directly instead and keep the handler for the callers that genuinely speak HTTP.

**What does `Response.json()` give you over `new Response(JSON.stringify(...))`, and when do you want `NextResponse` instead?**
`Response.json()` is the Web-standard shorthand: it serializes and sets `content-type: application/json` for you, and takes the same `init` for status and headers. `NextResponse` is the Next-specific extension, worth reaching for when you want its conveniences — cookie helpers, redirect and rewrite construction. For a plain JSON payload the standard helper is enough, and preferring it keeps handlers portable.

**Why can a `route.js` not sit beside a `page.js`?**
Because each of them claims *every* HTTP verb for that route, so there is no rule that could decide which one answers a `GET`. That constraint also explains the shape most apps end up with: pages under their content paths, handlers under a distinct segment such as `app/api/...`, and no ambiguity about which file serves a URL.

**A colleague adds a `console.log` to a cached handler for observability and reports it "only fires sometimes". What do you tell them?**
That side effects in a cached handler run when the response is produced, not when it is served — at build, or at revalidation. A `force-static` handler will log once per build. If the requirement is per-request observability, the logging has to live somewhere that runs per request: a handler that is not opted into caching, a `POST`, or the proxy layer. Logging is not a reason to un-cache a hot endpoint, but it is a reason to be clear about which layer you are instrumenting.

---

← [01c · Action hooks and security](01c-server-action-hooks-optimistic-ui-and-security.md) · [Chapter 4 overview](01-explanation.md) · Next → [01 · Fetch in Server Components](01-fetch-in-server-components-automatic-request-deduplication.md)
