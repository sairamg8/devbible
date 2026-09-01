---
title: "The loading state and announcements"
sidebar_label: "09 · Loading and announcements"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *ARIA live regions*, *`aria-busy`*, MDN *`clip-path`*,
> and the WAI-ARIA Authoring Practices on status messages. Composes
> [chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md), whose
> state machine decides when this state is on screen. No sandbox, no console
> output.

[Chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md) already
renders three things besides the cards:

```jsx
{status === 'error' && <ErrorPanel onRetry={loadMore} />}
{hasMore && <div ref={sentinelRef} aria-hidden="true" />}
{status === 'loading' && items.length === 0 && <GridSkeleton />}
```

The React chapter decided *when* each appears. This chunk decides what the
loading state looks like and, more importantly, **what it must not do to the
layout.**

The construction of the skeleton itself — the shimmer, its timing, when a
spinner beats a skeleton — is [chapter 04 · Skeleton loaders and spinners](../04-skeletons-and-spinners/README.md). What belongs here is the one requirement the grid imposes
on it.

## The skeleton must have the grid's geometry

A skeleton exists to stop the page moving. A skeleton whose cards are a
different size from the real cards **causes the shift it was added to
prevent** — the user sees a stable placeholder, then everything jumps as real
content replaces it. That is worse than no skeleton, because it spends the
user's patience and then moves the page anyway.

The only reliable way to guarantee parity is to not have two geometries:

```jsx
<ul className="product-grid" role="list" aria-busy="true">
  {Array.from({length: 8}, (_, i) => <SkeletonCard key={i} />)}
</ul>
```

```css
@layer components {
  /* the skeleton card reuses the real card's box, not a copy of it */
  .product-card--skeleton .product-card__media { background: var(--surface-3); }
  .product-card--skeleton .product-card__name  { min-block-size: 2lh; }
}
```

The skeleton renders **inside the same `.product-grid`** and reuses
`.product-card`'s own class for its box, so the track sizing, the gap, the
aspect ratio and the clamp height are the same *rules* — not the same values
written twice. A modifier class changes only the fill.

`2lh` is two line-heights of the element's own font, which is the height the
clamped name will occupy — a unit that stays correct when the type scale
changes, unlike a hard-coded `2.6rem`.

⚠️ **The most common skeleton bug is a duplicated stylesheet.** Someone writes
`.skeleton-grid` with its own `grid-template-columns`, it drifts from
`.product-grid` by one gap value six months later, and the shift returns with no
obvious cause and no failing test. **Reuse the class; do not copy the
declarations.**

**How many skeleton cards?** You cannot know the column count — that is the
entire point of `auto-fill` — so pick a number that fills a typical first screen
(eight is a reasonable default) and let the grid wrap them. Rendering "exactly
one row" is impossible by construction, and any attempt to compute it in
JavaScript reintroduces the coupling the intrinsic grid removed.

## Announcing what changed

An infinite list is the hardest thing on the site for a screen-reader user:
content appears with no interaction and no notification. Nothing about the
visual design communicates it, so it has to be said explicitly.

```jsx
<ul className="product-grid" role="list" aria-busy={status === 'loading'}>…</ul>

<p role="status" className="visually-hidden">
  {status === 'loading' ? 'Loading products' : `Showing ${items.length} products`}
</p>
```

- **`aria-busy`** on the grid tells assistive technology the region is mid-update,
  so it can wait rather than announcing a half-built list.
- **`role="status"`** is a polite live region: it announces when its content
  changes, without interrupting whatever the user is currently reading. That is
  the correct politeness for "24 more products loaded" — the user did not ask
  for it, so it must not cut across them.
- **A visually-hidden class**, never `display: none`.

