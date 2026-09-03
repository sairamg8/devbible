---
title: "Request memoization is a per-render deduplication pass, not a cache — it matches only byte-identical GET calls, dies at the end of the render, and the moment two call sites drift apart it stops working with no error and no log line"
sidebar_label: "01 · fetch and deduplication"
sidebar_position: 1
description: "How request memoization actually works in Server Components: why it is a separate layer from the Data Cache, the exact identity rule that decides a hit, its per-render lifetime, opting out, and the places it does not apply."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) (docs `lastUpdated` 2026-08-25), [`fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch) and [Caching](https://nextjs.org/docs/app/getting-started/caching).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Request memoization is the layer people think they understand and consistently do not. It is not the Data Cache, it does not survive the response, it does not help a Prisma query, and it is not a performance feature you tune — it is a *composition* affordance whose entire job is to make "fetch it where you need it" a correct thing to do. This page is the deep version of the memoization paragraph in [the chapter overview](01-explanation.md): what the identity rule actually is, why a single extra option in one of two call sites silently doubles your origin traffic, when the memo table is thrown away, and the four places the mechanism does not reach. The overview tells you memoization exists. This page tells you why yours is not firing.**

## Two layers, and conflating them is the classic error

Both stop a second network call. They agree on nothing else.

| | **Request memoization** | **Data Cache** |
|---|---|---|
| Owner | React, via the RSC renderer | Next.js, on the server |
| Scope | one server render pass | across requests, users and deployments-within-a-build |
| Key | URL **and** options | URL, method, headers, body |
| Methods | `GET` only | any method you explicitly `force-cache` |
| Opt in? | automatic, always on | opt-in — `cache: 'force-cache'` or `next: { revalidate }` |
| Opt out | `AbortController` signal | `cache: 'no-store'` |
| Invalidation | none — it expires | `revalidateTag`, `updateTag`, `revalidatePath`, time |
| Stores non-`200`? | yes — a non-`200` response is still a result | no, `200` only |
| Purpose | let a component tree fetch what it needs where it needs it | keep two users' requests off your origin |

> *"Identical `fetch` requests in a React component tree are memoized by default"*

The two layers are stacked, not alternatives. A memoized call still consults the Data Cache — **exactly once**. So the number of Data Cache lookups in a render equals the number of *distinct* requests, not the number of call sites, and the number of origin round-trips equals the number of distinct requests that missed the Data Cache. Three call sites, one distinct request, one cache miss, one network call.

The practical consequence of conflating them: someone sees the same URL hit their upstream twice in one render, concludes "the cache is broken", and reaches for `revalidateTag`. Tags do not exist at the memoization layer. Nothing you do to the Data Cache changes whether two calls in one render dedupe.

## The identity rule — and why it is easier to break than to satisfy

Three conditions must all hold for two calls to collapse into one.

1. **Both are `GET`.** A memoized `POST` would be a correctness bug — the second call has side effects the caller is entitled to. There is no opt-in.
2. **Same URL.** Including the query string, in the order you wrote it. `?a=1&b=2` and `?b=2&a=1` are different strings; the documentation does not say they are normalised, so assume they are not.
3. **Same options.** This is where real applications lose.

The documentation states the rule as *identical* requests — the same URL and options. It does **not** publish the serialization used to derive the memoization key, so the honest engineering rule is stronger than the documented one: **treat any textual difference in the options object as a potential miss.** I could not confirm whether header order, or an explicitly-passed default such as `method: 'GET'`, affects the key. Do not build on the answer either way.

Here is the failure in its natural habitat — two files, written weeks apart, that both "fetch the product":

```ts
// app/products/[id]/layout.tsx — written first
const res = await fetch(`${API}/products/${id}`, {
  next: { tags: [`product-${id}`] },
})

// app/products/[id]/page.tsx — written later, by someone adding ISR
const res = await fetch(`${API}/products/${id}`, {
  next: { tags: [`product-${id}`], revalidate: 3600 },
})
```

Same URL. Same method. Different options. Two requests, every render, forever — and nothing in the terminal, the build output or the response says so. The `revalidate` was a *correct* change to make; it just silently cost a network round-trip in a file the author never opened.

The fix is not "keep the two objects in sync". Keeping two literals byte-identical across a codebase's lifetime is a convention, and conventions decay. The fix is to make there be only one literal:

```ts
// lib/products.ts — the only place these options exist
const API = process.env.PRODUCT_API_URL!

export async function getProduct(id: string) {
  const res = await fetch(`${API}/products/${id}`, {
    next: { tags: [`product-${id}`], revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`)
  return res.json() as Promise<Product>
}
```

```tsx
// app/products/[id]/layout.tsx
import { getProduct } from '@/lib/products'

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
      <Breadcrumb category={product.category} name={product.name} />
      {children}
    </div>
  )
}
```

```tsx
// app/products/[id]/page.tsx — same call, one network request across both files
import { getProduct } from '@/lib/products'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)
  return <ProductView product={product} />
}
```

Two components, two `await`s, one request. The identity requirement has become structural — you cannot drift the options apart without editing the one file that has them.

## The lifetime: one render pass, then gone

The memo table is created and discarded per server render. It does not survive to the next request, is not shared between two users, and does not persist across a page load. Next.js states the equivalent rule for `React.cache` explicitly — each request gets its own memoization scope, with no sharing between requests — and React states that it invalidates the cache for all memoized functions on each server request.

Three consequences that catch people:

- **It is not a cross-request optimisation.** If two users load the same page one second apart, memoization does nothing for the second one. That is the Data Cache's job, and it is opt-in. A team that "relies on memoization" for load reduction has no caching at all.
- **It cannot go stale.** There is no invalidation API because there is no window in which the data could change under you. Everything in one render pass sees one consistent snapshot — which is a real correctness property, not just a saving. Two components rendering the same order total will never disagree.
- **It memoizes failures too.** The memo table stores the *result of the call*, not "a successful result". React documents this explicitly for `React.cache()`; for `fetch` memoization the documentation does not spell it out, but it follows from every matching call site receiving the same result. If the first call in a render returns a `503`, every other call site in that render gets the `503` — which is what you want (one render, one truth) but means a retry-on-error wrapper placed *outside* the memoized call retries nothing.

The structural consequences of all this — why co-locating fetches beats prop drilling, and how one misplaced `await` serialises an entire route — are [01h](01h-parallel-and-sequential-fetching-and-the-shape-of-a-route.md).

## Opting one call out

Pass an `AbortController` signal, and the request is not memoized:

```ts
export async function raceTwoMirrors(path: string) {
  const primary = new AbortController()
  const secondary = new AbortController()

  const result = await Promise.any([
    fetch(`${PRIMARY}${path}`, { signal: primary.signal }),
    fetch(`${SECONDARY}${path}`, { signal: secondary.signal }),
  ])

  primary.abort()
  secondary.abort()
  return result.json()
}
```

This is rarely the right tool. The usual reasons for wanting the network hit twice — retrying, racing mirrors, reading either side of a mutation — are better expressed as requests that genuinely differ, and two different URLs dedupe apart anyway. Reach for the signal when you need the *same* request to actually go twice in one render, and cannot make the two calls differ.

## The four places it does not reach

1. **Route Handlers.** Documented not to apply, because a `route.ts` file is not part of the React component tree — there is no render pass for the memo table to belong to. Memoize it yourself with `React.cache()` around the loader, or call it once and pass the value. See [01d](01d-route-handlers-and-their-caching-model.md).
2. **Anything that is not `fetch`.** A Prisma call, a Drizzle query, a `better-sqlite3` statement, an S3 SDK call, a Redis `GET`. Next.js patched `fetch`; it did not patch your ORM. That is what [`React.cache()`](01g-react-cache-connection-and-non-fetch-memoization.md) is for.
3. **`POST`, `PUT`, `PATCH`, `DELETE`.** By design.
4. **Client Components.** There is no server render pass on the client. Data fetched in the browser is deduplicated by SWR or TanStack Query or nothing at all — see [14](14-client-side-data-fetching-and-when-it-is-still-correct.md).

## Gotchas

**★ Symptom: the same URL appears twice in your upstream's access log for one page render, and you "know" memoization is on.** Cause: the two call sites do not pass identical options — the commonest pair is one with `next: { tags }` and one that also sets `revalidate`. Memoization keys on URL *and* options, so these are two different requests. Fix: one exported loader, imported by both call sites, so the options literal exists once.

```ts
// lib/products.ts
export async function getProduct(id: string) {
  const res = await fetch(`${API}/products/${id}`, {
    next: { tags: [`product-${id}`], revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`product ${id}: ${res.status}`)
  return res.json()
}
```

**★ Symptom: you call `revalidateTag()` to "clear the duplicate fetch" and nothing changes.** Cause: you are invalidating the Data Cache, and the duplication is at the memoization layer, which has no tags and no invalidation API. The two layers share a URL and nothing else. Fix: there is nothing to invalidate — make the two calls identical, per the gotcha above. If you also want cross-request caching, that is a *separate* decision expressed on the same call.

**★ Symptom: memoization "does not work" inside `app/api/.../route.ts`.** Cause: Route Handlers are not part of the React component tree, and the documentation states memoization does not apply there. Fix: wrap the loader in `React.cache()` yourself — it is scoped to the request, which is what you wanted.

```ts
// app/api/report/route.ts
import { cache } from 'react'

const getSettings = cache(async (orgId: string) => {
  const res = await fetch(`${API}/orgs/${orgId}/settings`)
  if (!res.ok) throw new Error(`settings ${orgId}: ${res.status}`)
  return res.json()
})

export async function GET(request: Request) {
  const orgId = new URL(request.url).searchParams.get('org')!
  const [settings, alsoSettings] = await Promise.all([
    getSettings(orgId),
    getSettings(orgId), // memoized by React.cache, not by Next.js
  ])
  return Response.json({ ...settings, ...alsoSettings })
}
```

**★ Symptom: two components read the same Prisma model and you see two `SELECT`s.** Cause: memoization is a `fetch` feature. Nothing in Next.js knows your ORM issued a query. Fix: `React.cache()` around the query function — the mechanism, its argument-identity rule and its traps are [01g](01g-react-cache-connection-and-non-fetch-memoization.md).

```ts
// lib/queries.ts
import { cache } from 'react'
import { db } from '@/lib/db'

export const getOrg = cache((orgId: string) => db.org.findUnique({ where: { id: orgId } }))
```

**Symptom: a `POST` that two components fire in one render goes twice, and you expected one.** Cause: memoization is `GET`-only, deliberately. Fix: do not mutate during render. Writes belong in a Server Action ([01b](01b-server-actions-and-mutations.md)) or a Route Handler; a render pass that mutates will also re-run under React's concurrent rendering, which is a worse bug than the duplicate.

**Symptom: your retry wrapper never retries, and every component in the render sees the same `503`.** Cause: memoization stores the result of the first call, error responses included, and every later call site in that render gets the same object back. Fix: retry *inside* the memoized boundary, so the memo table holds the outcome of the whole retry sequence rather than the first failure.

```ts
// lib/http.ts — the retry happens inside the function that is memoized
export async function getWithRetry(url: string, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (res.ok) return res.json()
    if (res.status < 500) throw new Error(`${url}: ${res.status}`)
    await new Promise((r) => setTimeout(r, 2 ** i * 100))
  }
  throw new Error(`${url}: exhausted ${attempts} attempts`)
}
```

**Symptom: you build a URL with an object and deduplication stops working intermittently.** Cause: query-string order. `new URLSearchParams(obj)` follows the object's key order, and an object assembled conditionally in two places can produce `?a=1&b=2` in one and `?b=2&a=1` in the other. Different strings, different requests. Fix: sort the params where the URL is built, once.

```ts
export function buildUrl(base: string, params: Record<string, string>) {
  const search = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  )
  return `${base}?${search}`
}
```

**Symptom: two users see each other's data and someone blames memoization.** Cause: it is not memoization — the memo table is per render pass and cannot leak across requests. Look at the Data Cache instead: `cache: 'force-cache'` will cache any request, explicitly including ones sending `authorization` or `cookie` headers. Fix: never `force-cache` a per-user request; cache the shared resource and fetch the personal one with `cache: 'no-store'`. The full version of this gotcha is on [the overview](01-explanation.md).

**Symptom: you add `signal` to a fetch for timeout handling and your request count doubles.** Cause: passing an `AbortController` signal is the documented way to opt *out* of memoization; it is not a neutral option. Fix: if you want a timeout without losing deduplication, put the timeout inside the memoized loader and let one call site own it, or accept the duplicate knowingly.

```ts
import { cache } from 'react'

// One AbortController per render, created inside the memoized function.
export const getFeed = cache(async (id: string) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${API}/feed/${id}`, { signal: controller.signal })
    return res.json()
  } finally {
    clearTimeout(timer)
  }
})
```

**Symptom: deduplication works in the page but not in `generateMetadata`.** Cause: check first whether the two calls are actually identical — `generateMetadata` usually needs a smaller projection and someone gave it a different URL or different options. Both `generateMetadata` and the page render in the same request, so an identical `GET` should memoize; a different one never will. Fix: call the same exported loader from both, and select the fields you need afterwards rather than asking the API for a narrower payload.

## Interview questions

**★ Request memoization and the Data Cache both prevent a second network call. Why are they two separate mechanisms?**
Different scope, key, owner and purpose. Memoization is React's, lives for a single server render pass, applies only to `GET`, keys on URL plus options, has no invalidation API, and exists so a component tree can fetch what it needs where it needs it instead of prop drilling. The Data Cache is the framework's, lives across requests, keys on URL, method, headers and body, stores only `200` responses, and is invalidated by tags, paths or time. Memoization is a composition affordance. The Data Cache is a cost and latency decision. They stack: three memoized call sites produce one Data Cache lookup, and that lookup may or may not produce a network call.

**★ Two components fetch the same URL. One passes `next: { tags: ['p'] }`, the other passes `next: { tags: ['p'], revalidate: 3600 }`. How many network requests?**
Two. Memoization requires identical URL *and* options, and the options differ. Nothing warns you — no build error, no dev-server log, no runtime error. This is the single most common reason someone believes deduplication is broken. The structural fix is a single exported loader; keeping two options literals identical across a codebase's lifetime is a convention, and conventions decay the first time someone adds ISR to one route.

**★ Why is memoization `GET`-only?**
Because deduplicating a request with side effects would change program behaviour, not just performance. If two components each `POST` an event, the caller is entitled to two events. React cannot know which `POST`s are idempotent, so it memoizes none of them. The corollary is a design rule: if you find yourself wanting a memoized `POST`, you are mutating during render, and renders can re-run.

**★ Does memoization help the second user who loads the same page?**
No, and this is where teams discover they have no caching at all. The memo table is created and destroyed within one server render. A second request gets a fresh one. Cross-request reuse is the Data Cache, and since Next.js 15 that is opt-in — an unannotated `fetch` does not populate it. A team that "relies on memoization" for load reduction is relying on a mechanism whose lifetime is measured in milliseconds.

**Your upstream sees one request but two different components render different values from it. Is that possible?**
Not from memoization. Within a render pass, every call site that matched the memo key receives the same result object, so they cannot disagree about the data. If two components show different values, either the calls were not identical (two requests, two moments in time), or one component is deriving the value differently, or one is a Client Component reading from a client-side cache that was hydrated earlier. That last case is the usual answer and the reason to check which side of the boundary each component is on.

**A `fetch` in your render returns a 503. What does every other call site in that render see?**
The same 503. Memoization stores the outcome of the call, not only successes, and there is no revalidation within a pass. This is deliberate — one render sees one consistent view of the world — but it means a retry wrapper only works if the retry loop is *inside* the memoized function. A wrapper that catches the error at the call site and calls the loader again gets the memoized failure straight back.

**How do you deduplicate a database query rather than a `fetch`?**
`React.cache()` from the `react` package, applied once at module scope to the query function, and then imported wherever the value is needed. It is React's own memoization primitive, scoped to the request, and it is what Next.js's `fetch` memoization is conceptually an instance of. Its argument-comparison rule — shallow equality by `Object.is` — is where it goes wrong in practice, because an object argument constructed at each call site never hits.

**When would you deliberately opt a fetch out of memoization, and how?**
Pass an `AbortController` signal. Legitimate cases are narrow: racing two mirrors of the same path, or deliberately reading a resource twice around some other work within one render. Most apparent needs are better served by making the requests genuinely different, since different URLs dedupe apart for free. The trap runs the other way too — people add a `signal` purely for a timeout and are surprised that their request count doubles.

---

← [Overview: fetch and its caches](01-explanation.md) · Next → [01g · `React.cache()`, `connection()` and non-fetch memoization](01g-react-cache-connection-and-non-fetch-memoization.md)
