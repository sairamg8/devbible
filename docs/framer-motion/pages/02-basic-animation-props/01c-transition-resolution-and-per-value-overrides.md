---
title: "The `transition` prop is a default that gets REPLACED rather than merged, and Motion's per-value-type defaults are usually better than the one you are about to write"
sidebar_label: "01c · Transition resolution"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs — [React transitions](https://motion.dev/docs/react-transitions),
> [Motion component](https://motion.dev/docs/react-motion-component) (the `transition` prop
> reference) and [React animation](https://motion.dev/docs/react-animation), read from a
> 131-page raw mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly
> `framer-motion`) on **React 19.2.8** — React version probed on the installed package.
> Documentation-verified; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**A `transition` object looks like CSS's `transition` shorthand and behaves nothing like it.
It is a *default* — consulted only where an animation prop has not defined its own — and when
a more specific one exists it does not merge, it replaces. Two consequences follow, and both
are things people discover by accident: a `MotionConfig` `duration` that appears to be
ignored, and an `opacity` fade that inexplicably bounces.** This chunk is where a transition
can be declared, which one wins, and what you throw away by declaring one at all.

## What the prop actually is

> *"The default transition for this component to use when an animation prop"* … *"has no transition defined."* —
> [Motion component](https://motion.dev/docs/react-motion-component)

The elided words are the parenthetical listing `animate`, `whileHover` and the rest. That
list is the first surprise: a component-level `transition` governs **every** animation prop on
that element, not just `animate`. The second is that it is a *default*, which is a different
thing from a *setting*.

### The four places a transition can be declared

| Specificity | Where | Scope |
|---|---|---|
| lowest | `MotionConfig transition={...}` | every `motion` component in the subtree |
| ↓ | the `transition` prop on a component | every animation prop on that component |
| ↓ | a `transition` key inside an animation target | that target only |
| highest | a per-value key inside a transition object | one animated value |

> *"transition can be set on any animation prop, and that transition will be used when the animation fires."* —
> [React transitions](https://motion.dev/docs/react-transitions)

### Per-Property Transition Overrides
```tsx
<motion.div
  animate={{ opacity: 1, x: 0 }}
  transition={{
    opacity: { duration: 0.2 },       // opacity animates over 200ms
    x: { type: 'spring', stiffness: 300 }, // x uses SPRING physics instead, independently configured
  }}
/>
```
Different properties animating with genuinely different timing/easing characteristics (a fade using a simple duration-based tween, alongside a position change using bouncier spring physics) is expressed by nesting per-property transition configs, rather than being forced into one single, compromise timing model for the whole animation.

```tsx
// Per-property transition overrides — different timing models for different properties
function Modal({ isVisible }: { isVisible: boolean }) {
  return (
    <motion.div
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
      transition={{
        opacity: { duration: 0.15 }, // fast, simple fade
        scale: { type: 'spring', stiffness: 400, damping: 30 }, // bouncier, physics-based scale
      }}
    >
      <ModalContent />
    </motion.div>
  );
}
```

### ⚠️ Pitfall 3: Using One Global `transition` When Properties Genuinely Need Different Timing
```tsx
// ❌ SUBOPTIMAL: forcing opacity and a spring-appropriate transform into the SAME
// single transition config often produces a result where NEITHER property's timing
// actually looks right — a spring's bounce and a fade's linear feel work best independently
<motion.div animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300 }} /> // opacity ALSO springs, often looking odd

// ✅ CORRECT: use per-property transition overrides when properties have genuinely
// different ideal timing characteristics
<motion.div animate={{ opacity: 1, scale: 1 }} transition={{ opacity: { duration: 0.2 }, scale: { type: 'spring' } }} />
```

## Gotchas

**★ A single global `transition` throws away a per-value-type default that was already correct.**
Pitfall 3 says opacity "also springs" and looks odd. The reason it looks odd is that Motion
was already animating each value with a model chosen for that value:

> *"By default, Motion will create appropriate transitions for snappy animations based on the type of value being animated."* —
> [React animation](https://motion.dev/docs/react-animation)

The doc's own gloss on that is that physical properties like `x` or `scale` are animated with
spring physics, whereas values like `opacity` or `color` are animated with duration-based
easing curves. Writing `transition={{ type: 'spring' }}` at the component level does not
*add* configuration — it **replaces** that per-value dispatch with one model for everything.
🔴 Very often the correct edit to a transition that feels wrong is to delete it.

**★ A more specific transition REPLACES the less specific one; it does not merge into it.**
This is the trap that produces "my `MotionConfig` duration is being ignored":

```tsx
<MotionConfig transition={{ duration: 1, ease: 'linear' }}>
  <motion.div animate={{ x: 100 }} transition={{ ease: 'easeInOut' }} />
</MotionConfig>
```

> *"By default, transitions of higher specificity will replace default transitions."* —
> [React transitions](https://motion.dev/docs/react-transitions)

and the docs spell out the result for exactly this snippet: *"In this above example, x will
animate with the default duration of 0.3"* — not 1. The component transition replaced the
`MotionConfig` one wholesale, so `duration` fell back to the library default. Opt into
merging with `inherit`:

```tsx
<MotionConfig transition={{ duration: 1, ease: 'linear' }}>
  <motion.div
    animate={{ x: 100 }}
    transition={{ inherit: true, ease: 'easeInOut' }} // duration: 1 now inherited
  />
</MotionConfig>
```

> *"By setting inherit: true , a transition will inherit values from transitions with lower specificity."* —
> [React transitions](https://motion.dev/docs/react-transitions)

`inherit` works for per-value transitions too, which is the only way to say "keep the shared
duration, change only this value's easing".

**★ The component-level `transition` also governs `whileHover`, `whileTap` and `whileDrag`.**
It is a default for *any* animation prop that has not defined its own, and the prop reference
names `whileHover` alongside `animate` when it says so. A component-level
`transition={{ duration: 2 }}` chosen for a deliberate entrance therefore also makes every
hover on that element take two seconds. Scope the slow one to the target that needs it:

```tsx
<motion.div
  animate={{ opacity: 1 }}
  whileHover={{ opacity: 0.7, transition: { duration: 0.3 } }} // hover only
  transition={{ duration: 0.5 }}                               // everything else
/>
```

The docs' own version of this example carries the comment
*"Specific transitions override default transitions"* on the inner one.

**★ Per-value transitions only cover the values they name — use `default` for the rest.**
The `transition={{ opacity: {...}, x: {...} }}` form above is correct, but it configures
exactly those two values; anything else in the target silently keeps the library default.
The documented way to say "spring for everything, linear for opacity" is the `default` key:

```tsx
<motion.li
  animate={{
    x: 0,
    opacity: 1,
    transition: {
      default: { type: 'spring' },
      opacity: { ease: 'linear' },
    },
  }}
/>
```

> *"When animating multiple values, each value can be animated with a different transition, with default handling all other values:"* —
> [React transitions](https://motion.dev/docs/react-transitions)

**★ Setting `stiffness`, `damping` or `mass` silently overrides `duration` and `bounce`.**
The transitions reference carries this as an explicit note: `bounce` and `duration` are
overridden when any of `stiffness`, `damping` or `mass` are set. A
`transition={{ type: 'spring', duration: 0.3, stiffness: 400 }}` therefore does not run for
0.3s — the physics decides the length and the `duration` you wrote does nothing at all. The
documentation does not state whether Motion warns about the conflict, so do not count on
being told. Springs have two mutually exclusive parameterisations in this API:
physics-based (`stiffness` / `damping` / `mass`) and duration-based (`duration` + `bounce`).
Pick one per transition object.

**★ `duration` has two different defaults depending on how many keyframes you passed.**
The reference gives `duration` as *"Default: 0.3 (or 0.8 if multiple keyframes are
defined)"*. So the same `transition={{ ease: 'easeOut' }}` produces a 0.3s animation for
`animate={{ x: 100 }}` and a 0.8s one for `animate={{ x: [0, 100, 0] }}`. When a keyframe
version of an animation suddenly feels sluggish next to its single-value sibling, this is
why — set `duration` explicitly rather than assuming it carried over.

**★ `type` is not a fixed default you can memorise — the reference says "Dynamic".**
The `type` option's documented default is literally *Dynamic*, meaning Motion chooses per
value. Statements of the form "spring is the default in Motion" are close enough to be
useful and wrong often enough to burn you: `opacity` and colours get duration-based easing
curves, not a spring. If you need to know what a specific value will do when you say nothing,
the rule is the value's own category, not a single library-wide default.

**★ `ease` is documented as a tween option, so pairing it with a spring buys you nothing.**
`ease` is described as *"The easing function to use with tween animations."* A transition
that says `{ type: 'spring', ease: 'easeInOut' }` is not a blend of the two models: a physics
spring computes position from stiffness, damping, mass and current velocity, so there is no
progress curve for an easing function to shape. ⚠️ The documentation states what `ease`
applies to but does not state what happens when it is set on a spring, so treat the exact
behaviour as unspecified and simply do not write it. The named curves that *are* accepted for
a tween are `"linear"`, `"easeIn"` / `"easeOut"` / `"easeInOut"`, `"circIn"` / `"circOut"` /
`"circInOut"`, `"backIn"` / `"backOut"` / `"backInOut"` and `"anticipate"`, plus a four-number
cubic bezier array or your own function.

## Interview questions

**★ You set `transition={{ duration: 1 }}` on a `MotionConfig` and `transition={{ ease: 'easeInOut' }}` on a child. How long does the child's animation take?**
0.3 seconds — the library default — not 1. Transitions of higher specificity **replace**
lower-specificity ones rather than merging with them, so the child's object is the whole
transition and it contains no `duration`. Adding `inherit: true` to the child's transition
changes that: it then inherits the values it does not itself define, and the animation runs
for 1 second with `easeInOut`. The mental model to carry away is CSS-cascade-like specificity
with **no** property-level cascade — the winner is an object, not a merged set of
declarations.

**★ When is the right answer to a transition that feels wrong to delete the `transition` prop?**
Whenever a single object is being applied to values that want different models. Motion's
default is not one global curve — it dispatches on the type of the value, giving physical
properties like `x` and `scale` spring physics and values like `opacity` and colour
duration-based easing. A hand-written `transition={{ type: 'spring', stiffness: 300 }}`
overrides that dispatch for every value in the target, which is how an opacity fade ends up
bouncing. Deleting it restores per-value defaults; if you genuinely need control, use
value-specific transitions with a `default` key rather than one object for everything.

**★ Where can a `transition` be declared, and what is the resolution order?**
Four places, from least to most specific: a `MotionConfig` wrapping a subtree; the
`transition` prop on the component; a `transition` key inside a specific animation target
such as `whileHover`; and a per-value entry inside a transition object. The most specific one
that applies wins, and it replaces rather than merges — unless it sets `inherit: true`, in
which case it inherits the values it does not define. The component-level `transition` prop
is a default for *every* animation prop on that component, so it also governs hover, tap and
drag animations, which is the part people miss.

**★ What is the difference between putting `transition` on the component and putting it inside the `animate` object?**
Scope. On the component it is a default for every animation prop that does not define its
own transition — `animate`, `whileHover`, `whileTap` and the rest. Inside a target object it
applies only when that particular target fires. The practical use is a component whose
resting animation is slow and deliberate but whose hover feedback must be immediate: put the
slow transition on the component, and a fast one inside `whileHover`.

**★ A colleague's spring is `{ type: 'spring', duration: 0.4, stiffness: 300, damping: 20 }`. What will it actually do?**
It will run as a pure physics spring; `duration` is discarded. The reference states that
`bounce` and `duration` are overridden when `stiffness`, `damping` or `mass` are set. Nothing
warns you, so the usual sequence is that someone tunes `duration` for a while, sees no
change, and concludes the library is broken. If a timed spring is what they wanted, the
supported form is `duration` with `bounce` (or `visualDuration` with `bounce`), and the
stiffness/damping/mass triple has to come out.

**★ Someone asks why `opacity` "isn't respecting" the spring they set on the parent `MotionConfig`. What are you checking?**
Whether it is respecting it perfectly and that is the problem. A `MotionConfig` spring
applies to every value in the subtree, including opacity — which is exactly the thing that
should not spring. So the symptom "the fade looks wobbly" and the symptom "my transition is
ignored" have opposite causes and are worth distinguishing before touching anything. If it
genuinely is being ignored, look for a more specific `transition` on the component or inside
a target, which replaces the `MotionConfig` one entirely.

---

← [exit and AnimatePresence](01b-exit-and-animatepresence.md) · [Explanations](../README.md) · Next → [Transition types](../03-transition-types/01-timing-models.md)
