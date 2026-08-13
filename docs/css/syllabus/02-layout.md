---
title: "Part 2 — Layout"
sidebar_label: "2 · Layout"
sidebar_position: 2
---

> **Phases 4–7 · 62 topics · 22 Master**
> Where the element ends up. The box it occupies, the two layout systems you
> will actually use, and the escape hatch for taking something out of flow.

The brief names **Flexbox** and **Grid** explicitly, and this part is where they
live — but neither is learnable in isolation. Flexbox questions are usually box
questions (`min-width: 0`), and grid questions are usually sizing questions
(`minmax(0, 1fr)`), so the box model comes first and is not optional.

---

## Phase 4 — The box model and normal flow

*16 topics.* Every element is a box, and the default behaviour of those boxes is
called normal flow. Most people skip this and then spend years confused by
margin collapsing and by `height: auto`.

| Topic | Tier |
|---|---|
| **The box model** — content, padding, border, margin; what each contributes to the element's size, and what `getComputedStyle().width` reports for each `box-sizing` mode | <span className="db-tier t-master">Master</span> |
| **`box-sizing: border-box`** — what it changes, why the inherited three-line global rule is the standard opening of every stylesheet, and the one case where `content-box` is still right | <span className="db-tier t-master">Master</span> |
| **Normal flow** — how block boxes stack down, how inline boxes fill and wrap into line boxes, and why an inline element ignores `width` and vertical padding's effect on layout | <span className="db-tier t-master">Master</span> |
| **Margin collapsing** — adjacent siblings, parent and first/last child, and empty blocks; the four ways to stop it (padding, border, a new formatting context, flex/grid), and why it does not happen in flex or grid at all | <span className="db-tier t-master">Master</span> |
| **`auto` on `width` vs `height`** — width fills the containing block, height shrinks to content; the single asymmetry behind "why is my full-height sidebar not full height" | <span className="db-tier t-master">Master</span> |
| **The containing block** — which ancestor each property resolves against, how `position` changes the answer, and the `transform`/`filter`/`contain` exception that makes a `fixed` child stop being fixed | <span className="db-tier t-master">Master</span> |
| **`display` is two values** — outer (`block`, `inline`) and inner (`flow`, `flow-root`, `flex`, `grid`); reading `display: inline flex` and knowing that `display: flex` only changes how *children* are laid out | <span className="db-tier t-understand">Understand</span> |
| **Block, inline and inline-block** — what each accepts for sizing and margins, the mysterious whitespace gap between inline-blocks, and vertical alignment on a line | <span className="db-tier t-understand">Understand</span> |
| **Block formatting contexts** — the full list of what creates one, and the three problems one fixes: containing floats, stopping margin collapse, and keeping a box off a float | <span className="db-tier t-understand">Understand</span> |
| **`display: flow-root`** — a BFC with no side effects, and the reason `clearfix` hacks are dead | <span className="db-tier t-understand">Understand</span> |
| **`min-` and `max-` constraints** — the order they apply relative to `width`/`height`, why `max-width` beats `width`, and the `min-width: auto` default that only shows up in flex and grid | <span className="db-tier t-understand">Understand</span> |
| **Logical properties** — `inline-size`, `block-size`, `margin-inline`, `padding-block`, `inset-inline-start`, `border-start-start-radius`; writing a layout that mirrors correctly in RTL without a second stylesheet | <span className="db-tier t-understand">Understand</span> |
| **`overflow`** — `visible`, `hidden`, `clip`, `scroll`, `auto`; that any value other than `visible` creates a scroll container and a BFC, and `overflow-clip-margin` for clipping without scrolling | <span className="db-tier t-understand">Understand</span> |
| **Intrinsic sizing keywords** — `min-content`, `max-content`, `fit-content()` and `stretch`; sizing a box to its longest word or its whole text, and where each beats a magic number | <span className="db-tier t-understand">Understand</span> |
| **Hidden, but how hidden** — `display: none` vs `visibility: hidden` vs `opacity: 0` vs a visually-hidden class vs `hidden="until-found"`; four different answers for layout, hit-testing and screen readers | <span className="db-tier t-understand">Understand</span> |
| Floats today — what they are still genuinely for (`shape-outside`, wrapping text around a pull-quote), and why they are no longer a layout system | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can predict, before opening DevTools, why a gap
appeared between two elements — and name whether it is a margin, a collapsed
margin, a line-box gap or the default `body` margin.

