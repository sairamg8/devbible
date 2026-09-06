---
title: "An inner `AnimatePresence` owns its children until you say `propagate` — and four props that only matter once you have hit the thing they fix"
sidebar_label: "`AnimatePresence` nesting & one-shot props"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [AnimatePresence](https://motion.dev/docs/react-animate-presence)
> (Propagate exit animations, Props, Troubleshooting) and [Layout animations](https://motion.dev/docs/react-layout-animations),
> read from a 131-page raw mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly
> `framer-motion`) on **React 19.2.8** — the React version was probed on the installed package;
> `motion` is not in this checkout's `node_modules`, so every Motion claim here is
> documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Nesting, Propagation and the One-Shot Props

**Every failure on this page is silent.** Nesting two `AnimatePresence` components does not warn
you that the inner one has quietly taken ownership of the exits you were expecting. Nothing tells
you that the entrance animations firing on a hard refresh are switched off by one prop. `popLayout`
inside a shadow root simply does not pop. These are the parts of the API you meet by hitting the
symptom first — so they are worth reading before you hit it.

## Nesting — an inner `AnimatePresence` does not know its parent is leaving

> *"By default, AnimatePresence controls the exit animations on all of its children, until another AnimatePresence component is rendered."* — [AnimatePresence → Propagate exit animations](https://motion.dev/docs/react-animate-presence)

> *"By setting an AnimatePresence component's propagate prop to true, when it's removed from another AnimatePresence it will fire all of its children's exit animations."* — ibid.

```tsx
<AnimatePresence>
  {show ? (
    <motion.section exit={{ opacity: 0 }}>
      <AnimatePresence propagate>
        {/* This exit prop will now fire when show is false */}
        <motion.div exit={{ x: -100 }} />
      </AnimatePresence>
    </motion.section>
  ) : null}
</AnimatePresence>
```

Without `propagate`, the section fades but everything inside it disappears the instant the section's
own exit finishes — which reads as "the list items did not animate" rather than as a nesting
problem.

## Exit runs through the whole exiting subtree

> *"Any motion components within the exiting component will fire animations defined on their exit props before the component is removed from the DOM."* — [AnimatePresence → Exit animations](https://motion.dev/docs/react-animate-presence)

> *"Like initial and animate, exit can be defined either as an object of values, or as a variant label."* — ibid.

Because `exit` takes a variant label, the ordinary variant orchestration applies to leaving as well
as arriving — `when: "afterChildren"` is how a modal waits for its contents to clear before it
collapses:

```tsx
const modalVariants = {
  visible: { opacity: 1, transition: { when: 'beforeChildren' } },
  hidden: { opacity: 0, transition: { when: 'afterChildren' } },
};

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="hidden" animate="visible" exit="hidden">
      {children}
    </motion.div>
  );
}
```

## The three props nobody reads until they need them

| Prop | What the docs say | Why you end up here |
|---|---|---|
| `initial` | *"By passing `initial={false}`, AnimatePresence will disable any initial animations on children that are present when the component is first rendered."* | Everything on the page animates in on first paint, including content that was always there. |
| `onExitComplete` | *"Fires when all exiting nodes have completed animating out."* | You need to scroll to top, focus something, or unlock a scroll lock *after* the old view is really gone. |
| `root` | *"Root element for injecting popLayout styles. Defaults to document.head but can be set to another ShadowRoot, for use within shadow DOM."* | `popLayout` does nothing inside a web component, and nothing in the console explains why. |

## Gotchas

### ⚠️ Pitfall 1: A Nested `AnimatePresence` Swallows Its Children's Exits
Removing a whole panel plays the panel's own `exit` and nothing else, because the inner
`AnimatePresence` has taken ownership of those children and does not know it is being removed.
Add `propagate` to the inner one. Note which end the prop goes on — it is set on the *inner*
wrapper, describing what happens when *it* is removed from an outer one, not on the outer wrapper.

### ⚠️ Pitfall 2: The Whole Page Animates In on First Paint
Every `motion` child of an `AnimatePresence` that is already present on the first render runs its
`initial` → `animate` transition, so a route that mounts with six visible cards plays six entrance
animations that nobody asked for on a hard refresh.

```tsx
// ✅ only animate presence CHANGES, not the initial mount
<AnimatePresence initial={false}>
  <Slide key={activeItem.id} />
</AnimatePresence>
```

### ⚠️ Pitfall 3: Mixing `exit` and `layout` Without `LayoutGroup`
> *"When mixing exit and layout animations, it might be necessary to wrap the group in LayoutGroup to ensure that components outside of AnimatePresence know when to perform a layout animation."* — [AnimatePresence → Troubleshooting](https://motion.dev/docs/react-animate-presence)

```tsx
<LayoutGroup>
  <motion.ul layout>
    <AnimatePresence>
      {items.map((item) => (
        <motion.li layout key={item.id} exit={{ opacity: 0 }}>{item.label}</motion.li>
      ))}
    </AnimatePresence>
  </motion.ul>
</LayoutGroup>
```
The tell is that elements *inside* the wrapper animate correctly while an element outside it — the
container, a counter, a sibling panel — snaps to its new size instead of animating. It never had any
way to learn that a presence change had happened.

### ⚠️ Pitfall 4: `popLayout` Inside a Shadow DOM
`popLayout` needs to inject styles, and by default it injects them into `document.head` — which a
shadow root does not see. Pass the shadow root as `root`. This is the failure that produces no error
at all: the mode is accepted, the exit runs, and the layout simply never pops.

### ⚠️ Pitfall 5: Assuming `onExitComplete` Fires Per Element
It is documented as firing *"when all exiting nodes have completed animating out"* — one callback for
the whole batch, not one per departing child. Using it to clean up a specific item's resources will
misfire the moment two items leave at once; use it for the things that are genuinely batch-scoped,
such as restoring scroll after a view swap.

## Interview questions

**★ A modal fades out correctly on its own, but when the whole section containing it is removed, nothing inside animates. What is happening?**
There are two `AnimatePresence` components, and by default *"AnimatePresence controls the exit
animations on all of its children, until another AnimatePresence component is rendered"*. The inner
one owns those children; when the outer one removes the section, the inner one is simply unmounted
along with it and never runs their exits. The fix is `propagate` on the **inner** wrapper: with it
set, being removed from another `AnimatePresence` fires all of its children's exit animations.

**★ What does `initial={false}` actually suppress, and when do you want it?**
It disables initial animations for children that are already present when the `AnimatePresence`
first renders. Without it, a hard refresh plays the mount animation for content that was never
absent — which is fine for a modal and wrong for a route or a list that is simply there. You still
get the full enter animation for anything that appears *later*, because that is a presence change
rather than a first render.

**What does `onExitComplete` guarantee, and what does it not?**
It fires when *all* exiting nodes have finished animating out — the batch, not the individual. That
makes it right for "the old view is gone, now restore scroll / move focus / release the scroll lock"
and wrong for per-item bookkeeping. It also says nothing about entering elements, so under
`mode="sync"` the incoming content may already be halfway through its own animation when it fires.

**How do you make a modal animate back into the element it came from?**
Shared layout, plus `AnimatePresence` to buy the time: give the trigger and the modal the same
`layoutId`, and wrap the modal in `AnimatePresence` — *"To animate an element back to its origin, you
can use the AnimatePresence component to keep it in the DOM until its exit animation has finished."*
Without the wrapper the modal's node is gone before the shared-layout transition has anywhere to
animate to. See [layout animations](../07-layout-animations/01-automatic-layout-transitions.md) for
the `layoutId` half.

---

← [Presence state and manual removal](01c-presence-state-and-manual-removal.md) · [Explanations index](../README.md) · Next → [Automatic layout transitions](../07-layout-animations/01-automatic-layout-transitions.md)
