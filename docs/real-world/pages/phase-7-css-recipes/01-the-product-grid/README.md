---
title: "The product grid"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN CSS grid layout, container queries, containment,
> responsive images, and the CSS Grid / Containment / Cascade specifications.
> Each chunk names its own sources. Composes the
> [CSS section](../../../../css/README.md) throughout and styles the markup from
> [chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md).
> No sandbox, no console output.

The storefront's catalog screen: a list of product cards, count unknown until
the request lands, growing as the user scrolls, on everything from a 320 px
phone to a 2560 px monitor.

**One `grid-template-columns` declaration replaces the breakpoint pile-up, and
the card adapts to its column rather than to the viewport.** Everything after
that is the consequences — what containment does to positioning, what long
product names do to a track, what images do to layout stability, and what the
grid owes a screen-reader user when 24 more products appear without warning.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The track-sizing decision](01-the-track-sizing-decision.md) | Why the media-query version is wrong, and what `repeat(auto-fill, minmax(min(16rem, 100%), 1fr))` each mean |
| 02 | [`auto-fill`, grid over flexbox, and the list reset](02-autofill-grid-and-the-list-reset.md) | The keyword that decides whether two search results become two huge cards; why flex's last row betrays it; the semantics `list-style: none` costs |
| 03 | [The card adapts to its column](03-the-card-adapts-to-its-column.md) | Container queries, the self-query trap, and breakpoints that belong to the component |
| 04 | [Container units, and what containment does to you](04-container-units-and-containment.md) | `cqi`, and the containing block + stacking context you inherit whether you wanted them or not |
| 05 | [Images without layout shift](05-images-without-layout-shift.md) | `aspect-ratio`, `object-fit`, and why the `width`/`height` attributes still matter |
| 06 | [Image delivery: lazy loading, `srcset` and long grids](06-image-delivery-and-long-grids.md) | Eager above the fold, the `sizes` bug with no visual symptom, and `content-visibility` |
| 07 | [The text squeeze and clamping](07-the-text-squeeze-and-clamping.md) | `min-width: 0`, line clamping, and the three wrapping properties that are not interchangeable |
| 08 | [The price row and row alignment](08-the-price-row-and-row-alignment.md) | `tabular-nums`, baseline alignment, and subgrid for cross-card rows |
| 09 | [The loading state and announcements](09-the-loading-state-and-announcements.md) | How a skeleton causes the shift it prevents; live regions that actually announce |
| 10 | [Empty, end and error states](10-empty-end-and-error-states.md) | `grid-column: 1 / -1`, why `:empty` cannot do this, and reduced motion |
| 11 | [The complete stylesheet](11-the-complete-stylesheet.md) | The whole file, copyable, plus the markup contract |
| 12 | [Tokens, layers and the component contract](12-tokens-layers-and-the-contract.md) | Layer order as a decision, and what a consumer must not "clean up" |

## Three sentences to keep

**Ask the container, not the viewport** — every layout decision on this screen
is about the box the component was given, and a media query cannot see that box.

**Reserve space before you have content** — `aspect-ratio` and the image's
`width`/`height` attributes are the difference between a list and a list that
moves under the reader's finger.

**Containment is not free** — `container-type` buys you a query and charges you
a containing block, a stacking context, and a rule about where overlays may
live.

## Phase gate

This topic is done when the catalog renders correctly at 320 px and 2560 px
**and inside a 380 px drawer**, with no horizontal scrollbar, no shift as
images arrive, no product name capable of blowing out a row, and a screen reader
that announces both the item count and each page of new results.

## Where this connects

**Backwards:** [chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md)
supplies the markup, the sentinel and the state machine;
[chapter 5·06](../../phase-5-js-functions/06-money-and-dates/README.md) formats
the price this grid must not assume the width of.

**Forwards:** the skeleton's own construction is [chapter 04 · Skeleton loaders and spinners](../04-skeletons-and-spinners/README.md); the tokens every colour here refers to are
[chapter 05 · Dark mode](../05-dark-mode/README.md); the overlays that chunk 04
proves cannot live inside a card are [chapter 06 · The overlay layer](../06-the-overlay-layer/README.md).

**Sideways:** the mechanisms are the CSS section —
[grid](../../../../css/pages/phase-5-grid/README.md),
[container queries](../../../../css/pages/phase-6-container-queries/README.md),
[positioning](../../../../css/pages/phase-7-positioning/README.md) and
[the cascade](../../../../css/pages/phase-2-cascade/README.md).

---

Start with [01 · The track-sizing decision](01-the-track-sizing-decision.md).
