---
title: "Bars, shells and the pushed group"
sidebar_label: "01 · Bars and shells"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification and **MDN — [Typical use cases of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Typical_use_cases_of_flexbox)**.

**Five layouts that carry most application chrome.** Each one is short, and each
one depends on something from the earlier topics — which is the point: the
patterns are not tricks, they are the algorithm applied deliberately.

## 1. The nav bar with a pushed group

The most common bar in any application: brand on the left, links next, actions
pushed to the far end.

```css
.nav      { display: flex; align-items: center; gap: 1rem; }
.nav__cta { margin-inline-start: auto; }   /* absorbs all free space */
```

The auto margin is the whole pattern. It claims the free space **before**
`justify-content` runs ([01 · The alignment stage](../01-the-flex-sizing-algorithm/03-the-alignment-stage.md)),
so everything before `.nav__cta` stays grouped at the start and `.nav__cta` sits
at the end.

**Why not `justify-content: space-between`?** Because that spreads *every* item
apart. It works only when there are exactly two children. The auto margin works
for any number, and the split point is stated at the element that moves.

For a three-group bar — start, centre, end — give the centre group
`margin-inline: auto`:

```css
.nav__center { margin-inline: auto; }   /* equal free space either side */
```

## 2. The media object

An image beside a body of text, where the text takes the remaining space:

```css
.media      { display: flex; gap: 1rem; align-items: flex-start; }
.media__img { flex: none; }                        /* natural size, immovable */
.media__body{ flex: 1; min-inline-size: 0; }       /* the rest, shrinkable */
```

Two deliberate choices:

- **`flex: none` on the image** — without it, `flex-shrink: 1` lets the image be
  squeezed narrower than its intrinsic width when the text is long.
- **`min-inline-size: 0` on the body** — without it, a long unbroken word in the
  text sets a content floor and pushes the image out
  ([02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md)).

`align-items: flex-start` stops the image stretching to the text's height, which
the default `stretch` would otherwise do.

## 3. The sticky footer

A footer pinned to the bottom of the viewport when content is short, pushed down
naturally when content is long:

```css
body        { display: flex; flex-direction: column; min-block-size: 100dvh; }
.main       { flex: 1; }                    /* absorbs all spare height */
```

`flex: 1` on the main region is the entire mechanism: it grows to fill whatever
height is left over, so the footer is pushed to the bottom. When the content
exceeds the viewport, there is no free space, `flex: 1` does nothing, and the
footer sits below the content as normal.

`100dvh` rather than `100vh` so the mobile URL bar does not cause the footer to
sit below the fold — see
[Phase 3 · Units that matter](../../phase-3-custom-properties/04-units-that-matter.md).

## 4. The input with an attached button

A text field that grows and a button that does not:

```css
.field        { display: flex; }
.field__input { flex: 1; min-inline-size: 0; }
.field__btn   { flex: none; }
```

`min-inline-size: 0` matters more than it looks here: form controls have an
intrinsic default width (browsers give `<input>` a default size), and that
becomes a content floor. Without it, a narrow container makes the input push the
button out of view rather than shrinking.

## 5. The toolbar that wraps

A row of controls that becomes several rows rather than overflowing:

```css
.toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.toolbar > * { flex: none; }
```

`flex: none` keeps each control at its natural size, and `flex-wrap: wrap` moves
overflow onto a new line rather than shrinking everything. This is the correct
default for controls whose labels must stay readable — shrinking a row of buttons
until their text truncates is almost never the desired failure mode.

Pair it with `gap` rather than margins: `gap` applies only *between* items, so
there is no trailing margin to strip on the last item of each row, and it works
correctly across wrapped lines.

## Trade-off

**These patterns are short because they lean on defaults, which makes them
fragile to unrelated changes.** The sticky footer depends on `body` being the
flex container; introducing a wrapper `div` breaks it silently. The media object
depends on `flex: none` on the image; a base rule that sets `flex: 1` on all
children of `.media` breaks it. None of these failures produce an error — they
produce a layout that is subtly wrong.

The mitigation is to keep each pattern's rules **together in one block** and
comment the non-obvious line. Every one of these patterns has exactly one line
that is doing the real work — the auto margin, the `flex: 1`, the
`min-inline-size: 0` — and that is the line a future reader will delete as
redundant.

## Gotchas

**`margin-inline-start: auto` does nothing.**
*Symptom:* the item does not move to the end.
*Cause:* there is no free space — the siblings have `flex-grow` and consumed it.
*Fix:* remove the grow factors, or use `flex: none` on the items that should keep
their natural size.

**The sticky footer sits in the middle of the page.**
*Symptom:* the footer floats above the bottom with content-height above it.
*Cause:* the main region has no `flex: 1`, so nothing absorbs the spare height.
*Fix:* `flex: 1` on the main region.

**The media object's image gets squashed.**
*Symptom:* the image narrows when the text is long.
*Cause:* `flex-shrink` defaults to 1.
*Fix:* `flex: none` on the image.

**A button next to an input disappears off-screen.**
*Symptom:* on narrow widths the button is pushed out.
*Cause:* the input's intrinsic default width acts as a content floor.
*Fix:* `min-inline-size: 0` on the input, `flex: none` on the button.

**A wrapped toolbar has uneven spacing at the line ends.**
*Symptom:* trailing space after the last item on each row.
*Cause:* margins rather than `gap`, so the last item on every line carries one.
*Fix:* use `gap`, which applies only between items and works across lines.

## Interview questions

**★ How do you push one item to the far end of a flex row?**
`margin-inline-start: auto` on that item. An auto margin absorbs all free space on
that side before `justify-content` is applied, so preceding items stay grouped at
the start. Unlike `space-between` it works with any number of items.

**★ How does a flexbox sticky footer work?**
Make the page a column flex container with `min-block-size: 100dvh`, and give the
main region `flex: 1`. It grows to consume the spare height so the footer is
pushed to the bottom; when content overflows there is no spare height and the
footer follows the content naturally.

**★ Why does the media object pattern need both `flex: none` and
`min-inline-size: 0`?**
`flex: none` stops the image being shrunk below its intrinsic width, since every
flex item is shrinkable by default. `min-inline-size: 0` removes the text body's
automatic minimum size so a long unbroken word cannot push the image out.

**Why prefer `gap` over margins in a wrapping toolbar?**
`gap` applies only between items and works correctly across wrapped lines, so
there is no trailing margin on the last item of each row to strip with a
`:last-child` rule.

**When is `justify-content: space-between` the wrong tool?**
Whenever there are more than two groups, because it spreads every item apart
rather than splitting at one point. An auto margin on the item that should move
expresses the intent precisely.

**Why should a toolbar's items use `flex: none` rather than shrinking?**
Because shrinking controls until their labels truncate is a poor failure mode.
Keeping natural sizes and wrapping to a new line preserves readability.

---

Next: [02 · Truncation and the squeeze](./02-truncation-and-the-squeeze.md) →
