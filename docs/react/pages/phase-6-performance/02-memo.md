---
title: "memo"
sidebar_label: "02 · memo"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`memo`](https://react.dev/reference/react/memo).
> No sandbox script backs this page; claims are cited, not measured.

**A shallow prop comparison before re-rendering. The two things to internalise are
that it is *not a guarantee*, and that it does **nothing at all** when the parent
passes a fresh object, array or arrow function — which is most of the time.**

> `memo` lets you skip re-rendering a component when its props are unchanged.

```jsx
const Profile = memo(function Profile({ name, age }) {
  // ...
});
```

> `memo` returns a new React component. It behaves the same as the component
> provided to `memo` **except that React will not always re-render it** when its
> parent is being re-rendered unless its props have changed.

*Will not always* — the hedge is deliberate.

## 🔴 Not a guarantee

> **Memoization is a performance optimization, not a guarantee.**

> But React **may still re-render it.**

This is the same category of statement as the `useState` bail-out
([Phase 3 · 11](../phase-3-state/11-bailing-out.md)): React reserves the right to
render anyway. So:

> **You should only rely on `memo` as a performance optimization. If your code
> doesn't work without it, find the underlying problem and fix it first.** Then you
> may add `memo` to improve performance.

If removing `memo` breaks correctness — a duplicated request, a reset animation, a
double-counted analytics event — you have a bug that `memo` was hiding, and it will
resurface.

## What `memo` does not stop

Two exemptions, both documented, both surprising the first time:

> Even when a component is memoized, it will still re-render **when its own state
> changes.** Memoization only has to do with props that are passed to the component
> from its parent.

> Even when a component is memoized, it will still re-render **when a context that
> it's using changes.**

The context one is the important one in practice — it is why `memo` is not the fix
for the context re-render problem
([Phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md)).
A memoized component displaying a stale theme would be a correctness bug, so
context deliberately bypasses `memo`.

**`memo` only ever addresses one cause of re-rendering: the parent re-rendered and
passed props.** Any other cause is untouched.

## 🔴 Why it usually does nothing

> When you use `memo`, your component re-renders whenever any prop is **not
> *shallowly equal*** to what it was previously. … React compares every prop with
> its previous value using the `Object.is` comparison. Note that `Object.is(3, 3)`
> is `true`, but **`Object.is({}, {})` is `false`.**

And the sentence that should be on a poster:

> Keep in mind that **`memo` is completely useless if the props passed to your
> component are *always different***, such as if you pass an object or a plain
> function defined during rendering.

```jsx
// 🔴 memo does nothing — both props are new every render
<Profile person={{ name, age }} onSelect={() => select(id)} />
```

This is the single most common way `memo` is wasted: added to the child, changing
nothing, and now nobody looks there again because "it's memoized". The identity
problem is the same one from
[Phase 4 · 11 · 01](../phase-4-effects/11-removing-dependencies/01-objects-and-functions.md)
— and the fixes are the same shape.

## Minimising prop changes

react.dev gives three, in increasing order of quality.

**Memoize the object:**

```jsx
const person = useMemo(() => ({ name, age }), [name, age]);
return <Profile person={person} />;
```

**Better — pass the minimum:**

> A better way to minimize props changes is to make sure the component **accepts the
> minimum necessary information** in its props. For example, it could accept
> individual values instead of a whole object:

```jsx
return <Profile name={name} age={age} />;
```

Two primitives compare by value. No `useMemo`, nothing to maintain, and the
component's contract is narrower.

**Best — project to something that changes less:**

```jsx
function GroupsLanding({ person }) {
  const hasGroups = person.groups !== null;
  return <CallToAction hasGroups={hasGroups} />;
}
```

A boolean instead of the value it was derived from. `person.groups` may change
constantly; `hasGroups` changes twice in the component's life.

And for functions:

> When you need to pass a function to memoized component, either **declare it
> outside your component** so that it never changes, or **`useCallback`** to cache
> its definition between re-renders.

## The custom comparator

> In **rare cases** it may be infeasible to minimize the props changes … you can
> provide a custom comparison function … It should return `true` **only if the new
> props would result in the same output as the old props.**

```jsx
const Chart = memo(function Chart({ dataPoints }) {
  // ...
}, arePropsEqual);

function arePropsEqual(oldProps, newProps) {
  return (
    oldProps.dataPoints.length === newProps.dataPoints.length &&
    oldProps.dataPoints.every((oldPoint, index) => {
      const newPoint = newProps.dataPoints[index];
      return oldPoint.x === newPoint.x && oldPoint.y === newPoint.y;
    })
  );
}
```

Two warnings attached, and both are the kind that produce a very bad afternoon:

> If you provide a custom `arePropsEqual` implementation, **you must compare every
> prop, including functions.** Functions often close over the props and state of
> parent components. If you return `true` when `oldProps.onClick !==
> newProps.onClick`, your component will keep **"seeing" the props and state from a
> previous render** inside its `onClick` handler, leading to very confusing bugs.

> **Avoid doing deep equality checks** inside `arePropsEqual` unless you are 100%
> sure that the data structure you're working with has a known limited depth. **Deep
> equality checks can become incredibly slow** and can freeze your app for many
> seconds if someone changes the data structure later.

The first is a stale-closure bug with no warning and no error — the handler simply
acts on old data. The second is a performance fix that becomes a performance
disaster the day someone nests one more level.

> If you do this, use the Performance panel in your browser developer tools to make
> sure that **your comparison function is actually faster than re-rendering the
> component. You might be surprised.**

## When it is worth it at all

> Optimizing with `memo` is **only valuable when your component re-renders often
> with the same exact props, and its re-rendering logic is expensive.** If there is
> no perceptible lag when your component re-renders, `memo` is unnecessary.

> If your app is like this site, and most interactions are **coarse** (like
> replacing a page or an entire section), memoization is usually unnecessary. On the
> other hand, if your app is more like a **drawing editor**, and most interactions
> are **granular** (like moving shapes), then you might find memoization very
> helpful.

That coarse/granular distinction is the most useful heuristic in the phase.
Navigation-shaped apps rarely need `memo`; canvas- and editor-shaped apps do.

And the order of operations:

> If a specific interaction still feels laggy, use the React Developer Tools
> profiler to see **which components would benefit the most** from memoization, and
> add memoization where needed.

## Gotchas

**Symptom:** `memo` added and the component still re-renders every time.
**Cause:** the parent passes an inline object, array or arrow function, so shallow
comparison fails every render.
**Fix:** pass primitives, project to a narrower value, or memoize what you pass.
`memo` alone is inert here.

**Symptom:** a memoized component re-renders when a context changes.
**Cause:** documented — memoization only concerns props from the parent.
**Fix:** nothing to fix. If those re-renders matter, split the context
([Phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md)).

**Symptom:** removing `memo` breaks behaviour.
**Cause:** the code depends on renders being skipped, which is not a guarantee.
**Fix:** find the underlying bug first; React may re-render anyway.

**Symptom:** a custom comparator makes a handler act on stale data.
**Cause:** the comparator returned `true` while a function prop had changed, so the
component keeps the previous render's closure.
**Fix:** compare every prop, functions included.

**Symptom:** the app freezes for seconds after a data-shape change.
**Cause:** a deep equality check in `arePropsEqual` meeting a deeper structure than
it was written for.
**Fix:** avoid deep comparison unless the depth is known and fixed.

**Symptom:** `memo` applied across the codebase on principle.
**Cause:** memoizing without measuring.
**Fix:** it is only valuable when a component re-renders often with the *same*
props and its rendering is expensive. Profile first.

## Interview questions

**★ What does `memo` actually compare, and when is it useless?**
It compares each prop with its previous value using `Object.is` — a shallow
comparison. It is completely useless when props are always different, which is what
happens whenever the parent passes an object, array or arrow function created during
render, because `Object.is({}, {})` is `false`. Wrapping the child changes nothing
in that case, and the wrapper makes it look handled.

**★ What can `memo` not prevent?**
Re-renders caused by the component's own state, and re-renders caused by a context
it reads — both documented explicitly. Memoization only concerns props passed from
the parent. The context exemption is required for correctness, since a memoized
component must not display a stale value, and it is why `memo` is not the fix for
context re-render problems.

**★ Why is it "not a guarantee"?**
Because React may re-render a memoized component anyway; the docs say so directly.
That is why the guidance is to rely on `memo` only as a performance optimization —
if your code stops working without it, there is an underlying bug that `memo` was
hiding and it will come back.

**How should you reduce a memoized component's prop changes?**
In increasing order of quality: memoize the object you pass; pass individual
primitives instead of a whole object, so comparison is by value with nothing to
maintain; or project the data to something that changes less often — the docs' own
example passes `hasGroups` rather than `person`. For functions, declare them outside
the component or use `useCallback`.

**What are the two traps in a custom `arePropsEqual`?**
You must compare *every* prop including functions — returning `true` while a
handler prop changed leaves the component seeing a previous render's props and state
inside that handler, with no error to find. And avoid deep equality unless the depth
is known and fixed, because a deep check can freeze the app for seconds once someone
nests the data one level further. The docs also suggest measuring whether the
comparator is genuinely faster than just re-rendering — "you might be surprised".

**When is memoization worth reaching for at all?**
When a component re-renders often with the same exact props *and* its rendering is
expensive. The docs' heuristic is the shape of the interactions: coarse ones like
replacing a page rarely need it; granular ones like dragging shapes in an editor
often do. If there is no perceptible lag, `memo` is unnecessary.

---

← Prev: [Why did this component re-render?](01-why-did-this-re-render.md) · Index: [Phase 6](README.md) · Next → [`useMemo`](03-usememo.md)
