---
title: "A correct drag gesture still breaks in four environments: a click that is also a drag, an image the browser wants to drag itself, a transformed ancestor, and a touchscreen that would rather scroll"
sidebar_label: "Drag in the real DOM"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Drag animation](https://motion.dev/docs/react-drag)
> and [Gesture animation](https://motion.dev/docs/react-gestures), read from a 131-page raw mirror
> of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package. Documentation-verified;
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Drag in the real DOM

**Every failure on this page happens with correct drag props.** The gesture is configured properly
and something outside it — the browser's own click, the browser's own image dragging, an ancestor's
CSS transform, or the touchscreen's scroll — wins. Three of the four have a documented fix in
Motion; one of them is a one-attribute change in HTML. Configuring the gesture itself is
[01c](01c-drag-constraints-and-momentum.md).

| What breaks | Who is fighting you | Documented fix |
|---|---|---|
| a click fires at the end of a drag | the browser's own click, and your own handler placement | tappable **child** of a draggable parent — auto-cancelled past 3px |
| a translucent copy of an image drags away | native HTML5 drag-and-drop | `draggable={false}` on the `img` |
| the element travels further than the pointer | an ancestor `transform` | `correctParentTransform` + `MotionConfig transformPagePoint` |
| the page scrolls instead of dragging | native touch scrolling | the `touch-action` CSS rule |

## Gotchas

### ★ A drag and a click on the same element are not distinguishable by wishing
**Symptom.** A draggable tile that also has an `onClick` fires the click at the end of a drag.
**Cause and the documented mechanism.** Motion has exactly one documented rule here, and it is about
a tappable **child** of a draggable **parent**:

> *"If the tappable component is a child of a draggable component, it'll automatically cancel the tap gesture if the pointer moves further than 3 pixels during the gesture."*

**Fix — use the arrangement the rule is written for.** Put `drag` on a wrapper and the activation on a
motion child, so Motion cancels the tap for you when the pointer travels:

```tsx
// ✅ The documented arrangement: draggable parent, tappable child
<motion.div drag dragConstraints={{ left: -100, right: 100 }}>
  <motion.button onTap={handleActivate} whileTap={{ scale: 0.97 }}>
    Open
  </motion.button>
</motion.div>
```

`onTap` is the right callback for the child because it is defined as firing
*"when a pointer stops pressing the component and the pointer was released inside the component."*

**The distance check people write instead, and why it is weaker.** Deriving the click from
`onDragEnd` looks equivalent and is not:

```tsx
// ⚠️ Not the documented answer: this only ever runs if a drag gesture happened at all
<motion.div drag onDragEnd={(e, info) => { if (Math.abs(info.offset.x) < 5) handleActivate(); }}>...</motion.div>
```

The documentation does not state whether `onDragEnd` fires for a press that never crossed the pan
threshold, so a handler that lives only there is betting on undocumented behaviour for the most
common case — the plain click. Equally undocumented: whether a tap gesture on the **same** element
that carries `drag` gets the 3-pixel auto-cancel; the rule as written covers the child case. Where
the docs are silent, prefer the arrangement they describe.

### ★ A dragged `<img>` shows the browser's ghost image
**Symptom.** Dragging a card containing a photo drags a translucent copy of the photo instead.
**Cause.** Motion already opted its own element out —

> *"Draggable components will automatically set draggable="false" on their rendered HTML elements, so the browser knows not to handle drag itself."*

— but `<img>` children are still natively draggable:

> *"…children will still be actively draggable, showing the browser's default ghost image effect."*

**Fix.** *"These elements need draggable set to false to disable this ghost effect."*

```tsx
<motion.li drag>
  <img draggable={false} />
</motion.li>
```

### ★ Inside a CSS-transformed parent, the element travels the wrong distance
**Symptom.** In a scaled preview pane the dragged element runs away from the cursor, and constraints
land in the wrong place.
**Cause.** Two coordinate spaces:

> *"the pointer and the dragged element are working in different coordinate spaces."*

> *"the element will travel twice as far as the pointer."*

> *"Drag constraints and Reorder thresholds will be out by the same amount."*

**Fix.** *"Pass the transformed parent's ref to correctParentTransform"* and give the result to
`MotionConfig` as `transformPagePoint`:

```tsx
import { motion, MotionConfig, correctParentTransform } from 'motion/react';
import { useRef } from 'react';

export function Component() {
  const ref = useRef(null);

  return (
    <div ref={ref} style={{ transform: 'scale(0.5)' }}>
      <MotionConfig transformPagePoint={correctParentTransform(ref)}>
        <motion.div drag />
      </MotionConfig>
    </div>
  );
}
```

The same fix applies to `rotate` and `skew`. For an SVG `viewBox` mismatch the docs point at
`transformViewBoxPoint` instead.

### ★ That fix does **not** repair layout animations in the same scaled parent
**Symptom.** Children of an animating scaled parent animate their layout continuously, forever.
**Cause.** A different measurement path:

> *"Layout animations measure elements in screen space, and can't detect a CSS transform applied to an ancestor outside Motion."*

> *"correctParentTransform corrects the gesture but not this measurement."*

**Fix.** *"drive the parent's transform with a motion value, which Motion can account for."* — see
[motion values](../09-motion-values/01-imperative-value-tracking.md) and
[layout animations](../07-layout-animations/01-automatic-layout-transitions.md).

### ★ On touch, the browser's scroll wins unless you set `touch-action`
**Symptom.** Horizontal card swiping works on a desktop and fights the page scroll on a phone.
**Cause.** Pan and drag share the pointer with native scrolling:

> *"For pan gestures to work correctly with touch input, the element needs touch scrolling to be disabled on either x/y or both axis with the touch-action CSS rule."*

**Fix.** CSS, not props — `touch-action: pan-y` on an element you drag horizontally, `touch-action: none`
for free dragging. This is the single most common reason a drag interaction "only breaks on mobile".

## Interview questions

**★ How do you tell a click from a drag on the same element?**
Use the arrangement Motion documents rather than reconstructing it: make the draggable element a
parent and put the tap on a motion child, because a tappable child of a draggable component has its
tap gesture cancelled automatically once the pointer travels more than 3 pixels. Reading the distance
yourself in `onDragEnd` looks equivalent, but the documentation does not define whether `onDragEnd`
fires at all for a press that never crossed the 3-pixel threshold — so the plain-click case, which is
the common one, is exactly the case you would be guessing at.

**★ A horizontal swipe works on desktop and fights the page scroll on a phone. Where do you look?**
`touch-action`. The gesture and the browser's native scrolling are competing for the same pointer, and
Motion's documentation is explicit that touch scrolling has to be disabled on the relevant axis
through the CSS rule for pan gestures to work correctly with touch input. `touch-action: pan-y` on a
horizontally draggable element keeps vertical page scrolling alive while handing horizontal movement
to Motion.

**★ A dragged photo card drags a translucent copy of the photo instead. Why, and what fixes it?**
The browser's native drag-and-drop ghost image. Motion sets `draggable="false"` on the element it
renders, but that does not reach an `<img>` inside it, and images are natively draggable. Set
`draggable={false}` on the image. It is a one-attribute fix that looks like a Motion bug for as long
as you are looking in the wrong library.

**★ Drag in a scaled preview pane moves the element twice as far as the cursor. What is the fix, and what does it *not* fix?**
Pointer coordinates and the element's own coordinate space diverge under an ancestor CSS transform.
Pass the transformed parent's ref through `correctParentTransform` into `MotionConfig`'s
`transformPagePoint`, and the gesture — including constraints and Reorder thresholds — lines up
again. What it does not fix is layout animation measurement: layout animations measure in screen
space and cannot see an ancestor transform Motion does not own, so children of an animating scaled
parent keep re-measuring. For that, drive the parent's transform with a motion value instead of CSS.

---

← [Drag, constraints & momentum](01c-drag-constraints-and-momentum.md) · [Explanations](../README.md) · Next → [`AnimatePresence`](../06-animatepresence/01-exit-animations.md)
