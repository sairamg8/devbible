---
title: "Drag: constraints are elastic by default and releasing is a throw, not a stop — every default in this gesture is an opinion you did not write"
sidebar_label: "Drag, constraints & momentum"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Drag animation](https://motion.dev/docs/react-drag),
> [Gesture animation](https://motion.dev/docs/react-gestures),
> [Motion component](https://motion.dev/docs/react-motion-component) and
> [useDragControls](https://motion.dev/docs/react-use-drag-controls), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package. Documentation-verified;
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Drag, constraints and momentum

**Drag is the one gesture with physics, and every default in it is opinionated.** Constraints tug
rather than stop, release throws rather than parks, and the movement threshold that separates a press
from a drag is a documented 3 pixels. The rest of the gesture family is in
[01](01-interaction-driven-animation.md) and [01b](01b-gesture-accessibility-and-propagation.md); the four
environments that break an otherwise-correct drag — clicks, images, transformed parents and touch —
are in [01d](01d-drag-in-the-real-dom.md).

## 1. Under-The-Hood Mechanics

```text
drag / drag="x" / drag="y"            ──► enables FREE or AXIS-CONSTRAINED dragging
  dragConstraints={{ left, right, top, bottom }}  ──► bounds the draggable area (px, or a ref)
  dragElastic={0.2}                                     ──► how much the element can be dragged
                                                             PAST its constraints — DEFAULT 0.5,
                                                             i.e. elastic unless you say otherwise
  dragMomentum={true}                                       ──► whether releasing mid-drag continues
                                                                    with inertia — DEFAULT true
                                                                    (see the transition types doc)
```

> *"The drag gesture applies pointer movement to the x and/or y axis of the component."*

> *"The simplest way to make a component draggable is to add the drag prop to a motion component."*

Drag is built on pan, and pan has a threshold — which is where the "was that a click or a drag?"
question comes from:

> *"The pan gesture recognises when a pointer presses down on a component and moves further than 3 pixels."*

`whileDrag` completes the `while-` family for this gesture:

> *"You can animate to an animation state while an element is being dragged using the whileDrag prop."*

> *"When it ends, it will animate back to its default animate state."*

> *"This is great for creating a "lift" effect, for instance by increasing the element's scale and adding a box shadow."*

⚠️ Motion's drag is **not** the HTML5 drag-and-drop API and does not replace all of it. Upstream is
candid: browsers' native API *"…it can be challenging to create a pleasant experience, with an odd "ghost image" effect"* — but
*"it also contains native dropzone functionality - which isn't yet in Motion."* If you need
drop targets with `dataTransfer`, Motion is not that library.

### `dragConstraints`/`dragElastic`: Bounded, Resistant Dragging
`dragConstraints` defines a rectangular boundary for the draggable element — an object of `top`,
`left`, `right` and `bottom` values in pixels, or a `ref` to another element whose bounding box
becomes the boundary. 🔴 **It is not a hard stop by default.**

> *"By default, dragging an element beyond its constraints will "tug" with some elasticity."*

> *"You can change this behavior with the dragElastic prop, which accepts a value between 0 (no movement) and 1 (full movement)."*

> *"The degree of movement allowed outside constraints. 0 = no movement, 1 = full movement."*

> *"Set to 0.5 by default. Can also be set as false to disable movement."*

So the familiar rubber-band feel is what you get for free; `dragElastic={0}` (or `false`) is what you
write when you want the abrupt stop. `dragElastic` also accepts an object of `top`/`right`/`bottom`/`left`
to set the give per edge, with any edge you omit treated as `0`.

Ref-based constraints are the form to reach for when the boundary is a real element:

> *"For more dynamic constraints, you can pass a ref to another component. The draggable element will then be constrained to the bounding box of that element."*

```tsx
import { motion } from 'motion/react';
import { useRef } from 'react';

export function DragContainer() {
  const constraintsRef = useRef(null);

  return (
    <motion.div ref={constraintsRef} style={{ width: 300, height: 200 }}>
      <motion.div drag dragConstraints={constraintsRef} />
    </motion.div>
  );
}
```

### Release is a throw, not a stop

> *"By default, when a user releases a draggable element, it has momentum"*

> *"Apply momentum from the pan gesture to the component when dragging finishes. Set to true by default."*

> *"When releasing a draggable element, an animation with type "inertia" starts. The animation is based on your dragging velocity."*

That inertia animation is configurable through `dragTransition` (`bounceStiffness`, `bounceDamping`),
and switchable off with `dragMomentum={false}`. Two other release behaviours are worth knowing:
`dragSnapToOrigin` (default `false`), where *"the draggable element will animate back to its center/origin when released."*,
and `dragDirectionLock` (default `false`), which *"Locks drag direction into the soonest detected direction."*

## 2. Real-World Engineering Scenario

**Scenario**: A Swipeable Card Stack With Correctly-Bounded, Elastic Drag Behavior.
A card-swiping interface (approve/reject style) needed cards to be draggable horizontally, with a rubber-band resistance effect near the edges of the swipe zone (rather than an abrupt stop), and correct momentum-based continuation if a card was flicked rather than slowly dragged. Combining `drag="x"` (constraining drag to the horizontal axis only), `dragConstraints` (defining the swipe zone bounds), `dragElastic={0.3}` (allowing some past-boundary give with resistance), and `dragMomentum={true}` (preserving flick velocity via inertia) produced the full desired interaction entirely through declarative props — no manual pointer-event tracking or physics calculation code needed anywhere in the component.

⚠️ Two of those four props are being set to values Motion would have chosen anyway or nearly so:
`dragMomentum` is `true` by default, and `dragElastic` is `0.5` by default, so `0.3` is a
**tightening**, not an enabling. Writing them explicitly is defensible as documentation-in-code;
believing they are what switched the behaviour on is the misreading this chunk exists to prevent.

## 3. Production-Grade Code Example

```tsx
// A swipeable card with bounded, elastic drag and momentum-preserving release
function SwipeableCard({ onSwipeAway }: { onSwipeAway: () => void }) {
  return (
    <motion.div
      drag="x" // constrained to horizontal dragging only
      dragConstraints={{ left: -150, right: 150 }}
      dragElastic={0.3} // TIGHTER than the 0.5 default: less give past the constraints
      dragMomentum={true} // the default; release throws with an inertia animation
      dragSnapToOrigin // brings a not-swiped card home — see the gotcha on combining it with momentum
      whileDrag={{ scale: 1.05, boxShadow: '0px 10px 20px rgba(0,0,0,0.2)' }} // the "lift"
      onDragEnd={(event, info) => {
        if (Math.abs(info.offset.x) > 100) onSwipeAway(); // swiped far enough — trigger the action
      }}
    >
      <CardContent />
    </motion.div>
  );
}
```

Every drag callback receives the original `PointerEvent` plus an `info` object with four `x`/`y`
pairs — `point`, `delta`, `offset` and `velocity`. `offset` is the one a swipe threshold wants; the
drag guide calls it *"The distance from the element's origin."* and the component reference calls it
*"Distance from the original event."* — the same measurement described from two ends. `point` is
absolute and will not give you a threshold.

## Gotchas

### 🔴 ★ Constraints are elastic by default — `dragElastic` does not *enable* the rubber band
**Symptom.** A design review says the card "escapes" its box, and the code review finds nothing
wrong: constraints are set, the numbers are right.
**Cause.** The documented default is `dragElastic: 0.5`, and *"By default, dragging an element beyond its constraints will "tug" with some elasticity."*
Nothing you wrote turned that on. This is the exact inversion this page was corrected for: a
constraint is a *soft* boundary until you say otherwise.
**Fix.** `dragElastic={0}` for a hard stop, or `dragElastic={false}` to disable the movement
entirely. Per-edge give is an object:

```tsx
<motion.div drag dragConstraints={{ left: 0, right: 300 }} dragElastic={0} />          {/* hard stop */}
<motion.div drag dragConstraints={{ left: 0, right: 300 }} dragElastic={{ right: 0.2 }} /> {/* give on one edge only; omitted edges are 0 */}
```

### ⚠️ Pitfall 2: Enabling `drag` Without `dragConstraints`, Letting Elements Drag Anywhere Indefinitely
```tsx
// ❌ RISKY: unconstrained drag lets a user drag an element completely off-screen, or
// overlapping content it was never meant to obscure, with no way to recover it
<motion.div drag>...</motion.div> // no constraints — can be dragged ANYWHERE, indefinitely

// ✅ CORRECT: constrain drag to a sensible, bounded area matching the actual interaction design
<motion.div drag dragConstraints={{ left: -100, right: 100, top: 0, bottom: 0 }}>...</motion.div>
```

⚠️ Reinforcing the gotcha above: constraints alone still allow elastic overshoot during the gesture.
Add `dragElastic={0}` if "bounded" has to mean *bounded*, and `dragSnapToOrigin` if the element must
end up somewhere specific.

### ★ Nested draggables need `dragPropagation`, and the docs give you one sentence about it
**Symptom.** A draggable handle inside a draggable panel moves one of the two, and never both.
**Cause.** `dragPropagation` exists for exactly this and defaults to `false` —
*"Allows drag gesture propagation to child components."*
**Fix.** Set `dragPropagation` on the nested arrangement and test it. ⚠️ Be honest about what is
documented: that one sentence and the default are all the reference gives. It does not spell out
which element you set the prop on, or which direction of propagation is unblocked, so verify the
behaviour in your own layout rather than reasoning it out from the name. In most designs the cleaner
answer is not nesting draggables at all — one draggable element plus `dragControls`, below.

### ★ Dragging from a handle needs `dragControls` **and** `dragListener={false}`
**Symptom.** A scrubber can be dragged both by its track and by grabbing the handle itself, and the
two disagree.
**Cause.** `dragControls` adds an initiation path; it does not remove the default one.
*"Determines whether to trigger the drag gesture from event listeners."* is what `dragListener`
controls, and the docs say plainly that with `dragControls` you can disable the element as initiator.
**Fix.** Both props together — and note `snapToCursor`, which is what makes a scrubber jump to where
you clicked:

```tsx
import { motion, useDragControls } from 'motion/react';

export function Scrubber() {
  const dragControls = useDragControls();

  function startDrag(event) {
    dragControls.start(event, { snapToCursor: true }); // start the gesture imperatively
  }

  return (
    <>
      <div onPointerDown={startDrag} className="scrubber-track" />
      <motion.div
        drag="x"
        dragControls={dragControls}
        dragListener={false} // disable the default drag handler
        className="scrubber-handle"
      />
    </>
  );
}
```

### ★ `drag="x"` and `dragDirectionLock` are not the same decision
**Symptom.** A carousel that should allow vertical page scrolling refuses to scroll while the finger
is on a card.
**Cause.** `drag="x"` fixes the axis for the lifetime of the component; `dragDirectionLock` decides at
gesture time — *"Locks drag direction into the soonest detected direction."* — so a mostly-vertical
movement locks to `y` and a mostly-horizontal one to `x`.
**Fix.** Use direction lock when the same element must serve two gestures, and pair it with
`onDirectionLock` if the UI needs to know which one won.

### ⚠️ When ref-based constraints are re-measured is not documented
The docs say a `ref` constraint uses that element's bounding box, but not when the box is read, nor
what happens if the container resizes or reflows mid-session. Treat re-measurement on resize as
unspecified: if your layout is fluid, verify the behaviour you need rather than assuming, and fall
back to pixel constraints you compute yourself if it matters.

### ⚠️ How `dragSnapToOrigin` and `dragMomentum` interact is not documented
Both describe what happens on release — one throws with inertia, the other animates back to the
origin. The documentation does not state which wins when both are enabled, or whether the snap
follows the throw. If your interaction depends on the combination, pick one behaviour explicitly
rather than relying on the pair.

## Interview questions

**★ Your card has `dragConstraints` and still visibly leaves the box. What is happening?**
Nothing is broken — that is the default. `dragElastic` defaults to `0.5`, and dragging beyond the
constraints tugs with elasticity rather than stopping dead. A constraint in Motion is a soft boundary
plus a spring back, not a wall. If you want the wall, set `dragElastic={0}`, or `false` to disable the
outside-constraint movement entirely. The reason this catches people is that the prop *reads* like it
enables elasticity, when what it actually does is tune an elasticity that is already on.

**★ What happens the instant a user lets go of a draggable element?**
An inertia animation starts, based on the pointer's velocity at release — that is `dragMomentum`,
which is `true` by default. It is a throw, not a stop, which is why a flicked card keeps travelling
and a slowly-released one barely moves. You tune the physics with `dragTransition`
(`bounceStiffness`, `bounceDamping`), switch it off with `dragMomentum={false}`, or override the whole
question with `dragSnapToOrigin`, which animates the element back to where it started.

**★ Which `info` field do you threshold a swipe on, and why not `point`?**
`offset` — the distance from where the gesture started, described in the drag guide as the distance
from the element's origin and in the component reference as the distance from the original event.
`point` is the pointer's current position relative to the device or page, so a threshold on it means
something different depending on where the element sits on screen. `velocity` is the other useful
one: a short, fast flick and a long, slow drag can both be intentional swipes, and testing both
offset and velocity is how a card stack stops feeling picky.

**When do you need `dragControls`, and what must you pair it with?**
When the gesture starts somewhere other than the element that moves — a handle, a scrubber track, a
row grip in a reorderable list. `useDragControls` gives you a `start` method you call from a pointer
event on that other element. Pair it with `dragListener={false}`, otherwise the draggable element
keeps its own initiation path and you have two ways to start the same gesture. `start` also takes
`{ snapToCursor: true }`, which is what makes a scrubber jump to the point you clicked.

**Is Motion's `drag` a replacement for the HTML5 drag-and-drop API?**
Not entirely, and upstream says so: the native API brings dropzone functionality that Motion does not
yet have. Motion's drag is better for the *feel* — no ghost image, momentum, elastic constraints,
direction locking, imperative control — and it is the right choice for sliders, sheets, reorderable
lists and swipe cards. If you need real drop targets with `dataTransfer` semantics, including drags
between windows, that is still the platform API's job.

---

← [Gesture accessibility & propagation](01b-gesture-accessibility-and-propagation.md) · [Explanations](../README.md) · Next → [Drag in the real DOM](01d-drag-in-the-real-dom.md)
