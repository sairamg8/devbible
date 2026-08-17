---
title: "The track-sizing decision"
sidebar_label: "01 · The track-sizing decision"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *CSS grid layout* (`grid-template-columns`, `repeat()`,
> `minmax()`), MDN *`min()`*, and the CSS Grid Level 1 specification's
> track-sizing algorithm. Composes
> [CSS 5·01](../../../../css/pages/phase-5-grid/01-repeat-minmax-autofit.md),
> [5·03](../../../../css/pages/phase-5-grid/03-the-minmax-zero-fix.md) and
> [3·02](../../../../css/pages/phase-3-custom-properties/02-clamp-min-max.md).
> No sandbox, no console output.

The markup is already decided. [Chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md)
renders exactly this, and every rule on this page targets it:

```jsx
<ul className="product-grid">
  {items.map((p) => <ProductCard key={p.slug} product={p} />)}
</ul>
```

A flat list of cards, count unknown until the request lands, growing as the
sentinel pulls more pages. The question this chunk answers is the first one:
**how wide is a column?**

## The approach worth rejecting first

The instinct is to decide the column *count* per screen size:

```css
/* the breakpoint pile-up — this is what we are NOT shipping */
.product-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }

@media (min-width:  480px) { .product-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width:  768px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .product-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1440px) { .product-grid { grid-template-columns: repeat(5, 1fr); } }
```

It works, and it costs three things that get worse over time:

- **Four numbers that must stay in sync with a card width nobody wrote down.**
  The breakpoints were chosen by looking at the card and guessing. Change the
  card's padding and all four are subtly wrong, with no failing test to say so.
- **Nothing between the steps.** At 1023 px the grid shows three columns in
  space that comfortably holds four; at 1025 px it snaps. The card gets no say.
- **It is keyed to the wrong box.** `@media` asks about the *viewport*. The grid
  cares about the width of *its own container*. The moment the same grid renders
  inside the cart drawer or a narrower "related products" panel, every
  breakpoint reports a lie — the viewport is 1440 px and the container is
  380 px, so the grid confidently lays out five columns in a 380 px box.

That third cost is the one that ends the argument. It is not a tuning problem;
the query is asking about a box that is not the one being laid out.

## The declaration that ships

```css
@layer components {
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
    gap: var(--space-5);

    /* the UA list styling, removed deliberately — chunk 02 */
    list-style: none;
    margin: 0;
    padding: 0;
  }
}
```

One declaration replaces the four media queries, and it is keyed to the
container rather than the viewport. It reads: *fill the row with as many tracks
as fit, each at least 16 rem wide and never wider than the container, sharing
the leftover space equally.*

Every piece of it is load-bearing.

### `repeat(auto-fill, …)`

The browser runs the track-sizing algorithm to work out how many tracks of the
given size fit in the container's inline size, then repeats that many. The
count is computed from real available space at layout time, which is exactly
the information the media query did not have. The choice between `auto-fill`
and `auto-fit` is a decision in its own right —
[chunk 02](02-autofill-grid-and-the-list-reset.md).

### `minmax(<floor>, 1fr)`

Two different jobs in one function. The **floor** is the design decision — the
narrowest a product card may be before it stops being readable, here 16 rem.
The **`1fr` ceiling** distributes whatever space is left over after the track
count is fixed, so the row is always flush rather than leaving a ragged
remainder on the right.

Without the `1fr`, tracks would sit at exactly 16 rem and the leftover would
pool at the end of every row.

### `min(16rem, 100%)` — the guard that prevents a horizontal scrollbar

This is the part that gets left out, and it is the part that breaks on a phone.

`minmax(16rem, 1fr)` promises a track **at least 16 rem** — 256 px at the
default root size. On a 320 px viewport with 1 rem of page padding on each
side, the container is 288 px. Grid honours the floor: it lays out a 256 px
track, which fits. Raise the page padding, add a border, or let the user scale
their root font up, and the floor exceeds the container. Grid still honours it,
the track overflows, and the whole page gets a horizontal scrollbar — on the
one device where a horizontal scrollbar is least forgivable.

`min(16rem, 100%)` says *16 rem, unless that is wider than the container, in
which case the container*. The floor can never exceed the space available, so
the overflow is structurally impossible rather than avoided by choosing lucky
numbers. The function itself is
[CSS 3·02](../../../../css/pages/phase-3-custom-properties/02-clamp-min-max.md);
the reason it belongs here is that a catalog is the screen most likely to be
opened on the narrowest device in circulation.

## Where the grid sits on the page

The grid sizes its own tracks, but something has to decide how much space it
gets. That is the page shell, and it is one rule:

```css
@layer layout {
  .catalog {
    max-inline-size: 90rem;
    margin-inline: auto;
    padding-inline: var(--space-4);
  }
}
```

`max-inline-size` rather than `max-width`, and `padding-inline` rather than
left/right, because the storefront ships in more than one language and the
logical properties do the right thing under `direction: rtl` without a second
rule. The units page is
[CSS 3·04](../../../../css/pages/phase-3-custom-properties/04-units-that-matter.md).

⚠️ **The page padding is the number that makes `min()` necessary.** It is
subtracted from the viewport before the grid ever sees the container, so any
change to it changes whether a bare `16rem` floor fits. Coupling them by
guesswork is the bug; `min()` decouples them.

## Gotchas

