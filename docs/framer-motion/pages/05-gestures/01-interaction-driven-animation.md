---
title: "Gestures: `whileHover`/`whileTap`/`whileFocus`, `drag` & Constraints"
sidebar_label: "Gestures"
sidebar_position: 1
---

# 🎨 Gestures: `whileHover`/`whileTap`/`whileFocus`, `drag` & Constraints

## 1. Under-The-Hood Mechanics

Gesture props bind a **temporary** style state directly to an active pointer/focus/drag interaction — automatically reverting when the interaction ends, with no manual event-handler/state-management code required at all.

```
whileHover={{ scale: 1.05 }}   ──► applies WHILE the pointer is hovering, reverts on hover-out
whileTap={{ scale: 0.95 }}       ──► applies WHILE actively pressed/tapped, reverts on release
whileFocus={{ boxShadow: '...' }}   ──► applies WHILE the element has keyboard/programmatic focus

drag / drag="x" / drag="y"            ──► enables FREE or AXIS-CONSTRAINED dragging
  dragConstraints={{ left, right, top, bottom }}  ──► bounds the draggable area
  dragElastic={0.2}                                     ──► how much the element can be dragged
                                                             PAST its constraints, with resistance
  dragMomentum={true}                                       ──► whether releasing mid-drag continues
                                                                    with inertia (see the transition types doc)
```

### Why Gesture Props Beat Manual Event Handlers
Implementing the equivalent of `whileHover`/`whileTap` manually would require `onMouseEnter`/`onMouseLeave`/`onMouseDown`/`onMouseUp` handlers, local state tracking "is currently hovered/pressed," and manually computing/applying the resulting style — Motion's gesture props collapse all of that boilerplate into a single declarative prop, automatically handling edge cases like a pointer leaving the element mid-press (correctly reverting the tap state) that hand-rolled handlers often get subtly wrong.

### `dragConstraints`/`dragElastic`: Bounded, Resistant Dragging
`dragConstraints` defines a rectangular boundary the draggable element cannot move beyond (by default, an absolute hard stop) — `dragElastic` (a 0-1 value) allows dragging **past** that boundary with progressively increasing resistance, producing the familiar "rubber-band" feel of dragging past a scrollable list's end, rather than an abrupt hard stop.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Swipeable Card Stack With Correctly-Bounded, Elastic Drag Behavior.
A card-swiping interface (approve/reject style) needed cards to be draggable horizontally, with a rubber-band resistance effect near the edges of the swipe zone (rather than an abrupt stop), and correct momentum-based continuation if a card was flicked rather than slowly dragged. Combining `drag="x"` (constraining drag to the horizontal axis only), `dragConstraints` (defining the swipe zone bounds), `dragElastic={0.3}` (allowing some past-boundary give with resistance), and `dragMomentum={true}` (preserving flick velocity via inertia) produced the full desired interaction entirely through declarative props — no manual pointer-event tracking or physics calculation code needed anywhere in the component.

---

## 3. Production-Grade Code Example

```tsx
// Hover/tap gesture props — replacing manual event-handler boilerplate
import { motion } from 'motion/react';

function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }} // automatically reverts even if the pointer leaves mid-press
      whileFocus={{ boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)' }} // keyboard-accessible focus state too
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
```

```tsx
// A swipeable card with bounded, elastic drag and momentum-preserving release
function SwipeableCard({ onSwipeAway }: { onSwipeAway: () => void }) {
  return (
    <motion.div
      drag="x" // constrained to horizontal dragging only
      dragConstraints={{ left: -150, right: 150 }}
      dragElastic={0.3} // some rubber-band give PAST the constraints, with resistance
      dragMomentum={true} // preserves flick velocity on release (inertia transition, see transition types doc)
      onDragEnd={(event, info) => {
        if (Math.abs(info.offset.x) > 100) onSwipeAway(); // swiped far enough — trigger the action
      }}
    >
      <CardContent />
    </motion.div>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `whileFocus` for Keyboard-Only Accessibility
```tsx
// ❌ INCOMPLETE: whileHover/whileTap alone provide NO visual feedback for keyboard-only
// users tabbing through interactive elements — a genuine accessibility gap
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Submit</motion.button>

// ✅ CORRECT: whileFocus ensures keyboard navigation gets equivalent visual feedback
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} whileFocus={{ scale: 1.05 }}>Submit</motion.button>
```

### ⚠️ Pitfall 2: Enabling `drag` Without `dragConstraints`, Letting Elements Drag Anywhere Indefinitely
```tsx
// ❌ RISKY: unconstrained drag lets a user drag an element completely off-screen, or
// overlapping content it was never meant to obscure, with no way to recover it
<motion.div drag>...</motion.div> // no constraints — can be dragged ANYWHERE, indefinitely

// ✅ CORRECT: constrain drag to a sensible, bounded area matching the actual interaction design
<motion.div drag dragConstraints={{ left: -100, right: 100, top: 0, bottom: 0 }}>...</motion.div>
```

### ⚠️ Pitfall 3: Combining `drag` on an Element That Also Needs Normal Click Behavior, Without Distinguishing Them
```tsx
// ❌ RISKY: a draggable element that ALSO has an onClick handler can trigger the click
// handler UNINTENTIONALLY at the end of a drag gesture (a small drag distance can register
// as a "click" too), causing confusing double-behavior
<motion.div drag onClick={handleClick}>...</motion.div> // drag release might ALSO fire handleClick

// ✅ CORRECT: distinguish a genuine tap from a drag by checking the drag distance/velocity
// in onDragEnd, or use onTap (a Motion-provided gesture-aware tap handler) instead of a plain onClick
<motion.div drag onDragEnd={(e, info) => { if (Math.abs(info.offset.x) < 5) handleClick(); }}>...</motion.div>
```
