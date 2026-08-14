---
title: "fr and the track sizing algorithm"
sidebar_label: "02 · fr and track sizing"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Grid Layout Level 1** specification
> ([§7.2.3 Flexible lengths](https://www.w3.org/TR/css-grid-1/#fr-unit),
> [§12 Grid sizing](https://www.w3.org/TR/css-grid-1/#layout-algorithm)) and
> **MDN — [`flex_value` (`fr`)](https://developer.mozilla.org/en-US/docs/Web/CSS/flex_value)**.

**`1fr` is not `50%`, and the difference is the gap.** `fr` distributes the space
that is *left over* after fixed tracks, gutters and content minimums are
accounted for — percentages divide the whole container and ignore all of it.

## What `fr` actually means

An `fr` is a share of the **free space** in the grid container: the inline size
remaining after every fixed track, every gap, and every track's content-based
minimum has been satisfied.

```css
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; inline-size: 600px; }
```

Free space is `600px − 2rem (32px) = 568px`, so each column is **284px**.

The percentage version does not subtract the gap:

```css
.grid { display: grid; grid-template-columns: 50% 50%; gap: 2rem; }
/* 300px + 300px + 32px gap = 632px in a 600px container → overflow */
```

**This is the single most useful consequence of the unit**: `fr` cannot overflow
through gap arithmetic, and percentages routinely do. Any time you find yourself
writing `calc(50% - 1rem)` for grid columns, `1fr` is the answer.

## Mixing fixed and flexible tracks

Fixed tracks are subtracted first, then the remainder is split:

```css
grid-template-columns: 240px 1fr 1fr;   /* sidebar + two equal columns */
```

In a 1000px container with no gap: 240px is taken, leaving 760px, so each `1fr`
column is 380px. This is the standard application shell, and it composes cleanly
with `minmax()` for the fixed part:

```css
grid-template-columns: minmax(200px, 240px) 1fr;
```

A sidebar that shrinks from 240px to 200px before the main region starts giving
way.

## Ratios: `2fr` is twice `1fr`, of the free space

```css
grid-template-columns: 2fr 1fr;   /* 2:1 of the free space */
```

Unlike flexbox's `flex-grow` — where the factor divides only the surplus *on top
of* each item's base size ([Phase 4](../phase-4-flexbox/01-the-flex-sizing-algorithm/02-grow-and-shrink.md)) —
grid tracks have no separate base size to add on, so `fr` ratios describe the
final sizes directly. `2fr 1fr` really is two-thirds and one-third.

That makes grid the easier system for proportional layouts. In flexbox the same
result needs `flex: 2 1 0` and `flex: 1 1 0`, with the zero basis doing the work.

### Fractions below 1

A total below `1fr` distributes only that fraction of the free space:

```css
grid-template-columns: 0.5fr 0.5fr;   /* uses all the space — sums to 1 */
grid-template-columns: 0.25fr 0.25fr; /* uses HALF the space; the rest is empty */
```

The same rule as `flex-grow` factors summing below 1, and the same rare
surprise.

## `1fr` means `minmax(auto, 1fr)`

This is the detail that explains almost every grid overflow.

The specification defines the `fr` maximum as carrying an **automatic minimum**:
a track sized `1fr` is really `minmax(auto, 1fr)`, and that `auto` minimum
resolves to the track's **min-content size** — the widest unbreakable thing
inside it.

So `1fr` does not mean "an equal share". It means **"an equal share, but never
smaller than my content"**.

```css
.grid { display: grid; grid-template-columns: 1fr 1fr; }
```

Put a long unbroken URL in the first cell and that column will exceed its equal
share, pushing the second column narrower or overflowing the container entirely.
The track refused to go below its content minimum — exactly the same mechanism as
flexbox's automatic minimum size, in the other layout system.

## The fix: `minmax(0, 1fr)`

```css
grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
```

Setting the minimum explicitly to `0` overrides the automatic minimum and makes
the track a true equal share, free to shrink below its content.

This is the grid equivalent of `min-width: 0` in flexbox, it is needed for
exactly the same reason, and it is the second half of the pair worth learning
together:

| Layout system | The content floor | The override |
|---|---|---|
| Flexbox | `min-width: auto` on the item | `min-width: 0` |
| Grid | `auto` minimum in `1fr` | `minmax(0, 1fr)` |

As with flexbox, `minmax(0, 1fr)` lets the *track* shrink but does not make the
content breakable. A long URL still needs `overflow-wrap: break-word`, or the
item needs `overflow: hidden`, or the text overflows its cell.

Full treatment: [03 · The `minmax(0, 1fr)` fix](./03-the-minmax-zero-fix.md).

## The sizing algorithm, in the order it runs

Worth knowing as a debugging sequence rather than as trivia:

1. **Size the fixed tracks** — lengths and percentages resolve first.
2. **Resolve intrinsic tracks** — `auto`, `min-content`, `max-content` are sized
   against their contents.
3. **Compute the free space** — container size minus fixed tracks, intrinsic
   tracks and all gaps.
4. **Distribute the free space** to `fr` tracks in proportion to their factors,
   clamped by each track's minimum.
5. **Align the tracks** in whatever space remains, via `justify-content` /
   `align-content`.

Step 4's clamp is where `minmax(0, 1fr)` intervenes, and step 5 only ever has
something to do when the `fr` tracks did not consume everything — which is why
`justify-content` on a grid with `1fr` columns appears to do nothing, for exactly
the same reason as in flexbox.

## Trade-off

**`fr` is gap-aware and therefore opaque.** You cannot read a column's width off
the stylesheet, because it depends on the container, the gaps, the fixed tracks
and every cell's content minimum. Percentages are legible and wrong; `fr` is
correct and requires DevTools to inspect.

The second cost is the hidden `auto` minimum. `1fr` reads as "an equal share" and
behaves as one right up until a cell contains something unbreakable, at which
point the layout changes in a way the declaration does not hint at. That is why
some codebases write `minmax(0, 1fr)` **everywhere** as a defensive default.

That is defensible, and it has a real cost: it removes the content protection
that stops a track collapsing to nothing, so cells can be squeezed to unreadable
widths without any signal. Use it where content is variable or user-supplied;
leave plain `1fr` where the content is known and should be able to push back.

## Gotchas

**Two `1fr` columns are not equal.**
*Symptom:* one column is wider despite identical track sizes.
*Cause:* `1fr` is `minmax(auto, 1fr)`, and one column's content has a larger
min-content size.
*Fix:* `minmax(0, 1fr)`.

**A grid with percentage columns overflows.**
*Symptom:* `50% 50%` plus a gap scrolls horizontally.
*Cause:* percentages resolve against the container and ignore the gap, so the
gap is added on top.
*Fix:* `1fr 1fr` — free space is computed after gaps.

**Half the container is empty.**
*Symptom:* tracks do not fill the row.
*Cause:* the `fr` factors sum to less than 1, so only that fraction is
distributed.
*Fix:* raise the factors so they sum to at least 1.

**`justify-content` does nothing on a grid.**
*Symptom:* no effect from any value.
*Cause:* the `fr` tracks consumed all the free space, so there is nothing left to
distribute between tracks.
*Fix:* use fixed track sizes if you want leftover space to align.

**`minmax(0, 1fr)` fixed the layout but the text still escapes.**
*Symptom:* the track is the right width, the content overflows it.
*Cause:* the track may now shrink; the content is still unbreakable.
*Fix:* `overflow-wrap: break-word` or `overflow: hidden` on the grid item.

## Interview questions

**★ Why is `1fr` not the same as `50%` in a two-column grid?**
`fr` distributes the space left after fixed tracks and **gaps** are subtracted;
a percentage resolves against the container and ignores the gap. `50% 50%` with
any gap overflows; `1fr 1fr` never does.

**★ What does `1fr` actually expand to, and why does that matter?**
`minmax(auto, 1fr)`. The `auto` minimum resolves to the track's min-content size,
so a track sized `1fr` will not shrink below its widest unbreakable content —
which is why two `1fr` columns can end up unequal.

**★ What is `minmax(0, 1fr)` and what is its flexbox equivalent?**
It replaces the automatic minimum with a hard zero so the track is a true equal
share and may shrink below its content. It is the direct equivalent of
`min-width: 0` on a flex item, and it exists for the same reason.

**How do `fr` ratios differ from `flex-grow` ratios?**
`fr` describes the final track sizes directly, because grid tracks have no base
size to add the surplus to. `flex-grow` divides only the surplus on top of each
item's base size, so `flex: 2` does not produce a track twice as wide unless the
basis is zero.

**What happens when `fr` factors sum to less than 1?**
Only that fraction of the free space is distributed; the remainder stays empty.

**Why might `justify-content` have no effect on a grid?**
Because `fr` tracks absorbed all the free space. Alignment distributes only what
track sizing left behind.

---

← [01 · `repeat()`, `minmax()`, `auto-fit`](./01-repeat-minmax-autofit.md) · Next: [03 · The `minmax(0, 1fr)` fix](./03-the-minmax-zero-fix.md) →
