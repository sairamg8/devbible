---
title: "Gestures: `whileHover`, `whileTap` and `whileFocus` bind a temporary animation state to a live interaction — and give you the revert for free"
sidebar_label: "Gestures"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs — [Gesture animation](https://motion.dev/docs/react-gestures),
> [Hover animation](https://motion.dev/docs/react-hover-animation) and
> [Motion component](https://motion.dev/docs/react-motion-component), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package. Documentation-verified;
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Gestures: `whileHover`/`whileTap`/`whileFocus`

**This chunk is the gesture model itself: which `while-` props exist, exactly when each gesture
counts as active, and where the two transitions of a gesture live.** Keyboard operability and
gesture propagation are in [01b](01b-gesture-accessibility-and-propagation.md); drag, constraints
and momentum are in [01c](01c-drag-constraints-and-momentum.md).

## 1. Under-The-Hood Mechanics

Gesture props bind a **temporary** style state directly to an active pointer/focus/drag interaction — automatically reverting when the interaction ends, with no manual event-handler/state-management code required at all.

```text
whileHover={{ scale: 1.05 }}   ──► applies WHILE the pointer is hovering, reverts on hover-out
whileTap={{ scale: 0.95 }}       ──► applies WHILE actively pressed/tapped, reverts on release
whileFocus={{ boxShadow: '...' }}   ──► applies WHILE the element matches the CSS
                                        :focus-visible rules — NOT on every .focus()
```

Upstream frames the whole family the same way:

> *"Motion extends React's basic set of event listeners with a simple yet powerful set of UI gestures."*

> *"Each gesture has both a set of event listeners and a while- animation prop."*

There are five `while-` animation props in total: `whileHover`, `whileTap`, `whileFocus`,
`whileDrag` (see [01c](01c-drag-constraints-and-momentum.md)) and `whileInView`
(see [scroll-linked animations](../08-scroll-linked-animations/01-scroll-reactive-motion.md)).
Pan is the one gesture with listeners and no prop:

> *"Pan doesn't currently have an associated while- prop."*

### Why Gesture Props Beat Manual Event Handlers
Implementing the equivalent of `whileHover`/`whileTap` manually would require `onMouseEnter`/`onMouseLeave`/`onMouseDown`/`onMouseUp` handlers, local state tracking "is currently hovered/pressed," and manually computing/applying the resulting style — Motion's gesture props collapse all of that boilerplate into a single declarative prop, automatically handling edge cases like a pointer leaving the element mid-press (correctly reverting the tap state) that hand-rolled handlers often get subtly wrong.

The cross-device half of that claim is the documented one. Browsers emulate hover from touch, which
is where "sticky" hover states come from:

> *"…which can cause frustrating "sticky" states on touch devices, where hover styles can persist after a user lifts their finger."*

> *"Motion provides three powerful methods to tap into hover gestures to create reliable, cross-device hover interactions that filter out these unwanted emulated events"*

— those three being `whileHover`, the `onHover` events, and the standalone `hover()` recogniser.

## 2. What each gesture actually fires

This is the table to keep in your head; almost every gesture bug is a disagreement with one row of it.

| Gesture | Active when | Listeners |
|---|---|---|
| hover | a real pointer is over the element — emulated touch hover is filtered out | `onHoverStart`, `onHoverEnd` |
| tap | the primary pointer is pressed down on the element, **or** Enter is held while it has focus | `onTapStart`, `onTap`, `onTapCancel` |
| focus | the element matches the `:focus-visible` rules | *(none documented by Motion; React's `onFocus`/`onBlur` still apply)* |
| pan | the pointer has pressed down and moved further than 3 pixels | `onPanStart`, `onPan`, `onPanEnd` |

> *"The tap gesture detects when the primary pointer (like a left click or first touch point) presses down and releases on the same component."*

> *"It will fire a tap event when the tap or click ends on the same component it started on, and a tapCancel event if the tap or click ends outside the component."*

> *"The focus gesture detects when a component gains or loses focus by the same rules as the CSS :focus-visible selector"*

> *"Typically, this is when an input receives focus by any means, and when other elements receive focus by accessible means (like via keyboard navigation)."*

Any of the props also accepts a **variant name** instead of a target object:

> *"All props can be set either as a target of values to animate to, or the name of any variants defined via the variants prop. Variants will flow down through children as normal."*

That is the bridge to [variants](../04-variants/01-reusable-named-states.md): `whileHover="hover"` on
a parent animates every descendant that defines a `hover` variant, which is how you drive an icon
inside a button from the button's own hover state.

## 3. Production-Grade Code Example

```tsx
// Hover/tap gesture props — replacing manual event-handler boilerplate
import { motion } from 'motion/react';

function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }} // also fires when Enter is held on a focused button
      whileFocus={{ boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)' }} // keyboard-accessible focus state too
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
```

```tsx
// Two transitions, one gesture: the inner one is the ENTER, the outer one is the EXIT
<motion.button
  whileHover={{
    scale: 1.1,
    transition: { duration: 0.1 }, // used when the hover STARTS
  }}
  transition={{ duration: 0.5 }}   // used when the hover ENDS
/>
```

## Gotchas

### ★ `whileFocus` follows `:focus-visible`, not "has focus"
**Symptom.** You add `whileFocus`, click the button with a mouse, and nothing happens — so you
conclude the prop is broken. Or you call `el.focus()` from code and expect the state to appear.
**Cause.** The gesture is not "this element is `document.activeElement`". The docs pin it to a CSS
selector: *"The focus gesture detects when a component gains or loses focus by the same rules as the CSS :focus-visible selector"*, and
*"Typically, this is when an input receives focus by any means, and when other elements receive focus by accessible means (like via keyboard navigation)."*
A mouse click on a button focuses it without matching `:focus-visible` in most browsers, so no
focus animation — which is the *correct* behaviour, not a bug.
**Fix.** Test `whileFocus` with the Tab key, not the mouse. For a text input the distinction mostly
disappears, since an input matches on any focus. ⚠️ Whether a **programmatic** `.focus()` call
triggers the gesture is `:focus-visible` heuristics territory; the Motion documentation does not
state it, so do not build a flow that depends on it.

### ★ The `transition` inside `whileHover` only governs the way *in*
**Symptom.** A snappy 100ms hover-in and a snappy 100ms hover-out, when you wanted a slow settle on
the way out — or the reverse, where the "slow" transition you configured applies to both.
**Cause.** Two transitions, two jobs:

> *"Transitions can be defined for when we enter a hover gesture state by setting transition within the whileHover definition."*

The component's own `transition` prop is what it animates back with — the doc's own example labels
the outer one *"Will be used when gesture ends"*.
**Fix.** The second code block above. Put the enter timing inside `whileHover`, the exit timing on
the component. See [transition types](../03-transition-types/01-timing-models.md) for what to put in
either.

### ★ `onHoverStart`/`onHoverEnd` are not `onMouseEnter`/`onMouseLeave`
**Symptom.** Hover analytics from mobile are near zero — or, if you used the native handlers,
implausibly high.
**Cause.** Motion's hover listeners deliberately ignore emulated touch hover:

> *"These events differ from the browser's native pointer event handling by only firing on devices where hover is truly possible. They explicitly won't fire as the result of a touch event."*

**Fix.** This is usually exactly what you want — just know that you are counting pointer-capable
devices only. If a touch user must also get the effect, drive it from tap or from
`whileInView`, not from hover.

### ★ Using `onHoverStart` drags in the whole `motion` component; `hover()` does not
**Symptom.** A page whose only animation is a hover highlight still ships the full motion runtime.
**Cause.** The listeners are props of the motion component:

> *"To use onHoverStart and onHoverEnd , you need to import the full motion component."*

**Fix.** For a bare hover callback with no `motion` element involved, the standalone `hover()`
function — documented as under one kilobyte — attaches to a ref and returns its own cleanup, so it
drops straight into `useEffect`:

```tsx
import { hover } from 'motion';
import { useRef, useEffect } from 'react';

function Component() {
  const ref = useRef(null);

  useEffect(() => {
    return hover(ref.current, () => {
      console.log('on hover start');
      return () => console.log('on hover end');
    });
  }, []);

  return <button ref={ref} />;
}
```

Note the shape: the start callback **returns** the end callback, and `hover()` itself returns the
teardown. What you pay for an animation, and where, is
[performance considerations](../14-performance-considerations/01-animating-efficiently.md).

### ★ Gestures do not work on SVG filter primitives
**Symptom.** `whileHover` on a `motion.feGaussianBlur` does nothing, with no error.
**Cause.** Filter elements are not rendered geometry, so they never receive pointer events:

> *"Gestures aren't recognised on SVG filter components, as these elements don't have a physical presence and therefore don't receive events."*

**Fix.** Put the gesture on a parent that *is* hit-testable and drive the filter through variants —
*"You can instead add while- props and event handlers to a parent and use variants to animate these elements."*

```tsx
const Blurrable = () => (
  <motion.svg whileHover="hover">
    <filter id="blur">
      <motion.feGaussianBlur stdDeviation={0} variants={{ hover: { stdDeviation: 2 } }} />
    </filter>
  </motion.svg>
);
```

### ★ Gesture props on a custom component are silent no-ops until a ref reaches the DOM
**Symptom.** `const MotionCard = motion.create(Card)` then `<MotionCard whileHover={{ scale: 1.05 }} />`
renders happily and never animates.
**Cause.** `motion.create()` gives your component the full prop surface — the docs list
*"animate , whileHover , drag , layout , etc."* — but Motion still has to write style to a real
element. If `Card` never accepts and attaches a `ref`, there is nothing to write to.
**Fix.** Accept and attach the ref; on **React 19.2.8** that is an ordinary prop, no `forwardRef`
needed. The full version-split treatment is in
[core concepts](../01-core-concepts/01-declarative-animation-philosophy.md).

### ⚠️ Whether `whileTap` reverts on pointer-leave is not documented
The mechanics section above says the tap state reverts "even if the pointer leaves mid-press". What
the documentation actually settles is the **event**: a release outside the component fires
`onTapCancel` rather than `onTap`. It does not state whether the `whileTap` *animation* falls back at
the moment the pointer crosses the boundary, or only when the press is released. Treat the visual
timing as unspecified and do not design an interaction around the difference. ⚠️ One movement
threshold *is* documented, and it belongs to drag — 3 pixels, covered in
[01c](01c-drag-constraints-and-momentum.md).

## Interview questions

**★ Why use `whileHover` rather than a CSS `:hover` rule, when CSS is free?**
Three reasons, and only one is about animation. First, correctness on touch: browsers emulate hover
from touch events, so a CSS `:hover` style can stick to an element after the finger has lifted;
Motion's hover gesture filters those emulated events out and only fires on devices where hover is
genuinely possible. Second, both directions in one place: the enter
transition lives inside the `whileHover` object and the exit transition on the component's own
`transition` prop, instead of being split across a base rule and a `:hover` rule. Third, composition: `whileHover` can be a variant name, so one
prop on the parent drives every child that declares that variant — CSS would need a selector per
descendant. For a static colour change on a `div`, CSS is still the right answer.

**★ Where do the two transitions of a hover animation live, and which is which?**
A `transition` written *inside* the `whileHover` object is used when the gesture starts; the
component's own `transition` prop is used when it ends. The usual production shape is a fast enter
and a slower, softer exit, because a snappy response feels responsive while a snappy retreat feels
twitchy. Getting this backwards is one of the most common reasons a hover "feels wrong" without
anyone being able to say why.

**★ `whileFocus` does nothing when you click the button. Is it broken?**
No — that is the documented behaviour. The focus gesture follows the same rules as the CSS
`:focus-visible` selector, and a mouse click on a button does not normally match `:focus-visible`.
Test it with Tab. The rule of thumb is that inputs match on any focus while other elements match only
on accessible focus, so a text field will look like it "works with the mouse" and a button will not.

**★ Why does `whileHover` on an SVG filter element do nothing?**
Filter primitives have no physical presence in the rendered output, so they never receive pointer
events, and a gesture that never starts never animates. Move the gesture to an element that is
actually hit-tested — the `motion.svg` or a shape — and drive the filter through a variant, since
variants propagate down to children that declare the same name.

**★ What is the cheapest way to run a callback on hover if you are not otherwise using Motion?**
The standalone `hover()` function imported from `motion`. `onHoverStart`/`onHoverEnd` are props of
the motion component, so using them means importing that component; `hover()` is a documented
sub-kilobyte recogniser that takes an element or a CSS selector, returns a cleanup function, and
still filters out the browser's emulated touch-hover events. Its callback returns the hover-end
callback, which makes the `useEffect` integration a one-liner.

**What happens if you pass a string to `whileHover` instead of an object?**
It is treated as a variant label. Motion looks the name up in the `variants` prop and, as with any
variant, the label flows down to children so nested `motion` elements can define their own version of
the same state. This is how a button's hover state animates an icon inside it without the icon
needing a gesture of its own.

**Which gesture has event listeners but no `while-` prop, and why does that matter?**
Pan. It is recognised once the pointer has pressed down and moved more than 3 pixels, and it exposes
`onPanStart`/`onPan`/`onPanEnd` — but there is no `whilePan`, so any visual response to a pan is
something you drive yourself, typically through a
[motion value](../09-motion-values/01-imperative-value-tracking.md). It also needs the `touch-action`
CSS rule set for touch input to behave, or the browser's own scrolling wins.

**You added `whileHover` to a `motion.create()`-wrapped design-system button and nothing moves. Where do you look?**
The ref. `motion.create()` accepts every motion prop regardless of whether the wrapped component can
be reached, so a missing or unattached `ref` fails silently: no error, no warning, no animation. On
React 19 the component just needs to take `ref` as a prop and put it on the element you want animated.

---

← [Variants](../04-variants/01-reusable-named-states.md) · [Explanations](../README.md) · Next → [Gesture accessibility and propagation](01b-gesture-accessibility-and-propagation.md)
