---
sidebar_position: 2
title: "Nested layouts, parallel routes (`@slot`), intercepting routes, route groups."
sidebar_label: "Nested layouts, parallel routes (`@slot`), intercepting routes, route groups."
description: "Nested layouts, parallel routes (`@slot`), intercepting routes, route groups."
---

# ▲ Nested layouts, parallel routes (`@slot`), intercepting routes, route groups.

> **Syllabus chapter:** 2. Routing and Navigation  
> **Exact concept:** Nested layouts, parallel routes (`@slot`), intercepting routes, route groups.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

Beyond static folder-per-segment routing, the App Router supports several bracket-syntax conventions that each solve a genuinely different composition problem.

```
app/
  blog/[slug]/page.tsx           ──► /blog/hello-world  → params.slug = 'hello-world'
  shop/[...slug]/page.tsx          ──► /shop/a/b/c        → params.slug = ['a','b','c']
  docs/[[...slug]]/page.tsx          ──► /docs AND /docs/a/b → params.slug = undefined | ['a','b']
  (marketing)/about/page.tsx           ──► /about (group folder invisible in the URL)
  dashboard/@analytics/page.tsx          ──► rendered in the `analytics` PARALLEL SLOT of dashboard/layout.tsx
  feed/(.)photo/[id]/page.tsx              ──► INTERCEPTS /photo/[id] when navigated to FROM within feed/
```

### Dynamic Segments: `[id]` vs `[...slug]` vs `[[...slug]]`
- `[id]` matches **exactly one** path segment.
- `[...slug]` (catch-all) matches **one or more** segments, exposed as an array — but does **not** match the base route itself (`/shop` alone would 404 against `shop/[...slug]/page.tsx`).
- `[[...slug]]` (optional catch-all) additionally matches the base route, with `params.slug` being `undefined` in that case — the only variant of the three that makes the segment itself optional.

### Route Groups `(name)`: Organization Without URL Impact
Parentheses-wrapped folder names are stripped from the resulting URL entirely — `app/(marketing)/about/page.tsx` still serves `/about`. This exists purely to let large route trees be organized by team/feature/rendering-strategy in the filesystem (e.g. grouping all marketing pages under one shared layout) without that organization leaking into the public URL structure.

### Parallel Routes `@slot`: Multiple Independent Pages, One Layout
A layout can accept **named slots** (`@analytics`, `@team`) as props, each independently rendered — critically, each slot has its **own** loading/error boundaries and its own independent navigation state, meaning one slot can be mid-navigation (showing a loading state) while a sibling slot stays fully interactive. This is the mechanism behind dashboards showing multiple independently-loading widgets in one layout.

### Intercepting Routes `(.)`/`(..)`: Modal-Over-Feed Pattern
`(.)folder` intercepts a route **only when navigated to via client-side navigation from within the current layout level** — a direct hard navigation (page refresh, or a bookmarked URL) to that same path instead renders the **actual, non-intercepted** page. This is precisely the mechanism behind "click a photo in a feed, it opens as a modal over the feed; refresh the page at that same URL, get the full standalone photo page instead" — a single pattern that's genuinely hard to replicate outside a framework with first-class support for it.

---
