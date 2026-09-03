---
sidebar_position: 3
title: "ISR at enterprise level: stale-while-revalidate tuning."
sidebar_label: "ISR at enterprise level: stale-while-revalidate tuning."
description: "ISR at enterprise level: stale-while-revalidate tuning."
---

# ▲ ISR at enterprise level: stale-while-revalidate tuning.

> **Syllabus chapter:** 6. SSG, ISR, and SSR Strategy  
> **Exact concept:** ISR at enterprise level: stale-while-revalidate tuning.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

`next build` performs several distinct phases in sequence, and understanding each is what makes ISR's behavior (and its occasional surprises) predictable rather than mysterious.

```
next build
        │
        ├── 1. Compile: TypeScript/JSX → JS, bundling, minification (via the Rust-based compiler, SWC)
        │
        ├── 2. Collect Page Data: run generateStaticParams()/getStaticPaths() to enumerate every
        │       static path that needs pre-rendering
        │
        ├── 3. Prerender: execute each static route's Server Components/getStaticProps,
        │       producing HTML + an RSC payload PER ROUTE, cached as the Full Route Cache's initial contents
        │
        └── 4. Generate Route Manifest: a map of every route → its rendering strategy
              (static / dynamic / ISR-revalidate-after-N-seconds), used by the server at runtime
              to know how to handle each incoming request without re-deriving this per-request
```

### Incremental Static Regeneration (ISR): Revalidating Without a Full Rebuild
ISR lets individually static pages refresh **after deployment**, without requiring `next build` to run again for the whole site — either time-based (`revalidate: N` — the next request after N seconds triggers a background regeneration, serving the *stale* version to that request while the fresh one computes, then serving fresh to subsequent requests) or on-demand (`revalidateTag`/`revalidatePath`, called from a Server Action or a webhook-triggered Route Handler, purging a specific cached entry immediately rather than waiting for its time window).

### `fallback` Behavior for Paths Not Known at Build Time
A path not included in `generateStaticParams()`'s returned list isn't necessarily a 404 — depending on configuration, Next.js can generate it **on first request** (`fallback: 'blocking'` in Pages Router terms — the App Router equivalent handles this automatically for dynamic segments not statically enumerated), caching the result for every subsequent request to that same path, effectively lazily expanding the set of pre-rendered pages post-deploy.

---
