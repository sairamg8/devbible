---
title: "Link map · CSS · Part 1 (phases 0–2)"
sidebar_label: "01 · how css resolves"
sidebar_position: 1
---

# Link map · CSS · Part 1 (phases 0–2)

Covers every topic row of phases 0, 1 and 2 in `docs/css/syllabus/01-how-css-works.md`: how CSS runs (T00-01 to T00-12), selectors (T01-01 to T01-16) and cascade control (T02-01 to T02-04). That is 32 rows, and every one has a written page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and not read for the claim (none left in this file). Third-party links carry a date only where the page shows one, and "last updated" is not a publication date. No `#anchors` are given. MDN has reorganised its CSS paths, so the MDN links below are the current final URLs. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Official means MDN, WHATWG, web.dev, and Chrome, WebKit or Mozilla documentation, blogs and source.

---

## Phase 0 — How CSS runs

### T00-01 · The rendering pipeline — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/02-the-rendering-pipeline.md`
- **Read this:** [Rendering performance](https://web.dev/articles/rendering-performance) · web.dev, Paul Lewis, last updated 2023-12-13 · the five-step pixel pipeline (JavaScript, style, layout, paint, composite); costs are ranked qualitatively, with compositing-only changes the cheapest path (*read*) · covers our angle: **partial** — no per-property lookup · fetched 2026-10-14
- **Also good:** [Stick to compositor-only properties and manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count) · web.dev, Paul Lewis, last updated 2015-03-20 · says only `transform` and `opacity` skip layout and paint; the list is dated and there is no per-property table (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Inside look at modern web browser, part 3](https://developer.chrome.com/blog/inside-browser-part3) · Mariko Kosaka, Chrome for Developers, last updated 2018-09-20 · walks style, layout, paint and compositing as one story, with compositing done without the main thread · fetched 2026-10-14 (*read*)
- **Our delta:** the stage each property invalidates, as a lookup and a measurement rather than a narrative.

### T00-02 · CSS fails silently — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/05-css-fails-silently.md`
- **Read this:** [CSS error handling](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Syntax/Error_handling) · MDN · browsers raise no alert; a bad declaration is discarded; one invalid selector drops the whole rule (except inside `:is()` and `:where()`); an unclosed block is auto-closed at the end of the stylesheet (*read*) · covers our angle: **partial** — all three shapes are there, as separate sections, not side by side and without the DevTools tell · fetched 2026-10-14
- **Also good:** [Selector list](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Selector_list) · MDN · one unsupported selector invalidates the whole rule, with the `:is()` remedy (*read*) · fetched 2026-10-14
- **Our delta:** the three failure shapes side by side, with their blast radii, and the DevTools tell for each.

### T00-03 · Baseline as a shipping decision — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/10-baseline-and-shipping.md`
- **Read this:** [Baseline](https://web.dev/baseline) · web.dev · Limited, Newly available (all core browsers), Widely available (30 months after that), and the core set of Chrome, Edge, Firefox and Safari on desktop and mobile (*read*) · covers our angle: **partial** — status definitions; `web-features` appears only as a link target, with no workflow · fetched 2026-10-14
- **Also good:** [How to query the Web Platform Dashboard for Baseline tooling](https://web.dev/articles/web-platform-dashboard-baseline) · web.dev, Jeremy Wagner, 2025-03-04 · queries the webstatus.dev API with a `web-features` id and reads `baseline.status` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Use Baseline Data](https://12daysofweb.dev/2024/how-to-use-baseline-data/) · Rachel Andrew, 12 Days of Web 2024 · adopt Widely available as the cutoff and you can use those features; Newly available is a case-by-case call; polyfill decisions are left to each team · fetched 2026-10-14 (*read*)
- **Our delta:** why one engine's `CSS.supports` is not an answer.

### T00-04 · DevTools as the missing error console — Master · ✅ written `docs/css/pages/phase-0-how-css-runs/12-devtools-for-css.md`
- **Read this:** [CSS features reference](https://developer.chrome.com/docs/devtools/css/reference) · Chrome DevTools · Styles and Computed filtering, and forcing element state with `:hov` (*read*) · covers our angle: **partial** — Chrome only; no Layout pane here, and invalid declarations are left to a separate page · fetched 2026-10-14
- **Beyond the docs:** [Hidden gems of the Chrome DevTools, part 2: CSS tools](https://dev.to/juhanakristian/hidden-gems-of-the-chrome-devtools-part-2-css-tools-g8k) · Juhana Jauhiainen, DEV Community, 2021-06-25 · short tour of the Layout tab's grid and flex overlays, forced hover, focus and visited states, and cycling colour formats · fetched 2026-10-14 (*read*)
- **Our delta:** reading DevTools as the error console CSS does not have: struck-through and flagged declarations, and the debugging order.

### T00-05 · What CSS is — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/01-what-css-is.md`
- **Read this:** [What is CSS?](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/What_is_CSS) · MDN Learn · CSS as rules applied to a DOM tree to give a render tree, with rule anatomy (*read*) · covers our angle: **partial** — conflicts and the cascade are left to later lessons; no "debug by asking which rule won" framing · fetched 2026-10-14
- **Our delta:** declarative and resolved, so you debug by the winner, not by tracing.

### T00-06 · Getting CSS to the page — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/03-how-stylesheets-reach-the-page.md`
- **Read this:** [@import](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@import) · MDN · syntax, `layer()` and `supports()` options, and the rule that it must precede other rules or be ignored (*read*) · covers our angle: **partial** — nothing on fetch cost · fetched 2026-10-14
- **Beyond the docs:** [don't use @import](https://www.stevesouders.com/blog/2009/04/09/dont-use-import/) · Steve Souders, 2009-04-09 · an `@import` inside another sheet adds a round trip and stops parallel loading in all browsers; the IE 6 to 8 ordering findings are dated · fetched 2026-10-14 (*read*)
- **Our delta:** `<link>`, `<style>`, inline and `@import` compared by when the browser discovers each, with the round trip measured.

### T00-07 · Render-blocking CSS — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/04-render-blocking-css.md`
- **Read this:** [Render-blocking CSS](https://web.dev/articles/critical-rendering-path/render-blocking-css) · web.dev, 2014-03-31 · `media` absent or `all` blocks; `print` does not; a query blocks only if it matches; every sheet still downloads (*read*) · covers our angle: **full** — the page is old, so check specifics in DevTools · fetched 2026-10-14
- **Also good:** [Defer non-critical CSS](https://web.dev/articles/defer-non-critical-css) · web.dev, Demián Renzulli, last updated 2019-02-17 · inline critical CSS, load the rest with `rel="preload"` plus an `onload` swap, and it warns this is advanced (*read*) · fetched 2026-10-14
- **Beyond the docs:** [CSS and network performance](https://csswizardry.com/2018/11/css-and-network-performance/) · Harry Roberts, CSS Wizardry, 2018-11-09 · a slow stylesheet delays first render, scripts wait on in-flight CSS, `@import` can hide files from the preload scanner (*read*) · fetched 2026-10-14
- **Our delta:** none material beyond first-contentful-paint figures measured in Firefox for print, non-matching and normal sheets.

### T00-08 · `@supports` feature queries — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/09-supports-feature-queries.md`
- **Read this:** [Using feature queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Using_feature_queries) · MDN · declaration tests, `selector()` and combining with `and` / `or` / `not` (*read*) · covers our angle: **partial** — notes that unknown CSS is ignored so a query is not required to start using a feature, but does not argue for writing the fallback first · fetched 2026-10-14
- **Also good:** [@supports](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@supports) · MDN · syntax reference, including `at-rule()`, `selector()`, `font-tech()` and `font-format()` (*read*) · fetched 2026-10-14
- **Our delta:** writing the fallback first so the query is often unnecessary, and the measured trap that parsing is not shipping.

### T00-09 · User-agent stylesheets — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/06-user-agent-stylesheets.md`
- **Read this:** [Rendering](https://html.spec.whatwg.org/multipage/rendering.html) · WHATWG HTML Standard · section 15 gives suggestions for rendering HTML, since user agents are not required to render in any particular way; the CSS user agent style sheet is in 15.2 (*read*) · covers our angle: **partial** — spec text, not how to inspect it · fetched 2026-10-14
- **Also good:** [Blink's html.css](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/html/resources/html.css) · Chromium source · the default HTML style sheet itself, such as the 8px body margin (*read*) · fetched 2026-10-14
- **Beyond the docs:** [User Agent Style Sheets: Basics and Samples](https://meiert.com/blog/user-agent-style-sheets/) · Jens Oliver Meiert, 2007-09-22, updated 2026-04-19 · what UA sheets are, a list of collected defaults for older browsers, and links to the Chromium, Gecko and WebKit sources (*read*) · fetched 2026-10-14
- **Our delta:** inspect in DevTools instead of guessing a default.

### T00-10 · Resets — Understand · ✅ written `docs/css/pages/phase-0-how-css-runs/07-resets-and-normalisers.md`
- **Read this:** [A Modern CSS Reset](https://www.joshwcomeau.com/css/custom-css-reset/) · Josh W. Comeau · ten rules, each with a stated reason; the page says it was updated 2026-06-03 (*read*) · covers our angle: **partial** — author opinion, not measured against defaults · fetched 2026-10-14
- **Also good:** [A (more) Modern CSS Reset](https://piccalil.li/blog/a-more-modern-css-reset/) · Andy Bell, Piccalilli, 2023-09-18 · box sizing, text-size adjustment, block-end margins and list styles (*read*) · fetched 2026-10-14
- **Our delta:** each line justified, with the UA default it replaces measured in places. No official source exists (a search found MDN and web.dev pages on neither resets nor normalising); both picks are third-party.

### T00-11 · The at-rule map — Rule · ✅ written `docs/css/pages/phase-0-how-css-runs/08-the-at-rule-map.md`
- **Read this:** [At-rules](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Syntax/At-rules) · MDN · what an at-rule is, and the statement and block at-rules listed (*read*) · covers our angle: **partial** — nothing on an unsupported at-rule dropping its whole block · fetched 2026-10-14
- **Our delta:** a twelve-rule map with the phase or page that covers each, and the drop-the-block failure.

### T00-12 · Vendor prefixes in 2026 — Know · ✅ written `docs/css/pages/phase-0-how-css-runs/11-vendor-prefixes.md`
- **Read this:** [Vendor Prefix](https://developer.mozilla.org/en-US/docs/Glossary/Vendor_Prefix) · MDN Glossary · what prefixes were and why they were abandoned; experimental features now sit behind flags (*read*) · covers our angle: **partial** — history, not the 2026 state · fetched 2026-10-14
- **Beyond the docs:** [It's 2026, why are vendor prefixes still in your CSS?](https://blog.omgmog.net/post/why-vendor-prefixes-are-still-in-your-css/) · Max Glenister, 2026-03-11 · says almost all remaining need is `-webkit-` for Safari, with `tab-size` the `-moz-` exception; lists `appearance`, `backdrop-filter`, `user-select` as transitional · fetched 2026-10-14 (*read*)
- **Our delta:** a Firefox 153 table of which prefixes are still real (`-webkit-line-clamp`) and which are gone (`-moz-border-radius`), and why `-webkit-` is not a Safari detector.

---

## Phase 1 — Selectors

### T01-01 · `:has()` — Master · ✅ written `docs/css/pages/phase-1-selectors/06-has.md`
- **Read this:** [:has()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has) · MDN · relative selector argument, parent and previous-sibling use, no nesting `:has()` inside `:has()` (*read*) · covers our angle: **partial** — no mention of replacing state-toggling JavaScript · fetched 2026-10-14
- **Also good:** [CSS Has Pseudo Class](https://webkit.org/blog/13096/css-has-pseudo-class/) · WebKit blog, Jen Simmons, 2022-08-18 · the engine team's examples; says a form-validation case needed JavaScript before `:has()` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Level Up Your CSS Skills With The :has() Selector](https://www.smashingmagazine.com/2023/01/level-up-css-skills-has-selector/) · Stephanie Eckles, Smashing Magazine, 2023-01-23 · previous-sibling and range selection, and a star-rating component driven by state (*read*) · fetched 2026-10-14
- **Our delta:** the JavaScript patterns it deletes.

### T01-02 · `:is()` and `:where()` — Master · ✅ written `docs/css/pages/phase-1-selectors/05-is-and-where.md`
- **Read this:** [:where()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where) · MDN · always zero specificity, forgiving selector list; contrasts `:is()` (*read*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [:is()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:is) · MDN · takes the specificity of its most specific argument (*read*) · fetched 2026-10-14
- **Beyond the docs:** [CSS is where the magic happens](https://matthiasott.com/notes/css-is-where-the-magic-happens) · Matthias Ott, 2025-10-07 · `:where()` for base styles that stay easy to override, without `!important` (*read*) · fetched 2026-10-14
- **Our delta:** `:where()` as the tool for overridable defaults, weighed against `:is()`.

### T01-03 · Nesting — Master · ✅ written `docs/css/pages/phase-1-selectors/12-nesting.md`
- **Read this:** [CSS nesting and specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Nesting/Nesting_and_specificity) · MDN · `&` takes the largest specificity in its parent list, as `:is()` does, with a worked `#a, b` case (*read*) · covers our angle: **partial** — the `&` rule, not the cumulative weight of stacked levels · fetched 2026-10-14
- **Also good:** [Nesting](https://web.dev/learn/css/nesting) · web.dev Learn CSS, last updated 2025-08-21 · the `:is()` desugaring with a worked specificity case (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The gotchas of CSS nesting](https://kilianvalkhof.com/2023/css-html/the-gotchas-of-css-nesting/) · Kilian Valkhof, 2023-06-13 · `&` is wrapped in `:is()`, so a list like `main, #intro` lifts every nested rule; a nested `@media` also lands after sibling declarations · fetched 2026-10-14 (*read*)
- **Our delta:** the weight that stacked nesting levels add unseen, plus the `&` list-maximum rule.

### T01-04 · Pseudo-elements — Master · ✅ written `docs/css/pages/phase-1-selectors/10-pseudo-elements.md`
- **Read this:** [Pseudo-elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Pseudo-elements) · MDN · the index by category, one line each (*read*) · covers our angle: **partial** — no flex or grid item behaviour here or on the `::before` page · fetched 2026-10-14
- **Also good:** [::before](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::before) · MDN · without a valid `content` the pseudo-element is not rendered (*read*) · fetched 2026-10-14
- **Beyond the docs:** [::before and ::after Pseudo-Elements in CSS](https://johnkavanagh.co.uk/articles/before-and-after-pseudo-elements-in-css/) · John Kavanagh, 2017-09-09 · icons, separators, a clearfix and hover effects (*read*) · fetched 2026-10-14
- **Our delta:** why they become flex and grid items.

### T01-05 · Combinators — Master · ✅ written `docs/css/pages/phase-1-selectors/02-combinators.md`
- **Read this:** [Combinators](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Combinators) · MDN Learn · descendant, child, next and subsequent sibling (*read*) · covers our angle: **partial** — no component-leak angle · fetched 2026-10-14
- **Also good:** [Selectors and combinators](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Selectors/Selectors_and_combinators) · MDN guide · an overview of selectors with a combinators section that also lists the column and namespace separators (*read*) · fetched 2026-10-14
- **Our delta:** how one space leaks a rule into nested components.

### T01-06 · Selector families — Master · ✅ written `docs/css/pages/phase-1-selectors/01-the-selector-families.md`
- **Read this:** [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors) · MDN · the selector index in eleven categories (*read*) · covers our angle: **partial** — an index, no coupling analysis · fetched 2026-10-14
- **Beyond the docs:** [Keep your CSS selectors short](https://csswizardry.com/2012/05/keep-your-css-selectors-short/) · Harry Roberts, 2012-05-15 · a long descendant selector ties a component to its container; a standalone class can move anywhere · fetched 2026-10-14 (*read*)
- **Our delta:** the coupling each family creates.

### T01-07 · Selector lists, forgiving and not — Understand · ✅ written `docs/css/pages/phase-1-selectors/04-selector-lists.md`
- **Read this:** [Selector list](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Selector_list) · MDN · strict versus forgiving lists, with the `:is()` fix (*read*) · covers our angle: **full** — fetched 2026-10-14
- **Beyond the docs:** [Day 35: forgiving selectors](https://matuzo.at/blog/2022/100daysof-day35) · Manuel Matuzović, 2022-11-11 · a worked demo: an invalid selector kills the whole list but `:where()` ignores it · fetched 2026-10-14 (*read*)
- **Our delta:** the six-component blast radius.

### T01-08 · Attribute selectors in full — Understand · ✅ written `docs/css/pages/phase-1-selectors/03-attribute-selectors.md`
- **Read this:** [Attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Attribute_selectors) · MDN · all seven operators and the `i` and `s` flags (*read*) · covers our angle: **partial** — no `*=` on `class` warning; its class example uses `~=` · fetched 2026-10-14
- **Beyond the docs:** [Case Insensitive CSS Attribute Selector](https://davidwalsh.name/css-attribute-case) · David Walsh, 2024-06-19 · the `i` flag, with advice to use it sparingly (*read*) · fetched 2026-10-14
- **Our delta:** why `*=` on `class` is usually a bug.

### T01-09 · Structural pseudo-classes — Understand · ✅ written `docs/css/pages/phase-1-selectors/07-structural-pseudo-classes.md`
- **Read this:** [:nth-child()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:nth-child) · MDN · An+B syntax and `of S`, including a striped table that skips `[hidden]` rows (*read*) · covers our angle: **full** for `of S` striping · fetched 2026-10-14
- **Also good:** [More control over :nth-child() selections with the of S syntax](https://developer.chrome.com/docs/css-ui/css-nth-child-of-s) · Chrome for Developers, Bramus, last updated 2023-02-09 · `:nth-child(2 of .highlight)` against `.highlight:nth-child(2)`, and why plain `even` striping breaks when rows are hidden (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Guide to Advanced CSS Selectors - Part Two](https://moderncss.dev/guide-to-advanced-css-selectors-part-two/) · Stephanie Eckles, Modern CSS, 2020-12-30 · the `nth-`, `first-`, `last-` and `only-` families with examples (*read*) · fetched 2026-10-14
- **Our delta:** the position-not-appearance trap set next to the `of S` fix.

### T01-10 · State pseudo-classes — Understand · ✅ written `docs/css/pages/phase-1-selectors/08-state-pseudo-classes.md`
- **Read this:** [:focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus-visible) · MDN · it matches `:focus` when the browser's heuristics say focus should be shown (*read*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [Privacy and the :visited selector](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Selectors/Privacy_and_:visited) · MDN · the colour-only allow-list, no alpha differences, and `getComputedStyle` always reporting unvisited (*read*) · fetched 2026-10-14; [Privacy-related changes coming to CSS :visited](https://hacks.mozilla.org/2010/03/privacy-related-changes-coming-to-css-vistited/) · Mozilla Hacks, 2010-03-31 · the history-sniffing reason, with a test of 210,000 URLs per minute (*read*) · fetched 2026-10-14; [:focus-within](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus-within) · MDN (*read*)
- **Our delta:** why `:visited` is deliberately crippled, in one short list. No third-party piece beyond the vendor post turned up.

### T01-11 · Form-state pseudo-classes — Understand · ✅ written `docs/css/pages/phase-1-selectors/09-form-state-pseudo-classes.md`
- **Read this:** [:user-invalid](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:user-invalid) · MDN · matches only after the user has interacted (*read*) · covers our angle: **partial** — fetched 2026-10-14
- **Beyond the docs:** [CSS :valid / :invalid vs :user-valid / :user-invalid](https://pawelgrzybek.com/css-valid-invalid-vs-user-valid-user-invalid-pseudo-classes/) · Pawel Grzybek, 2023-08-23 · `:invalid` applies at once, which confuses users; the `:user-` pair waits for interaction, shown in a CodePen demo (*read*) · fetched 2026-10-14
- **Our delta:** script-free validation styling.

### T01-12 · `:not()`, `:empty`, `:root`, `:lang()`, `:dir()` — Understand · ✅ written `docs/css/pages/phase-1-selectors/11-not-empty-root.md`
- **Read this:** [:not()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:not) · MDN · takes the specificity of its most specific argument; one invalid selector invalidates the rule, with the `:is()` workaround (*read*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [:empty](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:empty) · MDN · whitespace counts as content; [:dir()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:dir) · MDN · matches the document's semantic direction, including inherited, not the CSS `direction` property (*read*) · fetched 2026-10-14
- **Beyond the docs:** [On :not and Specificity](https://bitsofco.de/on-not-and-specificity/) · Ire Aderinokun, bitsofcode, 2016-03-15 · why `p:not(#foo)` quietly gains ID weight and beats a later class rule (*read*) · fetched 2026-10-14
- **Our delta:** one page for all five, with the `:not()` specificity trap as its own section.

### T01-13 · Styling hooks — Understand · ✅ written `docs/css/pages/phase-1-selectors/13-styling-hooks.md`
- **Read this:** [Using data attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/Use_data_attributes) · MDN · the `data-*` mechanism, `dataset`, and a `data-variant` styling example (*read*) · covers our angle: **partial** — no class versus state versus test-id split · fetched 2026-10-14
- **Beyond the docs:** [The wasted potential of CSS attribute selectors](https://elisehe.in/2022/10/16/attribute-selectors) · Elise Hein, 2022-10-16 · prefers native and ARIA attributes for state, keeps classes as a fallback, and is cautious about custom `data-*`; names the trade-offs of each · fetched 2026-10-14 (*read*)
- **Our delta:** never crossing style, state and test hooks.

### T01-14 · `@scope` — Know · ✅ written `docs/css/pages/phase-1-selectors/14-scope.md`
- **Read this:** [Limit the reach of your selectors with the CSS @scope at-rule](https://developer.chrome.com/docs/css-ui/at-scope) · Chrome for Developers, Bramus, 2023-10-04 · donut scope, and scoping proximity placed after specificity and before source order (*read*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [@scope](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope) · MDN · syntax, proximity, and a Baseline 2026 Newly available label (since March 2026) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Native CSS @scope](https://blog.openreplay.com/native-css-scope/) · OpenReplay Team, 2026-09-22 · donut scopes, proximity, and why inherited properties still cross a scope limit (*read*) · fetched 2026-10-14
- **Our delta:** the proximity tiebreak as the only one that looks at the DOM.

### T01-15 · Selector performance — Know · ✅ written `docs/css/pages/phase-1-selectors/15-selector-performance.md`
- **Read this:** [Reduce the scope and complexity of style calculations](https://web.dev/articles/reduce-the-scope-and-complexity-of-style-calculations) · web.dev, Jeremy Wagner and Paul Lewis, last updated 2015-03-20 · style cost scales with elements times selectors, and element count often matters more than selector complexity; one DevTools example of about 900 elements and 25 ms (*read*) · covers our angle: **partial** — dated, one illustration · fetched 2026-10-14
- **Beyond the docs:** [CSS Selector Performance has changed! (For the better)](https://calendar.perfplanet.com/2011/css-selector-performance-has-changed-for-the-better/) · Nicole Sullivan, Web Performance Calendar, 2011-12-29 · rule hashes, ancestor filters and style sharing made old advice obsolete; adjacent combinators can still be slow · fetched 2026-10-14 (*read*)
- **Our delta:** a current measurement, since the best source is from 2011.

### T01-16 · Shadow DOM selectors — Know · ✅ written `docs/css/pages/phase-1-selectors/16-shadow-dom-selectors.md`
- **Read this:** [:host](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:host) · MDN · styling the host from inside; `:host()` and `:host-context()` are only linked from See also (*read*) · covers our angle: **partial** — fetched 2026-10-14
- **Also good:** [::part()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::part) · MDN · styles shadow-tree elements that carry a matching `part` attribute; [::slotted()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::slotted) · MDN · selects elements placed in a slot, from inside the shadow DOM only (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Style Web Components and Shadow DOM with CSS](https://blog.openreplay.com/style-web-components-shadow-dom-css/) · OpenReplay Team, 2026-05-14 · hosts, slots, and custom properties plus `::part()` as a public styling API (*read*) · fetched 2026-10-14
- **Our delta:** designing the styling API isolation forces.

---

## Phase 2 — Cascade control

### T02-01 · What the cascade compares, in order — Master · ✅ written `docs/css/pages/phase-2-cascade/01-what-the-cascade-compares.md`
- **Read this:** [Introduction to the CSS cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Introduction) · MDN · relevance, origin and importance, specificity, scoping proximity, then order of appearance; layers are handled inside the origin step (*read*) · covers our angle: **partial** — its short list folds layers into origin; the full order comes later on the page · fetched 2026-10-14
- **Also good:** [Cascade layers](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Cascade_layers) · MDN Learn · the cascade steps, layer creation, and the inverted order for important styles (*read*) · fetched 2026-10-14
- **Our delta:** the six-step ladder on one page (origin and importance, context, element-attached, layers, specificity, order), with specificity fifth, not fourth.

### T02-02 · `@layer` — Master · ✅ written `docs/css/pages/phase-2-cascade/02-layer/01-declaring-and-ordering.md`
- **Read this:** [Cascade layers are coming to your browser](https://developer.chrome.com/blog/cascade-layers) · Chrome for Developers, Una Kravets, last updated 2022-02-01 · unlayered beats layered, and `!important` reverses layer order (*read*) · covers our angle: **full** — fetched 2026-10-14
- **Also good:** [@layer](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@layer) · MDN reference · statement form, re-declaring a name keeps its order, unlayered wins, important inverts (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Hello, CSS Cascade Layers](https://ishadeed.com/article/cascade-layers/) · Ahmad Shadeed, 2022-02-11 · layers beside specificity and order, with theming and third-party CSS cases; it does not cover the `!important` reversal inside layers (*read*) · fetched 2026-10-14
- **Our delta:** the layered `!important` inversion worked through, in the second chunk `02-layer/02-precedence-and-important.md`.

### T02-03 · Specificity, counted properly — Master · ✅ written `docs/css/pages/phase-2-cascade/03-specificity-counted-properly.md`
- **Read this:** [Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity) · MDN · the three-column counting rules, plus how `:is()`, `:has()`, `:not()` and `:where()` count, with worked examples (*read*) · covers our angle: **full** — fetched 2026-10-14
- **Beyond the docs:** [CSS Selector Specificity Calculator](https://polypane.app/css-specificity-calculator/) · Polypane, no author or date on the page · calculator with notes: `:is()` and `:not()` take their highest argument, `:where()` is zero; it does not mention `:has()` (*read*) · fetched 2026-10-14
- **Our delta:** the functional pseudo-classes and nesting `&` counted in one place.

### T02-04 · The shorthand reset trap — Master · ✅ written `docs/css/pages/phase-2-cascade/04-the-shorthand-reset-trap.md`
- **Read this:** [Shorthand properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Shorthand_properties) · MDN · omitted longhands are set to the shorthand's default, which may differ from the property's initial value, and so override earlier values (*read*) · covers our angle: **partial** — the `border` and `currentcolor` case is not on the page · fetched 2026-10-14
- **Beyond the docs:** [CSS shorthand properties](https://blog.openreplay.com/css-shorthand-properties/) · OpenReplay Team, 2026-08-11 · `background: red` resets the image, position and size (*read*) · fetched 2026-10-14
- **Our delta:** the `border` to `currentcolor` case.
