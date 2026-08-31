---
title: "Baseline and shipping decisions"
sidebar_label: "10 · Baseline"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **`web-features` 3.34.3** (1 186 features) and
> **Firefox 153.0.3**, via `sandbox/css/ex03-baseline-data.mjs`.
> Extended 2026-08-31: the same script re-run on **Firefox 154.0** and on
> **Blink (Edge 152.0.4191.53)** — `ENGINE=blink node sandbox/css/ex03-baseline-data.mjs`.
> Both runs recorded in `sandbox/css/tmp/gecko/` and `sandbox/css/tmp/blink/`.

**"Can I use this?" is a data question, and there is a dataset.** Guessing from
memory is how you ship a feature that has been fine for two years but is broken
for a fifth of your users — or avoid one that has been safe since 2023.

## The three Baseline states

| State | Means | Treat it as |
|---|---|---|
| **Widely available** | supported in all core browsers for **30 months** | just use it |
| **Newly available** | supported in all core browsers **now** | use it, consider a fallback if the audience is conservative |
| **Limited availability** | at least one core browser does not support it | enhancement only, always guarded |

The core browser set is Chrome, Edge, Firefox and Safari, on desktop and mobile.
The 30-month gap between Newly and Widely is there to cover people who do not
update.

## Reading the data

The dataset ships as an npm package — the same one behind the Baseline badges on
MDN and web.dev — so this is checkable in CI, not just by eye:

```js
// sandbox/css/baseline.mjs
import {features} from 'web-features';

const f = features['container-queries'];
f.status.baseline;            // 'high' | 'low' | false
f.status.baseline_low_date;   // '2023-02-14'  — became Newly available
f.status.baseline_high_date;  // — became Widely available
```

```console
$ node ex03-baseline-data.mjs
web-features 3.34.3 · 1186 features

=== Baseline status, straight from web-features ===
  has                          Widely available     2023-12-19   :has()
  container-queries            Widely available     2023-02-14   Container queries
  subgrid                      Widely available     2023-09-15   Subgrid
  nesting                      Widely available     2023-12-11   Nesting
  cascade-layers               Widely available     2022-03-14   Cascade layers
  color-mix                    Widely available     2023-05-09   color-mix()
  oklab                        Widely available     2023-05-09   Oklab and OkLCh
  light-dark                   Newly available      2024-05-13   light-dark()
  popover                      Newly available      2025-01-27   Popover
  content-visibility           Newly available      2025-09-15   content-visibility
  view-transitions             Newly available      2025-10-14   View transitions
  scope                        Newly available      2025-12-12   @scope
  field-sizing                 Newly available      2026-06-16   field-sizing
  anchor-positioning           Limited availability —            Anchor positioning
  scroll-driven-animations     Limited availability —            Scroll-driven animations
  masonry                      Limited availability —            Masonry
  line-clamp                   Limited availability —            line-clamp
  accent-color                 Limited availability —            accent-color
```

**Read the dates.** `:has()`, container queries, subgrid, nesting, cascade layers
and `color-mix()` have all been Widely available since 2023 — they are not
"new CSS" you need to justify, they are the baseline of the language. Meanwhile
`field-sizing` became Newly available on **2026-06-16**, which no amount of
recollection would have produced.

## Why the browser in front of you cannot answer this

The same script asks Firefox the same questions:

```console
=== Firefox/153.0 support vs Baseline — where they disagree ===
  feature                      Firefox/153.0  Baseline
  container-queries            true           Widely available
  light-dark                   true           Newly available
  anchor-positioning           true           Limited availability   ← ships here, NOT Baseline
  accent-color                 true           Limited availability   ← ships here, NOT Baseline
  scroll-driven-animations     false          Limited availability
  line-clamp                   false          Limited availability
  text-wrap-pretty             false          Limited availability
```

Two features **work perfectly on this machine and are not safe to ship
unguarded**. If your process is "I tried it and it worked", those are the two
that reach production broken.

The reverse also happens: `line-clamp` is `false` here, but that is Firefox
lacking the *unprefixed* property — `-webkit-line-clamp` works
([page 11](./11-vendor-prefixes.md)). One engine's answer is not the story in
either direction.

### Now ask a second engine the same questions

Added 2026-08-31, when a Blink build became available on this machine. Same
script, same feature list, one environment variable:

```console
=== Edg/152.0.0.0 support vs Baseline — where they disagree ===
  feature                      Edg/152.0.0.0  Baseline
  anchor-positioning           true           Limited availability   ← ships here, NOT Baseline
  scroll-driven-animations     true           Limited availability   ← ships here, NOT Baseline
  masonry                      false          Limited availability
  calc-size                    true           Limited availability   ← ships here, NOT Baseline
  interpolate-size             true           Limited availability   ← ships here, NOT Baseline
  line-clamp                   false          Limited availability
  text-wrap-pretty             true           Limited availability   ← ships here, NOT Baseline
  accent-color                 true           Limited availability   ← ships here, NOT Baseline
```

