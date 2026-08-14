---
title: "Alignment in grid"
sidebar_label: "08 · Alignment in grid"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Box alignment in grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_alignment/Box_alignment_in_grid_layout)**
> and the **W3C CSS Box Alignment Level 3** specification
> ([§4 Alignment terminology](https://www.w3.org/TR/css-align-3/)).

**Six properties, constantly confused, and one rule separates them: `*-items`
aligns items inside their cells; `*-content` aligns the tracks inside the
container.** Once that distinction lands, so does everything else.

## The two-by-three table

| | Inline axis (→) | Block axis (↓) |
|---|---|---|
| **Items in their cells** | `justify-items` | `align-items` |
| **A single item** | `justify-self` | `align-self` |
| **Tracks in the container** | `justify-content` | `align-content` |

Two mnemonics that hold in both grid and flexbox:

- **`justify-*` is the inline axis** (horizontal in a normal writing mode);
  **`align-*` is the block axis** (vertical).
- **`*-items` / `*-self` move the item; `*-content` moves the tracks.**

Unlike flexbox, grid's `justify-*` and `align-*` do **not** swap meaning with a
direction change, because grid has no `flex-direction`. The axes are fixed by the
writing mode alone, which makes grid alignment considerably easier to reason
about.

## `*-items`: how items sit in their cells

The initial value on both axes is `stretch`, so items fill their cell:

```css
.grid { display: grid; justify-items: start; align-items: center; }
```

Every item is now placed at the start horizontally and centred vertically within
its own cell. Individual items override with `justify-self` / `align-self`:

```css
.grid__cta { justify-self: end; }
```

**`stretch` only applies when the item has no definite size on that axis.** An
item with a `width` cannot stretch, so it falls back to `start` — which is why a
fixed-width item appears left-aligned while its siblings fill their cells.

## `*-content`: distributing leftover space between tracks

This only does anything when the tracks do not fill the container:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 100px);   /* fixed — leftover space exists */
  justify-content: space-between;
}
```

With `1fr` tracks there is no leftover space — the `fr` units consumed it — so
`justify-content` appears to do nothing. Exactly the same relationship as
flexbox's alignment stage
([Phase 4](../phase-4-flexbox/01-the-flex-sizing-algorithm/03-the-alignment-stage.md)):
**alignment distributes only what track sizing left behind.**

This is the most common grid-alignment confusion, and the diagnostic is always
"are the tracks smaller than the container?"

## The shorthands

```css
place-items:   center;        /* align-items   justify-items   */
place-content: center;        /* align-content justify-content */
place-self:    center;        /* align-self    justify-self    */
```

Each takes one or two values, **block axis first** — `place-items: start center`
is `align-items: start; justify-items: center`. The block-first order is
worth remembering because it is the opposite of the `justify`/`align` order most
people say aloud.

`place-items: center` is the shortest complete centring in CSS:

```css
.center { display: grid; place-items: center; }
```

One declaration, one child, centred both ways — no line-height tricks, no
transforms, no flexbox pair.

## `stretch` vs `normal`

The initial value is technically `normal`, which behaves as `stretch` for grid
items with an indefinite size and as `start` for replaced elements with an
intrinsic aspect ratio. This is why an `<img>` in a grid cell does not stretch to
fill it while a `<div>` does — a difference that looks arbitrary until you know
the rule.

To make an image fill its cell:

```css
.grid img { inline-size: 100%; block-size: 100%; object-fit: cover; }
```

## Baseline alignment

`align-items: baseline` aligns items by their **first text baseline** rather than
their box edges — the correct choice for a row of labels or cards whose text
should line up despite different padding:

```css
.row { display: grid; grid-auto-flow: column; align-items: baseline; }
```

It applies per row, and items with no text fall back to their bottom margin edge.
It is genuinely useful and rarely reached for, because most people only know
`center`.

## Trade-off

**Six properties for one concept is a real cost, and the payoff is precision.**
Someone reading `align-content: center` has to know whether the tracks fill the
container before they can predict anything, and the fact that half these
properties silently do nothing in the common `1fr` case makes them look broken
rather than inapplicable.

The alternative would be fewer, more magical properties, which is what
`place-items` partly provides — and even that has a value order most people get
backwards.

The practical discipline is small: **decide whether you are moving the item or
the tracks before choosing a property**, and prefer `place-items` / `place-self`
when you want both axes, since the shorthand makes the intent visible in one
line.

## Gotchas

**`justify-content` does nothing.**
*Symptom:* no effect from any value.
*Cause:* the tracks fill the container — typically `1fr` columns — so there is no
leftover space to distribute.
*Fix:* use fixed track sizes, or `justify-items` if you meant to move items
within their cells.

**One item is not stretching like its siblings.**
*Symptom:* a fixed-width item sits at the start of its cell.
*Cause:* `stretch` only applies to items with an indefinite size on that axis.
*Fix:* remove the width, or align it deliberately with `justify-self`.

**An image does not fill its cell.**
*Symptom:* the `<img>` keeps its intrinsic size while `<div>`s stretch.
*Cause:* `normal` behaves as `start` for replaced elements with an aspect ratio.
*Fix:* `inline-size: 100%; block-size: 100%; object-fit: cover`.

**`place-items: start center` aligns the wrong way round.**
*Symptom:* the axes are swapped from what was intended.
*Cause:* the shorthand takes block axis first, then inline.
*Fix:* reverse the values, or write the longhands.

**Text in adjacent cells does not line up.**
*Symptom:* labels sit at slightly different heights.
*Cause:* the items are aligned by box edges, and their padding differs.
*Fix:* `align-items: baseline`.

## Interview questions

**★ What is the difference between `justify-items` and `justify-content` in
grid?**
`justify-items` aligns each item within its own cell. `justify-content` aligns
the whole set of **tracks** within the container, and only does anything when the
tracks are smaller than the container — so it appears inert with `1fr` columns.

**★ Which axis does `justify-*` refer to in grid, and does it change with
direction?**
The inline axis — horizontal in a normal writing mode. Unlike flexbox it never
swaps, because grid has no `flex-direction`; only the writing mode changes it.

**★ What is the shortest way to centre a single element both ways?**
`display: grid; place-items: center` on the parent. One declaration, both axes,
any number of children.

**Why does an image not stretch to fill its grid cell when a div does?**
The initial alignment is `normal`, which behaves as `stretch` for items with an
indefinite size but as `start` for replaced elements with an intrinsic aspect
ratio. Set explicit sizes plus `object-fit` to fill the cell.

**What order do the `place-*` shorthands take their values in?**
Block axis first, then inline — `place-items: <align> <justify>`. It is the
reverse of how most people say the pair aloud.

**When would you use `align-items: baseline`?**
When text across cells should line up despite differing padding or font sizes —
a row of labels or cards. It aligns by first text baseline rather than box edges.

---

← [07 · Grid patterns](./07-grid-patterns.md) · Next: [09 · Explicit vs implicit grid](./09-explicit-vs-implicit-grid.md) →
