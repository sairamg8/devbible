---
title: "The two rules of a pure component"
sidebar_label: "01 · The two rules"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure) and
> [Rules of React](https://react.dev/reference/rules). No sandbox script backs
> this page; claims are cited, not measured.

**React assumes purity. It does not check it at runtime and it does not have to
— every optimisation React has ever shipped is a bet that calling your component
again produces the same answer. Break the assumption and the bug appears
somewhere other than the code that caused it.**

## The two rules, verbatim

react.dev states purity as two properties, and both are quoted here exactly
because the wording is precise in a way that summaries lose:

> **It minds its own business.** It does not change any objects or variables
> that existed before it was called.

> **Same inputs, same output.** Given the same inputs, a pure function should
> always return the same result.

And the assumption built on top:

> **React assumes that every component you write is a pure function.**

"Inputs" for a component means **props, state and context** — nothing else. If
your render output depends on anything not in that list, the component is
impure, no matter how stable that other thing seems.

## Rule 1 — mind your own business

The banned operation is writing to something that existed before the render
began. react.dev:

> Components should only *return* their JSX, and not *change* any objects or
> variables that existed before rendering—that would make them impure!

and, in the recap:

> You should not mutate any of the inputs that your components use for
> rendering. That includes props, state, and context.

In practice the violations fall into four groups.

**Mutating a prop**

```jsx
function Total({cart}) {
  cart.total = cart.items.reduce((n, i) => n + i.price, 0);  // 🔴
  return <b>{cart.total}</b>;
}
```

It appears to work — the number is right on screen. It stops working when the
parent memoizes on `cart`, when a sibling reads `cart.total` before this
component has rendered, or when React discards this render. See
[props are read-only](../06-props-are-read-only.md) for the full failure story.

**Mutating state directly**

```jsx
function List({}) {
  const [items, setItems] = useState([]);
  items.push(newItem);          // 🔴 mutates the existing array
  return …;
}
```

Beyond the purity violation, this cannot even trigger a render: React compares
with `Object.is`, and the array is the same object it was.

**Writing to a module-level variable**

```jsx
let guest = 0;                  // 🔴 outside the component

function Cup() {
  guest = guest + 1;
  return <h2>Tea cup for guest #{guest}</h2>;
}
```

This is react.dev's own example, and the failure it produces is instructive:
rendering three `<Cup />` elements gives 2, 4, 6 rather than 1, 2, 3, because
`StrictMode` called each one twice. The output depends on how many times React
happened to call the function — which is exactly what purity forbids.

**Writing to a ref during render**

```jsx
function Chart({data}) {
  renderCountRef.current++;     // 🔴 a ref is a pre-existing object
  return …;
}
```

Refs are mutable *by design*, which makes this tempting, but a ref object exists
before the render and survives it. Mutate it in an effect or an event handler.
The one narrowly-blessed case is a ref used purely as a
render-scoped cache guard, and even then the Rules of React describe reading or
writing a ref during render as unsupported.

## Rule 2 — same inputs, same output

The second rule bans reading anything that can change without React knowing.

```jsx
function Greeting() {
  const now = new Date();                    // 🔴 different every render
  return <p>It is {now.toLocaleTimeString()}</p>;
}

function Row() {
  return <li id={Math.random()} />;          // 🔴
}

function Header() {
  const wide = window.innerWidth > 900;      // 🔴 not an input React tracks
  return wide ? <Wide /> : <Narrow />;
}

function Cart() {
  const saved = localStorage.getItem('cart'); // 🔴 read during render
  return …;
}
```

Each has a different fix, and picking the right one is most of the skill:

| Impure read | Correct home |
|---|---|
| Current time, `Math.random()`, `crypto.randomUUID()` | Compute in an event handler or effect, store in state; or pass in as a prop |
| Window size, media queries, scroll position | `useSyncExternalStore` — the hook that exists precisely for external mutable sources |
| `localStorage`, `sessionStorage` | Lazy initial state: `useState(() => JSON.parse(localStorage.x ?? 'null'))` |
| A mutable module singleton | `useSyncExternalStore`, or lift it into context |
| Anything from the DOM | An effect, after commit — the DOM does not exist yet during render |

The `Date` case deserves a note, because it is the one people argue about. A
clock genuinely needs the current time, and the answer is not "never call
`new Date()`" — it is that the *time you render* must be a value React knows
about. Put it in state and update it on an interval, and the component becomes
pure again: same state, same output.

Stable-looking reads still count. `window.innerWidth` is impure not because it
changes often but because React has no way to know when it changed, so a re-run
of the component can legitimately produce different JSX for reasons React cannot
account for.

## Neither rule bans mutation outright

Both rules are narrower than "never mutate" and narrower than "never read
anything". What they actually constrain is *shared* data and *untracked* reads —
which leaves a generous amount of ordinary JavaScript perfectly legal during
render. That is the [next chunk](02-what-is-allowed.md): local mutation, where
side effects are supposed to live, and what impurity actually costs when it is
not caught.

## Gotchas

**Symptom:** a counter increments by two, or an item appears twice in a list, in
development only.
**Cause:** `StrictMode`'s double render, exposing a write to something outside
the component.
**Fix:** find the write. It is a module variable, a prop, or a ref. Production
"working" is not evidence of correctness — see
[chunk 03](03-strictmode-and-the-compiler.md).

**Symptom:** the UI shows a stale value that updates only when something else
re-renders.
**Cause:** the component reads a mutable source React does not track — a module
singleton, `window`, or a mutated prop.
**Fix:** `useSyncExternalStore` for external sources; state or props for
everything else.

**Symptom:** `Cannot update a component while rendering a different component`.
**Cause:** a `setState` call for *another* component during render — the most
direct possible purity violation.
**Fix:** move the call to an event handler or an effect. The narrow legitimate
case (adjusting *your own* state during render) is a Phase 3 topic and does not
produce this error.

**Symptom:** a `useMemo` result is wrong after a prop changes.
**Cause:** the memoized function reads something not in its dependency list —
the same impurity, scoped to a hook.
**Fix:** every value the calculation reads is either a dependency or a bug.

**Symptom:** hydration mismatch warnings on a server-rendered page.
**Cause:** the component renders `Date.now()`, `Math.random()`, or a
`window`-derived value, so server and client produce different HTML.
**Fix:** render the stable version on both, then adjust in an effect after
mount.

**Symptom:** a list quietly reorders itself in an unrelated part of the app.
**Cause:** `props.items.sort(…)` — `sort` mutates in place, and the array
belongs to the parent.
**Fix:** `[...items].sort(…)` or `items.toSorted(…)`. Covered in
[props are read-only](../06-props-are-read-only.md).

## Interview questions

**★ What does it mean for a React component to be pure?**
Two things, and both are stated in the docs: it minds its own business — it does
not change any object or variable that existed before it was called — and given
the same inputs it always returns the same output. Inputs means props, state and
context, and nothing else. React assumes this of every component and does not
verify it at runtime.

**★ What counts as an "input" to a component?**
Props, state and context. Nothing else. If render output depends on anything
outside that list — the current time, `window.innerWidth`, `localStorage`, a
module-level variable — the component is impure regardless of how stable that
source looks, because React has no way to know when it changed.

**★ Why is writing to a module-level variable during render a bug?**
Because the result then depends on how many times React called the function,
which React explicitly reserves the right to vary. react.dev's own example
renders three `<Cup />` components and gets guests 2, 4 and 6 instead of 1, 2
and 3 under `StrictMode` — the output is a function of the call count rather
than of the props.

**Is writing to a ref during render allowed?**
No. A ref object exists before the render and survives it, so writing to one is
the same violation as mutating a prop — refs being *designed* as mutable does not
exempt them. Mutate refs in effects and event handlers.

**Is `new Date()` in a component always wrong?**
Reading it during render is, because it makes the output depend on something
React does not track. A clock is still perfectly buildable: keep the time in
state and update it on an interval. Then the render is pure — the same state
produces the same output — and the impure part lives in the interval callback.

**How would you render something that depends on window width?**
`useSyncExternalStore`, which exists for exactly this: subscribing to a mutable
external source in a way React can track, including under concurrent rendering.
Reading `window.innerWidth` during render is impure, and reading it in an effect
gives you a first paint with the wrong value.

---

← Index: [Purity](README.md) · Next → [What purity still allows](02-what-is-allowed.md)
