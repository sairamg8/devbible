---
title: "CLS Optimization: Reserved Space, Font Loading & Safe DOM Insertion"
sidebar_label: "CLS Optimization"
sidebar_position: 1
---

# 🚀 CLS Optimization: Reserved Space, Font Loading & Safe DOM Insertion

## 1. Under-The-Hood Mechanics

A layout shift is scored whenever a visible element's start position changes between two rendered frames, **without** being the direct result of a user interaction in the preceding 500ms. The score for a single shift is `impact fraction × distance fraction` — a large element shifting a small distance and a small element shifting a large distance can score similarly, which is why CLS is genuinely about *any* unexpected movement, not just "big" ones.

```
Frame N:   [Header] [Text block at y=200px] [Ad slot: 0px tall, not yet loaded]
                                                        │
                                             Ad content loads, ad slot becomes 250px tall
                                                        ▼
Frame N+1: [Header] [Text block PUSHED to y=450px] [Ad slot: 250px tall]
                            │
                    This 250px shift of visible content = a CLS-scored layout shift
```

### Why Explicit Dimensions Prevent This Entirely
When an `<img>`/`<video>`/`<iframe>` has explicit `width`/`height` attributes (or a CSS `aspect-ratio`), the browser can reserve the correct box size in the layout **before** the actual media has downloaded — nothing needs to shift once it arrives, because the space was already correctly allocated from the very first layout pass.

### Font Loading & FOIT/FOUT
`font-display: swap` shows fallback-font text immediately, then swaps to the webfont once loaded — avoiding FOIT (Flash of Invisible Text, where nothing renders until the font arrives) but introducing its own CLS risk if the fallback and web font have meaningfully different metrics (different average character width shifts surrounding layout when the swap happens). `font-display: optional` avoids this shift risk entirely by only using the webfont if it's *already* cached/loaded fast enough, otherwise permanently sticking with the fallback for that page view — trading a rare font-swap visual for eliminating layout shift risk.

### Reserving Space for Dynamically-Injected Content
Ad slots, cookie banners, and "you might also like" widgets injected after initial layout are among the most common real-world CLS sources precisely because their final size is often unknown until their own async content resolves — reserving a `min-height` matching the expected/average size (even if occasionally imperfect) converts an unpredictable shift into either zero shift or a much smaller one.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Blog's CLS Score Cratering After Adding a Third-Party Ad Network.
A content site's CLS was comfortably under 0.05 before integrating a programmatic ad network. Post-integration, CLS spiked to 0.35 — well into "poor" — because ad slots rendered as `0px` height placeholders until the ad network's own async script resolved and injected creative content of varying, unpredictable sizes, pushing all subsequent page content down each time. Setting an explicit `min-height` on every ad slot container (sized to the ad network's most common creative dimension) capped the shift to only the rare cases where an unusually-sized ad loaded, bringing CLS back under 0.1 without waiting on or renegotiating anything with the ad network itself.

---

## 3. Production-Grade Code Example

```html
<!-- Explicit dimensions reserve space BEFORE the image loads — zero shift regardless of load timing -->
<img src="/article-hero.avif" width="1200" height="630" alt="Article hero" />

<!-- aspect-ratio achieves the same effect for responsive/fluid-width images -->
<style>
  .hero-image { width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; }
</style>
```

```css
/* Font loading strategy — swap for readability, but only after acknowledging the shift tradeoff */
@font-face {
  font-family: 'Acme Sans';
  src: url('/fonts/acme-sans.woff2') format('woff2');
  font-display: swap;
  /* size-adjust / ascent-override / descent-override narrow the fallback-vs-webfont metric gap,
     reducing the visual shift magnitude when the swap actually happens */
  size-adjust: 98%;
}
```

```tsx
// AdSlot.tsx — reserving space for asynchronously-injected third-party content
function AdSlot({ slotId }: { slotId: string }) {
  return (
    <div
      id={slotId}
      style={{ minHeight: 250, minWidth: 300 }} // reserved BEFORE the ad network's script ever runs
      className="ad-slot-container"
    />
  );
}
```

```tsx
// Avoiding layout-affecting insertions ABOVE existing content
function NotificationBanner({ message }: { message: string | null }) {
  // ❌ Would push all page content down unexpectedly when a notification appears mid-session
  // ✅ Instead: render as a fixed-position overlay, never participating in document flow at all
  if (!message) return null;
  return <div className="fixed top-4 right-4 z-50 shadow-lg">{message}</div>;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Percentage-Only Sizing Without `aspect-ratio`
```css
/* ❌ WRONG: width:100% alone tells the browser nothing about HEIGHT until the image itself loads
and reports its natural dimensions — the reserved box is effectively 0px tall until then */
img { width: 100%; }

/* ✅ CORRECT: aspect-ratio lets the browser compute and reserve the correct height immediately,
even for a fluid-width image whose exact pixel width isn't known until layout */
img { width: 100%; aspect-ratio: 16 / 9; }
```

### ⚠️ Pitfall 2: Injecting a Cookie Consent Banner That Pushes Content Instead of Overlaying It
A banner inserted at the top of the document flow (rather than as a fixed/absolute-positioned overlay) shifts every element below it downward the instant it appears — extremely common in production CLS complaints, since consent banners by regulatory necessity often can't be pre-rendered before user-consent logic evaluates. Fixed-position overlays sidestep this category of shift entirely, since overlay elements don't participate in document flow.

### ⚠️ Pitfall 3: Assuming `font-display: swap` Has Zero Cost
Teams sometimes treat `font-display: swap` as a strictly-better default over `optional` without checking the actual metric mismatch between the fallback font and the webfont — a large mismatch (e.g. a very wide fallback vs. a narrow display webfont) can cause a visually jarring, CLS-scored reflow across an entire paragraph the moment the swap occurs, especially on slow connections where the swap happens well after initial paint (giving the user more time to have started reading the pre-swap layout).
