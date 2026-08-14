---
title: "The minmax(0, 1fr) fix"
sidebar_label: "03 · The minmax(0, 1fr) fix"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Grid Layout Level 1** specification
> ([§7.2.3](https://www.w3.org/TR/css-grid-1/#fr-unit),
> [§6.6 Automatic minimum size of grid items](https://www.w3.org/TR/css-grid-1/#min-size-auto))
> and **MDN — [`minmax()`](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax)**.

**The grid equivalent of `min-width: 0`, needed for the same reason and missed
just as often.** A track sized `1fr` carries a hidden content floor; `minmax(0, 1fr)`
removes it.

## The two floors, and why one fix is not enough

Grid has the content-minimum problem at **two levels**, and this catches people
who have already learned the flexbox version:

1. **The track** — `1fr` means `minmax(auto, 1fr)`, so the *column* will not
   shrink below its content's min-content size.
2. **The grid item** — a grid item's `min-width` also computes to `auto` and
   resolves to a content-based minimum, exactly as in flexbox.

Fixing one and not the other leaves the layout broken in a way that looks
identical, which is why "I already added `minmax(0, 1fr)` and it still overflows"
is such a common report.

```css
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);   /* fixes the TRACK */
}
.grid > * {
  min-inline-size: 0;                                     /* fixes the ITEM */
}
```

For most layouts the track fix alone is enough, because the item is allowed to
shrink with its track. The item fix becomes necessary when the item is itself a
flex or grid container, or when it holds something with a large intrinsic width.

## The three symptoms

All the same cause.

### 1. Equal columns that are not equal

```css
grid-template-columns: 1fr 1fr;
```

One cell contains a long unbroken string; that column exceeds its half and the
other is squeezed. The declaration says "equal" and the result is not.

### 2. A nested scroll container that will not scroll

```css
.layout { display: grid; grid-template-columns: 240px 1fr; }
.main   { overflow-x: auto; }        /* does not scroll — grows instead */
```

The `1fr` track expands to its content's min-content width, so the content never
overflows the track and `overflow-x` has nothing to do. `minmax(0, 1fr)` restores
it.

This is the direct analogue of the flexbox column-scroll bug from
[Phase 4 · Diagnosing it](../phase-4-flexbox/02-the-automatic-minimum-size/02-diagnosing-it.md),
and equally unrecognised.

### 3. A table or code block blowing out the page

A `<pre>` or a wide `<table>` inside a `1fr` track sets an enormous min-content
size, and the whole page gains a horizontal scrollbar. The grid is doing what it
was told: never shrink a track below its content.

```css
.article { display: grid; grid-template-columns: minmax(0, 1fr); }
.article pre { overflow-x: auto; }    /* now the pre scrolls, not the page */
```

A single-column grid with `minmax(0, 1fr)` is a genuinely useful defensive
pattern for article layouts, where the content is unknown.

## What it does not fix

`minmax(0, 1fr)` allows the **track** to be narrow. It says nothing about the
content inside it, which will simply overflow the cell instead of the container:

```css
.cell { min-inline-size: 0; overflow-wrap: break-word; }   /* let the text break */
.cell { overflow: hidden; }                                 /* or clip it */
.cell { overflow-x: auto; }                                 /* or scroll it */
```

Pick one deliberately — the three failure modes from
[Phase 4 · Flexbox and text overflow](../phase-4-flexbox/07-flexbox-and-text-overflow.md)
apply identically here.

## Should you write it everywhere?

Some teams adopt `minmax(0, 1fr)` as the default and never write bare `1fr`. The
argument is strong: the automatic minimum is invisible in the declaration, it
only manifests with real content, and the failure is a broken layout rather than
a graceful one.

The counter-argument is equally real. The content floor exists so that tracks do
not collapse to unusable widths, and removing it globally means a column can be
squeezed to a few pixels with no signal at all — a worse bug, appearing only at
narrow widths.

A workable middle position:

- **Use `minmax(0, 1fr)`** wherever content is variable, user-supplied,
  translated, or may contain code, URLs or tables.
- **Use plain `1fr`** where the content is known and short — a row of icons, a
  fixed set of labels — and should be able to push back.

Whichever you choose, be consistent within a component, and comment the choice
where it is load-bearing. A future reader will otherwise "simplify"
`minmax(0, 1fr)` back to `1fr` and reintroduce the bug.

## Trade-off

**This fix trades a visible failure for an invisible one.** Bare `1fr` fails
loudly — the layout overflows and someone notices. `minmax(0, 1fr)` fails
quietly: the track shrinks as far as it must, and if the content cannot cope, it
is clipped or spills without changing the page's overall shape.

That is usually the better trade for application layout, because a stable shell
with one awkward cell beats a page-wide horizontal scrollbar. It is the worse
trade for content that must remain legible, where the overflow was a genuine
signal that the layout needs a different structure at that width.

The cost is paid in vigilance: once tracks can shrink to zero, **every** cell
needs an explicit answer to "what happens when this content is too wide" —
break, clip or scroll. Adding the fix without answering that question moves the
bug rather than removing it.

## Gotchas

**`minmax(0, 1fr)` did not fix the overflow.**
*Symptom:* the track is correct, the content still escapes.
*Cause:* the *item's* automatic minimum, or simply unbreakable content.
*Fix:* `min-inline-size: 0` on the grid item, plus `overflow-wrap: break-word` or
an `overflow` value on the content.

**A grid area with `overflow: auto` never scrolls.**
*Symptom:* the region grows and the page scrolls instead.
*Cause:* the `1fr` track expanded to the content's min-content width, so nothing
overflowed the track.
*Fix:* `minmax(0, 1fr)` on that track.

**Columns collapse to nothing at narrow widths.**
*Symptom:* unreadable slivers on a phone.
*Cause:* a blanket `minmax(0, 1fr)` removed the content protection everywhere.
*Fix:* scope the fix to tracks with variable content; give the others a real
minimum such as `minmax(8rem, 1fr)`.

**Someone "simplified" it back to `1fr`.**
*Symptom:* a regression after a tidy-up commit.
*Cause:* the fix looks redundant.
*Fix:* comment it — `/* 0 minimum: cells may contain long URLs */`.

## Interview questions

**★ What does `minmax(0, 1fr)` fix, and why is `1fr` alone not enough?**
`1fr` expands to `minmax(auto, 1fr)`, whose `auto` minimum is the track's
min-content size — so the track will not shrink below its widest unbreakable
content. `minmax(0, 1fr)` replaces that floor with zero, making the track a true
equal share.

**★ You added `minmax(0, 1fr)` and the layout still overflows. What else?**
Grid has two content floors: the track and the item. The grid item's `min-width`
also computes to `auto`, so add `min-inline-size: 0` on the item. If the content
itself is unbreakable, it still needs `overflow-wrap: break-word`, `overflow:
hidden`, or a scroll container.

**★ Why does a scroll container inside a `1fr` track fail to scroll?**
The track grows to the content's min-content width, so the content never exceeds
the track and there is nothing to scroll. `minmax(0, 1fr)` lets the track stay
narrow, at which point `overflow: auto` has something to do.

**Is `minmax(0, 1fr)` a good global default?**
It is defensible for variable or user-supplied content, but it removes the
protection that stops tracks collapsing to unusable widths. A reasonable rule is
to use it where content is unknown and keep plain `1fr` where the content is
known and short.

**What is the flexbox equivalent?**
`min-width: 0` on the flex item. Both override an automatic content-based minimum
that the layout system applies by default.

---

← [02 · `fr` and track sizing](./02-fr-and-track-sizing.md) · Next: [04 · Named areas](./04-named-areas.md) →