```css
@layer utilities {
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

An element hidden with `display: none` or `visibility: hidden` is removed from
the accessibility tree and announces nothing at all. The utility above keeps it
rendered and in the tree while taking it out of the visual layout — which is
exactly the distinction the live region needs.

⚠️ **A live region must exist in the DOM *before* its content changes.**
Rendering the whole `<p role="status">` only once loading starts means the
region is created and populated in the same update, and many screen readers
announce nothing. **Render the element always; change only its text.** This is
the single most common reason a correctly-marked live region is silent.

## The sentinel

```css
@layer components {
  .catalog__sentinel { block-size: 1px; }
}
```

The sentinel is an observation target, not a visual element. Two rules about it
that are easy to get wrong from the CSS side:

- **It must not be `display: none`.** An element with no box is never
  intersected, so the observer never fires and the list silently stops loading
  more. A 1 px box is the standard shape.
- **It is `aria-hidden="true"`** in the Phase 4 markup, which is correct — it
  carries no information for anyone, and announcing it would be noise.

## Gotchas

- **Symptom:** the skeleton looks stable, then everything jumps when real
  products arrive. **Cause:** the skeleton has its own grid rules, which have
  drifted from the real grid's. **Fix:** render the skeleton inside the same
  `.product-grid` and reuse `.product-card` for its box — share the rules, not
  the values.

- **Symptom:** the skeleton's name placeholder is the wrong height after a type
  scale change. **Cause:** the placeholder height was hard-coded in `rem` while
  the real name's height derives from its line height. **Fix:** `2lh`, which
  tracks the element's own typography.

- **Symptom:** a screen reader announces nothing when more products load.
  **Cause:** the live region was rendered at the same moment its content
  appeared, so there was no region to observe a change in. **Fix:** render the
  element unconditionally and change only its text.

- **Symptom:** the status message is hidden with `display: none` and never
  announced. **Cause:** `display: none` and `visibility: hidden` remove the
  element from the accessibility tree entirely. **Fix:** the visually-hidden
  utility.

- **Symptom:** the visually-hidden text still causes a horizontal scrollbar.
  **Cause:** an older clip technique, or `white-space: nowrap` on an
  unpositioned element letting a long string extend the page.
  **Fix:** the element must be `position: absolute` so it is out of flow, with
  `clip-path: inset(50%)` doing the hiding.

- **Symptom:** the screen reader interrupts the user constantly while
  scrolling. **Cause:** `role="alert"` or `aria-live="assertive"` on the
  loading status. **Fix:** `role="status"` — polite is correct for anything the
  user did not explicitly request.

- **Symptom:** assistive technology reads out a partially-built list mid-fetch.
  **Cause:** no `aria-busy` on the region being updated. **Fix:** set it while
  the request is in flight and clear it when the items land.

- **Symptom:** infinite scroll stops working and no request is ever made.
  **Cause:** the sentinel has no box — `display: none`, or a zero-size element
  inside a collapsed container — so it can never intersect the viewport.
  **Fix:** give it a real, if tiny, block size.

- **Symptom:** the skeleton flashes for a few milliseconds on a fast connection
  and looks like a glitch. **Cause:** it is shown unconditionally the moment a
  request starts. **Fix:** this is a timing decision, not a styling one, and it
  belongs to the skeleton chapter — but the grid's contract is unaffected
  either way, which is the point of keeping the geometry in one place.

- **Symptom:** the skeleton count was computed from the viewport width in
  JavaScript so it would fill exactly one row. **Cause:** trying to recover a
  number the intrinsic grid deliberately does not expose. **Fix:** a fixed
  count that comfortably fills a screen — the coupling is not worth the
  precision, and it breaks the moment the grid is placed in a narrower
  container.

## Interview questions

1. **★ A skeleton loader is supposed to prevent layout shift. How can it cause
   one?** By having a different geometry from the content it stands in for — a
   different column count, gap, aspect ratio or text height. The user sees a
   stable placeholder and then a jump as real content replaces it, which is
   worse than no skeleton at all. The fix is structural: render the skeleton
   through the same grid and card classes so there is only one geometry to keep
   correct.

2. **★ Why must a live region exist in the DOM before its content changes?**
   Because screen readers announce *changes* within an observed region. If the
   region and its content are created in the same update there is no prior state
   to diff against, and many implementations announce nothing. Render the
   container unconditionally and change only its text.

3. **★ `role="status"` or `role="alert"` for "24 more products loaded"?**
   `role="status"` — it is polite, so it waits for a natural pause rather than
   interrupting. The content appeared without the user asking for it, so cutting
   across them to say so is exactly the wrong trade. `alert` is for things that
   genuinely cannot wait, such as a failed submission.

4. **★ Why not `display: none` for a visually hidden status message?** Because
   it removes the element from the accessibility tree, so there is nothing left
   to announce. Visually-hidden styling keeps the element rendered and in the
   tree while taking it out of the visual layout, which is precisely the
   distinction a live region needs.

5. **What does `aria-busy` add that a live region does not?** It marks a region
   as mid-update, so assistive technology can hold off rather than reading a
   list that is still being built. The live region says *what* changed;
   `aria-busy` says *not yet*.

6. **How many skeleton cards should an intrinsic grid render, and why can't you
   compute it?** Enough to fill a typical first screen — around eight — because
   the column count is the output of the track-sizing algorithm and is not
   available at render time. Computing it in JavaScript reintroduces exactly the
   viewport coupling the intrinsic grid removed, and breaks when the grid is
   placed in a narrower container.

7. **What breaks if the infinite-scroll sentinel is `display: none`?**
   Everything downstream of it: an element with no box is never intersected, so
   the observer never fires and the list simply stops loading more. It fails
   silently with no error, which is what makes it memorable the first time.

8. **Why `2lh` rather than a `rem` value for a text placeholder's height?**
   Because the placeholder is standing in for two lines of a specific element's
   text, and `lh` is that element's own line height. A `rem` value encodes the
   same number at one point in time and silently desynchronises the first time
   the type scale moves.

9. **How do you keep a skeleton and its real component from drifting apart?**
   By not duplicating the rules: the skeleton renders inside the same container
   and reuses the component's own classes, with a modifier changing only the
   fill. Any approach where both have their own geometry is correct on the day
   it ships and wrong later, with no test to catch the drift.

---

← Prev [The price row and row alignment](08-the-price-row-and-row-alignment.md) ·
Next → [Empty, end and error states](10-empty-end-and-error-states.md)