- **Symptom:** a horizontal scrollbar on a 320–360 px phone, and only there.
  **Cause:** the `minmax()` floor is wider than the container once page padding
  is subtracted; grid honours the floor and overflows.
  **Fix:** `min(16rem, 100%)` as the floor. Never a bare length.

- **Symptom:** one product with a long unbroken SKU or URL in its name widens
  its column and squashes every other column in the grid.
  **Cause:** `1fr` is shorthand for `minmax(auto, 1fr)`, and an `auto` minimum
  resolves to the item's **min-content** size — which an unbreakable string
  makes enormous. The track grows past its share to contain it.
  **Fix:** the explicit minimum above already protects the *track*; the card's
  inner flex and grid children still need `min-width: 0`. This is the single
  most common grid bug and it has its own page —
  [CSS 5·03](../../../../css/pages/phase-5-grid/03-the-minmax-zero-fix.md).

- **Symptom:** the space between cards is bigger than designed, and
  inconsistent between rows and columns.
  **Cause:** `gap` was set on the grid *and* a margin was left on the card.
  Grid gaps do not collapse with margins the way block margins collapse with
  each other, so the two add. **Fix:** the card owns no outer margin; spacing
  between siblings is the container's job, always.

- **Symptom:** the layout is right at the default font size and wrong for a
  user who scaled their browser text up.
  **Cause:** a `rem` floor scales with the root font while a `px` media query
  does not, so a design mixing both desyncs exactly for the users who most need
  it to work. **Fix:** this grid has no media query to desync — a second,
  quieter reason to prefer it.

- **Symptom:** the grid looks correct on the catalog page and broken inside the
  cart drawer. **Cause:** viewport media queries were reintroduced somewhere
  above it. **Fix:** the grid never asks about the viewport; if a component
  needs to know its own width, that is a container query —
  [chunk 03](03-the-card-adapts-to-its-column.md).

- **Symptom:** the tracks are the right width but the whole grid is off-centre
  on a wide monitor. **Cause:** `max-inline-size` was set without
  `margin-inline: auto`, so the constrained box sits at the start edge.
  **Fix:** both, together — the constraint and the centring are two halves of
  one decision.

- **Symptom:** the layout mirrors incorrectly in an RTL locale — padding on the
  wrong side, the grid hugging the wrong edge. **Cause:** physical properties
  (`padding-left`, `max-width` with `margin-right`) do not follow writing
  direction. **Fix:** the logical properties used above.

## Interview questions

1. **★ Why `minmax(min(16rem, 100%), 1fr)` instead of `minmax(16rem, 1fr)`?**
   Because `minmax()`'s floor is a promise the browser keeps even when it does
   not fit. On a narrow phone, 16 rem can exceed the container once padding is
   subtracted, and the track overflows into a horizontal scrollbar. `min(16rem,
   100%)` caps the floor at the container's own width, making the overflow
   impossible rather than merely unlikely.

2. **★ Why can a `1fr` track still be pushed wider than its share?** `1fr`
   expands to `minmax(auto, 1fr)`, and an `auto` minimum resolves to the
   content's min-content size. An unbreakable string — a long SKU, a URL — has
   a large min-content width, so the track grows to contain it and steals space
   from its siblings. The fixes are an explicit minimum on the track and
   `min-width: 0` on the nested flex or grid children.

3. **★ Why is a viewport media query the wrong question for this component?**
   Because it measures the viewport and the grid is laid out inside a
   container, and those two are only the same thing on the one page where the
   grid happens to be full-width. Any reuse — a drawer, a sidebar, a modal —
   makes the query's answer irrelevant to the box being sized, and the failure
   is silent.

4. **How many media queries does this grid need, and why does that number
   matter?** Zero. It matters because every media query is a hard-coded guess
   about the relationship between the viewport and a container, and that guess
   is wrong the moment the component is reused somewhere narrower than the
   page. Removing the queries removes a whole class of "correct on the catalog,
   broken in the drawer" bugs.

5. **What does `gap` do that margins do not, and what does it not do?** It puts
   space *between* siblings without putting space on the outside edges, and it
   never collapses. What it does not do is replace the card's internal padding,
   and it does not collapse with any margin the card carries — so a card with
   both gets double spacing.

6. **What are the two separate jobs `minmax()` is doing here?** The floor
   encodes a *design* constraint — the narrowest a card may be and still be
   readable — and it is what the browser uses to decide the track count. The
   `1fr` ceiling encodes a *distribution* rule for the space left over once the
   count is fixed. Conflating them is why `repeat(auto-fill, 16rem)` looks
   almost right and leaves a ragged gutter.

7. **Why logical properties for the page shell?** `max-inline-size` and
   `padding-inline` follow the writing direction, so an RTL locale mirrors
   correctly with no second stylesheet and no `[dir="rtl"]` overrides. The
   physical equivalents encode an assumption about direction that the storefront
   does not get to make.

8. **Where does this rule belong in the cascade, and why declare a layer at
   all?** In `components`, under the layer order declared once in the entry
   stylesheet. Layering lets this rule be written at its natural, low
   specificity — a single class — instead of being escalated to out-specify a
   reset or a utility. Ordering is decided once, in one place, rather than
   emergently by whoever wrote the longest selector.

---

Next → [`auto-fill`, grid over flexbox, and the list reset](02-autofill-grid-and-the-list-reset.md)
