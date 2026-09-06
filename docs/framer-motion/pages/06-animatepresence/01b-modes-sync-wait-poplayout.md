---
title: "`AnimatePresence` modes: sync overlaps, wait is single-child only, and popLayout is absolute positioning with prerequisites"
sidebar_label: "`AnimatePresence` modes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [AnimatePresence](https://motion.dev/docs/react-animate-presence)
> (`mode`, and both `popLayout` troubleshooting entries), read from a 131-page raw mirror of
> motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on **React 19.2.8** —
> the React version was probed on the installed package; `motion` is not in this checkout's
> `node_modules`, so every Motion claim here is documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 `AnimatePresence` Modes: `sync`, `wait` and `popLayout`

**One prop decides how the outgoing and the incoming element share the screen — and two of the
three values carry documented constraints that are invisible until they bite.** `wait` is
specified for one child at a time, so a mapped list under it is outside the contract. `popLayout`
is implemented with `position: "absolute"`, which quietly makes the parent's `position` and any
custom child's `ref` part of your problem. `sync`, the default, refuses to arrange anything for
you and says so.

## `mode`: Controlling Overlap Between Outgoing and Incoming Elements
- **`'sync'`** (default) — exiting and entering elements animate **simultaneously**, overlapping in time.
- **`'wait'`** — the exiting element **fully completes** its exit animation before the entering element begins its own enter animation — a strictly sequential, non-overlapping transition (common for page/tab transitions where overlap would look visually confusing).
- **`'popLayout'`** — the exiting element is immediately removed from the **layout flow** (so surrounding elements reflow around it right away) while it continues its own visual exit animation independently, positioned absolutely — useful for list-item removal where you want surrounding items to immediately shift into the vacated space, rather than waiting for the exiting item's animation to finish first.

Upstream's own wording for each, because these three are easy to half-remember:

