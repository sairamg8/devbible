---
title: "The flex shorthand, properly"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§7.2](https://www.w3.org/TR/css-flexbox-1/#flex-property)) and
> **MDN — [`flex`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex)**.

**`flex: 1` expands to `1 1 0%`, not `1 1 auto`.** The shorthand deliberately
overrides its own longhand's initial value, and that one fact explains both why
`flex: 1` gives equal columns and why it ignores your `width`.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What the values mean](./01-what-the-values-mean.md)** | The full expansion table, the four values worth naming, why the spec pushes the shorthand |
| 02 | **[Choosing a basis](./02-choosing-a-basis.md)** | The decision procedure, `flex: 1 1 20rem` as a wrap threshold, fixed panel + flexible body, gap arithmetic |

## The table, condensed

| Written | Expands to |
|---|---|
| `flex: 1` | `1 1 0%` — equal columns, content ignored |
| `flex: auto` | `1 1 auto` — content size plus an equal share of the leftover |
| `flex: initial` | `0 1 auto` — the untouched default |
| `flex: none` | `0 0 auto` — natural size, immovable |
| `flex: 200px` | `1 1 200px` — starts at 200px, then grows |

## Phase gate

You can write the right `flex` value for a sidebar, a card grid and a toolbar
without trial and error, and say what each expands to.

## Where this connects

- **← [01 · The flex sizing algorithm](../01-the-flex-sizing-algorithm/README.md)** —
  the shorthand is just the three inputs that algorithm reads.
- **→ [04 · `flex-basis` vs `width`](../04-flex-basis-vs-width.md)** — why a
  definite basis makes `width` irrelevant on the main axis.
- **← [Phase 2 · The shorthand reset trap](../../phase-2-cascade/04-the-shorthand-reset-trap.md)** —
  the general rule behind the spec's advice to prefer the shorthand.

---

← [Phase 4 overview](../README.md) · Start → [01 · What the values mean](./01-what-the-values-mean.md)
