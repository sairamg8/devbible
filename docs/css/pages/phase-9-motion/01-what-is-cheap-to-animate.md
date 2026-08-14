---
title: "What is cheap to animate"
sidebar_label: "01 · What is cheap to animate"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [CSS performance optimization](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS)**,
> [`will-change`](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change) and
> [`transform`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform),
> and the **W3C CSS Transforms Level 1** specification.

**Two properties are cheap to animate. Everything else costs layout or paint on
every frame.** The list is short, and it decides how every animation in an
application is built.

## The pipeline decides the cost

From [Phase 0](../phase-0-how-css-runs/README.md): style → **layout** → **paint**
→ **composite**. Which stage a property invalidates is exactly its animation cost:

| Animating… | Triggers | Cost per frame |
|---|---|---|
| `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size` | **layout** → paint → composite | highest — the whole subtree may reflow |
| `background-color`, `color`, `box-shadow`, `border-radius` | **paint** → composite | medium — repaint the affected area |
| **`transform`**, **`opacity`** | **composite only** | lowest — the GPU moves an existing layer |

`transform` and `opacity` can be handled by the compositor without touching
layout or paint, which is why they can run on a separate thread and stay smooth
even when the main thread is busy.

## The substitutions

Almost every expensive animation has a cheap equivalent:

| Instead of | Use |
|---|---|
| `left` / `top` | `transform: translate()` |
| `width` / `height` | `transform: scale()` |
| `margin-left` | `transform: translateX()` |
| `visibility` + `height` | `opacity` + `transform`, with `@starting-style` |
| `box-shadow` transition | animate `opacity` on a pseudo-element holding the shadow |

The last one is worth knowing: `box-shadow` is a paint-stage property and a
common performance mistake in card hover effects. Put the shadow on a `::after`
that covers the element and fade *that* instead — the shadow is painted once and
only its opacity changes.

## `scale()` is not the same as changing width

An honest caveat on the substitution table: `transform: scale()` scales the
element's **rendered pixels**, including text, borders and border-radius. It is
not a layout change:

```css
.box { transition: transform 200ms; }
.box:hover { transform: scale(1.05); }   /* text scales too, borders thicken */
```

For a subtle hover this is fine and usually desirable. Where crisp text at the
new size matters, or where surrounding content should reflow, `scale()` is not a
substitute — and then the honest answer is that the animation is expensive and
should be short, or reconsidered.

## `will-change`, and why it is not a free win

```css
.card { will-change: transform; }
```

This asks the browser to promote the element to its own compositor layer *ahead*
of the animation, avoiding a hitch on the first frame. The costs are real:

- **Memory.** Every promoted layer holds its own texture. Applying `will-change`
  broadly can consume large amounts of GPU memory and make things slower overall.
- **It creates a stacking context** ([Phase 7](../phase-7-positioning/01-stacking-contexts.md)),
  which can change layering unexpectedly.
- **Leaving it on permanently defeats it.** The hint tells the browser to prepare
  for a change; if the change never comes, the preparation is waste.

The guidance from MDN is to use it sparingly and, where possible, add it shortly
before the animation and remove it after. In CSS, applying it on a parent's
`:hover` is the usual approximation:

```css
.card-wrapper:hover .card { will-change: transform; }
.card { transition: transform 200ms; }
```

**Do not add `will-change` by default.** A `transform` animation is already
composited in modern browsers; the hint only helps with the very first frame.

## Animating to `auto` does not work

`height: auto` has no numeric value to interpolate towards, so a transition to it
does nothing. The modern answers:

```css
.panel { interpolate-size: allow-keywords; transition: height 300ms; }
.panel { height: 0; }
.panel--open { height: auto; }    /* now animatable */
```

`interpolate-size` and `calc-size()` make keyword sizes animatable — but both are
**limited availability** in `web-features` 3.34.3, so they are an enhancement, not
a solution.

