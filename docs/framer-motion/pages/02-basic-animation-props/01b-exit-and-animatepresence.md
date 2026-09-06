---
title: "`exit` is the only animation prop that cannot work alone — it is a contract with AnimatePresence, and every clause of that contract fails silently"
sidebar_label: "01b · exit & AnimatePresence"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs — [AnimatePresence](https://motion.dev/docs/react-animate-presence),
> [Motion component](https://motion.dev/docs/react-motion-component) (the `exit` prop
> reference) and [React animation](https://motion.dev/docs/react-animation), read from a
> 131-page raw mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly
> `framer-motion`) on **React 19.2.8** — React version probed on the installed package.
> Documentation-verified; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**`initial` and `animate` are self-contained: put them on an element and they work. `exit`
is not a prop, it is half of an agreement with a component somewhere above it — and every
way that agreement breaks produces exactly the same symptom, an element that vanishes
instantly with no error, no warning and nothing in the console.** This chunk is the
four clauses of that agreement and how each one fails.

## Why `exit` needs a partner at all

The prop itself is described in one line:

> *"A target to animate to when a component is removed from the tree. Can be set either as an animation target, or variant."* —
> [Motion component](https://motion.dev/docs/react-motion-component)

The problem is that by the time React has removed the component, there is nothing left to
animate. React does not offer an unmount hook that can delay removal, so Motion supplies the
delay itself:

> *"In React, when a component is removed, it's usually removed instantly. Motion provides the AnimatePresence component which keeps elements in the DOM while they perform an animation defined with the exit prop."* —
> [React animation](https://motion.dev/docs/react-animation)

`AnimatePresence` keeps a removed subtree mounted, runs the `exit` animations inside it, and
only then lets React finish the removal. Everything below follows from that one mechanism.

## The four clauses

```tsx
// exit — requires AnimatePresence (covered in depth in its own dedicated doc)
import { motion, AnimatePresence } from 'motion/react';

function Notification({ isShowing, message }: { isShowing: boolean; message: string }) {
  return (
    <AnimatePresence>
      {isShowing && (
        <motion.div
          key="notification" // REQUIRED: AnimatePresence tracks direct children by key
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }} // animates OUT before actually being removed from the DOM
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

1. **There is an `AnimatePresence`.** Without it the `exit` prop is accepted and ignored.
2. **The conditional is inside it**, not around it — see the gotcha below.
3. **Every direct child has a stable unique `key`.** Presence is diffed by key.
4. **The element whose removal you toggle is a direct child** — not a descendant of something
   that never unmounts.

### ⚠️ Pitfall 1: Expecting `exit` to Work Without `<AnimatePresence>`
```tsx
// ❌ WRONG: React unmounts components SYNCHRONOUSLY — without AnimatePresence delaying
// the actual removal, `exit` has NO effect at all; the element just vanishes instantly
{isShowing && <motion.div exit={{ opacity: 0 }}>...</motion.div>} // exit prop is IGNORED without AnimatePresence

// ✅ CORRECT: exit animations REQUIRE AnimatePresence wrapping the conditionally-rendered
// content, and every direct child needs a stable unique `key`
<AnimatePresence>
  {isShowing && <motion.div key="panel" exit={{ opacity: 0 }}>...</motion.div>}
</AnimatePresence>
```

## Gotchas

**★ Every direct child of `AnimatePresence` needs a `key`, including a single conditional one.**
This is stated as a requirement, not an optimisation:

> *"Direct children must each have a unique key prop so AnimatePresence can track their presence in the tree."* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

The mechanism is in the sentence above it —
*"AnimatePresence works by detecting when its direct children are removed from the React tree."*
Detection is by key. The docs' own minimal example carries `key="modal"` on a child that is
the only child there can be, which is the tell that this is not a list-only rule.

**★ `key={index}` under `AnimatePresence` is broken in a way that only shows up on reorder.**
The troubleshooting section names it directly:

> *"providing index as a key is bad because if the items reorder then the index will not be matched to the item"* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

Index keys survive add-at-end, which is why this passes review. They fail on
remove-from-middle and on sort, where the surviving items renumber: Motion sees the same set
of keys still present, concludes nothing was removed, and runs no exit animation at all —
while the item that actually left has its content shifted onto a neighbour's key. The docs'
fix is the obvious one: *"It's preferred to pass something that's unique to that item, for
instance an ID:"*

**★ `AnimatePresence` inside the conditional cannot work, and it looks correct.**

```tsx
// ❌ AnimatePresence unmounts along with the thing it was supposed to animate out
{isVisible && (
  <AnimatePresence>
    <Component />
  </AnimatePresence>
)}

// ✅ the conditional lives INSIDE AnimatePresence
<AnimatePresence>
  {isVisible && <Component key="component" />}
</AnimatePresence>
```

> *"Also make sure AnimatePresence is outside of the code that unmounts the element. If AnimatePresence itself unmounts, then it can't control exit animations!"* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

This is the version of the bug that survives a code review, because the `AnimatePresence`
is *right there*, visibly wrapping the thing with the `exit` prop on it.

**★ Nested `exit` props fire, but only because the whole subtree is being removed.**
The prop reference says *"Owing to React limitations, the component being removed must be a
direct child of AnimatePresence to enable this animation"*, which reads as though only the
outermost element can have `exit`. The AnimatePresence page completes the picture:

> *"Any motion components within the exiting component will fire animations defined on their exit props before the component is removed from the DOM."* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

Both are true, and they are about different things. What has to be a direct child is the node
whose *removal* is being detected; `exit` props deeper inside that subtree still run when it
goes. What does **not** work is putting `exit` on a deep node whose own removal is what you
toggle, while `AnimatePresence` sits far above it wrapping something that never unmounts.

**★ A removed component's props are frozen, so a dynamic `exit` cannot be driven by props.**
Once the component is out of the React tree there is no render left in which to update it:

> *"When a component has been removed from the React tree, its props can no longer be updated. We can use AnimatePresence 's custom prop to pass new data down through the tree, even into exiting components."* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

The concrete case is a carousel that should exit left or right depending on swipe direction.
The direction is known at the moment of removal, which is exactly one render too late. The
documented route is `AnimatePresence custom={direction}` plus a dynamic variant, or
`usePresenceData` inside the child.

**★ Two `AnimatePresence` components do not cooperate by default.**
The docs state that by default an `AnimatePresence` controls exit animations on all of its
children *"until another AnimatePresence component is rendered"*. So an inner
`AnimatePresence` swallows exits for its own subtree: when the outer one removes the whole
section, the inner children's `exit` props do not fire. Setting `propagate` on the inner one
opts back in — the docs describe `propagate` as: *"If set to true , exit animations on
children will also trigger when this AnimatePresence exits from a parent AnimatePresence ."*

## Interview questions

**★ A component with `exit={{ opacity: 0 }}` disappears instantly. Walk through the checklist.**
Four things, in the order they most often fail. (1) Is there an `AnimatePresence` at all —
React removes components instantly and `AnimatePresence` is the thing that keeps them in the
DOM long enough to animate. (2) Is the conditional *inside* `AnimatePresence` rather than
wrapping it — if `AnimatePresence` unmounts at the same moment, it cannot control anything.
(3) Does every direct child have a stable, unique `key` — presence is tracked by key. (4) Is
the element whose removal you toggle actually a direct child, or is `AnimatePresence` sitting
above something that never unmounts. Note that none of the four produces an error message;
all four produce the identical symptom, which is why the checklist is worth memorising.

**★ Why is `key={index}` an anti-pattern specifically under `AnimatePresence`, when React tolerates it elsewhere?**
Because `AnimatePresence` uses the key as the identity it diffs presence against, not merely
as a reconciliation hint. The docs require a key that remains the same for that component
every render. With an index, removing the middle item of a list renumbers everything after
it, so Motion sees the same set of keys still present and concludes nothing was removed — no
exit animation runs, and the wrong item's content is left behind. Pass something unique to
the item, such as its ID.

**★ Can `exit` be a variant name rather than an object?**
Yes — the docs say *"exit can be defined either as an object of values, or as a variant
label."* That is more than a style preference: a variant label is what makes the exit
orchestratable, because variants propagate down the tree and can carry a
`when: "afterChildren"` transition, so a modal's children animate out before the modal shell
does. An object target on the parent cannot coordinate its children that way.

**★ How would you animate a slide out to the left when swiping forward and to the right when swiping back?**
Not with props on the exiting component — by the time it exits, its props can no longer be
updated. Pass the direction through `AnimatePresence`'s `custom` prop and make `exit` a
*dynamic* variant, a function of that custom value, so the direction is resolved at exit
time. Inside the child, `usePresenceData` reads the same value. The general shape of the
problem — "I need to know something at removal time that I only learn at removal time" — is
what `custom` exists for.

**★ You are told the exit animation "works locally but not in the list view". What changed?**
Almost always the number of `AnimatePresence` components. A working single-item case has one
`AnimatePresence` directly above the conditional; a list view often nests another one inside
a row component, and by default the inner one takes ownership of its subtree's exits, so
removing the whole section no longer fires them. Either lift the presence boundary or set
`propagate` on the inner `AnimatePresence`. The second candidate is keys — a list is where
`key={index}` first becomes reachable.

---

← [The core prop triad](01-the-core-prop-triad.md) · [Explanations](../README.md) · Next → [Transition resolution](01c-transition-resolution-and-per-value-overrides.md)
