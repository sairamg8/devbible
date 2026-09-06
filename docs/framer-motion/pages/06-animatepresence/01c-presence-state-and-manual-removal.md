---
title: "An exiting component has left the React tree — so its props are frozen, and something has to declare it safe to remove"
sidebar_label: "`AnimatePresence` presence state"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [AnimatePresence](https://motion.dev/docs/react-animate-presence),
> [useAnimate](https://motion.dev/docs/react-use-animate), [Layout animations](https://motion.dev/docs/react-layout-animations)
> and [AnimateActivity](https://motion.dev/docs/react-animate-activity), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — the React version was probed on the installed package; `motion` is not in this
> checkout's `node_modules`, so every Motion claim here is documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Presence State: Frozen Props and Manual Removal

**Once React has removed a component, it cannot be re-rendered — and the two most confusing corners
of `AnimatePresence` follow from that single fact.** You cannot change an exit animation with props
on the way out, because there is no render left to change them in. And when the exit animation is
not a Motion `exit` prop at all, nothing knows when the DOM node may finally go — so you have to say
so yourself. What happens when wrappers nest, and the props you only reach for once, are in
[nesting, propagation and the one-shot props](01d-nesting-propagation-and-one-shot-props.md).

## The exiting component is outside the tree — `custom` is how data still reaches it

> *"When a component is removed, there's no longer a chance to update its props (because it's no longer in the React tree). Therefore we can't update its exit animation with the same render that removed the component."* — [AnimatePresence → `custom`](https://motion.dev/docs/react-animate-presence)

This is why a slideshow that should exit *left* when you swipe forward and *right* when you swipe
back cannot simply read a `direction` prop: by the time the removal renders, the outgoing slide is
no longer receiving props. The documented route is `custom` on the wrapper feeding a dynamic
variant on the child:

```tsx
import { AnimatePresence, motion } from 'motion/react';

const variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction === 1 ? -300 : 300,
  }),
  visible: { opacity: 1, x: 0 },
};

export const Slideshow = ({ image, direction }: { image: Image; direction: number }) => (
  <AnimatePresence custom={direction}>
    <motion.img
      key={image.src}
      src={image.src}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="hidden"
    />
  </AnimatePresence>
);
```

The same value is readable inside the child through `usePresenceData`, and whether the child is
coming or going through the presence hook:

```tsx
import { usePresenceData, useIsPresent, motion } from 'motion/react';

function Slide() {
  const isPresent = useIsPresent();
  const direction = usePresenceData();

  return (
    <motion.div exit={{ opacity: 0 }}>
      {isPresent ? 'Here!' : 'Exiting ' + direction}
    </motion.div>
  );
}
```

⚠️ **The docs are internally inconsistent about the hook's name.** The prose sentence introducing
it calls it *"the useIsPresence hook"*, while the import line and both code samples on the same page
use `useIsPresent`. The mirror does not settle which is the real export, and `motion` is not
installed in this checkout, so it could not be probed — follow the code samples, and if the import
fails, that is the reason.

## Manual removal — `usePresence` and `safeToRemove`

> *"It's also possible to manually tell AnimatePresence when a component is safe to remove with the usePresence hook."* — [AnimatePresence → Manual usage](https://motion.dev/docs/react-animate-presence)

> *"This returns both isPresent state and a callback, safeToRemove, that should be called when you're ready to remove the component from the DOM (for instance after a manual animation or other timeout)."* — ibid.

This is the escape hatch for an exit that is not an `exit` prop: a canvas teardown, a third-party
animation library, a video that has to finish its fade, a sequence you are driving with
`useAnimate`.

```tsx
import { useAnimate, usePresence } from 'motion/react';
import { useEffect } from 'react';

function Notification() {
  const [isPresent, safeToRemove] = usePresence();
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (isPresent) {
      const enterAnimation = async () => {
        await animate(scope.current, { opacity: 1 });
        await animate('li', { opacity: 1, x: 0 });
      };
      enterAnimation();
    } else {
      const exitAnimation = async () => {
        await animate('li', { opacity: 0, x: -100 });
        await animate(scope.current, { opacity: 0 });
        safeToRemove();
      };
      exitAnimation();
    }
  }, [isPresent]);

  return <ul ref={scope}>{/* items */}</ul>;
}
```

Removal is gated on that call. The documentation describes `safeToRemove` as the callback to invoke
*"when you're ready to remove the component from the DOM"* and **does not describe any fallback that
removes the node for you** — so an exit path that returns early, throws, or is guarded by a
dependency array that never fires leaves the element in the DOM with nothing on screen to explain
it.

## Gotchas

### ⚠️ Pitfall 1: Trying to Change an Exit Animation With Props on the Way Out
```tsx
// ❌ the outgoing slide never sees direction === 1 — it was removed in the render that set it,
// and a removed component receives no further props
<AnimatePresence>
  <Slide key={id} direction={direction} />
</AnimatePresence>

// ✅ pass it through AnimatePresence, which is still mounted, and read it with a dynamic
// variant or usePresenceData
<AnimatePresence custom={direction}>
  <Slide key={id} />
</AnimatePresence>
```
The symptom is specific and misleading: the exit *animates*, using whatever the value was on the
render **before** the removal. So it looks like an off-by-one bug in your direction logic, and you
spend the evening in the wrong file.

### ⚠️ Pitfall 2: `usePresence` Without a Guaranteed `safeToRemove`
```tsx
// ❌ the early return skips the callback, and the node stays mounted forever
useEffect(() => {
  if (isPresent) return;
  if (!videoRef.current) return; // ← nothing calls safeToRemove on this path
  fadeOutVideo().then(safeToRemove);
}, [isPresent]);

// ✅ every path out of the exit branch ends in safeToRemove
useEffect(() => {
  if (isPresent) return;
  if (!videoRef.current) {
    safeToRemove();
    return;
  }
  fadeOutVideo().then(safeToRemove).catch(safeToRemove);
}, [isPresent]);
```
Once you opt into `usePresence`, removal is your responsibility on **every** path, including the
error path — the docs describe the callback as the thing that removes the component and describe no
fallback that does it for you.

## Interview questions

**★ Why can't you just pass a new prop to change an exit animation, and what is the documented way?**
Because the component is no longer in the React tree — the docs put it plainly: there is *"no longer
a chance to update its props"*, so the render that removed the component cannot also update how it
leaves. The wrapper, however, is still mounted, so Motion routes the data through it: `custom` on
`AnimatePresence`, read either by a dynamic variant (a function taking the custom value) or inside
the child through `usePresenceData`. The classic case is a carousel that must exit left or right
depending on the swipe direction.

**★ When would you reach for `usePresence` instead of the `exit` prop?**
When the exit is not a Motion animation. `exit` covers "animate these values and then remove";
`usePresence` covers everything else — a sequence driven by `useAnimate`, a third-party animation, a
video fade, a WebGL teardown, or a deliberate timeout. It hands you `isPresent` and `safeToRemove`,
and the component stays in the DOM until you call the callback. The cost is that removal becomes
your responsibility on every code path, error paths included.

**★ What is the difference between `AnimatePresence` and `AnimateActivity`?**
The docs draw it precisely: *"Whereas AnimatePresence animates elements when they're added and
removed from the tree, AnimateActivity uses the Activity component to show and hide the children
with display: none, maintaining their internal state."* So the choice is really about state. An
unmounted tab loses its scroll position, its form input and its fetched data; a hidden `Activity`
keeps all three and can animate on the way out anyway. Two caveats before proposing it: it is
documented as *"currently available in Motion+ Early Access"*, and it *"requires motion@12.23.24 and
react@19.2.0 or above"*.

---

← [Modes: sync, wait and popLayout](01b-modes-sync-wait-poplayout.md) · [Explanations index](../README.md) · Next → [Nesting, propagation and the one-shot props](01d-nesting-propagation-and-one-shot-props.md)