---

## Phase 5 — Flexbox

*15 topics.* One-dimensional distribution along an axis. Named in the brief.
The goal is not "can you centre a div" — it is that you can predict what happens
when the content is wider than the container, which is where every real flexbox
bug lives.

| Topic | Tier |
|---|---|
| **The flex model** — main axis and cross axis, and that `flex-direction` redefines what every subsequent `justify-*` and `align-*` property means. Get this wrong and every alignment property looks broken | <span className="db-tier t-master">Master</span> |
| **`justify-content`** — distribution along the main axis; `flex-start`, `center`, `space-between`, `space-around`, `space-evenly`, and what each does with a single item | <span className="db-tier t-master">Master</span> |
| **`align-items` and `align-self`** — the cross axis; why `stretch` is the default and why that makes equal-height cards free | <span className="db-tier t-master">Master</span> |
| **The `flex` shorthand** — `flex-grow`, `flex-shrink`, `flex-basis`; what `flex: 1` expands to (`1 1 0%`) and how it differs from `flex: auto` (`1 1 auto`), which is the difference between equal columns and content-proportional ones | <span className="db-tier t-master">Master</span> |
| **The automatic minimum size** — a flex item will not shrink below its content's `min-content` size; `min-width: 0` (or `overflow: hidden`) is the fix, and this is the cause of the overflowing flex row that "should" fit | <span className="db-tier t-master">Master</span> |
| **Flexbox layout patterns** — nav bar with a pushed-right group, media object, sticky footer, equal-height card row, input-with-button, and a toolbar that wraps gracefully | <span className="db-tier t-master">Master</span> |
| **`flex-wrap`** — single-line vs multi-line containers, `wrap-reverse`, and why wrapping changes which alignment property you need | <span className="db-tier t-understand">Understand</span> |
| **`align-content`** — the property that does nothing until the container wraps, which is why it is the most-reported "broken" flexbox property | <span className="db-tier t-understand">Understand</span> |
| **`flex-basis` vs `width`** — which wins, what `basis: auto` falls back to, and why `flex-basis: 0` is what makes columns equal regardless of content | <span className="db-tier t-understand">Understand</span> |
| **`gap` in flex** — spacing without margin hacks, and why `gap` is not affected by `justify-content: space-between` the way margins were | <span className="db-tier t-understand">Understand</span> |
| **Auto margins in flex** — `margin-inline-start: auto` to push one item away from the rest; the trick that replaces a wrapper div | <span className="db-tier t-understand">Understand</span> |
| **Centring, six ways** — flex, grid, `place-content`, absolute + transform, `margin: auto`, and the one to reach for by default | <span className="db-tier t-understand">Understand</span> |
| **Choosing flex or grid** — a decision procedure, not a preference: content-driven distribution along one axis vs a container-defined structure in two | <span className="db-tier t-understand">Understand</span> |
| `order` and `flex-direction: row-reverse` — visual reordering, and the accessibility rule that DOM order stays the reading and tab order | <span className="db-tier t-know">Know</span> |
| The `place-*` shorthands — `place-items`, `place-content`, `place-self`, and their block/inline argument order | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can build a nav bar whose middle item truncates
with an ellipsis while the right-hand group stays fixed — and explain why it
needed `min-width: 0`.

---

## Phase 6 — Grid

