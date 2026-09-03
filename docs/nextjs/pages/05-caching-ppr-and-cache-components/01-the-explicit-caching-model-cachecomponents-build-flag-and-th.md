---
sidebar_position: 1
title: "The explicit caching model: `cacheComponents` build flag and the philosophy shift from implicit t…"
sidebar_label: "The explicit caching model: `cacheComponents` build flag and the philosophy shift from implicit t…"
description: "The explicit caching model: `cacheComponents` build flag and the philosophy shift from implicit to declared caching."
---

# ▲ The explicit caching model: `cacheComponents` build flag and the philosophy shift from implicit t…

> **Syllabus chapter:** 5. Caching, PPR, and Cache Components  
> **Exact concept:** The explicit caching model: `cacheComponents` build flag and the philosophy shift from implicit to declared caching.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

Next.js's caching is frequently the single most misunderstood part of the framework precisely because it operates as **four distinct, independently-invalidated layers** — a bug is often "the wrong layer was invalidated," not "caching is broken."

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request Memoization  — per-render, in-memory, React cache()   │
│    Scope: ONE server render pass. Deduplicates identical fetch()  │
│    calls made by different components during the SAME request.     │
├─────────────────────────────────────────────────────────────────┤
│ 2. Data Cache            — persistent, cross-request, cross-deploy  │
│    Scope: EVERY request, forever, until revalidated. This is what    │
│    `fetch(url, { next: { revalidate, tags } })` actually controls.     │
├─────────────────────────────────────────────────────────────────┤
│ 3. Full Route Cache      — static HTML + RSC payload, per ROUTE       │
│    Scope: the rendered OUTPUT of a route, generated at build/ISR time. │
│    Depends on the Data Cache underneath it, but caches the FINAL        │
│    rendered result, not just the raw fetched data.                       │
├─────────────────────────────────────────────────────────────────┤
│ 4. Router Cache (Client) — in-browser, per SESSION                       │
│    Scope: visited/prefetched RSC payloads cached in the browser's         │
│    memory for instant back/forward navigation — NOT invalidated by         │
│    server-side revalidatePath/revalidateTag automatically.                   │
└─────────────────────────────────────────────────────────────────┘
```

### Why Four Layers, Not One
Each layer solves a genuinely different problem: (1) avoids redundant network calls **within** one render; (2) avoids redundant network calls **across** requests/time; (3) avoids redundant **rendering work** (not just fetching) for a whole route; (4) avoids redundant **network round-trips to the server at all** for a client that already has the data from a recent visit. Invalidating layer 2 (a `revalidateTag` call) does not automatically invalidate layer 4 (the client's already-cached Router Cache entry) — this exact gap is the single most common "why isn't my data updating" production question in App Router codebases.

### Layer 4 Specifically: The Router Cache's Own Invalidation Rules
The client Router Cache persists visited-route RSC payloads for a default duration (30 seconds for dynamic segments, 5 minutes for static ones, as of recent Next.js versions) **regardless** of server-side revalidation — a `router.refresh()` call (or a full page reload) is what forces the client to discard its own cached payload and re-request fresh RSC output from the server.

---