The reliable technique remains a grid trick:

```css
.panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms; }
.panel--open { grid-template-rows: 1fr; }
.panel > * { min-block-size: 0; overflow: hidden; }
```

Animating `0fr` → `1fr` works, and `min-block-size: 0` is required for the same
reason as everywhere else in Phase 5. This animates a layout property and is
therefore not free — but it is correct, widely supported, and usually short
enough not to matter.

## Trade-off

**The cheap-properties rule is a real constraint on what you can design, not just
on how you implement it.** "The panel slides open" is `transform`; "the panel
grows to fit its content" is a layout animation with no cheap equivalent. Held
strictly, the rule quietly rules out a category of motion, and pretending
otherwise is how the grid-`fr` trick gets described as free when it is not.

The counter-pressure matters too: on a fast desktop almost anything animates
smoothly, so the cost is invisible during development and appears on mid-range
phones under load. That asymmetry is why the rule is worth following even when it
seems unnecessary.

The workable position: **`transform` and `opacity` by default; a layout animation
only when the design genuinely requires it, kept short (under ~200ms) and applied
to a small subtree.** A brief expensive animation on one element is a very
different proposition from a continuous one across a list.

## Gotchas

**An animation is smooth in development and janky on a phone.**
*Symptom:* dropped frames only on real devices.
*Cause:* a layout- or paint-triggering property, hidden by desktop headroom.
*Fix:* move to `transform`/`opacity`; profile on a throttled CPU.

**`will-change` made things slower.**
*Symptom:* higher memory use, no smoothness gain.
*Cause:* applied broadly and left on, promoting many layers permanently.
*Fix:* apply it narrowly and temporarily, or not at all.

**`transform: scale()` blurs text.**
*Symptom:* text looks soft while scaled.
*Cause:* the rendered pixels are scaled, not re-laid out.
*Fix:* accept it for short hovers, or animate a font-size change knowingly.

**A height transition does nothing.**
*Symptom:* the panel snaps open.
*Cause:* `height: auto` has no interpolatable value.
*Fix:* the `grid-template-rows: 0fr → 1fr` technique, or `interpolate-size` where
support allows.

**A hover shadow causes jank on a long list.**
*Symptom:* scrolling stutters while hovering cards.
*Cause:* `box-shadow` is a paint-stage property and repaints on every frame.
*Fix:* put the shadow on a pseudo-element and transition its `opacity`.

## Interview questions

**★ Which properties are cheap to animate, and why exactly those?**
`transform` and `opacity`. They can be handled at the composite stage — the
compositor moves or fades an already-painted layer without re-running layout or
paint. Everything else invalidates layout or paint on every frame.

**★ How would you animate a panel's height to `auto`?**
`height: auto` cannot be interpolated. Use a grid with
`grid-template-rows: 0fr → 1fr` and `min-block-size: 0` on the child, which is
widely supported; or `interpolate-size: allow-keywords`, which is cleaner but
limited availability.

**★ When should you use `will-change`, and what does it cost?**
Sparingly, and ideally added shortly before an animation and removed after. Each
promoted element gets its own compositor layer, costing GPU memory, and it creates
a stacking context. Leaving it on permanently defeats its purpose, and a
`transform` animation is already composited without it.

**Why is animating `box-shadow` expensive, and what is the alternative?**
It is a paint-stage property, so every frame repaints the affected area. Put the
shadow on a pseudo-element and transition that element's `opacity`, which is
composite-only.

**Why does an animation look fine locally and janky on a mid-range phone?**
Desktop headroom hides layout and paint costs. The property choice only becomes
visible when the main thread is contended.

**Is `transform: scale()` always a valid substitute for animating width?**
No. It scales rendered pixels — text, borders and radii scale with it — and it
does not reflow surrounding content. Fine for short hover effects, wrong when
crisp text or reflow is required.

---

Next: [02 · Transition traps](./02-transition-traps.md) →
