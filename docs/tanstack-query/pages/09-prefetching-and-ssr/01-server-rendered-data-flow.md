---
title: "Prefetching & SSR: `queryClient.query()`, `dehydrate()`/`HydrationBoundary` & Next.js Integration"
sidebar_label: "Prefetching & SSR"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the TanStack Query docs — [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Prefetching & SSR: `queryClient.query()`, `dehydrate()`/`HydrationBoundary` & Next.js Integration

## 1. Under-The-Hood Mechanics

Prefetching populates the cache **ahead of** when a component actually needs it — on hover, on route transition, or on the server before any HTML is sent — turning what would otherwise be a client-side loading spinner into data that's already there the instant a component mounts.

```
queryClient.query({ queryKey, queryFn })
        │
        ▼
Populates the cache with the result, WITHOUT subscribing any component to it —
a plain "warm the cache ahead of time" operation, distinct from useQuery's
subscribe-and-render behavior. It also RESOLVES with the data, and REJECTS if
the queryFn throws — so a prefetch that must not break the render needs a catch

Server-Side Rendering flow:
  SERVER: queryClient.query(...) ──► dehydrate(queryClient) ──► serialize cache state to JSON
        │
        ▼ (sent to the browser as part of the initial HTML/payload)
  CLIENT: <HydrationBoundary state={dehydratedState}>  ──► REHYDRATES that serialized cache
        │                                                    state into the client's QueryClient
        ▼
  useQuery({ queryKey, queryFn }) on the client ──► finds data ALREADY in the cache from
                                                        hydration — renders INSTANTLY, no loading state,
                                                        even though this is the client's FIRST render
```

### 🔴 The method is `query()`, not `prefetchQuery()`

`queryClient.prefetchQuery()` is **deprecated**. The prefetching guide is explicit:

> *"These tips replace the use of the now deprecated `prefetchQuery` and `ensureQueryData` methods."*
> — [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)

> *"those methods will be removed in the next major version of TanStack Query"*

The replacement is named in the same guide — *"Prefetching a query uses the `query` method."* — and
`prefetchQuery` no longer appears in the
[`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) at all.

**The behavioural difference is the part that bites.** `prefetchQuery` swallowed errors; `query()`
does not. The reference describes it as *"an asynchronous method that can be used to fetch and cache a
query. It will either resolve with the data or throw with an error."* So an `await`ed prefetch in a
Server Component will **fail the render** on a backend hiccup unless you catch. The Advanced SSR guide's
own example does exactly that:

```tsx
await queryClient
  .query({
    queryKey: ['posts'],
    queryFn: getPosts,
  })
  .catch(noop)
```

### `dehydrate()`/`HydrationBoundary`: Bridging Server and Client Caches
A server-rendered page's `QueryClient` instance and the browser's client-side `QueryClient` instance are genuinely separate objects (different processes entirely) — `dehydrate()` serializes the server's cache contents into a plain, JSON-transportable object; `HydrationBoundary` on the client reads that serialized state and merges it into the client's own cache, **before** any component's `useQuery` call runs — meaning the client's very first render already has the data, avoiding a redundant client-side refetch of data the server already fetched.

### Next.js Integration: Prefetching in Server Components, Hydrating in Client Hooks
In a Next.js App Router setup, a Server Component prefetches data (calling the actual data-fetching logic directly, or via `queryClient.query()`), wraps its children in `HydrationBoundary`, and a Client Component further down the tree calls `useQuery` with the **identical** `queryKey` — TanStack Query recognizes the match and serves the already-hydrated data immediately, with the Client Component's hook still providing all its usual reactive behavior (refetching, mutations, cache updates) for everything that happens *after* that initial hydrated render.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Product Page Showing Data Instantly on First Load, With Zero Client-Side Loading Spinner.
A product page needed to avoid the jarring "server-rendered HTML shows a loading spinner, then a moment later client-side JS fetches and replaces it with real data" pattern — a genuine double-fetch (once implicitly via SSR's own render, once again client-side) and a visible flash of loading state on every page load. Prefetching the product data server-side (in a Server Component), dehydrating that cache state into the initial HTML payload, and rehydrating it client-side via `HydrationBoundary` meant the client's `useQuery` call found the data **already present** in cache the instant it mounted — no loading spinner ever appeared. 🔴 **The second half of that win has to be bought separately.** Hydrated data arrives `stale` under the default `staleTime: 0`, and a stale query refetches when a new instance mounts, so the spinner disappears but the redundant request does not — the Advanced SSR guide is explicit that *"With SSR, we usually want to set some default `staleTime` above 0 to avoid refetching immediately on the client"*. Setting it on the `QueryClient` defaults is what turns "no flash" into "no second fetch".

---

## 3. Production-Grade Code Example

```tsx
// app/products/[id]/page.tsx — Next.js Server Component: prefetch + dehydrate
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ProductDetail } from './ProductDetail'; // a Client Component, below

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 🔴 staleTime > 0 is what stops the client refetching this the instant it hydrates.
  // At the default of 0 the hydrated data is already stale, and mounting is a refetch trigger.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  });

  await queryClient
    .query({
      queryKey: ['product', id],
      queryFn: () => fetchProduct(id),
    })
    // `query()` REJECTS on failure — without this, one flaky API call fails the whole page render.
    // The client's useQuery below will simply fetch it itself if nothing was hydrated.
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductDetail productId={id} />
    </HydrationBoundary>
  );
}
```

```tsx
// ProductDetail.tsx — Client Component: SAME queryKey, finds data already hydrated
'use client';
import { useQuery } from '@tanstack/react-query';

