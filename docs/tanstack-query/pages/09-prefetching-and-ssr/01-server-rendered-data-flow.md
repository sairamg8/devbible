---
title: "Prefetching & SSR: `prefetchQuery()`, `dehydrate()`/`HydrationBoundary` & Next.js Integration"
sidebar_label: "Prefetching & SSR"
sidebar_position: 1
---

# 🔄 Prefetching & SSR: `prefetchQuery()`, `dehydrate()`/`HydrationBoundary` & Next.js Integration

## 1. Under-The-Hood Mechanics

Prefetching populates the cache **ahead of** when a component actually needs it — on hover, on route transition, or on the server before any HTML is sent — turning what would otherwise be a client-side loading spinner into data that's already there the instant a component mounts.

```
prefetchQuery({ queryKey, queryFn })
        │
        ▼
Populates the cache with the result, WITHOUT subscribing any component to it —
a plain "warm the cache ahead of time" operation, distinct from useQuery's
subscribe-and-render behavior

Server-Side Rendering flow:
  SERVER: queryClient.prefetchQuery(...) ──► dehydrate(queryClient) ──► serialize cache state to JSON
        │
        ▼ (sent to the browser as part of the initial HTML/payload)
  CLIENT: <HydrationBoundary state={dehydratedState}>  ──► REHYDRATES that serialized cache
        │                                                    state into the client's QueryClient
        ▼
  useQuery({ queryKey, queryFn }) on the client ──► finds data ALREADY in the cache from
                                                        hydration — renders INSTANTLY, no loading state,
                                                        even though this is the client's FIRST render
```

### `dehydrate()`/`HydrationBoundary`: Bridging Server and Client Caches
A server-rendered page's `QueryClient` instance and the browser's client-side `QueryClient` instance are genuinely separate objects (different processes entirely) — `dehydrate()` serializes the server's cache contents into a plain, JSON-transportable object; `HydrationBoundary` on the client reads that serialized state and merges it into the client's own cache, **before** any component's `useQuery` call runs — meaning the client's very first render already has the data, avoiding a redundant client-side refetch of data the server already fetched.

### Next.js Integration: Prefetching in Server Components, Hydrating in Client Hooks
In a Next.js App Router setup, a Server Component prefetches data (calling the actual data-fetching logic directly, or via `prefetchQuery`), wraps its children in `HydrationBoundary`, and a Client Component further down the tree calls `useQuery` with the **identical** `queryKey` — TanStack Query recognizes the match and serves the already-hydrated data immediately, with the Client Component's hook still providing all its usual reactive behavior (refetching, mutations, cache updates) for everything that happens *after* that initial hydrated render.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Product Page Showing Data Instantly on First Load, With Zero Client-Side Loading Spinner.
A product page needed to avoid the jarring "server-rendered HTML shows a loading spinner, then a moment later client-side JS fetches and replaces it with real data" pattern — a genuine double-fetch (once implicitly via SSR's own render, once again client-side) and a visible flash of loading state on every page load. Prefetching the product data server-side (in a Server Component), dehydrating that cache state into the initial HTML payload, and rehydrating it client-side via `HydrationBoundary` meant the client's `useQuery` call found the data **already present** in cache the instant it mounted — no loading spinner ever appeared, and no redundant client-side fetch occurred, since the data was already there from hydration.

---

## 3. Production-Grade Code Example

```tsx
// app/products/[id]/page.tsx — Next.js Server Component: prefetch + dehydrate
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ProductDetail } from './ProductDetail'; // a Client Component, below

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });

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

  if (isLoading) return <Spinner />; // in practice, NEVER shown — data is already hydrated on first render
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
        queryClient.prefetchQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) });
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
