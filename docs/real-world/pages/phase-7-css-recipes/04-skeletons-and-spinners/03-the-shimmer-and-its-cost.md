---
title: "The shimmer and what it costs"
sidebar_label: "03 · The shimmer and its cost"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — MDN *CSS animations*, *`will-change`*, *`transform`*,
> *`@media (prefers-reduced-motion)`*, and MDN's *CSS performance
> optimization* guidance on which property changes avoid layout and paint.
> Composes
> [CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md),
> [CSS 9·02](../../../../css/pages/phase-9-motion/02-transition-traps.md) and
> [CSS 9·03](../../../../css/pages/phase-9-motion/03-prefers-reduced-motion.md).
> No sandbox, no measured frame timings.

A skeleton works perfectly well with no animation at all — its job is reserving
space, and a static grey block does that. The shimmer exists for one narrow
reason: **to distinguish "loading" from "broken"**. A motionless grey rectangle
is ambiguous; a moving one is unambiguously in progress.

That is the whole justification, and it is worth holding onto, because it sets
the budget. A shimmer that costs frames is spending the user's performance to
answer a question a `role="status"` announcement already answered.

## The version to avoid

```css
/* ⛔ animates a paint property, on every skeleton, every frame */
.product-card--skeleton .product-card__media {
  background: linear-gradient(90deg, var(--surface-3), var(--surface-2), var(--surface-3));
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to   { background-position:   0% 0; }
}
```

This is the shimmer everyone writes first, and it works. What it costs is
**repaint on every frame, for every animated element** — `background-position`
is not a property the compositor can handle alone, so each frame re-rasterises
the gradient. With a dozen skeleton cards, each holding three placeholder bars,
that is 36 elements repainting continuously while the app is *already* busy
fetching and parsing a response.

The symptom is not a crash. It is that the loading state — the moment you were
trying to make feel faster — is the moment the app janks.

## The version to ship

Move the motion onto a `transform`, which the compositor can run without
repainting the element beneath it:

```css
@layer components {
  .product-card--skeleton :is(
    .product-card__media,
    .product-card__name,
    .product-card__price-row
  ) {
    position: relative;
    overflow: hidden;
    background-color: var(--surface-3);
  }

  .product-card--skeleton :is(
    .product-card__media,
    .product-card__name,
    .product-card__price-row
  )::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      transparent,
      color-mix(in oklab, var(--surface-1) 60%, transparent),
      transparent
    );
    animation: skeleton-sweep 1.6s ease-in-out infinite;
  }

  @keyframes skeleton-sweep {
    to { transform: translateX(100%); }
  }
}
```

What changed and why it matters:

- **The gradient is painted once**, into a pseudo-element, and never repainted.
  Only its `transform` changes.
- **`transform` is compositor-friendly** — it changes where an already-rasterised
  layer is drawn, not what it contains. That is the distinction
  [CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md)
  is built around, and the practical shorthand is *animate `transform` and
  `opacity`; treat everything else as expensive until proven otherwise.*
- **`overflow: hidden` on the host** clips the sweep to the placeholder's box,
  which is what makes it read as a sheen over that element rather than a bar
  crossing the card.
- **`color-mix(in oklab, …)`** derives the highlight from the surface token
  instead of hard-coding a light value, so it stays correct in both themes —
  [CSS 8·02](../../../../css/pages/phase-8-color-theming/02-color-mix.md).

⚠️ **`inset: 0` on an absolutely positioned pseudo-element requires the host to
establish a containing block** — hence `position: relative`. Without it, the
sweep positions against whatever ancestor happens to be positioned, which in a
card that is a query container is the card itself
([topic 01 chunk 04](../01-the-product-grid/04-container-units-and-containment.md)).

## `will-change`, and why it is not in that rule

`will-change: transform` promotes an element to its own compositor layer ahead
of time. It is tempting here and it is the wrong call for a skeleton:

- **Each layer costs memory**, and a skeleton grid is by definition many
  elements at once.
- **The elements are short-lived.** `will-change` is an optimisation for motion
  that is about to start repeatedly; a skeleton animates for a second and then
  the whole subtree is replaced.
- **Browsers already promote elements running a `transform` animation.** The
  hint is largely redundant for exactly this case.

The rule of thumb: **`will-change` is for an animation you are about to trigger,
not one that is already running**, and it should be added in response to a
measured problem rather than in anticipation of one.

## Reduced motion is not optional

```css
@layer components {
  @media (prefers-reduced-motion: reduce) {
    .product-card--skeleton ::after,
    .spinner {
      animation: none;
    }
  }
}
```

`prefers-reduced-motion: reduce` is a setting the user has already made at the
operating-system level, and looping motion is precisely what it is about —
vestibular disorders make repeating movement genuinely unpleasant, not merely
distracting.

**The reduced-motion skeleton is not a degraded skeleton.** It still reserves
space, which was the actual job; it loses a sheen whose only purpose was
distinguishing loading from broken, and the live region already does that in
words.

🔴 **Name the pseudo-element in the query.** The animation lives on `::after`,
and a rule targeting only `.product-card--skeleton` does not reach it. This is
the single most common reason motion still plays for a user who asked for less
of it — the query is present, correct, and pointed at the wrong selector.

