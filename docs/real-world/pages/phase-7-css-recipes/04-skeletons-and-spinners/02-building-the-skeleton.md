---
title: "Building the skeleton"
sidebar_label: "02 · Building the skeleton"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — MDN *`lh`* and *`ch`* units, MDN *`::after`* and generated
> content, MDN *`aria-hidden`*, and the WAI-ARIA Authoring Practices on decorative
> content. Composes
> [topic 01 chunk 09](../01-the-product-grid/09-the-loading-state-and-announcements.md),
> which established the geometry rule this chunk implements. No sandbox, no
> console output.

[Topic 01](../01-the-product-grid/09-the-loading-state-and-announcements.md) set
the constraint: **a skeleton must have the real component's geometry, or it
causes the shift it was added to prevent.** This chunk is how you actually get
that, and the answer is a technique rather than a stylesheet.

## Two ways to build one, and only one of them stays correct

**The version that drifts** — a standalone skeleton component with its own
styles:

```css
/* ⛔ two geometries that must be kept in sync by hand, forever */
.skeleton-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 1.5rem; }
.skeleton-card  { block-size: 22rem; border-radius: 8px; }
```

It is correct on the day it is written. Six months later the real grid's gap
moved to `var(--space-5)`, the card's radius changed, and nothing failed — there
is no test that compares two stylesheets. The shift comes back with no obvious
cause.

**The version that cannot drift** — the skeleton *is* the component, with its
content replaced:

```jsx
<ul className="product-grid" role="list" aria-busy="true">
  {Array.from({length: 8}, (_, i) => (
    <li className="product-card product-card--skeleton" key={i} aria-hidden="true">
      <div className="product-card__inner">
        <div className="product-card__media" />
        <div className="product-card__body">
          <h3 className="product-card__name" />
          <p className="product-card__price-row" />
        </div>
      </div>
    </li>
  ))}
</ul>
```

```css
@layer components {
  .product-card--skeleton :is(
    .product-card__media,
    .product-card__name,
    .product-card__price-row
  ) {
    background-color: var(--surface-3);
    border-radius: var(--radius-1);
  }

  .product-card--skeleton .product-card__name      { min-block-size: 2lh; }
  .product-card--skeleton .product-card__price-row { min-block-size: 1lh; inline-size: 40%; }
  .product-card--skeleton .product-card__buy       { visibility: hidden; }
}
```

**Every geometry rule is inherited, not restated.** The grid's track sizing, the
gap, the card's container query, the media box's `aspect-ratio`, the subgrid row
alignment — all of it applies because these *are* those elements. The modifier
changes only fill and, where an element is empty, gives it a height.

The rule to carry: **a skeleton is the component with its content removed, not a
picture of the component.**

## Sizing empty boxes

An element with no content has no height, so each placeholder needs one — and
the unit matters:

| Placeholder | Rule | Why |
|---|---|---|
| The name | `min-block-size: 2lh` | two line-heights of *that element's own font* — tracks the type scale |
| The price row | `min-block-size: 1lh` | one line, same reasoning |
| The media box | nothing | it already has `aspect-ratio` from the real component |
| The buy button | `visibility: hidden` | it keeps its box, so the row height is unchanged |

`lh` is the load-bearing choice. A hard-coded `2.6rem` encodes today's line
height and silently desynchronises the first time the type scale moves — and
because the skeleton and the real text are then *nearly* the same height, the
resulting shift is a few pixels, which is the hardest kind to notice and the
most annoying to sit with.

`visibility: hidden` for the button rather than `display: none` is the same
principle in another form: it keeps the box, so the card's height is identical
in both states.

⚠️ **`inline-size: 40%` on the price row is the one deliberate lie**, and it is
worth being explicit that it *is* one. A full-width bar where a short price will
be looks wrong, so the placeholder is narrowed for realism. It costs nothing
because the row's *height* — the thing the layout depends on — is unchanged.

## Keep it out of the accessibility tree

```jsx
<li className="product-card product-card--skeleton" aria-hidden="true">
```

A skeleton is decorative: it conveys nothing a screen-reader user can act on,
and without `aria-hidden` they get eight empty list items announced as content.
The *information* — that a load is in progress — comes from `aria-busy` on the
container and the `role="status"` region, both established in
[topic 01 chunk 09](../01-the-product-grid/09-the-loading-state-and-announcements.md).

**Visual users get the skeleton, assistive-technology users get the
announcement, and neither gets the other's version.** That is the correct split,
and it is why the skeleton needs no text alternative.

## How many, and why it is not computable

Eight, or whatever comfortably fills a first screen. The column count is the
output of the track-sizing algorithm and is deliberately not exposed — computing
it in JavaScript to render "exactly one row" reintroduces the viewport coupling
the intrinsic grid removed, and breaks the moment the grid is placed in a
narrower container.

A skeleton is a placeholder, not a prediction. Overshooting slightly is
harmless; the grid simply wraps.

## Gotchas

