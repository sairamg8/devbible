---
title: "Link map · CSS · Part 2 (phases 3–5)"
sidebar_label: "02 · layout"
sidebar_position: 2
---

# Link map · CSS · Part 2 (phases 3–5)

Covers every topic row of phases 3, 4 and 5 in `docs/css/syllabus/02-layout.md`: custom properties and modern values (T03-01 to T03-04), flexbox (T04-01 to T04-07) and grid (T05-01 to T05-10). That is 21 rows, and every one has a written page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, opening or headings checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. MDN links use the current (post-restructure) addresses, so none of them redirect. The CSS Flexbox and Grid specs are huge pages: I confirmed the section headings exist (and read 9.7 of the flexbox spec), and the picks below point at MDN for the readable version.

---

## Phase 3 — Custom properties and modern values

### T03-01 · Custom properties as a component API — Master · ✅ written `docs/css/pages/phase-3-custom-properties/01-custom-properties-as-a-component-api.md`
- **Read this:** [Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties) · MDN · declaring, inheritance and scope, `var()` fallbacks (the second argument is used when the referenced property is invalid, and everything after the first comma is the fallback), and setting a property from script with `setProperty` (*read*) · covers our angle: **partial** — the mechanics, not the "rule in CSS, value from outside" design stance · fetched 2026-10-14
- **Beyond the docs:** [Custom Property Fallbacks](https://blog.master.dev/custom-property-fallbacks/) · Matthew Morete, Master.dev Blog, 2025-02-28 · why an invalid custom property does not fall back to an earlier declaration, and how `@property` (its `initial-value`) and `@supports` give a real fallback · fetched 2026-10-14 (*read*)
- **Our delta:** treating `--x` as the public input of a component, with the fallback covering only the not-set case, plus the invalid-at-computed-value-time trap (the same point as the Beyond link).

### T03-02 · `clamp()`, `min()`, `max()` — Master · ✅ written `docs/css/pages/phase-3-custom-properties/02-clamp-min-max.md`
- **Read this:** [clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp) · MDN · `clamp(MIN, VAL, MAX)` resolves as `max(MIN, min(VAL, MAX))`, plus the accessibility note that for text the maximum should be a relative unit no less than twice the minimum so text can reach 200% zoom (*read*) · covers our angle: **partial** — has the zoom caveat but does not teach reading the three terms or why the preferred term needs a `rem` part · fetched 2026-10-14
- **Beyond the docs:** [Modern Fluid Typography Using CSS Clamp](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/) · Adrian Bece, Smashing Magazine, 2022-01-17 · derives the formula step by step (36px at 600px to 52px at 1400px gives `2vw + 1.5rem`) and recommends `rem` bounds; it also warns that `vw` units, or a clamp that caps the maximum, can stop text reaching 200% zoom (WCAG 1.4.4) (*read*) · fetched 2026-10-14
- **Our delta:** the rule "preferred term = `rem` part + `vw` part" stated as a zoom-safety invariant.

### T03-03 · `@property` — Master · ✅ written `docs/css/pages/phase-3-custom-properties/03-at-property.md`
- **Read this:** [@property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@property) · MDN · the `syntax`, `inherits` and `initial-value` descriptors, a malformed rule being ignored, and a typed `--progress` animated in `@keyframes` (*read*) · covers our angle: **partial** — typing, descriptors and animation are all there, but the page does not say what a value that fails the `syntax` does · fetched 2026-10-14
- **Beyond the docs:** [The Times You Need A Custom @property Instead Of A CSS Variable](https://www.smashingmagazine.com/2024/05/times-need-custom-property-instead-css-variable/) · Preethi Sam, Smashing Magazine, 2024-05-13 · worked animations of gradient colours, a length and an angle that plain variables cannot do (*read*) · fetched 2026-10-14
- **Our delta:** bad values stop being catastrophic: a value that fails the registered `syntax` takes the `initial-value` instead of leaving the property unset.

### T03-04 · Units that matter for layout — Understand · ✅ written `docs/css/pages/phase-3-custom-properties/04-units-that-matter.md`
- **Read this:** [The large, small, and dynamic viewport units](https://web.dev/blog/viewport-units) · web.dev, Bramus · `lvh` assumes the URL bar retracted, `svh` expanded, `dvh` follows it live (*read*) · covers our angle: **partial** — viewport units only · fetched 2026-10-14
- **Also good:** [CSS values and units: `<length>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length) · MDN · reference for the units in separate sections, not one table: font-relative (`em`, `ch`), root-relative (`rem`), viewport (including `dvh`) and container units (*read*) · fetched 2026-10-14
- **Our delta:** `em` compounding and what each percentage resolves against; no strong third-party piece found that covers both (a search turned up only generic `em` versus `rem` posts that skip percentages).

---

## Phase 4 — Flexbox, deeply

### T04-01 · The flex sizing algorithm — Master · ✅ written `docs/css/pages/phase-4-flexbox/01-the-flex-sizing-algorithm/01-base-sizes.md`
- **Read this:** [Controlling ratios of flex items along the main axis](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Controlling_flex_item_ratios) · MDN · `flex-basis` as the starting size, `flex-grow` sharing positive free space, `flex-shrink` weighted by factor times base size, never below `min-content` (*read*) · covers our angle: **partial** — good on grow and shrink, light on the alignment stage (it only points to `justify-content` and auto margins) · fetched 2026-10-14
- **Also good:** [CSS Flexible Box Layout Module Level 1](https://www.w3.org/TR/css-flexbox-1/) · W3C · section 9.7 "Resolving Flexible Lengths" is the normative loop (freeze inflexible items, then loop on remaining free space) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [An Interactive Guide to Flexbox in CSS](https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/) · Josh W. Comeau, 2022-11-22, updated 2026-04-27 · live widgets for basis, grow and shrink, and resizable demos where minimum sizes cause overflow (*read*) · fetched 2026-10-14
- **Our delta:** the three stages in strict order across three chunks (base sizes, grow and shrink, alignment), with base sizes first.

### T04-02 · The automatic minimum size — Master · ✅ written `docs/css/pages/phase-4-flexbox/02-the-automatic-minimum-size/01-why-items-refuse-to-shrink.md`
- **Read this:** [min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-width) · MDN · the `auto` entry: for flex and grid items it is the suggested size, transferred size or `min-content`, and `0` for scroll containers (and for grid items spanning more than one flexible column track) (*read*) · covers our angle: **partial** — the rule in one paragraph, no diagnosis · fetched 2026-10-14
- **Also good:** [CSS Flexible Box Layout Module Level 1](https://www.w3.org/TR/css-flexbox-1/) · W3C · section 4.5 "Automatic Minimum Size of Flex Items" (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Understanding the automatic minimum size of flex items](https://www.bigbinary.com/blog/understanding-the-automatic-minimum-size-of-flex-items) · Praveen Murali, BigBinary, 2023-08-17 · a flex item will not shrink below its longest unbreakable string; `min-width: 0` overrides that, and `overflow: hidden` alone can also help (*read*) · fetched 2026-10-14
- **Our delta:** a diagnosis routine (find the item sitting at its content width, confirm with `min-width: 0` in DevTools) and the nesting rule that every level needs the fix.

### T04-03 · `flex` shorthand, properly — Proportional · ✅ written `docs/css/pages/phase-4-flexbox/03-the-flex-shorthand/01-what-the-values-mean.md`
- **Read this:** [flex](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/flex) · MDN · `flex: 2` expands to `2 1 0%`, `flex: auto` to `1 1 auto`, and unitless values size items in proportion (*read*) · covers our angle: **partial** — states the expansions but never contrasts equal columns with content-proportional ones · fetched 2026-10-14
- **Our delta:** equal columns (`1 1 0%`) versus content-proportional columns (`1 1 auto`), with a worked 600px table in the base-sizes chunk of T04-01; a second search found only mailing-list and forum posts and a Chinese-language article beyond MDN.

### T04-04 · `flex-basis` vs `width` — Master · ✅ written `docs/css/pages/phase-4-flexbox/04-flex-basis-vs-width.md`
- **Read this:** [flex-basis](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/flex-basis) · MDN · if `flex-basis` is not `auto` it takes precedence over `width` (or `height` in a column), and `auto` falls back to `width` and then to content (*read*) · covers our angle: **partial** — precedence and the `auto` fallback yes, cross axis and `box-sizing` no · fetched 2026-10-14
- **Also good:** [Controlling ratios of flex items along the main axis](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Controlling_flex_item_ratios) · MDN · shrink weighted by factor times base size (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Flexbox: flex-basis vs. width vs. min-width vs. max-width](https://makandracards.com/makandra/137994-flexbox-flex-basis-vs-width-vs-min-width-vs-max-width) · Henning Koch, makandra cards, 2019-08-30, updated 2025-03-17 · `flex-basis` sets the starting size, `width` only when no basis is set, `min-width` and `max-width` set limits (*read*) · fetched 2026-10-14
- **Our delta:** the precedence table (`auto` is the only value that lets `width` in), the column-direction reset, and `box-sizing`; the worked shrink calculation showing large-basis items lose more lives in the grow-and-shrink chunk of T04-01.

### T04-05 · Main and cross axis — Master · ✅ written `docs/css/pages/phase-4-flexbox/05-main-and-cross-axis.md`
- **Read this:** [Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts) · MDN · main and cross axes and all four `flex-direction` values (*read*) · covers our angle: **partial** — axes and directions yes; the per-direction table of which property acts on which axis is ours · fetched 2026-10-14
- **Also good:** [Box alignment in flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Box_alignment/In_flexbox) · MDN · `justify-content` on the main axis, `align-content`, `align-self` and `align-items` on the cross axis, and why there is no `justify-self` in flexbox (*read*) · fetched 2026-10-14
- **Beyond the docs:** [An Interactive Guide to Flexbox in CSS](https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/) · Josh W. Comeau, 2022-11-22, updated 2026-04-27 · flip `flex-direction` and watch the primary and cross axes swap (*read*) · fetched 2026-10-14
- **Our delta:** a row-versus-column table of which axis each property acts on, so a direction change is not a surprise; also reverse-order accessibility and logical properties.

### T04-06 · Flexbox patterns that carry real applications — With · ✅ written `docs/css/pages/phase-4-flexbox/06-flexbox-patterns/01-bars-and-shells.md`
- **Read this:** [Typical use cases of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Use_cases) · MDN · navigation, split navigation, centring, a card footer pushed down, media objects, form controls (*read*) · covers our angle: **partial** — no full-page sticky footer, truncating middle item or wrapping toolbar · fetched 2026-10-14
- **Beyond the docs:** [The Flexbox Holy Albatross](https://heydonworks.com/article/the-flexbox-holy-albatross/) · Heydon Pickering, 2019-01-13 · a row that flips to a stack at a container width of 40rem using `flex-basis` and a custom property (*read*) · fetched 2026-10-14
- **Our delta:** the patterns as one set under one rule (exactly one item absorbs the squeeze), each with its load-bearing declaration; the truncating middle item is in the second chunk.

### T04-07 · Flexbox and text overflow — Overflow · ✅ written `docs/css/pages/phase-4-flexbox/07-flexbox-and-text-overflow.md`
- **Read this:** [text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-overflow) · MDN · ellipsis needs `overflow` and `white-space` set (its example uses `overflow: hidden` and `white-space: nowrap`) (*read*) · covers our angle: **partial** — no flex context · fetched 2026-10-14
- **Beyond the docs:** [Flexbox Gotchas Reloaded](https://dev.to/hbarcelos/flexbox-gotchas-reloaded-2i39) · Henrique Barcelos, DEV Community, 2020-04-20, edited 2022-06-28 · the nowrap, hidden, ellipsis trio still overflows in a flex layout; `min-width: 0` on the inner child did not fix it, on the outer flex child it did (*read*) · fetched 2026-10-14
- **Our delta:** the four-property chain in order (`min-inline-size: 0`, nowrap, hidden, ellipsis) with what breaks if each link is missing; the every-level nesting rule is in T04-02.

---

## Phase 5 — Grid, deeply

### T05-01 · `repeat()`, `minmax()`, `auto-fit` vs `auto-fill` — Master · ✅ written `docs/css/pages/phase-5-grid/01-repeat-minmax-autofit.md`
- **Read this:** [repeat()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/repeat) · MDN · `auto-fit` is `auto-fill` plus collapsing of empty tracks to `0px` (*read*) · covers our angle: **full** for the keyword difference; the narrow-screen `minmax(20rem, 1fr)` trap is ours · fetched 2026-10-14
- **Beyond the docs:** [Auto-Sizing Columns in CSS Grid: auto-fill vs auto-fit](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/) · Sara Soueidan, CSS-Tricks, 2017-12-29 · two otherwise identical grids, one `auto-fill` and one `auto-fit`, shown while resizing; they differ when the row has room for a column with nothing to put in it (*read*) · fetched 2026-10-14
- **Our delta:** the one-line no-media-query card grid and when to pick each keyword.

### T05-02 · `fr` and the track sizing algorithm — Master · ✅ written `docs/css/pages/phase-5-grid/02-fr-and-track-sizing.md`
- **Read this:** [CSS Grid Layout Module Level 1](https://www.w3.org/TR/css-grid-1/) · W3C · section 7.2.4 "Flexible Lengths: the fr unit" and 11.3 "Track Sizing Algorithm" (*headings only*) · covers our angle: **full** but dense · fetched 2026-10-14
- **Beyond the docs:** [Debugging CSS Grid: Part 2: What the Fr(action)?](https://css-irl.info/debugging-css-grid-part-2-what-the-fraction/) · Michelle Barker, CSS-IRL, 2019-05-16 · `1fr` behaves as `minmax(auto, 1fr)` and the browser subtracts fixed tracks and gaps before sharing space between `fr` tracks (*read*) · fetched 2026-10-14
- **Our delta:** why `1fr` is not `50%` once there is a gap, as a worked sum.

### T05-03 · The `minmax(0, 1fr)` fix — Master · ✅ written `docs/css/pages/phase-5-grid/03-the-minmax-zero-fix.md`
- **Read this:** [minmax()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/minmax) · MDN · as a minimum, `auto` is the largest minimum size of the items in the track; `minmax(0, 1fr)` appears among its "Try it" variants but the page does not explain why (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Preventing a Grid Blowout](https://css-tricks.com/preventing-a-grid-blowout/) · Chris Coyier, CSS-Tricks, 2018-10-01 · a wide `pre` blows out a `1fr` column; `minmax(0, 1fr)` or `min-width: 0` on the item fixes it, and he prefers the grid-level fix (*read*) · fetched 2026-10-14
- **Our delta:** two floors, not one (the track's `minmax(auto, 1fr)` and the item's own `min-width: auto`), with a pointer back to T04-02.

### T05-04 · Named areas — Master · ✅ written `docs/css/pages/phase-5-grid/04-named-areas.md`
- **Read this:** [Grid template areas](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Grid_template_areas) · MDN · the ASCII-art syntax, the rule that an area must be rectangular, and a section on redefining the grid in media queries (*read*) · covers our angle: **partial** — no implicit line names and no advice on when not to use it · fetched 2026-10-14
- **Also good:** [Realizing common layouts using grids](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts) · MDN · a responsive named-areas page, redrawn inside a media query (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Concise Media Queries with CSS Grid](https://thoughtbot.com/blog/concise-media-queries-with-css-grid) · Stephen Lindberg, thoughtbot, 2018-10-26, updated 2019-04-10 · a profile layout whose `grid-template-areas` is redrawn in a single media query; short and one example only (*read*) · fetched 2026-10-14
- **Our delta:** one media query redrawing the whole page shell, implicit `-start` and `-end` line names, and when named areas are the wrong tool.

### T05-05 · Line-based placement — Master · ✅ written `docs/css/pages/phase-5-grid/05-line-based-placement.md`
- **Read this:** [Grid layout using line-based placement](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Line-based_placement) · MDN · `span`, negative line numbers ("counting backwards") and the `grid-area` shorthand with its four-value order (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Negative Grid Lines](https://css-irl.info/negative-grid-lines/) · Michelle Barker, CSS-IRL, 2018-10-14 · `-1` is the last line of the explicit grid; an item placed past it creates implicit tracks and shifts where auto-placed items land (*read*) · fetched 2026-10-14
- **Our delta:** lines versus tracks (three columns, four lines), the explicit-grid limit of negative numbers, and overlap; the four-value `grid-area` order is explained on the T05-04 page.

### T05-06 · Subgrid — Master · ✅ written `docs/css/pages/phase-5-grid/06-subgrid.md`
- **Read this:** [Subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Subgrid) · MDN · a nested grid reuses its parent's tracks; marked widely available, in browsers since September 2023 (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Brand New Layouts with CSS Subgrid](https://www.joshwcomeau.com/css/subgrid/) · Josh W. Comeau, 2025-11-25, updated 2026-04-27 · cards and pricing features that align across siblings, including the need to reserve rows with `span` (*read*) · fetched 2026-10-14
- **Our delta:** the before/after for a card's title, body and footer rows.

### T05-07 · Grid patterns that carry real applications — Master · ✅ written `docs/css/pages/phase-5-grid/07-grid-patterns.md`
- **Read this:** [Realizing common layouts using grids](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts) · MDN · named-areas shell, 12-column system, auto-placement product listing, `dense` backfill (*read*) · covers our angle: **partial** — no full-bleed or overlap · fetched 2026-10-14
- **Beyond the docs:** [Full-Bleed Layout Using CSS Grid](https://www.joshwcomeau.com/css/full-bleed/) · Josh W. Comeau, 2020-10-05, updated 2025-12-13 · readable column with full-width children (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Layout Breakouts with CSS Grid](https://ryanmulligan.dev/blog/layout-breakouts/) · Ryan Mulligan, 2022-10-07, updated 2022-10-12 · named lines full, feature, popout and content (*read*) · fetched 2026-10-14
- **Our delta:** the five patterns as a set; the overlapping hero has no good outside source.

### T05-08 · Alignment in grid — Master · ✅ written `docs/css/pages/phase-5-grid/08-alignment-in-grid.md`
- **Read this:** [Box alignment in grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Box_alignment/In_grid_layout) · MDN · `*-items` and `*-self` place items in their areas; `*-content` places the tracks in the container (*read*) · covers our angle: **full** for the split; the two-by-three table is ours · fetched 2026-10-14
- **Beyond the docs:** [The Fundamentals of CSS Alignment](https://css-tip.com/explore/alignment/) · Temani Afif, CSS-Tip, 2025-09-04, updated 2026-04-17 · item level versus content level across grid, flex and block (*read*) · fetched 2026-10-14
- **Our delta:** the six properties in one two-by-three table.

### T05-09 · Explicit vs implicit grid — Understand · ✅ written `docs/css/pages/phase-5-grid/09-explicit-vs-implicit-grid.md`
- **Read this:** [Auto-placement in grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Auto-placement) · MDN · implicit tracks, `grid-auto-rows` and `grid-auto-columns`, `grid-auto-flow` with `column` and `dense` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Explicit vs Implicit Grid](https://www.quackit.com/css/grid/tutorial/explicit_vs_implicit_grid.cfm) · Quackit (page shows no author or date) · beginner walkthrough with three runnable examples: `grid-template-rows` sizes only explicit rows, `grid-auto-rows` sizes implicit ones, `grid-auto-flow: column`; `grid-auto-columns` and `dense` get thin coverage (*read*) · fetched 2026-10-14
- **Our delta:** where surprise tracks come from (items beyond the template, spans past the last line) and how to tell which grid a track belongs to.

### T05-10 · Grid vs flexbox vs flow — Understand · ✅ written `docs/css/pages/phase-5-grid/10-grid-vs-flexbox-vs-flow.md`
- **Read this:** [Relationship of grid layout to other layout methods](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Relationship_with_other_layout_methods) · MDN · flexbox is one-dimensional, grid two-dimensional, with a two-question test and a "content out or layout in" heuristic (*read*) · covers our angle: **partial** — a decision test for flex versus grid, but no step for normal flow · fetched 2026-10-14
- **Beyond the docs:** [To Grid or to Flex?](https://css-irl.info/to-grid-or-to-flex/) · Michelle Barker, CSS-IRL, 2019-02-10 · take each design individually rather than assume which technology you need (*read*) · fetched 2026-10-14
- **Our delta:** an ordered decision procedure that starts with normal flow and covers overlap.
