---
title: "Container units, and what containment does to you"
sidebar_label: "04 · Units and containment"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *CSS container queries* (container query length
> units), MDN *CSS containment* and *`contain`* (`layout` containment: containing
> block for positioned descendants, stacking context), and the CSS Containment
> Level 2/3 specifications. Composes
> [CSS 3·02](../../../../css/pages/phase-3-custom-properties/02-clamp-min-max.md),
> [7·01](../../../../css/pages/phase-7-positioning/01-stacking-contexts.md) and
> [7·04](../../../../css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md).
> No sandbox, no console output.

[Chunk 03](03-the-card-adapts-to-its-column.md) added one declaration to the
card. That declaration does considerably more than enable a query, and the rest
of it is the part that shows up later as a bug in a different component.

## Container query units

Inside a query container, `cqi` is 1 % of the container's **inline** size — the
unit that lets a value scale with the card rather than with the screen:

```css
.product-card__name  { font-size: clamp(0.95rem, 0.8rem + 1.2cqi, 1.15rem); }
.product-card__inner { padding: clamp(0.5rem, 3cqi, 1rem); }
```

The card's title grows a little in a wide catalog column and shrinks in the
narrow related-products rail, with no breakpoint at all. `clamp()` is what stops
it becoming absurd at either end — a bare `cqi` value has no floor and no
ceiling, and the rail will happily render 9 px text.

| Unit | Is 1 % of the container's |
|---|---|
| `cqw` / `cqh` | width / height |
| `cqi` / `cqb` | inline size / block size |
| `cqmin` / `cqmax` | the smaller / larger of `cqi` and `cqb` |

**Prefer `cqi` over `cqw`** for the same reason the page shell used
`max-inline-size`: it follows the writing mode, so a vertical or RTL context
does not need a second rule.

⚠️ **`cqi` resolves against the nearest ancestor container, not the element,
and falls back to the small viewport when there is no container ancestor.** A
value meant to scale with a 14 rem rail then scales with a 1440 px window
instead — silently, because the declaration is still perfectly valid CSS. This
is the most confusing failure mode in the feature, because the symptom (text
enormous) looks nothing like the cause (a missing `container-type` two levels
up).

## Layout containment: three consequences you inherit

`container-type: inline-size` applies **layout, style and inline-size
containment**. The inline-size part is the one you asked for. The layout part
arrives whether you wanted it or not, and it does this:

### 1. The card becomes a containing block for positioned descendants

A `position: fixed` element inside the card is now positioned **against the
card**, not the viewport. `position: absolute` descendants resolve against it
too, regardless of whether the card declares `position: relative`.

So a quick-view popover, a tooltip, or an "added to cart" toast rendered
*inside* a `ProductCard` will be laid out relative to a 16 rem box and clipped
by the grid around it. The fix is not CSS — it is to render the overlay
somewhere else in the tree, which is exactly what
[chapter 4·07](../../phase-4-react-ui/07-modal-portal-focus.md) does with
`createPortal` and what [chapter 06 · The overlay layer](../06-the-overlay-layer/README.md)
generalises for this phase.

This is the same shape as the classic clipped-dropdown problem —
[CSS 7·04](../../../../css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md)
— with a new cause. `overflow: hidden` was never the only way to trap a
descendant, and now `container-type` is on the list.

### 2. The card forms a stacking context

Its descendants' `z-index` values become scoped to the card and can no longer
interleave with anything outside it. A card hover state that lifts above its
neighbours must raise the **card**, not a child of the card:

```css
/* ⛔ has no effect outside the card */
.product-card:hover .product-card__inner { z-index: 10; }

/* ✅ raises the whole stacking context */
.product-card:hover { z-index: 1; position: relative; }
```

[CSS 7·01](../../../../css/pages/phase-7-positioning/01-stacking-contexts.md)
is the mechanism; the thing to carry forward is that **`container-type` joins
`transform`, `filter`, `opacity < 1`, `will-change` and `isolation` on the list
of properties that create one by side effect.**

### 3. The card's inline size stops depending on its contents

This is the containment you actually wanted, and it has one visible
consequence: a card can no longer be widened by a long unbreakable string. That
is a *feature* here — it is half of the fix for the min-content blowout in
[chunk 01](01-the-track-sizing-decision.md) — but it means any layout that
relied on shrink-to-fit behaviour inside the card will now behave differently.

## Is it safe to ship?

Container queries and container query units are Baseline widely available —
supported in current Chrome, Edge, Firefox and Safari since 2023. For a
storefront targeting current browsers, no fallback is required. Where a support
matrix demands one, the honest fallback is the **narrow layout as the default**,
with the query only ever *adding* the wide treatment. That is how the rules in
chunk 03 are written: an engine that ignores `@container` entirely renders the
stacked card, which is a correct layout rather than a broken one.

```css
/* if a feature query is genuinely required */
@supports (container-type: inline-size) {
  .product-card { container: card / inline-size; }
}
```

Use `@supports` only when the fallback is *different*, not as decoration — the
mechanism is
[CSS 0·09](../../../../css/pages/phase-0-how-css-runs/09-supports-feature-queries.md).

## Gotchas

- **Symptom:** a `position: fixed` tooltip inside a card is positioned against
  the card instead of the viewport. **Cause:** layout containment from
  `container-type` made the card a containing block for fixed descendants.
  **Fix:** portal the overlay to `document.body`; nothing inside the card can
  undo it.

