---
title: "Stage one — flex base size and hypothetical main size"
sidebar_label: "01 · Base sizes"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§9.2 Line length determination](https://www.w3.org/TR/css-flexbox-1/#line-sizing),
> [§9.7 Resolving flexible lengths](https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths))
> and **MDN — [Controlling ratios of flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis)**.

**Before any growing or shrinking happens, every flex item is given a starting
size.** Almost every "flexbox is weird" moment is a misunderstanding of *this*
stage, not of `flex-grow` — because the growth stage only distributes what is
left over after these numbers are fixed.

The algorithm runs in three stages, and this page is stage one:

1. **Base sizes** — what size does each item start at? *(this page)*
2. **Grow or shrink** — distribute the leftover, or the deficit
3. **Alignment** — position what remains along both axes

## Flex base size

The **flex base size** is the item's size on the main axis *before* flexing. It
comes from `flex-basis`, falling back through a defined chain:

| `flex-basis` | Flex base size becomes |
|---|---|
| a length — `200px`, `20rem` | that length |
| a percentage — `50%` | that percentage of the container's inner main size |
| `content` | the item's max-content size, ignoring `width`/`height` |
| `auto` *(the initial value of the longhand)* | the item's `width` (or `height` in a column), and if *that* is `auto` too, its max-content size |
| `0` | zero — content is ignored entirely for the starting size |

The chain in the `auto` row is the one to internalise: **`flex-basis: auto` is a
redirect, not a size.** It says "go ask `width`", and `width: auto` in turn says
"go ask the content".

```css
.item { flex-basis: auto; width: 200px; }   /* base size: 200px */
.item { flex-basis: auto; width: auto;  }   /* base size: max-content */
.item { flex-basis: 0;    width: 200px; }   /* base size: 0 — width ignored */
```

That last line is not a mistake. When `flex-basis` is a length, **`width` is not
consulted at all** on the main axis. This is the single most common source of
"my width is being ignored" — and it is covered from the other direction in
[04 · `flex-basis` vs `width`](../04-flex-basis-vs-width.md).

## Hypothetical main size

The base size is then clamped by the item's own `min-width`/`max-width` (or
`min-height`/`max-height` in a column). The result is the **hypothetical main
size** — "what this item would be if it could have what it asked for".

```
hypothetical main size = clamp(min-main-size, flex base size, max-main-size)
```

The word *hypothetical* is doing real work. It is not the final size; it is the
number the container uses to work out whether there is free space at all. And
the `min` half of that clamp is not usually zero, because `min-width`'s initial
value in flex layout is `auto`, which resolves to a **content-based minimum** —
the subject of [02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md),
and the reason items so often refuse to shrink.

## Free space: the number everything else divides up

With every item's hypothetical main size known, the container computes:

```
free space = container inner main size − Σ (hypothetical main sizes + margins + gaps)
```

- **Positive** free space → the grow stage runs, using `flex-grow`.
- **Negative** free space → the shrink stage runs, using `flex-shrink`.
- **Exactly zero** → neither runs; items keep their hypothetical main sizes.

Only one of the two ever runs on a given line. `flex-grow` is irrelevant when
the items already overflow, and `flex-shrink` is irrelevant when they do not
fill the container. This is why setting both rarely does what people expect:
you are configuring two mutually exclusive branches.

## Worked example: where the numbers come from

A 600px container, `display: flex`, no gaps, three items:

```css
.container { display: flex; inline-size: 600px; }
.a { flex: 0 1 100px; }
.b { flex: 0 1 200px; }
.c { flex: 0 1 150px; }
```

Stage one:

| Item | flex-basis | Flex base size | Hypothetical main size |
|---|---|---|---|
| `.a` | `100px` | 100px | 100px |
| `.b` | `200px` | 200px | 200px |
| `.c` | `150px` | 150px | 150px |

Total 450px against a 600px container → **free space = +150px**. Because every
`flex-grow` is `0`, nobody claims it: the items stay at 100/200/150 and 150px of
the container is simply empty. The free space existed; nothing was configured to
absorb it.

Change one thing:

```css
.b { flex: 1 1 200px; }
```

Now `.b` has `flex-grow: 1` and is the only claimant, so it takes all 150px and
finishes at **350px**. `.a` and `.c` are untouched.

## Why `flex: 1` produces equal columns and `flex: auto` does not

This follows directly from the base-size chain, and it is the highest-value
consequence of stage one.

```css
.item { flex: 1; }      /* → flex: 1 1 0%   */
.item { flex: auto; }   /* → flex: 1 1 auto */
```

With `flex: 1`, every base size is **0**. All of the container's width is
therefore free space, and it is divided by the grow factors alone. Three items
with `flex: 1` each get exactly one third — **regardless of their content**.

