---
title: "Link map · CSS · Part 3 (phases 6–9)"
sidebar_label: "03 · adaptive and visual"
sidebar_position: 3
---

# Link map · CSS · Part 3 (phases 6–9)

Covers every topic row of phases 6 to 9 in `docs/css/syllabus/03-adaptive-and-visual.md`: container queries and intrinsic layout (T06-01 to T06-03), positioning and stacking (T07-01 to T07-04), colour and theming (T08-01 to T08-03), and motion (T09-01 to T09-03). That is 13 rows, and every one has a written page of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, opening or headings checked. MDN pages are very long, so the fetch covered the opening part of each. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

---

## Phase 6 — Container queries and intrinsic responsive

### T06-01 · Container queries — Master · ✅ written `docs/css/pages/phase-6-container-queries/01-container-queries.md`
- **Read this:** [CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) · MDN · `container-type: inline-size` on the container, then `@container (width > 700px)` on the children; names, units and style queries follow (*read*) · covers our angle: **full** — setup and syntax; the "why not the viewport" argument is brief · fetched 2026-10-14
- **Also good:** [Container queries](https://web.dev/learn/css/container-queries) · web.dev Learn CSS · `container-type`, `container-name` and the `cqi` and `cqh` units, in course form (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Say Hello To CSS Container Queries](https://ishadeed.com/article/say-hello-to-css-container-queries/) · Ahmad Shadeed, 2021-04-13 · component-by-component cases (cards, sidebars, pagination, forms) showing why the parent's width is the right input; written when the feature was behind a flag, so check syntax against MDN · fetched 2026-10-14 (*read*)
- **Our delta:** Baseline date (2023-02-14) and the rule for when the viewport is still the right input.

### T06-02 · Layouts that need no query — Master · ✅ written `docs/css/pages/phase-6-container-queries/02-layouts-that-need-no-query.md`
- **Read this:** [minmax()](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax) · MDN · track size range, the `repeat(3, minmax(0, 1fr))` pattern, and that `min` cannot be `fr` (*read*) · covers our angle: **partial** — only the `minmax()` piece, not `auto-fit` or `flex-wrap` · fetched 2026-10-14
- **Also good:** [clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp) · MDN · `clamp(MIN, VAL, MAX)` and the advice to keep the maximum at least twice the minimum for zoom (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Auto-Sizing Columns in CSS Grid: auto-fill vs auto-fit](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/) · Sara Soueidan, CSS-Tricks, 2017-12-29 · the two keywords act the same until a row has spare room, then `auto-fill` keeps empty tracks and `auto-fit` collapses them · fetched 2026-10-14 (*read*)
- **Our delta:** the "breakpoint only when the design changes" rule and `flex-wrap` as the third tool.

### T06-03 · User-preference queries — Master · ✅ written `docs/css/pages/phase-6-container-queries/03-user-preference-queries.md`
- **Read this:** [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) · MDN · `light` or `dark` from the OS or browser, Baseline since January 2020 (*read*) · covers our angle: **partial** — one feature per page · fetched 2026-10-14
- **Also good:** [forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors) · MDN · detects Windows High Contrast style modes; example restores a border where `box-shadow` is removed (*read*) · fetched 2026-10-14
- **Also good:** [prefers-contrast](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast) · MDN · `more`, `less`, `custom`, `no-preference`; Baseline since May 2022 (*read*) · fetched 2026-10-14
- **Our delta:** which of the four are requirements rather than polish, in one table. The reduced-motion page is linked under T09-03.

---

## Phase 7 — Positioning, stacking and overlay

### T07-01 · Stacking contexts — Master · ✅ written `docs/css/pages/phase-7-positioning/01-stacking-contexts.md`
- **Read this:** [The stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context) · MDN · the list of creators: `opacity` below 1, `transform`, `filter`, `will-change`, `isolation: isolate`, `contain: layout` or `paint` (*read*) · covers our angle: **full** — the list and the "no escape from the parent" rule · fetched 2026-10-14
- **Beyond the docs:** [Stacking contexts](https://www.joshwcomeau.com/css/stacking-contexts/) · Josh W. Comeau, 2021-02-22, updated 2024-09-13 · the tooltip with a huge `z-index` that still sits under the header, because its parent forms a lower-ranked context · fetched 2026-10-14 (*read*)
- **Our delta:** one table of creators with the reason each exists.

### T07-02 · `z-index` in practice — Master · ✅ written `docs/css/pages/phase-7-positioning/02-z-index-in-practice.md`
- **Read this:** [z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index) · MDN · orders positioned and flex or grid items within their context; non-`auto` values create a local context (*read*) · covers our angle: **partial** — the "why 9999 fails" argument is left to the reader · fetched 2026-10-14
- **Also good:** [isolation](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation) · MDN · `isolate` always creates a stacking context; Baseline since January 2020 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fix Any CSS Z-index Issue With This One Trick](https://railsdesigner.com/css-isolation/) · Rails Designer, 2024-09-16 · content scrolling over a sticky nav fixed by `isolation: isolate` on the parent, not a bigger number · fetched 2026-10-14 (*read*)
- **Our delta:** a named z-index scale next to `isolate`.

### T07-03 · `position: sticky` — Master · ✅ written `docs/css/pages/phase-7-positioning/03-position-sticky.md`
- **Read this:** [position](https://developer.mozilla.org/en-US/docs/Web/CSS/position) · MDN · sticky offsets from the nearest scrolling ancestor (`overflow` hidden, scroll, auto, overlay) and needs a non-`auto` inset on that axis, else it acts like `relative` (*read*) · covers our angle: **partial** — two of the three conditions; parent height is not stated there · fetched 2026-10-14
- **Beyond the docs:** [Troubleshooting CSS sticky positioning](https://blog.logrocket.com/troubleshooting-css-sticky-positioning) · Ibadehin Mojeed, LogRocket, 2024-11-13 · the missing offset, a parent too short to travel in, and an `overflow` ancestor, each with a fix · fetched 2026-10-14 (*read*)
- **Our delta:** the three silent-failure conditions as a checklist.

### T07-04 · The clipped-dropdown problem — Understand · ✅ written `docs/css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md`
- **Read this:** [Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer) · MDN Glossary · a browser-made layer above all page content that holds fullscreen elements, modal dialogs and popovers (*read*) · covers our angle: **partial** — defines the layer, does not show the clipping bug · fetched 2026-10-14
- **Also good:** [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) · MDN · the `popover` and `popovertarget` attributes, `showPopover()`, `:popover-open`; Baseline 2025 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Introducing the Popover API](https://developer.chrome.com/blog/introducing-popover-api) · Una Kravets, Chrome for Developers, page updated 2023-05-23 · popovers sit above the rest of the page with light-dismiss and focus handling built in, so no `z-index` juggling; it does not discuss `overflow` clipping directly, and its animation notes are dated · fetched 2026-10-14 (*read*)
- **Our delta:** the `overflow: hidden` clipping demo and why `z-index` cannot fix it.

---

## Phase 8 — Colour and theming

### T08-01 · `oklch()` and perceptual colour — Master · ✅ written `docs/css/pages/phase-8-color-theming/01-oklch-and-perceptual-colour.md`
- **Read this:** [oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch) · MDN · lightness, chroma, hue in Oklab; Baseline since May 2023 (*headings only*) · covers our angle: **partial** — syntax reference, no HSL comparison · fetched 2026-10-14
- **Beyond the docs:** [OKLCH in CSS: why we moved from RGB and HSL](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) · Andrey Sitnik and Travis Turner, Evil Martians, 2025-09-17 · HSL lightness is not consistent across hues, OKLCH is, so generated palettes and contrast checks stay predictable · fetched 2026-10-14 (*read*)
- **Our delta:** a token scale with one L ramp that holds at every step.

### T08-02 · `color-mix()` — Master · ✅ written `docs/css/pages/phase-8-color-theming/02-color-mix.md`
- **Read this:** [color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) · MDN · mixes colours in a chosen space (default `oklab`) with optional percentages; Baseline since May 2023 (*read*) · covers our angle: **partial** — syntax, no state-tone recipe · fetched 2026-10-14
- **Beyond the docs:** [Color palettes with CSS color-mix()](https://developer.mozilla.org/en-US/blog/color-palettes-css-color-mix/) · Michelle Barker, MDN Blog, 2024-03-08 · tints, shades and opacity variants from custom properties, and why `oklch` mixes smoother than `srgb` · fetched 2026-10-14 (*read*)
- **Our delta:** hover, active, disabled and border tones from one brand token.

### T08-03 · Dark mode properly — Dark · ✅ written `docs/css/pages/phase-8-color-theming/03-dark-mode-properly.md`
- **Read this:** [CSS color-scheme-dependent colors with light-dark()](https://web.dev/articles/light-dark) · Bramus, web.dev, last updated 2024-05-13 · `light-dark()` picks one of two colours and needs a `color-scheme`, usually on `:root` (*read*) · covers our angle: **partial** — no semantic tokens or user override · fetched 2026-10-14
- **Also good:** [Improved dark mode default styling with the color-scheme CSS property](https://web.dev/articles/color-scheme) · Thomas Steiner, web.dev · opts form controls, scrollbars and system colours into dark defaults (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Embracing Native Dark Mode with the CSS color-scheme Property](https://rebeccamdeprey.com/blog/embracing-native-dark-mode-with-the-css-color-scheme-property) · Rebecca M. DePrey, 2025-05-03 · `color-scheme: light dark` on the root, `light-dark()` for colours, and a toggle that sets `data-theme` and saves it in localStorage while following OS changes · fetched 2026-10-14 (*read*)
- **Our delta:** semantic tokens and an explicit override that beats the system setting.

---

## Phase 9 — Motion and the cost model

### T09-01 · What is cheap to animate — Master · ✅ written `docs/css/pages/phase-9-motion/01-what-is-cheap-to-animate.md`
- **Read this:** [How to create high-performance CSS animations](https://web.dev/articles/animations-guide) · Kayce Basques and Rachel Andrew, web.dev, 2020-10-06 · animate only `transform` and `opacity`, avoid `top` and `left`, check with DevTools, use `will-change` sparingly (*read*) · covers our angle: **full** — the short list and the reason · fetched 2026-10-14
- **Also good:** [Stick to compositor-only properties and manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count) · Paul Lewis, web.dev, 2015-03-20 · too many promoted layers cost memory and GPU time; dated, Chrome-centred (*read*) · fetched 2026-10-14
- **Our delta:** the table of properties by pipeline stage (layout, paint, composite).

### T09-02 · Transition traps — Master · ✅ written `docs/css/pages/phase-9-motion/02-transition-traps.md`
- **Read this:** [Using CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions) · MDN · includes `transition-behavior: allow-discrete`, `@starting-style` and `display: none` transitions (*headings only*) · covers our angle: **partial** — covers the fix more than the trap list · fetched 2026-10-14
- **Also good:** [Four new CSS features for smooth entry and exit animations](https://developer.chrome.com/blog/entry-exit-animations) · Una Kravets and Joey Arhar, Chrome for Developers, updated 2024-09-13 · `display` in keyframes, `allow-discrete`, `@starting-style`, `overlay`; notes `@starting-style` must follow normal rules since Chrome 130 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [One of the Boss Battles of CSS is Almost Won! Transitioning to Auto](https://blog.master.dev/one-of-the-boss-battles-of-css-is-almost-won-transitioning-to-auto/) · Chris Coyier, Frontend Masters blog, 2024-06-12 · why zero to natural height cannot interpolate, then `calc-size()` and `interpolate-size`; recent-Chrome support only · fetched 2026-10-14 (*read*)
- **Our delta:** the three traps as failures first, fixes second.

### T09-03 · `prefers-reduced-motion` — Master · ✅ written `docs/css/pages/phase-9-motion/03-prefers-reduced-motion.md`
- **Read this:** [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · MDN · the example swaps a scaling `pulse` for a gentle `dissolve` under `reduce` (*read*) · covers our angle: **partial** — shows replace-not-delete in one example · fetched 2026-10-14
- **Also good:** [prefers-reduced-motion: Sometimes less movement is more](https://web.dev/articles/prefers-reduced-motion) · Thomas Steiner, web.dev · the query in CSS, `matchMedia` in JavaScript, static `picture` sources (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Accessible Animations in React](https://www.joshwcomeau.com/react/prefers-reduced-motion/) · Josh W. Comeau, 2020-05-04, updated 2026-04-29 · replace motion with motion-free alternatives and argues against a global near-zero duration override; React hook examples are not our focus · fetched 2026-10-14 (*read*)
- **Our delta:** never delete the state change, with a JavaScript-driven motion note.