> *"In "sync" mode, elements animate in and out as soon as they're added/removed."*
>
> *"In "wait" mode, the entering element will wait until the exiting child has animated out, before it animates in."*
>
> *"Exiting elements will be "popped" out of the page layout, allowing surrounding elements to immediately reflow. Pairs especially well with the layout prop, so elements can animate to their new layout."*
>
> — [AnimatePresence → `mode`](https://motion.dev/docs/react-animate-presence)

🔴 **`"wait"` carries a documented limit that reads like a style note and is not one:**
> *"wait mode only supports one child at a time."* — ibid.

```tsx
// mode="popLayout" — a removed list item exits independently while siblings immediately reflow
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    // popLayout pops the exiting item out with position: "absolute", so the parent it is
    // positioned against must NOT be position: static — see Pitfall 2 below
    <motion.ul layout style={{ position: 'relative' }}>
      <AnimatePresence mode="popLayout">
        {todos.map((todo) => (
          <motion.li
            key={todo.id} // stable, unique key per item — REQUIRED for correct add/remove detection
            layout // combines with popLayout for smooth reflow of REMAINING items
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {todo.text}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
```

```tsx
// mode="sync" (default) — simultaneous, overlapping exit/enter, e.g. a crossfading background image
<AnimatePresence>
  <motion.img key={currentImageUrl} src={currentImageUrl} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
</AnimatePresence>
```

The `mode="wait"` example, and the tab-switcher scenario it comes from, are in
[exit animations](01-exit-animations.md).

---

## Gotchas

### ⚠️ Pitfall 1: Using `mode="wait"` for a List — It Is Documented as Single-Child Only
Not a matter of feel. The `mode` reference states the limit outright:

> *"wait mode only supports one child at a time."* — [AnimatePresence → `mode` → wait](https://motion.dev/docs/react-animate-presence)

```tsx
// ❌ UNSUPPORTED: "wait" is specified for one child at a time, and a mapped list hands
// AnimatePresence many. Whatever a multi-child "wait" does today is undocumented behaviour,
// not an API contract — it is not something to build a list interaction on.
<AnimatePresence mode="wait">
  {todos.map((todo) => (
    <motion.li key={todo.id} exit={{ opacity: 0 }}>{todo.text}</motion.li>
  ))}
</AnimatePresence>

// ✅ CORRECT: "popLayout" (or the default "sync") for LISTS of independently-animating items;
// reserve "wait" for the one-thing-replaces-another transitions it is specified for — a tab
// panel, a route, a single featured image — where exactly one child is under the wrapper.
<AnimatePresence mode="popLayout">
  {todos.map((todo) => (
    <motion.li key={todo.id} layout exit={{ opacity: 0 }}>{todo.text}</motion.li>
  ))}
</AnimatePresence>
```

### ⚠️ Pitfall 2: `popLayout` Inside a `position: static` Parent
`popLayout` does not merely "take the item out of flow" — the docs name the mechanism, and the
mechanism has a prerequisite the mode itself will not enforce for you.

> *"mode="popLayout" works by using position: "absolute". So to ensure consistent and expected positioning during a layout animation, ensure that the animating parent has a position other than "static"."* — [AnimatePresence → Troubleshooting](https://motion.dev/docs/react-animate-presence)

> *"When any HTML element has an active transform it temporarily becomes the offset parent of its children. This can cause children with position: "absolute" not to appear where you expect."* — ibid.

Read the second quote twice: an ancestor can *become* the offset parent for the duration of an
animation. That is why this misbehaves intermittently — the exiting item lands where you expect
while nothing else is moving, and somewhere else while a parent is mid-transform.

```tsx
// ❌ the <ul> is position: static (the default), so the popped <li> is positioned against
// whichever ancestor happens to be non-static at that moment — including an ancestor that is
// only the offset parent while it holds a transform
<motion.ul layout>
  <AnimatePresence mode="popLayout">
    {items.map((item) => (
      <motion.li layout key={item.id} exit={{ opacity: 0 }}>{item.label}</motion.li>
    ))}
  </AnimatePresence>
</motion.ul>

// ✅ pin the offset parent explicitly on the element the items actually belong to
<motion.ul layout style={{ position: 'relative' }}>
  <AnimatePresence mode="popLayout">
    {items.map((item) => (
      <motion.li layout key={item.id} exit={{ opacity: 0 }}>{item.label}</motion.li>
    ))}
  </AnimatePresence>
</motion.ul>
```

### ⚠️ Pitfall 3: In `popLayout`, a Custom Component Child Still Needs `forwardRef` — on React 19 Too
React 19 passes `ref` through as an ordinary prop, so the `forwardRef` wrapper that
[core concepts](../01-core-concepts/01-declarative-animation-philosophy.md) retired for
`motion.create()` is gone almost everywhere. This is the documented exception:

> *"When using popLayout mode, any immediate child of AnimatePresence that's a custom component must be wrapped in React's forwardRef function, forwarding the provided ref to the DOM node you wish to pop out of the layout."* — [AnimatePresence → `mode` → popLayout](https://motion.dev/docs/react-animate-presence)

```tsx
// ❌ AnimatePresence has no handle on a DOM node, so it cannot pop this child out of the layout
<AnimatePresence mode="popLayout">
  {items.map((item) => <Row key={item.id} item={item} />)}
</AnimatePresence>

// ✅ the child forwards a ref to the node that should be popped
const Row = React.forwardRef<HTMLLIElement, { item: Item }>(function Row({ item }, ref) {
  return (
    <motion.li ref={ref} layout exit={{ opacity: 0 }}>
      {item.label}
    </motion.li>
  );
});
```

⚠️ The mechanism underneath is unchanged — Motion has to reach the real DOM node to set
`position: absolute` on it — but **the documentation does not state whether a plain React 19
component that reads `props.ref` satisfies this requirement**, only that `forwardRef` does. Until
it says otherwise, wrap it; a page that guesses here is guessing about a silent no-op.

### ⚠️ Pitfall 4: Blaming `mode="sync"` for a Layout Collision It Explicitly Does Not Handle
In the default mode the outgoing and incoming elements are both in the layout at once, and Motion
says plainly that arranging them is not its job:

> *"This is the most basic (and default) mode - AnimatePresence takes no opinion on sequencing animations or layout. Therefore, if element layouts conflict (as in the above example), you can either implement your own solution (using position: absolute or similar), or try one of the other two mode options."* — [AnimatePresence → `mode` → sync](https://motion.dev/docs/react-animate-presence)

So a crossfade that pushes the page height around under `sync` has three documented answers, and
"add a delay" is not one of them: position both elements yourself, switch to `wait` (single child
only), or switch to `popLayout`. Picking `sync` for a crossfading image is right precisely *because*
that image is absolutely positioned or fixed-size already.

## Interview questions

**★ Someone put `mode="wait"` on a mapped list. What do you tell them?**
That it is outside the documented contract, not merely a taste mismatch — the `mode` reference says
*"wait mode only supports one child at a time."* Whatever the list does today is undocumented
behaviour. `wait` is for the singular hand-off: one tab panel replacing another, one route replacing
another, one image replacing another, always exactly one child under the wrapper. For a list, that
is `popLayout` when you want the survivors to close the gap immediately, or the default `sync` when
overlap is fine.

**★ What does `popLayout` actually do to the exiting element, and what has to be true around it?**
It pops the element out of the page layout so surrounding elements can reflow immediately, and it
does that with `position: absolute` — the docs state the mechanism explicitly. Two consequences
follow, both documented and both easy to miss. The animating parent must have a position other than
`static`, or the popped element is positioned against some arbitrary ancestor — and worse,
intermittently, because an element with an active transform temporarily becomes the offset parent of
its children. And any immediate child that is a custom component must be wrapped in `forwardRef`
forwarding a ref to the node you want popped, which is the one place React 19's ref-as-prop change
does not let you drop the wrapper. It pairs with the `layout` prop, which is what animates the
remaining items into the gap rather than snapping them.

**★ In the default mode, two elements briefly sit on top of each other. Whose problem is that?**
Yours, by design. `sync` "takes no opinion on sequencing animations or layout" — both elements are in
the layout simultaneously because that is the definition of the mode. The documented options are to
position them yourself (`position: absolute` or similar), move to `wait` so the exit finishes before
the enter starts, or move to `popLayout` so the exiting element leaves the layout immediately.
Reaching for a `delay` on the enter transition instead papers over it: the elements still overlap,
you have just made the overlap shorter and the interaction slower.

---

← [Exit animations](01-exit-animations.md) · [Explanations index](../README.md) · Next → [Presence state and manual removal](01c-presence-state-and-manual-removal.md)
