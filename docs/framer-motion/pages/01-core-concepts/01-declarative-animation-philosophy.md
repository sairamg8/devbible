---
title: "Core Concepts: Declarative Animation & `motion` Components"
sidebar_label: "Core Concepts"
sidebar_position: 1
---

# 🎨 Core Concepts: Declarative Animation & `motion` Components

## 1. Under-The-Hood Mechanics

Framer Motion's foundational idea: describe **what a state looks like**, not the individual steps to get there — the library handles interpolating between states, rather than the developer hand-writing keyframe/timing logic imperatively.

```
Imperative animation (traditional, e.g. hand-rolled with requestAnimationFrame):
  "start at opacity 0, over 300ms, increase to opacity 1, using this specific easing curve" —
  the DEVELOPER manages the actual step-by-step transition logic

Declarative animation (Framer Motion):
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
  "here's the START state, here's the END state" — Motion figures out and manages
  every actual interpolation step between them
```

### `motion.div`, `motion.svg`, etc.: Drop-In Animatable Elements
Every standard HTML/SVG element has a corresponding `motion.*` version — `motion.div` behaves identically to a plain `<div>` for every normal prop (className, onClick, children), but additionally accepts the animation-specific props (`initial`, `animate`, `exit`, `whileHover`, etc.) covered throughout this bible. This is a drop-in replacement, not a wrapper requiring restructuring — swapping `<div>` for `<motion.div>` adds animation capability without changing anything else about how the element behaves.

### `motion(Component)`: Making a Custom Component Animatable
For a component that isn't a plain HTML element (a custom `<Card>` component, for instance), `motion(Card)` creates an animatable version — but this **requires** the custom component to forward its `ref` (via `React.forwardRef`) down to the actual DOM element it renders, since Motion needs direct DOM access to apply the actual style interpolations.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Notification Toast Fading and Sliding In, Described Declaratively Instead of With Hand-Rolled Timing Logic.
A notification toast needed to fade in and slide up slightly when it appeared — implementing this with raw CSS transitions or hand-written `requestAnimationFrame` logic would require manually tracking the animation's current progress, handling interruption if the toast was dismissed mid-animation, and coordinating the timing of multiple animated properties (opacity AND position) together. Describing it declaratively — `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}` — let Motion handle all of that interpolation, interruption-handling, and multi-property coordination internally, with the actual "what should this look like at the start vs the end" being the only thing the developer needed to specify.

---

## 3. Production-Grade Code Example

```tsx
// A drop-in motion.div — identical to a plain div, plus animation capability
import { motion } from 'framer-motion';

function Toast({ message }: { message: string }) {
  return (
    <motion.div
      className="toast" // works exactly like a normal className
      onClick={() => console.log('clicked')} // works exactly like a normal onClick
      initial={{ opacity: 0, y: 20 }} // starting state, on mount
      animate={{ opacity: 1, y: 0 }} // target state, animated toward
    >
      {message}
    </motion.div>
  );
}
```

```tsx
// motion(Component) — making a custom component animatable, requiring forwardRef
import { motion } from 'framer-motion';
import { forwardRef } from 'react';

const Card = forwardRef<HTMLDivElement, { title: string }>(({ title }, ref) => (
  <div ref={ref} className="card">{title}</div> // ref MUST be forwarded to the actual DOM element
));

const MotionCard = motion(Card); // now animatable, exactly like a native motion.div

function App() {
  return <MotionCard title="Product" initial={{ scale: 0.9 }} animate={{ scale: 1 }} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `forwardRef` When Making a Custom Component Animatable
```tsx
// ❌ WRONG: without forwardRef, Motion has NO way to attach itself to the actual DOM node —
// animations silently fail to apply at all, with no clear error explaining why
function Card({ title }: { title: string }) {
  return <div className="card">{title}</div>; // no ref forwarding
}
const MotionCard = motion(Card); // animations on this DO NOTHING — Motion can't reach the DOM

// ✅ CORRECT: forward the ref so Motion can actually control the underlying element
const Card2 = forwardRef<HTMLDivElement, { title: string }>((props, ref) => (
  <div ref={ref} className="card">{props.title}</div>
));
```

### ⚠️ Pitfall 2: Mixing Imperative DOM Manipulation With Motion's Declarative Model
```tsx
// ❌ CONFLICTING: directly manipulating a motion component's DOM node style via a ref
// (bypassing Motion's own state) can conflict with Motion's internal tracking of that
// element's current animated values, producing inconsistent/unpredictable results
const ref = useRef<HTMLDivElement>(null);
ref.current!.style.opacity = '0.5'; // fights with Motion's own opacity management on the same element

// ✅ CORRECT: let Motion own the animated properties entirely — use its own APIs
// (animate props, motion values, or useAnimate — covered in the animation controls doc)
// for ANY value Motion is also managing, rather than reaching around it imperatively
```

### ⚠️ Pitfall 3: Assuming Every CSS Property Animates Equally Efficiently
Declaring `animate={{ width: 300 }}` works, but as covered in the [performance doc](../14-performance-considerations/01-animating-efficiently.md), some properties (`width`, `top`, `left`) trigger expensive browser layout recalculation on every frame, while others (`transform`, `opacity`) can be GPU-composited without triggering layout at all — the declarative API doesn't automatically choose the more efficient property for you; that choice still requires understanding which properties are actually cheap to animate.