With `flex: auto`, each base size is the item's **max-content size**. Free space
is only what is left after the content is laid out, and *that* remainder is
divided equally. Items keep their content differences and share only the
surplus, so a long item stays wider than a short one.

| | Base sizes | 600px container | Result |
|---|---|---|---|
| `flex: 1` | 0, 0, 0 | 600px free, split 3 ways | **200 / 200 / 200** |
| `flex: auto` (content 100/200/150) | 100, 200, 150 | 150px free, split 3 ways | **150 / 250 / 200** |

Neither is "correct". `flex: 1` is right for equal columns; `flex: auto` is
right for content-proportional distribution such as a toolbar. Choosing the
wrong one is the most common cause of "why are my columns uneven".

## Percentages in `flex-basis`

A percentage basis resolves against the container's **inner main size** — its
content box. Two consequences worth knowing:

- With `box-sizing: content-box`, `flex-basis: 50%` plus padding overflows,
  because the padding is added outside the 50%.
- If the container's main size is indefinite (a column flex container whose own
  height depends on its content), a percentage basis has nothing to resolve
  against and behaves as `auto`.

## Trade-off

**Stage one buys you predictability at the cost of an indirection.** The base
size is a genuinely separate concept from `width`, and that separation is what
lets one property (`flex`) describe an item's whole sizing behaviour in three
numbers. The price is that `width` and `flex-basis` can both be set, only one
can win, and the loser is silent.

You can avoid the indirection entirely by never setting `flex-basis` and letting
`width` drive everything — this is what a codebase that uses `flex: none` plus
explicit widths looks like. It is easier to read and it forfeits the whole point
of flexbox, which is that items respond to the space available. The mainstream
position — set `flex`, do not set `width` on flex items — is worth following for
exactly this reason.

## Gotchas

**`width` on a flex item does nothing.**
*Symptom:* `width: 200px` is ignored on the main axis.
*Cause:* `flex-basis` is a length (often via `flex: 1`, which is `1 1 0%`), and a
length basis takes precedence over `width`.
*Fix:* set the size through the basis — `flex: 0 1 200px` — or use
`flex-basis: auto` so `width` is consulted.

**Columns are unequal despite `flex: 1` everywhere.**
*Symptom:* one column is wider.
*Cause:* usually `flex: auto` or `flex: 1 1 auto` rather than `flex: 1`, so base
sizes are content-derived and only the surplus is shared. Otherwise the item has
a `min-width` floor.
*Fix:* `flex: 1` for equal columns; check for automatic minimum size if it
persists.

**Free space exists but nothing expands.**
*Symptom:* a gap on the right of the container.
*Cause:* every item has `flex-grow: 0` — the initial value. Free space is only
distributed to items that claim it.
*Fix:* give one item `flex-grow: 1`, or use `justify-content` to distribute the
gap instead.

**A percentage `flex-basis` behaves like `auto`.**
*Symptom:* `flex-basis: 50%` sizes to content in a column layout.
*Cause:* the container's main size is indefinite, so the percentage has no
reference.
*Fix:* give the container a definite size on that axis, or use a length basis.

## Interview questions

**★ What is the flex base size, and where does it come from?**
It is the item's main-axis size before flexing. It comes from `flex-basis`: a
length or percentage is used directly; `content` uses max-content; `auto`
redirects to `width` (or `height` in a column), which itself may redirect to the
content size. A length basis means `width` is ignored on the main axis entirely.

**★ Why does `flex: 1` give equal columns while `flex: auto` does not?**
`flex: 1` expands to `1 1 0%`, so every base size is zero and the *entire*
container is free space divided by the grow factors — equal thirds for three
items. `flex: auto` is `1 1 auto`, so base sizes are the content sizes and only
the leftover is shared equally, preserving content differences.

**★ What is the hypothetical main size?**
The flex base size clamped between the item's min and max main sizes. It is what
the container uses to compute free space, not the item's final size. Its `min`
half is usually the automatic minimum size rather than zero.

**When does `flex-shrink` matter and when is it ignored?**
Only when free space is negative. If items already fit, the grow stage runs and
`flex-shrink` is never consulted — the two branches are mutually exclusive on a
given line.

**How is free space calculated?**
Container inner main size minus the sum of all items' hypothetical main sizes,
their margins, and any gaps. Positive triggers growing, negative triggers
shrinking, zero triggers neither.

**Why might `flex-basis: 50%` not work?**
Percentages resolve against the container's inner main size. If that size is
indefinite — typically a column container sized by its own content — there is
nothing to resolve against and the basis behaves as `auto`.

---

Next: [02 · Growing and shrinking](./02-grow-and-shrink.md) →
