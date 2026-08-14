---
title: "prefers-reduced-motion, implemented properly"
sidebar_label: "03 · prefers-reduced-motion"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)**
> and [`scroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior),
> the **W3C Media Queries Level 5** specification, and **WCAG 2.2 SC 2.3.3
> (Animation from Interactions)**.

**Reduce or replace the motion — never delete the state change.** This is the
distinction that separates a correct implementation from a blanket reset, and it
is the point most reduced-motion advice gets wrong.

## Why it matters

For users with vestibular disorders, large-area motion — parallax, sliding
panels, zooming transitions, anything simulating depth or acceleration — can
cause genuine nausea and dizziness. The OS setting is how they tell every
application to stop. WCAG 2.2 SC 2.3.3 makes honouring it a conformance criterion
for interaction animations.

It is not a preference like dark mode. It is closer to an accessibility
requirement, and ignoring it can make a site unusable rather than merely
unpleasant.

## The blanket reset, and its limits

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is a reasonable **safety net** — it guarantees nothing is missed — and it is
a blunt instrument. Removing every transition can leave an interface where states
change with no feedback at all, which can be *more* disorienting: a panel that
appears instantly gives no cue that anything happened.

Note the `0.01ms` rather than `0`: it lets `transitionend` and `animationend`
events still fire, so JavaScript that depends on them keeps working. Setting
duration to `0` can break such code silently.

Ship the reset as a floor, then do the real work per animation.

## Doing it properly

```css
.drawer {
  transform: translateX(-100%);
  transition: transform 300ms ease;
}
.drawer--open { transform: translateX(0); }

@media (prefers-reduced-motion: reduce) {
  .drawer {
    transform: none;
    opacity: 0;
    transition: opacity 150ms ease;
  }
  .drawer--open { opacity: 1; }
}
```

The drawer still *communicates* that it opened — it fades instead of sliding. The
large-area movement is gone; the feedback is not.

**The rule: substitute a small, local change for a large, spatial one.** Opacity
and colour are almost always safe. Movement across a large area is what to remove.

## What is and is not a problem

| Usually problematic | Usually fine |
|---|---|
| parallax scrolling | a colour or opacity fade |
| full-screen or large-panel slides | a small hover lift (a few pixels) |
| zoom and scale transitions | a spinner or progress indicator |
| auto-playing carousels | a focus-ring transition |
| motion simulating depth or acceleration | a brief cross-fade |

Reduced motion does not mean *no* motion. It means no motion that moves a large
area of the screen or simulates physical movement.

## The JavaScript half

CSS cannot reach animations driven by script, the Web Animations API, or a
library. Check the same preference there:

```js
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

if (!reduce.matches) {
  element.animate(keyframes, options);
}

reduce.addEventListener('change', () => { /* re-evaluate */ });
```

Listening for `change` matters because the user may toggle the setting while the
page is open, and an animation loop started earlier will otherwise keep running.

## `scroll-behavior: smooth`

Worth calling out separately, because it is commonly set globally and is exactly
the kind of full-viewport motion the preference is about:

```css
html { scroll-behavior: smooth; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

The same applies to `scrollIntoView({ behavior: 'smooth' })` in script — pass
`'auto'` when the preference is set.

## Write it in from the start

Retrofitting means auditing every `@keyframes`, every `transition`, and every
`element.animate()` in the codebase. Adding the reduced-motion variant at the
moment an animation is written costs a few lines and is the difference between
this being a solved problem and a permanent backlog item.

A useful habit: **any rule with a `transform` in a transition gets a
reduced-motion counterpart in the same block**, so the two are never separated by
a later refactor.

## Trade-off

**Per-animation handling is correct and does not scale by itself.** Every
animation gaining a second variant doubles the motion code and the testing
surface, and there is no mechanism that fails loudly when someone adds an
animation without one — the blanket reset will catch it, but only by deleting the
feedback rather than replacing it.

The blanket reset alone is cheap, universal, and produces a slightly worse
interface for the users it is meant to help. Per-animation handling is better and
decays as the codebase grows.

The workable arrangement is both: **the reset as an unconditional floor**, and
considered variants for the handful of animations that carry meaning — drawers,
modals, state changes the user must notice. Decorative motion can simply be
removed by the reset, because nothing is lost when it goes.

## Gotchas

**The state change becomes invisible.**
*Symptom:* users cannot tell that a panel opened.
*Cause:* the blanket reset removed the transition without replacing it.
*Fix:* a short opacity transition in the reduced-motion block.

**JavaScript animations keep running.**
*Symptom:* motion persists despite the CSS query.
*Cause:* the Web Animations API and libraries are not affected by CSS media
queries.
*Fix:* `matchMedia('(prefers-reduced-motion: reduce)')` in script, plus a
`change` listener.

**`transitionend` handlers stop firing.**
*Symptom:* code that waits for a transition hangs after the reset is added.
*Cause:* a duration of `0` may not fire the event.
*Fix:* use `0.01ms` rather than `0`.

**Smooth scrolling still happens.**
*Symptom:* the page glides on anchor navigation.
*Cause:* `scroll-behavior: smooth` set globally, and `scrollIntoView` in script.
*Fix:* override to `auto` in the query and pass `'auto'` in script.

**Nothing changes when testing.**
*Symptom:* the query never matches.
*Cause:* testing without enabling the OS setting.
*Fix:* DevTools media-feature emulation in Chrome, Edge or Firefox.

## Interview questions

**★ What is the correct way to handle `prefers-reduced-motion`?**
Reduce or replace the motion rather than deleting the state change. Substitute a
small local change — usually opacity — for a large spatial one, so the interface
still communicates that something happened. A blanket reset is a useful floor but
can leave states changing with no feedback, which is its own accessibility
problem.

**★ Why is `0.01ms` used instead of `0` in the blanket reset?**
So `transitionend` and `animationend` still fire. A duration of `0` can skip the
events, silently breaking JavaScript that waits for them.

**★ What does the CSS media query not cover?**
Anything driven by script — the Web Animations API, animation libraries, and
`scrollIntoView({ behavior: 'smooth' })`. Those need
`matchMedia('(prefers-reduced-motion: reduce)')`, and a `change` listener because
the user can toggle the setting while the page is open.

**Does reduced motion mean no motion?**
No. It targets motion that moves a large area or simulates physical movement —
parallax, large slides, zooms. Colour fades, small hover lifts, spinners and
focus-ring transitions are generally fine.

**Why should the reduced-motion variant be written at the same time as the
animation?**
Because retrofitting means auditing every keyframe, transition and scripted
animation in the codebase. Writing it in the same block keeps the two together
through later refactors.

**Is this a preference or a requirement?**
Closer to a requirement. Large-area motion can cause nausea and dizziness for
users with vestibular disorders, and WCAG 2.2 SC 2.3.3 covers animation from
interactions.

---

← [02 · Transition traps](./02-transition-traps.md) · Back to [Phase 9 overview](./README.md)