🔴 **Gecko flags two features as "works here but is not Baseline". Blink flags
six.** Four of them — `scroll-driven-animations`, `calc-size`,
`interpolate-size` and `text-wrap: pretty` — are `false` in Gecko and `true` in
Blink. They are the same four that a Chrome-only workflow would wave straight
through.

This is the argument of this page, measured rather than asserted. "I tried it
and it worked" is three times more dangerous in the engine most developers
actually test in, because that engine ships the most not-yet-Baseline CSS.

The two engines agree in the other direction too: `masonry` and `line-clamp`
are `false` in both. `line-clamp` is the trap from
[page 11](./11-vendor-prefixes.md) — neither engine has the *unprefixed*
property, and `-webkit-line-clamp` works in both.

:::note Two engines, still not "cross-browser"
Gecko and Blink are measured here. **WebKit is not installed**, and Safari can
differ from both — the four features above say nothing about what Safari ships.
So the two sources stay separate exactly as before: every *support* claim on
these pages comes from `web-features`, and every *measured* number is labelled
with the engine that produced it. Two engines agreeing narrows the risk; it
does not answer the availability question.
:::

## The decision procedure

1. **Look it up.** MDN's Baseline badge, or `web-features` in a script.
2. **Widely available →** use it. No guard, no fallback, no discussion.
3. **Newly available →** use it. Add a fallback if your audience skews to old
   devices or locked-down corporate browsers; otherwise ship it.
4. **Limited →** enhancement only. Base styling works without it, the feature
   goes inside `@supports`, and the page is fully usable in the fallback path.
5. **Write the date down** next to the guard, so it can be deleted later.

The trade-off worth naming: guards are not free. Each one is a second code path
that must be maintained and tested, and the fallback path is the one nobody
looks at. Guarding a feature that has been Widely available since 2023 is pure
cost.

## Gotchas

**Symptom:** a feature works locally and is broken for a share of real users.
**Cause:** you tested one engine. Measured, Firefox 153 fully supports anchor
positioning and `accent-color`, both Limited availability.
**Fix:** check Baseline before shipping, not the browser on your desk.

**Symptom:** the codebase is full of `@supports` guards and fallbacks for things
that are universally supported.
**Cause:** guards added years ago and never removed.
**Fix:** audit against `web-features`; delete the guard and the fallback for
anything Widely available.

**Symptom:** `CSS.supports('line-clamp', '3')` is false and you conclude line
clamping is unavailable.
**Cause:** the unprefixed property is not implemented; the prefixed one is.
**Fix:** test what you will actually write — `-webkit-line-clamp` — and check
Baseline for the feature rather than the property name.

**Symptom:** "Baseline" and "supported in the last two versions" give different
answers.
**Cause:** they are different questions. Baseline is about the browsers people
*have*, including ones that do not update.
**Fix:** decide which population you support and be explicit about it; do not
mix the two definitions.

## Interview questions

**★ How do you decide whether a CSS feature is safe to use?**
Check its Baseline status — Widely available means all core browsers have had it
for 30 months and it needs no guard; Newly available means all core browsers
have it now; Limited means at least one does not, so it is enhancement-only
behind `@supports`. The data is in the `web-features` package, so it can be
checked in CI rather than remembered.

**★ Why isn't "it works in my browser" good enough?**
Because your browser is one of four core engines. Measured here, Firefox 153
returns `true` from `CSS.supports` for anchor positioning and `accent-color`,
both of which are Limited availability — they would ship broken. Local support
and shipping safety are different questions with different sources.

**What is the difference between Newly and Widely available?**
Both mean every core browser supports it. Widely adds 30 months, so it covers
users who have not updated. Newly is safe for most audiences; Widely is safe
for all of them.

**Where does Baseline data come from, and can you automate it?**
From `web-features`, an npm package maintained alongside MDN's browser-compat
data — 1 186 features in 3.34.3. Because it is a package, a lint rule or a test
can fail the build when a stylesheet uses something below your chosen threshold.

**A feature is Limited availability but you need it. What do you do?**
Ship the base experience without it, put the enhancement inside `@supports`, and
make sure the fallback is genuinely usable rather than degraded to the point of
being broken. Record the date so the guard can be deleted when the feature
reaches Baseline.

---

← [09 · @supports](./09-supports-feature-queries.md) · Next: [11 · Vendor prefixes in 2026](./11-vendor-prefixes.md) →
