---
title: "Link map · CSS · Part 3 (phases 6–9)"
sidebar_label: "03 · adaptive and visual"
sidebar_position: 3
---

# Link map · CSS · Part 3 (phases 6–9)

Covers every topic row of phases 6 to 9 in `docs/css/syllabus/03-adaptive-and-visual.md`: container queries and intrinsic layout (T06-01 to T06-03), positioning and stacking (T07-01 to T07-04), colour and theming (T08-01 to T08-03), and motion (T09-01 to T09-03). That is 13 rows, and every one has a written page of ours.
*read* = I read the passage that supports the claim, on a page fetched at 200 (the final URL after redirects is the one given). MDN pages are very long, so the fetch covered the first 100000 characters of each; every claim below sits inside that part. MDN moved many CSS pages to new paths in 2025 to 2026 (`/Reference/`, `/Guides/`); the links here are the new paths. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after a second search, the block has no "Beyond the docs" line (T06-03 and T09-01 have none).

---

## Phase 6 — Container queries and intrinsic responsive

### T06-01 · Container queries — Master · ✅ written `docs/css/pages/phase-6-container-queries/01-container-queries.md`
- **Read this:** [CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) · MDN · `container-type: inline-size` on the container, then `@container (width > 700px)` on the children; names, units and style queries follow (*read*) · covers our angle: **full** — setup and syntax; the "why not the viewport" argument is only implied (a card reused without knowing where it sits) · fetched 2026-10-14
- **Also good:** [Container queries](https://web.dev/learn/css/container-queries) · web.dev Learn CSS · `container-type` (`inline-size`, `size`), `container-name`, and the `cqi` unit with an example; `cqh` appears only in the quiz (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Say Hello To CSS Container Queries](https://ishadeed.com/article/say-hello-to-css-container-queries/) · Ahmad Shadeed, 2021-04-13 · component-by-component cases (cards, sidebars, pagination, forms) showing why the parent's width is the right input; written when the feature was only in Chrome Canary behind a flag, so check syntax against MDN · fetched 2026-10-14 (*read*)
- **Our delta:** Baseline date (2023-02-14) and the rule for when the viewport is still the right input.

### T06-02 · Layouts that need no query — Master · ✅ written `docs/css/pages/phase-6-container-queries/02-layouts-that-need-no-query.md`
- **Read this:** [minmax()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/minmax) · MDN · track size range, three `minmax(0, 1fr)` tracks written out, and that `fr` is valid only for the maximum, not the minimum (*read*) · covers our angle: **partial** — only the `minmax()` piece; our `repeat(auto-fit, minmax(min(18rem, 100%), 1fr))` and `flex-wrap` are not there · fetched 2026-10-14
- **Also good:** [clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp) · MDN · `clamp(MIN, VAL, MAX)`, and for text size a relative-unit maximum no less than twice the minimum so text can reach 200% on zoom (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Auto-Sizing Columns in CSS Grid: auto-fill vs auto-fit](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/) · Sara Soueidan, CSS-Tricks, 2017-12-29 · the two keywords act the same until a row has spare room, then `auto-fill` keeps empty tracks and `auto-fit` collapses them · fetched 2026-10-14 (*read*)
- **Our delta:** the "breakpoint only when the design changes" rule, a table of what replaces which breakpoint (`auto-fit`, `flex-wrap`, `clamp()`), and when a breakpoint is still correct.

### T06-03 · User-preference queries — Master · ✅ written `docs/css/pages/phase-6-container-queries/03-user-preference-queries.md`
- **Read this:** [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme) · MDN · `light` or `dark` from the OS or browser, Baseline since January 2020 (*read*) · covers our angle: **partial** — one feature per page · fetched 2026-10-14
- **Also good:** [forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors) · MDN · detects Windows High Contrast style modes (`none` or `active`); example restores a border where `box-shadow` is forced to `none`; Baseline since September 2022 (*read*) · fetched 2026-10-14
- **Also good:** [prefers-contrast](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-contrast) · MDN · `more`, `less`, `custom`, `no-preference`; Baseline since May 2022 (*read*) · fetched 2026-10-14
- **Our delta:** a ranking of the four (reduced motion most of all, colour scheme closer to comfort) and keeping combinations manageable by changing tokens at `:root`. Our page also has a reduced-motion section; the dedicated page is under T09-03.

---

## Phase 7 — Positioning, stacking and overlay

### T07-01 · Stacking contexts — Master · ✅ written `docs/css/pages/phase-7-positioning/01-stacking-contexts.md`
- **Read this:** [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Positioned_layout/Stacking_context) · MDN · the list of creators: `opacity` below 1, `transform`, `filter`, `will-change`, `isolation: isolate`, `contain: layout` or `paint`, and more; a context is stacked as one unit in its parent (*read*) · covers our angle: **full** — the list and the "no escape from the parent" rule · fetched 2026-10-14
- **Beyond the docs:** [What The Heck, z-index??](https://www.joshwcomeau.com/css/stacking-contexts/) · Josh W. Comeau, 2021-02-22, updated 2024-09-13 · a tooltip with `z-index: 999999` that still sits under the header, because `main` has `position: relative` and `z-index: 1` and so forms its own context · fetched 2026-10-14 (*read*)
- **Our delta:** one table of creators with the condition for each, including `position: fixed` or `sticky`, flex and grid children, and `container-type`.

### T07-02 · `z-index` in practice — Master · ✅ written `docs/css/pages/phase-7-positioning/02-z-index-in-practice.md`
- **Read this:** [z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/z-index) · MDN · orders positioned and flex or grid items within their context; an integer value also creates a local context (*read*) · covers our angle: **partial** — the property reference, with no z-index scale or escalation story · fetched 2026-10-14
- **Also good:** [isolation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/isolation) · MDN · `isolate` always creates a stacking context; Baseline since January 2020 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fix Any CSS Z-index Issue With This One Trick](https://railsdesigner.com/css-isolation/) · Rails Designer (no author named), 2024-09-16 · content scrolling over a sticky nav, fixed by wrapping the content in an `isolate` element (Tailwind's `isolation: isolate`), not by a bigger number · fetched 2026-10-14 (*read*)
- **Our delta:** a named z-index scale as tokens, next to component-local `isolate` and the top layer.

### T07-03 · `position: sticky` — Master · ✅ written `docs/css/pages/phase-7-positioning/03-position-sticky.md`
- **Read this:** [position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position) · MDN · sticky offsets from the nearest scrolling ancestor (`overflow` hidden, scroll, auto, overlay) and needs a non-`auto` inset on that axis, else it acts like `relative` on that axis (*read*) · covers our angle: **partial** — two of the three conditions; the parent-must-be-taller condition is not spelled out there · fetched 2026-10-14
- **Beyond the docs:** [Troubleshooting CSS sticky positioning](https://blog.logrocket.com/troubleshooting-css-sticky-positioning) · Ibadehin Mojeed, LogRocket, 2024-11-13 · the missing offset, a parent too short to travel in, and an `overflow` ancestor, each with a fix (`align-items: start` for stretched grid or flex items) · fetched 2026-10-14 (*read*)
- **Our delta:** the three silent-failure conditions as a checklist.

### T07-04 · The clipped-dropdown problem — Understand · ✅ written `docs/css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md`
- **Read this:** [Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer) · MDN Glossary · a browser-made layer above all page content that holds fullscreen elements, modal dialogs, popovers and an open customizable `select` picker (*read*) · covers our angle: **partial** — defines the layer, does not show the clipping bug · fetched 2026-10-14
- **Also good:** [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) · MDN · the `popover` and `popovertarget` attributes, `showPopover()`, `:popover-open`; Baseline 2025, newly available since January 2025 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Introducing the popover API](https://developer.chrome.com/blog/introducing-popover-api) · Una Kravets, Chrome for Developers, page shows last updated 2023-05-23 and no publish date · popovers sit on a separate layer above the page, so no `z-index` juggling, with light-dismiss for `auto` popovers and focus moving into the popover; it does not discuss `overflow` clipping directly, and its animation notes are dated · fetched 2026-10-14 (*read*)
- **Our delta:** the "behind" versus "cut off" table, why an ancestor's `overflow` clips even absolutely positioned children, and why `z-index` cannot fix it.

---

## Phase 8 — Colour and theming

### T08-01 · `oklch()` and perceptual colour — Master · ✅ written `docs/css/pages/phase-8-color-theming/01-oklch-and-perceptual-colour.md`
- **Read this:** [oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch) · MDN · lightness, chroma, hue in Oklab; Baseline since May 2023; a short note that HSL lightness is not comparable and that red sits near hue 29deg (*read*) · covers our angle: **partial** — syntax reference with a brief HSL note, no scale-building · fetched 2026-10-14
- **Beyond the docs:** [OKLCH in CSS: why we moved from RGB and HSL](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) · Andrey Sitnik and Travis Turner, Evil Martians, 2025-09-17 · HSL lightness is not consistent across hues, OKLCH is, so generated palettes stay predictable; it also says OKLCH alone is not enough for contrast and recommends APCA · fetched 2026-10-14 (*read*)
- **Our delta:** a five-step brand scale with one hue and evenly stepped L, and why chroma must drop at the light and dark ends.

### T08-02 · `color-mix()` — Master · ✅ written `docs/css/pages/phase-8-color-theming/02-color-mix.md`
- **Read this:** [color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix) · MDN · mixes colours in a chosen space (default `oklab`) with optional percentages; Baseline since May 2023 (*read*) · covers our angle: **partial** — syntax, no state-tone recipe · fetched 2026-10-14
- **Beyond the docs:** [Creating color palettes with the CSS color-mix() function](https://developer.mozilla.org/en-US/blog/color-palettes-css-color-mix/) · Michelle Barker, MDN Blog, 2024-03-08 · tints, shades and opacity variants from a custom property (examples mix in `srgb`); argues that `srgb` mixes can look muddy while `lch` and `oklch` stay vibrant, and says the space is the reader's choice · fetched 2026-10-14 (*read*)
- **Our delta:** hover, active, border and disabled tones from one brand token, mixed toward the surface colour rather than white.

### T08-03 · Dark mode properly — Dark · ✅ written `docs/css/pages/phase-8-color-theming/03-dark-mode-properly.md`
- **Read this:** [CSS color-scheme-dependent colors with light-dark()](https://web.dev/articles/light-dark) · Bramus, web.dev, last updated 2024-05-13 · `light-dark()` picks one of two colours and needs a `color-scheme`, usually on `:root` (*read*) · covers our angle: **partial** — no semantic tokens or user override · fetched 2026-10-14
- **Also good:** [Improve dark mode default with color-scheme and a meta tag](https://web.dev/articles/color-scheme) · Thomas Steiner, web.dev, last updated 2020-04-08 · the property and its meta tag opt form controls, scrollbars and system colours into the browser's theme defaults (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Embracing Native Dark Mode with the CSS color-scheme Property](https://rebeccamdeprey.com/blog/embracing-native-dark-mode-with-the-css-color-scheme-property) · Rebecca M. Deprey, 2025-05-03 · `color-scheme: light dark` on the root, `light-dark()` for colours, and a React toggle that sets `data-theme`, saves it in localStorage and follows OS changes · fetched 2026-10-14 (*read*)
- **Our delta:** semantic tokens and an explicit override that beats the system setting.

---

## Phase 9 — Motion and the cost model

### T09-01 · What is cheap to animate — Master · ✅ written `docs/css/pages/phase-9-motion/01-what-is-cheap-to-animate.md`
- **Read this:** [How to create high-performance CSS animations](https://web.dev/articles/animations-guide) · Kayce Basques and Rachel Andrew, web.dev, last updated 2020-10-06 · animate only `transform` and `opacity`, avoid `top` and `left`, check with DevTools, use `will-change` sparingly (*read*) · covers our angle: **full** — the short list and the reason · fetched 2026-10-14
- **Also good:** [Stick to compositor-only properties and manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count) · Paul Lewis, web.dev, last updated 2015-03-20 · every layer needs memory and management, so too many promoted layers cost memory and GPU time; dated, Chrome-centred (*read*) · fetched 2026-10-14
- **Our delta:** the table of properties by pipeline stage (layout, paint, composite).

### T09-02 · Transition traps — Master · ✅ written `docs/css/pages/phase-9-motion/02-transition-traps.md`
- **Read this:** [Using CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transitions/Using) · MDN · the "Transitioning display and content-visibility" example: `transition-behavior: allow-discrete`, `@starting-style`, and the `display: none` flip at the start or end (*read*) · covers our angle: **partial** — the display and starting-style fixes, not the full trap list · fetched 2026-10-14
- **Also good:** [Four new CSS features for smooth entry and exit animations](https://developer.chrome.com/blog/entry-exit-animations) · Una Kravets and Joey Arhar, Chrome for Developers, page shows last updated 2023-08-16 with an update note dated 2024-09-13 · `display` in keyframes, `allow-discrete`, `@starting-style`, `overlay`; notes `@starting-style` must follow normal rules since Chrome 130 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [One of the Boss Battles of CSS is Almost Won! Transitioning to Auto](https://blog.master.dev/one-of-the-boss-battles-of-css-is-almost-won-transitioning-to-auto/) · Chris Coyier, Frontend Masters blog (Master.dev), 2024-06-12, with a September 2024 update · why zero to natural height cannot interpolate, then `calc-size()` and `interpolate-size`; the author first calls it experimental in Canary, then saw it in stable Chrome 129; no other browsers documented · fetched 2026-10-14 (*read*)
- **Our delta:** six traps, each as a failure first and a fix second: `display: none`, missing starting value, `auto`, shorthand reset, `transition: all`, and page load.

### T09-03 · `prefers-reduced-motion` — Master · ✅ written `docs/css/pages/phase-9-motion/03-prefers-reduced-motion.md`
- **Read this:** [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) · MDN · the example swaps a scaling `pulse` for a slower, fading `dissolve` under `reduce` (*read*) · covers our angle: **partial** — shows replace-not-delete in one example · fetched 2026-10-14
- **Also good:** [prefers-reduced-motion: Sometimes less movement is more](https://web.dev/articles/prefers-reduced-motion) · Thomas Steiner, web.dev, last updated 2019-03-11 · the query in CSS, `matchMedia` in JavaScript, static `picture` sources (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Accessible Animations in React](https://www.joshwcomeau.com/react/prefers-reduced-motion/) · Josh W. Comeau, 2020-05-04, updated 2026-04-29 (page title: Accessible Animations in React with "prefers-reduced-motion") · prefers motion-free alternatives (fades are generally safe) and doubts a global near-zero duration override, which can make JavaScript-driven motion faster; React hook examples are not our focus · fetched 2026-10-14 (*read*)
- **Our delta:** never delete the state change (replace it), the limits of the blanket reset, and a JavaScript half using `matchMedia`.
