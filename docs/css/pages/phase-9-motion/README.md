---
title: "Phase 9 — Motion and the cost model"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against **MDN**, the **W3C CSS Transitions Level 1/2**
> and **CSS Transforms Level 1** specifications, and **WCAG 2.2**.
> Sources named per page. Baseline data from `web-features` 3.34.3.

**✅ 3 of 3 topics written.** The organising idea: only two properties are cheap
to animate, and everything here is downstream of that.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [What is cheap to animate](./01-what-is-cheap-to-animate.md) | <span className="db-tier t-master">Master</span> | `transform` and `opacity` are composite-only; the rest cost layout or paint |
| 02 | [Transition traps](./02-transition-traps.md) | <span className="db-tier t-master">Master</span> | `display: none`, `auto`, and the value that must exist to animate from |
| 03 | [`prefers-reduced-motion`](./03-prefers-reduced-motion.md) | <span className="db-tier t-master">Master</span> | Reduce or replace the motion — never delete the state change |

## The cost model in one table

| Animating… | Triggers | Cost |
|---|---|---|
| `width`, `height`, `top`, `margin` | layout → paint → composite | highest |
| `background-color`, `box-shadow` | paint → composite | medium |
| **`transform`, `opacity`** | composite only | lowest |

## The three things most often got wrong

- **`display: none` cancels a transition.** The element has no box to animate
  from. `transition-behavior: allow-discrete` plus `@starting-style` is the fix —
  both newly available, so it degrades to an instant show/hide.
- **`height: auto` cannot be interpolated.** The reliable technique is
  `grid-template-rows: 0fr → 1fr` with `min-block-size: 0` on the child.
- **A blanket reduced-motion reset can be an accessibility problem of its own.**
  Removing every transition leaves state changes with no feedback. Replace the
  motion; do not just delete it.

## Where motion sits in the cascade

Transitions outrank **everything**, including important user and user-agent
declarations — which is why an `!important` override appears not to work
mid-transition. Animations sit lower, just above normal author declarations, so
an author `!important` *does* beat a running `@keyframes`. See
[Phase 2 · What the cascade compares](../phase-2-cascade/01-what-the-cascade-compares.md).

## Phase gate

You can animate a dialog in *and* out, with a reduced-motion variant, using only
compositor-friendly properties — and say why the exit needed `allow-discrete`.

## Where this connects

- **← [Phase 0 · The rendering pipeline](../phase-0-how-css-runs/README.md)** —
  the cost model is the pipeline stages restated.
- **← [Phase 7 · Stacking contexts](../phase-7-positioning/01-stacking-contexts.md)** —
  `transform`, `opacity` and `will-change` all create one.
- **→ JavaScript Phase 12** — `requestAnimationFrame` and the Web Animations API
  belong to the JavaScript syllabus; CSS owns declarative motion.

---

← [Phase 8 · Colour and theming](../phase-8-color-theming/README.md) · Start → [01 · What is cheap to animate](./01-what-is-cheap-to-animate.md)
