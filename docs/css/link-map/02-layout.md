---
title: "Link map · CSS · Part 2 (phases 3–5)"
sidebar_label: "02 · layout"
sidebar_position: 2
---

# Link map · CSS · Part 2 (phases 3–5)

Covers every topic row of phases 3, 4 and 5 in `docs/css/syllabus/02-layout.md`: custom properties and modern values (T03-01 to T03-04), flexbox (T04-01 to T04-07) and grid (T05-01 to T05-10). That is 21 rows, and every one has a written page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, opening or headings checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. The CSS Flexbox and Grid specs are huge pages: I confirmed the section headings exist, and the picks below point at MDN for the readable version.

---

## Phase 3 — Custom properties and modern values

### T03-01 · Custom properties as a component API — Master · ✅ written `docs/css/pages/phase-3-custom-properties/01-custom-properties-as-a-component-api.md`
- **Read this:** [Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties) · MDN · declaring, inheritance and scope, `var()` fallbacks, and setting a property from script with `setProperty` (*read*) · covers our angle: **partial** — the mechanics, not the "rule in CSS, value from outside" design stance · fetched 2026-10-14
- **Beyond the docs:** [Custom Property Fallbacks](https://blog.master.dev/?p=5257) · Matthew Morete, Master.dev Blog (formerly Frontend Masters), 2025-02-28 · why an invalid custom property does not fall back to an earlier declaration, and how `@property` and `@supports` give a real fallback · fetched 2026-10-14 (*headings only*)
- **Our delta:** treating `--x` as the public input of a component, with the fallback as its default.

### T03-02 · `clamp()`, `min()`, `max()` — Master · ✅ written `docs/css/pages/phase-3-custom-properties/02-clamp-min-max.md`
- **Read this:** [clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp) · MDN · `clamp(MIN, VAL, MAX)` equals `max(MIN, min(VAL, MAX))`, plus the accessibility note that the maximum should be at least twice the minimum so text can reach 200% zoom (*read*) · covers our angle: **partial** — has the zoom caveat but does not teach reading the three terms or why the preferred term needs a `rem` part · fetched 2026-10-14
- **Beyond the docs:** [Modern Fluid Typography Using CSS Clamp](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp) · Adrian Bece, Smashing Magazine, 2022-01-17 · builds the formula step by step and recommends `rem` bounds; it also warns that `vw`-only preferred values can break WCAG 1.4.4 (*read*) · fetched 2026-10-14
- **Our delta:** the rule "preferred term = `rem` part + `vw` part" stated as a zoom-safety invariant.

### T03-03 · `@property` — Master · ✅ written `docs/css/pages/phase-3-custom-properties/03-at-property.md`
- **Read this:** [@property](https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@property) · MDN · the `syntax`, `inherits` and `initial-value` descriptors, with a typed `--progress` animated in `@keyframes` (*read*) · covers our angle: **full** — typing, animation and invalid-value behaviour are all there · fetched 2026-10-14
- **Beyond the docs:** [The Times You Need A Custom @property Instead Of A CSS Variable](https://www.smashingmagazine.com/2024/05/times-need-custom-property-instead-css-variable/) · Preethi Sam, Smashing Magazine, 2024-05-13 · worked animations of gradient colours, lengths and angles that plain variables cannot do (*read*) · fetched 2026-10-14
- **Our delta:** "fails early" as a design reason: a bad value falls back to `initial-value` at computed-value time.

### T03-04 · Units that matter for layout — Understand · ✅ written `docs/css/pages/phase-3-custom-properties/04-units-that-matter.md`
- **Read this:** [The large, small, and dynamic viewport units](https://web.dev/blog/viewport-units) · web.dev, Bramus · `lvh` assumes the URL bar retracted, `svh` expanded, `dvh` follows it live (*read*) · covers our angle: **partial** — viewport units only · fetched 2026-10-14
- **Also good:** [CSS values and units: `<length>`](https://developer.mozilla.org/en-US/docs/Web/CSS/length) · MDN · reference for `em`, `rem`, `ch` and `dvh` in one table (*headings only*) · fetched 2026-10-14
- **Our delta:** `em` compounding and what each percentage resolves against; no strong third-party piece found that covers both.

---

## Phase 4 — Flexbox, deeply

### T04-01 · The flex sizing algorithm — Master · ✅ written `docs/css/pages/phase-4-flexbox/01-the-flex-sizing-algorithm/01-base-sizes.md`
- **Read this:** [Controlling ratios of flex items along the main axis](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis) · MDN · `flex-basis` as the starting size, `flex-grow` sharing positive free space, `flex-shrink` weighted by factor times base size, never below `min-content` (*read*) · covers our angle: **partial** — good on grow and shrink, light on the alignment stage · fetched 2026-10-14
- **Also good:** [CSS Flexible Box Layout Module Level 1](https://www.w3.org/TR/css-flexbox-1/) · W3C · section 9.7 "Resolving Flexible Lengths" is the normative loop (freeze, recompute free space) (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [An Interactive Guide to Flexbox in CSS](https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/) · Josh W. Comeau, 2022-11-22, updated 2026-04-27 · live widgets for basis, grow, shrink and the minimum-size limit (*read*) · fetched 2026-10-14
- **Our delta:** the three stages in strict order, with base sizes first.

### T04-02 · The automatic minimum size — Master · ✅ written `docs/css/pages/phase-4-flexbox/02-the-automatic-minimum-size/01-why-items-refuse-to-shrink.md`
- **Read this:** [min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width) · MDN · the `auto` entry: for flex and grid items it is the suggested size or `min-content`, and `0` for scroll containers (*read*) · covers our angle: **partial** — the rule in one paragraph, no diagnosis · fetched 2026-10-14
- **Also good:** [CSS Flexible Box Layout Module Level 1](https://www.w3.org/TR/css-flexbox-1/) · W3C · section 4.5 "Automatic Minimum Size of Flex Items" (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Understanding the automatic minimum size of flex items](https://bigbinary.com/blog/understanding-the-automatic-minimum-size-of-flex-items) · Praveen Murali, BigBinary, 2023-08-17 · long text will not shrink or truncate until `min-width: 0` or `overflow: hidden` removes the content-based minimum (*read*) · fetched 2026-10-14
- **Our delta:** a diagnosis routine (which ancestor holds the floor).

### T04-03 · `flex` shorthand, properly — Proportional · ✅ written `docs/css/pages/phase-4-flexbox/03-the-flex-shorthand/01-what-the-values-mean.md`
- **Read this:** [flex](https://developer.mozilla.org/en-US/docs/Web/CSS/flex) · MDN · `flex: 2` expands to `2 1 0%`, `flex: auto` to `1 1 auto` (*read*) · covers our angle: **partial** — states both expansions, does not say what that does to column widths · fetched 2026-10-14
- **Our delta:** equal columns (`1 1 0%`) versus content-proportional columns (`1 1 auto`); only mailing-list and forum posts turned up beyond MDN.

### T04-04 · `flex-basis` vs `width` — Master · ✅ written `docs/css/pages/phase-4-flexbox/04-flex-basis-vs-width.md`
- **Read this:** [flex-basis](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-basis) · MDN · if `flex-basis` is not `auto` it takes precedence over `width` (or `height` in a column) (*read*) · covers our angle: **partial** — precedence yes, `auto` fallback and shrink weighting no · fetched 2026-10-14
- **Also good:** [Controlling ratios of flex items along the main axis](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis) · MDN · shrink weighted by factor times base size (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Flexbox: flex-basis vs. width vs. min-width vs. max-width](https://makandracards.com/makandra/137994-difference-width-flex-basis-geddski) · Henning Koch, makandra cards, 2019-08-30, updated 2025-03-17 · how each size property sets the starting size or a limit (*read*) · fetched 2026-10-14
- **Our delta:** a worked shrink calculation showing large-basis items lose more.

### T04-05 · Main and cross axis — Master · ✅ written `docs/css/pages/phase-4-flexbox/05-main-and-cross-axis.md`
- **Read this:** [Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox) · MDN · main and cross axes and all four `flex-direction` values (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Box alignment in flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Box_alignment/In_flexbox) · MDN · `justify-content` on the main axis, `align-items` on the cross axis (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [An Interactive Guide to Flexbox in CSS](https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/) · Josh W. Comeau, 2022-11-22, updated 2026-04-27 · flip `flex-direction` and watch the primary and cross axes swap (*read*) · fetched 2026-10-14
- **Our delta:** a "which axis is this property on" checklist after every direction change.

### T04-06 · Flexbox patterns that carry real applications — With · ✅ written `docs/css/pages/phase-4-flexbox/06-flexbox-patterns/01-bars-and-shells.md`
- **Read this:** [Typical use cases of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Typical_use_cases_of_flexbox) · MDN · navigation, split navigation, centring, card footers pushed down, media objects, form controls (*headings only*) · covers our angle: **partial** — no sticky footer, truncating middle item or wrapping toolbar · fetched 2026-10-14
- **Beyond the docs:** [The Flexbox Holy Albatross](https://heydonworks.com/article/the-flexbox-holy-albatross/) · Heydon Pickering, 2019-01-13 · a row that flips to a stack at a container width using `flex-basis` and a custom property (*read*) · fetched 2026-10-14
- **Our delta:** the six patterns as one set with the failure mode of each.

### T04-07 · Flexbox and text overflow — Overflow · ✅ written `docs/css/pages/phase-4-flexbox/07-flexbox-and-text-overflow.md`
- **Read this:** [text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow) · MDN · ellipsis needs `overflow: hidden` and `white-space: nowrap` (*read*) · covers our angle: **partial** — no flex context · fetched 2026-10-14
- **Beyond the docs:** [Flexbox Gotchas Reloaded](https://dev.to/hbarcelos/flexbox-gotchas-reloaded-2i39) · Henrique Barcelos, DEV Community, 2020-04-20 · `min-width: 0` works on the outer flex child but not the inner one, then the nowrap, hidden, ellipsis trio (*read*) · fetched 2026-10-14
- **Our delta:** the chain written as one rule: which element gets which property.

---

## Phase 5 — Grid, deeply

### T05-01 · `repeat()`, `minmax()`, `auto-fit` vs `auto-fill` — Master · ✅ written `docs/css/pages/phase-5-grid/01-repeat-minmax-autofit.md`
- **Read this:** [repeat()](https://developer.mozilla.org/en-US/docs/Web/CSS/repeat) · MDN · `auto-fit` is `auto-fill` plus collapsing of empty tracks to `0px` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Auto-Sizing Columns in CSS Grid: auto-fill vs auto-fit](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/) · Sara Soueidan, CSS-Tricks, 2017-12-29 · side-by-side demos with few items, which is where the two differ (*read*) · fetched 2026-10-14
- **Our delta:** the one-line no-media-query card grid and when to pick each keyword.

### T05-02 · `fr` and the track sizing algorithm — Master · ✅ written `docs/css/pages/phase-5-grid/02-fr-and-track-sizing.md`
- **Read this:** [CSS Grid Layout Module Level 1](https://www.w3.org/TR/css-grid-1/) · W3C · section 7.2.4 "Flexible Lengths: the fr unit" and 11.3 "Track Sizing Algorithm" (*headings only*) · covers our angle: **full** but dense · fetched 2026-10-14
- **Beyond the docs:** [Debugging CSS Grid: Part 2: What the Fr(action)?](https://css-irl.info/debugging-css-grid-part-2-what-the-fraction/) · Michelle Barker, CSS-IRL, 2019-05-16 · `1fr` defaults to `minmax(auto, 1fr)` and gaps shrink the space left for `fr` tracks (*read*) · fetched 2026-10-14
- **Our delta:** why `1fr` is not `50%` once there is a gap, as a worked sum.

### T05-03 · The `minmax(0, 1fr)` fix — Master · ✅ written `docs/css/pages/phase-5-grid/03-the-minmax-zero-fix.md`
- **Read this:** [minmax()](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax) · MDN · the `auto` minimum is the largest minimum size of the items in the track; its demo uses `minmax(0, 1fr)` but does not explain why (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Preventing a Grid Blowout](https://css-tricks.com/preventing-a-grid-blowout/) · Chris Coyier, CSS-Tricks, 2018-10-01 · a wide `pre` blows out a `1fr` column; `minmax(0, 1fr)` or `min-width: 0` fixes it (*read*) · fetched 2026-10-14
- **Our delta:** the link to T04-02: same floor, two fixes.

### T05-04 · Named areas — Master · ✅ written `docs/css/pages/phase-5-grid/04-named-areas.md`
- **Read this:** [Grid template areas](https://developer.mozilla.org/docs/Web/CSS/CSS_Grid_Layout/Grid_Template_Areas) · MDN · the ASCII-art syntax and its rectangle rules (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Realizing common layouts using grids](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts) · MDN · a responsive named-areas page, redrawn inside a media query (*read*) · fetched 2026-10-14
- **Our delta:** one media query redrawing the whole page shell; no strong non-official piece found.

### T05-05 · Line-based placement — Master · ✅ written `docs/css/pages/phase-5-grid/05-line-based-placement.md`
- **Read this:** [Grid layout using line-based placement](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Line-based_placement) · MDN · `span`, negative line numbers and `grid-area` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Negative Grid Lines](https://css-irl.info/negative-grid-lines/) · Michelle Barker, CSS-IRL, 2018-10-14 · negative lines count from the end of the explicit grid, with implicit-track pitfalls (*read*) · fetched 2026-10-14
- **Our delta:** the four-value order of `grid-area`.

### T05-06 · Subgrid — Master · ✅ written `docs/css/pages/phase-5-grid/06-subgrid.md`
- **Read this:** [Subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid) · MDN · a nested grid reuses its parent's tracks; marked Baseline widely available since September 2023 (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Brand New Layouts with CSS Subgrid](https://www.joshwcomeau.com/css/subgrid/) · Josh W. Comeau, 2025-11-25, updated 2026-04-27 · cards and pricing features that align across siblings (*read*) · fetched 2026-10-14
- **Our delta:** the before/after for a card's title, body and button rows.

### T05-07 · Grid patterns that carry real applications — Master · ✅ written `docs/css/pages/phase-5-grid/07-grid-patterns.md`
- **Read this:** [Realizing common layouts using grids](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts) · MDN · named-areas shell, 12-column system, auto-placement listing (*read*) · covers our angle: **partial** — no full-bleed or overlap · fetched 2026-10-14
- **Beyond the docs:** [Full-Bleed Layout Using CSS Grid](https://www.joshwcomeau.com/css/full-bleed/) · Josh W. Comeau, 2020-10-05, updated 2025-12-13 · readable column with full-width children (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Layout Breakouts with CSS Grid](https://ryanmulligan.dev/blog/layout-breakouts/) · Ryan Mulligan, 2022-10-07 · named lines full, feature, popout and content (*read*) · fetched 2026-10-14
- **Our delta:** the five patterns as a set; the overlapping hero has no good outside source.

### T05-08 · Alignment in grid — Master · ✅ written `docs/css/pages/phase-5-grid/08-alignment-in-grid.md`
- **Read this:** [Box alignment in grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_alignment/Box_alignment_in_grid_layout) · MDN · `*-items` and `*-self` place items in areas; `*-content` places tracks in the container (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [The Fundamentals of CSS Alignment](https://css-tip.com/explore/alignment/) · Temani Afif, CSS-Tip · item level versus content level across grid, flex and block (*read*) · fetched 2026-10-14
- **Our delta:** the six properties in one two-by-three table.

### T05-09 · Explicit vs implicit grid — Understand · ✅ written `docs/css/pages/phase-5-grid/09-explicit-vs-implicit-grid.md`
- **Read this:** [Auto-placement in grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Auto-placement_in_grid_layout) · MDN · implicit tracks, `grid-auto-rows` and `grid-auto-columns`, `grid-auto-flow` with `column` and `dense` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** where surprise tracks come from; no extra third-party pick.

### T05-10 · Grid vs flexbox vs flow — Understand · ✅ written `docs/css/pages/phase-5-grid/10-grid-vs-flexbox-vs-flow.md`
- **Read this:** [Relationship of grid layout to other layout methods](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Relationship_of_grid_layout_with_other_layout_methods) · MDN · flexbox is one-dimensional, grid two-dimensional (*read*) · covers our angle: **partial** — comparison, not a decision procedure · fetched 2026-10-14
- **Beyond the docs:** [To Grid or to Flex?](https://css-irl.info/to-grid-or-to-flex/) · Michelle Barker, CSS-IRL, 2019-02-10 · choose per design need, not by blanket rule (*read*) · fetched 2026-10-14
- **Our delta:** an ordered decision procedure that includes normal flow.
