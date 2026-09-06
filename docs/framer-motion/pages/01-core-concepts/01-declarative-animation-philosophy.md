---
title: "Core Concepts: Declarative Animation & `motion` Components"
sidebar_label: "Core Concepts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs — [Motion component](https://motion.dev/docs/react-motion-component)
> and the [React upgrade guide](https://motion.dev/docs/react-upgrade-guide), read from a
> 131-page raw mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly
> `framer-motion`) on **React 19.2.8** — React version probed on the installed package.
> Documentation-verified; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

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

### `motion.create(Component)`: Making a Custom Component Animatable
For a component that isn't a plain HTML element (a custom `<Card>` component, for instance), `motion.create(Card)` creates an animatable version — *"You can add motion capabilities to any React component with `motion.create()`"*. Motion needs direct DOM access to apply the style interpolations, so the rule is that **your component must pass a ref down to the element you want to animate**.

🔴 **How you pass that ref depends on your React version, and the two are different code.** This bible targets **React 19.2.8**, where `ref` arrives as an ordinary prop:

```tsx
// React 19 — ref is just a prop
const Card = (props) => <div ref={props.ref} className="card">{props.title}</div>;
```

On **React 18** the same component needs `forwardRef`:

```tsx
// React 18 — forwardRef is required
const Card = React.forwardRef((props, ref) => <div ref={ref} className="card">{props.title}</div>);
```

⚠️ **The older callable form `motion(Card)` appears nowhere in Motion's current documentation** — `motion.create()` is the documented API. `motion.create()` also accepts a string, to animate a custom element, and takes a config: by default all motion props are filtered out of what reaches your component.

```tsx
const MotionElement = motion.create('custom-element');          // renders <custom-element />
const MotionCard   = motion.create(Card, {forwardMotionProps: true});  // pass motion props through
```

---

## 2. Real-World Engineering Scenario

**Scenario**: A Notification Toast Fading and Sliding In, Described Declaratively Instead of With Hand-Rolled Timing Logic.
A notification toast needed to fade in and slide up slightly when it appeared — implementing this with raw CSS transitions or hand-written `requestAnimationFrame` logic would require manually tracking the animation's current progress, handling interruption if the toast was dismissed mid-animation, and coordinating the timing of multiple animated properties (opacity AND position) together. Describing it declaratively — `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}` — let Motion handle all of that interpolation, interruption-handling, and multi-property coordination internally, with the actual "what should this look like at the start vs the end" being the only thing the developer needed to specify.

---

## 3. Production-Grade Code Example

```tsx
// A drop-in motion.div — identical to a plain div, plus animation capability
import { motion } from 'motion/react';

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
// motion.create(Component) — making a custom component animatable on React 19
import { motion } from 'motion/react';

// React 19 passes `ref` as an ordinary prop — no forwardRef wrapper needed
const Card = ({ title, ref }: { title: string; ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className="card">{title}</div> // the ref MUST reach the real DOM element
);

const MotionCard = motion.create(Card); // now animatable, exactly like a native motion.div

function App() {
  return <MotionCard title="Product" initial={{ scale: 0.9 }} animate={{ scale: 1 }} />;
}
```

---

## Gotchas

### ⚠️ Pitfall 1: The ref never reaches a DOM node
**Symptom.** `motion.create(Card)` renders, accepts every animation prop without complaint, and animates nothing. No error, no warning.
**Cause.** Motion applies interpolated styles by writing to a real DOM element. If your component accepts a `ref` and never attaches it — or never accepts one at all — Motion is holding nothing.
**Fix.** Attach the ref to the element you actually want animated. 🔴 **The code differs by React version, and this is the trap:** most material written before React 19 teaches `forwardRef` as *the* answer, and on React 19 that is no longer the shape you need.

```tsx
// ❌ WRONG on any React version: nothing accepts or attaches a ref
const Card = ({ title }: { title: string }) => <div className="card">{title}</div>;
const MotionCard = motion.create(Card); // animations do nothing — Motion cannot reach the DOM

// ✅ React 19 (what this bible targets) — ref is an ordinary prop
const Card19 = ({ title, ref }: { title: string; ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className="card">{title}</div>
);

// ✅ React 18 — the same job, done with forwardRef
const Card18 = React.forwardRef<HTMLDivElement, { title: string }>((props, ref) => (
  <div ref={ref} className="card">{props.title}</div>
));
```

⚠️ **One place `forwardRef` is still required on React 19:** an immediate child of `AnimatePresence` in `popLayout` mode must be wrapped in it. That is a documented exception, not a leftover.

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

## Interview questions

**★ What is the difference between `motion.div` and `motion.create(Card)`, and when do you reach for the second?**
`motion.div` is a ready-made animatable version of a built-in element — Motion ships one for every standard HTML and SVG tag. `motion.create()` is how you get the same capability for a component that isn't a plain element: your own `<Card>`, a styled-component, a third-party button. The returned component takes all the standard motion props (`animate`, `whileHover`, `drag`, `layout`) alongside the original component's own props. You only need `motion.create()` when there is a component boundary between you and the DOM node.

**★ Why does a custom component have to pass a ref, and what changed in React 19?**
Motion animates by writing interpolated style values directly to a DOM element, so it needs a handle on that element. The component in the middle is the only thing that can hand it over. What changed is purely *how*: on React 18 a function component could not receive `ref` as a prop, so you wrapped it in `forwardRef`; React 19 passes `ref` through as an ordinary prop, so the wrapper is no longer needed. The requirement — the ref must reach the real DOM node — is unchanged. Only the syntax moved.

**★ A colleague's `motion.create()` component animates nothing and throws no error. Where do you look first?**
The ref path. Nothing about a missing ref is loud: the component renders, every animation prop is accepted, and the animation silently no-ops because Motion is holding nothing. Check that the component accepts a ref *and* attaches it to the element you actually want moved — a ref attached to a wrapper animates the wrapper, not the child you were looking at.

**★ What does the declarative model actually take over from you?**
Interpolation between states, interruption handling when a new target arrives mid-flight, and coordination across several properties animating together. Hand-rolled `requestAnimationFrame` code has to track current progress, decide what happens when the toast is dismissed halfway through its entrance, and keep opacity and position in step. Declaring `initial` and `animate` states hands all three to the library; what you keep is the decision about what the start and end look like.

**Why is `animate={{ width: 300 }}` more expensive than `animate={{ x: 300 }}`?**
`width` (like `top` and `left`) forces the browser to recalculate layout on every frame; `transform` and `opacity` can be composited on the GPU without touching layout at all. The declarative API will happily animate either — it does not pick the cheap property for you, so that judgement stays yours.

**What is `forwardMotionProps` for?**
By default `motion.create()` filters the motion props out of what it forwards, so your component receives only its own props and never sees `animate` or `whileHover`. Passing `{forwardMotionProps: true}` sends them through as well — needed when the wrapped component wants to inspect or re-forward them itself.

**Is `import { motion } from 'framer-motion'` broken?**
No — `framer-motion` is still published in lockstep with `motion` (both **13.2.0**) and carries no npm deprecation notice, so existing code keeps working. But upstream's instruction is to uninstall `framer-motion`, install `motion`, and import from `motion/react`. Treat the old specifier as out of date rather than broken, which is exactly why it is worth fixing in a reference before it becomes the second thing a reader has to unlearn.

---

← [Core concepts](../README.md) · Next → [The core prop triad](../02-basic-animation-props/01-the-core-prop-triad.md)
