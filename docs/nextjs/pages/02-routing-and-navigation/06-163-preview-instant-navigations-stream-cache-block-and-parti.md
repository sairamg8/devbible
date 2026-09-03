---
sidebar_position: 6
title: "**[16.3 Preview]** Instant Navigations (Stream / Cache / Block) and Partial Prefetching"
sidebar_label: "**[16.3 Preview]** Instant Navigations (Stream / Cache / Block) and Partial Prefetching"
description: "**[16.3 Preview]** Instant Navigations (Stream / Cache / Block) and Partial Prefetching — client-cached route shells."
---

# ▲ **[16.3 Preview]** Instant Navigations (Stream / Cache / Block) and Partial Prefetching

> **Syllabus chapter:** 2. Routing and Navigation  
> **Exact concept:** **[16.3 Preview]** Instant Navigations (Stream / Cache / Block) and Partial Prefetching — client-cached route shells.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

The App Router maps a **folder hierarchy** in `app/` directly to URL segments, with a small set of reserved filenames each contributing a specific, composable role to that segment's rendered output — not one monolithic "page component" per route, but a **layered composition**.

```
app/dashboard/
  layout.tsx     ──► persists across navigations WITHIN dashboard/*, wraps children
  template.tsx    ──► same wrapping role as layout, but REMOUNTS on every navigation
  loading.tsx      ──► auto Suspense fallback, shown while page.tsx's async work is pending
  error.tsx          ──► auto Error Boundary, catches errors thrown by page.tsx/children
  not-found.tsx        ──► rendered on notFound() call, or an unmatched nested segment
  page.tsx               ──► the actual routable UI for /dashboard
  route.ts                 ──► API endpoint for /dashboard — MUTUALLY EXCLUSIVE with page.tsx in the same segment
```

### Composition Order
For a request to `/dashboard`, Next.js composes (conceptually): `layout.tsx( loading.tsx-wrapped-Suspense( error.tsx-wrapped-ErrorBoundary( page.tsx ) ) )`. This nesting is why `loading.tsx` and `error.tsx` are **automatic** — you don't manually wrap `<Suspense>`/error boundaries around each page; the file's mere presence in the segment wires it in.

### `layout.tsx` vs `template.tsx`: State Persistence vs Remounting
Both wrap child segments identically in terms of position in the tree, but `layout.tsx` **persists** its own React state and DOM across sibling navigations within it (e.g. a sidebar's scroll position survives clicking between dashboard sub-pages), while `template.tsx` **remounts entirely** on every navigation — appropriate specifically when you want fresh state or a re-triggered enter animation on every single navigation, even between visually similar pages.

### `error.tsx` Must Be a Client Component
Error boundaries fundamentally require a class component's `componentDidCatch` lifecycle (or React's error boundary primitives), which only exist in the client runtime — `error.tsx` always requires `'use client'` at the top, and receives `error` and a `reset()` function (to attempt re-rendering the segment without a full page reload) as props.

### `route.ts` Cannot Coexist With `page.tsx` in the Same Segment
A segment is either a **page** (returns JSX/HTML) or a **Route Handler** (returns an HTTP `Response`, functioning as an API endpoint) — never both, since both would compete to define what a request to that exact path returns.

---
