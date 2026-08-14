---
title: "clamp(), min() and max()"
sidebar_label: "02 · clamp(), min(), max()"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`clamp()`](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp)**,
> **[`min()`](https://developer.mozilla.org/en-US/docs/Web/CSS/min)** and
> **[`max()`](https://developer.mozilla.org/en-US/docs/Web/CSS/max)**, and
> **W3C CSS Values and Units Level 4**
> ([§10 Comparison functions](https://www.w3.org/TR/css-values-4/#comp-func)).
> The zoom-safety argument is grounded in **WCAG 2.2 SC 1.4.4 — Resize text**.

**Three functions that replace whole families of media queries.** They compute a
value continuously instead of switching it at breakpoints, which means a
component adapts at every width rather than at the four you happened to pick.

## Reading them correctly

```css
width: min(100%, 600px);    /* never wider than 600px, never wider than parent */
width: max(50%, 300px);     /* at least 300px, but grow with the parent */
font-size: clamp(1rem, 2.5vw + 0.5rem, 2rem);
```

The naming is the part people get backwards. **`min()` sets a maximum** and
`max()` sets a minimum, because they pick the smallest/largest of their
arguments — the effect on the box is the opposite of what the name suggests.

Read them as questions:

| Written | Reads as |
|---|---|
| `min(100%, 600px)` | "whichever is *smaller*" → a ceiling of 600px |
| `max(50%, 300px)` | "whichever is *larger*" → a floor of 300px |
| `clamp(a, b, c)` | "`b`, but never below `a` and never above `c`" |

`clamp(a, b, c)` is exactly `max(a, min(b, c))`, and knowing that removes any
remaining ambiguity about which argument wins when they conflict.

## The middle term is where the work happens

The first and third arguments are just limits. The **preferred** value in the
middle is what makes the result fluid, and it almost always mixes a
viewport-relative unit with an absolute one:

```css
font-size: clamp(1rem, 2.5vw + 0.5rem, 2rem);
```

At a 320px viewport, `2.5vw` is 8px, plus `0.5rem` (8px) = 16px, so the clamp
floor of `1rem` applies. At 1600px, `2.5vw` is 40px + 8px = 48px, above the
`2rem` ceiling, so the ceiling applies. Between those the size moves smoothly.

**Arithmetic works without `calc()`.** Inside `min()`, `max()` and `clamp()`,
maths is allowed directly — `2.5vw + 0.5rem` needs no wrapper, though the usual
whitespace rule around `+` and `-` still applies.

## The `rem` term is not decoration — it is the accessibility fix

This is the load-bearing detail, and the reason the "always include a `rem` in
the preferred term" advice exists.

A preferred value made **only** of viewport units ignores the user's font-size
preference entirely:

```css
font-size: clamp(1rem, 4vw, 3rem);   /* ⚠️ pure vw in the middle */
```

Viewport units are a fraction of the viewport, which does not change when the
user increases their browser's default font size or zooms text. Between the
floor and the ceiling this text is effectively **unresizable**, which is exactly
what WCAG 2.2 SC 1.4.4 (*Resize text*, 200% without loss of content or
functionality) exists to prevent.

Adding a `rem` component restores the response:

```css
font-size: clamp(1rem, 2.5vw + 0.5rem, 3rem);   /* ✅ scales with user settings */
```

Because `rem` is relative to the root font size, a user who doubles their
default font size doubles that term, and the value moves. The floor and ceiling
being in `rem` matters for the same reason.

**The rule to remember: never let the middle term of a font-size `clamp()` be
viewport units alone.**

## Where these functions genuinely pay

**Fluid type and spacing**, as above — one declaration instead of three
breakpoints.

**Container-aware widths without a query:**

```css
.prose { inline-size: min(65ch, 100%); }
```

A readable measure that never overflows a narrow parent. This single line
replaces a `max-width` plus a mobile media query, and it is the most reusable
idiom of the three.

**Padding that shrinks but never disappears:**

```css
.section { padding-inline: max(1rem, 5vw); }
```

**A gutter that respects the safe area:**

```css
padding-inline: max(1rem, env(safe-area-inset-left));
```

## Nesting and comparison depth

The functions nest and compose:

```css
width: clamp(20rem, 50% + 2rem, min(60rem, 90%));
```

They accept any number of comma-separated arguments —
`min(10vw, 20rem, 400px)` is legal. Readability degrades quickly past two
levels, and a named custom property is usually the better fix:

```css
--measure: min(65ch, 100%);
.prose { inline-size: var(--measure); }
```

## Trade-off

**You are trading discrete, inspectable breakpoints for a continuous function
that is harder to reason about at a glance.** With media queries you can read
the stylesheet and know there are exactly three states, and you can test those
three. With `clamp()` there is a state for every viewport width, and a design
mistake shows up only in the band nobody looked at — typically the awkward
900–1100px range where the preferred term crosses the ceiling.

There is also a real debugging cost: DevTools shows the *computed* result, not
which term won, so working out why a value plateaued means evaluating the
arithmetic by hand.

The honest position is that fluid values are right for *continuous* properties —
type scale, spacing, measure — and media or container queries remain right when
the **design** changes rather than merely the size. Reaching for `clamp()` to
rearrange a layout is how you get a component that is subtly wrong at every
width instead of correct at four.

## Gotchas

**`min()` and `max()` do the opposite of what the name suggests.**
*Symptom:* `width: max(600px, 100%)` grows without limit instead of capping.
*Cause:* `max()` picks the larger value, so it sets a floor.
*Fix:* `min(600px, 100%)` for a ceiling. Read them as "whichever is smaller /
larger", not "the maximum width".

**Fluid text cannot be zoomed.**
*Symptom:* increasing the browser's default font size changes nothing.
*Cause:* the preferred term is pure viewport units, which do not respond to user
font settings.
*Fix:* add a `rem` component — `clamp(1rem, 2.5vw + 0.5rem, 2rem)`.

**The clamp appears stuck at its floor or ceiling.**
*Symptom:* the value never moves across the whole viewport range.
*Cause:* the preferred term is outside the limits at every realistic width.
*Fix:* evaluate the middle term at your minimum and maximum viewport and check
it actually crosses the range between them.

**A bare `+` or `-` breaks the expression.**
*Symptom:* the whole declaration is dropped.
*Cause:* CSS maths requires whitespace around `+` and `-` — `2.5vw+0.5rem` is
invalid, and unlike `*` and `/` this is not optional.
*Fix:* space them: `2.5vw + 0.5rem`.

**Percentages resolve against something unexpected.**
*Symptom:* `min(50%, 20rem)` behaves oddly on a vertical property.
*Cause:* the percentage resolves against the containing block per the *target
property's* rules, and for several properties that is the inline size.
*Fix:* see [04 · Units that matter for layout](./04-units-that-matter.md).

## Interview questions

**★ What does `clamp(a, b, c)` mean, and what is it equivalent to?**
Use `b`, but never less than `a` and never more than `c`. It is exactly
`max(a, min(b, c))`. `a` is the floor, `b` the preferred/fluid value, `c` the
ceiling.

**★ Why does `min()` set a maximum width?**
Because it evaluates to the smaller of its arguments. `min(100%, 600px)` can
never exceed 600px, so the effect on the box is a ceiling even though the
function is called `min`.

**★ Why must the middle term of a font-size `clamp()` include a `rem`?**
Viewport units do not respond to the user's font-size preference or text zoom,
so a purely `vw` preferred value makes the text unresizable between the floor
and ceiling — a WCAG 1.4.4 failure. A `rem` term scales with the root font size
and restores that response.

**Give a use for `min()` that replaces a media query.**
`inline-size: min(65ch, 100%)` — a readable measure that also never overflows a
narrow container, replacing a `max-width` plus a mobile breakpoint.

**Do these functions need `calc()` for arithmetic?**
No. Maths is allowed directly inside them, so `clamp(1rem, 2.5vw + 0.5rem, 2rem)`
is valid. The whitespace requirement around `+` and `-` still applies.

**When would you still choose a media or container query?**
When the *design* changes rather than the size — a different number of columns,
a rearranged shell, an element appearing or disappearing. Comparison functions
are for continuous properties; queries are for discrete states.

---

← [01 · Custom properties as a component API](./01-custom-properties-as-a-component-api.md) · Next: [03 · `@property`](./03-at-property.md) →