## Gotchas

- **Symptom:** the loading state janks on mid-range devices. **Cause:**
  animating `background-position`, which repaints every frame on every animated
  element. **Fix:** animate a `transform` on a pseudo-element overlay instead.

- **Symptom:** the shimmer sweeps across the whole card rather than each
  placeholder. **Cause:** no `overflow: hidden` on the host, so the sweep is not
  clipped to its box. **Fix:** clip it at the element the sheen belongs to.

- **Symptom:** the sweep appears in the wrong place entirely, or fills the card.
  **Cause:** `inset: 0` resolved against a positioned ancestor because the host
  is not `position: relative`. **Fix:** give the host a containing block. In a
  card that is a query container this is especially confusing, because
  containment already made *the card* a containing block.

- **Symptom:** the shimmer is invisible in dark mode, or blinding in light mode.
  **Cause:** a hard-coded white highlight. **Fix:** derive it from a surface
  token with `color-mix()`, so it follows the theme.

- **Symptom:** motion still plays under `prefers-reduced-motion: reduce`.
  **Cause:** the query targets the host and the animation is on `::after`.
  **Fix:** name every animated selector, pseudo-elements included.

- **Symptom:** memory climbs while a large skeleton grid is on screen.
  **Cause:** `will-change` promoting dozens of short-lived elements to their own
  layers. **Fix:** remove it — browsers already promote elements running
  transform animations, and the hint is redundant here.

- **Symptom:** the shimmer continues after the content has loaded.
  **Cause:** the modifier class was not removed, only the content swapped.
  **Fix:** a component concern, but worth catching in review — a skeleton is a
  *state*, and leaving the class on is the state never ending.

- **Symptom:** the animation restarts visibly when the grid appends a page.
  **Cause:** new skeleton elements mount with the animation at frame zero while
  existing ones are mid-cycle. **Fix:** accept it, or use a negative
  `animation-delay` derived from the index so they are deliberately staggered
  rather than accidentally out of phase.

- **Symptom:** a designer asks for a faster shimmer to "feel quicker".
  **Cause:** conflating motion speed with perceived performance. **Fix:** worth
  pushing back on — faster looping motion reads as agitation, and the thing that
  actually makes the state feel quick is showing it later
  ([chunk 01](01-skeleton-spinner-or-nothing.md)).

## Interview questions

1. **★ Why animate a `transform` rather than `background-position` for a
   shimmer?** Because `background-position` changes what the element contains,
   forcing a repaint every frame on every animated element — and a skeleton grid
   is dozens of them at once, while the app is already busy. A `transform` moves
   an already-rasterised layer, which the compositor handles without repainting.
   The shorthand worth keeping: animate `transform` and `opacity`, treat
   everything else as expensive until measured.

2. **★ What is the shimmer actually for?** Distinguishing "loading" from
   "broken". A static grey rectangle is ambiguous; a moving one is not. That is
   the whole justification, and it sets the budget — a shimmer costing frames is
   spending performance to answer a question the live region already answers in
   words.

3. **★ Why is `will-change: transform` the wrong call on a skeleton?** Because
   each promoted element costs memory and a skeleton is many elements at once;
   because the elements are short-lived, and `will-change` is for motion about
   to start repeatedly; and because browsers already promote elements running
   transform animations, so the hint is largely redundant here.

4. **★ Why does motion still play for some users despite a `prefers-reduced-motion`
   query?** Because the animation is on a pseudo-element and the query targets
   its host. `::after` is a separate selector and has to be named. It is the
   most common cause, and it is invisible in testing unless you actually enable
   the setting.

5. **Is a skeleton without its shimmer degraded?** No. The skeleton's job is
   reserving space, and it does that identically. What is lost is a sheen whose
   only purpose was signalling activity — and the polite live region already
   signals it, in a form that works for users who cannot see the animation
   either way.

6. **Why does the sweep need `overflow: hidden` and `position: relative` on its
   host?** `overflow: hidden` clips it to the placeholder so it reads as a sheen
   on that element rather than a bar crossing the card. `position: relative`
   gives the absolutely positioned pseudo-element a containing block, without
   which `inset: 0` resolves against some ancestor — and inside a query
   container, that ancestor is the card.

7. **How would you keep the highlight correct in both light and dark themes?**
   Derive it from a surface token with `color-mix()` rather than hard-coding a
   light value, so the highlight is defined relative to the surface it sits on
   and follows whatever the theme resolves that surface to.

8. **Several skeletons mount at different times and their animations are out of
   phase. Is that a bug?** Not necessarily — it is only noticeable when it looks
   accidental. Either accept it, or make it deliberate with a negative
   `animation-delay` derived from the index, which turns a ragged effect into a
   staggered one.

9. **A designer asks to speed up the shimmer so the app feels faster. What do
   you say?** That looping motion speed and perceived performance are not the
   same thing — faster repetition reads as agitation rather than progress. The
   change that actually makes a loading state feel fast is delaying its
   appearance so short waits never show one at all.

---

← Prev [Building the skeleton](02-building-the-skeleton.md) ·
Next → [The spinner and the busy button](04-the-spinner-and-busy-button.md)