*18 topics.* Two-dimensional layout, defined by the container. Named in the
brief. The largest layout phase because grid genuinely has more surface — and
because `auto-fit` + `minmax()` is the single highest-leverage thing in modern
CSS layout.

| Topic | Tier |
|---|---|
| **The grid model** — tracks, lines, cells and areas; that the container defines the structure and items are placed into it, which is the inversion from flexbox | <span className="db-tier t-master">Master</span> |
| **`grid-template-columns` and `fr`** — track lists, how free space is distributed, and why `1fr` is not `50%` when there is a gap | <span className="db-tier t-master">Master</span> |
| **`repeat()`, `minmax()`, `auto-fit` vs `auto-fill`** — the responsive card grid with no media query at all; the exact difference between the two keywords, which is visible only when the row is under-filled | <span className="db-tier t-master">Master</span> |
| **Line-based placement** — `grid-column: 1 / 3`, `span 2`, negative line numbers for "to the end", and `grid-area`'s four-value order | <span className="db-tier t-master">Master</span> |
| **Named areas** — `grid-template-areas` as ASCII art, `.` for an empty cell, and re-drawing the whole page shell in one media query | <span className="db-tier t-master">Master</span> |
| **Subgrid** — Baseline since 2023-09-15; making a nested card's internal rows line up with its siblings across the grid, which was impossible before | <span className="db-tier t-master">Master</span> |
| **Grid layout patterns** — the page shell (header / sidebar / main / footer), a 12-column layout, a card grid, the full-bleed content grid with named line pairs, and an overlapping hero | <span className="db-tier t-master">Master</span> |
| **Explicit vs implicit grid** — `grid-auto-rows`, `grid-auto-columns`, `grid-auto-flow: row / column / dense`, and where surprise tracks come from | <span className="db-tier t-understand">Understand</span> |
| **Alignment in grid** — `justify-items`/`align-items` for items in their cells, `justify-content`/`align-content` for tracks in the container, and `*-self` per item; six properties that are constantly confused for each other | <span className="db-tier t-understand">Understand</span> |
| **Track sizing against content** — `auto`, `min-content`, `max-content` tracks; and the `minmax(0, 1fr)` fix for the track that refuses to shrink because `1fr` means `minmax(auto, 1fr)` | <span className="db-tier t-understand">Understand</span> |
| **Grid and long content** — why one unbreakable string blows out a track, and the interaction between `overflow-wrap`, `min-width: 0` and track sizing | <span className="db-tier t-understand">Understand</span> |
| **Named grid lines** — naming lines rather than areas, the `[full-start] … [full-end]` convention, and `span` with named lines | <span className="db-tier t-understand">Understand</span> |
| **`gap`, `row-gap`, `column-gap`** — and why gaps are not tracks, so they do not receive `fr` space | <span className="db-tier t-understand">Understand</span> |
| **The auto-placement algorithm** — the order items fill cells, what `dense` changes, and the reading-order cost `dense` imposes | <span className="db-tier t-understand">Understand</span> |
| **`grid-template` and `grid` shorthands** — how to read one someone else wrote, and the argument for not writing them yourself | <span className="db-tier t-know">Know</span> |
| **`display: contents`** — dissolving a wrapper so its children join the parent grid, and the accessibility caveat that has followed it since | <span className="db-tier t-know">Know</span> |
| **Masonry / `item-flow`** — where it stands in 2026 (`web-features` reports Masonry as **not Baseline**), and what to ship instead today | <span className="db-tier t-know">Know</span> |
| Grid in one dimension — when a single-axis grid beats flexbox, mostly for alignment across rows | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a card grid that goes from four columns
to one with **no media queries**, and a page shell using named areas that
rearranges in exactly one — and explain `auto-fit` vs `auto-fill` from the
rendered result.

---

## Phase 7 — Positioning, stacking and overlay

