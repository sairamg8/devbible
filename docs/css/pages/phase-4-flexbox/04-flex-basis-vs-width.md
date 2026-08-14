---
title: "flex-basis vs width"
sidebar_label: "04 · flex-basis vs width"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§7.2.3 The `flex-basis` property](https://www.w3.org/TR/css-flexbox-1/#flex-basis-property),
> [§9.2](https://www.w3.org/TR/css-flexbox-1/#line-sizing)) and
> **MDN — [`flex-basis`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-basis)**.

**On the main axis, a definite `flex-basis` wins and `width` is not consulted at
all.** Not "overridden by specificity" — simply not part of the calculation. This
is why `width` on a flex item so often appears to do nothing.

## The precedence rule

For a flex item, the main-size input is chosen like this:

| `flex-basis` | What determines the flex base size |
|---|---|
| a length or percentage | **that value** — `width` is ignored |
| `content` | the item's max-content size — `width` is ignored |
| `auto` *(initial)* | defer to `width` (or `height` in a column) |
| `auto`, and `width` is also `auto` | the content size |

`flex-basis: auto` is the only value that lets `width` participate. Everything
else replaces it.

```css
.a { flex-basis: 200px; inline-size: 500px; }   /* base size 200px */
.b { flex-basis: auto;  inline-size: 500px; }   /* base size 500px */
.c { flex-basis: auto;  inline-size: auto;  }   /* base size = content */
```

## Why `flex: 1` breaks your width

Because `flex: 1` expands to `1 1 0%` — a **definite** basis:

```css
.item { flex: 1; inline-size: 300px; }   /* the 300px does nothing */
```

The base size is `0`, the item grows to its share of the container, and
`inline-size` never enters the calculation. Three correct fixes, depending on
intent:

```css
.item { flex: 1 1 300px; }              /* start at 300px, then flex */
.item { flex: 0 0 300px; }              /* exactly 300px, immovable  */
.item { flex: auto; inline-size: 300px; }  /* width feeds the basis, then grows */
```

The third form works but is indirect. Prefer putting the number in the basis —
one property then describes the item's whole main-axis behaviour.

## The cross axis is completely different

`flex-basis` only ever affects the **main** axis. On the cross axis, the ordinary
box-model properties apply exactly as they always do:

```css
.row { display: flex; }                 /* main = horizontal */
.row > .item { flex: 0 0 200px;         /* main size: 200px  */
               block-size: 120px; }     /* cross size: normal height */
```

Switch to `flex-direction: column` and the axes swap: `flex-basis` now controls
height, and `width` becomes an ordinary cross-axis property that works normally.

**This is why the same rule behaves differently after a direction change** — a
frequent surprise when a layout is made responsive by flipping to a column:

```css
.panel { flex: 0 0 300px; }             /* 300px wide in a row … */
@media (width < 40rem) {
  .layout { flex-direction: column; }   /* … now 300px TALL */
}
```

Almost never what was intended. Reset the basis when you flip the direction:

```css
@media (width < 40rem) {
  .layout { flex-direction: column; }
  .panel  { flex: 0 0 auto; }
}
```

## `min-width` and `max-width` still apply — to both

The clamp in stage one uses the item's min and max **main** sizes, and those come
from `min-width`/`max-width` in a row (or `min-height`/`max-height` in a column).
So while `width` is ignored, its min and max siblings are not:

```css
.item { flex: 1 1 0; max-inline-size: 40rem; }   /* grows, but never past 40rem */
```

This is genuinely useful — a flexible item with an upper bound — and it is the
idiomatic way to stop a main region from becoming unreadably wide on a large
display.

It also means `min-width: 0` remains available as the escape from the automatic
minimum size, regardless of what the basis says.

## `box-sizing` changes what a basis means

`flex-basis` sets the size of the same box that `box-sizing` selects:

```css
* { box-sizing: border-box; }
.item { flex: 0 0 200px; padding-inline: 1rem; }   /* 200px INCLUDING padding */
```

With the default `content-box`, that same declaration produces a 200px content
box **plus** 2rem of padding — 232px of occupied space, and four such items
overflow a container sized for 800px.

Since virtually every codebase sets `border-box` globally, this mostly bites when
working inside a stylesheet that does not. Check before trusting basis
arithmetic.

## Percentages and indefinite containers

A percentage basis resolves against the container's inner main size. If that size
is indefinite — most commonly a column flex container whose own height comes from
its content — there is nothing to resolve against and the basis behaves as
`auto`:

```css
.stack { display: flex; flex-direction: column; }   /* height: auto */
.item  { flex: 0 0 50%; }                           /* behaves as auto */
```

Give the container a definite size on that axis and the percentage starts working.

## Trade-off

**Putting the size in the basis is correct and slightly obscure; putting it in
`width` is familiar and fragile.** A reader who knows flexbox reads
`flex: 0 0 16rem` instantly; a reader who does not finds `width: 16rem` more
approachable — and that version silently breaks the first time something sets
`flex-shrink`, or the direction flips, or an ancestor becomes a flex container.

There is a real argument for `width` in one case: a component that must work
*both* inside and outside a flex container. `width` applies in both contexts;
`flex-basis` applies in only one. Components published for unknown consumers
sometimes set `width` deliberately for that reason, accepting the fragility in
exchange for context-independence.

Inside an application where you control the containers, the basis form is the
better default.

## Gotchas

**`width` on a flex item does nothing.**
*Symptom:* an explicit width is ignored.
*Cause:* `flex-basis` is definite — usually via `flex: 1`, which is `1 1 0%`.
*Fix:* move the size into the basis, or use `flex-basis: auto` so `width` is
consulted.

**A 300px-wide panel becomes 300px tall.**
*Symptom:* flipping to `flex-direction: column` produces a strangely tall panel.
*Cause:* `flex-basis` follows the main axis, which is now vertical.
*Fix:* reset the basis in the same media query — `flex: 0 0 auto`.

**Four 25% items overflow their container.**
*Symptom:* the last item wraps or overflows.
*Cause:* `box-sizing: content-box`, so padding and borders are added outside the
basis; or a `gap` that the percentages did not account for.
*Fix:* `border-box`, and subtract the gaps with `calc()`.

**A percentage basis behaves like `auto`.**
*Symptom:* `flex: 0 0 50%` sizes to content.
*Cause:* the container's main size is indefinite.
*Fix:* give the container a definite size on that axis.

**`max-width` seems to work while `width` does not.**
*Symptom:* confusing — one box property applies and the other does not.
*Cause:* correct behaviour. `width` is replaced by the basis; `min-width` and
`max-width` clamp the result and are always applied.
*Fix:* none needed — use `max-inline-size` deliberately to bound a flexible item.

## Interview questions

**★ Why is `width` ignored on a flex item?**
Because a definite `flex-basis` replaces it as the main-size input. Only
`flex-basis: auto` defers to `width`. `flex: 1` expands to `1 1 0%`, which is
definite, so the width never enters the calculation.

**★ How do you give a flex item a starting width that can still flex?**
Put it in the basis: `flex: 1 1 300px`. For a fixed, immovable size use
`flex: 0 0 300px`.

**★ What happens to `flex-basis` when the flex direction changes?**
It follows the main axis, so it switches from controlling width to controlling
height. A `flex: 0 0 300px` panel that was 300px wide in a row becomes 300px tall
in a column — which is why a responsive direction flip usually needs the basis
reset too.

**Do `min-width` and `max-width` still apply to flex items?**
Yes. They clamp the flex base size into the hypothetical main size and are
applied again after flexing. `max-inline-size` on a `flex: 1` item is the
idiomatic way to cap a flexible region's width.

**How does `box-sizing` interact with `flex-basis`?**
The basis sizes whichever box `box-sizing` selects. Under `content-box`, padding
and borders are added outside the basis, so items sized to exactly fill a
container will overflow.

**When might `width` still be the better choice on a flex item?**
For a component that must work both inside and outside a flex container. `width`
applies in both contexts; `flex-basis` only applies when the element is a flex
item.

---

← [03 · The `flex` shorthand](./03-the-flex-shorthand/README.md) · Next: [05 · Main and cross axis](./05-main-and-cross-axis.md) →
