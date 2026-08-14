---
title: "Line-based placement"
sidebar_label: "05 · Line-based placement"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`grid-column`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column)**,
> [`grid-row`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row) and
> [Grid layout using line-based placement](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Grid_layout_using_line-based_placement),
> and the **W3C CSS Grid Layout Level 1** specification
> ([§8.3 Line-based placement](https://www.w3.org/TR/css-grid-1/#line-placement)).

**Grid items are placed between numbered lines, not into numbered cells.** Three
columns have **four** lines, and the off-by-one that follows is the most common
grid mistake after `1fr`.

## Lines, not cells

```
      1         2         3         4
      │  col 1  │  col 2  │  col 3  │
```

A track sits *between* two lines. So spanning the first two columns is `1 / 3` —
from line 1 to line 3 — not `1 / 2`:

```css
.item { grid-column: 1 / 3; }   /* spans columns 1 and 2 */
```

Reading `grid-column: 1 / 3` as "columns one to three" gives the wrong answer
every time. Read it as **"from line 1 to line 3"**.

## `span` avoids the arithmetic

Often you care about *how many* tracks, not which lines:

```css
.item { grid-column: span 2; }        /* 2 tracks, auto-placed */
.item { grid-column: 2 / span 2; }    /* starts at line 2, covers 2 tracks */
```

`span` is usually the more maintainable form, because adding a column to the
template does not invalidate it. A hard-coded `1 / 3` breaks the moment the grid
gains a track; `span 2` does not.

## Negative line numbers count from the end

`-1` is the **last** line, `-2` the one before it. This is the idiom for "full
width, however many columns there are":

```css
.full-bleed { grid-column: 1 / -1; }
```

That single declaration survives any change to the column count, which makes it
far more robust than `1 / 4`.

The catch: **negative numbers only address the explicit grid.** If a track was
created implicitly — by an item placed beyond the template — `-1` still refers to
the end of the *explicit* grid, not to the true last line. In a grid where rows
are implicit, `grid-row: 1 / -1` will not do what you expect.

## Named lines

Lines can be named in the template, in square brackets:

```css
.page {
  display: grid;
  grid-template-columns:
    [full-start] minmax(1rem, 1fr)
    [content-start] minmax(0, 60rem)
    [content-end] minmax(1rem, 1fr)
    [full-end];
}

.page > *      { grid-column: content; }      /* shorthand for content-start / content-end */
.page > .hero  { grid-column: full;    }
```

**A line-name pair ending `-start` and `-end` creates an implicit area name.**
Naming lines `content-start` and `content-end` means `grid-column: content` works
as a shorthand — the same mechanism that named areas produce in reverse.

This is the classic **full-bleed content grid**: everything sits in the readable
centre column by default, and anything that should break out to the full width
opts in with one declaration. It is the most reusable line-naming pattern there
is.

A line can carry several names, which is useful when one line is both the end of
one region and the start of another:

```css
grid-template-columns: [sidebar-start] 240px [sidebar-end main-start] 1fr [main-end];
```

## Placement is independent of DOM order

An item placed explicitly goes where it is told, regardless of its position in
the markup:

```css
.a { grid-column: 3; }   /* third column, even if written first */
```

Two consequences:

- **Explicitly placed items are positioned first**, then the remaining items are
  auto-placed around them. An item placed into the middle of the grid can push
  auto-placed siblings past it.
- **Visual order diverges from DOM order**, with the same accessibility
  consequence as `order` in flexbox: tab order and screen-reader order follow the
  DOM. Placing items far from their document position is fine for decorative
  regions and wrong for anything sequential.

## Overlapping items

Two items may occupy the same cells, which grid allows deliberately:

```css
.hero__image { grid-area: 1 / 1 / 2 / 2; }
.hero__text  { grid-area: 1 / 1 / 2 / 2; z-index: 1; }
```

A one-cell grid with both children in the same area is the simplest overlay in
CSS — no absolute positioning, and the container still sizes to its content.
Stacking order follows the usual rules from Phase 7.

The single-cell version is terse enough to be worth memorising:

```css
.stack { display: grid; }
.stack > * { grid-area: 1 / 1; }   /* everything stacked in one cell */
```

## Trade-off

**Line-based placement is precise and brittle in exactly the places named areas
are robust.** Hard-coded line numbers encode the template's structure into every
item rule, so adding a column means auditing every `grid-column` in the
component. `span` and negative numbers mitigate this; named lines mitigate it
further, at which point you have reinvented much of what named areas give
directly.

Its genuine advantage is expressiveness: overlapping items, spanning subsets,
and asymmetric layouts that are not rectangular regions cannot be written as
`grid-template-areas` at all. And it scales to complex grids where the ASCII art
would stop being readable.

The practical division: **named areas for page shells, line placement for
everything they cannot express** — overlaps, full-bleed break-outs, and
twelve-column systems where naming every region would be absurd.

## Gotchas

**An item spans one track too many or too few.**
*Symptom:* `grid-column: 1 / 2` covers one column when two were intended.
*Cause:* reading the values as column numbers rather than line numbers.
*Fix:* remember three columns have four lines; use `span 2` to avoid the
arithmetic.

**`grid-column: 1 / -1` does not reach the end.**
*Symptom:* the item stops short.
*Cause:* the last tracks are implicit; negative line numbers only address the
explicit grid.
*Fix:* declare the tracks explicitly, or use `span`.

**Placing one item shifts several others.**
*Symptom:* unrelated items move after an explicit placement.
*Cause:* explicitly placed items are positioned first, and auto-placement fills
around them.
*Fix:* expected behaviour — place the others explicitly too, or use
`grid-auto-flow: dense` knowingly.

**Tab order does not match the visual layout.**
*Symptom:* keyboard focus jumps around the page.
*Cause:* placement moved items away from their DOM order.
*Fix:* reorder the markup; reserve free placement for non-sequential content.

**A named line shorthand does not work.**
*Symptom:* `grid-column: content` is ignored.
*Cause:* the lines are not named `content-start` and `content-end` — the implicit
area name needs both halves exactly.
*Fix:* name the pair with the `-start`/`-end` convention.

## Interview questions

**★ Why is `grid-column: 1 / 3` two columns and not three?**
Because the numbers are **lines**, not tracks. Three columns have four lines, and
a track lies between two of them. `1 / 3` runs from line 1 to line 3, covering
the two tracks between.

**★ What does `grid-column: 1 / -1` do, and when does it fail?**
It spans from the first line to the last line of the **explicit** grid — a
robust "full width" that survives changes to the column count. It fails when the
relevant tracks are implicit, because negative numbers do not address implicit
lines.

**★ How would you build a full-bleed content grid?**
Name the lines: `[full-start] minmax(1rem, 1fr) [content-start] minmax(0, 60rem)
[content-end] minmax(1rem, 1fr) [full-end]`. Default children get
`grid-column: content`; anything breaking out gets `grid-column: full`. The
`-start`/`-end` naming makes those one-word shorthands work.

**How do you overlap two grid items?**
Place them in the same cells — `grid-area: 1 / 1` on both. A single-cell grid
with all children in that cell is the simplest overlay in CSS, and unlike
absolute positioning the container still sizes to its content.

**When is `span` better than explicit line numbers?**
Almost always for spans, because it does not encode the template's structure.
Adding a column breaks a hard-coded `1 / 3` but leaves `span 2` correct.

**Named areas or line-based placement?**
Named areas for page shells you could sketch in seconds — they are readable and
rearrange in one media query. Line-based placement for what areas cannot express:
overlaps, full-bleed break-outs, and large column systems.

---

← [04 · Named areas](./04-named-areas.md) · Next: [06 · Subgrid](./06-subgrid.md) →
