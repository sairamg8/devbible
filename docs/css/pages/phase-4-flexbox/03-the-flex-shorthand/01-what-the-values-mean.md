---
title: "What the values actually expand to"
sidebar_label: "01 · What the values mean"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§7.2 The `flex` shorthand](https://www.w3.org/TR/css-flexbox-1/#flex-property))
> and **MDN — [`flex`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex)**.

**The `flex` shorthand has different defaults from its own longhands, and that
is the whole reason it is confusing.** `flex-basis`'s initial value is `auto`,
but write `flex: 1` and the basis becomes `0%`. Knowing the expansion table
removes most flexbox guesswork.

## The expansion table

| Written | `flex-grow` | `flex-shrink` | `flex-basis` |
|---|---|---|---|
| `flex: 1` | 1 | 1 | **`0%`** |
| `flex: 2` | 2 | 1 | **`0%`** |
| `flex: auto` | 1 | 1 | `auto` |
| `flex: initial` | 0 | 1 | `auto` |
| `flex: none` | 0 | 0 | `auto` |
| `flex: 1 1 auto` | 1 | 1 | `auto` |
| `flex: 0 0 200px` | 0 | 0 | `200px` |
| `flex: 200px` | 1 | 1 | `200px` |

Three rows deserve attention.

**`flex: 1` sets the basis to `0%`, not `auto`.** A single unitless number is
read as `flex-grow`, and the shorthand then fills the basis with `0%` — *not*
with the longhand's own initial value of `auto`. This is deliberate: `flex: 1`
is meant to mean "equal columns", and equal columns require a zero basis so the
entire container is surplus.

**`flex: 200px` sets grow to 1.** A single *length* is read as `flex-basis`, and
grow and shrink both become 1. So `flex: 200px` is a starting size that then
grows — quite different from `flex: 0 0 200px`.

**`flex: initial` is not `flex: 1`.** `initial` restores the longhands' own
initial values — `0 1 auto` — meaning the item does not grow, may shrink, and
sizes to content. That is the default state of any flex item you never touched.

## The four you actually need

Most real layouts use four of these, and naming them is worth more than
memorising the whole table:

```css
.fill   { flex: 1; }            /* equal share, ignores content     */
.share  { flex: auto; }         /* content size + equal share of leftover */
.fixed  { flex: none; }         /* content size, immovable          */
.panel  { flex: 0 0 240px; }    /* exact size, immovable            */
```

- **`flex: 1`** — sidebars-and-main where the columns should be equal, cards in
  a row that should match.
- **`flex: auto`** — a toolbar where each item keeps its natural width and the
  spare space is shared.
- **`flex: none`** — icons, badges, buttons that must never be squeezed.
- **`flex: 0 0 <size>`** — a fixed-width panel. The explicit form of `none` plus
  a size.

## Why `flex: 1` and `width` conflict

Because `flex: 1` sets `flex-basis: 0%`, and a definite basis takes precedence
over `width` on the main axis:

```css
.item { flex: 1; inline-size: 300px; }   /* the 300px is ignored */
```

The item's base size is `0`, it grows to its share, and `inline-size` never
participates. This is the most-reported "my width does nothing" in flexbox, and
the resolution is in [04 · `flex-basis` vs `width`](../04-flex-basis-vs-width.md).

If you want a starting width that then flexes, put it in the basis:

```css
.item { flex: 1 1 300px; }
```

## `flex: none` versus `flex: 0 0 auto`

They are identical — `none` expands to exactly `0 0 auto`. Prefer `none` when the
meaning is "this item does not participate in flexing"; it reads better and
cannot be misread as a typo.

Both are the right answer for an icon or a close button:

```css
.dialog__close { flex: none; }   /* never grows, never shrinks, natural size */
```

Without it, a close button in a row with a long title will be shrunk by the
shrink stage — which is exactly the bug that makes an icon go elliptical.

## Always use the shorthand

The specification is unusually direct about this:

> Authors are encouraged to control flexibility using the `flex` shorthand rather
> than with its longhand properties, as the shorthand correctly resets any
> unspecified components to accommodate common uses.

The reason is the reset behaviour from
[Phase 2 · The shorthand reset trap](../../phase-2-cascade/04-the-shorthand-reset-trap.md).
Setting `flex-grow: 1` alone leaves `flex-basis` at whatever it was — possibly
`auto` from a base rule, possibly a length from a modifier — so the item's
behaviour depends on declaration history. `flex: 1` states all three every time.

The one common exception is a modifier that means to change exactly one axis of
behaviour:

```css
.card        { flex: 1 1 20rem; }
.card--fixed { flex-grow: 0; }      /* deliberate: keep the basis and shrink */
```

That is legitimate, and it is worth a comment, because a reader will assume it
was an accident otherwise.

## Trade-off

**The shorthand's helpful defaults are also its unpredictability.** `flex: 1`
quietly rewriting the basis to `0%` is exactly what you want for equal columns
and exactly what confuses someone who set a width and expected it to hold. The
alternative — longhands everywhere — is explicit, verbose, and reintroduces the
partial-state problem the shorthand exists to prevent.

There is no clean way out of this trade; the mitigation is knowing the expansion
table well enough that `flex: 1` reads as `1 1 0%` on sight. That is a small,
finite thing to learn and it removes an entire category of confusion, which is
why it earns Master tier despite being a syntax detail.

## Gotchas

**`flex: 1` ignores the width you set.**
*Symptom:* `width: 300px` has no effect.
*Cause:* `flex: 1` expands to `1 1 0%`, and a definite basis wins over `width` on
the main axis.
*Fix:* `flex: 1 1 300px`, or `flex: auto` if the content should decide.

**`flex: initial` does not reset to `flex: 1`.**
*Symptom:* an item stops growing after being "reset".
*Cause:* `initial` restores `0 1 auto` — the longhand defaults, which do not
include growing.
*Fix:* write the intended value explicitly.

**An icon or button gets squashed.**
*Symptom:* a close button becomes narrower than its glyph.
*Cause:* `flex-shrink` defaults to 1, so every item is shrinkable unless told
otherwise.
*Fix:* `flex: none` on anything that must keep its natural size.

**A modifier class changes more than intended.**
*Symptom:* setting `flex-basis` in a modifier also changes growth behaviour.
*Cause:* the base rule used the shorthand and the modifier used a longhand, so
the two combine in a way that depends on the cascade.
*Fix:* use the shorthand in both, or comment the deliberate single-longhand
override.

**`flex: 200px` grows unexpectedly.**
*Symptom:* an item that should be 200px expands.
*Cause:* a single length sets the basis and leaves grow at 1.
*Fix:* `flex: 0 0 200px` for a fixed size.

## Interview questions

**★ What does `flex: 1` expand to, and why is the basis not `auto`?**
`1 1 0%`. The shorthand deliberately overrides `flex-basis`'s own initial value
of `auto` with `0%`, because a zero basis makes the entire container free space
and produces equal columns — which is what `flex: 1` is meant to express.

**★ What is the difference between `flex: 1` and `flex: auto`?**
`flex: 1` is `1 1 0%` — base sizes are zero, so items end up equal regardless of
content. `flex: auto` is `1 1 auto` — base sizes come from the content, and only
the leftover is shared, so content differences are preserved.

**★ Why does the spec encourage the shorthand over the longhands?**
Because the shorthand resets all three components every time, so an item's
flexibility does not depend on which earlier rules happened to set which
longhand. A lone `flex-grow: 1` leaves the basis at whatever it was.

**What does `flex: none` mean and when is it right?**
`0 0 auto` — natural size, never grows, never shrinks. Correct for icons,
badges and buttons that must not be squeezed by the shrink stage.

**What does a single length like `flex: 200px` do?**
Sets `flex-basis: 200px` and leaves grow and shrink at 1, so the item starts at
200px and then flexes. For a genuinely fixed 200px, write `flex: 0 0 200px`.

**Is `flex: initial` the same as not setting `flex` at all?**
Yes — both give `0 1 auto`, the longhands' initial values: content-sized, will
not grow, may shrink.

---

Next: [02 · Choosing a basis](./02-choosing-a-basis.md) →
