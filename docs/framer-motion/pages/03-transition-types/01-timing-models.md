---
title: "Transition Types: `tween`, `spring` & `inertia`"
sidebar_label: "Transition Types"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Transitions](https://motion.dev/docs/react-transitions),
> [Animation](https://motion.dev/docs/react-animation), [React overview](https://motion.dev/docs/react)
> and the error catalogue in [llms.txt](https://motion.dev/llms.txt), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package. Documentation-verified;
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Transition Types: `tween`, `spring` & `inertia`

## 1. Under-The-Hood Mechanics

Framer Motion supports three fundamentally different mathematical models for computing an animation's motion over time — each producing a genuinely different **feel**, appropriate for different kinds of UI motion.

```text
tween    ──► DURATION-based — you specify how LONG the animation takes and an EASING CURVE
                shaping its rate of change; predictable, fixed-length, no physics simulation
                { type: 'tween', duration: 0.3, ease: 'easeOut' }

spring   ──► TWO SUB-MODELS, and this is the fact most people get wrong:
                physics-based  — stiffness / damping / mass; the duration EMERGES from the
                                 simulation, and the spring picks up existing velocity
                duration-based — duration / bounce; no velocity carried in, but far easier
                                 to reason about and coordinate with other timings
                the default for PHYSICAL properties (x, scale) — NOT for opacity or colour
                { type: 'spring', stiffness: 300, damping: 30, mass: 1 }
                { type: 'spring', duration: 0.6, bounce: 0.25 }

inertia  ──► MOMENTUM-based deceleration — used specifically for drag-release/fling gestures,
                where an element should continue moving after release, gradually decelerating,
                rather than stopping abruptly the instant the pointer is lifted
                { type: 'inertia', power: 0.8, timeConstant: 700 }
```

This page covers the two timing models you configure directly. Inertia gets its own chunk —
[01b · Inertia and drag release](01b-inertia-and-drag-release.md) — because almost everything
true of it is really a fact about `dragTransition`.

The `type` field takes exactly those three strings, and the transitions reference gives its own default as **`Default: Dynamic`** — that is, Motion decides per value. It does not default to `spring`.

> *"Spring animations are either physics-based or duration-based."*
> — [Transitions](https://motion.dev/docs/react-transitions)

> *"Inertia animations decelerate a value based on its initial velocity, usually used to implement inertial scrolling."*
> — ibid.

### What Motion Picks When You Say Nothing

The reference is explicit that there is no single default type — the choice is made per animated value:

> *"By default, Motion will create appropriate transitions for snappy animations based on the type of value being animated."*
> — [Animation](https://motion.dev/docs/react-animation)

> *"Physical properties like x and scale use spring physics by default; visual properties like opacity use tween easing."*
> — [Motion for React](https://motion.dev/docs/react)

The animation reference says the same thing with a wider list — *"whereas values like opacity or color are animated with duration-based easing curves"*. So "spring is the default" is only half true, and the half it gets wrong is the half you notice: an `opacity` fade you assumed was springing is a tween, and the `stiffness` you added to "fix" it did nothing until you also set `type: 'spring'`.

### Why Spring Is the Default for Physical Properties

A **physics-based** spring is naturally interruptible: if a spring-animating element's target changes mid-flight (e.g. a toggle rapidly flipped), the simulation continues from the current velocity and position toward the new target instead of snapping. That behaviour is documented, and it is specific to the physics sub-model:

> *"Physics-based spring animations are set via stiffness , damping and mass , and these incorporate the velocity of any existing gestures or animations for natural feedback."*
> — [Transitions](https://motion.dev/docs/react-transitions)

Duration-based springs give that up by design — *"These don't incorporate velocity but are easier to understand, and can also be generated as pure CSS for when you'd rather not ship Motion to the browser."* ⚠️ The documentation does **not** state what a `tween` does when interrupted mid-flight, so treat "a tween snaps on interruption" as unconfirmed; what *is* documented is that a physics spring carries velocity across the interruption and a duration spring does not.

### `stiffness`/`damping`/`mass`: Tuning Spring Feel

Each of the three is defined in one sentence by the reference, and the sentences are worth having exactly:

- **`stiffness`** — *"Stiffness of the spring. Higher values will create more sudden movement."* (faster, snappier)
- **`damping`** — *"Strength of opposing force. If set to 0, spring will oscillate indefinitely."* (higher = less bounce, more "settled")
- **`mass`** — *"Mass of the moving object. Higher values will result in more lethargic movement."* (feels heavier, slower to accelerate)

And the duration-based pair:

- **`bounce`** (`Default: 0.25`) — *"0 is no bounce, and 1 is extremely bouncy."*
- **`visualDuration`** — *"the bulk of the transition will occur before this time, and the "bouncy bit" will mostly happen after."*

---

## 2. Production-Grade Code Example

```tsx
// tween — predictable, fixed-duration motion, appropriate for a simple, deterministic fade
<motion.div
  animate={{ opacity: 1 }}
  transition={{ type: 'tween', duration: 0.4, ease: 'easeOut' }}
/>
```

```tsx
// spring, PHYSICS-based — carries existing velocity, tuned for a snappy UI toggle
<motion.div
  animate={{ x: isOpen ? 0 : -300 }}
  transition={{ type: 'spring', stiffness: 400, damping: 40 }} // snappy, minimal overshoot
/>

<motion.div
  animate={{ scale: isHovered ? 1.05 : 1 }}
  transition={{ type: 'spring', stiffness: 200, damping: 10 }} // more bouncy, playful feel
/>
```

```tsx
// spring, DURATION-based — the same type, the other sub-model. Use it when the spring has to
// line up with a time-based animation elsewhere, or be exported as a pure-CSS spring.
<motion.div
  animate={{ rotateX: 90 }}
  transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.25 }}
/>
```

---

## Gotchas

### ⚠️ Pitfall 1: Believing `duration` Is Ignored on a `spring`
It is not, and this is the single most repeated piece of stale folklore about Motion springs. Duration-based springs are a documented first-class sub-model:

> *"The duration of the animation. Can also be used for "spring" animations when bounce is also set."*
> — [Transitions](https://motion.dev/docs/react-transitions), `duration` (`Default: 0.3 (or 0.8 if multiple keyframes are defined)`)

What actually silences `duration` is mixing the two sub-models. The reference states the precedence directly:

> *"bounce and duration will be overridden if stiffness , damping or mass are set."*
> — ibid., the note under `bounce`

```tsx
// ✅ WORKS: a duration-based spring — duration and bounce are the inputs
transition={{ type: 'spring', duration: 0.6, bounce: 0.2 }}

// ❌ duration and bounce are OVERRIDDEN here — the physics values win, silently
transition={{ type: 'spring', duration: 0.6, bounce: 0.2, stiffness: 300 }}

// ✅ WORKS: a physics-based spring — the real duration emerges from the simulation
transition={{ type: 'spring', stiffness: 300, damping: 30 }}
```

The trap is the middle case: no warning, no error, and a `duration` sitting in the code that a reader will assume is doing something.

### ⚠️ Pitfall 2: Over-Bouncy Spring Settings on Content Users Read/Interact With Precisely
```tsx
// ❌ DISTRACTING: very low damping (high bounce/oscillation) on something like a form field
// focus indicator or a precise drag-to-reorder interaction can feel imprecise or even
// nauseating, rather than delightful — appropriate for a playful button, less so for
// something requiring precise visual tracking
transition={{ type: 'spring', stiffness: 500, damping: 5 }}, // very bouncy — inappropriate for precise UI

// ✅ CORRECT: tune damping HIGHER (less bounce) for UI elements where precision/settledness
// matters more than playful bounce
transition={{ type: 'spring', stiffness: 300, damping: 35 }}, // settles quickly, minimal overshoot
```

### ⚠️ Pitfall 3: "Spring Is the Default", Applied to `opacity`
Setting `stiffness` on a transition that is animating only `opacity` changes nothing until you also set `type: 'spring'`, because visual properties default to tween easing. If a single `animate` object mixes physical and visual values, split the transition per value rather than forcing one model on both — *"each value can be animated with a different transition, with default handling all other values"*:

```tsx
<motion.li
  animate={{ x: 0, opacity: 1 }}
  transition={{ default: { type: 'spring' }, opacity: { ease: 'linear' } }}
/>
```

### ⚠️ Pitfall 4: Giving a Spring Three Keyframes
Springs and inertia are two-value animations. Motion ships an explicit error for it, listed in the upstream error catalogue:

> *"Only two keyframes currently supported with spring and inertia animations."*
> — [motion.dev/llms.txt](https://motion.dev/llms.txt), *Spring only supports two keyframes*

So `animate={{ x: [0, 100, 0] }}` with `type: 'spring'` is not a slow spring — it is a rejected animation. Multi-keyframe sequences are tween territory, where `times` and an array of `ease` values exist precisely for that job.

### ⚠️ Pitfall 5: A Spring `duration` Over Ten Seconds
The same catalogue lists *"Spring duration must be 10 seconds or less"*. A duration-based spring is not a general long-running timer; anything slower than that ceiling has to be a tween with `repeat`, or a scroll- or time-driven motion value.

### ⚠️ Pitfall 6: `damping: 0`, and Not Knowing What Ends a Spring
*"Strength of opposing force. If set to 0, spring will oscillate indefinitely."* A spring is not ended by a clock — it is ended by two thresholds, both documented with defaults:

- `restSpeed` (`Default: 0.1`) — *"End animation if absolute speed (in units per second) drops below this value and delta is smaller than restDelta ."*
- `restDelta` (`Default: 0.01`) — ends the animation when the remaining distance is below it *and* speed is below `restSpeed`.

Two practical consequences. A very low `damping` on a large-range value can idle near the target for a long time before both thresholds are met — raise `damping` rather than reaching for `duration`. And on a value whose units are huge (a scroll offset in pixels, say), the defaults are relatively tighter than on a 0–1 value, so a spring that "hangs at the end" is usually a `restDelta` mismatch, not a stuck animation.

### ⚠️ Pitfall 7: `visualDuration` Silently Beating `duration`
> *"If visualDuration is set, this will override duration ."*
> — [Transitions](https://motion.dev/docs/react-transitions)

They are not synonyms and the override is one-directional. `visualDuration` is *"a time, set in seconds"* for when the animation appears to arrive — the overshoot happens after it. That makes it the right knob for coordinating a bouncy spring with a plain 300 ms fade next to it, and the wrong knob if you actually needed the whole motion, bounce included, to be over by a fixed time.

### ⚠️ Pitfall 8: Choosing a Duration-Based Spring for a Gesture-Driven Animation
This is the case where the two sub-models are not interchangeable. *"Duration-based spring animations are set via a duration and bounce"* — and *"These don't incorporate velocity"*. If the animation begins where a drag, a scroll or another spring left off, the velocity handoff is the entire reason you chose a spring; the duration form throws it away and starts from rest. Use `stiffness`/`damping`/`mass` for anything continuing a gesture, and `duration`/`bounce`/`visualDuration` for motion that starts from a standstill and has to line up with a clock.

### ⚠️ Pitfall 9: Assuming a Component Transition Merges With the `MotionConfig` Default
It replaces it:

> *"By default, transitions of higher specificity will replace default transitions."*
> — [Transitions](https://motion.dev/docs/react-transitions)

So a `MotionConfig transition={{ duration: 1, ease: 'linear' }}` wrapping a component that sets `transition={{ ease: 'easeInOut' }}` does not produce a 1-second `easeInOut` animation — the reference spells the outcome out: *"In this above example, x will animate with the default duration of 0.3"*. Merging is opt-in per transition:

```tsx
<MotionConfig transition={{ duration: 1, ease: 'linear' }}>
  <motion.div
    animate={{ x: 100 }}
    transition={{ inherit: true, ease: 'easeInOut' }} // now duration 1 IS inherited
  />
</MotionConfig>
```

*"By setting inherit: true , a transition will inherit values from transitions with lower specificity."* The same applies to value-specific transitions nested inside a parent transition object.

### ⚠️ Pitfall 10: Trusting the Listed Spring Defaults in Isolation
The transitions reference lists `stiffness` **`Default: 1`**, `damping` **`Default: 10`** and `mass` **`Default: 1`**, while `type` itself is **`Default: Dynamic`**. ⚠️ **The documentation does not state what stiffness, damping and mass a dynamically-chosen spring actually uses**, nor how those per-option defaults relate to the "snappy" transitions Motion picks for `x` and `scale`. Do not teach a number from that table as "the default spring". If the feel matters, set all three explicitly — then it is your number, and it is in the code where a reviewer can see it.

---

## Interview questions

**When would you deliberately choose `tween` over `spring`?**
When the exact length of the animation is part of the contract rather than an emergent property — a value that has to finish before a route transition, a keyframe sequence with `times`, or anything with three or more keyframes, which springs reject outright. Tween is also the only model that takes a named easing curve, so any motion whose *shape* is specified in a design handoff (`easeInOut`, a cubic bezier, `anticipate`) is a tween. The counter-case is anything continuing a gesture: there, a physics spring's velocity handoff is worth more than a predictable end time.

**Is `duration` ignored on a spring transition?**
No — that is stale folklore. Motion documents two spring sub-models: physics-based (`stiffness`, `damping`, `mass`) and duration-based (`duration`, `bounce`, `visualDuration`). `duration` is real on a spring; the documented rule is that `bounce` and `duration` are *overridden* if any of `stiffness`, `damping` or `mass` are set. So the bug people remember is not "duration does nothing on springs", it is "I set `duration` and `stiffness` in the same object and only one of them survived, without a warning".

**What is Motion's default transition type?**
There isn't one. `type` is documented as `Default: Dynamic`, and Motion chooses per value — physical properties like `x` and `scale` get spring physics, visual properties like `opacity` and `color` get duration-based easing. The follow-up worth having ready: this is why adding `stiffness` to a transition that only animates `opacity` appears to do nothing, and why mixing a transform and an opacity in one `animate` object usually wants a value-specific transition with a `default` key rather than one model imposed on both.

**What does `visualDuration` mean, and why does it exist separately from `duration`?**
It is the time in seconds at which the animation *appears* to arrive at its target; the bulk of the movement happens before it and the bounce mostly after. It exists because a bouncy spring's total duration is dominated by a settling tail that the eye does not read as "the animation", which makes `duration` a poor coordination handle. If `visualDuration` is set it overrides `duration`. Use it when a spring has to visually land at the same moment as a plain timed animation next to it.

**Your `type: 'spring'` animation with `x: [0, 100, 0]` does nothing. Why?**
Springs and inertia support exactly two keyframes; Motion has a dedicated error for it — *"Only two keyframes currently supported with spring and inertia animations."* A three-value array is not a slow spring, it is a rejected animation. Rewrite it as a tween with `times` and, if the segments need different curves, an array of easing functions in `ease`.

**A spring animation never seems to finish. What are you looking at?**
`damping`. Documented as the strength of the opposing force, and at `0` the spring oscillates indefinitely. More generally, a spring has no clock — it ends when the absolute speed drops below `restSpeed` (`0.1`) *and* the remaining distance is below `restDelta` (`0.01`). A value with a very large numeric range or very low damping can sit near the target for a long time before both thresholds are satisfied. The fix is to raise `damping`, or to accept the looser thresholds by setting `restSpeed`/`restDelta` explicitly — not to bolt a `duration` onto a physics spring, which would be overridden anyway.

**You set a global transition with `MotionConfig` and one component overrides just the easing. What duration does that component get?**
The default — `0.3` — not the global one. A higher-specificity transition *replaces* the default rather than merging into it, which the reference states outright. If you want the component to keep the inherited duration and change only the easing, set `inherit: true` on the component's transition. This is worth knowing because the failure is invisible: the animation still runs, it is just timed by a default nobody wrote down.

**When is a duration-based spring the wrong choice even though it is easier to reason about?**
Whenever the animation is continuing motion that already exists. Physics springs incorporate the velocity of any existing gestures or animations; duration-based springs explicitly do not. A card that springs to a snap point after a flick, a value that springs when a drag ends, a toggle that can be flipped mid-flight — all of them are physics springs, because the velocity handoff is the whole point. Duration-based springs are for motion that starts from rest and has to coordinate with a clock, and they have one extra benefit: they can be generated as pure CSS, so they are also the model to reach for when the goal is not shipping Motion for that particular animation.

**How do you give `x` a spring and `opacity` a linear tween in the same animation?**
With a value-specific transition: each value can take its own transition, and the `default` key handles everything not named explicitly. That is also the honest answer to "should I set one transition for the whole component" — usually no, because a transform and an opacity genuinely want different models, which is exactly what Motion's dynamic default was already doing for you before you overrode it with a single object.

---

← [Basic animation props](../02-basic-animation-props/01-the-core-prop-triad.md) · [Explanations index](../README.md) · Next → [Inertia and drag release](01b-inertia-and-drag-release.md)
