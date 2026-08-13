---
title: "Infinite render loops"
sidebar_label: "17 · Infinite render loops"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useState`](https://react.dev/reference/react/useState),
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> and [`useEffect`](https://react.dev/reference/react/useEffect) troubleshooting.
> No sandbox script backs this page; claims are cited, not measured.

**`Too many re-renders` has three shapes, and each has a different fix. Reading
the shape off the error is most of the work — the message itself names none of
them.**

## The error

```
Too many re-renders. React limits the number of renders to prevent an infinite loop.
```

React counts re-renders of a component and throws when the count passes an
internal limit. The throw is a guard rail, not a diagnosis: it tells you a
component rendered too many times in a row and nothing about why. The stack
points at the render, which is where the *symptom* is, rarely where the cause is.

An effect-driven loop often does **not** produce this error at all. It just runs
forever — the tab heats up, the network panel fills, and nothing is thrown,
because each render is a separate scheduled update rather than an immediate
re-render. That is worth knowing: **no error does not mean no loop.**

## Shape 1 — setting state unconditionally during render

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  setCount(count + 1);          // 🔴 every render sets state → render → set…
  return <p>{count}</p>;
}
```

The most direct form, and the one that always throws. The fix is
[topic 16](16-updating-state-during-render.md)'s rule 1 — a setter during render
must be inside a condition, and the branch must make its own condition false.

A subtler variant, and a very common one:

```jsx
<button onClick={handleClick()}>Click</button>       // 🔴 called during render
<button onClick={handleClick}>Click</button>         // ✅ passed as a value
<button onClick={() => handleClick(id)}>Click</button>  // ✅ wrapped
```

`onClick={handleClick()}` calls the handler while rendering. If it sets state,
that is shape 1 wearing a disguise, and the extra parentheses are easy to miss in
review.

## Shape 2 — an effect that sets its own dependency

```jsx
useEffect(() => {
  setCount(count + 1);          // 🔴 sets what it depends on
}, [count]);
```

Effect runs → sets `count` → `count` changed → effect runs. This one usually does
not throw; it simply never stops.

The fixes, in order of preference:

1. **Delete the effect.** If the value is derivable, derive it
   ([topic 06](06-derived-state.md)). Most instances of this shape are the
   derived-state antipattern.
2. **Use an updater**, which removes the dependency:
   `setCount(c => c + 1)` with `[]`.
3. **Guard it**, if the effect genuinely must run conditionally:
   `if (count < max) setCount(…)`.

## Shape 3 — a new object identity in a dependency array

The one that catches experienced people, because the code looks correct.

```jsx
function Chart({options}) {
  const config = {theme: 'dark', ...options};      // new object every render
  useEffect(() => {
    render(config);
    setReady(true);
  }, [config]);                                     // 🔴 never equal
}
```

Dependencies are compared with `Object.is`. A fresh object, array, or function
literal is a new reference every render, so the comparison always fails and the
effect runs every time. If it sets state, that is a loop.

The same shape arrives as:

```jsx
useEffect(…, [{a, b}]);                 // 🔴 object literal
useEffect(…, [items.filter(Boolean)]);  // 🔴 new array
useEffect(…, [() => doThing()]);        // 🔴 new function
useEffect(…, [props.style]);            // 🔴 if the parent inlines it
```

Fixes:

- **Depend on primitives** — `[options.theme, options.size]` rather than
  `[options]`. Usually the best answer, and it makes the real dependency
  explicit.
- **`useMemo` the object**, if it must stay an object.
- **Move it inside the effect**, if it is only used there — then it is not a
  dependency at all.
- **Let the Compiler handle it**, in a compiled codebase.

## The bail-out makes two near-identical effects behave differently

Worth its own note, because it explains why one loop reproduces and another does
not:

```jsx
useEffect(() => { setCount(0); }, [items]);      // ✅ bails out — 0 === 0
useEffect(() => { setItems([]); }, [items]);     // 🔴 loops — [] is a new array
```

Both set state in an effect that depends on what it sets. The first terminates
because setting a primitive to the same value is a
[bail-out](11-bailing-out.md) — `Object.is(0, 0)` is true, so no re-render, so
the effect does not re-run. The second never terminates because every `[]` is a
new reference.

**So a loop can hide behind a value that happens to compare equal**, and appear
only when the data changes shape. This is why "it worked before" is not evidence.

## Diagnosing one

A procedure that resolves most cases quickly:

1. **Does it throw `Too many re-renders`?** Then it is shape 1 — something sets
   state during render. Look for a setter in the body, or `onClick={fn()}`.