- **Symptom:** a card's hover-lift state is drawn *under* the next card, and no
  `z-index` on the inner element helps. **Cause:** the card is a stacking
  context, so its descendants' `z-index` is scoped inside it. **Fix:** raise the
  card itself, with `position: relative` so `z-index` applies.

- **Symptom:** `cqi`-based font sizes are wildly too big and scale with the
  browser window. **Cause:** the element has no container ancestor, so `cqi`
  fell back to the small-viewport size. **Fix:** confirm an ancestor really does
  declare `container-type` — the fallback is silent by design and there is no
  console warning.

- **Symptom:** text sized in `cqi` is unreadable in the narrow rail.
  **Cause:** a bare `cqi` value has no floor. **Fix:** always wrap a
  container-relative font size in `clamp()` with a readable minimum; the same
  discipline viewport units needed, for the same reason.

- **Symptom:** the card jitters between two layouts as the window resizes.
  **Cause:** something inside the query changes the container's size, which
  changes whether the query matches. Inline-size containment prevents the
  classic form; when it persists, the real culprit is usually a scrollbar
  appearing and disappearing. **Fix:** `scrollbar-gutter: stable` on the scroll
  container.

- **Symptom:** adding `container-type` to a wrapper broke a `position: sticky`
  child that used to stick to the viewport. **Cause:** sticky resolves against
  its nearest scrolling ancestor and is now constrained by the new containing
  block. **Fix:** the sticky element must live outside the container, or the
  container must not be one — sticky and containment are a genuine conflict, not
  a bug to work around. See
  [CSS 7·03](../../../../css/pages/phase-7-positioning/03-position-sticky.md).

- **Symptom:** `cqh` or `cqb` values are zero. **Cause:** block-axis units need
  the container to have a definite block size, which `container-type:
  inline-size` deliberately does not give it. **Fix:** use inline-axis units, or
  accept `container-type: size` and everything that comes with it.

- **Symptom:** a component works standalone and misbehaves once dropped inside
  the card. **Cause:** it inherited a containing block and a stacking context it
  was not designed for. **Fix:** treat "is this element a query container?" as
  part of a component's public contract — it changes how children position
  themselves, so it is not an implementation detail.

## Interview questions

1. **★ What does `container-type: inline-size` do besides enable queries?** It
   applies layout, style and inline-size containment. Layout containment makes
   the element a containing block for absolutely and fixed positioned
   descendants and forms a stacking context; inline-size containment stops the
   element's inline size depending on its contents. You inherit all three
   whether or not you wanted them.

2. **★ A tooltip inside a card is `position: fixed` and it is being clipped and
   mispositioned. Why, and what fixes it?** The card declares `container-type`,
   which applies layout containment and therefore makes the card a containing
   block even for fixed-position descendants — so "fixed to the viewport" now
   means "fixed to the card". No CSS inside the card undoes that; the overlay
   has to be rendered elsewhere in the tree, typically portalled to the body.

3. **★ What is `cqi` and what is its failure mode?** One percent of the nearest
   ancestor container's inline size. Its failure mode is that with no container
   ancestor it falls back to the small-viewport size, so a value meant to scale
   with a 14 rem rail scales with the window instead — silently, since the
   declaration remains valid.

4. **Why prefer `cqi` to `cqw`?** `cqi` follows the inline axis of the writing
   mode, so it stays correct in vertical writing modes and RTL without a second
   rule; `cqw` hard-codes the physical horizontal axis. Same reasoning as
   `max-inline-size` over `max-width`.

5. **Name the properties that create a stacking context by side effect.**
   `transform`, `filter`, `backdrop-filter`, `opacity` below 1, `will-change`,
   `isolation: isolate`, `mix-blend-mode`, `contain: layout` or `paint` — and,
   since container queries, `container-type` other than `normal`. The pattern
   worth remembering is that anything promising the engine it can lay out or
   paint a subtree independently ends up scoping `z-index` too.

6. **Why must a container-relative font size be clamped?** Because the unit has
   no intrinsic bounds: at 14 rem the value is tiny and at 40 rem it is huge,
   and neither end has a floor or ceiling of its own. `clamp()` supplies the
   minimum that keeps it legible and the maximum that keeps it from dominating.

7. **What is the relationship between `container-type` and `position: sticky`?**
   They conflict. Sticky positioning resolves against a scroll container and is
   constrained by its containing block, and containment introduces a new one —
   so a sticky child of a query container stops behaving as intended. The
   resolution is structural: the sticky element lives outside the container.

8. **Do container queries need a fallback today?** They are Baseline widely
   available across current Chrome, Edge, Firefox and Safari, so for a current
   browser target, no. Where a support matrix demands one, write the narrow
   layout as the unconditional default and let the query only *add* the wide
   treatment — an engine ignoring `@container` then renders a correct layout
   rather than a broken one.

9. **Why is "this element is a query container" part of a component's public
   contract?** Because it changes how every descendant positions itself: fixed
   and absolute children resolve against it, `z-index` is scoped inside it, and
   sticky stops working. A child component that was correct elsewhere can break
   purely by being placed inside it, so the fact cannot be an undocumented
   implementation detail.

---

← Prev [The card adapts to its column](03-the-card-adapts-to-its-column.md) ·
Next → [Images without layout shift](05-images-without-layout-shift.md)
