---
sidebar_position: 1
title: "Fetch in Server Components: automatic request deduplication, `React.cache()` for non-fetch memoiz…"
sidebar_label: "Fetch in Server Components: automatic request deduplication, `React.cache()` for non-fetch memoiz…"
description: "Fetch in Server Components: automatic request deduplication, `React.cache()` for non-fetch memoization."
---

# ▲ Fetch in Server Components: automatic request deduplication, `React.cache()` for non-fetch memoiz…

> **Syllabus chapter:** 4. Data Fetching in the App Router  
> **Exact concept:** Fetch in Server Components: automatic request deduplication, `React.cache()` for non-fetch memoization.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

Next.js patches the global `fetch()` inside Server Components with extra, Next-specific options that hook directly into its caching architecture (see [caching architecture](../05-caching-ppr-and-cache-components/01-explanation.md)) — the same web-standard `fetch()` call, with semantics no other framework's `fetch` carries.

```typescript
fetch(url, {
  cache: 'force-cache' | 'no-store',     // opt into a cached response vs always-fresh, per-request data
  next: {
    revalidate: 3600,                       // time-based ISR — re-fetch in the background after N seconds
    tags: ['product-123'],                    // on-demand invalidation via revalidateTag('product-123')
  },
})
```

> **Next.js 15+ default changed:** `fetch()` requests are **uncached by default** (`no-store`-equivalent semantics) — this is a reversal of the Next 13/14 behavior, where `fetch()` was cached (`force-cache`) unless told otherwise. On Next 15+, caching is now something you **opt into** explicitly via `cache: 'force-cache'` or `next: { revalidate: ... }` (setting `revalidate` also opts a request into the Data Cache). Code written against pre-15 tutorials that assumes bare `fetch()` calls are cached will silently become fully dynamic on upgrade.

### Request Memoization: Automatic, Per-Render Deduplication
If the **exact same** `fetch()` call (same URL + options) is made from multiple components during a single render pass (e.g. both a layout and a nested page independently need the current user's profile), Next.js automatically deduplicates them into a **single** actual network request — this is why fetching the same data from multiple places in the component tree isn't a performance anti-pattern the way it would be in a client-only app; it's specifically designed to be safe.

### `generateStaticParams()`: Build-Time Path Pre-Rendering
The App Router's replacement for `getStaticPaths` — an exported async function returning an array of param objects, each one causing Next.js to pre-render that specific dynamic route at build time (e.g. every product ID known at build time gets its own static HTML page generated upfront).

### Parallel vs Sequential Fetching
```typescript
// Sequential (a waterfall) — the SECOND fetch cannot start until the FIRST resolves
const user = await getUser(id);
const posts = await getPostsByUser(user.id); // must wait for `user` first — INTENTIONAL here

// Parallel — BOTH fetches start immediately, total time ≈ max(fetchA, fetchB), not sum
const [user, settings] = await Promise.all([getUser(id), getSettings(id)]); // independent data
```
The distinction matters because an accidental sequential waterfall (awaiting one fetch before even *starting* an unrelated second one) doubles latency for data that never actually depended on each other.

---
