---
title: "Units that matter for layout"
sidebar_label: "04 · Units that matter for layout"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **MDN — [CSS values and units](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Values_and_Units)**
> and **[`length`](https://developer.mozilla.org/en-US/docs/Web/CSS/length)**, and
> **W3C CSS Values and Units Level 4** ([§6 Distance units](https://www.w3.org/TR/css-values-4/#lengths)).
> The percentage-resolution result is **sandbox-measured** — `sandbox/css/ex12-inheritance-and-values.mjs`,
> Firefox 153.0.3, run 2026-08-13.

**Four unit questions cause nearly all real layout surprises**: what `em`
compounds against, what `rem` is immune to, what the viewport units do when the
mobile URL bar moves, and what a percentage resolves *against*.

## `rem` vs `em` — the compounding difference

Both are font-relative. They differ in *whose* font size they read.

| Unit | Relative to |
|---|---|
| `em` | the **element's own** `font-size` (or the parent's, when setting `font-size` itself) |
| `rem` | the **root** element's `font-size` — always the same reference |

`em` compounds through nesting, and this is the classic trap:

```css
.list { font-size: 0.9em; }
```

```html
<ul class="list">        <!-- 0.9  × parent -->
  <ul class="list">      <!-- 0.81 × parent -->
    <ul class="list">    <!-- 0.729 -->
```

Three levels deep the text is at 73% and nobody wrote that number. `rem` cannot
compound, because the reference never changes.

**The working rule:** `rem` for anything that should be globally consistent —
type scale, spacing, breakpoints in a component. `em` where you *want* the value
tied to the local text, which is genuinely the right choice for a few things:

```css
.button { padding: 0.5em 1em; }   /* padding scales with the button's own text */
.icon   { inline-size: 1em; }     /* icon matches its adjacent text size */
```

That is the honest case for `em`: proportional to *this* text, not to the page.

## `ch` and `ex`

`ch` is the advance width of the `0` glyph in the element's font; `ex` is the
x-height. Both are font-relative and change when the font does.

`ch` is the useful one, because it approximates character count:

```css
.prose { max-inline-size: 65ch; }
```

That is the readable-measure idiom — roughly 65 characters per line. It is an
approximation, not a guarantee: proportional fonts vary per character, so `65ch`
is nearer 70–80 actual characters for typical prose. Good enough for the job,
and far better than guessing a pixel width per font.

## The viewport units, and the mobile URL bar

`vw` and `vh` are 1% of the viewport width and height. On mobile, "the viewport
height" is ambiguous while the browser's URL bar slides in and out, which is why
the newer set exists:

| Unit | Height it uses |
|---|---|
| `lvh` | **largest** — URL bar retracted |
| `svh` | **smallest** — URL bar visible |
| `dvh` | **dynamic** — changes as the bar moves |
| `vh` | the browser's own choice; on mobile typically equal to `lvh` |

`100vh` on mobile is therefore usually *taller than the visible area* while the
URL bar is showing — the long-standing bug where a "full-screen" hero has its
bottom edge cut off, or a sticky footer sits below the fold.

```css
.hero { min-block-size: 100svh; }   /* always fits — never cropped */
.hero { min-block-size: 100dvh; }   /* fills, but resizes as the bar moves */
```

The trade between them is real: `svh` never crops but leaves a gap when the bar
retracts; `dvh` always fills but reflows during scroll, which can cause visible
jumping. **`svh` for anything that must not be cut off, `dvh` for backgrounds
where a reflow is invisible.**

There are inline/block-relative forms too — `vi`, `vb`, and the `dvi`/`svb`
family — which follow the writing mode rather than physical axes.

## Percentages resolve against different things

This is the one that produces genuine disbelief, and it is measured:

```css
.parent { width: 400px; height: 200px; }
.child  { padding-top: 10%; }
```

**`padding-top: 10%` computes to 40px, not 20px** — a percentage of the parent's
**width**, on a *vertical* property.

*(Measured in Firefox 153.0.3, `sandbox/css/ex12-inheritance-and-values.mjs`,
2026-08-13.)*

That is not a bug. The spec resolves `padding` and `margin` percentages — on
**all four sides** — against the **inline size** of the containing block. The
reason is circularity: a box's height often depends on its content, so resolving
vertical padding against height could make the height depend on itself.

The famous consequence is the aspect-ratio hack that predates `aspect-ratio`:

```css
.ratio-16-9 { padding-top: 56.25%; }   /* 9/16 of the WIDTH */
```

It worked precisely because of this rule. Today `aspect-ratio: 16 / 9` says it
directly, and the hack is worth recognising rather than writing.

Elsewhere the reference differs again:

| Property | Percentage resolves against |
|---|---|
| `width`, `padding`, `margin` (all sides) | containing block's **inline size** |
| `height` | containing block's **block size** — and is ignored if that is `auto` |
| `font-size` | the **parent's** font size |
| `line-height` | the **element's own** font size |
| `translate()` / `transform` | the **element's own** border box |
| `background-position` | the positioning area minus the image size |

`height: 100%` doing nothing is the same rule from the other side: if the parent
has no definite height, there is nothing for the percentage to resolve against,
so it computes to `auto`.

## Absolute units

`px` is the only absolute unit worth using on screen. `pt`, `cm`, `in` and `mm`
are anchored to `px` by fixed ratios (`1in` = `96px`, `1pt` = `1/72in`), so they
are no more "physical" than `px` — they are just less familiar. They remain
appropriate in print stylesheets, which this syllabus does not cover.

**`px` is not the enemy.** Borders, shadows, and hairlines are genuinely
absolute; a `1px` border should not double because a user enlarged their text.
The rule is `rem` for anything typographic or spatial, `px` for anything that is
a physical detail of the rendering.

## Trade-off

**Relative units buy accessibility and cost predictability.** A layout in `rem`
responds correctly to a user who sets a 24px default font — and that same
responsiveness means you cannot look at a stylesheet and know how wide anything
is. Debugging shifts from reading values to computing them, and a single change
to the root font size moves everything at once, which is powerful and alarming
in equal measure.

An all-`px` layout is perfectly predictable and quietly fails the users who most
need it to adapt. The mainstream position — `rem` for type and space, `px` for
hairlines, `ch` for measure, `svh`/`dvh` for viewport-filling — is a compromise
that has settled for good reasons rather than a fashion.

## Gotchas

**Nested elements shrink unexpectedly.**
*Symptom:* text gets smaller at each nesting level.
*Cause:* `em` on `font-size` compounds against the parent.
*Fix:* `rem`, or set the size once on a container rather than on a recursive
selector.

**A full-height hero is cropped on mobile.**
*Symptom:* the bottom of a `100vh` section is under the URL bar.
*Cause:* `vh` typically resolves to the *largest* viewport height.
*Fix:* `100svh` when it must never crop, `100dvh` when it should track the bar.

**`padding-top: 50%` produces a value based on width.**
*Symptom:* vertical padding changes when the parent gets wider.
*Cause:* percentage padding and margin resolve against the containing block's
inline size on every side.
*Fix:* intended behaviour — use `aspect-ratio` if you wanted a ratio, and an
absolute value if you wanted fixed vertical padding.

**`height: 100%` does nothing.**
*Symptom:* the element stays content-height.
*Cause:* the parent's height is `auto`, so the percentage has no definite
reference.
*Fix:* give the ancestor chain a definite height, or use `100dvh`, or restructure
with flex/grid so the parent stretches the child.

**`65ch` is not 65 characters.**
*Symptom:* lines run longer than expected.
*Cause:* `ch` measures the `0` glyph, and proportional fonts average narrower.
*Fix:* treat it as an approximation and tune the number for the actual font.

## Interview questions

**★ What is the difference between `rem` and `em`, and when is `em` the right
choice?**
`em` is relative to the element's own font size and compounds through nesting;
`rem` is relative to the root and cannot compound. Use `rem` for global type and
spacing scales. Use `em` where the value should track the local text — button
padding, an inline icon sized `1em`.

**★ Why does `padding-top: 10%` resolve against the parent's width?**
The spec resolves percentage padding and margin on all four sides against the
containing block's inline size, to avoid circularity — a box's block size often
depends on its content, so resolving vertical padding against it could make the
size depend on itself. Measured: `10%` of a 400×200 parent is 40px.

**★ What are `svh`, `lvh` and `dvh` for?**
They disambiguate viewport height while a mobile URL bar moves. `svh` is the
smallest (bar visible), `lvh` the largest (bar retracted), `dvh` tracks the
current value. `100vh` typically equals `lvh`, which is why full-height sections
get cropped on mobile.

**Why does `height: 100%` often do nothing?**
Because the parent's height is `auto`, giving the percentage no definite value
to resolve against, so it computes to `auto` as well.

**Is `px` acceptable in modern CSS?**
Yes, for physical rendering details — borders, hairlines, shadow offsets — which
should not scale with the user's font size. Type and spacing should still be
`rem` so they respond to user preferences.

**What does `65ch` actually measure?**
65 times the advance width of the `0` glyph in the current font — an
approximation of character count used for a readable line length, typically
landing nearer 70–80 real characters in proportional prose.

---

← [03 · `@property`](./03-at-property.md) · Back to [Phase 3 overview](./README.md)
