---
title: "What triggers a re-render"
sidebar_label: "08 · What triggers a re-render"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Render and Commit](https://react.dev/learn/render-and-commit) and
> [`useState`](https://react.dev/reference/react/useState) caveats. No sandbox
> script backs this page; claims are cited, not measured.

**There are two reasons a component renders, and "its props changed" is not one
of them. Getting that backwards is the root of most wrong guesses about React
performance.**

## The two triggers

react.dev:

> There are two reasons for a component to render:
>
> 1. It's the component's **initial render.**
> 2. The component's (or one of its ancestors') **state has been updated.**

That is the complete list. Context counts as the second — a provider's value
changes because some component's state changed, and consumers are re-rendered as
a consequence.

So the practical version, and the sentence worth memorising:

> **A component re-renders because its parent re-rendered, or because its own
> state changed.**

## What does *not* trigger a render

Each of these is a real assumption people hold, and each is wrong:

| Not a trigger | Why |
|---|---|
| **A prop "changing"** | Props only change *because* the parent rendered. The parent render is the cause; the new prop is a symptom |
| **Mutating an object in state** | No setter was called ([topic 05](05-immutable-updates/README.md)) |
| **Writing to a ref** | Refs are deliberately outside the render cycle — that is their purpose |
| **Changing a module-level variable** | React is not watching it |
| **A `let` inside the component changing** | It is recreated every render anyway |
| **Time passing** | Nothing is polling |
| **The DOM changing from outside React** | React does not observe the DOM |
| **A promise resolving** | Until something calls a setter |

The first row is the important one. "React re-renders when props change" is
almost right and leads to exactly the wrong conclusion, because it implies that
a child with unchanged props will not re-render. It will — by default, every
descendant of a re-rendering component re-renders, regardless of props.

## Rendering is recursive, and it is not the DOM

> This process is recursive: if the updated component returns some other
> component, React will render *that* component next, and if that component also
> returns something, it will render *that* component next, and so on. The process
> will continue until there are no more nested components and React knows exactly
> what should be displayed on screen.

So one `setState` near the root calls a great many component functions. That is
by design, and it is cheaper than it sounds — **"render" means calling your
function and comparing the result**, not touching the DOM.

The commit step is where the DOM is involved, and React is conservative there:

> - **For the initial render,** React will use the `appendChild()` DOM API to put
>   all the DOM nodes it has created on screen.
> - **For re-renders,** React will apply the minimal necessary operations
>   (calculated while rendering!) to make the DOM match the latest rendering
>   output.

and the recap's last line:

> React does not touch the DOM if the rendering result is the same as last time.

**This is why "unnecessary re-render" is a weaker problem than it sounds.** A
component that re-renders and returns identical output costs one function call
and a reconciliation pass — no DOM work, no layout, no paint. Optimising renders
that produce no DOM changes is usually optimising the cheap part.

## The four things that stop the descent

Since the default is "everything below re-renders", it is worth knowing exactly
what interrupts it:

**1. The bail-out.** Setting state to a value `Object.is`-equal to the current
one. The docs' caveat is precise about what this does and does not guarantee:

> If the new value you provide is identical to the current `state`, as determined
> by an `Object.is` comparison, React will **skip re-rendering the component and
> its children.** This is an optimization. Although in some cases React may still
> need to call your component before skipping the children, it shouldn't affect
> your code.

Note "may still need to call your component" — a bail-out is not a promise that
your function will not run. [Topic 11](11-bailing-out.md).

**2. `memo`.** An explicit props comparison at that boundary. It is opt-in
precisely because comparing is not free and is usually not worth it.

**3. Unchanged element identity — the `children` trick.** If a parent receives
an element as a prop and merely renders it, that element object is unchanged
when the parent re-renders, so React skips that subtree. No API, no dependency
array. This is the technique from
[Phase 2 · lifting state up · the cost](../phase-2-components/05-lifting-state-up/02-the-cost.md),
and it is the cheapest of the four.

**4. The React Compiler**, which inserts memoization automatically at a finer
grain than `memo` — per value rather than per component — for components that
follow the rules.

## Answering "why did this render?"

A procedure, in the order that resolves it fastest:

1. **Did its own state change?** Look at the setters in that component.
2. **Did its parent render?** If so, that is the answer, and the question moves
   up a level. This is the answer most of the time.
3. **Did a context it consumes change?** A memoized component still re-renders
   for this — memoization does not stop context updates.
4. **Did its key change?** Then it did not re-render at all; it remounted, which
   is a different and more expensive event.

React DevTools' Profiler answers this directly — it labels each component in a
commit with why it rendered — and it is worth reaching for before theorising.
Phase 0's [DevTools page](../phase-0-how-react-runs/12-devtools-and-profiler.md)
covers the setup.

## When a re-render actually costs something

Since most re-renders are cheap, the ones worth caring about are specific:

- **A large subtree** — thousands of components, where even a cheap function
  call each adds up.
- **An expensive calculation during render** that is not memoized.
- **A high-frequency trigger** — a keystroke, a scroll, a pointer move,
  especially when the state lives far above its consumers.
- **A re-render that produces different output** and therefore real DOM work,
  layout and paint.

The structural fixes come first and beat memoization in every case: own state at
the right level, push it down to the component that uses it, and pass expensive
subtrees as `children`. Phase 6 has the measured treatment.

## Gotchas

**Symptom:** a child re-renders even though its props are identical.
**Cause:** its parent re-rendered. Props are not the trigger.
**Fix:** usually nothing. If it is genuinely expensive, restructure with
`children` before reaching for `memo`.

**Symptom:** nothing re-renders after data changes.
**Cause:** the object was mutated rather than replaced, or a ref was written to.
**Fix:** immutable update through a setter. Refs never trigger renders — that is
what they are for.

**Symptom:** a `memo`'d component re-renders on every update.
**Cause:** a prop is a fresh object or inline function each render, or it
consumes a changing context.
**Fix:** stabilise the props, or restructure. `memo` cannot stop a context
update.

**Symptom:** the whole app re-renders on every keystroke.
**Cause:** the input's state lives near the root.
**Fix:** move it down to the component that uses it. This is the fix, not
memoization.

**Symptom:** a component's effects re-run and its state resets, and someone
calls it "an extra re-render".
**Cause:** it is not a re-render — the key or the component type changed, so it
remounted.
**Fix:** distinguish the two before debugging. They have different causes and
different fixes.

**Symptom:** heavy optimisation work produced no measurable improvement.
**Cause:** the re-renders being eliminated produced no DOM changes, so they were
already nearly free.
**Fix:** profile first. React does not touch the DOM when the output is
unchanged.

## Interview questions

**★ What causes a component to re-render?**
Two things: its initial render, and a state update in itself or in one of its
ancestors. Context changes fall under the second, since a provider's value
changes because some component's state changed. Notably, a prop changing is not
a trigger — props change *because* the parent rendered, so the parent's render
is the cause and the new prop is a symptom.

**★ Does a component re-render when its props are unchanged?**
Yes, by default, if its parent re-rendered. React does not compare props on the
default path; comparison is what `memo` opts into. This is the single most
common wrong assumption about React rendering, and it is why "props changed" is
a misleading summary of the model.

**★ Why is an "unnecessary re-render" often not a problem?**
Because rendering means calling your function and reconciling the result, not
touching the DOM. React applies only the minimal DOM operations needed, and does
not touch the DOM at all when the output is unchanged. So a re-render that
produces identical output costs a function call and a diff — cheap compared to
the layout and paint people imagine.

**What stops React descending into children?**
Four things: a bail-out when the new state is `Object.is`-equal to the old,
`memo` comparing props at that boundary, an unchanged element identity — as when
a subtree is passed in as `children` and the wrapper merely renders it — and the
React Compiler's automatic memoization.

**How do you find out why something rendered?**
Check its own setters, then whether its parent rendered, then whether a context
it consumes changed, then whether its key changed — the last meaning it
remounted rather than re-rendered. The DevTools Profiler answers this directly
per commit and is faster than reasoning about it.

**Why doesn't writing to a ref re-render?**
Because refs are deliberately outside the render cycle. That is their purpose:
a mutable value that persists across renders without causing one. It is also
why reading a ref during render is unsupported — nothing guarantees the render
you are in reflects its current value.

---

← Prev: [Resetting state with `key`](07-resetting-state-with-key.md) · Index: [Phase 3](README.md) · Next → [Lazy initial state](09-lazy-initial-state.md)
