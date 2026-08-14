---
title: "The at-rule map"
sidebar_label: "08 · The at-rule map"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex07-at-rules-and-prefixes.mjs`.

**At-rules are the parts of CSS that are not "selector, then declarations".**
There are about a dozen worth knowing, each explained properly in its own phase.
This page is the map, so nothing is a surprise when you meet it.

## The map

| At-rule | What it does | Where it is covered |
|---|---|---|
| `@media` | apply rules when the *viewport or device* matches | **Phase 8** |
| `@container` | apply rules when the *containing element* matches | **Phase 8** |
| `@supports` | apply rules only if the browser understands a feature | [page 09](./09-supports-feature-queries.md) |
| `@layer` | declare cascade precedence up front | **Phase 2** |
| `@scope` | limit rules to a subtree, with an optional lower bound | [Phase 1](../phase-1-selectors/) |
| `@property` | register a typed custom property | **Phase 3** |
| `@font-face` | define a font and where to fetch it | **Phase 9** |
| `@keyframes` | name a sequence of animation states | **Phase 9** |
| `@starting-style` | the value to animate *from* when an element appears | **Phase 9** |
| `@page` | margins and breaks for print | **Phase 14** |
| `@counter-style` | define custom list markers | **Phase 9** |
| `@import` | pull in another stylesheet — **avoid** | [page 03](./03-how-stylesheets-reach-the-page.md) |
| `@charset`, `@namespace` | legacy; you will not write them | — |

## They are dropped like anything else

An at-rule the engine does not recognise is discarded exactly as an unknown
property is — silently, with the whole block. So the CSSOM rule list is a direct
read-out of what this engine understands:

```console
$ node ex07-at-rules-and-prefixes.mjs
engine: Firefox/153.0

=== Which at-rules survived parsing ===
  @media (min-width: 1px)        kept    CSSMediaRule
  @supports (color: red)         kept    CSSSupportsRule
  @layer base                    kept    CSSLayerBlockRule
  @container (min-width: 1px)    kept    CSSContainerRule
  @scope (.a) to (.b)            kept    CSSScopeRule
  @property --p                  kept    CSSPropertyRule
  @font-face                     kept    CSSFontFaceRule
  @keyframes k                   kept    CSSKeyframesRule
  @page                          kept    CSSPageRule
  @starting-style                kept    CSSStartingStyleRule
  @counter-style c               kept    CSSCounterStyleRule
  @nonsense foo                  DROPPED
```

All eleven real at-rules parse in Firefox 153, including the recent ones —
`@scope`, `@property`, `@starting-style`, `@container`. `@nonsense` is gone, with
no message.

**The consequence is a trap:** an at-rule an older browser does not support takes
its entire block with it. Rules inside `@container` simply do not exist for an
engine without container query support — so what is inside must be an
*enhancement*, never the base styling.

## Two shapes

**Block at-rules** wrap other rules, and can nest:

```css
@layer components {
  @media (min-width: 40rem) {
    @supports (container-type: inline-size) {
      .card { container-type: inline-size; }
    }
  }
}
```

**Statement at-rules** end at a semicolon:

```css
@import url("other.css");
@layer reset, base, components;   /* declares order, opens no block */
@charset "utf-8";
```

Note `@layer` appears in both forms — `@layer a, b, c;` declares the order,
`@layer a { … }` puts rules into a layer. Declaring the order first, in one
statement at the top of the entry file, is the whole technique
(**Phase 13**).

## Order rules that actually matter

- **`@import` must come first**, before any rule other than `@charset` and
  `@layer`. An `@import` after a style rule is invalid and dropped.
- **`@layer`'s first mention sets the order.** Once `@layer reset, base;` has run,
  a later `@layer reset { … }` goes into the existing layer rather than creating
  a new one at the end.
- **`@keyframes` and `@font-face` are order-independent** in effect, but a later
  `@keyframes` with the same name replaces the earlier one entirely.

## Gotchas

**Symptom:** an entire block of rules has no effect in one browser and works in
another.
**Cause:** that browser does not support the at-rule, so it dropped the whole
block — not just the unsupported part.
**Fix:** never put base styling inside a recent at-rule. Put the base outside,
and the enhancement inside.

**Symptom:** `@import` at the top of a stylesheet does nothing.
**Cause:** something precedes it — a comment is fine, a style rule is not.
`@import` after any style rule is invalid.
**Fix:** move it to the top, or better, stop using `@import`
([page 03](./03-how-stylesheets-reach-the-page.md)).

**Symptom:** an animation stopped working after a refactor that moved the
`@keyframes` block.
**Cause:** two `@keyframes` blocks share a name; the last one wins entirely, and
does not merge.
**Fix:** search for duplicate keyframe names — a common result of merging two
stylesheets.

**Symptom:** `@layer` order is not what you declared.
**Cause:** a layer was mentioned somewhere earlier than your declaration —
first mention wins.
**Fix:** put the `@layer a, b, c;` statement at the very top of the entry file,
before any import or rule that could name a layer.

## Interview questions

**★ What happens to an `@supports`/`@container` block in a browser that does not
support the at-rule?**
The entire block is discarded, including all the rules inside it — not just the
unsupported feature. That is precisely why these at-rules are safe for
progressive enhancement: an old browser gets the base styles outside the block
and none of the enhancement inside it. It is also why base styles must never
live inside one.

**★ What is the difference between `@media` and `@container`?**
`@media` tests the viewport or device; `@container` tests the size or style of
an ancestor that has been declared a container. A component inside
`@container` responds to the space *it* has, so the same component works in a
sidebar and in a full-width row without knowing which it is in.

**Which at-rule declares cascade order, and how does it interact with
specificity?**
`@layer`. Layer order is compared *before* specificity, so a rule in a later
layer beats a more specific rule in an earlier one. Unlayered styles beat all
layered ones.

**Why must `@import` come first in a stylesheet?**
The specification requires it to precede all style rules (only `@charset` and
`@layer` may come before). An `@import` after a style rule is invalid and
dropped, silently.

**What happens if two `@keyframes` blocks share a name?**
The later one replaces the earlier one entirely — they do not merge, so
partially-defined duplicates silently lose their earlier steps.

---

← [07 · Resets and normalisers](./07-resets-and-normalisers.md) · Next: [09 · @supports feature queries](./09-supports-feature-queries.md) →
