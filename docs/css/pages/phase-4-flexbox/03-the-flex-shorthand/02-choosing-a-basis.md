---
title: "Choosing a basis for real layouts"
sidebar_label: "02 · Choosing a basis"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§7.2](https://www.w3.org/TR/css-flexbox-1/#flex-property))
> and **MDN — [Controlling ratios of flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis)**.

**The basis is the design decision; grow and shrink are usually just `1` or
`0`.** Once you can state what an item's *starting* size should be, the rest of
the shorthand follows mechanically.

## The decision procedure

Ask, in this order:

1. **Must this item keep a fixed size?** → `flex: none` (content size) or
   `flex: 0 0 <length>` (exact size).
2. **Should all items end up equal, whatever their content?** → `flex: 1` on
   each.
3. **Should items keep their natural widths and share the surplus?** →
   `flex: auto`.
4. **Should items start at a preferred size and flex from there?** →
   `flex: 1 1 <length>`.

Four answers cover almost every row and column in an application.

## The wrap-friendly basis: `flex: 1 1 <ideal>`

This is the pattern worth learning properly, because it produces responsive
layouts with no media query at all:

```css
.cards { display: flex; flex-wrap: wrap; gap: 1rem; }
.card  { flex: 1 1 20rem; }
```

Read it as: *"aim for 20rem; grow to fill a row; wrap when you cannot fit."*

- Wide container → several cards per row, each grown past 20rem to fill it.
- Narrow container → fewer per row.
- Very narrow → one per row, shrunk below 20rem.

The basis acts as a **wrap threshold**, not a width. That is the mental shift:
you are declaring the size at which wrapping becomes preferable, and letting the
container decide how many fit.

Compare with the grid equivalent from Phase 5:

```css
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }
```

The grid version keeps columns aligned across rows; the flex version lets the
last row's items expand to fill the space. **That difference is the choice**: flex
for "fill the line", grid for "keep the columns".

## Fixed panel plus flexible body

The other pattern that carries real applications:

```css
.layout  { display: flex; }
.sidebar { flex: 0 0 16rem; }        /* exact, immovable */
.main    { flex: 1; min-inline-size: 0; }   /* absorbs everything */
```

Two details make this robust:

- **`flex: 0 0 16rem` rather than `width: 16rem`.** The width form works until
  something sets `flex-shrink`, at which point the sidebar starts collapsing. The
  basis form states immovability directly.
- **`min-inline-size: 0` on the main region.** Without it, any long content
  inside `.main` re-establishes a content floor and pushes the sidebar out —
  [02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md).

## When the basis should be `0` and when it should not

`flex: 1` (basis `0`) makes the item's own content irrelevant to its size. That
is correct for equal columns and **wrong** whenever the content genuinely needs
room:

```css
/* ⚠️ a label and a value, forced to equal widths */
.row  { display: flex; }
.row > * { flex: 1; }
```

A short label gets the same width as a long value, and the layout looks
arbitrary. What was wanted is:

```css
.row__label { flex: none; }        /* as wide as the label needs */
.row__value { flex: 1; min-inline-size: 0; }   /* the rest */
```

**The test: does this item's content have a natural size that matters?** If yes,
do not give it a zero basis.

## Ratios that actually hold

To make items sit in a true ratio, every basis must be zero:

```css
.a { flex: 1 1 0; }   /* 1 unit  */
.b { flex: 2 1 0; }   /* 2 units */
.c { flex: 3 1 0; }   /* 3 units */
```

With any non-zero basis the factors divide only the surplus, and the resulting
sizes are not in the ratio you wrote — the arithmetic is in
[01 · The flex sizing algorithm](../01-the-flex-sizing-algorithm/02-grow-and-shrink.md).

`flex: 1 1 0` and `flex: 1` are equivalent here (`0` versus `0%` behaves the same
for this purpose); writing the explicit three-value form makes the intent clearer
when the factors are not all 1.

## `gap` belongs to the container, not the basis

A common mistake when sizing for a fixed number of columns:

```css
/* ⚠️ four per row? not with a gap */
.grid { display: flex; flex-wrap: wrap; gap: 1rem; }
.item { flex: 0 0 25%; }
```

Four items at 25% plus three 1rem gaps exceeds 100%, so only three fit per row.
The fix is to subtract the gaps, which is exactly the arithmetic `calc()` exists
for:

```css
.item { flex: 0 0 calc(25% - 0.75rem); }   /* 3 gaps ÷ 4 items */
```

This is genuinely fiddly, and it is the strongest argument for using Grid when
you want a specific column count. Flex is better at "as many as fit"; grid is
better at "exactly four".

## Trade-off

**A basis expressed as a length is predictable and stops being right when the
content changes.** `flex: 0 0 16rem` for a sidebar is stable and obvious — until
the navigation labels are translated into a language that needs more room, at
which point the panel clips rather than adapts. `flex: none` would have adapted
and would have made the layout width unpredictable instead.

The general shape of the trade: **content-derived bases adapt and cannot be
planned around; length bases can be planned around and do not adapt.** Interface
chrome — sidebars, toolbars, fixed columns — usually wants length bases, because
a stable layout matters more than accommodating unusual content. Anything
displaying user or translated content usually wants a content-derived basis with
a `min-width: 0` escape so it can still be squeezed.

## Gotchas

**Cards do not wrap.**
*Symptom:* items shrink indefinitely instead of moving to a new row.
*Cause:* `flex-wrap` is `nowrap` by default.
*Fix:* `flex-wrap: wrap` on the container — the basis alone cannot cause
wrapping.

**Only three items fit when four were intended.**
*Symptom:* `flex: 0 0 25%` yields three per row.
*Cause:* `gap` is added on top of the percentages.
*Fix:* `calc(25% - <gap arithmetic>)`, or use Grid, which accounts for gaps
itself.

**A label and its value are forced to equal widths.**
*Symptom:* a short label occupies half the row.
*Cause:* `flex: 1` on both gives both a zero basis, discarding content sizes.
*Fix:* `flex: none` on the label, `flex: 1` on the value.

**A sidebar collapses on narrow screens.**
*Symptom:* the fixed panel shrinks.
*Cause:* it was sized with `width`, leaving `flex-shrink: 1` free to shrink it.
*Fix:* `flex: 0 0 <size>`.

**Ratios are wrong despite correct grow factors.**
*Symptom:* `1 / 2 / 3` produces sizes closer to equal.
*Cause:* non-zero bases mean the factors only divide the surplus.
*Fix:* set every basis to `0`.

## Interview questions

**★ What does `flex: 1 1 20rem` with `flex-wrap: wrap` achieve?**
A responsive card layout with no media query: 20rem acts as a wrap threshold
rather than a width. Items grow to fill the row, and wrap to a new line when they
cannot reach the threshold. The container decides how many fit.

**★ When should a flex item have a zero basis, and when should it not?**
Zero basis when the item's content size is irrelevant and items should be equal.
Not when the content has a natural size that matters — a label, a badge, a
button — because a zero basis discards it and the layout looks arbitrary.

**★ How would you build a fixed sidebar and a flexible main region?**
`flex: 0 0 16rem` on the sidebar so it never grows or shrinks, `flex: 1` plus
`min-inline-size: 0` on the main region so it absorbs the remaining space and can
still shrink when its content is long.

**Why does `flex: 0 0 25%` not give four columns per row?**
Because `gap` is added on top of the percentage bases, so four items plus three
gaps exceed the container. Subtract the gap arithmetic with `calc()`, or use Grid.

**Why prefer `flex: 0 0 <size>` over `width` for a fixed panel?**
`width` leaves `flex-shrink` at 1, so the panel is still shrinkable and will
collapse under pressure. The basis form states that the item does not flex.

**Flex or Grid for a card layout?**
Flex when the last row's items should expand to fill the line ("as many as fit").
Grid when columns must stay aligned across rows or you need an exact count —
`repeat(auto-fit, minmax(20rem, 1fr))`.

---

← [01 · What the values mean](./01-what-the-values-mean.md) · Back to [the topic index](./README.md)