*13 topics.* Taking a box out of flow, and deciding what paints on top. Small
phase, disproportionate share of production bugs — dropdowns clipped by a
scroll container and `z-index: 9999` that changes nothing are both here.

| Topic | Tier |
|---|---|
| **The five `position` values** — `static`, `relative`, `absolute`, `fixed`, `sticky`; what each is positioned *relative to*, and which ones leave a gap in flow | <span className="db-tier t-master">Master</span> |
| **Stacking contexts** — the full list of what creates one (`z-index` on a positioned element, `opacity` below 1, `transform`, `filter`, `will-change`, `isolation`, `contain`), and why a child can never escape its parent's context | <span className="db-tier t-master">Master</span> |
| **`z-index`** — how it resolves *within* a stacking context, the default painting order when nobody sets it, and why `9999` fails while `1` works | <span className="db-tier t-master">Master</span> |
| **`position: sticky`** — the rules that make it silently do nothing: no threshold set, a parent with `overflow` other than `visible`, or a parent shorter than the scroll distance | <span className="db-tier t-master">Master</span> |
| **`inset` and offset behaviour** — that setting both `left` and `right` on an absolute box stretches it, and how `inset: 0` plus `margin: auto` centres it | <span className="db-tier t-understand">Understand</span> |
| **`position: fixed` and its ancestors** — a `transform`, `filter`, `backdrop-filter`, `perspective` or `contain` ancestor makes fixed positioning resolve against that ancestor instead of the viewport | <span className="db-tier t-understand">Understand</span> |
| **The clipped-dropdown problem** — a menu inside `overflow: hidden`, why moving it in the DOM or using the top layer are the only real fixes, and how to choose | <span className="db-tier t-understand">Understand</span> |
| **The top layer** — `<dialog>` modal and `[popover]` paint above everything regardless of `z-index`; `::backdrop`, and why this removes an entire class of stacking bug | <span className="db-tier t-understand">Understand</span> |
| **`isolation: isolate`** — creating a stacking context deliberately so a component's internal `z-index` values stay internal | <span className="db-tier t-understand">Understand</span> |
| **Full-bleed and breakout layouts** — escaping a max-width container for a hero or a code block, via the grid line trick or negative margins | <span className="db-tier t-understand">Understand</span> |
| **Anchor positioning** — `anchor-name`, `position-anchor`, `anchor()`, `position-area` and `position-try-fallbacks`; tethering a tooltip to its trigger in pure CSS. `web-features` reports it **not Baseline** as of 2026-08, so it ships behind `@supports` | <span className="db-tier t-know">Know</span> |
| **Anchor positioning vs a JavaScript positioner** — what a library still does that CSS does not, and the migration path | <span className="db-tier t-know">Know</span> |
| Animating the top layer — `overlay`, `transition-behavior: allow-discrete` and `@starting-style`; the three-part incantation for a dialog that fades in *and* out | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why a `z-index: 1` element is painting
over your `z-index: 100` one, by naming the stacking context each belongs to.

---

## Where this connects

- **Phase 4 → Phases 5 and 6** — `min-width: auto` and the containing block are
  box-model rules; they only become famous once flex and grid expose them.
- **Phase 6 → Phase 8** — `auto-fit` + `minmax()` and container queries are the
  two halves of layout that adapts without breakpoints.
- **Phase 7 → Phase 11** — stacking contexts are created by `transform`,
  `opacity` and `will-change`, which are animation properties; the two phases
  describe the same mechanism from opposite ends.
- **Phase 7 → Phase 12** — `<dialog>` and popover are introduced here as a
  *stacking* solution and covered as components there.
- **Deliberately not here:** how a layout responds to viewport or container
  size. Breakpoints are Phase 8, so that layout is learned once and adapted
  once, rather than re-taught per breakpoint.

---

← [Part 1 — How CSS works](./01-how-css-works.md) · Next: [Part 3 — Adaptive and visual](./03-adaptive-and-visual.md) →
