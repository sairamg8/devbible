---
title: "Link map · CSS · Part 4 (phase 10)"
sidebar_label: "04 · scss"
sidebar_position: 4
---

# Link map · CSS · Part 4 (phase 10)

Covers every topic row of phase 10 in `docs/css/syllabus/04-at-scale.md`: SCSS setup, nesting, variables, modules, mixins, loops and maps, functions, and control flow with `@extend` (T10-01 to T10-08). That is 8 rows, and every one has a written page of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, opening or headings checked. Official links are the Sass documentation at sass-lang.com, which showed Dart Sass 1.105.1 as current on 2026-10-14. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Several third-party picks predate the module system (2014 to 2018) and use `@import` or global functions; each such block says so.

---

## Phase 10 — SCSS, practically

### T10-01 · Setting SCSS up and compiling it — Sass · ✅ written `docs/css/pages/phase-10-scss/01-setting-up-and-compiling.md`
- **Read this:** [Dart Sass command-line interface](https://sass-lang.com/documentation/cli/dart-sass/) · Sass docs · `--watch` recompiles on changes to a file or its dependencies, source maps are on by default (`--no-source-map` disables), `--load-path` adds lookup directories (*read*) · covers our angle: **full** — CLI, watching and maps; bundler setup is not there · fetched 2026-10-14
- **Also good:** [Install Sass](https://sass-lang.com/install/) · Sass docs · npm, Homebrew, Chocolatey and standalone downloads (*read*) · fetched 2026-10-14
- **Also good:** [Syntax](https://sass-lang.com/documentation/syntax/) · Sass docs · SCSS (`.scss`, braces) vs the indented syntax (`.sass`); does not cover partials (*read*) · fetched 2026-10-14
- **Our delta:** the `_name.scss` partial convention and bundler wiring.

### T10-02 · Nesting and `&` — Master · ✅ written `docs/css/pages/phase-10-scss/02-nesting-and-ampersand.md`
- **Read this:** [The parent selector](https://sass-lang.com/documentation/style-rules/parent-selector/) · Sass docs · adding suffixes with `&`, such as `&__copy` and `&--open` (*read*) · covers our angle: **full** for `&` concatenation; specificity depth is not covered · fetched 2026-10-14
- **Also good:** [Style rules](https://sass-lang.com/documentation/style-rules/) · Sass docs · nesting, selector lists and combinators (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Sass and BEM ftw](https://www.kevinpowell.co/article/sass-and-bem-ftw) · Kevin Powell, 2018-03-01 · `&` builds `.parent-child` names and BEM modifiers on a `.button`, so the block name is written once · fetched 2026-10-14 (*read*)
- **Our delta:** the nesting depth at which specificity becomes a problem.

### T10-03 · Variables — Sass vs CSS custom properties — Master · ✅ written `docs/css/pages/phase-10-scss/03-variables-sass-vs-custom-properties.md`
- **Read this:** [Variables](https://sass-lang.com/documentation/variables/) · Sass docs · `$` variables are compiled away, hold one value, and are imperative, unlike CSS variables (*read*) · covers our angle: **partial** — states the difference, not the `@media` and theming split · fetched 2026-10-14
- **Beyond the docs:** [Sass variables vs CSS custom properties](https://ltvco.com/engineering/sass-variables-css-custom-properties) · Dáger Zúñiga, LTV engineering, 2022-07-19 · Sass values vanish at compile time while custom properties stay in the browser for JavaScript; picks custom properties for a theme switch · fetched 2026-10-14 (*read*)
- **Our delta:** each one's single unique ability, and using both together.

### T10-04 · `@use` and `@forward` — Master · ✅ written `docs/css/pages/phase-10-scss/04-use-and-forward.md`
- **Read this:** [@use](https://sass-lang.com/documentation/at-rules/use/) · Sass docs · namespaces, `as`, `with` configuration, and private members starting with `-` or `_` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [@forward](https://sass-lang.com/documentation/at-rules/forward/) · Sass docs · re-exports members with prefixes, `show` and `hide`, and configuration (*read*) · fetched 2026-10-14
- **Also good:** [@import is Deprecated](https://sass-lang.com/blog/import-is-deprecated/) · Sass blog, 2024-10-17 · deprecated in Dart Sass 1.80.0, removal planned for 3.0.0, migrator available (*read*) · fetched 2026-10-14
- **Our delta:** one entry point built from many partials.

### T10-05 · Mixins — `@mixin`, `@include`, `@content` — Master · ✅ written `docs/css/pages/phase-10-scss/05-mixins.md`
- **Read this:** [@mixin and @include](https://sass-lang.com/documentation/at-rules/mixin/) · Sass docs · arguments, default values and content blocks with `@content` (*read*) · covers our angle: **partial** — no media-query mixin recipe and no mixin-vs-class output cost · fetched 2026-10-14
- **Beyond the docs:** [Sass's @content Directive Use Cases](https://thoughtbot.com/blog/sasss-content-directive) · Christian Reuter, thoughtbot, 2014-04-22, updated 2016-08-02 · `@content` for media queries, keyframes and context selectors; old, but the idea has not changed · fetched 2026-10-14 (*read*)
- **Our delta:** why a mixin duplicates output while a class does not.

### T10-06 · Loops and maps — generating CSS from data — Understand · ✅ written `docs/css/pages/phase-10-scss/06-loops-and-maps.md`
- **Read this:** [@each](https://sass-lang.com/documentation/at-rules/control/each/) · Sass docs · `@each $key, $value in $map` walks a map (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Maps](https://sass-lang.com/documentation/values/maps/) · Sass docs · `map.get()`, `map.set()`, `map.merge()`; maps are immutable (*read*) · fetched 2026-10-14
- **Also good:** [@for](https://sass-lang.com/documentation/at-rules/control/for/) · Sass docs · `to` excludes the end, `through` includes it (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Efficient Infinite Utility Helpers Using Inline CSS Custom Properties and calc()](https://css-tricks.com/?p=345467) · Andy Ford, CSS-Tricks, 2021-08-06 · an `@each` spacing map gives about 8.6 KB of CSS, and about 41.7 KB with three breakpoints; replaced by custom properties and `calc()`. This is the cost side of the generator argument · fetched 2026-10-14 (*read*)
- **Our delta:** the spacing-scale generator, with its output size noted.

### T10-07 · Sass functions — In · ✅ written `docs/css/pages/phase-10-scss/07-sass-functions.md`
- **Read this:** [@function](https://sass-lang.com/documentation/at-rules/function/) · Sass docs · `@function` with `@return`, optional, keyword and arbitrary arguments (*read*) · covers our angle: **full** for custom functions · fetched 2026-10-14
- **Also good:** [Built-in modules](https://sass-lang.com/documentation/modules/) · Sass docs · `sass:math`, `sass:string`, `sass:color`, `sass:list`, `sass:map`, `sass:selector`, `sass:meta` (*read*) · fetched 2026-10-14
- **Also good:** [sass:math](https://sass-lang.com/documentation/modules/math/) · Sass docs · `math.div` (Dart Sass 1.33.0+) returns what the deprecated `/` operator did (*read*) · fetched 2026-10-14
- **Our delta:** one runnable example per module.

### T10-08 · Control flow and `@extend` — Understand · ✅ written `docs/css/pages/phase-10-scss/08-control-flow-and-extend.md`
- **Read this:** [@extend](https://sass-lang.com/documentation/at-rules/extend/) · Sass docs · `%placeholder` selectors vanish from output while extenders stay, extends resolve after compilation, and cannot cross `@media` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [@if and @else](https://sass-lang.com/documentation/at-rules/control/if/) · Sass docs · only `false` and `null` are falsey (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Extending In Sass Without Creating A Mess](https://www.smashingmagazine.com/2015/05/extending-in-sass-without-mess/) · David Khourshid, Smashing Magazine, 2015-05-04 · extend placeholders, limit how often a selector is extended, avoid descendant combinators on both sides; written before the module system · fetched 2026-10-14 (*read*)
- **Our delta:** `@if` inside a mixin and why only placeholders are safe.
