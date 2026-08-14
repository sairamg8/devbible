---
title: "Effect ordering"
sidebar_label: "13 · Effect ordering"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useInsertionEffect`](https://react.dev/reference/react/useInsertionEffect)
> (which documents the phased ordering by contrast),
> [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect) and
> [`useEffect`](https://react.dev/reference/react/useEffect).
> The render-order table it builds on is
> [Phase 3 · 12](../phase-3-state/12-render-order.md).
> No sandbox script backs this page; claims are cited, not measured.

**Within one commit React runs three kinds of effect in three separate passes,
and inside each pass it runs *every* cleanup before *any* setup. Both facts
explain bugs that look inexplicable otherwise.**

## The passes, in order

[Phase 3 · 12](../phase-3-state/12-render-order.md) established the shape:
rendering goes parents → children, effects go **children → parents**, and layout
effects run before paint while passive effects run after. Filling in the third
kind:

| Pass | Hook | Position |
|---|---|---|
| 1 | `useInsertionEffect` | *"allows inserting elements into the DOM before any layout Effects fire"* |
| — | React mutates the DOM | |
| 2 | `useLayoutEffect` | before the browser repaints |
| — | The browser paints | |
| 3 | `useEffect` | after paint |

Each pass runs across the **whole commit** before the next begins. So every
layout effect in the tree has finished before any passive effect starts —
regardless of which components they belong to.

That is why `useInsertionEffect` can promise what it promises:

> `useInsertionEffect` is better than inserting styles during `useLayoutEffect`
> or `useEffect` because it ensures that **by the time other Effects run in your
> components, the `<style>` tags have already been inserted.**

## 🔴 All cleanups, then all setups

The load-bearing fact, documented on the `useInsertionEffect` page as the thing
that hook is an exception to:

> Unlike other types of Effects, **which fire cleanup for every Effect and then
> setup for every Effect**, `useInsertionEffect` will fire both cleanup and setup
> one component at a time. This results in an "interleaving" of the cleanup and
> setup functions.

Read the subordinate clause: for `useEffect` and `useLayoutEffect`, a commit runs
**every cleanup in the pass, and only then every setup.** Not per component, and
not interleaved.

The consequence is worth stating plainly. When a setup runs, **every effect that
was going to be torn down in that pass has already been torn down** — including
effects belonging to other components entirely. So:

- Two components can safely hold the same exclusive resource across an update.
  The old one has released it before the new one acquires it, even though they are
  different components.
- A setup cannot observe a *stale* subscription belonging to a sibling that is
  also updating in this commit.
- But a setup also cannot rely on a sibling's previous effect still being active —
  it is gone by then, even if that sibling is not unmounting.

This is also the tree-wide version of the per-effect ordering from
[topic 02](02-useeffect-anatomy.md): cleanup with the old values, then setup with
the new. The pairing holds at both scales, which is what makes
[topic 04](04-cleanup/01-the-cleanup-contract.md)'s invariant meaningful — setup
is always preceded by its own cleanup, never by another setup.

## Why children run before parents

The direction is not arbitrary:

> By the time a parent's effect runs, its children have mounted and their refs
> are attached, so a parent measuring a child works.

Reverse it and a parent's effect would run against children that had not attached
their refs yet. **The bottom-up order is what makes `ref.current` reliable inside
an effect**, and it is the same reason `ref.current` is `null` during render.

## The two documented exceptions

**`useInsertionEffect` interleaves.** Cleanup and setup one component at a time,
as quoted above. It is also the only effect type where *"refs are not attached
yet"* and where *"you can't update state"*. It exists for CSS-in-JS libraries and
[topic 17](17-useinsertioneffect.md) covers why.

**A state update in a layout effect pulls the rest forward:**

> If you trigger a state update inside `useLayoutEffect`, React will **execute all
> remaining Effects immediately including `useEffect`.**

So the neat three-pass picture collapses when a layout effect sets state — passive
effects that would have run after paint get dragged into the pre-paint window.
That is a performance trap ([topic 12](12-uselayouteffect.md)) *and* an ordering
one: an effect you wrote expecting to run after paint may not.

## What the order does not give you

Three assumptions to avoid, all inherited from
[Phase 3 · 12](../phase-3-state/12-render-order.md):

- **Order is not timing.** Under concurrent rendering React can yield between
  units of work. The sequence holds; the elapsed time between two effects does
  not.
- **A render is not a commit.** Effects only run for commits, and React may throw
  rendered work away.
- **Order is not isolation.** Siblings run in a defined sequence, which is not the
  same as being independent of one another.

And one specific to this topic: **`useInsertionEffect` "may run either before or
after the DOM has been updated. You shouldn't rely on the DOM being updated at any
particular time."** Its position relative to *other effects* is guaranteed; its
position relative to the DOM mutation is not.

## Gotchas

**Symptom:** a parent's effect reads `ref.current` and gets `null`.
**Cause:** almost never ordering — effects run children-first, so the ref is
attached. Usually the ref is on a conditionally rendered node, or was never passed
to a DOM element.
**Fix:** check that the element actually renders. The ordering is on your side
here.

**Symptom:** two components briefly hold the same exclusive resource — a lock, a
port, a singleton connection — during an update.
**Cause:** an incomplete cleanup, not the ordering. All cleanups in a pass run
before any setup, so a correct cleanup guarantees release before acquisition.
**Fix:** make the cleanup symmetrical
([topic 04](04-cleanup/01-the-cleanup-contract.md)).

**Symptom:** an effect assumes a sibling component's subscription is still active
and finds it gone.
**Cause:** that sibling's cleanup ran in the same pass, before this setup, even
though the sibling is not unmounting.
**Fix:** do not couple effects across components through liveness. If they share
something, lift it.

**Symptom:** a `useEffect` that was written to run after paint appears to run
before it.
**Cause:** a `useLayoutEffect` somewhere set state, so React executed all
remaining effects immediately.
**Fix:** avoid setting state in layout effects unless the visual correction needs
it.

**Symptom:** styles injected in a `useLayoutEffect` are not present when another
component's layout effect measures.
**Cause:** both are in the same pass with no ordering guarantee between the two
components beyond children-before-parents.
**Fix:** `useInsertionEffect` — it exists precisely so styles are in place before
any layout effect runs.

**Symptom:** reasoning about ordering to make two effects cooperate.
**Cause:** using ordering as a coordination mechanism.
**Fix:** ordering is for understanding failures, not for building on. If two
effects must agree, they should share state or be one effect
([topic 09](09-effect-lifecycle.md)).

## Interview questions

**★ In one commit, what order do effects run in?**
Three passes across the whole tree: insertion effects first (before any layout
effect fires), then React mutates the DOM and layout effects run before paint,
then the browser paints and passive `useEffect`s run. Within each pass, effects
run children before parents. Each pass completes across the entire commit before
the next begins.

**★ Within a pass, does React run cleanup and setup per component or in phases?**
In phases — every cleanup first, then every setup. react.dev documents this by
contrast on the `useInsertionEffect` page, which is described as unlike other
Effects "which fire cleanup for every Effect and then setup for every Effect".
The practical consequence is that when any setup runs, everything being torn down
in that pass is already gone, including effects belonging to other components.

**★ Why do effects run children before parents?**
So that a parent's effect can rely on its children being mounted with their refs
attached — a parent measuring a child works only in this direction. It is the same
fact that explains why `ref.current` is `null` during render and populated by the
time effects run.

**Why can `useInsertionEffect` promise that styles are in place for other
effects?**
Because it is a separate, earlier pass — it inserts elements into the DOM before
any layout Effect fires, and the passes run to completion in order across the
whole commit. It is also the documented exception to the phased rule: it
interleaves cleanup and setup one component at a time rather than running all
cleanups first.

**What breaks the three-pass picture?**
A state update inside `useLayoutEffect`. React then executes all remaining
effects immediately, including passive ones, so `useEffect`s that were written to
run after paint end up inside the pre-paint window. It is both a performance
problem and an ordering surprise, and it is the main reason to avoid setting state
in a layout effect unless the visual correction requires it.

**Should you rely on effect ordering when designing components?**
No. Order is useful for explaining a failure, not for building coordination on
top of — and several nearby things it looks like it guarantees, it does not:
ordering is not timing under concurrent rendering, a render is not necessarily a
commit, and `useInsertionEffect`'s position relative to the DOM mutation is
explicitly unspecified. Two effects that must agree should share state or be one
effect.

---

← Prev: [`useLayoutEffect`](12-uselayouteffect.md) · Index: [Phase 4](README.md) · Next → [Timers, listeners and observers](14-timers-listeners-observers.md)
