---
title: "Main and cross axis"
sidebar_label: "05 · Main and cross axis"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§3 Flex layout box model](https://www.w3.org/TR/css-flexbox-1/#box-model),
> [§8 Alignment](https://www.w3.org/TR/css-flexbox-1/#alignment)) and
> **MDN — [Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)**.

**`flex-direction` does not rotate your layout — it redefines which axis every
other flex property refers to.** `justify-*` always means "along the main axis"
and `align-*` always means "across it", so changing the direction silently
changes what all of them do.

## The two axes

| | Row (`flex-direction: row`) | Column (`flex-direction: column`) |
|---|---|---|
| **Main axis** | horizontal → | vertical ↓ |
| **Cross axis** | vertical ↓ | horizontal → |
| `justify-content` | horizontal distribution | **vertical** distribution |
| `align-items` | **vertical** alignment | horizontal alignment |
| `flex-basis` sizes | width | **height** |
| `gap` between items | horizontal | vertical |

The properties never change meaning. **The axes move underneath them.**

This is why "centre it vertically" has no fixed answer in flexbox. In a row it is
`align-items: center`; in a column it is `justify-content: center`. Anyone who
has typed both hoping one works has met this.

## Centring, stated once for each direction

```css
/* row: main = horizontal */
.center { display: flex; justify-content: center; align-items: center; }

/* column: main = vertical — the SAME two properties, swapped roles */
.center { display: flex; flex-direction: column;
          justify-content: center; align-items: center; }
```

Both centre on both axes, which is why the pair is worth memorising as a unit:
**`justify-content` + `align-items` together always centre, whatever the
direction.** Only reach for the individual one when you want a single axis.

The terser form still works and is direction-independent:

```css
.center { display: flex; }
.center > * { margin: auto; }   /* auto margins centre on both axes */
```

## `row-reverse` and `column-reverse` move the start, not just the order

The reverse values swap which end is the **main-start**:

```css
.row { display: flex; flex-direction: row-reverse; }
```

Items now lay out right-to-left, and — importantly — `justify-content:
flex-start` puts them on the **right**. Every main-axis property flips with it,
including auto margins.

Two consequences that matter in practice:

- **Scrolling flips too.** A `row-reverse` container that overflows scrolls from
  the right, and the start of the content can be off-screen at the left.
- **DOM order is unchanged**, which is the accessibility problem below.

## The accessibility rule: visual order is not reading order

`flex-direction: row-reverse` and the `order` property change **only the visual
arrangement**. They do not change the DOM, and therefore do not change:

- the order a screen reader announces content,
- the order keyboard `Tab` moves through focusable elements,
- the order text is selected and copied.

A visually-reversed row where `Tab` jumps right-to-left is disorienting for
keyboard users, and a reordered form where the submit button is visually first
but focused last is worse.

The rule the specification itself states is that reordering is for **visual**
reordering only, and content order in the document should match the logical
reading order. In practice:

- Use `order` for **cosmetic** rearrangement of items that carry no sequence —
  decorative panels, a media object's image and text.
- **Never** use it to reorder form fields, steps in a process, or anything a
  keyboard user must traverse in order.
- If the visual order is the correct order, **change the DOM**, not the CSS.

## Logical properties make direction changes survivable

The physical properties (`margin-left`, `width`, `padding-top`) do not follow the
flex axes and do not follow the writing mode. Their logical equivalents do:

| Physical | Logical | Follows |
|---|---|---|
| `width` | `inline-size` | the inline axis (writing mode) |
| `height` | `block-size` | the block axis |
| `margin-left` | `margin-inline-start` | writing direction |
| `min-width` | `min-inline-size` | inline axis |

For a layout that must work in both left-to-right and right-to-left languages,
logical properties remove an entire class of mirroring bugs — `margin-inline-start`
becomes a right margin automatically in an RTL context, where `margin-left` would
have stayed stubbornly on the left.

This is why the pages in this phase write `min-inline-size: 0` rather than
`min-width: 0`. They are equivalent in a standard horizontal writing mode, and
only one of them is still correct in Arabic or Hebrew.

## `flex-flow`: direction plus wrap

A small convenience shorthand:

```css
.row { flex-flow: row wrap; }      /* = flex-direction: row; flex-wrap: wrap; */
.col { flex-flow: column nowrap; }
```

Worth knowing mainly so it is recognisable in other people's CSS; the longhands
read more clearly in a codebase where direction is changed responsively.

## Trade-off

**Axis-relative properties make flexbox composable and make individual rules
unreadable in isolation.** `justify-content: center` tells you nothing on its own
— you must find the `flex-direction` to know whether it centres horizontally or
vertically. In a large stylesheet where direction is set in one rule and
alignment in another, that indirection costs real reading time, and it is the
reason direction changes in media queries so often break alignment somewhere
unexpected.

The alternative would be direction-specific properties, which would not compose
at all: every rule would need duplicating for row and column. The abstraction is
correct; the cost is that **`flex-direction` and the alignment properties should
live in the same rule** wherever possible, so a reader has both in view.

## Gotchas

**`align-items: center` does not centre vertically.**
*Symptom:* it centres horizontally instead.
*Cause:* the container is `flex-direction: column`, so the cross axis is
horizontal.
*Fix:* `justify-content: center` for the vertical axis in a column.

**A responsive direction flip breaks the spacing.**
*Symptom:* padding, sizes and alignment all look wrong after switching to column.
*Cause:* `flex-basis`, `justify-content` and `align-items` all changed axis
simultaneously.
*Fix:* reset the basis (`flex: 0 0 auto`) and swap the alignment properties in
the same media query.

**`justify-content: flex-start` puts items on the right.**
*Symptom:* start alignment appears reversed.
*Cause:* `row-reverse` moved main-start to the right edge.
*Fix:* intended behaviour — use `row` if you did not want the flip.

**Tab order does not match the visual order.**
*Symptom:* keyboard focus jumps around the row.
*Cause:* `order` or a `-reverse` direction changed the visual order only.
*Fix:* reorder the DOM instead. Reserve `order` for content with no meaningful
sequence.

**A layout mirrors incorrectly in an RTL locale.**
*Symptom:* margins and minimums stay on the wrong side.
*Cause:* physical properties (`margin-left`, `min-width`) do not follow the
writing mode.
*Fix:* logical properties — `margin-inline-start`, `min-inline-size`.

## Interview questions

**★ What does `flex-direction` actually change?**
Which axis is the main axis. Every other flex property is defined relative to
that: `justify-*` acts along the main axis and `align-*` across it, and
`flex-basis` sizes along it. The properties keep their meanings; the axes move.

**★ How do you centre content vertically in a flex container?**
It depends on the direction. In a row, `align-items: center`. In a column,
`justify-content: center`. Setting both centres on both axes regardless of
direction, which is why the pair is the reliable answer.

**★ Why should `order` and `row-reverse` be used carefully?**
They change visual order only. Screen-reader announcement order, keyboard tab
order and text selection all follow the DOM, so a reordered layout can be
disorienting or unusable for keyboard and assistive-technology users. If the
visual order is the correct order, change the DOM.

**Why do these pages write `min-inline-size` instead of `min-width`?**
Logical properties follow the writing mode, so they stay correct in right-to-left
locales. They are equivalent in a standard horizontal LTR context, and only the
logical form survives translation.

**What breaks when a media query flips a row to a column?**
`flex-basis` starts sizing height instead of width, and `justify-content` and
`align-items` swap axes. A fixed `flex: 0 0 300px` panel becomes 300px tall, and
alignment usually needs swapping too.

**What is `flex-flow`?**
A shorthand for `flex-direction` and `flex-wrap` — `flex-flow: row wrap`. Useful
to recognise; the longhands are clearer when direction changes responsively.

---

← [04 · `flex-basis` vs `width`](./04-flex-basis-vs-width.md) · Next: [06 · Flexbox patterns](./06-flexbox-patterns/README.md) →
