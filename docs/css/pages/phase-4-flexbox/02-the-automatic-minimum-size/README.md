---
title: "The automatic minimum size"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§4.5 Automatic minimum size of flex items](https://www.w3.org/TR/css-flexbox-1/#min-size-auto))
> and the **MDN** flexbox and sizing references.

**The single most common flexbox bug.** A flex item will not shrink below its
content's min-content size, because `min-width`'s initial value in flex layout is
`auto` rather than `0`. `min-width: 0` is the fix — and knowing *why* it is the
default tells you when not to apply it.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Why items refuse to shrink](./01-why-items-refuse-to-shrink.md)** | The specified behaviour, the three size suggestions, both fixes, the column case, nesting |
| 02 | **[Diagnosing it](./02-diagnosing-it.md)** | Recognising it in code you did not write, reading it in DevTools, the three bugs that share this cause |

## The rule in one line

> In flex layout `min-width: auto` resolves to a **content-based minimum**, and
> `flex-shrink` cannot take an item below its minimum.

Two ways to switch it off: `min-width: 0` (explicit, preferred), or any
`overflow` value other than `visible` (implicit, and the reason the bug sometimes
disappears for apparently unrelated reasons).

## The three symptoms to recognise

All the same cause, and none of them looks like a minimum-size problem:

| Symptom | Where |
|---|---|
| `text-overflow: ellipsis` never truncates | row layouts, nav bars, breadcrumbs |
| a scroll panel grows instead of scrolling | **column** layouts — `min-height: auto` |
| one long URL blows out the whole layout | anywhere; needs `overflow-wrap` too |

## Phase gate

You can look at an overflowing flex container and name the frozen item before
changing any code.

## Where this connects

- **← [01 · The flex sizing algorithm](../01-the-flex-sizing-algorithm/README.md)** —
  this is the `min` half of the stage-one clamp, and the reason the shrink loop
  freezes items and redistributes their deficit.
- **→ [07 · Flexbox and text overflow](../07-flexbox-and-text-overflow.md)** —
  the complete truncation chain, of which `min-width: 0` is the first link.
- **→ Phase 5 · Grid** — `minmax(0, 1fr)` is this exact problem in grid, for
  exactly the same reason.

---

← [Phase 4 overview](../README.md) · Start → [01 · Why items refuse to shrink](./01-why-items-refuse-to-shrink.md)
