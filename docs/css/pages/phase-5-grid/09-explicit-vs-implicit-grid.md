---
title: "Explicit vs implicit grid"
sidebar_label: "09 · Explicit vs implicit grid"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **MDN — [Implicit and explicit grids](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Grid_layout_using_line-based_placement)**,
> [`grid-auto-rows`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-rows) and
> [`grid-auto-flow`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-flow),
> and the **W3C CSS Grid Layout Level 1** specification
> ([§7.5 Implicit grids](https://www.w3.org/TR/css-grid-1/#implicit-grids)).

**Tracks you declared are the explicit grid; tracks the browser invented to hold
overflow are the implicit grid.** Surprise rows almost always come from the
implicit half, and they are sized by a different property.

## Where implicit tracks come from

```css
.grid { display: grid; grid-template-columns: repeat(3, 1fr); }
```

Three columns are declared; **no rows are**. Put nine items in and the browser
creates three implicit rows to hold them. Put ten in and it creates a fourth.

Implicit tracks are created whenever:

- there are more items than the explicit grid has cells,
- an item is placed beyond the explicit grid (`grid-row: 5` in a two-row
  template), or
- an item spans past the last explicit line.

## Sizing them: `grid-auto-rows` and `grid-auto-columns`

Implicit tracks are sized `auto` by default — they fit their content, so rows
vary in height with whatever is in them. To size them deliberately:

```css
.grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(10rem, auto);     /* at least 10rem, grow if needed */
}
```

**`grid-template-rows` does not apply to implicit tracks.** This is the crux: a
template sizes only the rows it declares, and everything beyond is governed by
`grid-auto-rows`. Setting `grid-template-rows: 10rem` on a grid whose rows are
implicit does nothing at all.

`minmax(10rem, auto)` is the idiomatic value — a floor for visual rhythm, with
room to grow for long content.

## `grid-auto-flow`

Controls the direction auto-placement fills, and whether it backfills gaps:

| Value | Behaviour |
|---|---|
| `row` *(initial)* | fill across each row, creating implicit **rows** |
| `column` | fill down each column, creating implicit **columns** |
| `dense` | additionally backfill earlier gaps with later items that fit |

```css
.grid { grid-auto-flow: column; grid-auto-columns: 12rem; }
```

That pair makes a horizontally scrolling row of equal-width items — a carousel
track without any width arithmetic.

## `dense` and the cost it imposes

With mixed spans, auto-placement leaves holes: an item spanning two columns skips
to the next row rather than splitting, leaving a gap behind it. `dense` fills
those holes with later items that fit:

```css
.gallery { grid-auto-flow: row dense; }
```

Visually tighter. The cost is real and worth stating: **`dense` reorders items
visually without changing the DOM**, so tab order and screen-reader order no
longer match what is seen. It is the same accessibility problem as `order` in
flexbox ([Phase 4](../phase-4-flexbox/05-main-and-cross-axis.md)).

Use it for galleries and decorative tiles where sequence carries no meaning.
Avoid it for anything sequential — search results, steps, ranked lists.

## Debugging: which grid is a track in?

The distinction matters because several things only work on the explicit grid:

- **Negative line numbers** (`-1`) address the explicit grid only, so
  `grid-row: 1 / -1` will not span implicit rows
  ([05 · Line-based placement](./05-line-based-placement.md)).
- **`grid-template-rows`** sizes explicit rows only.
- **Named lines and areas** exist only in the explicit grid.

DevTools' grid overlay distinguishes them — implicit lines are drawn differently
and numbered past the explicit ones. When a `1 / -1` span or a named-line
reference silently misbehaves, the first question is whether the track it refers
to was ever declared.

## Making rows explicit on purpose

If you need any of the above to work on rows, declare them:

```css
.grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(8rem, auto));   /* now explicit */
}
```

The trade is that the row count is now fixed in CSS and must be maintained
alongside the content, which is usually why rows are left implicit in the first
place.

## Trade-off

**Implicit tracks make grid work with unknown content and make parts of grid stop
working.** A three-column template that accepts any number of items is exactly
what a content grid needs, and it silently forfeits negative line numbers, named
rows and `grid-template-rows` on that axis. None of those failures produce an
error; they produce a layout that is subtly wrong.

Declaring rows explicitly restores all of it and reintroduces the coupling grid
was meant to remove — the CSS now knows how many items there are.

The line worth drawing: **let rows stay implicit and size them with
`grid-auto-rows`**, which covers almost every real case. Declare them explicitly
only when you specifically need named rows, row spans to the end, or a fixed
row structure the design depends on.

## Gotchas

**`grid-template-rows` has no effect.**
*Symptom:* rows ignore the declared sizes.
*Cause:* the rows in question are implicit; the template only sizes explicit
tracks.
*Fix:* `grid-auto-rows`.

**Rows are different heights.**
*Symptom:* an uneven grid.
*Cause:* implicit rows default to `auto` and fit their content.
*Fix:* `grid-auto-rows: minmax(10rem, auto)` for a floor.

**`grid-row: 1 / -1` does not reach the bottom.**
*Symptom:* the item stops after the explicit rows.
*Cause:* negative line numbers address the explicit grid only.
*Fix:* declare the rows explicitly, or use a `span` count.

**Items appear out of order.**
*Symptom:* the visual sequence does not match the markup.
*Cause:* `grid-auto-flow: dense` backfilled earlier gaps.
*Fix:* remove `dense` for sequential content; keep it only where order is
meaningless.

**An unexpected extra column appears.**
*Symptom:* a fourth column in a three-column grid.
*Cause:* an item was placed explicitly beyond the template, creating an implicit
column.
*Fix:* check for a stray `grid-column` value past the last line.

## Interview questions

**★ What is the difference between the explicit and implicit grid?**
The explicit grid is the tracks you declared with `grid-template-*`. The implicit
grid is tracks the browser creates to hold items that do not fit — because there
are more items than cells, or an item was placed beyond the template.

**★ Why does `grid-template-rows` sometimes do nothing?**
Because the rows are implicit. `grid-template-rows` sizes only explicit tracks;
implicit ones are sized by `grid-auto-rows`, defaulting to `auto`.

**★ What does `grid-auto-flow: dense` do and what does it cost?**
It backfills earlier gaps with later items that fit, producing a tighter layout.
The cost is that visual order diverges from DOM order, so tab and screen-reader
order no longer match the display — unsuitable for anything sequential.

**How do you build a horizontally scrolling row of equal-width items?**
`grid-auto-flow: column` with `grid-auto-columns: 12rem`, so items flow sideways
into implicit columns of a fixed width.

**Why might `grid-row: 1 / -1` fail?**
Negative line numbers only address the explicit grid. If the rows are implicit,
`-1` refers to the end of the explicit grid rather than the true last line.

**What is a good default size for implicit rows?**
`minmax(10rem, auto)` — a floor that gives visual rhythm while still letting a
row grow for longer content.

---

← [08 · Alignment in grid](./08-alignment-in-grid.md) · Next: [10 · Grid vs flexbox vs flow](./10-grid-vs-flexbox-vs-flow.md) →
