---
title: "Keyframes: Array Syntax & The `times` Array"
sidebar_label: "Keyframes"
sidebar_position: 1
---

# 🎨 Keyframes: Array Syntax & The `times` Array

## 1. Under-The-Hood Mechanics

Passing an **array** as an `animate` property's value expresses a multi-step keyframe animation in a single, compact declaration — the value passes through every array element in sequence, rather than animating directly from the current value to just one target.

```typescript
animate={{ x: [0, 100, 0] }}
//              │    │   │
//              │    │   └── returns to 0 at the END
//              │    └── passes through 100 in the MIDDLE
//              └── starts at 0

// By default, keyframes are spaced EVENLY across the total duration — for [0, 100, 0]
// over a 1s duration, x=100 is reached at exactly the 0.5s midpoint
```

### `times`: Controlling Exactly When Each Keyframe Occurs
```typescript
animate={{ x: [0, 100, 100, 0] }}
transition={{ duration: 2, times: [0, 0.2, 0.8, 1] }}
//                          │     │    │    │
//                          │     │    │    └── keyframe 4 (x=0) at 100% of duration (t=2s)
//                          │     │    └── keyframe 3 (x=100) STILL at 80% (t=1.6s) — HOLDS there
//                          │     └── keyframe 2 (x=100) reached QUICKLY, at 20% (t=0.4s)
//                          └── keyframe 1 (x=0) at 0% (t=0, the start)
```
Without `times`, the four keyframes above would be evenly spaced at 0%, 33%, 66%, 100% — `times` lets you express "reach 100 quickly, then HOLD there for a while, then return" — a genuinely different, more deliberately-paced motion than uniform spacing would produce.

---

## 2. Real-World Engineering Scenario

**Scenario**: A "Pulse" Notification Badge Needing to Quickly Scale Up, Hold Briefly, Then Settle Back — Not a Uniform Back-and-Forth.
A notification badge needed to draw attention with a pulse effect — scaling up quickly, holding at the larger size briefly (long enough to actually register with the user), then settling back to normal size — a uniform three-keyframe animation (evenly spaced `[1, 1.3, 1]`) made the "hold" phase too brief to be noticeable, since the scale-up and scale-down consumed equal, symmetric portions of the total duration. Adding a `times` array (`[0, 0.15, 0.7, 1]` for four keyframes `[1, 1.3, 1.3, 1]`) let the scale-up happen quickly, HELD at the peak for the bulk of the duration, then eased back down — a deliberately-paced pulse effect that uniform keyframe spacing alone couldn't express.

---

## 3. Production-Grade Code Example

```tsx
// Simple keyframes — evenly-spaced by default
import { motion } from 'framer-motion';

function LoadingDot() {
  return (
    <motion.div
      className="loading-dot"
      animate={{ y: [0, -10, 0] }} // bounces up and back down
      transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2 }}
    />
  );
}
```

```tsx
// times array — deliberate, non-uniform pacing for a "pulse" notification badge
function NotificationBadge({ count }: { count: number }) {
  return (
    <motion.span
      key={count} // re-mounts (retriggering the animation) whenever count actually changes
      animate={{ scale: [1, 1.3, 1.3, 1] }}
      transition={{ duration: 0.8, times: [0, 0.15, 0.7, 1] }} // quick scale-up, LONG hold, gentle settle
    >
      {count}
    </motion.span>
  );
}
```

```tsx
// Keyframes combined with per-keyframe easing
<motion.div
  animate={{ opacity: [0, 1, 1, 0] }}
  transition={{
    duration: 3,
    times: [0, 0.1, 0.9, 1], // quick fade-in, long hold, quick fade-out
    ease: ['easeOut', 'linear', 'easeIn'], // DIFFERENT easing PER SEGMENT between keyframes
  }}
/>
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming Keyframes Are Evenly Spaced by Default When Precise Pacing Is Needed
```tsx
// ❌ WRONG ASSUMPTION: without an explicit times array, this holds the peak scale for
// only a BRIEF instant (evenly-spaced middle keyframe), not the deliberately extended
// pause the design might actually call for
animate={{ scale: [1, 1.3, 1] }} // peak is a single instant, not a noticeable "hold"

// ✅ CORRECT: use a FOUR-keyframe array with explicit times to create a genuine hold period
animate={{ scale: [1, 1.3, 1.3, 1] }}
transition={{ times: [0, 0.15, 0.7, 1] }}
```

### ⚠️ Pitfall 2: Mismatched Array Lengths Between the Animated Value and `times`
```tsx
// ❌ ERROR: the times array MUST have the exact same length as the keyframes array —
// a mismatch produces incorrect timing or an error, not a graceful fallback
animate={{ x: [0, 100, 0] }} // 3 keyframes
transition={{ times: [0, 0.5] }} // ❌ only 2 entries — mismatched length

// ✅ CORRECT: times must have EXACTLY as many entries as the keyframe array
transition={{ times: [0, 0.5, 1] }} // matches the 3 keyframes above
```

### ⚠️ Pitfall 3: Using Keyframes for What's Actually a Simple Two-State Toggle
```tsx
// ❌ UNNECESSARY: a simple on/off toggle doesn't need keyframe array syntax at all —
// this adds complexity for a case the basic initial/animate prop pair already handles
animate={{ opacity: isVisible ? [0, 1] : [1, 0] }} // overcomplicated for a simple toggle

// ✅ CORRECT: plain target values suffice for simple two-state transitions;
// reserve keyframe arrays for GENUINELY multi-step motion (bounce, pulse, multi-point paths)
animate={{ opacity: isVisible ? 1 : 0 }}
```