- **Symptom:** the skeleton looks stable, then everything jumps when real
  content arrives. **Cause:** a standalone skeleton stylesheet that has drifted
  from the component's. **Fix:** render the skeleton *through* the component's
  own classes so there is one geometry, not two.

- **Symptom:** the skeleton's text bars are the wrong height after a typography
  change. **Cause:** heights hard-coded in `rem`. **Fix:** `lh`, which is the
  element's own line height and moves with it.

- **Symptom:** the card is shorter in the skeleton state than when loaded.
  **Cause:** the buy button was hidden with `display: none`, removing its box.
  **Fix:** `visibility: hidden`, which keeps it.

- **Symptom:** a screen reader announces eight empty list items.
  **Cause:** the skeleton cards are in the accessibility tree. **Fix:**
  `aria-hidden="true"` on each, with the real signal coming from `aria-busy` and
  the status region.

- **Symptom:** the skeleton placeholders are invisible in dark mode.
  **Cause:** a hard-coded light grey. **Fix:** a surface token — the placeholder
  is a surface like any other, and **chapter 05 · Dark mode** *(not written
  yet)* owns what it resolves to.

- **Symptom:** the placeholder bars have square corners while the real content
  is rounded, or vice versa. **Cause:** the radius was set on the skeleton
  modifier only. **Fix:** it belongs on the component; the modifier should be
  changing fill, not shape.

- **Symptom:** an empty `<h3>` collapses to zero height despite `min-block-size`.
  **Cause:** the element is a grid or flex item being stretched or shrunk by its
  parent, and the minimum is being resolved against a different axis than
  expected. **Fix:** confirm the writing mode assumption — `min-block-size` is
  the logical form, and in a horizontal writing mode it is height.

- **Symptom:** the skeleton renders but the container query never fires, so the
  cards look wrong. **Cause:** the `__inner` wrapper was omitted from the
  skeleton markup as an "empty div that does nothing". **Fix:** it is part of
  the component's contract — the skeleton needs the same element tree, not just
  the same classes.

- **Symptom:** the price-row placeholder is full width and looks unlike a price.
  **Cause:** no inline size on a bar standing in for short text. **Fix:** narrow
  it. It is a deliberate cosmetic lie, and safe precisely because it does not
  touch the height.

- **Symptom:** two skeletons in the app look subtly different.
  **Cause:** each was built independently. **Fix:** if the technique is "the
  component with content removed", there is nothing to keep consistent — the
  consistency is inherited.

## Interview questions

1. **★ What is the correct way to build a skeleton loader, and why?** Render the
   real component with its content removed and a modifier class that fills the
   empty boxes. Every geometry rule — grid tracks, gaps, aspect ratios,
   container queries, row alignment — is then inherited rather than restated, so
   the skeleton cannot drift from the thing it stands in for. A standalone
   skeleton stylesheet is correct the day it ships and silently wrong later.

2. **★ Why size text placeholders in `lh` rather than `rem`?** Because `lh` is
   the element's own line height, so the placeholder tracks the type scale
   automatically. A `rem` value encodes today's line height and desynchronises
   the first time typography changes — producing a shift of a few pixels, which
   is the hardest kind to notice and the most irritating to live with.

3. **★ Why `visibility: hidden` rather than `display: none` for the button in a
   skeleton?** Because `visibility: hidden` keeps the element's box, so the
   card's height is identical loading and loaded. `display: none` removes the
   box, making the skeleton shorter than the content — which is exactly the
   layout shift the skeleton exists to prevent.

4. **★ Should a skeleton be exposed to screen readers?** No — it is decorative
   and conveys nothing actionable. Mark the skeleton elements `aria-hidden` and
   carry the actual information with `aria-busy` on the container plus a polite
   live region. Visual users get the skeleton, assistive-technology users get
   the announcement, and neither needs the other's version.

5. **How many skeleton items should an intrinsic grid render?** Enough to fill a
   typical first screen, chosen as a constant. The column count is the output of
   the track-sizing algorithm and is not available at render time; computing it
   reintroduces the viewport coupling the intrinsic grid was built to remove,
   and is wrong the moment the grid sits in a narrower container.

6. **Is narrowing a placeholder bar to 40% a problem?** No, and it is worth
   knowing why: it changes the placeholder's inline size, not its height, and
   the layout depends only on the height. It is a deliberate cosmetic
   approximation that buys realism at no structural cost — unlike a height
   approximation, which buys nothing and costs a shift.

7. **What breaks if the skeleton markup omits a wrapper element the component
   has?** Anything that depends on the element tree rather than the class names
   — most sharply, a container query, which needs the container and a descendant
   to target. This is why a component's structural wrappers are contract rather
   than implementation detail.

8. **Why does a skeleton built this way stay consistent across an app with no
   effort?** Because there is no separate skeleton design to keep consistent.
   Each skeleton is its own component wearing a modifier, so consistency is
   inherited from the components already being consistent.

---

← Prev [Skeleton, spinner, or nothing](01-skeleton-spinner-or-nothing.md) ·
Next → [The shimmer and what it costs](03-the-shimmer-and-its-cost.md)
