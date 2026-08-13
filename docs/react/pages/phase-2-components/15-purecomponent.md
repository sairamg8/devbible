---
title: "Component vs PureComponent and shouldComponentUpdate"
sidebar_label: "15 · PureComponent"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`PureComponent`](https://react.dev/reference/react/PureComponent) and
> [`Component` — `shouldComponentUpdate`](https://react.dev/reference/react/Component#shouldcomponentupdate).
> No sandbox script backs this page; claims are cited, not measured.

**The class ancestry of `memo`. Worth knowing because the caveats transferred
intact — and because one of them explains a whole category of "why didn't my
optimisation work".**

## The three levels

**`Component`** — re-renders whenever its parent does, or when its own state
changes. No comparison, no skipping. This is also the default for function
components.

**`PureComponent`** — adds a shallow comparison:

> Extending `PureComponent` is equivalent to defining a custom
> `shouldComponentUpdate` method that shallowly compares props and state.

**`shouldComponentUpdate`** — you write the comparison yourself:

```jsx
shouldComponentUpdate(nextProps, nextState) {
  return nextProps.id !== this.props.id;      // true = render, false = skip
}
```

Same three levels exist for function components: plain, `memo`, and `memo` with
a custom comparison function.

## Shallow comparison, and what it costs you

Shallow means `Object.is` on each top-level prop and state value. Not deep, not
structural.

```jsx
<Row user={user} />                    // ✅ same object reference → skip
<Row user={{...user}} />               // 🔴 new object each render → never skips
<Row onClick={() => …} />              // 🔴 new function each render → never skips
<Row tags={tags.filter(Boolean)} />    // 🔴 new array each render → never skips
```

The bottom three are the reason most memoization achieves nothing. The
comparison runs, costs a little, and always returns "different" — so you pay for
the check and never skip a render. The bug is invisible: nothing warns, and the
component simply behaves as it did before.

The other half of that failure is **mutation**. `PureComponent` and `memo` both
assume that a change produces a new reference, so:

```jsx
this.state.items.push(item);           // 🔴 same array
this.setState({items: this.state.items});
```

`items` is the array it always was, the shallow comparison says nothing changed,
and the update is dropped. The documentation's framing is that a React component
should always have pure rendering logic; the practical statement is that
**`PureComponent` and mutation are mutually exclusive** — turning either on
requires the other to be off.

## Two documented caveats that carried over to `memo`

**It does not stop context updates.**

> However, your component will still re-render if a context that it's using
> changes.

`memo` behaves identically. A memoized component consuming a context re-renders
whenever that context's value changes, no matter how equal its props are. This
is the second most common "my memoization does nothing" — and the fix is to
split the context or memoize the provider's value, never to add more `memo`.

**Skipping is a hint, not a contract.**

> Returning `false` does not prevent child components from re-rendering when
> *their* state changes. Returning `false` does not *guarantee* that the
> component will not re-render. React will use the return value as a hint but it
> may still choose to re-render your component if it makes sense to do for other
> reasons.

That is a stronger statement than most people expect, and it applies to `memo`
too. **Memoization is a performance hint and never a correctness mechanism.**
Code that only works because a render was skipped is broken code that has not
been caught yet.

## What the docs say about hand-written `shouldComponentUpdate`

> This method *only* exists as a performance optimization. If your component
> breaks without it, fix that first. Consider using `PureComponent` instead of
> writing `shouldComponentUpdate` by hand. `PureComponent` shallowly compares
> props and state, and reduces the chance that you'll skip a necessary update.
> **We do not recommend doing deep equality checks or using `JSON.stringify` in
> `shouldComponentUpdate`. It makes performance unpredictable and dependent on
> the data structure of every prop and state.**

Three separate warnings in one paragraph, and all three transfer directly to
`memo`'s optional comparison function:

- If it breaks without the optimisation, the optimisation is hiding a bug.
- Prefer the shallow default; a hand-written comparison is easy to get subtly
  wrong and the failure is a missed update, which is much worse than an extra
  render.
- **Never deep-compare.** `JSON.stringify` on a prop makes render cost
  proportional to data size, unpredictably — and it silently breaks on
  `undefined`, functions, `Map`, `Set`, cycles and key order.

## `PureComponent` → `memo`

```jsx
// Class
class Greeting extends PureComponent {
  render() { return <h3>Hello, {this.props.name}!</h3>; }
}

// Function
const Greeting = memo(function Greeting({name}) {
  return <h3>Hello, {name}!</h3>;
});
```

One documented difference, and it is a genuine simplification:

> Unlike `PureComponent`, `memo` does not compare the new and the old state. In
> function components, calling the `set` function with the same state already
> prevents re-renders by default, even without `memo`.

So `memo` compares props only. State bail-out is built into `useState` itself.

## Should you use any of this today?

For classes: only when you are already in one and have measured a problem.

For function components, the calculus changed with the **React Compiler**, which
memoizes automatically at a finer grain than `memo` can — per value rather than
per component — and does it correctly, provided components are pure. In a
compiled codebase most hand-written `memo`, `useMemo` and `useCallback` is
redundant, and some of it is a small net cost.

The ordering that survives either way is the one from
[lifting state up · the cost](05-lifting-state-up/02-the-cost.md): own state at
the right level, pass expensive subtrees as `children`, split components by
update frequency — and only then memoize. Those are structural, they need no
dependency arrays, and the Compiler does not make them redundant.

Phase 6 covers the measured version of all of this.

## Gotchas

**Symptom:** `PureComponent` or `memo` never skips a render.
**Cause:** at least one prop is a new object, array or function each render.
**Fix:** stabilise those props — or restructure so there is nothing to compare,
by passing the subtree as `children`.

**Symptom:** an update is dropped entirely and the UI is stale.
**Cause:** state or props were mutated, so the shallow comparison saw no change.
This is the dangerous failure: not slow, wrong.
**Fix:** immutable updates. `PureComponent` and mutation cannot coexist.

**Symptom:** a memoized component still re-renders every time.
**Cause:** it consumes a context whose value changes — memoization does not stop
context updates.
**Fix:** split the context or memoize the provider value.

**Symptom:** performance is unpredictable and worse on large records.
**Cause:** a deep comparison or `JSON.stringify` in the comparison function.
**Fix:** shallow only. The docs specifically advise against deep checks.

**Symptom:** a feature breaks when memoization is removed.
**Cause:** the code depends on a render being skipped — a side effect during
render, or state kept somewhere React cannot see.
**Fix:** fix that. Skipping is documented as a hint React may ignore.

## Interview questions

**★ What is the difference between `Component` and `PureComponent`?**
`PureComponent` adds a shallow comparison of props and state and skips the
render when nothing changed — equivalent to writing a `shouldComponentUpdate`
that does the same. `Component` always re-renders when its parent does or its
state changes. The function-component equivalents are plain versus `memo`.

**★ Why does `PureComponent` so often fail to help?**
Because a shallow comparison fails whenever a prop is a new object, array or
inline function, which happens on every render unless something stabilises it.
You pay the comparison and skip nothing. And it does not stop context-driven
re-renders at all, which the documentation states explicitly.

**★ What happens if you mutate state in a `PureComponent`?**
The update is silently dropped. The shallow comparison sees the same reference,
concludes nothing changed, and skips the render. It is the most dangerous
failure in this area because the result is wrong UI rather than slow UI, with no
warning.

**How does `memo` differ from `PureComponent`?**
`memo` compares props only. It does not compare state, because `useState`
already bails out when you set the same value — that behaviour is built in and
needs no wrapper. Otherwise the semantics and every caveat are the same.

**Is skipping a render guaranteed?**
No. The documentation says React treats the return value as a hint and may
re-render anyway if it makes sense for other reasons, and that returning `false`
does not stop children re-rendering when their own state changes. Memoization is
never a correctness mechanism.

**Would you reach for `memo` today?**
Rarely, and last. Structural fixes — owning state at the right level, passing
expensive subtrees as `children`, splitting by update frequency — are cheaper
and do not need stabilised props. And the React Compiler memoizes automatically
at a finer grain than `memo` can, provided the components are pure, which makes
most hand-written memoization redundant.

---

← Prev: [Class components](14-class-components/README.md) · Index: [Phase 2](README.md) · Next → [cloneElement, Children.map and isValidElement](16-element-manipulation.md)
