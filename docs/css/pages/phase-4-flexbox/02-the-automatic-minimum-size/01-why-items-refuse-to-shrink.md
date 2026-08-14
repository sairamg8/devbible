---
title: "Why flex items refuse to shrink"
sidebar_label: "01 · Why items refuse to shrink"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§4.5 Automatic minimum size of flex items](https://www.w3.org/TR/css-flexbox-1/#min-size-auto))
> and **MDN — [`min-width`](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width)**
> and the [flexbox sizing guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis).

**A flex item will not shrink below the size of its content, even when you told
it to.** This is the single most common flexbox bug, it is specified behaviour,
and the fix is one declaration — but only once you can recognise it.

## The symptom

You have a two-item row. One item contains a long string — a URL, an email
address, a filename, an untranslated label. Instead of that item truncating, it
pushes its sibling out of the container, or forces a horizontal scrollbar on the
whole page.

```css
.row   { display: flex; inline-size: 400px; }
.title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { flex: 0 0 80px; }
```

Everything looks correct. `flex: 1` says the title may shrink; `text-overflow`
says truncate it. The row overflows anyway.

## The cause

In flex layout, `min-width`'s initial value is **`auto`**, not `0`. Outside flex
layout `min-width: auto` computes to `0`, which is why this behaviour is
unfamiliar. Inside a flex container it resolves to a **content-based minimum**.

The specification defines that minimum as the smallest of the item's applicable
size suggestions — in practice, for ordinary text content, the item's
**min-content size**: the width of its longest unbreakable run of text.

So the item's real floor is not zero. It is "as wide as the longest word", and
`flex-shrink` cannot take it below that. Recall from
[01 · The flex sizing algorithm](../01-the-flex-sizing-algorithm/README.md) that
the shrink stage **freezes** any item that hits its minimum and redistributes the
remaining deficit to the others — which is why one long word can crush every
sibling while looking innocent itself.

The three size suggestions the spec considers:

| Suggestion | What it is |
|---|---|
| **content size suggestion** | the item's min-content size — the longest unbreakable run |
| **specified size suggestion** | the item's own `width`/`height`, if definite |
| **transferred size suggestion** | for replaced elements with an aspect ratio, the size implied by the other axis |

For a text-bearing `div`, the content size suggestion is the one that bites.

## The fix

```css
.title { flex: 1; min-inline-size: 0; }
```

`min-width: 0` (or the logical `min-inline-size: 0`) replaces the automatic
minimum with a real zero, and the item becomes shrinkable to nothing. Combined
with the truncation properties it now behaves as intended:

```css
.title {
  flex: 1;
  min-inline-size: 0;              /* ← the line that makes it work */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**`overflow` also disables it.** The specification suppresses the automatic
minimum size when the item's `overflow` on that axis is anything other than
`visible`. So `overflow: hidden` alone often fixes the same bug — which is why
the problem sometimes vanishes for reasons that seem unrelated, and why adding
`overflow: auto` to debug something can accidentally "fix" it and hide the cause.

Prefer `min-width: 0`: it states the intent, and it does not create a scroll
container as a side effect.

## Why it exists — and why the default is right

It is tempting to call this a design mistake. It is not, and the reason matters
for knowing when *not* to override it.

Without a content-based floor, `flex-shrink` would happily reduce items to zero
width whenever a container was narrow enough. Every flex layout would collapse
into unreadable slivers at small widths, and every author would have to set a
`min-width` on every item to prevent it. The default protects the common case:
**content stays legible unless you explicitly say it may be clipped.**

`min-width: 0` is you making that statement. It is a deliberate opt-in to
truncation, which is why it pairs so naturally with `text-overflow: ellipsis` —
the two together say "this may be cut, and here is how to show it".

## In a column: the same rule, the other axis

The main axis of a column container is vertical, so the property is
`min-height`:

```css
.stack { display: flex; flex-direction: column; block-size: 300px; }
.body  { flex: 1; min-block-size: 0; overflow-y: auto; }
```

Without `min-block-size: 0`, a scrollable region inside a column flex container
grows to its content height instead of scrolling — the vertical twin of the
horizontal bug, and the reason a chat panel or a modal body refuses to scroll.

This one is arguably more common in application UI than the horizontal case, and
far less recognised.

## Nesting makes it worse

The floor propagates. A nested flex item needs `min-width: 0` at **every level**
between the container and the text:

```css
.outer { display: flex; }
.mid   { flex: 1; min-inline-size: 0; }   /* needed */
.inner { flex: 1; min-inline-size: 0; }   /* also needed */
.text  { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

Missing it on any single level reintroduces the floor for the whole chain. This
is why the bug so often appears to be "fixed and then not fixed" as markup is
refactored — a new wrapper reintroduced the minimum.

## Trade-off

**Turning the floor off makes layouts robust and content losable.** With
`min-width: 0` an item can be reduced to a few pixels, and if you did not also
provide truncation the text simply overflows its box invisibly, or wraps into a
tall thin column. The default at least fails *visibly*.

There is also a real risk of over-applying it. A blanket
`.flex > * { min-width: 0 }` in a base layer removes the protection everywhere,
including from items that genuinely should push back — a button whose label must
stay readable, a numeric column that must not clip. Those items then collapse
silently at narrow widths, which is a worse bug than the one you removed, because
it appears only on small screens.

The honest guidance: apply it to the **one** item that is meant to absorb the
squeeze — usually the flexible text — and pair it with truncation in the same
rule so the two are never separated.

## Gotchas

**`flex: 1` does not make an item shrinkable.**
*Symptom:* the item stays as wide as its longest word.
*Cause:* `min-width: auto` gives it a content-based floor that `flex-shrink`
cannot cross.
*Fix:* `min-inline-size: 0` on that item.

**`text-overflow: ellipsis` never appears.**
*Symptom:* the text overflows rather than truncating.
*Cause:* the item never shrank, so there is nothing to truncate.
*Fix:* the same `min-inline-size: 0` — the truncation properties are correct and
were never reached.

**A scroll area in a column layout does not scroll.**
*Symptom:* the region grows to fit its content and the whole page scrolls.
*Cause:* `min-height: auto` on the main axis of a column container.
*Fix:* `min-block-size: 0` on the flexible child.

**Adding `overflow: hidden` fixed it and nobody knows why.**
*Symptom:* an unrelated change resolved the bug.
*Cause:* a non-`visible` `overflow` suppresses the automatic minimum size.
*Fix:* nothing is broken, but prefer `min-width: 0` so the intent is explicit and
you do not create an unwanted scroll container.

**It works at one nesting level and breaks after a refactor.**
*Symptom:* wrapping the content in a new `div` reintroduces the overflow.
*Cause:* the new wrapper is itself a flex item with `min-width: auto`.
*Fix:* `min-inline-size: 0` on every flex item in the chain.

## Interview questions

**★ Why does a flex item refuse to shrink below its content size?**
Because `min-width`'s initial value in flex layout is `auto`, which resolves to a
content-based minimum — effectively the item's min-content size, the longest
unbreakable run of text. `flex-shrink` cannot take an item below its minimum, so
the item is frozen there and the remaining deficit is redistributed to its
siblings.

**★ What are the two ways to disable the automatic minimum size, and which is
preferable?**
`min-width: 0` (or `min-height: 0` on a column's main axis), or setting
`overflow` to anything other than `visible`. Prefer `min-width: 0`: it states the
intent and does not create a scroll container as a side effect.

**★ Why does `text-overflow: ellipsis` often fail inside flexbox?**
Because the item never shrank. The truncation properties are correct but
unreachable — the automatic minimum size kept the box at its content width, so
there was no overflow to truncate. Adding `min-width: 0` makes them work.

**Why is this the default rather than `min-width: 0`?**
Without a content floor, `flex-shrink` would crush items to zero at narrow
widths and every author would have to set a minimum on every item. The default
keeps content legible unless truncation is explicitly opted into.

**What is the column-direction equivalent?**
`min-height: 0` on the flexible child — the reason a scrollable panel inside a
column flex container grows instead of scrolling.

**Why can the fix stop working after adding a wrapper element?**
The automatic minimum applies to every flex item in the chain. A new wrapper is a
flex item with `min-width: auto`, so it reintroduces the floor even though the
inner element still has the fix.

---

Next: [02 · Diagnosing it in a real layout](./02-diagnosing-it.md) →
