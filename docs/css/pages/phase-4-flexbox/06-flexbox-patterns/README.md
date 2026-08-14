---
title: "Flexbox patterns that carry real applications"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification and **MDN — [Typical use cases of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Typical_use_cases_of_flexbox)**.

**The patterns are not tricks — they are the algorithm applied deliberately.**
Each one below is three or four declarations, and every one of them traces back
to a mechanism from topics 01–05.

| # | Chunk | Patterns |
|---|---|---|
| 01 | **[Bars and shells](./01-bars-and-shells.md)** | Nav bar with a pushed group · media object · sticky footer · input with button · wrapping toolbar |
| 02 | **[Truncation and the squeeze](./02-truncation-and-the-squeeze.md)** | The truncating middle item (the phase gate) · nominating what gives way · weighted shrink · middle truncation · wrap vs truncate |

## The rule underneath all of them

> **Exactly one item should absorb the squeeze. Everything else gets
> `flex: none`.**

A layout where several items are shrinkable degrades everywhere and gracefully
nowhere — icons squash, buttons truncate, and nothing is clean. Nominating a
single flexible item makes the failure mode a design decision instead of an
accident.

## The three lines that do the real work

Across every pattern here, one of these is the load-bearing declaration — and it
is the one a future reader is most likely to delete as redundant:

- `margin-inline-start: auto` — the pushed group
- `flex: 1` on a main region — the sticky footer
- `min-inline-size: 0` — every truncation, every scroll container

## Phase gate

You can build a nav bar whose middle item truncates with an ellipsis while the
right-hand group stays fixed — and explain exactly why it needed `min-width: 0`.

## Where this connects

- **← [02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md)** —
  `min-inline-size: 0` appears in almost every pattern here.
- **← [01 · The alignment stage](../01-the-flex-sizing-algorithm/03-the-alignment-stage.md)** —
  auto margins claim free space before `justify-content` runs.
- **→ [07 · Flexbox and text overflow](../07-flexbox-and-text-overflow.md)** —
  the truncation chain on its own.

---

← [Phase 4 overview](../README.md) · Start → [01 · Bars and shells](./01-bars-and-shells.md)
