---
title: "Part 1 — How CSS works"
sidebar_label: "1 · How CSS works"
sidebar_position: 1
---

> **Phases 0–3 · 56 topics · 23 Master**
> What the browser does with a stylesheet, how a rule finds an element, how
> conflicts are resolved, and what a value actually is.

This is the part that decides whether CSS feels arbitrary or predictable.
Almost every "CSS is weird" moment is one of four things: a rule that silently
failed to parse, a selector that matched something you did not expect, a
cascade you lost, or a value that resolved against a different box than you
assumed. Nothing here is about layout yet.

---

## Phase 0 — How CSS runs

*12 topics.* Before any syntax: what the engine does with your file, what it
does with your mistakes, and how you decide whether a 2026 feature is safe to
ship. The error-recovery row is the one that stops CSS feeling haunted.

| Topic | Tier |
|---|---|
| **The rendering pipeline** — parse → CSSOM → style resolution → layout → paint → composite; which stage each property costs you, and why that ordering explains nearly every performance rule later | <span className="db-tier t-master">Master</span> |
| **CSS fails silently, by design** — an unknown property or invalid value is dropped and *nothing is reported*; an invalid selector kills its whole rule; there is no `try`/`catch` and no console error for a typo | <span className="db-tier t-master">Master</span> |
| **Deciding whether a feature is safe** — Baseline (Newly / Widely available / Limited), `web-features` and caniuse as the data behind the claim, and why "I think it's supported" is not an engineering answer | <span className="db-tier t-master">Master</span> |
| **DevTools for CSS** — the Styles pane's strike-throughs, Computed, the layout overlays for grid and flex, `:hov` state forcing, and the Changes panel | <span className="db-tier t-master">Master</span> |
| **What CSS is** — a declarative constraint language the engine *resolves*; you describe the result, the engine decides the pixels, and it never runs top to bottom like a program | <span className="db-tier t-understand">Understand</span> |
| **How stylesheets reach the page** — `<link>`, `<style>`, the inline `style` attribute, and why `@import` inside CSS costs an extra round trip in series | <span className="db-tier t-understand">Understand</span> |
| **Render-blocking CSS** — why the browser will not paint until the stylesheet arrives, what the `media` attribute changes, and where `preload` helps | <span className="db-tier t-understand">Understand</span> |
| **`@supports` feature queries** — testing a declaration, testing a selector with `selector()`, negation, and the shape of a progressive-enhancement block | <span className="db-tier t-understand">Understand</span> |
| **User-agent stylesheets** — where a heading's margin and a button's border actually come from, and how to inspect them instead of guessing | <span className="db-tier t-understand">Understand</span> |
| **Resets and normalisers** — what a modern reset contains, what each line buys you, and the argument for a small hand-written one over a dependency | <span className="db-tier t-understand">Understand</span> |
| **The at-rule map** — `@media`, `@supports`, `@container`, `@layer`, `@scope`, `@property`, `@font-face`, `@keyframes`, `@page`; one line each, each explained properly in its own phase | <span className="db-tier t-understand">Understand</span> |
| Vendor prefixes in 2026 — mostly historical, what autoprefixer still does, and the handful (`-webkit-line-clamp`, `-webkit-backdrop-filter`) still worth writing | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take a rule that "isn't working", and say in
order whether it parsed, whether it matched, and whether it lost the cascade —
without editing it randomly to find out.

---

## Phase 1 — Selectors

*16 topics.* How a rule finds its elements. Dense on Master because selection is
half of what you write, and because `:has()` and `:is()` changed what is
expressible — patterns that needed a JavaScript class-toggle in 2020 are one
selector now.

