---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 2 overview"
---

# ▲ Routing and Navigation

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  



> **Source:** current-project backup remapped + improved for exact syllabus title

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
Error boundaries fundamentally require a class component's `componentDidCatch` lifecycle (or React's error boundary primitives), which only exist in the client runtime — `error.tsx` always requires `'use client'` at the top, and receives `error` plus two recovery functions as props: `retry()`, which re-fetches *and* re-renders the segment, and `reset()`, which re-renders it without re-fetching. `retry()` is the one to reach for — see [09 · `error.js` props](../07-error-handling-loading-states-and-resilience/09-errorjs-props-retry-and-reset.md).

### `route.ts` Cannot Coexist With `page.tsx` in the Same Segment
A segment is either a **page** (returns JSX/HTML) or a **Route Handler** (returns an HTTP `Response`, functioning as an API endpoint) — never both, since both would compete to define what a request to that exact path returns.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Multi-Tab Dashboard Where Sidebar State Must Survive Tab Switches, But a Wizard Flow Must Reset Fully Between Steps.
The main dashboard shell (persistent sidebar navigation, a "currently expanded" state in a tree view) uses `layout.tsx` — switching between `/dashboard/reports` and `/dashboard/settings` keeps the sidebar's expanded/collapsed state and scroll position intact, since the layout never remounts. A separate onboarding wizard at `/onboarding/[step]` uses `template.tsx` instead — each step should visually reset (fade-in animation replaying, any local form step-state cleared) even though steps share the same wrapping chrome, which `template.tsx`'s remount-per-navigation behavior provides for free.

---

## 3. Production-Grade Code Example

```tsx
// app/dashboard/layout.tsx — persists sidebar state across dashboard navigations
'use client';
import { useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true); // survives navigating between dashboard pages
  return (
    <div className="flex">
      <Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded((v) => !v)} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

```tsx
// app/dashboard/loading.tsx — automatic Suspense fallback while page.tsx's async data resolves
export default function DashboardLoading() {
  return <div className="animate-pulse p-6">Loading dashboard…</div>;
}
```

```tsx
// app/dashboard/error.tsx — automatic error boundary; MUST be a Client Component
'use client';

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="p-6 text-rose-400">
      <p>Something went wrong loading the dashboard.</p>
      <button onClick={() => retry()} className="mt-2 px-3 py-1 bg-slate-800 rounded text-xs">
        Try again
      </button>
    </div>
  );
}
```

```tsx
// app/dashboard/page.tsx — the actual routed UI; async Server Component
async function getDashboardData() {
  const res = await fetch('https://api.acme.com/dashboard');
  if (!res.ok) throw new Error('Failed to load dashboard'); // caught by error.tsx above
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
```

```typescript
// app/dashboard/route.ts — would CONFLICT if placed alongside page.tsx above in the same segment
// (shown here as if in a DIFFERENT segment, e.g. app/api/dashboard/route.ts)
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Placing `route.ts` and `page.tsx` in the Same Segment
```
❌ WRONG — Next.js throws a build error: "You cannot have two parallel pages that resolve to the same path"
app/products/page.tsx
app/products/route.ts

✅ CORRECT — separate the API endpoint into its own path
app/products/page.tsx
app/api/products/route.ts
```

### ⚠️ Pitfall 2: Forgetting `error.tsx` Only Catches Errors in Its Own Segment and Below
An error thrown inside `layout.tsx` itself is **not** caught by that same segment's `error.tsx` — a layout's error must be caught by the **nearest parent** segment's `error.tsx` (or `global-error.tsx` at the root). Placing critical data-fetching logic inside a layout rather than its child page can leave errors uncaught by the boundary an engineer assumed was protecting it.

### ⚠️ Pitfall 3: Expecting `template.tsx` to Behave Like `layout.tsx` for Expensive Children
Because `template.tsx` remounts on every navigation, any expensive child work (a heavy chart re-initializing, a WebSocket reconnecting) inside a template re-executes on every single route change within it — using `template.tsx` where `layout.tsx`'s persistence was actually needed causes visible flicker and wasted re-initialization work that a plain `layout.tsx` would have avoided entirely.

---

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

## 2. Real-World Engineering Scenario

**Scenario**: A Social Feed Where Clicking a Photo Opens a Modal, But Sharing the Direct Link Shows a Full Page.
Clicking a photo thumbnail in `/feed` should open a modal overlay (preserving the feed scroll position underneath) — but a user pasting that same photo's URL into a new tab should see a full standalone photo page with related content, not a broken modal with no feed behind it. An intercepting route (`app/feed/(.)photo/[id]/page.tsx`, rendered into a parallel `@modal` slot) handles the client-navigation case as a modal; the same `/photo/[id]` URL hit via direct navigation instead resolves to the plain `app/photo/[id]/page.tsx` — one URL, two entirely different rendering outcomes depending on navigation origin, exactly matching the product requirement.

---

## 3. Production-Grade Code Example

```tsx
// app/feed/layout.tsx — declaring the parallel @modal slot alongside the default feed content
export default function FeedLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode; // the @modal slot's content — null when no intercepted route is active
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

```tsx
// app/feed/@modal/(.)photo/[id]/page.tsx — intercepts /photo/[id] ONLY when navigated to from within /feed
'use client';
import { useRouter } from 'next/navigation';

export default function PhotoModal({ params }: { params: { id: string } }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center" onClick={() => router.back()}>
      <PhotoDetail id={params.id} />
    </div>
  );
}
```

```tsx
// app/photo/[id]/page.tsx — the FULL standalone page, served on direct navigation/hard refresh
export default function PhotoPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <PhotoDetail id={params.id} />
      <RelatedPhotos currentId={params.id} />
    </div>
  );
}
```

```tsx
// app/feed/@modal/default.tsx — REQUIRED: fallback for the slot on a hard navigation elsewhere in /feed
export default function Default() {
  return null; // no modal content on initial/hard navigation into /feed itself
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `default.tsx` for a Parallel Route Slot
```
❌ WRONG: without app/feed/@modal/default.tsx, a HARD navigation/refresh while a modal-intercepted
route's URL is active throws a 404 for the @modal slot specifically, since Next.js has no fallback
UI to render into that slot when the intercepting route itself isn't the one that matched

✅ CORRECT: every parallel slot needs a default.tsx (even just `return null`) as its non-matched fallback
```

### ⚠️ Pitfall 2: Assuming `[...slug]` Matches the Base Route
```tsx
// ❌ WRONG assumption: app/shop/[...slug]/page.tsx does NOT match a bare /shop request — that 404s
// unless a separate app/shop/page.tsx also exists

// ✅ CORRECT: use the OPTIONAL catch-all if the base route should ALSO be handled by the same page
// app/shop/[[...slug]]/page.tsx — params.slug is undefined for /shop, an array for /shop/a/b
```

### ⚠️ Pitfall 3: Route Groups Silently Creating Duplicate/Conflicting Routes
```
❌ WRONG: app/(marketing)/about/page.tsx AND app/(shop)/about/page.tsx both resolve to the exact
same URL /about — Next.js throws a build-time conflict error, but the error message references
the route groups' STRIPPED path, which can be confusing to trace back to which two files collided

✅ CORRECT: route groups organize the FILESYSTEM, not the URL space — always check the final,
group-stripped URL for uniqueness across the whole app/ tree, not just within one group folder
```
