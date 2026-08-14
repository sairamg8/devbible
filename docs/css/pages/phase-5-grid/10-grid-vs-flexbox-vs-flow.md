---
title: "Grid vs flexbox vs flow"
sidebar_label: "10 · Grid vs flexbox vs flow"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **MDN — [Relationship of grid layout to other layout methods](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Relationship_of_grid_layout_with_other_layout_methods)**
> and the **W3C CSS Grid Layout Level 1** and **CSS Flexible Box Layout Level 1**
> specifications.

**A decision procedure, not a preference.** The two systems answer different
questions, and normal flow — which needs no declaration at all — answers more of
them than people expect.

## The one-line distinction

> **Flexbox distributes space along *one* axis. Grid positions items in *two*
> axes simultaneously.**

That is accurate but too abstract to decide with. The practical version:

> **Does the alignment across rows matter?**
> If yes, Grid. If each line can size itself independently, Flexbox.

A wrapped flex container's lines are independent — the items on row two know
nothing about row one and will not line up with it. A grid's columns are shared
by every row by construction.

## The decision procedure

1. **Can normal flow do it?** Block elements already stack full-width with
   margins; inline content already wraps. If you are writing
   `display: flex; flex-direction: column` on a container whose children are
   block-level and full-width, you have reimplemented normal flow — usually just
   to get `gap`, which is a fair reason but worth knowing.
2. **Is it one row or one column of items, sized by their content?** Flexbox.
   Nav bars, toolbars, button groups, a label beside an input.
3. **Do items need to align across rows *and* columns?** Grid. Card grids where
   the internals line up, tables, dashboards, page shells.
4. **Is it the page-level skeleton?** Grid, with named areas — it rearranges in
   one media query.
5. **Do items overlap?** Grid. A single-cell stack keeps everything in flow;
   absolute positioning does not.

## Where each is clearly right

| Layout | Use | Why |
|---|---|---|
| Nav bar with a pushed group | **Flex** | one axis, content-sized items, auto margins |
| Page shell (header/sidebar/main/footer) | **Grid** | named areas, rearranges in one query |
| Card grid, count does not matter | **Grid** | `auto-fit` + `minmax()`, gap-aware |
| A row of buttons that wraps | **Flex** | lines size independently, natural widths |
| Form: labels aligned with inputs | **Grid** | column alignment across rows (subgrid) |
| Media object (image + text) | **Flex** | one axis, one item absorbs the rest |
| Overlay / stacked layers | **Grid** | single cell, parent still sizes to content |
| Article prose | **Flow** | it already works; do not wrap it in anything |

## The pairs that decide it

**Card grid: flex or grid?** Both work until the last row. Flex stretches the
final row's items to fill the line; grid keeps the column rhythm and leaves a gap.
Grid also handles `gap` arithmetic natively where flex needs `calc()`
([Phase 4](../phase-4-flexbox/03-the-flex-shorthand/02-choosing-a-basis.md)).
**Grid unless you specifically want the last row to fill.**

**Toolbar: flex or grid?** Flex. The items are content-sized, there is one axis,
and `flex: none` plus `flex-wrap: wrap` is exactly right. A grid would need track
definitions for items whose widths you do not know.

**Sidebar + main: flex or grid?** Either works; grid is marginally better because
`grid-template-columns: minmax(200px, 240px) minmax(0, 1fr)` states both columns
in one declaration, where flex needs a rule on each child.

## They nest, and usually should

The two are not alternatives at the page level — most real interfaces are a grid
shell containing flex components:

```css
.app    { display: grid; grid-template-areas: /* … */; }   /* the skeleton */
.header { display: flex; align-items: center; gap: 1rem; } /* one axis */
.cards  { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(18rem,100%), 1fr)); }
```

**Grid for the skeleton, flex for the components** is a reliable default, and it
matches how the two systems' strengths divide.

## What they share

Worth knowing so the knowledge transfers rather than doubling:

- **`gap`** works identically in both (and in multi-column).
- **Box alignment** — `justify-*`, `align-*`, `place-*` — is one specification
  applied to both, though `justify-*` swaps axis with `flex-direction` in flexbox
  and never does in grid.
- **The content-minimum problem** is the same mechanism with two spellings:
  `min-width: 0` in flexbox, `minmax(0, 1fr)` in grid.

That last one is the single most transferable fact in these two phases.

## Trade-off

**Choosing by rule is faster than choosing by preference and occasionally picks
the harder tool.** "Alignment across rows → grid" is right almost always, and it
will send you to grid for a layout that a two-line flex rule would have handled,
because the alignment turned out not to matter once real content arrived.

The reverse error is more expensive. A card layout built in flex that later needs
its rows aligned cannot be patched — it needs rebuilding in grid, and by then
every card has flex-specific sizing rules.

Given asymmetric costs, **when genuinely undecided, choose grid for collections
and flex for single-axis chrome.** The one thing not to do is choose by
familiarity; flexbox being older is not a reason, and a great deal of production
CSS is flexbox reimplementing grid badly.

## Gotchas

**A wrapped flex layout does not line up in columns.**
*Symptom:* items on row two do not align with row one.
*Cause:* flex lines are independent by design.
*Fix:* grid — this is the defining difference.

**A flex card grid's last row stretches oddly.**
*Symptom:* two remaining cards become half-width each.
*Cause:* `flex-grow` distributing the line's free space.
*Fix:* grid with `auto-fill` if the rhythm should persist, or accept it.

**Percentage widths overflow with a gap.**
*Symptom:* four 25% flex items wrap to three per row.
*Cause:* `gap` is added on top of the percentages.
*Fix:* grid, whose `fr` unit is computed after gaps.

**A column flex container was used where flow would do.**
*Symptom:* no visible difference from removing it.
*Cause:* block children already stack full-width.
*Fix:* keep it only if you want `gap`; otherwise delete it.

**Absolute positioning collapsed the parent.**
*Symptom:* the container has no height.
*Cause:* out-of-flow children do not size their parent.
*Fix:* a single-cell grid with `grid-area: 1 / 1` on the children.

## Interview questions

**★ How do you decide between grid and flexbox?**
Ask whether alignment *across* rows matters. Flex lines are independent — items
on the second row will not align with the first — so anything needing column
alignment across rows is grid. One-axis, content-sized arrangements are flex.

**★ Give a case where flexbox is clearly right and one where grid is.**
Flex: a nav bar with a pushed group — one axis, content-sized items, an auto
margin does the work. Grid: a page shell with header, sidebar, main and footer —
named areas rearrange it in one media query with no item rules changed.

**★ Should grid and flexbox be used together?**
Yes, and usually are: grid for the page skeleton, flex for components inside it.
They are not competing choices at the same level.

**When is normal flow the right answer?**
More often than assumed. Block elements already stack full-width and text already
wraps. A column flex container over block children mostly just adds `gap` — a
fair reason, but worth recognising as the only one.

**What transfers between the two systems?**
`gap`, the box-alignment properties, and the content-minimum problem —
`min-width: 0` in flexbox is `minmax(0, 1fr)` in grid, the same mechanism with two
spellings.

**Why prefer grid when undecided?**
The costs are asymmetric. A grid layout that did not need column alignment is
mildly over-engineered; a flex layout that later needs it must be rebuilt, by
which time every item carries flex-specific sizing.

---

← [09 · Explicit vs implicit grid](./09-explicit-vs-implicit-grid.md) · Back to [Phase 5 overview](./README.md)
