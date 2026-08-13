---
title: "Render order"
sidebar_label: "12 · Render order"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Render and Commit](https://react.dev/learn/render-and-commit) and
> [`useState`](https://react.dev/reference/react/useState). No sandbox script
> backs this page; claims are cited, not measured. Fiber internals are
> [Phase 0](../phase-0-how-react-runs/05-fiber.md).

**Parents render before children, top-down, depth-first. That single fact
answers "why did this render?" more often than any other, and it is also why a
child cannot influence what its parent renders.**

## The order

react.dev:

> This process is recursive: if the updated component returns some other
> component, React will render *that* component next, and if that component also
> returns something, it will render *that* component next, and so on. The process
> will continue until there are no more nested components and React knows exactly
> what should be displayed on screen.

So for

```jsx
<App>
  <Header />
  <Main>
    <Sidebar />
    <Content />
  </Main>
  <Footer />
</App>
```

the order is `App`, `Header`, `Main`, `Sidebar`, `Content`, `Footer` — each
parent completed before its children, siblings in JSX order. Depth-first, and it
must be: React cannot know what `Main`'s children are until `Main` has run and
returned them.

## Three consequences

**1. "The parent re-rendered" is usually the answer.** Since a state update
re-renders that component and everything below, most renders in a profile are
descendants of one update near the top. When asking why a leaf rendered, look up
before looking at the leaf.

**2. A child cannot affect its parent's current render.** By the time the child
runs, the parent has finished and returned. This is why calling another
component's setter during render is an error — `Cannot update a component while
rendering a different component` — and why data flows down. The child's request
becomes a *new* render, starting from the top again.

**3. Props are computed before the child runs.** `<Child value={expensive()} />`
calls `expensive()` during the *parent's* render, whether or not the child ends
up rendering, and even if the child is `memo`'d. Memoizing the child does not
memoize the props expression that feeds it — a genuinely common misunderstanding
about what `memo` buys you.

## Render, then commit — and effects last

Rendering is only the first of the three steps the docs name: **trigger, render,
commit**. The ordering of what runs when is worth having straight, because
several bugs are really ordering surprises:

| Phase | Order | Notes |
|---|---|---|
| Render | Parents → children | Pure. No DOM exists yet for this update |
| Commit | React mutates the DOM | Minimal operations, computed during render |
| Layout effects | **Children → parents** | `useLayoutEffect`, before paint |
| Paint | The browser draws | |
| Effects | **Children → parents** | `useEffect`, after paint |

**Effects run bottom-up while rendering runs top-down.** That is not arbitrary:
by the time a parent's effect runs, its children have mounted and their refs are
attached, so a parent measuring a child works. Reverse the order and it could
not.

The practical corollary is that **`ref.current` is `null` during render and
populated in effects**, which is the single most common ref confusion and is
explained entirely by this table.

## What the order does not guarantee

Three things people assume and should not:

**That rendering means committing.** React can render and then throw the work
away — a transition interrupted by a more urgent update, a Suspense boundary
that suspends. Side effects placed in a render body may therefore happen for a
render nobody sees ([Phase 2 · purity](../phase-2-components/02-purity/02-what-is-allowed.md)).

**That order implies timing.** Under concurrent rendering React can render part
of the tree, yield to the browser, and continue later. The *order* holds; the
elapsed time between two components rendering does not.

**That siblings are independent.** They are rendered in JSX order, so a sibling
that suspends can affect what a later sibling gets to do in that pass. Order is
a sequence, not isolation.

## Reading a profile with this in mind

The Profiler shows a flame chart per commit, and the shape follows the order
above: the widest bar at the top is the component whose state changed, and
everything nested inside it is a descendant that rendered because of it. So:

- **A wide top bar** — the update started too high. Move the state down.
- **A deep, narrow spike** — one expensive leaf. Memoize or split that leaf.
- **The same subtree in every commit** — a candidate for the `children` trick,
  since it is re-rendering for a parent's reasons rather than its own.

Phase 0's [DevTools and Profiler](../phase-0-how-react-runs/12-devtools-and-profiler.md)
covers the tooling; Phase 6 covers acting on it.

## Gotchas

**Symptom:** an expensive prop expression runs even though the child is
memoized.
**Cause:** props are evaluated during the parent's render, before the child is
considered.
**Fix:** `useMemo` the value, or move the computation into the child.

**Symptom:** `Cannot update a component while rendering a different component`.
**Cause:** a setter for another component called during render, which the
top-down order makes impossible to honour in the current pass.
**Fix:** an event handler or an effect. Updating *your own* state during render
is the one allowed case ([topic 16](16-updating-state-during-render.md)).

**Symptom:** `ref.current` is `null` in the component body.
**Cause:** refs are attached during commit, which is after render.
**Fix:** read refs in effects and handlers.

**Symptom:** a parent's effect cannot measure its child.
**Cause:** it can — effects run children-first, so the child is mounted by then.
If it is failing, the ref is not attached to what you think.
**Fix:** check the ref target rather than the ordering.

**Symptom:** a component rendered but its DOM did not change.
**Cause:** normal. React commits only the minimal differences, and nothing at
all when the output is identical.
**Fix:** nothing — and it means the render was cheap.

## Interview questions

**★ In what order does React render components?**
Top-down and depth-first: a parent runs to completion, then its children in JSX
order, recursively. It has to be that way, because React cannot know what a
component's children are until the component has returned them.

**★ Why is "the parent re-rendered" the most common answer to "why did this
render"?**
Because a state update re-renders that component and every descendant by
default — props are not compared on the default path. So most renders in a
profile are consequences of one update higher up, and the useful question is
always which ancestor's state changed.

**★ Why do effects run bottom-up when rendering runs top-down?**
So that by the time a parent's effect runs, its children have mounted and their
refs are attached. That makes "measure my child in an effect" work. It also
explains why `ref.current` is `null` during render — refs are attached during
commit, which happens between render and effects.

**Does memoizing a child stop its props from being computed?**
No. Props are evaluated in the parent's render, before React even considers the
child. `<Child value={expensive()} />` calls `expensive()` regardless of whether
`Child` re-renders. To avoid the work you have to memoize the value or move the
computation inside the child.

**Does render order imply timing?**
No. Under concurrent rendering React can render part of the tree, yield to the
browser, and resume later, and it can discard a render that never commits. The
sequence of component calls is guaranteed; how much time passes between them,
and whether the result is shown at all, is not.

**Why can't a child update its parent during render?**
Because the parent has already run and returned by the time the child renders —
there is nothing left to influence in that pass. React raises "Cannot update a
component while rendering a different component" for this. The child's request
has to become a new render starting from the top, which is what an event handler
or an effect produces.

---

← Prev: [Bailing out](11-bailing-out.md) · Index: [Phase 3](README.md) · Next → [The update queue](13-the-update-queue.md)
