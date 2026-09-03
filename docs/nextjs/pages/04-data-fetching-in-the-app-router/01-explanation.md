---
title: "Next.js extends fetch() with a persistent server cache you opt into — and its default is `auto no cache`, which is not the same thing as `no-store`, and that difference decides whether your route prerenders"
sidebar_label: "01 · Overview: fetch and its caches"
sidebar_position: 0
description: "The chapter overview, and the mechanics of the extended fetch() in Server Components: the three cache modes, revalidate and tags, per-render request memoization, and what Cache Components changes."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch) (docs `lastUpdated` 2026-08-25) and [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Chapter 4 is about one question: where does a value come from, and how many times is it actually fetched? The App Router answers it with a patched global `fetch()` that carries persistent caching semantics no other framework's `fetch` has, a per-render memoization layer that is separate from that cache and behaves differently, and two escape hatches — Server Actions for writes and Route Handlers for HTTP — that each have their own caching rules. This page covers the read path. [01b](01b-server-actions-and-mutations.md) and [01c](01c-server-action-hooks-optimistic-ui-and-security.md) cover writes, [01d](01d-route-handlers-and-their-caching-model.md) covers Route Handlers. The single most expensive misunderstanding on this page is that the default `fetch()` is "uncached", which is true of the persistent cache and false of the build: the default mode still runs exactly once during `next build` if nothing on the route forces request-time rendering.**

## The four pages of this overview

| Page | What it settles |
|---|---|
| **this page** | The extended `fetch()`, its cache modes, `revalidate`, `tags`, and request memoization |
| **[01b · Server Actions: the model](01b-server-actions-and-mutations.md)** | `'use server'`, the `action` prop, the single-response model, and 🔴 `updateTag` vs `revalidateTag` |
| **[01c · Action hooks and security](01c-server-action-hooks-optimistic-ui-and-security.md)** | `useActionState`, `useFormStatus`, `useOptimistic`, and the fact that an action is a public endpoint |
| **[01d · Route Handlers](01d-route-handlers-and-their-caching-model.md)** | `route.ts`, why handlers are **not** cached by default, and what Cache Components changes |

The layered cache model these four pages assume — memoization, Data Cache, Full Route Cache, Router Cache — is laid out in [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md). Read this page for what one `fetch` call does; read that one for how the layers interact.

## What Next.js adds to `fetch()`

Next.js extends the web-standard `fetch()` so that each server-side request can set its own persistent caching and revalidation semantics. In the browser, `cache` describes how a request interacts with the *browser's* HTTP cache; on the server, the same option describes how it interacts with **the framework's persistent cache**. Same signature, different subject.

```typescript
fetch(url, {
  cache: 'force-cache' | 'no-store', // how this request meets the framework's persistent cache
  next: {
    revalidate: 3600,                // cache lifetime in seconds (false | 0 | number)
    tags: ['product-123'],           // on-demand invalidation handles
  },
})
```

You call it with `async`/`await` directly inside a Server Component. There is no `getServerSideProps` equivalent and no data-fetching hook; the component *is* the loader.

## `options.cache` — and why the default is not `no-store`

There are three states, and the imported-tutorial shorthand "Next 15 made fetch uncached" collapses two of them into one.

**`auto no cache` (the default).** Next.js fetches from the remote server on every request **in development**, but fetches **once during `next build`**, because the route will be statically prerendered. If [Request-time APIs](https://nextjs.org/docs/app/glossary#request-time-apis) — `cookies()`, `headers()`, `searchParams` — are detected on the route, it then fetches on every request.

**`no-store`.** Fetches from the remote server on every request, **even if Request-time APIs are not detected on the route**. That last clause is the whole difference. `no-store` is a promise about production behaviour; the default is a consequence of how the route rendered.

**`force-cache`.** Next.js looks for a matching entry in its server-side cache. A request matches on its **URL, method, headers, and body** — requests differing in any of those are cached separately. A fresh match is returned from cache; no match or a stale match triggers a real fetch that updates the cache. **Only responses with a `200` status are stored.**

> *"Caching is opt-in. Set `cache: 'force-cache'` to cache any request, including `POST` and requests that send `authorization` or `cookie` headers."*

That sentence is a footgun with a friendly face — see the gotcha below. Draft Mode bypasses the cache entirely, neither reading nor writing it.

## `next.revalidate` — three values, not two

```typescript
fetch(url, { next: { revalidate: false | 0 | number } })
```

- **`false`** — cache indefinitely. Semantically `revalidate: Infinity`; the HTTP cache may still evict older resources over time.
- **`0`** — prevent the resource from being cached at all.
- **`number`** — a cache lifetime of *at most* n seconds.

Two rules that surprise people. If an individual `fetch()` sets a `revalidate` lower than the route segment's default `revalidate`, **the whole route's revalidation interval drops to it**. And if two fetches to the same URL in the same route carry different `revalidate` values, **the lower one wins**. Revalidation windows in a route are therefore a floor computed across every call in it, not a per-call setting.

Combining `revalidate` with a contradictory `cache` is not merely ignored on one side — `{ revalidate: 3600, cache: 'no-store' }` is disallowed, **both options are ignored**, and development prints a terminal warning.

## `next.tags` — with hard limits

```typescript
fetch(url, { next: { tags: ['collection'] } })
```

Tags are the handles [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and `updateTag` invalidate by. The documented limits are concrete: **a custom tag is at most 256 characters, and a request carries at most 128 tag items.** A tagging scheme that interpolates user input (`tag-${email}`) will eventually exceed 256 characters on a real address, and a fan-out scheme that emits one tag per row blows the 128 ceiling as soon as a list page grows.

## Request memoization — a different layer, with different rules

`fetch` requests **using `GET`** with the same URL and options are automatically memoized **during a single server render pass**. Call the same fetch from multiple Server Components, layouts, pages, `generateStaticParams` and `generateViewport`, and Next.js executes it once and shares the result.

This is why fetching the same data in three places in the tree is not the anti-pattern it would be in a client-only app: prop-drilling a user object down five levels to avoid a "duplicate" request is solving a problem the framework already solved. Three facts decide whether it applies:

1. **`GET` only.** A memoized `POST` would be a correctness bug, so there isn't one.
2. **One render pass.** It does not persist across requests, users or page loads. That is the persistent cache's job, and the two are independent — a memoized call still consults (or bypasses) the persistent cache exactly once.
3. **Not in Route Handlers**, because they are not part of the React component tree. See [01d](01d-route-handlers-and-their-caching-model.md).

To opt out for one call, pass an `AbortController` signal:

```typescript
const { signal } = new AbortController()
const res = await fetch(url, { signal }) // not memoized
```

## Parallel versus sequential — the waterfall you did not mean to write

```typescript
// Sequential, and correctly so: the second call needs `user.id`
const user = await getUser(id)
const posts = await getPostsByUser(user.id)

// Parallel: independent data, so both start immediately.
// Wall time is max(a, b), not a + b.
const [user, settings] = await Promise.all([getUser(id), getSettings(id)])
```

The distinction is not "await is slow". It is that `await` on line one *suspends the function*, so a call on line two that never depended on line one does not even start until line one resolves. A genuine dependency deserves a waterfall. Independent data in a waterfall is latency you are paying for nothing.

The structural version of the same idea, under Cache Components: **the deeper the async work sits, the more of the page prerenders.** A layout that does `const { slug } = await params` at the top level cannot be prerendered at all when `slug` is not a build-time param; passing the `params` promise down and awaiting it inside a `<Suspense>` boundary keeps the sidebar and children in the static shell.

## `generateStaticParams()` — build-time paths

The App Router's replacement for `getStaticPaths`. Export an async function returning an array of param objects; each entry causes Next.js to prerender that dynamic route at build time.

```tsx
// app/products/[id]/page.tsx
export async function generateStaticParams() {
  const products = await fetch('https://api.acme.com/products/ids').then((r) => r.json())
  return products.map((p: { id: string }) => ({ id: p.id }))
}

async function getProduct(id: string) {
  const res = await fetch(`https://api.acme.com/products/${id}`, {
    next: { tags: [`product-${id}`], revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`)
  return res.json()
}

async function getInventory(id: string) {
  // Stock levels must never be served from a build-time snapshot, on any route,
  // whether or not the route happens to read a request-time API.
  const res = await fetch(`https://api.acme.com/inventory/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`inventory ${id}: ${res.status}`)
  return res.json()
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [product, inventory] = await Promise.all([getProduct(id), getInventory(id)])
  return <ProductView product={product} inStock={inventory.quantity > 0} />
}
```

A layout on the same route that needs the product's category does **not** need it passed down:

```tsx
// app/products/[id]/layout.tsx — identical GET + identical options ⇒ one network request
async function getProduct(id: string) {
  const res = await fetch(`https://api.acme.com/products/${id}`, {
    next: { tags: [`product-${id}`], revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`)
  return res.json()
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)
  return (
    <div>
      <Breadcrumb category={product.category} />
      {children}
    </div>
  )
}
```

Extracting `getProduct` into one shared module is still better practice — it makes the "identical options" requirement structural instead of a convention two files have to keep agreeing on.

## Where Cache Components moves the goalposts

`cacheComponents: true` in `next.config.ts` is **opt-in** and changes the model rather than tuning it. Instead of annotating each `fetch`, you mark an async function or component with `use cache` and give it a lifetime with `cacheLife`; arguments and captured values become the cache key. Data with no cache directive is expected to sit behind `<Suspense>` and stream at request time. Partial Prerendering becomes the default rendering behaviour. Chapter 5 is the full treatment: [the explicit caching model](../05-caching-ppr-and-cache-components/01-explanation.md).

The load-bearing consequence for this page: under Cache Components, a bare `fetch` in a component with no `use cache` and no `<Suspense>` above it is a **build-time validation failure**, not a silently dynamic route. The framework stops guessing what you meant.

## Gotchas

**★ Symptom: on upgrade, a page that used to be cached is now hitting the origin on every request in production — but only on *some* routes.** Cause: the default is `auto no cache`, not `no-store`. Routes with no Request-time API still prerender and fetch once at build; routes that read `cookies()`, `headers()` or `searchParams` fetch per request. The same unannotated `fetch` behaves differently on two routes because the *route* changed, not the call. Fix: never rely on the default for data whose freshness matters — state the intent on the call.

```typescript
const res = await fetch(url, { next: { revalidate: 3600, tags: ['products'] } }) // cached, on purpose
const live = await fetch(url, { cache: 'no-store' })                             // fresh, on every route
```

**★ Symptom: user A briefly sees user B's data on a page you "just made faster" with `force-cache`.** Cause: `force-cache` caches *any* request, explicitly including ones that send `authorization` or `cookie` headers. The cache key includes headers, so two different bearer tokens are separate entries — but a shared session cookie, a proxy that strips the header, or a token refreshed mid-window all collapse those entries. Fix: never `force-cache` a per-user request. Cache the shared part and fetch the personal part separately.

```typescript
const catalogue = await fetch(`${API}/products`, { next: { revalidate: 600 } })   // shared: cache
const cart = await fetch(`${API}/cart`, {                                        // personal: never
  cache: 'no-store',
  headers: { authorization: `Bearer ${token}` },
})
```

**★ Symptom: `revalidateTag` fires, the log says it succeeded, and the page still shows old data.** Cause: the failing fetch never carried the tag, or the response was not a `200` so nothing was ever stored to invalidate. Only `200` responses enter the cache. Fix: assert the response before caching semantics can matter, and tag at the single place the call is defined.

```typescript
async function getProduct(id: string) {
  const res = await fetch(`${API}/products/${id}`, { next: { tags: [`product-${id}`], revalidate: 3600 } })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`) // a 404 was never cached — stop pretending it was
  return res.json()
}
```

**★ Symptom: a whole route revalidates every 10 seconds although its segment config says `revalidate = 3600`.** Cause: one `fetch` in that route passes `next: { revalidate: 10 }`, and a per-request value lower than the route's default lowers the whole route's interval. Fix: isolate the short-lived read behind its own boundary rather than letting it drag the route down, or raise it to the route's floor if 10 seconds was cargo-culted.

```typescript
// The route-wide interval is now the minimum of every fetch in the route.
export const revalidate = 3600
const ticker = await fetch(url, { next: { revalidate: 10 } }) // 🔴 the route is now a 10s route
```

**Symptom: two identical fetches in one route disagree on freshness and you cannot work out which wins.** Cause: for two requests to the same URL in the same route with different `revalidate` values, the lower value is used. Fix: define the fetch once in a shared module and import it, so there is only one value to reason about.

**Symptom: `{ revalidate: 3600, cache: 'no-store' }` behaves like neither.** Cause: conflicting options are not allowed; **both are ignored** and development prints a warning to the terminal. The call falls back to default behaviour, which in production may well be cached — the opposite of what the `no-store` was there to guarantee. Fix: pick one. `cache: 'no-store'` alone for always-fresh, `next: { revalidate: n }` alone for a lifetime.

**★ Symptom: two components fetch "the same" data and you still see two requests in your upstream's logs.** Cause: memoization matches on the same URL **and options**, and it is `GET`-only. A `POST`, or one call with `{ next: { tags: ['p'] } }` and another with `{ next: { tags: ['p'], revalidate: 3600 } }`, are different calls. Fix: one exported function, imported by every caller — not two hand-copied call sites that must stay byte-identical forever.

```typescript
// lib/products.ts — the only place these options exist
export async function getProduct(id: string) {
  const res = await fetch(`${API}/products/${id}`, { next: { tags: [`product-${id}`], revalidate: 3600 } })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`)
  return res.json()
}
```

**Symptom: memoization "does not work" inside a Route Handler.** Cause: it is documented not to apply there, because Route Handlers are not part of the React component tree. Fix: memoize it yourself with `React.cache()` around the loader, or just call it once and pass the value — see [01d](01d-route-handlers-and-their-caching-model.md).

**★ Symptom: you edit a file, the dev server hot-reloads, and a `cache: 'no-store'` fetch still shows yesterday's data.** Cause: Next.js caches `fetch` responses in Server Components **across Hot Module Replacement**, and by default that HMR cache applies to *all* fetches, including the default mode and `no-store`. It is cleared on navigation or a full reload, not on HMR. Fix: reload the page rather than trusting HMR when you are debugging freshness, or turn the HMR cache off.

```ts
// next.config.ts
const nextConfig = { serverComponentsHmrCache: false }
export default nextConfig
```

**Symptom: caching appears to be broken only when devtools are open.** Cause: in development, a request carrying `cache-control: no-cache` — which browsers send on a hard refresh and with the devtools cache disabled — makes Next.js ignore `options.cache`, `options.next.revalidate` and `options.next.tags` and serve from the source. Fix: nothing to fix. Test caching with devtools closed, or in a production build.

**Symptom: `revalidateTag('user-'+email)` silently never invalidates anything.** Cause: the tag exceeded the documented 256-character maximum, or the request already carried the maximum of 128 tag items. Fix: tag by opaque ID, not by content, and tag at the entity a mutation actually names.

```typescript
next: { tags: [`user-${userId}`] }        // bounded length, one item
// not: tags: rows.map(r => `row-${r.id}`) // unbounded, and 129 rows is a silent cliff
```

**Symptom: a page fetches three independent things and takes as long as the sum of all three.** Cause: three sequential `await`s. Fix: `Promise.all` for independent reads — and note this applies to reads. Server Actions are **not** parallelisable this way from the client; see [01b](01b-server-actions-and-mutations.md).

**Symptom: under Cache Components a route that built fine before now fails the build.** Cause: an uncached read that is neither inside `use cache` nor behind a `<Suspense>` boundary. This is deliberate — the previous model would have silently made the whole route dynamic. Fix: decide which one it is. `use cache` plus `cacheLife` if the value can be shared, `<Suspense>` plus a fallback if it must be per-request.

## Interview questions

**★ Next 15 made `fetch` "uncached by default". What exactly changed, and what did *not*?**
The persistent-cache default flipped from `force-cache` to `auto no cache`, so caching became opt-in. What did not change is that an unannotated fetch on a route with no request-time API still runs **once during `next build`**, because the route is statically prerendered. That is the trap: people read "uncached" as "runs on every request" and conclude their upgraded app is now fully dynamic and slow. It may instead be fully static and stale. `no-store` is the option that actually promises a fetch per request regardless of how the route rendered.

**★ Request memoization and the Data Cache both stop duplicate fetches. Why are they two things?**
They have different scopes and different keys. Memoization lives for one server render pass, applies to `GET` only, keys on URL plus options, and exists so that a component tree can fetch what it needs where it needs it without prop drilling. The persistent cache lives across requests and deployments-within-a-build, keys on URL, method, headers and body, stores only `200` responses, and exists so that two different users' requests do not both hit your origin. Memoization is a correctness affordance for component composition; the Data Cache is a performance and cost decision. Invalidating one has nothing to do with the other.

**★ Why does `Promise.all` help a Server Component but not a `revalidateTag` you fire from a Server Action?**
`Promise.all` on reads overlaps network latency inside a single render, so wall time becomes the maximum rather than the sum. It does nothing for the write path, because Next.js dispatches Server Actions **one at a time per client** — a second action waits for the first. Parallel work in a mutation belongs *inside* one action.

**What is the cache key for a `force-cache` fetch, and why does that matter for authenticated requests?**
URL, method, headers and body. Because headers are part of the key, two users with different bearer tokens do get separate entries — which is exactly why people talk themselves into caching authenticated requests. It is still wrong: a shared session cookie, a proxy that normalises headers, or a token that rotates mid-lifetime all break the assumption that "different user ⇒ different key". Cache the shared resource, never the personalised one.

**Two components fetch the same URL. One passes `revalidate: 60`, the other `revalidate: 3600`. What happens?**
They are different fetch options, so they are not memoized together — two requests. For the persistent cache, the documentation states that when two fetch requests with the same URL in the same route have different `revalidate` values, the lower value is used. So the effective lifetime is 60 seconds, and if the route's segment `revalidate` was higher, the route's interval drops too. The fix is architectural: one loader function, one set of options.

**★ You call `revalidateTag('product-42')` and nothing changes. Walk through the possibilities.**
Four, in order of likelihood. The fetch never carried the tag — check the *actual* call, not the one you think runs. The response was not a `200`, so nothing was stored to invalidate. The tag string exceeded 256 characters or the call exceeded 128 tags. Or the invalidation worked and you are looking at a different layer: the client Router Cache still holds the RSC payload for a route you already visited, and clearing the Data Cache does not reach into a browser. Which of the four it is determines whether you change the fetch, the tag, or the navigation.

**Why is `<Suspense>` a data-fetching concern rather than a loading-spinner concern?**
Because under Cache Components it is what lets a route produce a static shell at all. Content that cannot resolve at build time is allowed to exist only if there is a boundary above it whose fallback *can* ship in the prerendered HTML. Wrapping is not decoration; it is the declaration of where the static part stops. Note the converse, which is stated explicitly in the docs: `<Suspense>` does not itself opt a component into dynamic rendering — a purely synchronous component still completes during prerendering whether or not it is wrapped.

**Your layout does `const { slug } = await params` on its first line and nothing on the route prerenders. Why, and what is the fix?**
For a param not produced by `generateStaticParams`, `params` is runtime data, and awaiting it at the top of a layout makes the entire layout — sidebar, nav, children — unprerenderable. The fix is to not await it there. Keep the layout synchronous, pass the `params` promise down, and await it inside a component wrapped in `<Suspense>`. Everything above the boundary stays in the static shell and only the slug-dependent heading streams.

**When would you deliberately use `revalidate: false` rather than a large number?**
When the resource genuinely never changes for the lifetime of a deployment — a build manifest, a legal document version, an immutable content-addressed asset. `false` is semantically `Infinity`, with the caveat the docs attach: the HTTP cache may still evict older resources over time, so it is a statement of intent, not a durability guarantee. Reaching for `revalidate: 31536000` instead is a way of saying you did not decide.

**How do you opt a single fetch out of memoization, and when is that the right call?**
Pass an `AbortController` signal. It is rarely the right call — the usual reasons for wanting two identical requests in one render (retrying, racing two endpoints, deliberately reading twice around a mutation) are better expressed as two different requests. Reach for it when you genuinely need the network call to happen twice within one render and cannot make the calls differ.

---

Next → [01b · Server Actions and mutations](01b-server-actions-and-mutations.md)
