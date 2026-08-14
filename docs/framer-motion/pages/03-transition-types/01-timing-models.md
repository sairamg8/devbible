---
title: "Transition Types: `tween`, `spring` & `inertia`"
sidebar_label: "Transition Types"
sidebar_position: 1
---

# 🎨 Transition Types: `tween`, `spring` & `inertia`

## 1. Under-The-Hood Mechanics

Framer Motion supports three fundamentally different mathematical models for computing an animation's motion over time — each producing a genuinely different **feel**, appropriate for different kinds of UI motion.

```
tween    ──► DURATION-based — you specify how LONG the animation takes and an EASING CURVE
                shaping its rate of change; predictable, fixed-length, no physics simulation
                { type: 'tween', duration: 0.3, ease: 'easeOut' }

spring   ──► PHYSICS-based — you specify stiffness/damping/mass, and the ACTUAL DURATION
                emerges from the physics simulation itself, not specified directly;
                the DEFAULT for most value types when no transition is specified at all
                { type: 'spring', stiffness: 300, damping: 30, mass: 1 }

inertia  ──► MOMENTUM-based deceleration — used specifically for drag-release/fling gestures,
                where an element should continue moving after release, gradually decelerating,
                rather than stopping abruptly the instant the pointer is lifted
                { type: 'inertia', velocity: 50, power: 0.8 }
```

### Why Spring Is the Default
Spring physics produces motion that feels more natural and responsive for most UI interactions — critically, a spring animation is **naturally interruptible**: if a spring-animating element's target changes mid-flight (e.g. a toggle rapidly flipped), the physics simulation smoothly continues from the current velocity/position toward the new target, without an abrupt visual snap. A duration-based `tween`, if interrupted, requires more careful handling to avoid a similar snap, which is part of why spring is the sensible default for interactive, potentially-interrupted UI motion.

### `stiffness`/`damping`/`mass`: Tuning Spring Feel
- **`stiffness`** — how strongly the spring pulls toward its target (higher = faster, snappier).
- **`damping`** — how much the motion resists oscillating/overshooting (higher = less bounce, more "settled").
- **`mass`** — the simulated weight of the animating value (higher = slower to accelerate/decelerate, feels heavier).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Draggable Card Needing to Feel Like It Has Real Momentum When Flicked and Released.
A card-based interface let users drag and "flick" a card away, similar to a Tinder-style swipe interaction — using a `tween` or even a `spring` transition for the post-release motion produced an unnatural, abrupt stop the instant the pointer was released, since neither model accounts for the actual **velocity** the user's gesture had built up. Switching the drag-release transition to `inertia` (which explicitly factors in release velocity) let the card continue moving in the direction and speed of the flick, gradually decelerating — the kind of momentum-preserving motion users intuitively expect from a physical, flickable object, which neither `tween` nor `spring` alone naturally provides.

---

## 3. Production-Grade Code Example

```tsx
// tween — predictable, fixed-duration motion, appropriate for a simple, deterministic fade
<motion.div
  animate={{ opacity: 1 }}
  transition={{ type: 'tween', duration: 0.4, ease: 'easeOut' }}
/>
```

```tsx
// spring — the default, naturally-interruptible physics model, tuned for a snappy UI toggle
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
// inertia — momentum-preserving motion for drag-release, respecting actual gesture velocity
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300 }}
  dragTransition={{ power: 0.3, timeConstant: 200 }} // configures the INERTIA behavior specifically for drag release
  onDragEnd={(event, info) => console.log('released with velocity:', info.velocity)}
/>
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `duration` With a `spring` Transition, Expecting It to Work Like `tween`
```tsx
// ❌ IGNORED: spring transitions compute their ACTUAL duration from the physics simulation
// itself (stiffness/damping/mass) — passing `duration` alongside `type: 'spring'` is
// either ignored or produces confusing, unintuitive results, since duration isn't a
// direct input to how spring physics work
transition={{ type: 'spring', duration: 0.3 }}, // duration doesn't control spring the way you'd expect

// ✅ CORRECT: for springs, tune stiffness/damping/mass to shape the FEEL and IMPLICIT duration;
// use tween specifically when an EXACT, predictable duration is what's actually needed
transition={{ type: 'spring', stiffness: 300, damping: 30 }}, // duration EMERGES from these values
```

### ⚠️ Pitfall 2: Using `tween` for Drag-Release Motion, Losing the Natural Momentum Feel
```tsx
// ❌ UNNATURAL: a fixed-duration tween for drag release ignores the ACTUAL velocity the
// user's gesture had — the card stops with the same fixed timing regardless of whether
// it was flicked hard or barely nudged, feeling disconnected from the actual gesture
dragTransition={{ type: 'tween', duration: 0.3 }}, // ignores real gesture velocity entirely

// ✅ CORRECT: inertia (Motion's default for drag release) naturally incorporates velocity
dragTransition={{ power: 0.3, timeConstant: 200 }}, // the actual inertia-tuning parameters
```

### ⚠️ Pitfall 3: Over-Bouncy Spring Settings on Content Users Read/Interact With Precisely
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
