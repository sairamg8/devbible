---
title: "A shared layout animation is a matching problem, not an animation problem — LayoutGroup, AnimatePresence and which transition actually wins"
sidebar_label: "01c · Shared layout coordination"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Layout animation](https://motion.dev/docs/react-layout-animations),
> [LayoutGroup](https://motion.dev/docs/react-layout-group),
> [AnimatePresence](https://motion.dev/docs/react-animate-presence) and
> [Motion component](https://motion.dev/docs/react-motion-component), read from a 131-page
> raw mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`)
> on **React 19.2.8** — React version probed on the installed package; `motion` is not
> installed in this checkout, so every API claim here is documentation-verified.
> **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**`layout` on one element is a solved problem. The hard part is everything around it: whose render triggers the measurement, which of two elements Motion decides are "the same" element, which `transition` object wins when both ends declare one, and how an element animates back to where it came from after React has already unmounted it.** All four have documented answers, and all four fail quietly when you guess.

## Who triggers the measurement — and why siblings do not

The trigger is a commit, and a commit is per-component:

> *"motion components with a layout prop will perform layout animations every time they commit a React render, or (if set) when their layoutDependency prop changes."*

So two accordion items that each hold their own `isOpen` state affect each other's layout but never learn about it — only the one that re-rendered measures:

> *"When one re-renders, for performance reasons the other won't be able to detect changes to its layout."*

That is a deliberate performance decision, not an oversight, and the opt-in is `LayoutGroup`:

```tsx
import { LayoutGroup } from 'motion/react';

function Accordion() {
  return (
    <LayoutGroup>
      <ToggleContent />
      <ToggleContent />
    </LayoutGroup>
  );
}
```

> *"When layout changes are detected in any grouped motion component, layout animations will trigger across all of them."*

The cost is exactly the benefit inverted: every grouped component now measures when any of them commits. `LayoutGroup` is a scope you draw deliberately, not a wrapper you put at the root.

## `layoutId` is a global namespace, and that is the second job of `LayoutGroup`

> *"layoutId is global across your site."*

This matters the moment a component that renders a `layoutId` is used more than once. Two tab rows on the same page, each with a `motion.div layoutId="underline"`, are four elements competing for two identities — and Motion has no way to know you meant them to be separate. `LayoutGroup` takes an `id` that namespaces every `layoutId` inside it:

```tsx
function TabRow({ id, items }: { id: string; items: Tab[] }) {
  return (
    <LayoutGroup id={id}>
      {items.map((item) => <Tab key={item.label} {...item} />)}
    </LayoutGroup>
  );
}

function Tab({ label, isSelected }: Tab) {
  return (
    <li>
      {label}
      {isSelected ? <motion.div layoutId="underline" /> : null}
    </li>
  );
}
```

The `Tab` component keeps a plain literal `layoutId`; the caller supplies the scope. That is the shape to copy — building the uniqueness into the string at the leaf works too, but it pushes an ownership concern into a component that should not care.

## Animating back to where it came from needs `AnimatePresence`

A shared transition is two elements swapping identity. Going *forward* works with nothing extra, because the new element exists when the old one is measured. Going *back* does not: React unmounts the modal, and there is nothing left to animate home from.

> *"To animate an element back to its origin, you can use the AnimatePresence component to keep it in the DOM until its exit animation has finished."*

```tsx
<AnimatePresence>
  {isOpen && <motion.div layoutId="modal" />}
</AnimatePresence>
```

## Which `transition` wins in a shared transition

This is the rule people get wrong, and it is stated plainly:

> *"When performing a shared layout animation, the transition defined for element we're animating to will be used."*

(The missing "the" is upstream's, not a transcription slip.) The consequence is counter-intuitive: the transition that governs **closing** the modal lives on the *button*, because the button is what you are animating *to*.

```tsx
<>
  <motion.button
    layoutId="modal"
    onClick={() => setIsOpen(true)}
    // used when the modal CLOSES — the button is the destination
    transition={{ type: 'spring' }}
  >
    Open
  </motion.button>
  <AnimatePresence>
    {isOpen && (
      <motion.dialog
        layoutId="modal"
        // used when the modal OPENS — the dialog is the destination
        transition={{ duration: 0.3 }}
      />
    )}
  </AnimatePresence>
</>
```

Put the open transition on the dialog, notice the close feels wrong, and the instinct is to tune the dialog harder. The knob is on the other element.

## A bare `transition` also governs everything else on the element

`transition={{ duration: 0.3 }}` on a `layout` element applies to the layout animation *and* to `opacity`, colour, and every other animated value. The documented separation is a nested `layout` key:

```tsx
<motion.div
  layout
  animate={{ opacity: 0.5 }}
  transition={{
    ease: 'linear',        // everything else
    layout: { duration: 0.3 }, // the layout animation only
  }}
/>
```

## Gotchas

### ⚠️ Pitfall 1: Two Sibling Components That Push Each Other Around, Only One of Which Animates
**Symptom.** Open the first accordion item; it animates, the second one jumps. **Cause.** Only the component that re-rendered measured itself — for performance reasons the sibling cannot detect that its own layout changed. **Fix.** Wrap the set in `LayoutGroup`, which triggers layout animations across all grouped components when any of them detects a change. Do not reach for a shared parent state instead; that re-renders the whole list to solve a measurement problem.

### ⚠️ Pitfall 2: The Same `layoutId` Reused by a Component Rendered Twice
**Symptom.** Selecting a tab in the second row makes an underline fly across the page from the first row. **Cause.** `layoutId` is global across your site, so both rows are claiming the identity `"underline"`. **Fix.** `LayoutGroup id={rowId}` around each row. 🔴 This is the failure that only appears once the component is reused, which is usually well after it was written and tested in isolation.

### ⚠️ Pitfall 3: Tuning the Transition on the Element You Are Animating *From*
**Symptom.** The modal opens with the timing you set; it closes with the timing you did not. **Cause.** The transition of the destination element is used, so the closing animation reads its config from the element the modal is collapsing into. **Fix.** Put the closing transition on the trigger element and the opening transition on the overlay, and comment which is which — this is not guessable from the call site.

### ⚠️ Pitfall 4: A Single `transition` Object Silently Retiming Everything Else
**Symptom.** You slow the layout animation down to 0.6s and the fade you were happy with becomes sluggish too. **Cause.** A bare `transition` covers every animating value on that component. **Fix.** Move the layout timing into the nested `layout` key and leave the top level for everything else:

```tsx
<motion.div layout animate={{ opacity: 1 }} transition={{ duration: 0.2, layout: { duration: 0.6 } }} />
```

### ⚠️ Pitfall 5: The Shared Element Animates Out, Then Snaps Home
**Symptom.** Opening the detail view morphs beautifully; closing it teleports. **Cause.** React unmounted the detail element, so there is nothing on screen to animate back from. **Fix.** Keep it mounted through its exit with `AnimatePresence`; the docs name this exact use — keeping the element in the DOM until its exit animation has finished.

### ⚠️ Pitfall 6: `mode="popLayout"` With a Custom Child, on React 19
🔴 **This is the one place in this corpus where `forwardRef` is still required despite React 19 passing `ref` through props.**

> *"When using popLayout mode, any immediate child of AnimatePresence that's a custom component must be wrapped in React's forwardRef function, forwarding the provided ref to the DOM node you wish to pop out of the layout."*

`popLayout` earns the constraint — it is the mode that pairs with `layout`:

> *"Exiting elements will be "popped" out of the page layout, allowing surrounding elements to immediately reflow. Pairs especially well with the layout prop, so elements can animate to their new layout."*

```tsx
const Item = React.forwardRef<HTMLLIElement, ItemProps>((props, ref) => (
  <motion.li ref={ref} layout exit={{ opacity: 0 }} {...props} />
));
```

Do not sweep `forwardRef` out of this file on the strength of "React 19 does not need it". Elsewhere in the track that sweep is correct; here it breaks the mode.

### ⚠️ Pitfall 7: `popLayout` Inside a `position: static` Parent
**Symptom.** Items pop to the top-left of the page, or to somewhere unrelated, as they exit. **Cause.** The AnimatePresence troubleshooting section states that `popLayout` works by using `position: "absolute"`, so the exiting element is positioned against the nearest positioned ancestor — and a `static` parent is not one. **Fix.** Give the animating parent a position other than `static`:

```tsx
<motion.ul layout style={{ position: 'relative' }}>
  <AnimatePresence mode="popLayout">
    {items.map((item) => <motion.li layout key={item.id} />)}
  </AnimatePresence>
</motion.ul>
```

### ⚠️ Pitfall 8: Elements *Outside* `AnimatePresence` Not Reacting to an Exit
**Symptom.** An item is removed with a nice exit animation; the container around it snaps to its new height. **Cause.** The container is not inside `AnimatePresence` and never learns that the layout changed. The AnimatePresence docs address this directly: when mixing exit and layout animations it may be necessary to wrap the group in `LayoutGroup` so components outside `AnimatePresence` know when to perform a layout animation. **Fix.** Wrap the whole group — container included — in `LayoutGroup`.

### ⚠️ Pitfall 9: `onAnimationComplete` Never Fires For a Layout Animation
**Symptom.** The callback you attached to know when the morph finished never runs. **Cause.** The motion component reference documents `onAnimationStart` and `onAnimationComplete` as covering any animation **except** layout animations, which have their own pair. **Fix.** Use `onLayoutAnimationStart` and `onLayoutAnimationComplete`. This is a straight naming trap: nothing warns you, the callback simply stays silent.

```tsx
<motion.div layout onLayoutAnimationComplete={() => setDone(true)} />
```

## Interview questions

**★ Two accordion items sit side by side. Opening one animates it and makes the other jump. Why, and what is the fix?**
Layout animations fire when the component commits a render, so only the item that changed state measured itself; its sibling was pushed down by the browser but never re-rendered, and the docs are explicit that for performance reasons it cannot detect the change. `LayoutGroup` opts them into a shared trigger — when any grouped component detects a layout change, all of them animate. The wrong fix is hoisting `isOpen` into the parent so both re-render: that solves the symptom by re-rendering the whole list, and you have bought a render to get a measurement.

**★ What is the second, unrelated job `LayoutGroup` does, and when do you need it?**
Namespacing. `layoutId` is global across the site, so a component that renders `layoutId="underline"` and is used in two tab rows creates a collision the moment both are on screen — the underline flies between rows. `LayoutGroup id={...}` scopes every `layoutId` beneath it, which lets the leaf component keep a plain literal id and pushes the uniqueness concern to the caller that actually knows how many instances exist.

**★ You set `transition` on the modal and the open animation is right but the close is wrong. Explain.**
In a shared layout animation, the transition used is the one defined on the element being animated *to*. Opening animates to the dialog, so the dialog's transition governs it; closing animates back to the trigger button, so the *button's* transition governs it. The knob for the close is on an element that is not the modal, which is why tuning the modal harder never helps.

**★ Why does a shared element transition work going forward but teleport coming back?**
Because coming back, React has already unmounted the element you were animating from. Motion needs both boxes to interpolate between, and a component removed from the tree in the same commit leaves nothing to measure. `AnimatePresence` keeps it in the DOM until its exit animation has finished, which is precisely the use the docs put it to for layout animations.

**★ This corpus is on React 19, where `ref` is passed as an ordinary prop. Is there any remaining reason to write `forwardRef`?**
Yes, exactly one in this area: with `AnimatePresence mode="popLayout"`, any immediate child that is a custom component must be wrapped in `forwardRef`, forwarding the ref to the DOM node to be popped out of the layout. That is stated as a requirement of the mode, not of React's version. So a blanket "React 19 killed `forwardRef`" sweep across a Motion codebase will break `popLayout` lists — the rule needs a context check, not a regex.

**★ Items in a `popLayout` list fly to the top-left corner as they leave. What is the likely cause?**
`popLayout` works by absolutely positioning the exiting element so surrounding items can reflow immediately. An absolutely positioned element resolves against its nearest positioned ancestor; if the list container is `position: static`, that ancestor is somewhere much further up the tree — often the viewport. Giving the animating parent any position other than `static`, usually `relative`, puts the exiting element back where it belongs.

**★ How do you give a layout animation a different duration from the opacity fade on the same element?**
Nest it. A bare `transition` object applies to every animating value on the component, so `transition={{ duration: 0.6 }}` slows the fade as well. The layout animation can be configured independently under a `layout` key inside `transition`, leaving the top level to govern everything else.

**★ Why does `onAnimationComplete` not fire for a layout animation, and what does that tell you about the architecture?**
Because layout animations are explicitly excluded from `onAnimationStart` and `onAnimationComplete`, which have dedicated `onLayoutAnimationStart` and `onLayoutAnimationComplete` counterparts. The split is a hint about the internals: a layout animation is not a value animation with a different source, it is a separate projection pass driven by measurement, and it has its own lifecycle to report. Treating the two callback families as interchangeable produces a callback that silently never runs.

---

← [Silent failure modes](01b-when-layout-animations-fail-silently.md) · [Explanations](../README.md) · Next → [Measuring inside a moving container](01d-scroll-fixed-and-anchored-containers.md)