| Topic | Tier |
|---|---|
| **The selector families** — type, class, id, universal, attribute; what each is *for* in a codebase, not just what it matches | <span className="db-tier t-master">Master</span> |
| **Combinators** — descendant (space), child `>`, next sibling `+`, subsequent sibling `~`, and how far each reaches | <span className="db-tier t-master">Master</span> |
| **`:is()` and `:where()`** — grouping without repetition, and the specificity difference: `:where()` contributes **zero**, which is what makes it the tool for defaults you intend to be overridden | <span className="db-tier t-master">Master</span> |
| **`:has()`** — the parent selector, Baseline since 2023-12-19; styling a card because of what is inside it, a form row because its input is invalid, a page because a dialog is open | <span className="db-tier t-master">Master</span> |
| **Pseudo-elements** — `::before`/`::after` and the `content` requirement that trips everyone; `::marker`, `::selection`, `::placeholder`, `::first-line`, `::backdrop`, and the fact that they are not in the DOM | <span className="db-tier t-master">Master</span> |
| **CSS Nesting** — native `&`, when `&` is required, how a nested rule desugars, and the specificity it quietly accumulates | <span className="db-tier t-master">Master</span> |
| **State pseudo-classes** — `:hover`, `:active`, `:focus`, **`:focus-visible`**, `:focus-within`, `:target`, `:disabled`; the four you must style on every interactive element | <span className="db-tier t-understand">Understand</span> |
| **Structural pseudo-classes** — `:nth-child(An+B)`, the `of S` form, `:nth-of-type`, `:first-child`/`:last-child`/`:only-child`, and why `:nth-child` counts siblings rather than matches | <span className="db-tier t-understand">Understand</span> |
| **Attribute selectors in full** — `[a]`, `[a=v]`, `[a~=v]`, `[a\|=v]`, `[a^=v]`, `[a$=v]`, `[a*=v]`, and the case-insensitivity flag `i` | <span className="db-tier t-understand">Understand</span> |
| **Selector lists, forgiving and not** — a single invalid selector in a plain comma list discards the entire rule; `:is()` and `:where()` forgive theirs. This is a real production failure mode | <span className="db-tier t-understand">Understand</span> |
| **Form-state pseudo-classes** — `:checked`, `:required`, `:valid`/`:invalid`, **`:user-valid`/`:user-invalid`**, `:placeholder-shown`, `:indeterminate`, `:default` | <span className="db-tier t-understand">Understand</span> |
| **`:not()`, `:empty`, `:root`, `:lang()`, `:dir()`** — the remaining functional and logical pseudo-classes, including `:not()`'s specificity rule | <span className="db-tier t-understand">Understand</span> |
| **Styling hooks that are not classes** — `data-*` attributes for state, and keeping the selectors your tests depend on separate from the ones your design depends on | <span className="db-tier t-understand">Understand</span> |
| **`@scope`** — scoped styles with a lower bound ("donut scoping"), Baseline since 2025-12-12, and where it beats a wrapper class | <span className="db-tier t-know">Know</span> |
| Selector performance — what is actually expensive (huge `:has()` invalidation sets, universal selectors in deep trees), and why selector micro-optimisation is almost never the bottleneck you have | <span className="db-tier t-know">Know</span> |
| Shadow DOM selectors — `:host`, `:host-context()`, `::slotted()`, `::part()`, and why the cascade stops at the shadow boundary | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can style a form row's label based on its input's
validity, with no JavaScript and no extra markup — and say what the resulting
specificity is.

---

## Phase 2 — The cascade, specificity and inheritance

*13 topics.* The conflict-resolution algorithm. This is the phase that separates
people who reach for `!important` from people who know why they lost.

| Topic | Tier |
|---|---|
| **What the cascade actually compares, in order** — origin and importance, then layer, then specificity, then source order. Specificity is the *fourth* tiebreak, not the first, and that ordering is why `@layer` works | <span className="db-tier t-master">Master</span> |
| **Specificity, counted properly** — the (id, class, type) triple; `:where()` scores zero; `:is()`, `:not()` and `:has()` take the specificity of their most specific argument; inline styles and why they sit outside the triple | <span className="db-tier t-master">Master</span> |
| **Inheritance** — which properties inherit and which do not, why that split is not arbitrary, and how it interacts with the universal selector | <span className="db-tier t-master">Master</span> |
| **`@layer`** — declaring precedence up front instead of fighting for it; that **unlayered styles win over layered ones**, nested layers, and importing a third-party stylesheet into a low layer | <span className="db-tier t-master">Master</span> |
| **The shorthand reset trap** — `background: red` wiping `background-image`, `font` resetting `line-height`, `flex` setting three properties, `all: unset`; every shorthand writes *all* its longhands | <span className="db-tier t-master">Master</span> |
| **The four global keywords** — `inherit`, `initial`, `unset`, `revert`, plus `revert-layer`; what each one reverts *to*, which is a different question for each | <span className="db-tier t-understand">Understand</span> |
| **`!important`** — what it really does (moves the declaration to a different origin bucket, inverting author vs user order), why it beats layers, and the two legitimate uses | <span className="db-tier t-understand">Understand</span> |
| **Origins** — user-agent, user and author stylesheets, their normal order, and how `!important` inverts it so a user's accessibility override wins | <span className="db-tier t-understand">Understand</span> |
| **Computed, used and actual values** — the value stages a declaration passes through, why `getComputedStyle` gives you `16px` for `1em`, and which stage a percentage is resolved at | <span className="db-tier t-understand">Understand</span> |
| **Custom properties in the cascade** — they are inherited *values* resolved at computed-value time, which is why a variable can change per subtree but cannot be used in a media query condition | <span className="db-tier t-understand">Understand</span> |
| **Debugging a cascade conflict** — the repeatable procedure: is it in the DOM, did it parse, did it match, which rule won, and which of the five criteria decided it | <span className="db-tier t-understand">Understand</span> |
| Source order and the last-wins rule — including what "last" means across multiple files, and why bundler order is a styling decision | <span className="db-tier t-understand">Understand</span> |
| Transitions and animations in the cascade — why an animated value overrides normal declarations, and where `!important` still wins | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain, for a specific losing declaration,
*which* of the cascade's criteria you lost on — and fix it without raising
specificity or adding `!important`.

