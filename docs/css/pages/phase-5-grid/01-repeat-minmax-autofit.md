---
title: "repeat(), minmax(), auto-fit vs auto-fill"
sidebar_label: "01 · repeat(), minmax(), auto-fit"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`repeat()`](https://developer.mozilla.org/en-US/docs/Web/CSS/repeat)**
> and [`minmax()`](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax), and the
> **W3C CSS Grid Layout Level 1** specification
> ([§7.2.3 Repeating rows and columns](https://www.w3.org/TR/css-grid-1/#auto-repeat)).
> Baseline: **Widely available** — Grid and `minmax()` are universally supported.

**One declaration replaces a stack of breakpoints.** This is the highest-leverage
single idiom in modern CSS layout, and it is worth being able to write from
memory.

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1rem;
}
```

Four columns on a wide screen, two on a tablet, one on a phone — with **no media
query at all**, and correct at every width in between rather than at the three
you happened to pick.

## Reading it inside out

```
minmax(20rem, 1fr)      →  each column: at least 20rem, at most an equal share
repeat(auto-fit, …)     →  as many such columns as fit, then collapse the empties
```

The container does the arithmetic. It computes how many 20rem columns fit in the
available inline size (accounting for `gap`), creates that many, and then `1fr`
distributes any leftover space equally among them so there is no ragged right
edge.

**`gap` is handled for you.** This is a genuine advantage over the flexbox
equivalent, where a percentage basis has to be adjusted with `calc()` to account
for gaps — see
[Phase 4 · Choosing a basis](../phase-4-flexbox/03-the-flex-shorthand/02-choosing-a-basis.md).

## `auto-fit` vs `auto-fill` — the actual difference

Both create as many tracks as fit. They differ in what happens to tracks that end
up **empty**:

> "The `auto-fit` value behaves the same as `auto-fill`, except that after placing
> the grid items any empty repeated tracks are collapsed. … A collapsed track is
> treated as having a single fixed track sizing function of `0px`, and the gutters
> on either side of it collapse."
>
> — MDN, *`repeat()`*

So with a 1200px container, `minmax(20rem, 1fr)` (20rem = 320px) and **two** items:

| | Tracks created | Empty tracks | Result |
|---|---|---|---|
| `auto-fill` | 3 | 1, **kept at 320px+** | two cards at ~320px, a gap where the third would be |
| `auto-fit` | 3 | 1, **collapsed to 0** | two cards stretched to ~590px each, filling the row |

**The difference is invisible when the items fill every track.** It only shows
when the item count is smaller than the track count — which is exactly the case
people test last.

Choosing between them:

- **`auto-fit`** when the items should always fill the row. Cards, tiles, a
  gallery. This is the common answer.
- **`auto-fill`** when the column rhythm should stay constant regardless of how
  many items exist — a grid that must align with a header row above it, or a
  layout where two items should *not* stretch to half the page each.

A single item in an `auto-fit` grid stretches to the **whole** container width,
which is often surprising and occasionally wrong. `auto-fill` keeps it one column
wide.

## Why the `1fr` maximum matters

Without it the columns do not grow:

```css
grid-template-columns: repeat(auto-fit, 20rem);        /* fixed 20rem columns */
grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));  /* grow to fill */
```

The first leaves a ragged remainder on the right. The second distributes it. The
`minmax()` is what turns "as many as fit" into "as many as fit, filling the
space".

## The trap: `minmax(20rem, 1fr)` overflows on narrow screens

The minimum is a **hard** floor. A 20rem minimum in a 320px viewport produces a
column wider than the viewport, and the grid overflows horizontally — the one
real flaw in this idiom.

The fix is to make the minimum itself responsive:

```css
grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
```

`min(20rem, 100%)` reads as "20rem, but never wider than the container". On a
wide screen the minimum is 20rem and behaves as before; on a narrow screen it
collapses to 100% and gives a single full-width column instead of overflow.

**This is the production-ready form of the idiom**, and the version worth
committing to memory:

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1rem;
}
```

## The restriction on combining repeats

`auto-fit` and `auto-fill` need to know how many tracks fit, which means every
track in the template must have a definite maximum. The spec therefore forbids
combining an automatic repeat with intrinsic or flexible sizing elsewhere:

```css
/* ❌ invalid — auto-fill cannot be combined with intrinsic sizes */
grid-template-columns: repeat(auto-fill, 10px) repeat(2, minmax(min-content, max-content));

/* ✅ valid — fixed repeats may accompany an automatic one */
grid-template-columns: repeat(auto-fill, 10px) repeat(2, 250px);
```

The whole declaration is dropped when this is violated, with no error — so a
grid that suddenly lays out as a single column is worth checking against this
rule.

## Trade-off

**You gain correctness at every width and lose control at specific widths.** With
breakpoints you can say "exactly three columns on a tablet"; with `auto-fit` you
say "about 20rem each" and accept whatever count that produces. When a design has
been specified per-breakpoint, the translation is imprecise and a designer may
reasonably object that the tablet view now shows two columns rather than three.

There is also a debugging cost: the column count is emergent, so "why are there
three columns here" is answered by arithmetic on the container width, the
minimum, and the gap — not by reading a media query.

The honest guidance is that `auto-fit` suits content grids where the item count
varies and the exact column count does not matter — which is most galleries,
card lists and dashboards. A designed page shell with named regions is a job for
`grid-template-areas`, not for `auto-fit`.

## Gotchas

**The grid overflows on small screens.**
*Symptom:* horizontal scrolling on a phone.
*Cause:* `minmax(20rem, 1fr)` has a hard 20rem floor wider than the viewport.
*Fix:* `minmax(min(20rem, 100%), 1fr)`.

**A single item stretches across the whole container.**
*Symptom:* one card fills the full width.
*Cause:* `auto-fit` collapsed every empty track, leaving one track to absorb
everything.
*Fix:* `auto-fill` if the column rhythm should be preserved.

**`auto-fit` and `auto-fill` appear identical.**
*Symptom:* no visible difference when testing.
*Cause:* the items filled every available track, so no track was empty.
*Fix:* nothing is wrong — test with fewer items than columns to see the
difference.

**Columns do not grow to fill the row.**
*Symptom:* a ragged gap on the right.
*Cause:* a fixed track size rather than a `minmax(…, 1fr)` maximum.
*Fix:* add the `1fr` maximum.

**The whole template is ignored.**
*Symptom:* the grid renders as a single column.
*Cause:* an automatic repeat combined with intrinsic or flexible sizing
elsewhere in the same declaration — invalid, so the declaration is dropped.
*Fix:* use fixed sizes for the accompanying repeats.

## Interview questions

**★ Write a responsive card grid with no media queries, and explain it.**
`grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr))`.
`minmax` gives each column a 20rem floor and a `1fr` ceiling so leftover space is
shared; `auto-fit` creates as many columns as fit and collapses empty ones; the
`min(20rem, 100%)` stops the floor exceeding the viewport on small screens.

**★ What is the difference between `auto-fit` and `auto-fill`?**
Both create as many tracks as fit. `auto-fit` then collapses any track that ended
up empty to `0px`, so the remaining items stretch to fill the row. `auto-fill`
keeps the empty tracks, preserving the column rhythm. The difference is only
visible when there are fewer items than tracks.

**★ Why does `repeat(auto-fit, minmax(20rem, 1fr))` overflow on a phone?**
The 20rem minimum is a hard floor. If the viewport is narrower than 20rem the
column still claims 20rem and the grid overflows. `min(20rem, 100%)` as the
minimum fixes it.

**Why is Grid better than flexbox for this layout?**
Grid accounts for `gap` when computing how many tracks fit; the flexbox
equivalent needs `calc()` to subtract the gaps from a percentage basis. Grid also
keeps columns aligned across rows, where flex lets each line size independently.

**What happens if you use a fixed track size instead of `minmax()`?**
The columns do not grow, so leftover space collects as a ragged gap at the end of
each row rather than being distributed.

**Why might a whole `grid-template-columns` declaration be ignored?**
Combining an automatic repeat (`auto-fit`/`auto-fill`) with intrinsic or flexible
track sizes elsewhere in the same declaration is invalid, and the entire
declaration is dropped silently.

---

Next: [02 · `fr` and the track sizing algorithm](./02-fr-and-track-sizing.md) →
