---
title: "Value helpers — useToggle, usePrevious, useDebounce"
sidebar_label: "01 · Value helpers"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useState`](https://react.dev/reference/react/useState) (updater functions, storing
> information from previous renders),
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (*Adjusting some state when a prop changes*),
> [`useRef`](https://react.dev/reference/react/useRef) (the render-time Pitfall), and
> [`useEffect`](https://react.dev/reference/react/useEffect) (cleanup).
> No sandbox script backs this page; claims are cited, not measured.

**Three hooks that touch nothing outside React. Each has a naive version that works in
the demo, and in each case the fix is a rule from earlier in this phase rather than a
trick.**

## `useToggle`

The one everybody writes on day one, and the one place a stale closure hides in three
lines.

```jsx
// 🔴 Naive
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = () => setOn(!on);        // reads `on` from this render's closure
  return [on, toggle];
}
```

```jsx
// ✅ Correct
import { useState, useCallback } from 'react';

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle  = useCallback(() => setOn(v => !v), []);
  const setTrue = useCallback(() => setOn(true), []);
  const setFalse = useCallback(() => setOn(false), []);
  return [on, toggle, { setTrue, setFalse }];
}
```

**The gotcha: `setOn(!on)` reads a snapshot.** `on` is the value from *this* render and
does not change during it
([Phase 3 · 02](../../phase-3-state/02-state-is-a-snapshot.md)), so two toggles in one
event handler both compute from the same `on` and produce one flip, not two. The updater
form `setOn(v => !v)` receives the pending value instead
([Phase 3 · 03](../../phase-3-state/03-updater-functions.md)). This is invisible until
something calls `toggle()` twice — a double-click handler, a keyboard shortcut that also
fires a click, a parent and child both toggling.

**The second gotcha: identity.** Without `useCallback`, `toggle` is a new function every
render, so any effect that depends on it re-runs constantly and any memoized child
re-renders. Since the updater form closes over nothing, `[]` is an honest dependency
array here — which is the point: **the stale-closure fix is what makes the stability fix
legal.** (With the React Compiler on, this memoization is one of the things it can write
for you — [Phase 6 · 11](../../phase-6-performance/11-do-you-still-write-usememo.md) —
but the updater form is still required, because that is correctness, not performance.)

Note the return shape: a tuple of exactly two, with the rare extras behind an object,
following the convention from
[Phase 7 · 06 · 02](../06-designing-a-hooks-api/02-the-return-value-and-the-seam.md).

## `usePrevious`

The most-copied hook on the internet, and the one where the popular implementation
breaks two rules from this phase at once.

```jsx
// 🔴 The version you will find everywhere
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });   // no dependency array — every render
  return ref.current;                          // read during render
}
```

**Gotcha 1 — it reads a ref during render**, which
[Phase 7 · 04 · 04](../04-rules-of-react-beyond-hooks/04-refs-and-the-dom-in-render.md)
covers: *"Do not write **or read** `ref.current` during rendering, except for
initialization. This makes your component's behavior unpredictable."* The output is not
a function of props, state and context, so the component is not idempotent, and the
Compiler cannot prove it pure.

**Gotcha 2 — "previous" means "previous *render*", not "previous *value*".** The effect
runs after every commit, so any re-render for an unrelated reason — a sibling state
change, a context update, a parent re-render — overwrites `ref.current` with the current
value. The hook then reports that the previous value equals the current one, and code
that says "animate when the value changed" silently stops animating.

The documented alternative is to keep the previous value in **state** and compare during
render. react.dev shows exactly this shape for resetting `selection` when `items`
changes:

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);

  // Better: Adjust the state while rendering
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
  // ...
}
```

> Storing information from previous renders like this can be hard to understand, but
> **it's better than updating the same state in an Effect.** … `setSelection` is called
> directly during a render. **React will re-render the `List` _immediately_ after it
> exits with a `return` statement.** React has not rendered the `List` children or
> updated the DOM yet, so this lets the `List` children skip rendering the stale
> `selection` value.

Contrast that with what the effect version does, which the same page spells out:

> Every time the `items` change, the `List` and its child components will render with a
> **stale `selection` value at first.** Then React will update the DOM and run the
> Effects. Finally, the `setSelection(null)` call will cause **another re-render** …
> restarting this whole process again.

Generalised into a hook:

```jsx
// ✅ Tracks value changes, not render counts
export function usePrevious(value) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(undefined);

  if (value !== current) {
    setPrevious(current);
    setCurrent(value);
  }
  return previous;
}
```

Pure, idempotent, and it changes only when the **value** changes. The cost is a state
pair instead of a ref, which is the correct trade: the previous value is being rendered,
and *if it is rendered, it is state*.

⚠️ **Before reaching for either version, check whether you need it at all.** Most
`usePrevious` uses are the "adjust state when a prop changes" problem above, which the
docs solve inline without a hook, or a `key` reset
([Phase 3 · 07](../../phase-3-state/07-resetting-state-with-key.md)) — which is simpler
than both. See [Phase 4 · 06](../../phase-4-effects/06-you-might-not-need-an-effect/README.md).

## `useDebounce`

Debouncing a **value**, not a callback — the version that composes with rendering.

```jsx
import { useState, useEffect } from 'react';

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);        // ← the whole hook is this line
  }, [value, delay]);

  return debounced;
}
```

