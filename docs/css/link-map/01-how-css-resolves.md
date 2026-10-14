---
title: "Link map · CSS · Part 1 (phases 0–2)"
sidebar_label: "01 · how css resolves"
sidebar_position: 1
---

# Link map · CSS · Part 1 (phases 0–2)

Covers every topic row of phases 0, 1 and 2 in `docs/css/syllabus/01-how-css-works.md`: how CSS runs (T00-01 to T00-12), selectors (T01-01 to T01-16) and cascade control (T02-01 to T02-04). That is 32 rows, and every one has a written page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the title or opening checked against the search summary, not read in full. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means MDN, WHATWG, web.dev and Chrome or WebKit documentation.

---

## Phase 0 — How CSS runs

### T00-01 · The rendering pipeline — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/02-the-rendering-pipeline.md`
- **Read this:** [Rendering performance](https://web.dev/articles/rendering-performance) · web.dev · the pixel pipeline (JS, style, layout, paint, composite) and the cost of each stage · (*headings only*) · covers our angle: **partial** — the per-property invalidation table lives in the compositor-only article below · fetched 2026-10-14
- **Also good:** [Stick to compositor-only properties and manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count) · web.dev · which changes skip layout and paint · (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Inside look at modern web browser, part 3](https://developer.chrome.com/blog/inside-browser-part3) · Mariko Kosaka, Chrome for Developers, last updated 2018-09-20 · walks style, layout, paint and compositing as one story, with the compositor thread running animations without the main thread · fetched 2026-10-14 (*read*)
- **Our delta:** the stage each property invalidates, as a lookup rather than a narrative.

### T00-02 · CSS fails silently — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/05-css-fails-silently.md`
- **Read this:** [CSS error handling](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_syntax/Error_handling) · MDN · a bad declaration is skipped, an invalid selector drops the whole block, and browsers raise no alert · (*headings only*) · covers our angle: **partial** — nothing on the unclosed-brace case in depth · fetched 2026-10-14
- **Also good:** [Selector list](https://developer.mozilla.org/en-US/docs/Web/CSS/Selector_list) · MDN · one unsupported selector invalidates the whole rule, with the `:is()` remedy · (*headings only*) · fetched 2026-10-14
- **Our delta:** the three failure shapes side by side, and the DevTools tell for each.

### T00-03 · Baseline as a shipping decision — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/10-baseline-and-shipping.md`
- **Read this:** [Baseline](https://web.dev/baseline) · web.dev · Limited, Newly and Widely available, and the core browser set · (*headings only*) · covers our angle: **partial** — status definitions, not the `web-features` workflow · fetched 2026-10-14
- **Also good:** [How to query the Web Platform Dashboard for Baseline tooling](https://web.dev/articles/web-platform-dashboard-baseline) · web.dev · reading Baseline status from the webstatus.dev API by `web-features` id (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [How to Use Baseline Data](https://12daysofweb.dev/2024/how-to-use-baseline-data/) · Rachel Andrew, 12 Days of Web · Widely is safe, Newly is a case-by-case call, and Baseline deliberately leaves polyfill decisions to you · fetched 2026-10-14 (*read*)
- **Our delta:** why one engine's `CSS.supports` is not an answer.

### T00-04 · DevTools as the missing error console — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/12-devtools-for-css.md`
- **Read this:** [CSS features reference](https://developer.chrome.com/docs/devtools/css/reference) · Chrome DevTools · Styles and Computed filtering, forcing element state with `:hov`, and the Layout pane · (*headings only*) · covers our angle: **partial** — Chrome only; struck-through invalid declarations are not the focus · fetched 2026-10-14
- **Beyond the docs:** [Hidden gems of the Chrome DevTools, part 2: CSS tools](https://dev.to/juhanakristian/hidden-gems-of-the-chrome-devtools-part-2-css-tools-g8k) · Juhana Jauhiainen, DEV Community, 2021-06-25 · short tour of grid and flex overlays and forced states · fetched 2026-10-14 (*read*)
- **Our delta:** reading DevTools as the error console CSS does not have.

### T00-05 · What CSS is — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/01-what-css-is.md`
- **Read this:** [What is CSS?](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/What_is_CSS) · MDN Learn · CSS as rules applied to a DOM, with rule anatomy · (*headings only*) · covers our angle: **partial** — no "debug by asking which rule won" framing · fetched 2026-10-14
- **Our delta:** declarative and resolved, so you debug by the winner, not by tracing.

### T00-06 · Getting CSS to the page — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/03-how-stylesheets-reach-the-page.md`
- **Read this:** [@import](https://developer.mozilla.org/en-US/docs/Web/CSS/@import) · MDN · syntax, `layer()` and `supports()` options, and the rule that it must precede other rules · (*headings only*) · covers our angle: **partial** — the cost is not the focus · fetched 2026-10-14
- **Beyond the docs:** [don't use @import](https://www.stevesouders.com/blog/2009/04/09/dont-use-import/) · Steve Souders, 2009-04-09 · a nested `@import` forces the outer sheet to download and parse first, adding a round trip; the IE-specific parts are dated · fetched 2026-10-14 (*read*)
- **Our delta:** `<link>`, `<style>`, inline and `@import` compared by when the browser discovers each.

### T00-07 · Render-blocking CSS — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/04-render-blocking-css.md`
- **Read this:** [Render-blocking CSS](https://web.dev/articles/critical-rendering-path/render-blocking-css) · web.dev, 2014-03-31 · `media` absent or `all` blocks; `print` does not; a query blocks only if it matches; every sheet still downloads (*read*) · covers our angle: **full** — the page is old, so check specifics in DevTools · fetched 2026-10-14
- **Also good:** [Defer non-critical CSS](https://web.dev/articles/defer-non-critical-css) · web.dev · inlining critical CSS and loading the rest off the critical path (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [CSS and network performance](https://csswizardry.com/2018/11/css-and-network-performance/) · Harry Roberts, CSS Wizardry, 2018-11 · how CSS placement affects network behaviour · fetched 2026-10-14 (*headings only*)
- **Our delta:** none material beyond the first-paint framing.

### T00-08 · `@supports` feature queries — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/09-supports-feature-queries.md`
- **Read this:** [Using feature queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_conditional_rules/Using_feature_queries) · MDN · declaration tests, `selector()` and combining with `and` / `or` / `not` · (*headings only*) · covers our angle: **partial** — no "fallback usually needs no query" argument · fetched 2026-10-14
- **Also good:** [@supports](https://developer.mozilla.org/en-US/docs/Web/CSS/@supports) · MDN · syntax reference (*headings only*) · fetched 2026-10-14
- **Our delta:** writing the fallback first so the query is often unnecessary.

### T00-09 · User-agent stylesheets — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/06-user-agent-stylesheets.md`
- **Read this:** [Rendering](https://html.spec.whatwg.org/multipage/rendering.html) · WHATWG HTML Standard · the suggested default rendering for HTML elements, which engines implement as their UA sheets (*headings only*) · covers our angle: **partial** — spec text, not how to inspect it · fetched 2026-10-14
- **Beyond the docs:** [User Agent Style Sheets: Basics and Samples](https://meiert.com/blog/user-agent-style-sheets/) · Jens Oliver Meiert · what UA sheets are and where to find each engine's copy · fetched 2026-10-14 (*headings only*)
- **Our delta:** inspect in DevTools instead of guessing a default.

### T00-10 · Resets — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/07-resets-and-normalisers.md`
- **Read this:** [A Modern CSS Reset](https://www.joshwcomeau.com/css/custom-css-reset/) · Josh Comeau · a short reset with the reason for each rule; the page states it was updated 2026-06-03 · (*headings only*) · covers our angle: **partial** — author opinion, not measured against defaults · fetched 2026-10-14
- **Also good:** [A (more) Modern CSS Reset](https://piccalil.li/blog/a-modern-css-reset) · Andy Bell, Piccalilli · box sizing, text-size inflation, margins and list styles (*headings only*) · fetched 2026-10-14
- **Our delta:** each line justified against a measured UA default. No official source exists; both picks are third-party.

### T00-11 · The at-rule map — Rule · ✅ written `docs/css/pages/phase-0-how-css-runs/08-the-at-rule-map.md`
- **Read this:** [At-rule](https://developer.mozilla.org/en-US/docs/Web/CSS/At-rule) · MDN · what an at-rule is and the list of them · (*headings only*) · covers our angle: **partial** — no note on an unsupported at-rule dropping its whole block · fetched 2026-10-14
- **Our delta:** the eleven-rule map and the drop-the-block failure.

### T00-12 · Vendor prefixes in 2026 — Know · ✅ written `docs/css/pages/phase-0-how-css-runs/11-vendor-prefixes.md`
- **Read this:** [Vendor Prefix](https://developer.mozilla.org/en-US/docs/Glossary/Vendor_Prefix) · MDN Glossary · what prefixes were and why they were abandoned · (*headings only*) · covers our angle: **partial** — history, not the 2026 state · fetched 2026-10-14
- **Beyond the docs:** [It's 2026, why are vendor prefixes still in your CSS?](https://blog.omgmog.net/post/why-vendor-prefixes-are-still-in-your-css/) · Max Glenister, 2026-03-11 · says almost all remaining need is `-webkit-` for Safari, with `tab-size` the `-moz-` exception; lists `appearance`, `backdrop-filter`, `user-select` as transitional · fetched 2026-10-14 (*read*)
- **Our delta:** the two that are not dead, checked against our own pins.

---

## Phase 1 — Selectors

### T01-01 · `:has()` — Master · ✅ written `docs/css/pages/phase-1-selectors/06-has.md`
- **Read this:** [:has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has) · MDN · relative selector argument, parent and previous-sibling use, no nesting `:has()` · (*headings only*) · covers our angle: **partial** — little on replacing state-toggling JS · fetched 2026-10-14
- **Also good:** [CSS Has Pseudo Class](https://webkit.org/blog/13096/css-has-pseudo-class/) · WebKit blog · the engine team's examples (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Level Up Your CSS Skills With The :has() Selector](https://smashingmagazine.com/2023/01/level-up-css-skills-has-selector/) · Smashing Magazine, 2023-01 · practical patterns · fetched 2026-10-14 (*headings only*)
- **Our delta:** the JavaScript patterns it deletes.

### T01-02 · `:is()` and `:where()` — Master · ✅ written `docs/css/pages/phase-1-selectors/05-is-and-where.md`
- **Read this:** [:where()](https://developer.mozilla.org/en-US/docs/Web/CSS/:where) · MDN · zero specificity, forgiving list; pairs with the `:is()` page · (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [:is()](https://developer.mozilla.org/en-US/docs/Web/CSS/:is) · MDN · takes the specificity of its most specific argument (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [CSS is where the magic happens](https://matthiasott.com/notes/css-is-where-the-magic-happens) · Matthias Ott · `:where()` for overridable defaults · fetched 2026-10-14 (*headings only*)
- **Our delta:** `:where()` as the default-layer tool.

### T01-03 · Nesting — Master · ✅ written `docs/css/pages/phase-1-selectors/12-nesting.md`
- **Read this:** [CSS nesting and specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Nesting_and_specificity) · MDN · `&` takes the highest specificity of the parent list like `:is()` (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [Nesting](https://web.dev/learn/css/nesting) · web.dev Learn CSS · the `:is()` desugaring with a worked specificity case (*headings only*) · fetched 2026-10-14
- **Our delta:** a one-glance desugar table.

### T01-04 · Pseudo-elements — Master · ✅ written `docs/css/pages/phase-1-selectors/10-pseudo-elements.md`
- **Read this:** [Pseudo-elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements) · MDN · the list and what each creates · (*headings only*) · covers our angle: **partial** — flex/grid item behaviour is on the `::before` page · fetched 2026-10-14
- **Also good:** [::before](https://developer.mozilla.org/en-US/docs/Web/CSS/::before) · MDN · the `content` requirement (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [::before and ::after Pseudo-Elements in CSS](https://johnkavanagh.co.uk/articles/before-and-after-pseudo-elements-in-css/) · John Kavanagh · practical uses (*headings only*) · fetched 2026-10-14
- **Our delta:** why they become flex and grid items.

### T01-05 · Combinators — Master · ✅ written `docs/css/pages/phase-1-selectors/02-combinators.md`
- **Read this:** [Combinators](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Combinators) · MDN Learn · descendant, child, next and subsequent sibling (*headings only*) · covers our angle: **partial** — no component-leak angle · fetched 2026-10-14
- **Also good:** [Selectors and combinators](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors/Selectors_and_combinators) · MDN reference (*headings only*) · fetched 2026-10-14
- **Our delta:** how one space leaks a rule into nested components.

### T01-06 · Selector families — Master · ✅ written `docs/css/pages/phase-1-selectors/01-the-selector-families.md`
- **Read this:** [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors) · MDN · the full selector index (*headings only*) · covers our angle: **partial** — an index, no coupling analysis · fetched 2026-10-14
- **Beyond the docs:** [Keep your CSS selectors short](https://csswizardry.com/2012/05/keep-your-css-selectors-short/) · Harry Roberts, 2012-05-15 · long descendant selectors create a location dependency; a standalone class can move anywhere · fetched 2026-10-14 (*read*)
- **Our delta:** the coupling each family creates.

### T01-07 · Selector lists, forgiving and not — Understand · ✅ written `docs/css/pages/phase-1-selectors/04-selector-lists.md`
- **Read this:** [Selector list](https://developer.mozilla.org/en-US/docs/Web/CSS/Selector_list) · MDN · strict versus forgiving lists, with the `:is()` fix (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Beyond the docs:** [Day 35: forgiving selectors](https://matuzo.at/blog/2022/100daysof-day35) · Manuel Matuzovic, 2022 · a worked forgiving-versus-strict demo · fetched 2026-10-14 (*headings only*)
- **Our delta:** the six-component blast radius.

### T01-08 · Attribute selectors in full — Understand · ✅ written `docs/css/pages/phase-1-selectors/03-attribute-selectors.md`
- **Read this:** [Attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) · MDN · all operators and the `i` and `s` flags (*headings only*) · covers our angle: **partial** — no `*=` on `class` warning · fetched 2026-10-14
- **Beyond the docs:** [Case Insensitive CSS Attribute Selector](https://davidwalsh.name/css-attribute-case) · David Walsh · the `i` flag (*headings only*) · fetched 2026-10-14
- **Our delta:** why `*=` on `class` is usually a bug.

### T01-09 · Structural pseudo-classes — Understand · ✅ written `docs/css/pages/phase-1-selectors/07-structural-pseudo-classes.md`
- **Read this:** [:nth-child()](https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child) · MDN · An+B syntax and `of S` (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [More control over :nth-child() selections with the of S syntax](https://developer.chrome.com/docs/css-ui/css-nth-child-of-s) · Chrome for Developers · `:nth-child(2 of .highlight)` against `.highlight:nth-child(2)` (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Guide to Advanced CSS Selectors, part two](https://moderncss.dev/guide-to-advanced-css-selectors-part-two/) · Stephanie Eckles, Modern CSS · structural selector examples · fetched 2026-10-14 (*headings only*)
- **Our delta:** striping that survives filtering.

### T01-10 · State pseudo-classes — Understand · ✅ written `docs/css/pages/phase-1-selectors/08-state-pseudo-classes.md`
- **Read this:** [:focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible) · MDN · when the browser shows focus (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [Privacy and the :visited selector](https://developer.mozilla.org/en-US/docs/Web/CSS/Privacy_and_the_:visited_selector) · MDN · the colour-only allow-list and `getComputedStyle` lying about visited state (*headings only*) · fetched 2026-10-14; [:focus-within](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-within) · MDN
- **Our delta:** why `:visited` is deliberately crippled, in one table. No good third-party piece turned up.

### T01-11 · Form-state pseudo-classes — Understand · ✅ written `docs/css/pages/phase-1-selectors/09-form-state-pseudo-classes.md`
- **Read this:** [:user-invalid](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid) · MDN · matches only after user interaction (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Beyond the docs:** [CSS :valid / :invalid vs :user-valid / :user-invalid](https://pawelgrzybek.com/css-valid-invalid-vs-user-valid-user-invalid-pseudo-classes/) · Pawel Grzybek · the timing difference with demos · fetched 2026-10-14 (*headings only*)
- **Our delta:** script-free validation styling.

### T01-12 · `:not()`, `:empty`, `:root`, `:lang()`, `:dir()` — Understand · ✅ written `docs/css/pages/phase-1-selectors/11-not-empty-root.md`
- **Read this:** [:not()](https://developer.mozilla.org/en-US/docs/Web/CSS/:not) · MDN · specificity of its argument and strict list parsing (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [:empty](https://developer.mozilla.org/en-US/docs/Web/CSS/:empty) · MDN; [:dir()](https://developer.mozilla.org/en-US/docs/Web/CSS/:dir) · MDN · matches computed directionality, not the attribute (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [On :not and Specificity](https://bitsofco.de/on-not-and-specificity/) · Ire Aderinokun, bitsofcode · why a negation can beat a plain rule · fetched 2026-10-14 (*headings only*)
- **Our delta:** one page for all five, led by the specificity trap.

### T01-13 · Styling hooks — Understand · ✅ written `docs/css/pages/phase-1-selectors/13-styling-hooks.md`
- **Read this:** [Using data attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/Use_data_attributes) · MDN · the `data-*` mechanism (*headings only*) · covers our angle: **partial** — no class versus state versus test-id split · fetched 2026-10-14
- **Beyond the docs:** [The wasted potential of CSS attribute selectors](https://elisehe.in/2022/10/16/attribute-selectors) · Elise Hein, 2022-10-16 · style state from ARIA first, then `data-*`, not class strings; names the trade-offs · fetched 2026-10-14 (*read*)
- **Our delta:** never crossing style, state and test hooks.

### T01-14 · `@scope` — Know · ✅ written `docs/css/pages/phase-1-selectors/14-scope.md`
- **Read this:** [Limit the reach of your selectors with the CSS @scope at-rule](https://developer.chrome.com/docs/css-ui/at-scope) · Chrome for Developers · donut scope, and scoping proximity placed after specificity and before source order (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [@scope](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope) · MDN · syntax and status (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Native CSS @scope](https://blog.openreplay.com/native-css-scope/) · OpenReplay · a walk-through · fetched 2026-10-14 (*headings only*)
- **Our delta:** the proximity tiebreak as the only one that looks at the DOM.

### T01-15 · Selector performance — Know · ✅ written `docs/css/pages/phase-1-selectors/15-selector-performance.md`
- **Read this:** [Reduce the scope and complexity of style calculations](https://web.dev/articles/reduce-the-scope-and-complexity-of-style-calculations) · web.dev · where style recalculation cost actually sits (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Beyond the docs:** [CSS Selector Performance has changed! (For the better)](https://calendar.perfplanet.com/2011/css-selector-performance-has-changed-for-the-better/) · Nicole Sullivan, Web Performance Calendar, 2011-12-29 · rule hashes, ancestor filters and style sharing made old advice obsolete; adjacent combinators can still be slow · fetched 2026-10-14 (*read*)
- **Our delta:** a current measurement, since the best source is from 2011.

### T01-16 · Shadow DOM selectors — Know · ✅ written `docs/css/pages/phase-1-selectors/16-shadow-dom-selectors.md`
- **Read this:** [:host](https://developer.mozilla.org/en-US/docs/Web/CSS/:host) · MDN · styling the host from inside (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [::part()](https://developer.mozilla.org/en-US/docs/Web/CSS/::part) · MDN; [::slotted()](https://developer.mozilla.org/en-US/docs/Web/CSS/::slotted) · MDN (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Style Web Components and Shadow DOM with CSS](https://blog.openreplay.com/style-web-components-shadow-dom-css/) · OpenReplay · hosts, slots, parts and custom properties as a styling API (*headings only*) · fetched 2026-10-14
- **Our delta:** designing the styling API isolation forces.

---

## Phase 2 — Cascade control

### T02-01 · What the cascade compares, in order — Master · ✅ written `docs/css/pages/phase-2-cascade/01-what-the-cascade-compares.md`
- **Read this:** [The cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade) · MDN · origin and importance, layers, specificity, scoping proximity, order (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [Cascade layers](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Cascade_layers) · MDN Learn (*headings only*) · fetched 2026-10-14
- **Our delta:** specificity as the fourth tiebreak, shown as one ladder.

### T02-02 · `@layer` — Master · ✅ written `docs/css/pages/phase-2-cascade/02-layer/01-declaring-and-ordering.md`
- **Read this:** [Cascade layers are coming to your browser](https://developer.chrome.com/blog/cascade-layers) · Chrome for Developers · unlayered beats layered, `!important` reverses layer order (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [@layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) · MDN reference (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Hello, CSS Cascade Layers](https://ishadeed.com/article/cascade-layers/) · Ahmad Shadeed, 2022-02-11 · layers beside specificity and order, with theming and third-party CSS cases; its `!important` coverage stops at the basic reversal · fetched 2026-10-14 (*read*)
- **Our delta:** the layered `!important` inversion worked through.

### T02-03 · Specificity, counted properly — Master · ✅ written `docs/css/pages/phase-2-cascade/03-specificity-counted-properly.md`
- **Read this:** [Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Specificity) · MDN · the counting rules and worked examples (*headings only*) · covers our angle: **full** — fetched 2026-10-14
- **Beyond the docs:** [CSS Selector Specificity Calculator](https://polypane.app/css-specificity-calculator/) · Polypane · calculator with notes: `:is()` and `:not()` take their highest argument, `:where()` is zero; it does not mention `:has()` · fetched 2026-10-14 (*read*)
- **Our delta:** `:has()` explicitly in the table.

### T02-04 · The shorthand reset trap — Master · ✅ written `docs/css/pages/phase-2-cascade/04-the-shorthand-reset-trap.md`
- **Read this:** [Shorthand properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Shorthand_properties) · MDN · omitted longhands reset to initial values (*headings only*) · covers our angle: **partial** — fetched 2026-10-14
- **Beyond the docs:** [CSS shorthand properties](https://blog.openreplay.com/css-shorthand-properties/) · OpenReplay · `background: red` wipes the image, position and size (*headings only*) · fetched 2026-10-14
- **Our delta:** the `border` to `currentcolor` case.
