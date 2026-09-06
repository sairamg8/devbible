---
title: "Inertia is the transition you almost never set by hand: it is what drag release already runs, and `dragTransition` only tunes it"
sidebar_label: "01b · Inertia and drag release"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Transitions](https://motion.dev/docs/react-transitions)
> (Inertia section), [Drag](https://motion.dev/docs/react-drag) and
> [Motion component](https://motion.dev/docs/react-motion-component), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package. Documentation-verified;
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**Inertia is the third transition type, and the one that behaves least like the other two. You rarely write `type: 'inertia'` yourself — you inherit it, because drag release already uses it — and the prop that configures it, `dragTransition`, is not a general transition slot.** The split from [01 · Transition types](01-timing-models.md) is deliberate: `tween` and `spring` are things you choose, `inertia` is mostly a thing you tune.

## 1. Under-The-Hood Mechanics

```text
inertia  ──► MOMENTUM-based deceleration — used specifically for drag-release/fling gestures,
                where an element should continue moving after release, gradually decelerating,
                rather than stopping abruptly the instant the pointer is lifted
                { type: 'inertia', power: 0.8, timeConstant: 700 }
```

> *"An animation that decelerates a value based on its initial velocity."*
> — [Transitions](https://motion.dev/docs/react-transitions), Inertia

> *"Inertia animations decelerate a value based on its initial velocity, usually used to implement inertial scrolling."*
> — ibid.

Two things follow from that one sentence and are worth separating in your head:

**It is target-computing, not target-following.** A tween or a spring is given a destination. Inertia derives one:

> *"This animation will automatically precalculate a target value, which can be modified with the modifyTarget property."*
> — ibid.

`power` (`Default: 0.8`) scales that computed target — *"A higher power value equals a further calculated target."* — and `timeConstant` (`Default: 700`) governs how long the slowdown takes: *"Adjusting the time constant will change the duration of the deceleration, thereby affecting its feel."*

**It hands off to a spring at the boundary.** If you bound it, the edge is a different animation from the deceleration:

> *"Optionally, min and max boundaries can be defined, and inertia will snap to these with a spring animation."*
> — ibid.

That boundary spring has its own two options — `bounceStiffness` (`Default: 500`) and `bounceDamping` (`Default: 10`).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Draggable Card Needing to Feel Like It Has Real Momentum When Flicked and Released.
A card-based interface let users drag and "flick" a card away, similar to a Tinder-style swipe interaction — using a `tween` or even a `spring` transition for the post-release motion produced an unnatural, abrupt stop the instant the pointer was released, since neither model accounts for the actual **velocity** the user's gesture had built up. Switching the drag-release transition to `inertia` (which explicitly factors in release velocity) let the card continue moving in the direction and speed of the flick, gradually decelerating — the kind of momentum-preserving motion users intuitively expect from a physical, flickable object, which neither `tween` nor `spring` alone naturally provides.

**One correction the reference forces on that story:** if the card was a `drag` element, you were never *switching to* inertia — you already had it, and had either turned it off or hand-rolled the release animation yourself.

> *"It will perform an inertia animation based on the velocity of the pointer, creating a realistic, physical feel."*
> — [Drag](https://motion.dev/docs/react-drag)

> *"You can disable this behaviour by setting the dragMomentum prop to false ."*
> — ibid.

So the real fix in that scenario is either "stop hand-rolling the release animation" or "stop setting `dragMomentum={false}`", followed by tuning `power` and `timeConstant`.

---

## 3. Production-Grade Code Example

```tsx
// inertia — momentum-preserving motion for drag-release, respecting actual gesture velocity
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300 }}
  dragTransition={{ power: 0.3, timeConstant: 200 }} // configures the INERTIA behavior specifically for drag release
  onDragEnd={(event, info) => console.log('released with velocity:', info.velocity)}
/>
```

`info.velocity` is documented on the drag event info object — *"velocity : The current velocity of the pointer."* — so reading it in `onDragEnd` is a supported way to branch on how hard the card was flicked.

```tsx
// snap-to-grid: modify the target inertia already computed, rather than clamping afterwards
<motion.div
  drag="x"
  dragTransition={{
    power: 0,
    modifyTarget: target => Math.round(target / 50) * 50, // nearest 50px
  }}
/>
```

```tsx
// a bounded inertia value: the deceleration and the edge are configured separately
<motion.div
  drag="x"
  dragTransition={{
    min: 0,
    max: 100,
    bounceStiffness: 100, // the EDGE spring, not the deceleration
    bounceDamping: 10,
  }}
/>
```

---

## Gotchas

### ⚠️ Pitfall 1: Passing `type` to `dragTransition`
`dragTransition` is not a general transition slot. It configures the inertia animation that drag release already runs:

> *"Inertia is also the animation used for dragTransition , and can be configured via that prop."*
> — [Transitions](https://motion.dev/docs/react-transitions)

The reference's own `modifyTarget` example carries the comment `// dragTransition always type: inertia`, and the `motion` component reference agrees — *"When releasing a draggable element, an animation with type "inertia" starts. The animation is based on your dragging velocity."*

```tsx
// ❌ NOT A DOCUMENTED CONFIGURATION: dragTransition takes inertia options, not a type
dragTransition={{ type: 'tween', duration: 0.3 }}

// ✅ To tune the release: the inertia options
dragTransition={{ power: 0.3, timeConstant: 200 }}

// ✅ To remove momentum entirely: the documented switch is a different prop
<motion.div drag dragMomentum={false} />
```

⚠️ The documentation does not state what happens if you pass `type` to `dragTransition` — whether it is ignored, or type-rejected — so do not tell a reader it "falls back" to anything. Treat it as unspecified and use the two documented routes above.

### ⚠️ Pitfall 2: Tuning Inertia Boundaries With `power` and `timeConstant`
The deceleration and the boundary are two different animations. Inertia decelerates, and *"Optionally, min and max boundaries can be defined, and inertia will snap to these with a spring animation."* That boundary spring has its own options: *"If min or max is set, this affects the stiffness of the bounce spring."* (`bounceStiffness`, `Default: 500`) and *"If min or max is set, this affects the damping of the bounce spring."* (`bounceDamping`, `Default: 10`).

Changing `power` or `timeConstant` will not make the bump at the edge feel different, because the bump is not the deceleration. Conversely, raising `bounceStiffness` will not make a flick travel further — that is `power`.

### ⚠️ Pitfall 3: Passing `velocity` as an Inertia Option
`velocity` is documented under **Spring** (*"Default: Current value velocity"*, the initial velocity of the spring). The **Inertia** section of the transitions reference lists `power`, `timeConstant`, `modifyTarget`, `min`, `max`, `bounceStiffness` and `bounceDamping` — and does not list `velocity`. ⚠️ The documentation does not state whether `velocity` is accepted on an inertia transition, so treat it as unspecified. For drag release the velocity comes from the pointer anyway; if you need to branch on it, read `info.velocity` in `onDragEnd` rather than trying to feed a number back in.

### ⚠️ Pitfall 4: Snapping by Clamping the Value Instead of Modifying the Target
Because inertia computes its own destination, the clean place to snap is *before* the animation runs, not after it lands:

> *"A function that receives the automatically-calculated target and returns a new one. Useful for snapping the target to a grid."*
> — [Transitions](https://motion.dev/docs/react-transitions), `modifyTarget`

Clamping the value in an `onDrag`/`onAnimationComplete` handler produces a visible correction after the deceleration has already finished somewhere else. `modifyTarget` moves the destination, so the deceleration aims at the snapped position from the start. Setting `power: 0` alongside it — as the reference's own example does — makes the target the release point itself, snapped: paging behaviour rather than flinging.

### ⚠️ Pitfall 5: Confusing `dragElastic` With the Boundary Spring
They fire at different times and are configured in different places. During the drag, going past a constraint tugs:

> *"By default, dragging an element beyond its constraints will "tug" with some elasticity."*
> — [Drag](https://motion.dev/docs/react-drag)

That is `dragElastic`, *"which accepts a value between 0 (no movement) and 1 (full movement)"*, and it is a prop on the component. After release, the return to the boundary is the inertia bounce spring, configured inside `dragTransition`. A "rubber band that feels wrong" is one of those two, and which one depends entirely on whether the pointer is still down.

### ⚠️ Pitfall 6: Assuming Inertia Only Exists for `drag`
It is a transition type like the others — *"usually used to implement inertial scrolling"* — so it is available anywhere a transition is, including on a motion value you are animating imperatively. `dragTransition` is the convenience entry point for the common case, not the only one. That matters for custom pointer-driven surfaces (a hand-rolled carousel, a pannable canvas) where you are tracking velocity yourself and want the same deceleration model the drag gesture gets.

### ⚠️ Pitfall 7: Giving an Inertia Animation Three Keyframes
The same two-keyframe limit that applies to springs applies here — *"Only two keyframes currently supported with spring and inertia animations."* An inertia animation has a start and a computed target, and nothing in between for you to specify.

### ⚠️ Pitfall 8: Reaching for `dragMomentum={false}` When You Wanted a Shorter Slide
`dragMomentum={false}` removes the release animation entirely — the element stops the instant the pointer lifts. If what you actually wanted was "less far, settles sooner", that is `power` (how far the target lands) and `timeConstant` (how long the deceleration takes). Turning momentum off is a design decision about whether the surface is physical at all, not a tuning knob.

---

## Interview questions

**How do you tune the animation that runs when a user releases a dragged element, and what can you not change about it?**
You tune it through `dragTransition`, which takes inertia options: `power` for how far the calculated target lands, `timeConstant` for how long the deceleration takes, `modifyTarget` for snapping that target to a grid, and `min`/`max` plus `bounceStiffness`/`bounceDamping` for the boundary behaviour. What you cannot change is the *type* — drag release is always an inertia animation. If you do not want momentum at all, the documented switch is `dragMomentum={false}` on the component, not a different transition type inside `dragTransition`.

**An element with `dragConstraints` is dragged past its edge and released. Which animation is running?**
Two, in sequence, and this is the distinction people miss. Inertia decelerates the value from the release velocity; when `min`/`max` boundaries are defined, inertia snaps to them *with a spring animation*, configured by `bounceStiffness` and `bounceDamping`. So an edge bump that feels wrong is not fixed by `power` or `timeConstant` — those govern the deceleration, not the bounce. And during the drag itself, the tug past the constraint is a third thing again: `dragElastic`, a prop on the component rather than an option in the transition.

**How would you build snap-to-page from a drag gesture?**
With `modifyTarget`, not with post-hoc clamping. Inertia precalculates a target from the release velocity; `modifyTarget` receives that number and returns the one you actually want, so the deceleration aims at the snapped position from the first frame instead of correcting after it lands. Pair it with `power: 0` if you want the snap to be based on where the pointer let go rather than how hard it was flicked — that is the difference between paging and flinging, and it is one number.

**Why is inertia not just "a spring with the target further away"?**
Because the target is an output, not an input. A spring is given a destination and pulled toward it; inertia derives a destination from the initial velocity and decelerates into it, which is why `power` exists at all and why a spring has no equivalent. The two do meet: a bounded inertia animation *ends* in a spring when it reaches `min` or `max`. Knowing that boundary is where a lot of "my carousel edge feels wrong" bugs live.

**You need momentum on a custom pointer-driven surface that is not using the `drag` prop. What do you use?**
`type: 'inertia'` directly — it is a transition type like `tween` and `spring`, documented as the model for inertial scrolling generally, not as a drag-only feature. `dragTransition` is the convenience path for the built-in gesture; if you are tracking pointer velocity yourself on a motion value, you can use the same deceleration model with the same `power`, `timeConstant` and `modifyTarget` options.

**How do you read how hard a user flicked something?**
`onDragEnd` receives an event and an info object whose `velocity` field is documented as the current velocity of the pointer. That is the supported way to branch — dismiss above a threshold, snap back below it — and it is a read, not a write: the reference does not document feeding a `velocity` back into an inertia transition, so build the branch in your own handler rather than assuming you can seed the animation.

---

← [Transition types](01-timing-models.md) · [Explanations index](../README.md) · Next → [Variants](../04-variants/01-reusable-named-states.md)
