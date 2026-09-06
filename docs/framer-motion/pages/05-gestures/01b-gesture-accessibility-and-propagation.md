---
title: "A gesture prop is an accessibility decision and an event-propagation decision before it is an animation — Enter already works, `stopPropagation` already doesn't, and Reduced Motion deletes your `scale`"
sidebar_label: "Gesture accessibility & propagation"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Gesture animation](https://motion.dev/docs/react-gestures),
> [Accessibility](https://motion.dev/docs/react-accessibility) and
> [Motion component](https://motion.dev/docs/react-motion-component), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package. Documentation-verified;
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Gesture accessibility and propagation

**Three things about gesture props surprise people, and all three are documented:** a tap prop
already makes an element keyboard-operable *and* focusable, `e.stopPropagation()` inside a Motion
gesture handler is structurally too late to stop the parent, and `reducedMotion="user"` silently
switches off every `scale` you animate. The model itself is
[01](01-interaction-driven-animation.md); drag is [01c](01c-drag-constraints-and-momentum.md).

## 1. The keyboard path Motion already wired for you

The tap gesture is not pointer-only. Upstream is explicit:

> *"Elements with tap events are keyboard-accessible."*

> *"Any element with a tap prop will be able to receive focus and Enter can be used to trigger tap events on focused elements."*

> *"Pressing Enter down will trigger onTapStart and whileTap"*

> *"Releasing Enter will trigger onTap"*

> *"If the element loses focus before Enter is released, onTapCancel will fire."*

Read that as a table:

| Keyboard action | What fires |
|---|---|
| Enter pressed down | `onTapStart` + the `whileTap` animation |
| Enter released | `onTap` |
| element blurred while Enter is held | `onTapCancel` |

So `whileTap` is **not** the accessibility gap. The gap is the state before activation: a user who
has tabbed to the control but not yet pressed Enter gets no feedback from `whileTap` at all. That is
`whileFocus`'s job, and it is why both props exist.

## 2. Propagation — the two fixes, for two different children

A pressable child inside a pressable parent triggers both. The obvious remedy does not work, and the
docs say why:

> *"Because motion gesture handlers are deferred, e.stopPropagation() can't be fired in time for event propagation to be blocked"*

> *"Instead, use the propagate prop to prevent specific gestures from propagating."*

```tsx
// Child IS a motion component → use `propagate`
<motion.div whileTap={{ scale: 2 }}>
  <motion.button
    whileTap={{ opacity: 0.8 }}
    propagate={{ tap: false }} // the doc's own comment: "Pressing this button won't fire the above scale animation"
  />
</motion.div>
```

```tsx
// Child is a plain React component → stop the pointer event in the CAPTURE phase, which is early enough
<motion.div whileTap={{ scale: 2 }}>
  <button onPointerDownCapture={e => e.stopPropagation()} />
</motion.div>
```

> *"React components can prevent pointer events bubbling up to their motion component parents using the -Capture props."*

> *"Prevent children gestures from propagating to their parents."*

⚠️ **`propagate` currently supports `tap` only** — *"Currently, propagate only supports tap"*. There
is no documented equivalent for hover or focus, so a nested hover state has to be solved by
restructuring or by variants rather than by a prop.

## 3. Reduced Motion is a switch on your gesture vocabulary

> *"All modern operating systems provide a setting called "Reduced Motion", where people can indicate they prefer less physical motion, either because of personal preference or because they can suffer from motion sickness."*

> *"The reducedMotion option can be set on MotionConfig to define how you want to adhere to the Reduced Motion setting."*

And the consequence that matters for a page full of `whileHover={{ scale }}`:

> *"all motion components will automatically disable transform and layout animations"*

> *"while preserving the animation of other values like opacity and backgroundColor"*

```tsx
import { motion, MotionConfig, useReducedMotion } from 'motion/react';

// App-wide: honour the OS setting
<MotionConfig reducedMotion="user">{children}</MotionConfig>;

// Per-component: branch, so the feedback survives in a non-transform channel
function SafeButton({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion(); // true / false for the visitor's OS setting
  return (
    <motion.button
      whileHover={shouldReduceMotion ? { backgroundColor: '#1d4ed8' } : { scale: 1.05 }}
      whileFocus={{ backgroundColor: '#1d4ed8' }}
    >
      {children}
    </motion.button>
  );
}
```

`reducedMotion` also takes `"always"` and `"never"` — *"Additionally, you can allow a user to override Reduced Motion for just your site by setting reducedMotion to "always" or "never" based on their profile."*

⚠️ The accessibility page still writes `import { MotionConfig } from "framer-motion"` in its own
example. That specifier still resolves — `framer-motion` is published in lockstep at **13.2.0** with
no npm deprecation notice — but upstream's current instruction everywhere else is `motion/react`,
which is what this bible uses.

## Gotchas

### ⚠️ Pitfall 1: Forgetting `whileFocus` for Keyboard-Only Accessibility
```tsx
// ❌ INCOMPLETE: whileHover/whileTap alone provide NO visual feedback for keyboard-only
// users tabbing through interactive elements — a genuine accessibility gap
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Submit</motion.button>

// ✅ CORRECT: whileFocus ensures keyboard navigation gets equivalent visual feedback
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} whileFocus={{ scale: 1.05 }}>Submit</motion.button>
```

⚠️ Precision worth keeping: it is the *tabbed-to, not yet activated* state that is missing.
`whileTap` itself does fire for keyboard users, on Enter.

### ★ Hand-rolling `onKeyDown` beside `whileTap` double-fires the action
**Symptom.** Enter on a focused control runs the action twice.
**Cause.** Motion already wired Enter to the tap gesture (§1). An `onKeyDown` handler that also calls
the action runs alongside `onTap`, not instead of it.
**Fix.** Delete the key handler and use `onTap` as the activation callback. If you keep a plain
`onClick` on a `motion.button`, be aware you now have two activation paths — the browser's click and
Motion's tap — and they are not the same event.

### ★ A `motion.div` with a tap prop lands in the tab order
**Symptom.** After sprinkling `whileTap` onto some decorative cards, keyboard users tab through
twelve new stops before reaching the form.
**Cause.** The same documented behaviour read the other way: *"Any element with a tap prop will be able to receive focus and Enter can be used to trigger tap events on focused elements."*
Motion makes any tappable element focusable, whether or not it is semantically interactive.
**Fix.** Put tap props on things that *are* controls — `motion.button`, `motion.a` — not on layout
`div`s. If a card genuinely is one big button, give it an accessible name as well; a focus stop with
no name is worse than no focus stop.

### ★ `e.stopPropagation()` in a Motion gesture handler cannot stop the parent
**Symptom.** You add `e.stopPropagation()` to the child's `onTapStart` and the parent still animates.
**Cause.** Documented and structural: Motion's gesture handlers are **deferred**, so the parent has
already reacted by the time your handler runs.
**Fix.** `propagate={{ tap: false }}` on a motion child, `onPointerDownCapture` on a plain React
child. Both blocks are in §2. 🔴 Do not "fix" this by moving `stopPropagation` to `onTap` or
`onTapEnd` — later is not the direction that helps.

### ★ `reducedMotion="user"` deletes your hover scale, silently
**Symptom.** One tester reports that no button in the app reacts to hover; everyone else sees it
fine. Nothing is logged, because nothing failed.
**Cause.** `scale` is a transform, and under `reducedMotion="user"` Motion disables transform and
layout animations while preserving values like `opacity` and `backgroundColor`.
**Fix.** §3 — give interactive feedback a non-transform channel, or branch on `useReducedMotion()`.
🔴 The wrong fix is removing `MotionConfig`; that is not a bug report, it is the feature working.

### ★ Reduced Motion is not just gestures — it changes what a *transition* may animate
**Symptom.** A page-transition slide keeps working under Reduced Motion but the hover states do not,
and nobody can see the pattern.
**Cause.** The rule is per-**value**, not per-component: transform and layout animations off, other
values through. An `x`/`y` slide is a transform and is disabled; an `opacity` cross-fade is not and
survives.
**Fix.** Audit by property, not by component. The docs' own guidance for the reduced case is to
replace transform animations on large elements with opacity transitions.

### ⚠️ Whether `whileFocus` alone makes an element focusable is not documented
Motion documents that a **tap** prop confers focusability. It says nothing about `whileFocus` doing
the same. Do not assume a bare `motion.div` with only `whileFocus` will ever receive focus — give it
real semantics (a `button`, an `a`, an `input`) or an explicit `tabIndex`, and you are relying on the
platform rather than on an undocumented Motion behaviour.

## Interview questions

**★ A keyboard user tabs to your button and sees nothing change. Which prop is missing, and why doesn't `whileTap` cover it?**
`whileFocus`. `whileTap` *is* keyboard-operable — Motion makes elements with tap props focusable, and
Enter triggers the tap gesture, firing `whileTap` and `onTapStart` on key-down and `onTap` on key-up —
but that only covers the moment of activation. Between arriving at the control and pressing Enter the
user needs to know where they are, and that state is the focus gesture. The subtlety worth adding:
`whileFocus` follows the `:focus-visible` rules, so it deliberately will not fire when the same button
is clicked with a mouse.

**★ You have a pressable card containing a pressable button. Pressing the button animates both. How do you fix it?**
Not with `stopPropagation` inside a tap handler — Motion's gesture handlers are deferred, so the
parent has already reacted by the time your handler runs. If the child is a motion component, pass
`propagate={{ tap: false }}`. If the child is a plain React component, stop the pointer event in the
capture phase with `onPointerDownCapture={e => e.stopPropagation()}`, which happens early enough to
prevent the parent's gesture from starting. Note that `propagate` currently supports `tap` only, so a
nested *hover* state needs a structural answer instead.

**★ What is the difference between `onTap` and `onTapCancel`, and how does the keyboard path map onto them?**
Both fire when the press ends. `onTap` fires when the pointer is released *inside* the component it
started on; `onTapCancel` when it is released outside. The keyboard path mirrors it exactly: releasing
Enter fires `onTap`, but if the element loses focus while Enter is still held, `onTapCancel` fires.
That symmetry is why `onTap` is a better "the user activated this" signal than a raw `pointerup`.

**★ A tester says no hover effects work anywhere in the app. Everything works for you. What do you check first?**
Their OS Reduced Motion setting, together with whether the app is wrapped in
`MotionConfig reducedMotion="user"`. Under that setting Motion disables transform and layout
animations while preserving values like `opacity` and `backgroundColor` — so a codebase whose entire
interaction vocabulary is `scale` goes completely flat, silently and by design. The fix is not to
remove the config; it is to give feedback a non-transform channel, or to branch on
`useReducedMotion()`.

**★ Does adding `whileTap` to a `div` make it accessible?**
It makes it *operable* — focusable, and activatable with Enter — which is more than most animation
libraries give you, and it is easy to mistake for "done". It does not give the element a role, a
name, or the behaviours a screen reader announces, and it adds a tab stop to something that may not
deserve one. Operability is one part of accessibility; use the semantic element and let Motion add
the animation on top.

**When would you choose `reducedMotion="always"` or `"never"` over `"user"`?**
When your product exposes its own motion preference. `"user"` follows the OS setting, which is the
right default; `"always"` and `"never"` let you drive the same switch from a per-account profile
setting, so a user who wants reduced motion on your site but not system-wide can have it. The value is
a prop on `MotionConfig`, so it can be a piece of state like any other.

**Why can't you solve nested gesture propagation the way you would solve nested DOM click handlers?**
Because the two run at different times. A DOM `click` handler can call `stopPropagation` while the
event is still bubbling, so the parent never sees it. Motion defers its gesture handlers, so by the
time a callback of yours runs, the parent's gesture has already been recognised and its `while-`
animation started. The library therefore has to expose an opt-out of its own — `propagate` — and the
only escape hatch that still works from your side is the capture phase, which happens *before*
anything is recognised.

---

← [Gestures](01-interaction-driven-animation.md) · [Explanations](../README.md) · Next → [Drag, constraints and momentum](01c-drag-constraints-and-momentum.md)
