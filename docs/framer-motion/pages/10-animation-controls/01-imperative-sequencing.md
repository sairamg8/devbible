---
title: "Animation Controls: `useAnimate()`/`useAnimation()` & Chained Sequences"
sidebar_label: "Animation Controls"
sidebar_position: 1
---

# 🎨 Animation Controls: `useAnimate()`/`useAnimation()` & Chained Sequences

## 1. Under-The-Hood Mechanics

While the vast majority of Framer Motion usage is declarative (prop-driven `animate`/`variants`), some scenarios genuinely need **imperative** control — starting, stopping, or sequencing animations in response to logic that doesn't map cleanly onto a single state value.

```
useAnimate()
        │
        ▼
Returns [scope, animate] — `scope` is a ref to attach to a container element,
`animate` is an IMPERATIVE function: animate(selector, targetValues, options)
        │
        ▼
await animate('.card', { opacity: 1 }, { duration: 0.3 });   // returns a PROMISE — awaitable!
await animate('.badge', { scale: 1 });                           // sequenced AFTER the above completes
```

### Why Awaitable Sequencing Matters
Because `animate()` returns a Promise resolving when that specific animation completes, multiple `animate()` calls with `await` between them produce a genuinely **sequential**, multi-step choreography — animation A fully finishes, THEN animation B begins — expressed as ordinary, readable async/await code, rather than needing nested `onComplete` callbacks or manually-coordinated timeout delays.

### `useAnimation()`: Named Variant Triggering From Arbitrary Logic
```typescript
const controls = useAnimation();
async function handleSubmit() {
  await controls.start('shake'); // triggers the 'shake' variant, awaitable
  submitForm();
}
```
`useAnimation()` provides a `controls` object whose `.start(variantName)` can be called from **any** event handler or effect — useful when an animation needs to be triggered by logic that doesn't cleanly map to "this prop changed," such as a validation failure triggering a one-off shake animation independent of any ongoing state.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Multi-Step Onboarding Tooltip Sequence Requiring Precise, Awaitable Choreography.
An onboarding flow needed to highlight several UI elements in sequence — element A fades in and pulses, THEN (only after A's pulse fully completes) element B's tooltip slides in, THEN C. Expressing this as pure declarative state would have required awkward, brittle timing calculations (guessing how long A's animation takes, then hardcoding B's delay to match) that would silently break the moment A's animation duration was tweaked. Using `useAnimate()`'s awaitable `animate()` calls, each step's actual completion (not a guessed delay) determined when the next step began — genuinely sequential, and automatically correct even if any individual step's duration changed later.

---

## 3. Production-Grade Code Example

```tsx
// useAnimate — imperative, awaitable sequencing for a precise multi-step choreography
import { useAnimate } from 'framer-motion';

function OnboardingSequence() {
  const [scope, animate] = useAnimate();

  async function runSequence() {
    await animate('.step-a', { opacity: 1, scale: [1, 1.1, 1] }, { duration: 0.4 }); // A fades in and pulses
    await animate('.step-b', { opacity: 1, x: 0 }, { duration: 0.3 }); // ONLY starts after A genuinely completes
    await animate('.step-c', { opacity: 1, x: 0 }, { duration: 0.3 });
  }

  useEffect(() => { runSequence(); }, []);

  return (
    <div ref={scope}>
      <div className="step-a" style={{ opacity: 0 }}>Highlight A</div>
      <div className="step-b" style={{ opacity: 0, x: -20 }}>Tooltip B</div>
      <div className="step-c" style={{ opacity: 0, x: -20 }}>Tooltip C</div>
    </div>
  );
}
```

```tsx
// useAnimation — triggering a one-off "shake" animation from validation logic, outside normal state flow
import { motion, useAnimation } from 'framer-motion';

const shakeVariants = {
  shake: { x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4 } },
};

function LoginForm() {
  const controls = useAnimation();

  async function handleSubmit(credentials: Credentials) {
    const isValid = await validateCredentials(credentials);
    if (!isValid) {
      await controls.start('shake'); // one-off trigger, unrelated to any ongoing prop/state value
      return;
    }
    // proceed with login
  }

  return (
    <motion.form variants={shakeVariants} animate={controls} onSubmit={handleSubmit}>
      <FormFields />
    </motion.form>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reaching for `useAnimate()`/`useAnimation()` Where Plain Declarative Props Would Suffice
```tsx
// ❌ OVER-ENGINEERED: this could be expressed as a plain animate prop reacting to state —
// using imperative controls here adds unnecessary complexity for a case declarative
// props already handle cleanly
const controls = useAnimation();
useEffect(() => { controls.start(isOpen ? 'open' : 'closed'); }, [isOpen]); // just use animate prop instead!

// ✅ CORRECT: reserve imperative controls for GENUINELY sequential/conditional choreography
// that doesn't map to a single reactive state value; use declarative animate/variants otherwise
<motion.div animate={isOpen ? 'open' : 'closed'} variants={variants} />
```

### ⚠️ Pitfall 2: Forgetting to `await` Sequential `animate()` Calls, Losing the Intended Ordering
```tsx
// ❌ WRONG: without await, ALL THREE animate() calls fire nearly simultaneously, not
// sequentially — defeating the entire purpose of a step-by-step choreography
animate('.step-a', { opacity: 1 });
animate('.step-b', { opacity: 1 }); // starts almost IMMEDIATELY, not after step-a completes
animate('.step-c', { opacity: 1 });

// ✅ CORRECT: await each step to enforce genuine sequential ordering
await animate('.step-a', { opacity: 1 });
await animate('.step-b', { opacity: 1 }); // now genuinely waits for step-a to finish first
```

### ⚠️ Pitfall 3: Using CSS Selectors in `animate()` That Match Elements Outside the Intended `scope`
```tsx
// ❌ RISKY: animate('.card', {...}) inside useAnimate() is scoped to the `scope` ref's
// subtree — but an overly generic selector could still unexpectedly match multiple
// elements within that scope if the class name isn't specific enough
await animate('.item', { opacity: 1 }); // if MULTIPLE .item elements exist in scope, ALL are animated together

// ✅ CORRECT: use sufficiently specific selectors (or scope the animate() call to exactly
// the intended single element) to avoid unintentionally animating multiple matches at once
```
