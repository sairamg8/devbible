---
title: "Basic Animation Props: `initial`, `animate`, `exit` & `transition`"
sidebar_label: "Basic Animation Props"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs — [Motion component](https://motion.dev/docs/react-motion-component)
> (the `initial` / `animate` prop reference), [React animation](https://motion.dev/docs/react-animation),
> [Improvements to the Web Animations API DX](https://motion.dev/docs/improvements-to-the-web-animations-api-dx)
> and [Accessibility](https://motion.dev/docs/react-accessibility), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package.
> Documentation-verified; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Basic Animation Props: `initial`, `animate`, `exit` & `transition`

## 1. Under-The-Hood Mechanics

Three props form the core state-description model every other Framer Motion feature builds on — each describing a distinct moment in a component's lifecycle.

```
initial={{ opacity: 0 }}     ──► the STARTING style, applied IMMEDIATELY on mount (before any animation runs)
animate={{ opacity: 1 }}       ──► the TARGET style — Motion animates FROM initial TOWARD this, on mount,
                                       and RE-ANIMATES toward it whenever animate's VALUE changes on a re-render
exit={{ opacity: 0 }}             ──► the style to animate TOWARD on UNMOUNT — requires <AnimatePresence>
                                         wrapping the component (see the dedicated AnimatePresence doc)

transition={{ duration: 0.3, ease: 'easeOut' }}  ──► configures the TIMING/EASING of the animate transition —
                                                        can be set globally (one object) or PER-PROPERTY
```

This page is `initial` and `animate` — the two props that describe a mounted element's life.
`exit` and its `AnimatePresence` requirement are
[01b](01b-exit-and-animatepresence.md); the resolution model for `transition` — where it can
be declared, what it replaces, what it inherits — is
[01c](01c-transition-resolution-and-per-value-overrides.md).

### `initial` vs `animate`: Not Just "Before and After" — A Live Diff on Re-Render
`animate`'s target value is re-evaluated on every render — if a component's `animate` prop changes (e.g. `animate={{ x: isOpen ? 0 : -300 }}` after `isOpen` toggles), Motion automatically animates from the **current** value toward the **new** target, without needing to reset to `initial` first. `initial` only applies once, at mount — it establishes the starting point for the very first animation, not a value re-applied on every state change.

The prop reference states both halves of that in one line each. `initial`:

> *"The initial visual state of the motion component."* —
> [Motion component](https://motion.dev/docs/react-motion-component)

and `animate`:

> *"A target to animate to on enter, and on update."* — ibid.

The words **and on update** are the whole difference between this model and a CSS keyframe
animation. The enter half is described mechanically on the animation overview:

> *"When a motion component is first created, it'll automatically animate to the values in animate if they're different from those initially rendered, which you can either do via CSS or via the initial prop."* —
> [React animation](https://motion.dev/docs/react-animation)

Note what that sentence does *not* say: it does not say the start value must come from
`initial`. A value already set in CSS is an equally valid starting point, which is why an
element with a stylesheet `opacity: 0` and `animate={{ opacity: 1 }}` fades in with no
`initial` prop at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Slide-Out Panel Correctly Reversing Its Animation Mid-Transition When Rapidly Toggled.
A slide-out settings panel needed to smoothly reverse direction if a user clicked "close" while it was still mid-way through its "open" animation — a naive imperative CSS transition approach can produce a visual "jump" if interrupted mid-flight (snapping to the new target's un-animated starting position before beginning the reverse transition). Because Motion's `animate` prop always animates from the component's **actual current** rendered position (not from `initial`, and not from a hardcoded starting point) toward whatever the new target is, toggling the panel state mid-animation produced a smooth, correctly-reversed transition automatically — no special interruption-handling code needed at all.

> *"Motion automatically interrupts the animation of any values passed to animate and animates on to the new target:"* —
> [Improvements to the Web Animations API DX](https://motion.dev/docs/improvements-to-the-web-animations-api-dx)

The same page states what that is being contrasted with — in raw WAAPI,
*"if one animation starts while another is already playing on a specific value, the new
animation simply "overrides" the existing animation"*, and
*"If the old animation is still running when the new one finishes, the animating value will
appear to "jump" back to the old animation."* ⚠️ That document is written about the
imperative `animate()` function. The `motion` component's own prop reference does not restate
the interruption guarantee, so read "the prop behaves identically" as strongly implied by the
shared engine rather than separately documented.

---

## 3. Production-Grade Code Example

```tsx
// A settings panel correctly reversible mid-animation
import { motion } from 'motion/react';

function SettingsPanel({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.div
      className="settings-panel"
      initial={{ x: '100%' }} // off-screen to the right, ONLY on first mount
      animate={{ x: isOpen ? 0 : '100%' }} // re-evaluated on EVERY render — reverses correctly if toggled mid-animation
      transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
    >
      <SettingsContent />
    </motion.div>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 2: Setting `initial` to the Same Value as `animate`, Expecting a Re-Trigger on Every Render
```tsx
// ❌ MISUNDERSTANDING: initial ONLY applies on mount — changing a component's props/state
// does NOT re-apply `initial`; only `animate`'s CHANGED target value triggers a new transition
<motion.div initial={{ opacity: 0 }} animate={{ opacity: someValue }} /> // re-mounting is NOT what state changes do

// ✅ AWARENESS: to force a full RESET-and-replay of an entrance animation on a state
// change (not just an animate transition), the component typically needs to actually
// REMOUNT (e.g. via a changed `key` prop), not just receive new animate values
```

*(Pitfall 1 — expecting `exit` to work without `AnimatePresence` — moved to
[01b](01b-exit-and-animatepresence.md); Pitfall 3 — one global `transition` for properties
that want different timing — moved to
[01c](01c-transition-resolution-and-per-value-overrides.md).)*

---

## Gotchas

**★ `initial` is not "the mount-only prop" — a gesture that ends animates back to it.**
Pitfall 2 is right that `initial` is not re-applied when state changes. It is wrong to read
that as "`initial` is consumed at mount and never referenced again". The gesture props use it
as the resting target:

> *"and then when the gesture ends it animates back to the values in initial or animate"* —
> [React animation](https://motion.dev/docs/react-animation)

So `<motion.button initial={{ opacity: 0 }} whileHover={{ scale: 1.1 }} />` with **no**
`animate` prop fades the button to invisible the moment the pointer leaves. The value that
looked like a one-shot entrance value is also the value hover returns to. If a component has
gestures, give it an `animate` that names the resting state explicitly.

**★ The forced-replay fix Pitfall 2 names but does not show.**
Pitfall 2 is right that a state change will not re-run `initial`, and right that a remount
will. This is what the remount looks like — a `key` that changes, nothing else:

```tsx
// Replays the entrance animation every time `step` changes, because React
// throws the old component away and mounts a new one that has never had `initial` applied.
<motion.div
  key={step}
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
>
  <StepContent step={step} />
</motion.div>
```

> *"Changing a key prop makes React create an entirely new component."* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

The cost is real: a remount discards component state and re-runs effects in the subtree.
Reach for it when the entrance *is* the point (a step wizard, a slideshow), not to re-trigger
a fade you could have expressed as a changed `animate` target.

**★ `initial={{ x: '100%' }}` animating to `x: 0` works by exception, not by rule.**
The docs state that in general a value can only be animated between two of the same type —
`"0px"` to `"100px"`. The slide-out panel example above mixes a percentage with a unitless
`0` and works anyway because `x` is on the documented exception list, alongside `y`,
`width`, `height`, `top`, `left`, `right` and `bottom`, which the docs say *"can animate
between different value types."* Try the same mixed-unit trick on `padding` or `fontSize`
and you are outside what the documentation promises.

**★ `initial={{ opacity: 0 }}` is what the server renders, so a hydration failure ships an invisible page.**

> *"motion components are fully compatible with server-side rendering, meaning the initial state of the component will be reflected in the server-generated output."* —
> [Motion component](https://motion.dev/docs/react-motion-component)

That is the desired behaviour — no flash of the final state before the animation starts —
but it means the entrance animation is load-bearing for content being visible at all. Where
the content must be readable regardless, the documented escape is `initial={false}`, which
the prop reference describes as setting the element to *"disable the enter animation and
initially render as the values found in animate"*.

**★ Reduced Motion can silently neutralise a `transform`-based `animate`.**
With `MotionConfig reducedMotion="user"`, the docs state that *"all motion components will
automatically disable transform and layout animations"* while preserving other values such
as `opacity` and `backgroundColor`. The slide-out panel above animates `x` — a transform —
so for a user with the OS preference set, it stops moving entirely and appears or
disappears at its final position. Design the reduced-motion state deliberately (fade instead
of slide) rather than discovering that the panel teleports.

**★ `animate` also accepts a variant name, or an array of them — the object form is not the only form.**
The prop reference shows `<motion.li animate="visible" />` and
`<motion.div initial="hidden" animate={["visible", "active"]} />` alongside the object form.
This matters the first time a component needs to be driven by a parent: a string target
participates in variant propagation down the tree, an object target does not. Reaching for
`animate={{ ... }}` out of habit is how a component ends up unable to be orchestrated by its
parent later.

## Interview questions

**★ A colleague says "`initial` runs on mount, `animate` runs after". What is wrong with that summary?**
Two things. First, they are not two sequential animations — `initial` is a rendered state,
not an animation. The prop reference calls it *"The initial visual state of the motion
component."* and calls `animate` *"A target to animate to on enter, and on update."* One
animation runs, from the `initial` values to the `animate` values. Second, the summary
implies `animate` is a one-shot. It is re-evaluated on update: when the values passed to
`animate` change, the element animates to the new values from wherever it currently is. The
accurate summary is "`initial` is where the element is painted; `animate` is a target that is
continuously tracked."

**★ Why does a slide-out panel toggled halfway through its opening animation reverse smoothly rather than jump?**
Because the animation for a value is interrupted and re-targeted rather than restarted. The
docs describe this as Motion automatically interrupting the animation of any values passed
to `animate` and animating on to the new target. Compare it with the raw Web Animations API,
where the docs note that a new animation simply "overrides" the existing one and the value
appears to jump back. With a spring transition there is a second effect. Of physics-based
springs the transitions reference says *"and these incorporate the velocity of any existing
gestures or animations for natural feedback."* — so the reversal starts from the speed the
element already had rather than from rest, which is the difference between a panel that
whips back and one that decelerates and returns.

**★ Do you need an `initial` prop for an element to animate in?**
No. The documented condition is that the component animates to `animate` if those values
differ from the ones initially rendered, and it says explicitly that you can establish those
initial values *"either do via CSS or via the initial prop"*. An element styled
`opacity: 0` in a stylesheet and given `animate={{ opacity: 1 }}` fades in. The reason to
prefer `initial` is that it keeps the start and end of the animation in one place, and it is
the value the gestures fall back to.

**★ What does `initial={false}` do, and name a case where you want it.**
It disables the enter animation: the element renders immediately with the values found in
`animate` instead of animating toward them. The two common cases are server-side rendering,
where you want the server-generated HTML to carry the settled state rather than the
pre-animation state, and `AnimatePresence initial={false}`, which the docs describe as
disabling *"any initial animations on children that are present when the component is first
rendered"* — the reason a slideshow does not animate its first slide in on page load but does
animate every slide after it.

**★ Does `initial` ever have an effect after mount?**
Yes. It is the target a gesture returns to. When a gesture ends, the element animates back to
the values in `initial` or `animate` — so on a component that has `whileHover` or `whileTap`
but no `animate`, the values in `initial` are what the element settles on every time the
gesture ends, not just at mount. This is why a `whileHover` element with
`initial={{ opacity: 0 }}` and no `animate` disappears after the first hover.

**★ Your entrance animation only works on the first render of a list item and never replays. Why, and what are the two fixes?**
`initial` is applied once, when the component mounts; changing props does not re-apply it.
Fix one, when the entrance itself is the point: change the `key` so React unmounts the old
component and mounts a new one, which pays the entrance again — at the cost of losing that
subtree's state and re-running its effects. Fix two, usually better: stop trying to replay
the entrance and express the change as a new `animate` target, which animates from the
current value with no remount at all.

**★ How does a user's Reduced Motion setting change what your `animate` prop actually does?**
With `MotionConfig reducedMotion="user"`, Motion disables transform and layout animations
while preserving other values such as `opacity` and `backgroundColor`. Concretely, an
`animate={{ x: 0 }}` slide stops sliding — the element is placed at its final position — but
an `animate={{ opacity: 1 }}` fade still runs. The design consequence is that motion carried
entirely by a transform silently becomes an instant state change for those users, so any
animation that communicates something (a panel arriving from the right, a direction of
travel) needs a non-transform fallback you chose on purpose. `useReducedMotion` gives the
per-component version of the same decision.

**★ `initial={{ x: '100%' }}` to `animate={{ x: 0 }}` works. Why does that not generalise?**
Because in general values only animate between two of the same type — `"0px"` to `"100px"`.
A handful of values are documented exceptions that can animate between different value
types: `x`, `y`, `width`, `height`, `top`, `left`, `right` and `bottom`. The panel example
relies on being on that list. Mixing a percentage and a unitless zero on a value outside it
is unspecified by the documentation, and the honest advice is to keep units consistent
anywhere the exception list does not cover you.

---

← [Declarative animation](../01-core-concepts/01-declarative-animation-philosophy.md) · [Explanations](../README.md) · Next → [exit and AnimatePresence](01b-exit-and-animatepresence.md)
