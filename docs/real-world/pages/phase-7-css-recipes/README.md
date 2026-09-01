---
title: "Phase 7 — CSS recipes for the storefront"
sidebar_label: "Overview"
sidebar_position: 0
---

> The stylesheet the Phase 4 screens actually need. CSS itself — the cascade,
> grid track sizing, container queries, stacking contexts, the colour
> functions — is the [CSS section](../../../css/README.md), and no chapter here
> re-teaches it. These pages are the **decisions**: which mechanism this
> component needs, what it costs, and the complete rules that ship.

**Prerequisites:** CSS phases 2 (cascade and `@layer`), 3 (custom properties),
5 (grid), 6 (container queries), 7 (positioning), 8 (colour and theming); the
markup from [Phase 4 — The React UI](../phase-4-react-ui/README.md), because
every selector here targets components that already exist.

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[The product grid](01-the-product-grid/README.md)** *(12 chunks)* | <span className="db-tier t-master">Master</span> | One `grid-template-columns` declaration replaces the breakpoint pile-up — and the card adapts to its column, not the viewport |
| 04 | **[Skeleton loaders and spinners](04-skeletons-and-spinners/README.md)** *(5 chunks)* | <span className="db-tier t-understand">Understand</span> | A loading indicator is a cost, not a courtesy — show nothing for the first 400 ms, and make the skeleton *be* the component |
| 05 | **[Dark mode](05-dark-mode/README.md)** *(10 chunks)* | <span className="db-tier t-understand">Understand</span> | Three viewer states, not two — the media query cannot tell a user who chose from one who did not, and everything else follows from recovering that third state |
| 06 | **The overlay layer** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |

:::note Four chapters, and the numbering has gaps on purpose

**02 · The header and navigation** and **03 · The checkout form** were dropped
on 2026-08-17. Both are standard flex and grid work whose mechanisms already
have homes in the [CSS section](../../../css/README.md) — a bar shell is
[CSS 4·06](../../../css/pages/phase-4-flexbox/06-flexbox-patterns/01-bars-and-shells.md),
form-state styling is
[CSS 1·09](../../../css/pages/phase-1-selectors/09-form-state-pseudo-classes.md) —
and the storefront gains nothing from a second telling. The four that remain
are the ones carrying traps a concept page does not cover on its own.

The remaining numbers are left as they were, so the syllabus rows still line up.

:::

## The layer order this phase assumes

Every chapter writes into a named layer, declared once in the entry
stylesheet. Declaring the order up front is what lets a component rule be
written at its natural specificity instead of being escalated to beat
something else — the mechanism is
[CSS 2·02 — `@layer`](../../../css/pages/phase-2-cascade/02-layer/README.md).

```css
/* src/styles/index.css — the only place layer order is decided */
@layer reset, tokens, base, layout, components, utilities;
```

`reset` normalises, `tokens` declares the custom properties ([chapter 05 · Dark mode](05-dark-mode/README.md) owns the theme layer), `base` styles bare
elements,
`layout` holds the page shells, `components` is where almost everything in
this phase lands, and `utilities` is the deliberate escape hatch that wins
without `!important`.

## Phase gate

The gate from the syllabus: **the storefront is usable from a 320 px phone to
a 2560 px desktop with no horizontal scrollbar, no layout shift as images
arrive, and no overlay that can be trapped behind the content it overlays** —
and the stylesheet gets there without a media-query pile-up.

## Where this connects

Phase 4 supplies the markup and the class names — this phase never invents an
element it cannot point to. Phase 5's `Intl` formatting decides the *text* in
the price cell, and this phase decides how that cell behaves when the text is
long. The CSS section supplies every mechanism used here; the direction is
always **concept there, decision here.**
