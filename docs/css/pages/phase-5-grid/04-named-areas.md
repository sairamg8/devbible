---
title: "Named areas"
sidebar_label: "04 · Named areas"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`grid-template-areas`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-areas)**
> and [Grid template areas](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Grid_template_areas),
> and the **W3C CSS Grid Layout Level 1** specification
> ([§8.2 Named areas](https://www.w3.org/TR/css-grid-1/#grid-template-areas-property)).

**The one place in CSS where the stylesheet looks like the layout it produces.**
An entire page shell is drawn as ASCII art, and rearranging it for another
breakpoint is a matter of redrawing the picture.

## The shape of it

```css
.page {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  min-block-size: 100dvh;
}

.page__header  { grid-area: header; }
.page__sidebar { grid-area: sidebar; }
.page__main    { grid-area: main; }
.page__footer  { grid-area: footer; }
```

Each string is a **row**; each word within it is a **column cell**. Repeating a
name across adjacent cells makes that area span them — `"header header"` spans
both columns.

The mapping is deliberately dumb, and that is the strength: a reader who has
never seen the component knows the layout from four lines, without counting grid
lines or tracing `grid-column: 1 / 3`.

## The rules the parser enforces

Get any of these wrong and the **whole declaration is invalid and dropped** —
silently, with the grid falling back to auto-placement:

1. **Every row must have the same number of cells.** `"a b"` and `"c d e"` in one
   template is invalid.
2. **An area must be rectangular.** L-shapes and T-shapes are not expressible;
   `"a a" "a b"` is fine, `"a b" "b a"` is not.
3. **A name must be contiguous.** The same name cannot appear in two separate
   blocks of the grid.

The silent failure is the trap. A grid that suddenly stacks everything in one
column usually means a typo broke rule 1 — a missing word, or a stray quote.

## Empty cells

A period, or a run of periods, means "leave this cell empty":

```css
grid-template-areas:
  "header header header"
  "sidebar main   ."
  "footer  footer footer";
```

`.` and `...` are equivalent — any number of dots is one empty cell. Aligning
them with whitespace is conventional and makes the art readable:

```css
grid-template-areas:
  "header  header"
  "sidebar main  "
  "footer  footer";
```

Whitespace inside the strings is insignificant, so padding names to equal widths
costs nothing and makes the shape obvious at a glance. It is worth doing.

## Rearranging in exactly one media query

This is the payoff, and the reason named areas earn Master tier:

```css
@media (width < 48rem) {
  .page {
    grid-template-areas:
      "header"
      "main"
      "sidebar"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto auto;
  }
}
```

**No item rules change.** `grid-area: sidebar` still says `sidebar`; only the
picture changed. Compare with the line-based equivalent, where every item's
`grid-column` and `grid-row` would need rewriting inside the query.

Note that the sidebar now appears *after* main in the visual order — which is
usually what you want on a phone, and which is a **visual** reorder only. The DOM
order still governs reading and tab order, exactly as in
[Phase 4 · Main and cross axis](../phase-4-flexbox/05-main-and-cross-axis.md).
If the sidebar genuinely belongs after the main content, put it there in the
markup.

## `grid-area` is a four-value shorthand too

The same property has a second, unrelated-looking form:

```css
.item { grid-area: header; }              /* by name */
.item { grid-area: 1 / 1 / 2 / 3; }       /* row-start / col-start / row-end / col-end */
```

The four-value order is **row-start, column-start, row-end, column-end** — an
easy one to get wrong, because it is not the CSS-usual clockwise order. Naming
areas avoids the question entirely, which is a small argument in their favour.

## Implicit line names come free

Defining an area called `main` implicitly creates lines named `main-start` and
`main-end` on both axes. That means you can place something against a named area
without being *in* it:

```css
.overlay { grid-column: main-start / main-end; }
```

Useful for full-bleed elements and overlays that need to align to a region
defined elsewhere in the template.

## When named areas are the wrong tool

They describe a **fixed** arrangement, so they suit page shells, dashboards and
form layouts — anything whose regions are known and named in the design.

They are wrong for collections. A gallery of *n* cards has no named regions; it
wants `repeat(auto-fit, minmax(…))` from
[01](./01-repeat-minmax-autofit.md). Trying to name areas for a variable number
of items is the main way this feature gets misused.

## Trade-off

**Named areas buy readability with duplication.** The layout is stated twice —
once as the picture, once as `grid-area` on each item — and the two must agree.
Renaming a region means editing the template and every item that references it,
and a mistyped name in an item rule fails silently: the item is auto-placed
somewhere unexpected rather than erroring.

The template also grows awkwardly with complexity. A three-region shell is four
readable lines; a twelve-region dashboard is a wall of text where the columns no
longer align visually, and at that point line-based placement is easier to
maintain.

The rule of thumb that holds up: **named areas for layouts you could sketch on
paper in a few seconds.** Beyond that, the picture stops being a picture.

## Gotchas

**The whole grid collapses into one column.**
*Symptom:* every child stacks, ignoring the template.
*Cause:* the `grid-template-areas` value is invalid — usually unequal cell counts
per row — so the declaration was dropped.
*Fix:* count the words in each string; they must match exactly.

**An area is not rectangular.**
*Symptom:* the same silent collapse.
*Cause:* an L- or T-shaped region, or the same name in two separate blocks.
*Fix:* grid areas must be rectangles; restructure or use a nested grid.

**An item lands in the wrong place.**
*Symptom:* one element is auto-placed rather than in its region.
*Cause:* the name in `grid-area` does not match the template — a typo, or a
rename applied in only one place.
*Fix:* check the two spellings agree. There is no error for a name that does not
exist.

**The layout is correct but the tab order is not.**
*Symptom:* keyboard focus jumps oddly on mobile.
*Cause:* the media query reordered the areas visually; the DOM did not change.
*Fix:* order the markup to match the logical reading order.

**`grid-area: 1 / 1 / 2 / 3` puts the item somewhere unexpected.**
*Symptom:* the span is wrong.
*Cause:* the four-value order is row-start / column-start / row-end / column-end,
not a clockwise order.
*Fix:* use named areas, or write `grid-row` and `grid-column` separately.

## Interview questions

**★ What are the rules a `grid-template-areas` value must satisfy?**
Every row string must contain the same number of cells; every named area must be
rectangular; and each name must be contiguous. Violating any of them makes the
whole declaration invalid, and it is dropped silently — the grid falls back to
auto-placement.

**★ Why are named areas so good for responsive layouts?**
Rearranging the page is a matter of redrawing the template inside a media query.
No item rules change, because each item still references the same area name. The
line-based equivalent would need every item's `grid-column` and `grid-row`
rewritten.

**★ How do you leave a cell empty?**
A period — `.` or `...`, both meaning one empty cell. Padding names with
whitespace so the columns align is conventional and makes the shape readable.

**What implicit names does defining an area create?**
Lines called `<name>-start` and `<name>-end` on both axes, so other elements can
be placed against a region without occupying it — useful for overlays and
full-bleed content.

**When should you not use named areas?**
For collections with a variable number of items. Named regions describe a fixed
arrangement; a gallery of *n* cards wants `repeat(auto-fit, minmax(…))` instead.

**What is the four-value order of `grid-area`?**
Row-start, column-start, row-end, column-end — not the clockwise order used by
`margin` and friends, which is why it is so often written wrong.

---

← [03 · The `minmax(0, 1fr)` fix](./03-the-minmax-zero-fix.md) · Next: [05 · Line-based placement](./05-line-based-placement.md) →