**The gotcha is the cleanup, and it is not about leaks.** Cleanup here is the debounce
*mechanism*: each new `value` runs the cleanup for the previous one, cancelling its
pending timer, so only the last keystroke in a quiet period ever calls `setDebounced`.
Omit `clearTimeout` and you have not written a debounce at all — you have written "fire
once per keystroke, 300 ms late", which looks identical in a slow manual test and floods
the network in production. [Phase 4 · 04](../../phase-4-effects/04-cleanup/README.md) is
the general contract.

**The second gotcha: `delay` belongs in the dependency array.** Leaving it out is the
classic lie the linter catches — a component that changes its delay keeps the old one
forever.

**The third: this hook cannot be `StrictMode`-broken, and that is a useful check.**
Setup → cleanup → setup leaves exactly one timer pending, so the double invocation
changes nothing observable. A debounce hook that misbehaves under `StrictMode` has a
cleanup bug.

Two things it is not:

- **Not a debounced callback.** If you want `onSearch` itself debounced, the timer must
  live in a ref across renders and be cancelled on unmount — a different hook with a
  different failure mode. Debouncing the value and deriving the request from it is
  simpler and usually what was wanted.
- **Not `useDeferredValue`.** React's built-in
  ([Phase 6 · 17](../../phase-6-performance/17-usedeferredvalue.md)) has no timer and no
  delay: it re-renders with the old value at low priority and the new one when there is
  time. For "the list lags while I type", it is the better tool because it adapts to the
  device instead of guessing 300 ms. For "stop sending a request per keystroke",
  debouncing is right, because the goal is *fewer network calls*, which priority does not
  change.

## Gotchas

**Symptom:** a toggle called twice in one handler flips once.
**Cause:** `setOn(!on)` reads this render's snapshot; both calls compute from the same
value.
**Fix:** `setOn(v => !v)`.

**Symptom:** an effect depending on a hook's returned callback re-runs every render.
**Cause:** the callback is a new function each render.
**Fix:** `useCallback` with an honest `[]`, which the updater form makes possible.

**Symptom:** `usePrevious` reports the current value as the previous one.
**Cause:** the ref-and-effect version updates on every *render*, not every value change.
**Fix:** keep the previous value in state and compare during render.

**Symptom:** a component using `usePrevious` is skipped by the Compiler.
**Cause:** reading `ref.current` during render is a purity violation it cannot prove
around.
**Fix:** the state-based version is pure.

**Symptom:** a debounced search fires once per keystroke, just later.
**Cause:** the effect has no cleanup, so nothing cancels the previous timer.
**Fix:** `return () => clearTimeout(id)` — that is the debounce.

**Symptom:** changing the delay prop has no effect.
**Cause:** `delay` missing from the dependency array.
**Fix:** declare it. The linter will say so.

**Symptom:** a list still stutters while typing even though the value is debounced.
**Cause:** debouncing delays the update; it does not make the render cheaper.
**Fix:** `useDeferredValue`, or fix the render cost. Debouncing is for reducing
*requests*.

## Interview questions

**★ What is wrong with `const toggle = () => setOn(!on)`?**
`on` is a snapshot of this render, so two calls in one event handler both read the same
value and produce a single flip. The updater form `setOn(v => !v)` is handed the pending
value instead. It also closes over nothing, which is what lets you wrap it in
`useCallback([])` honestly — the correctness fix is what makes the stability fix legal.

**★ Why is the popular `usePrevious` implementation wrong?**
Two reasons. It reads `ref.current` during render, which the docs explicitly disallow —
output that is not a function of props, state and context, so the component is not
idempotent and the Compiler cannot prove it pure. And it assigns in an effect with no
dependency array, so it tracks the previous *render* rather than the previous *value*:
any unrelated re-render makes "previous" equal to "current". Keeping the previous value
in state and comparing during render fixes both.

**★ Adjusting state during render sounds like a rule violation. Why is it allowed here?**
Because it is state belonging to the component being rendered, set before the component
returns, and React re-renders it immediately after it exits — the children have not
rendered and the DOM has not been touched, so no stale value is ever shown. The docs
recommend it over an Effect for exactly this case, since the Effect version renders
stale, commits, then re-renders.

**★ What does the cleanup in `useDebouncedValue` actually do?**
It *is* the debounce. Each new value runs the previous effect's cleanup, cancelling its
pending timer, so only the last change in a quiet period reaches `setDebounced`. Without
`clearTimeout` the hook fires once per keystroke with a delay — which looks the same
when typing slowly and floods the network in production.

**When would you use `useDeferredValue` instead of debouncing?**
When the problem is rendering cost, not request count. `useDeferredValue` has no timer:
it keeps showing the old value at low priority and switches when there is time, so it
adapts to the device rather than guessing a delay. Debouncing is the right tool when the
goal is genuinely fewer network calls, which reprioritising does not achieve.

**Do you still need these fixes with the React Compiler enabled?**
The memoization ones, no — it can write `useCallback` for you. The correctness ones,
yes: the updater form, the honest dependency array and the cleanup are behaviour, not
optimisation. And a component that reads a ref during render is one the Compiler
*cannot* optimise, so the wrong `usePrevious` costs you the Compiler as well.

---

← Index: [The standard set](README.md) ·
Prev: [Designing a hook's API](../06-designing-a-hooks-api/README.md) ·
Next → [Browser state — useLocalStorage, useMediaQuery](02-browser-state.md)
