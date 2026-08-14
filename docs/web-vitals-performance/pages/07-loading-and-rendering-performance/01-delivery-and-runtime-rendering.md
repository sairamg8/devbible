---
title: "Loading & Rendering Performance: Delivery Optimization & Runtime Efficiency"
sidebar_label: "Loading & Rendering Performance"
sidebar_position: 1
---

# 🚀 Loading & Rendering Performance: Delivery Optimization & Runtime Efficiency

## 1. Under-The-Hood Mechanics

Two related but distinct performance domains: **loading performance** (how much code/data must be fetched before the page is usable) and **rendering performance** (how efficiently the browser computes layout/paint once code is running).

### Delivery Optimization
- **Code splitting** — route/component-level `import()` boundaries shrink the initial JS payload to only what the current view needs (see the [Webpack code splitting bible](../../../webpack/pages/07-code-splitting/01-splitting-strategies.md) for the bundler mechanics behind this).
- **Lazy loading** — `loading="lazy"` defers below-the-fold `<img>`/`<iframe>` fetches until they near the viewport; `React.lazy()` does the equivalent for component code.
- **Resource hints** — `<link rel="preconnect">` (DNS + TCP + TLS handshake ahead of time, for a known-needed cross-origin host), `dns-prefetch` (DNS resolution only, a lighter-weight version), `prefetch` (fetch a likely-next-navigation resource during idle time), `preload` (fetch a resource needed for the *current* page, at high priority, right now) — each hint signals a different urgency/certainty level, and using the wrong one either wastes bandwidth (prefetching something rarely needed) or fails to help (preloading something not actually urgent).

### Runtime Rendering Efficiency
- **Layout thrashing** — interleaving DOM reads (`element.offsetHeight`) with DOM writes (`element.style.height = x`) forces the browser to synchronously recompute layout on **every** read, since a prior write could have invalidated it — batching all reads first, then all writes, lets the browser compute layout once per frame instead of once per read/write pair.
- **Virtualization** — rendering only the DOM nodes currently visible in a scrollable list (windowing), regardless of how many thousands of items exist in the underlying data — caps DOM node count, and therefore layout/paint cost, independent of dataset size.
- **`requestAnimationFrame` vs `requestIdleCallback`** — `rAF` schedules work to happen right before the next repaint (for visual updates that must be synchronized with the frame), while `requestIdleCallback` schedules work for whenever the browser has genuinely spare time between frames (for low-priority background work that can tolerate being delayed indefinitely under load).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Social Feed With Thousands of Posts Causing the Tab to Freeze on Scroll.
Rendering all 3,000 loaded posts as real DOM nodes (even ones far off-screen) meant every scroll event triggered layout recalculation across a massive DOM tree, and memory usage climbed unboundedly as more posts loaded. Introducing virtualization (`react-window`) meant only the ~15 posts currently near the viewport ever exist as real DOM nodes at any moment — scrolling stayed smooth regardless of total post count, and memory usage became bounded and predictable instead of growing with the feed.

---

## 3. Production-Grade Code Example

```html
<!-- Resource hints, matched to actual urgency -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="dns-prefetch" href="https://analytics.acme.com" />
<link rel="prefetch" href="/api/likely-next-page-data.json" />
<link rel="preload" as="style" href="/critical.css" />
```

```typescript
// Batched DOM reads/writes — avoiding layout thrashing
function resizeCardsToMatchTallest(cards: HTMLElement[]) {
  // ❌ Interleaved would trigger a synchronous layout recalculation on EVERY iteration
  // ✅ Batch ALL reads first
  const heights = cards.map((card) => card.offsetHeight);
  const maxHeight = Math.max(...heights);

  // THEN batch all writes — one single layout recalculation for the whole batch
  cards.forEach((card) => { card.style.height = `${maxHeight}px`; });
}
```

```tsx
// FeedList.tsx — virtualizing a long list with react-window
import { FixedSizeList } from 'react-window';

function FeedList({ posts }: { posts: Post[] }) {
  return (
    <FixedSizeList height={800} width="100%" itemCount={posts.length} itemSize={220}>
      {({ index, style }) => (
        <div style={style}>
          <PostCard post={posts[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

```typescript
// Scheduling low-priority background work without blocking rendering
function prefetchLikelyNextData() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => fetch('/api/next-page').then(cacheResponse));
  } else {
    setTimeout(() => fetch('/api/next-page').then(cacheResponse), 1); // fallback
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Prefetching Everything "Just in Case"
```html
<!-- ❌ WRONG: prefetching every possible next-page's data/assets regardless of actual navigation
likelihood competes for bandwidth with resources the CURRENT page genuinely needs right now -->
<link rel="prefetch" href="/api/page-2.json" />
<link rel="prefetch" href="/api/page-3.json" />
<link rel="prefetch" href="/rarely-visited-settings.js" />

<!-- ✅ CORRECT: prefetch only genuinely likely next steps (e.g. hover-triggered, or the very next paginated page) -->
<link rel="prefetch" href="/api/page-2.json" />
```

### ⚠️ Pitfall 2: Virtualizing a List That's Already Small
Introducing windowing/virtualization for a list that never exceeds ~30 items adds real implementation complexity (measuring item heights, managing scroll restoration, complicating accessibility/focus management) for negligible performance benefit — virtualization earns its complexity cost specifically at list sizes where unvirtualized DOM node count would genuinely become the bottleneck (typically hundreds+ of items), not preemptively for every list in an app.

### ⚠️ Pitfall 3: Using `requestIdleCallback` for Time-Sensitive Work
`requestIdleCallback`'s callback might not fire for a long time (or at all, under sustained high load, until the deadline parameter forces it) — using it for anything the user is actively waiting on (as opposed to genuinely optional background prefetching/analytics) can make a feature feel broken or unresponsive under load, precisely when performance headroom is scarcest and the work was least appropriate to defer.
