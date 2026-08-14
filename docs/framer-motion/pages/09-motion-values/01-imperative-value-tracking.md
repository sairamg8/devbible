---
title: "Motion Values: `useMotionValue`, `useTransform` & `useSpring`"
sidebar_label: "Motion Values"
sidebar_position: 1
---

# 🎨 Motion Values: `useMotionValue`, `useTransform` & `useSpring`

## 1. Under-The-Hood Mechanics

A **motion value** is a value container that can update **outside React's own render cycle** — the key performance mechanism underlying scroll-linked effects, drag tracking, and any high-frequency animation that would be far too slow if it triggered a full React re-render on every single update.

```
useMotionValue(0)
        │
        ▼
Returns a MotionValue object — .get()/.set() read/write its current value
        │
        ▼
Passed directly to a motion component's style prop: <motion.div style={{ x: motionValue }} />
        │
        ▼
When motionValue.set() is called (e.g. many times per second during a drag or scroll),
Motion updates the ACTUAL DOM style DIRECTLY — bypassing React's reconciliation
and re-render cycle ENTIRELY for that specific update
```

### Why Bypassing React Re-Renders Matters
A drag gesture or scroll event can fire dozens of times per second — if each one triggered a full React state update and re-render (`setState` → reconciliation → DOM diffing → commit), the overhead of React's own update cycle would likely cause visible jank, especially on lower-end devices. Motion values update the DOM **directly**, sidestepping React's render cycle entirely for high-frequency changes, which is what keeps drag-following and scroll-linked animations smooth even at high update frequency.

### `useTransform`: Mapping One Motion Value's Range Into Another
```typescript
const x = useMotionValue(0);
const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]); // maps x's range into a DERIVED opacity value
```
`useTransform` creates a **new**, derived motion value that automatically stays in sync with its source — whenever `x` changes, `opacity` recomputes according to the mapping, without any manual subscription/update code, and critically, this derived computation also happens outside React's render cycle.

### `useSpring`: Smoothing a Motion Value With Physics
Wrapping a motion value (often one derived from `useTransform`, or directly from a raw input like scroll position) with `useSpring` applies spring physics smoothing to its updates — turning a potentially jittery, directly-set raw value (like exact scroll pixel position) into smoothly-interpolated motion, without losing the "outside React's render cycle" performance benefit.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Custom Cursor-Following Element That Would Have Caused Visible Jank Using `useState`.
A custom cursor-follower effect needed an element to track the mouse position in real time, updating potentially 60+ times per second as the mouse moved. An initial implementation using `useState` + `onMouseMove` to trigger a React re-render on every mouse move produced visible stutter under any real load — each mouse move triggered a full React reconciliation pass for a change that only needed to update two CSS properties. Switching to `useMotionValue` for the x/y position, updated directly via `.set()` in the mouse-move handler (bypassing React's render cycle entirely), eliminated the jank completely — the DOM updated directly and immediately on every mouse move, with zero React reconciliation overhead in the hot path.

---

## 3. Production-Grade Code Example

```tsx
// useMotionValue — a cursor-follower avoiding React re-renders entirely on every mouse move
import { motion, useMotionValue } from 'framer-motion';
import { useEffect } from 'react';

function CursorFollower() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      x.set(e.clientX); // updates the DOM directly — NO React re-render triggered by this call
      y.set(e.clientY);
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [x, y]);

  return <motion.div className="cursor-dot" style={{ x, y }} />; // reads the motion values directly
}
```

```tsx
// useTransform — deriving an opacity value from a drag position, without extra re-renders
import { motion, useMotionValue, useTransform } from 'framer-motion';

function SwipeToDismissCard() {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]); // fades out as it's dragged toward EITHER edge

  return (
    <motion.div drag="x" style={{ x, opacity }} dragConstraints={{ left: 0, right: 0 }}>
      <CardContent />
    </motion.div>
  );
}
```

```tsx
// useSpring — smoothing a raw, potentially jittery value with physics
import { useMotionValue, useSpring } from 'framer-motion';

function SmoothProgressBar({ rawProgress }: { rawProgress: number }) {
  const progress = useMotionValue(rawProgress);
  const smoothProgress = useSpring(progress, { stiffness: 200, damping: 30 }); // smooths abrupt raw updates

  useEffect(() => { progress.set(rawProgress); }, [rawProgress, progress]);

  return <motion.div className="progress-fill" style={{ scaleX: smoothProgress }} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reading a Motion Value's Current Value via `.get()` During Render, Expecting Reactivity
```tsx
// ❌ WRONG: reading .get() directly in the render body does NOT subscribe the component
// to re-render when the motion value changes — this reads a STALE snapshot, frozen at
// whatever render happened to capture it, never updating visually via this code path
function Component() {
  const x = useMotionValue(0);
  return <div>{x.get()}</div>; // renders ONCE with the initial value, never updates as x changes
}

// ✅ CORRECT: pass the motion value directly to a motion component's style prop (bypassing
// React's render cycle correctly), or use useMotionValueEvent to subscribe to changes explicitly
return <motion.div style={{ x }} />; // Motion handles updating this WITHOUT needing React re-renders
```

### ⚠️ Pitfall 2: Using `useState` for High-Frequency Updates Where a Motion Value Was Needed
```tsx
// ❌ PERFORMANCE RISK: exactly the jank scenario above — using React state for something
// updating many times per second forces a full re-render cycle on every single update
const [x, setX] = useState(0);
window.addEventListener('mousemove', (e) => setX(e.clientX)); // triggers a REAL React re-render per mouse move

// ✅ CORRECT: useMotionValue for anything updating at high frequency/outside typical UI state changes
const x = useMotionValue(0);
window.addEventListener('mousemove', (e) => x.set(e.clientX)); // no React re-render at all
```

### ⚠️ Pitfall 3: Forgetting `useTransform`'s Derived Value Needs the SAME Motion-Value Discipline
```tsx
// ❌ WRONG: reading a useTransform-derived value's .get() during render has the exact same
// staleness problem as reading a raw motion value's .get() during render
const opacity = useTransform(x, [0, 100], [1, 0]);
return <div style={{ opacity: opacity.get() }} />; // STALE — doesn't update as x changes

// ✅ CORRECT: pass derived motion values directly to a motion component's style prop too
return <motion.div style={{ opacity }} />;
```