export function ProductDetail({ productId }: { productId: string }) {
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId], // MUST exactly match the server's prefetch queryKey
    queryFn: () => fetchProduct(productId),
  });

  if (isLoading) return <Spinner />; // not shown on the hydrated path — the data is in cache on first render
  return <ProductView product={product} />;
}
```

```tsx
// Hover-based prefetching — warming the cache BEFORE a user actually navigates
function ProductLink({ productId, children }: { productId: string; children: React.ReactNode }) {
  const queryClient = useQueryClient();

  return (
    <Link
      href={`/products/${productId}`}
      onMouseEnter={() => {
        queryClient
          .query({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) })
          .catch(() => {}); // speculative work must never surface an error to the user
      }}
    >
      {children}
    </Link>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Mismatched `queryKey` Between Server Prefetch and Client `useQuery`
```tsx
// ❌ WRONG: even a SLIGHT difference in the queryKey structure means the client's useQuery
// looks for a DIFFERENT cache entry than what was hydrated — the prefetch was WASTED, and
// the client refetches from scratch anyway, defeating the entire purpose of SSR prefetching
// Server: queryKey: ['product', id]
// Client: queryKey: ['products', id]  ← different key ('products' vs 'product') — NO match

// ✅ CORRECT: the queryKey must be BYTE-FOR-BYTE identical between server prefetch and client useQuery
```

### ⚠️ Pitfall 2: Creating a Single, Shared `QueryClient` for SSR Across Multiple Requests
```typescript
// ❌ DANGEROUS: a module-level QueryClient shared across SSR requests leaks one user's
// prefetched/cached data into another user's response — a genuine data-leak risk in a
// concurrent server environment (exactly the same class of bug covered in the Redux Toolkit
// SSR store-per-request pitfall)
const queryClient = new QueryClient(); // module scope — SHARED across all incoming requests

// ✅ CORRECT: create a FRESH QueryClient per server request/render
export default async function ProductPage() {
  const queryClient = new QueryClient(); // fresh, request-scoped instance
}
```

### ⚠️ Pitfall 3: Prefetching Data the Client-Side Component Never Actually Uses
Prefetching (server-side or hover-based) has a real cost — an actual network request/database query is performed whether or not the data ends up being used. Prefetching data for a route/component that the user might not even navigate to (over-eager hover-prefetching every link on a page, regardless of likelihood) wastes server/database resources for speculative work that may never pay off — reserve prefetching for genuinely high-likelihood navigation targets, not blanket coverage of every possible link.

---

## Gotchas

**★ 🔴 Hydration without a `staleTime` removes the spinner and keeps the second fetch.** This is the
single most common way an SSR setup half-works. The data arrives in the client cache, so the first
render has it and no loading state appears — and then, because Important Defaults says queries *"by
default consider cached data as stale"* and stale queries refetch when *"new instances of the query
mount"*, the very act of mounting the client component fires the request the server render was
supposed to save. The Advanced SSR guide names the fix directly: *"With SSR, we usually want to set
some default `staleTime` above 0 to avoid refetching immediately on the client."* Set it on the
`QueryClient` defaults, not on individual hooks, or you will miss one.

**★ `query()` throws where `prefetchQuery` swallowed.** The reference calls it *"an asynchronous
method that can be used to fetch and cache a query. It will either resolve with the data or throw
with an error."* A mechanical rename of `prefetchQuery` to `query` therefore converts a backend
hiccup from "the page renders and the client fetches it" into "the Server Component render fails".
The docs' own example ends `.catch(noop)` for exactly this reason. Prefetching is speculative work;
speculative work must never be able to fail the thing it was meant to accelerate.

**★ One `QueryClient` shared across requests leaks one user's data to another.** *"Server: always
make a new query client"* is a security boundary, not a performance note. A module-scope client on a
long-lived Node server accumulates every request's cache under keys like `['user', 'me']`, and the
next request dehydrates whatever is sitting there into a different user's HTML. It survives every
local test, because a dev server usually has one user.

**★ The `queryKey` has to match exactly, and nothing tells you when it does not.** The server writes
under one key and the client reads under another; a mismatch is not an error, it is a cache miss, so
the page simply falls back to fetching client-side and looks like hydration "not working". `['product', id]` where `id` is a number on the server and a string from the router on the client is a
different key — keys are *"hashed deterministically"* and *"Array item order matters!"*. A shared key
factory imported by both sides removes the entire class.

**★ `HydrationBoundary` is a Client Component.** The guide states it plainly: *"HydrationBoundary is
a Client Component, so hydration will happen there."* So the dehydrated state crosses the boundary as
a serialized prop and must survive that serialization — anything in your cached data that is not
JSON-representable (a `Date`, a `Map`, a class instance, `undefined` inside an object) does not
arrive on the other side as what it left as.

**★ Dehydrating everything ships it to the browser.** `dehydrate(queryClient)` serializes the whole
cache into the HTML payload, so a Server Component that prefetched six queries to decide which two to
render has just put all six in the document. Prefetch what the tree below actually observes; the rest
is page weight you pay on every request.

**★ Prefetching data nothing subscribes to is garbage collected in five minutes.** An entry with no
observer is inactive from the moment it lands, and inactive queries are collected on `gcTime`, which
defaults to five minutes. Hover-prefetch is worth it because the click is seconds away; "warm the
cache at login" is not a strategy.

## Interview questions

**★ You added SSR prefetching and the network tab still shows the request. What did you miss?**
Almost certainly `staleTime`. Hydration puts the data in the cache, but at the default `staleTime: 0`
it is stale on arrival, and mounting a new observer of a stale query is one of the three documented
refetch triggers. The visible symptom is misleading — the spinner is gone, because `data` is present
on first render, so the page looks correct and only the network tab disagrees. Raise the default
`staleTime` on the `QueryClient` you build for the request; the guide recommends exactly that for SSR.

**★ Why does the server need its own `QueryClient` per request?**
Because a `QueryClient` is a cache, and on the server a cache shared across requests is a cache
shared across users. *"Server: always make a new query client."* On the client the opposite is true —
one long-lived client is the whole point, since sharing between components is what deduplicates
requests. The asymmetry catches people who lift the client to module scope to "avoid recreating it",
which is correct in the browser and a data-leak on the server.

**★ What actually crosses the network between `dehydrate` and `HydrationBoundary`?**
A plain JSON-serializable snapshot of the cache — keys, data and the metadata needed to reconstruct
the entries — embedded in the HTML payload and passed as a prop to `HydrationBoundary`, which *"is a
Client Component, so hydration will happen there."* Two consequences follow. Anything not
JSON-representable degrades in transit, so a `Date` arrives as a string. And everything in the cache
goes, not just what is rendered, so an over-eager prefetch is measurable page weight.

**★ You renamed `prefetchQuery` to `query` and now a flaky API takes the whole page down. Why?**
Because the two have different failure semantics, and that is the part the rename hides.
`prefetchQuery` resolved regardless; `query` *"will either resolve with the data or throw with an
error"*. In a Server Component an unhandled rejection from an awaited call fails the render, so an
optimisation became a hard dependency on the backend being up. The guide's own snippet ends
`.catch(noop)`, and that is not defensive clutter — it is what keeps the prefetch speculative.

**★ Hydration is not working for one component but is for its sibling. Where do you look first?**
The key, before anything else. A mismatch produces a cache miss, not an error, so nothing is logged
and the component simply behaves as though there was no SSR at all. Compare the server's `queryKey`
and the client's element by element, watching for a type difference — a route param arriving as a
string on one side and a number on the other hashes differently. If both sides import the same key
factory this cannot happen, which is the real argument for key factories over inline arrays.

**★ When is prefetching the wrong tool?**
When the data is not going to be observed soon, or at all. A prefetched entry has no observer, so it
is inactive immediately and eligible for garbage collection at `gcTime` — five minutes by default —
and until then it is memory and payload for nothing. Hover-prefetch works because the gap between
intent and navigation is a second or two. Prefetching an entire nav tree on load spends bandwidth and
server capacity on paths most users never take, and on the server it also inflates every dehydrated
payload.
