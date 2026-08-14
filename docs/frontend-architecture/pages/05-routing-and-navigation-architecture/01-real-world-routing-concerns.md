---
title: "Routing & Navigation Architecture: Nested Layouts, Code Splitting & Auth Gates"
sidebar_label: "Routing & Navigation Architecture"
sidebar_position: 1
---

# 🏛️ Routing & Navigation Architecture: Nested Layouts, Code Splitting & Auth Gates

## 1. The Decision Framework

Routing decisions determine both user-perceived performance (what loads when) and correctness (who can see what) — several recurring real-world concerns beyond "which router library."

```
Nested Layouts:
  /dashboard/settings and /dashboard/billing SHARE a sidebar/nav chrome
  ── the shared chrome should NOT remount (losing scroll position, animation state)
     when navigating BETWEEN dashboard sub-routes — only the CHANGED segment should update

Auth-gated routes — TWO guard strategies, different tradeoffs:
  Redirect-on-mount: render the route, CHECK auth in an effect, redirect if unauthorized
    ── risk: a BRIEF FLASH of protected content before the redirect fires
  Middleware-level: check auth BEFORE the route ever renders (e.g. Next.js middleware)
    ── no flash, but adds latency to EVERY matched request, even already-authorized ones

Deep linking / URL as state:
  Encoding filters/pagination/tabs in searchParams (?status=active&page=2) means that
  STATE survives a refresh, is shareable via a copied URL, and works with browser back/forward —
  vs the same state living only in React state, invisible to the URL and lost on refresh
```

### Route-Based Code Splitting: The Default, Highest-Leverage Boundary
Splitting a bundle at route boundaries (each route's code loads only when navigated to) is almost always the single biggest bundle-size win relative to implementation effort — most routing libraries/frameworks support this close to automatically (dynamic `import()` per route), and it should be the default splitting strategy before reaching for more granular, higher-effort component-level splitting.

### The Flash-of-Unauthenticated-Content Problem
Client-side, redirect-on-mount auth guards inherently render the protected route's initial state (however briefly) before the auth check's effect runs and redirects — for content where even a brief flash is unacceptable (sensitive data, a jarring layout shift before redirect), middleware/server-level gating (checking auth before ANY protected content is ever sent to the client) is the only approach that fully eliminates this, at the cost of adding a check to every matched request's latency.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Dashboard's Sidebar Losing Scroll Position on Every Navigation, Fixed by Correct Layout Nesting.
A dashboard's sidebar (containing a long, scrollable navigation tree) reset its scroll position and re-triggered its mount animation every single time a user navigated between dashboard sub-pages — because the routing structure rendered the sidebar as part of EACH individual page component, rather than as a shared, persistent layout wrapping them. Restructuring to a proper nested layout (the sidebar living in a parent layout component that wraps `{children}`, with only the child route segment actually changing between navigations — the exact mechanism covered in the Next.js routing fundamentals doc) meant the sidebar genuinely persisted across navigations — scroll position, any expanded/collapsed tree state, all preserved, with only the actual page content area updating.

---

## 3. Reference Implementation

```tsx
// Nested layout — shared chrome persists, only the child segment changes
// app/dashboard/layout.tsx (Next.js App Router)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar /> {/* persists across /dashboard/settings ⇄ /dashboard/billing navigation */}
      <main>{children}</main>
    </div>
  );
}
```

```tsx
// Auth gating — middleware-level, avoiding any flash of protected content
// middleware.ts
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dashboard') && !hasValidSession(request)) {
    return NextResponse.redirect(new URL('/login', request.url)); // redirected BEFORE any dashboard content is sent
  }
}
```

```tsx
// URL as state — filters survive refresh, are shareable, and work with browser back/forward
function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1');

  return (
    <div>
      <FilterTabs value={status} onChange={(s) => setSearchParams({ status: s, page: '1' })} />
      <ProductGrid status={status} page={page} />
      {/* the URL itself (?status=active&page=2) IS the source of truth — refreshing preserves it */}
    </div>
  );
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Client-Side-Only Auth Guards for Genuinely Sensitive Content
Relying solely on a redirect-on-mount client-side check for content where even a brief flash is unacceptable (financial data, admin-only actions) is a real security/UX gap — a determined user (or a screen-recording bug report) can capture that brief flash. For genuinely sensitive routes, gate at the middleware/server level, not just client-side.

### ⚠️ Anti-Pattern 2: Storing Filter/Pagination State Only in React State, Never the URL
State living only in `useState` means refreshing the page loses all filters, a user can't share a "here's the exact filtered view I'm looking at" link with a colleague, and browser back/forward doesn't correctly step through filter changes — for anything a user might reasonably want to bookmark, share, or navigate back through, URL-encoded state (`searchParams`) is the correct default, not local component state.

### ⚠️ Anti-Pattern 3: Component-Level Code Splitting Before Exhausting Route-Level Splitting
Reaching for granular, component-level `React.lazy()` splitting throughout a codebase before first ensuring every ROUTE is already split (the highest-leverage, lowest-effort boundary) often produces marginal gains for real implementation complexity — audit route-level splitting coverage first; component-level splitting is worth the added complexity specifically for genuinely heavy, rarely-used features (a rich text editor, a charting library) within an already route-split page, not as a first-resort optimization.