2. **Does it spin without throwing?** Then it is an effect. Which effect —
   comment them out one at a time, or add a `console.log` at the top of each.
3. **Once you have the effect, read its dependency array.** Does it contain
   something the effect sets (shape 2), or something that is a new reference each
   render (shape 3)?
4. **Then ask whether the effect should exist at all.** In practice the majority
   of shape 2 and shape 3 loops are derivations or event responses that were
   written as effects.

The React DevTools Profiler with "record why each component rendered" enabled
identifies the trigger without commenting anything out, and is worth reaching for
first.

## Prevention

- **Derive rather than store.** The largest single source of these loops is
  state that did not need to exist.
- **Handlers before effects.** An effect reacting to state that a handler just
  set is usually work that belonged in the handler.
- **Depend on primitives.** Strings, numbers and booleans compare by value and
  cannot cause shape 3.
- **Keep `eslint-plugin-react-hooks` on.** It cannot see shape 3 — it will
  happily tell you to add the unstable object — but it catches missing
  dependencies, which is the mirror-image bug.
- **Treat "the effect sets what it depends on" as a code smell**, always worth a
  second look even when a bail-out is currently saving you.

## Gotchas

**Symptom:** `Too many re-renders`, and the stack points at a component that
looks innocent.
**Cause:** a setter called during render — often `onClick={handleClick()}` with
accidental parentheses.
**Fix:** pass the function, do not call it.

**Symptom:** the app spins forever with no error.
**Cause:** an effect loop. Each iteration is a scheduled update, not an immediate
re-render, so the render-count guard never trips.
**Fix:** find the effect. Absence of an error is not absence of a loop.

**Symptom:** an effect runs on every render despite a dependency array.
**Cause:** a dependency that is a new reference each render.
**Fix:** depend on primitives, memoize, or move the value inside the effect.

**Symptom:** the loop appears only for some data.
**Cause:** a bail-out was terminating it — setting a primitive to an equal value
— and the new data produces a changing value.
**Fix:** treat the shape as the bug, not the data.

**Symptom:** adding the missing dependency the linter asked for created a loop.
**Cause:** the dependency is an unstable reference, or the effect sets it.
**Fix:** not suppressing the lint rule. Stabilise the value or remove the
effect — the linter was right that the dependency is used.

**Symptom:** `Maximum update depth exceeded` from a class component.
**Cause:** the same family — `setState` in `componentDidUpdate` without a
condition.
**Fix:** the condition. The class-era wording of the same guard rail.

## Interview questions

**★ What are the shapes of an infinite render loop?**
Three. Setting state unconditionally during render, which throws `Too many
re-renders` immediately. An effect that sets state it also depends on. And a
dependency array containing a value that is a new reference every render — an
object, array or function literal — so the effect always re-runs. Each has a
different fix, and the error message names none of them.

**★ Why do some loops throw and others just spin?**
Because the guard counts consecutive re-renders of a component. Setting state
during render produces exactly that and trips it. An effect loop is a series of
separately scheduled updates, so the counter never builds up — the app simply
runs forever with no error. Absence of an error is not evidence of no loop.

**★ Why does `useEffect(() => setItems([]), [items])` loop when
`useEffect(() => setCount(0), [items])` does not?**
The bail-out. Setting `count` to `0` when it is already `0` compares equal under
`Object.is`, so React skips the re-render and the effect does not re-run. Every
`[]` is a new array, so that comparison never succeeds. The second is a latent
loop that a value comparison happens to be hiding.

**How do you fix an unstable dependency?**
Prefer depending on primitives — `[options.theme, options.size]` instead of
`[options]` — which also documents the real dependency. Otherwise `useMemo` the
object, or move it inside the effect if nothing else uses it. Suppressing the
lint rule is the one thing that does not fix it.

**What is the most common underlying cause?**
An effect that should not exist. Most shape-2 and shape-3 loops are derivations
written as effects, or responses to a user action that belonged in the event
handler. Deriving during render and doing work in handlers removes the loop and
the code together.

**Why is `onClick={handleClick()}` a loop?**
Because the parentheses call the handler during render rather than passing it as
a value. If the handler sets state, that is setting state during render, which
re-renders, which calls it again. Pass `handleClick`, or wrap it in an arrow when
you need to supply arguments.

---

← Prev: [Updating state during render](16-updating-state-during-render.md) · Index: [Phase 3](README.md) · Next → Phase 4 (not yet written)
