---
title: "Subgrid"
sidebar_label: "06 · Subgrid"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid)**
> and the **W3C CSS Grid Layout Level 2** specification
> ([§4 Subgrids](https://www.w3.org/TR/css-grid-2/#subgrids)).
> Baseline: **Widely available since 2023-09-15** (`web-features` 3.34.3).

**Subgrid lets a nested grid use its parent's tracks instead of creating its
own.** It solves one specific problem that had no solution before: aligning the
*insides* of sibling components to each other.

## The problem it solves

A row of cards, each with a title, a body and a footer. The titles are different
lengths, so they wrap differently, and the bodies and footers no longer line up
across the cards:

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Title    │ │ A longer │ │ Title    │
│ Body     │ │ title    │ │ Body     │
│          │ │ Body     │ │          │
│ Footer   │ │ Footer   │ │ Footer   │   ← footers at different heights
└──────────┘ └──────────┘ └──────────┘
```

The outer grid aligns the *cards*. Nothing aligns their contents, because each
card is an independent formatting context. Before subgrid the workarounds were
fixed heights, JavaScript measurement, or flattening the markup so every title
and body was a direct child of one grid — all bad.

## The fix

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  grid-template-rows: auto 1fr auto;    /* title / body / footer */
  gap: 1rem;
}

.card {
  display: grid;
  grid-row: span 3;                     /* occupy all three parent rows */
  grid-template-rows: subgrid;          /* … and adopt them */
}
```

Each card now spans three rows of the **parent** grid and uses those rows as its
own. Every title sits in the parent's first row, every body in the second, every
footer in the third — so they align across all cards regardless of content
length.

Two requirements that are easy to miss:

- **The card must span the tracks it wants to adopt.** `grid-row: span 3` is not
  optional; `grid-template-rows: subgrid` with no span adopts a single row.
- **The parent must define those tracks.** `subgrid` inherits the parent's track
  sizes; it does not create them.

## `subgrid` is per axis

You can subgrid one axis and define your own tracks on the other:

```css
.card {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid;              /* rows from the parent */
  grid-template-columns: auto 1fr;          /* its own columns */
}
```

This is the common shape: adopt the parent's rows for cross-card alignment, keep
local columns for the card's internal structure.

## Gaps and line names are inherited too

A subgrid uses the parent's `gap` on the subgridded axis by default, so spacing
stays consistent — though it may override it:

```css
.card { grid-template-rows: subgrid; row-gap: 0.5rem; }   /* tighter than the parent */
```

**Named lines pass through as well**, and a subgrid may add its own names on top.
That makes the full-bleed pattern from
[05 · Line-based placement](./05-line-based-placement.md) composable: a nested
component can place items against `content-start` / `content-end` defined by an
ancestor.

## The form fields case

The second genuinely common use, and arguably the cleaner one:

```css
.form {
  display: grid;
  grid-template-columns: auto 1fr;   /* labels / inputs */
  gap: 0.5rem 1rem;
}

.field {
  display: grid;
  grid-column: span 2;
  grid-template-columns: subgrid;
}
```

Each `.field` groups a label and an input in the markup — which is correct for
semantics and for validation styling — while the label column still aligns across
every field in the form. Without subgrid you must choose between correct markup
and aligned columns.

## What subgrid is not

- **Not `display: contents`.** That dissolves an element so its *children* become
  items of the outer grid — losing the wrapper's box entirely, along with its
  background, border, padding and (in some engines historically) its
  accessibility semantics. Subgrid keeps the box and shares the tracks.
- **Not masonry.** Subgrid aligns to existing tracks; it does not pack items of
  varying heights. Masonry (`item-flow`) is a separate, not-yet-Baseline feature.
- **Not automatic.** A nested grid does not align to its parent unless it
  explicitly spans and subgrids.

## Trade-off

**Subgrid couples a component to its container's track structure.** A card that
declares `grid-row: span 3; grid-template-rows: subgrid` only works inside a
parent that defines three suitable rows. Drop it into a different layout — a
sidebar, a modal, a one-off page — and it either mis-aligns or collapses. The
component is no longer self-contained, which is a real cost for anything in a
shared library.

There is also a debugging cost: the card's row sizes are now determined by its
*siblings*' content, so a change in one card changes the layout of all of them.
That is exactly the desired behaviour and it makes "why did this card get taller"
a question about a different element.

The guidance that holds: use subgrid where cross-item alignment is genuinely part
of the design — card rows, form columns, tables built from grid. Do not use it as
a general nesting mechanism, and give any subgridded component a sensible
fallback if it may be used standalone:

```css
.card { display: grid; grid-template-rows: auto 1fr auto; }   /* standalone */
@supports (grid-template-rows: subgrid) {
  .cards > .card { grid-row: span 3; grid-template-rows: subgrid; }
}
```

## Gotchas

**Nothing aligns after adding `subgrid`.**
*Symptom:* the cards look unchanged.
*Cause:* the item does not span the parent's tracks, so it adopted a single row.
*Fix:* add `grid-row: span 3` (or the appropriate span).

**The subgrid has no tracks.**
*Symptom:* the nested content stacks in one line.
*Cause:* the parent does not define tracks on that axis — `subgrid` inherits, it
does not create.
*Fix:* declare `grid-template-rows` (or columns) on the parent.

**Spacing is inconsistent between the parent and the nested grid.**
*Symptom:* the nested items are spaced differently.
*Cause:* the subgrid inherits the parent's gap on the subgridded axis unless
overridden — or was overridden unintentionally.
*Fix:* set the gap deliberately on the subgrid.

**The component breaks outside its usual parent.**
*Symptom:* a card used standalone collapses.
*Cause:* it depends on tracks the new parent does not define.
*Fix:* provide standalone track definitions and apply the subgrid rules only in
the container context, guarded with `@supports` if needed.

**`display: contents` was used instead and the styling disappeared.**
*Symptom:* the wrapper's background and padding vanish.
*Cause:* `display: contents` removes the element's box entirely.
*Fix:* subgrid keeps the box; use it when the wrapper needs to be visible.

## Interview questions

**★ What problem does subgrid solve?**
Aligning the *contents* of sibling components to each other. An outer grid aligns
the cards; without subgrid nothing aligns their titles, bodies and footers,
because each card is an independent grid. Subgrid lets each card adopt the
parent's tracks so its internals line up across all of them.

**★ What two things must be true for a subgrid to work?**
The item must **span** the parent tracks it wants to adopt (`grid-row: span 3`),
and the parent must **define** those tracks. `subgrid` inherits track sizes; it
never creates them.

**★ How is subgrid different from `display: contents`?**
`display: contents` removes the wrapper's box so its children become items of the
outer grid — losing background, border and padding. Subgrid keeps the wrapper as
a real box and shares the parent's tracks with it.

**Can you subgrid only one axis?**
Yes, and it is the common case: `grid-template-rows: subgrid` for cross-card
alignment while defining your own `grid-template-columns` locally.

**What is inherited from the parent besides track sizes?**
The gap on the subgridded axis, and named lines — which a subgrid may extend with
names of its own.

**What is the main drawback?**
It couples the component to its container's track structure, so it no longer
works standalone. Anything in a shared library needs a fallback, typically guarded
with `@supports`.

---

← [05 · Line-based placement](./05-line-based-placement.md) · Next: [07 · Grid patterns](./07-grid-patterns.md) →
