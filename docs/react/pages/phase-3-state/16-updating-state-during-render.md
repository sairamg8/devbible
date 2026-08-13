---
title: "Updating state during render"
sidebar_label: "16 · Updating state during render"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useState`](https://react.dev/reference/react/useState)
> §*Storing information from previous renders* and
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> §*Adjusting some state when a prop changes*. No sandbox script backs this page;
> claims are cited, not measured.

**Calling a setter during render is legal, documented, and almost always the
wrong tool. It exists for one narrow case — adjusting part of your own state when
a prop changes — and the docs spend most of their space telling you to avoid
needing it.**

## The rules

> Calling the `set` function *during rendering* is only allowed from within the
> currently rendering component. React will discard its output and immediately
> attempt to render it again with the new state. This pattern is rarely needed,
> but you can use it to **store information from the previous renders**.

The five rules, verbatim from the reference:

> 1. The condition must be checked (e.g. `if (prevCount !== count)`)
> 2. The state must be updated inside the condition
> 3. You can only update the state of the *currently rendering* component
> 4. You cannot call the `set` function of *another* component during rendering
> 5. You must still update state without mutation — you cannot break other rules
>    of pure functions

Rule 1 is what makes it terminate. An unconditional setter during render is an
[infinite loop](17-infinite-render-loops.md), immediately.

Rules 3 and 4 are what makes it safe. Updating another component's state during
render would mean reaching into a component that has already rendered — hence
the error `Cannot update a component while rendering a different component`
([topic 12](12-render-order.md)).

## The documented shape

```jsx
export default function CountLabel({count}) {
  const [prevCount, setPrevCount] = useState(count);
  const [trend, setTrend] = useState(null);
  if (prevCount !== count) {
    setPrevCount(count);
    setTrend(count > prevCount ? 'increasing' : 'decreasing');
  }
  return (
    <>
      <h1>{count}</h1>
      {trend && <p>The count is {trend}</p>}
    </>
  );
}
```

The pattern is always the same three parts: **a `prevX` state variable**, **a
comparison against the current prop**, and **updates inside the branch** — one of
which resets `prevX` so the condition becomes false next time.

## Why it beats an effect

The competing version:

```jsx
useEffect(() => { setSelection(null); }, [items]);     // 🔴
```

react.dev on its cost:

> Every time the `items` change, the `List` and its child components will render
> with a stale `selection` value at first. Then React will update the DOM and run
> the Effects. Finally, the `setSelection(null)` call will cause another
> re-render of the `List` and its child components, restarting this whole process
> again.

Versus the during-render version:

> `setSelection` is called directly during a render, so React will re-render the
> `List` *immediately* after it exits with a `return` statement. React has not
> rendered the `List` children or updated the DOM yet, so this lets the `List`
> children skip rendering the stale `selection` value.

**The difference is where the re-render happens.** The effect version commits the
stale value to the DOM and then corrects it — a real frame of wrong UI, plus a
full render of the children twice. The during-render version restarts before
children render and before anything reaches the DOM, so the stale value is never
committed and the children render once.

That is a genuine improvement and it is why the pattern exists. But note what
the docs say about it in the same breath.

## Why you probably do not want it anyway

> Storing information from previous renders like this can be hard to understand,
> but it's better than updating the same state in an Effect.

> **However, most components shouldn't need this pattern either.**

And they immediately show the version that removes the need:

```jsx
// ✅ Best: Calculate everything during rendering
function List({items}) {
  const [isReverse, setIsReverse] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selection = items.find(item => item.id === selectedId) ?? null;
}
```

> Now there is no need to "adjust" the state at all.

**The adjustment problem existed only because the wrong thing was in state.**
Storing the selected *object* made it something that had to be reset when the
list changed. Storing the *id* and deriving the object makes the reset automatic:
if the id is no longer present, `find` returns `undefined` and the `??` gives
`null`. Nothing to adjust.

This is [derived state](06-derived-state.md) doing the work, and it is the first
thing to try.

## The decision order

| Situation | Reach for |
|---|---|
| The value can be computed from props/state | **Derive it** — no adjustment needed |
| **All** state below should reset when an identity changes | **`key`** ([topic 07](07-resetting-state-with-key.md)) |
| **Part** of your own state must adjust on a prop change, and it cannot be derived | **Set state during render**, conditionally |
| Anything else | An event handler |
| Syncing state to state | **Nothing** — this is the antipattern |

Note there is no row for `useEffect`. Reacting to a prop change is not what
effects are for; they are for synchronising with systems *outside* React
(Phase 4).

## Where you meet it in practice

Two legitimate uses beyond the docs' example, both with the same shape:

**A "previous value" for comparison.** Detecting a transition — a value crossing
a threshold, a status changing from `loading` to `error` — needs the old value,
and there is no `usePrevious` in React. The `prevX` state variable is the
supported way to have one during render.

**Derived state that genuinely cannot be recomputed** — because the derivation
is lossy or depends on the order changes arrived. A high-water mark, a "has ever
been valid" flag. These are real, and rare.

If you find yourself reaching for it a third time in one codebase, the state
shape is probably wrong — see [structuring state](10-structuring-state.md).

## Gotchas

**Symptom:** `Too many re-renders. React limits the number of renders to prevent
an infinite loop.`
**Cause:** the setter is not inside a condition, or the condition never becomes
false because `prevX` is not updated in the branch.
**Fix:** both rules 1 and 2. The branch must make its own condition false.

**Symptom:** `Cannot update a component while rendering a different component.`
**Cause:** calling *another* component's setter during render — rule 4.
**Fix:** an event handler or an effect. Only your own state may be adjusted this
way.

**Symptom:** the pattern works but nobody understands the component.
**Cause:** the docs' own warning — it is *"hard to understand"*.
**Fix:** check whether deriving the value removes the need, which it usually
does.

**Symptom:** a `prevProps` pattern ported from `getDerivedStateFromProps` behaves
subtly differently.
**Cause:** the class method ran before every render including the first; the hook
version runs inside the body and you control the first render through the
initial state.
**Fix:** initialise `prevX` to the current prop, as the documented example does,
so the condition is false on mount.

**Symptom:** an extra render appears in the Profiler.
**Cause:** expected — React discards the output and renders again immediately.
That is one extra render *before commit*, which is still cheaper than the
effect's render-commit-render.
**Fix:** nothing.

## Interview questions

**★ Can you call a state setter during render?**
Yes, under five documented conditions: it must be inside a condition, the update
must be in that condition, it must be the currently rendering component's own
state, you may not touch another component's state, and you must still not
mutate. React discards the output and immediately re-renders with the new state.

**★ Why is it better than an effect for adjusting state on a prop change?**
Because of where the re-render happens. The effect version renders with the
stale value, commits it to the DOM, runs the effect, sets state and renders
again — so there is a visible frame of wrong UI and the children render twice.
Setting state during render restarts before the children render and before
anything reaches the DOM, so the stale value is never committed.

**★ When should you use it?**
Rarely. react.dev says most components should not need it and then shows the
version that removes the need: store an id rather than an object and derive the
rest, and there is nothing to adjust. The legitimate remainder is a genuine
"previous value" comparison, or state that cannot be recomputed because the
derivation is lossy or order-dependent.

**What is the shape of the pattern?**
A `prevX` state variable initialised to the current prop, a comparison against
the prop in the body, and updates inside the branch — including resetting `prevX`
so the condition is false on the next render. Missing that reset is an infinite
loop.

**Why can't you set another component's state during render?**
Because rendering is top-down and the other component has already run and
returned, so there is nothing left to influence in this pass. React raises
"Cannot update a component while rendering a different component" rather than
silently producing an inconsistent tree.

**How does this relate to `getDerivedStateFromProps`?**
It is the function-component successor to its legitimate use. The class method
had the same job and the same reputation, and most of its real-world uses were
the copy-a-prop-into-state antipattern, which is better fixed by deriving the
value instead.

---

← Prev: [Preserving and resetting state](15-preserving-and-resetting.md) · Index: [Phase 3](README.md) · Next → [Infinite render loops](17-infinite-render-loops.md)
