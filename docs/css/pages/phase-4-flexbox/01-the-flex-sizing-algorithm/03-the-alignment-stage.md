---
title: "Stage three — alignment, and what is left over"
sidebar_label: "03 · The alignment stage"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§8 Alignment](https://www.w3.org/TR/css-flexbox-1/#alignment),
> [§9.5 Main-axis alignment](https://www.w3.org/TR/css-flexbox-1/#main-alignment))
> and **MDN — [Aligning items in a flex container](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Aligning_items_in_a_flex_container)**.

**Alignment only ever distributes space that flexing did not consume.** That
single sentence resolves most "why is `justify-content` doing nothing" questions:
if the items grew to fill the line, there is no space left to align, and the
property is not broken — it is unemployed.

## The order matters, and this is why

Recall the three stages:

1. Base sizes → hypothetical main sizes → free space
2. Grow or shrink → **final main sizes**
3. **Alignment** → position the items in whatever space remains

Stage 2 runs to completion first. If any item had `flex-grow` and there was
positive free space, that space is now *inside* the items. Stage 3 receives
nothing.

```css
.row { display: flex; justify-content: space-between; }
.row > * { flex: 1; }        /* ← every item grew to fill the line */
```

`space-between` has no effect here, and no amount of tweaking it will help. The
items consumed the free space in stage 2. Either drop the `flex: 1`, or accept
that spacing must now come from `gap` or margins.

**The diagnostic question is always: is there leftover space?** Not "is the
alignment property correct?"

## Main axis versus cross axis: two different mechanisms

This is the structural distinction, and it is why the two families of properties
behave so differently.

| | Main axis | Cross axis |
|---|---|---|
| Sizing controlled by | `flex-grow` / `flex-shrink` | `align-items` / `align-self` |
| Leftover space distributed by | `justify-content` | `align-content` (multi-line only) |
| Default behaviour | items keep their flexed size | items **stretch** to fill the line |

On the **main** axis, items are sized by flexing and then merely *positioned* by
`justify-content`. On the **cross** axis there is no flexing at all — the
alignment property itself decides the size, because `align-items: stretch` is the
initial value and stretching is a sizing operation.

That asymmetry explains a common surprise: a flex item with no height fills the
container's height automatically (cross-axis stretch), while a flex item with no
width does *not* fill the width unless you ask it to grow.

## Auto margins absorb free space before alignment runs

An `auto` margin on the main axis claims **all** remaining free space on that
side, and it does so *before* `justify-content` is considered. This makes it a
sharper tool than the alignment properties for one very common layout:

```css
.nav      { display: flex; }
.nav .cta { margin-inline-start: auto; }   /* pushed to the far end */
```

Everything before `.cta` sits at the start; `.cta` sits at the end. No wrapper
element, no `space-between` that would also spread the other items apart.

Two consequences worth carrying:

- **`justify-content` stops mattering** once an auto margin has taken the free
  space. If your `justify-content` seems ignored, look for an auto margin.
- Auto margins also centre on the cross axis — `margin: auto` on a single flex
  item centres it both ways, which remains the tersest centring in CSS.

## `align-content` needs more than one line

`align-content` distributes space between **flex lines**, so it does nothing in a
single-line container. Since `flex-wrap: nowrap` is the initial value, most flex
containers have exactly one line, and `align-content` is inert in them.

```css
.grid { display: flex; flex-wrap: wrap; align-content: space-between; }
```

Without the `flex-wrap: wrap`, that last declaration is decoration.

This is the most-reported "broken" alignment property, and the cause is always
the same: one line has nothing to distribute between.

## The safe-area problem with centring

Centred content that overflows gets clipped on **both** sides, and the start side
is unreachable — you cannot scroll to it, because overflow scrolls only toward
the end.

```css
.row { display: flex; justify-content: center; }         /* ⚠️ clips both ends */
.row { display: flex; justify-content: safe center; }    /* ✅ falls back to start */
```

The `safe` keyword falls back to start alignment when the content would overflow,
which keeps the beginning reachable. Worth reaching for on anything whose content
length you do not control.

## Trade-off

**Alignment properties are cheap to write and easy to misdiagnose.** They read
declaratively — "space between", "center" — which invites treating them as
statements of intent rather than as operations on leftover space. When they do
nothing, the instinct is to add more of them, and a container ends up with
`justify-content`, `align-items`, `align-content` and auto margins all set, three
of them inert.

The discipline that avoids it is to decide *where the space should live* before
choosing a property: inside the items (`flex-grow`), between the items (`gap`),
or at one end (auto margin or `justify-content`). Those are three different
mechanisms, and only the third is alignment. Picking the mechanism first makes
the property obvious and stops the accumulation of dead declarations.

## Gotchas

**`justify-content` does nothing.**
*Symptom:* `space-between` has no visible effect.
*Cause:* the items consumed the free space by growing (`flex: 1`), or an auto
margin already claimed it.
*Fix:* remove the grow factor, or use `gap` if you wanted separation rather than
distribution.

**`align-content` does nothing.**
*Symptom:* no change whatever value is set.
*Cause:* the container is single-line — `flex-wrap` is `nowrap` by default.
*Fix:* add `flex-wrap: wrap`, or use `align-items` if you meant to align items
within their line.

**An item fills the container's height without being told to.**
*Symptom:* a short item is as tall as its tallest sibling.
*Cause:* `align-items: stretch` is the initial value on the cross axis.
*Fix:* `align-items: flex-start`, or `align-self: flex-start` on the one item.

**Centred content is clipped and unreachable at the start.**
*Symptom:* the beginning of an overflowing row cannot be scrolled to.
*Cause:* `justify-content: center` overflows in both directions, and scrolling
only reaches the end side.
*Fix:* `justify-content: safe center`.

**`gap` and `space-between` fight each other.**
*Symptom:* spacing is larger than expected and inconsistent.
*Cause:* both are adding space — `gap` between every pair, `space-between`
distributing the remainder on top.
*Fix:* pick one. `gap` for a fixed rhythm, `space-between` for filling a line.

## Interview questions

**★ Why does `justify-content` sometimes appear to do nothing?**
Because it distributes only the space left after flexing. If the items have
`flex-grow` and there was positive free space, they absorbed it in stage two and
there is nothing left to distribute. An auto margin can claim it first for the
same reason.

**★ What is the structural difference between main-axis and cross-axis
alignment?**
On the main axis items are *sized* by `flex-grow`/`flex-shrink` and merely
*positioned* by `justify-content`. On the cross axis there is no flexing —
`align-items` itself does the sizing, because its initial value `stretch` makes
items fill the line.

**★ Why is `align-content` so often inert?**
It distributes space between flex *lines*, and `flex-wrap: nowrap` is the initial
value, so most containers have exactly one line and nothing to distribute.

**What does an auto margin do in a flex container?**
It absorbs all free space on that side before `justify-content` is applied. It is
the cleanest way to push one item to the far end without spreading the others,
and `margin: auto` on a single item centres it on both axes.

**Why is a short flex item as tall as its siblings?**
`align-items: stretch` is the initial value, so items are stretched to the line's
cross size unless given an explicit cross size or a different alignment.

**What does the `safe` keyword do?**
It makes an alignment fall back to start alignment when the content would
overflow, so the beginning stays reachable — `justify-content: safe center`
avoids clipping content unreachably on the start side.

---

← [02 · Grow and shrink](./02-grow-and-shrink.md) · Back to [the topic index](./README.md)
