---
title: "The flex sizing algorithm"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification (§8, §9.2, §9.5, §9.7) and the corresponding **MDN** guides.
> Baseline: **Widely available** — flexbox is universally supported.

**Almost every "flexbox is weird" moment is this algorithm doing exactly what it
says.** It runs in three stages, in order, and each stage hands a finished number
to the next. Debugging flexbox is almost always a matter of working out *which
stage* produced the surprise.

| # | Chunk | The stage it covers |
|---|---|---|
| 01 | **[Base sizes](./01-base-sizes.md)** | `flex-basis` → flex base size → hypothetical main size → free space |
| 02 | **[Grow and shrink](./02-grow-and-shrink.md)** | Distributing surplus by grow factor, deficit by **grow factor × base size** |
| 03 | **[The alignment stage](./03-the-alignment-stage.md)** | Positioning whatever space stage two did not consume |

## The three stages in one place

1. **Base sizes.** Each item gets a flex base size from `flex-basis` — a length,
   or a redirect to `width`, or the content size. Clamped by min/max, this is the
   *hypothetical main size*. Sum them, subtract from the container: that is the
   **free space**.
2. **Grow or shrink.** Positive free space is divided by `flex-grow` factors.
   Negative free space is divided by `flex-shrink` × base size. Never both, and
   any item that hits a min or max is frozen and its share redistributed.
3. **Alignment.** Whatever space stage two did not consume is positioned by
   `justify-content`, auto margins, and the cross-axis properties.

## Three results worth carrying out of this topic

- **`flex: 1` is `1 1 0%` and `flex: auto` is `1 1 auto`.** The first makes every
  base size zero, so the container is entirely surplus and items end up equal.
  The second keeps content-derived bases and shares only the leftover.
- **Shrinking is weighted by base size, growing is not.** Two items with
  `flex-shrink: 1` lose the same *proportion*, not the same pixels — which is
  why a 400px item gives up more than a 300px one.
- **Alignment only distributes what flexing left behind.** `justify-content`
  doing nothing is almost always a sign that `flex-grow` already took the space.

## Phase gate

You can predict what happens when the content is wider than the container —
which item shrinks, by how much, and why — before opening DevTools.

## Where this connects

- **→ [02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md)** —
  the `min` half of the stage-one clamp, and the reason items so often refuse to
  shrink at all.
- **→ [03 · The `flex` shorthand](../03-the-flex-shorthand/README.md)** — the
  three numbers this whole algorithm reads, and what the keywords expand to.
- **→ Phase 5 · Grid** — `minmax(0, 1fr)` is this same content-floor problem in
  the other layout system.

---

← [Phase 4 overview](../README.md) · Start → [01 · Base sizes](./01-base-sizes.md)