---

## Phase 3 — Values, units and custom properties

*15 topics.* Every number you will type. The recurring theme is that a value is
meaningless until you know what it resolves *against* — and that most
unit confusion is really containing-block confusion.

| Topic | Tier |
|---|---|
| **Font-relative units** — `rem` vs `em` and the compounding trap, plus `ch`, `ex`, `cap`, `lh`; the default `1rem = 16px` and why hard-coding `16px` breaks user zoom | <span className="db-tier t-master">Master</span> |
| **Percentages resolve against something specific** — and it differs per property: `width` against the containing block's width, `padding` and `margin` (including vertical ones) against its **width**, `height` against a height that must be definite. This is why `height: 100%` so often does nothing | <span className="db-tier t-master">Master</span> |
| **`calc()`** — mixing units, the mandatory whitespace around `+` and `-`, division by a unitless number, and nesting inside other functions | <span className="db-tier t-master">Master</span> |
| **`min()`, `max()` and `clamp()`** — fluid sizing with no media query; reading `clamp(min, preferred, max)` correctly, and the `vw`-based preferred value that must always have a `rem` term for zoom safety | <span className="db-tier t-master">Master</span> |
| **Custom properties** — `--x` and `var(--x, fallback)`; they are **inherited runtime values, not compile-time constants**, which is the whole reason theming works | <span className="db-tier t-master">Master</span> |
| **Absolute vs relative lengths** — `px` and the CSS reference pixel, why `px` is right for borders and hairlines and wrong for type, and the rest (`pt`, `cm`, `in`) which exist for print | <span className="db-tier t-understand">Understand</span> |
| **Viewport units** — `vw`, `vh`, `vmin`, `vmax`, the scrollbar-inclusion gotcha in `vw`, and `svh`/`lvh`/`dvh` for the mobile URL bar that resizes under your layout | <span className="db-tier t-understand">Understand</span> |
| **`@property`** — typed custom properties with `syntax`, `inherits` and `initial-value`; the type is what makes a custom property *animatable* and what makes a bad value fail early | <span className="db-tier t-understand">Understand</span> |
| **The invalid-at-computed-value-time rule** — a malformed `var()` does not fall back to the previous declaration; the property becomes `unset`, which is why one bad token can turn text transparent | <span className="db-tier t-understand">Understand</span> |
| **Custom properties vs preprocessor variables** — runtime vs build time; what Sass variables can do that custom properties cannot (be used in a media query condition) and vice versa (change per element, per theme, from JavaScript) | <span className="db-tier t-understand">Understand</span> |
| **Numbers, ratios and `aspect-ratio`** — unitless values, where a ratio is accepted, and reserving space before an image loads | <span className="db-tier t-understand">Understand</span> |
| **Property-specific keywords** — `auto`, `none`, `normal` and `0` mean different things per property; `auto` on `width`, `margin`, `height`, `flex-basis` and `grid-auto-flow` are five unrelated behaviours | <span className="db-tier t-understand">Understand</span> |
| Angles, times and easing values — `deg`/`turn`/`rad`, `s`/`ms`, and where each is required rather than optional | <span className="db-tier t-know">Know</span> |
| `env()` and `attr()` — safe-area insets on notched devices, and `attr()`'s typed form beyond `content` | <span className="db-tier t-know">Know</span> |
| Conditional values with `if()` — what it replaces, and why it is not load-bearing in anything shipped today | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can build a type and spacing scale from custom
properties and `clamp()` that stays readable at 200 % browser zoom, and explain
what every percentage in your stylesheet is a percentage *of*.

---

## Where this connects

- **Phase 0 → Phase 14** — the pipeline stages named here become the
  performance rules there; "this triggers layout" is only meaningful once you
  know what layout is.
- **Phase 1 → Phase 12** — the state and form pseudo-classes are the whole
  mechanism behind styling native UI without JavaScript.
- **Phase 2 → Phase 13** — `@layer` is a cascade feature here and an
  architecture decision there; the second only makes sense after the first.
- **Phase 3 → Phase 8** — `clamp()` and container units are how a layout adapts
  without a single media query.
- **Phase 3 → Phase 10** — custom properties plus `@property` are what make a
  design-token system animatable rather than just organised.
- **Deliberately not here:** anything about boxes, sizing or placement. A
  selector matching and a declaration winning are separate questions from where
  the element ends up, and mixing them is why the box model feels confusing.

---

← [Overview](../README.md) · Next: [Part 2 — Layout](./02-layout.md) →
