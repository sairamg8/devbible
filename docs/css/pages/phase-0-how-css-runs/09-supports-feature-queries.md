---
title: "@supports feature queries"
sidebar_label: "09 · @supports"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex03-baseline-data.mjs`
> and `ex07-at-rules-and-prefixes.mjs`.

**`@supports` asks the engine a question and styles accordingly.** It is the
only way to write CSS that uses a new feature *and* behaves correctly where the
feature is missing — without user-agent sniffing and without JavaScript.

## The shapes

```css
/* a declaration — does this property accept this value? */
@supports (container-type: inline-size) {
  .card { container-type: inline-size; }
}

/* negation — the fallback branch */
@supports not (container-type: inline-size) {
  .card { /* viewport-based fallback */ }
}

/* a selector — note the selector() wrapper */
@supports selector(:has(a)) {
  .row:has(input:checked) { background: var(--accent-soft); }
}

/* combinations */
@supports (display: grid) and (gap: 1rem) { … }
@supports (a: b) or (c: d) { … }
```

Two things people get wrong immediately:

- **The parentheses are required** around each condition.
- **Selectors need `selector(...)`.** `@supports (:has(a))` is not a selector
  test; it is a malformed declaration test, and it is false.

## The cascade-safe fallback, which usually needs no `@supports` at all

CSS already discards declarations it does not understand, so the plain override
pattern covers most cases:

```css
.panel {
  background: #1d2831;                              /* every engine */
  background: color-mix(in oklch, #1d2831, white 8%); /* engines that parse it */
}
```

An engine without `color-mix()` drops the second declaration and keeps the
first. **Reach for `@supports` when the fallback needs *different properties*,
not just a different value:**

```css
/* fallback: a flex row that wraps */
.grid { display: flex; flex-wrap: wrap; gap: 1rem; }
.grid > * { flex: 1 1 16rem; }

/* enhancement: a real grid, which needs the flex rules undone */
@supports (grid-template-columns: subgrid) {
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
  .grid > * { flex: none; }
}
```

## What it can and cannot tell you

`@supports` answers *"can you parse this"*. It cannot answer *"do you implement
it correctly"*, and the gap is real: an engine can parse a property, apply it
partially, and pass the test.

It also cannot test at-rules directly. There is no `@supports (@container)`;
you test a declaration that implies it — `(container-type: inline-size)` — which
is why that idiom appears everywhere.

## The measured trap: parsing is not shipping

`CSS.supports` is the same test from script, and running it against real
features shows why "it works in my browser" is not a shipping decision:

```console
$ node ex03-baseline-data.mjs
=== Firefox/153.0 support vs Baseline — where they disagree ===
  feature                      Firefox/153.0  Baseline
  has                          true           Widely available
  container-queries            true           Widely available
  anchor-positioning           true           Limited availability   ← ships here, NOT Baseline
  accent-color                 true           Limited availability   ← ships here, NOT Baseline
  scroll-driven-animations     false          Limited availability
  line-clamp                   false          Limited availability
```

**Anchor positioning and `accent-color` both pass the support test in this
browser and are not Baseline.** Guarding them with `@supports` is exactly right —
the guard is doing its job for *other* people's browsers, which is why the local
result tells you nothing. See [page 10](./10-baseline-and-shipping.md).

## Progressive enhancement, stated as a contract

The pattern is a promise about what an older engine gets:

1. Write the base styling **outside** any recent at-rule. It must be usable
   alone — plainer, not broken.
2. Put the enhancement **inside** `@supports` (or `@container`, or `@media`).
3. Ensure the enhancement can undo whatever the base set, as `flex: none` does
   above.

The trade-off to name: two code paths, both of which need testing, and the
fallback path is the one nobody looks at. Keep the number of guarded features
small and delete each guard once its feature reaches Baseline.

## Gotchas

**Symptom:** `@supports (:has(a))` never matches, even in a browser with `:has()`.
**Cause:** that is a declaration test with `:has(a)` as a property name, which is
nonsense and therefore false.
**Fix:** `@supports selector(:has(a))`.

**Symptom:** everything inside `@supports` is ignored in an older browser —
including styles that had nothing to do with the tested feature.
**Cause:** an unsupported at-rule drops its whole block.
**Fix:** only put the enhancement inside. Base styling goes outside.

**Symptom:** the feature query passes but the feature misbehaves.
**Cause:** `@supports` tests parsing, not correctness. Partial implementations
parse fine.
**Fix:** check Baseline for real-world support, and test the behaviour rather
than the parse.

**Symptom:** an `@supports` guard is still in the codebase years later, for
something now universally supported.
**Cause:** nobody removes them.
**Fix:** treat each guard as debt with an expiry — when `web-features` reports
the feature Widely available, delete the guard and the fallback.

## Interview questions

**★ How do you use a CSS feature that isn't universally supported?**
Write the base styling outside any guard so old engines get something usable,
then put the enhancement inside `@supports`. For a value-level difference you
often need no guard at all — declare the fallback first and the modern value
second, and engines that cannot parse the second keep the first. `@supports` is
for when the fallback needs *different properties*, which must then be undone
inside the guard.

**★ What is the difference between `@supports (x: y)` and
`@supports selector(...)`?**
The first tests whether a property accepts a value; the second tests whether a
selector is understood. Selector tests must be wrapped in `selector()` —
without it the condition is parsed as a declaration and is always false.

**Can `@supports` test an at-rule?**
Not directly. You test a declaration that implies it — `(container-type:
inline-size)` for container queries — since there is no syntax for testing
`@container` itself.

**Your feature query passes, but the feature is broken. Why?**
Because the query tests whether the engine can *parse* the declaration, not
whether it implements it correctly. Partial implementations parse and then
misbehave, which is why Baseline data matters alongside the query.

**Does `CSS.supports()` returning true mean it's safe to ship?**
No — it is one engine's answer. Measured here, Firefox 153 returns `true` for
anchor positioning and `accent-color`, both of which `web-features` reports as
Limited availability. Support in the browser in front of you is not support in
the browsers your users have.

---

← [08 · The at-rule map](./08-the-at-rule-map.md) · Next: [10 · Baseline and shipping decisions](./10-baseline-and-shipping.md) →
