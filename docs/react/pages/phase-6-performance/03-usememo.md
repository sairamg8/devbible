---
title: "useMemo"
sidebar_label: "03 · useMemo"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useMemo`](https://react.dev/reference/react/useMemo).
> No sandbox script backs this page; claims are cited, not measured.

**Caching a calculation between re-renders. There are exactly three documented
reasons to reach for it, and "this looks expensive" is not one of them — the docs
give you a way to find out instead of guessing.**

```jsx
const cachedValue = useMemo(calculateValue, dependencies);
```

> `calculateValue`: The function calculating the value that you want to cache. **It
> should be pure, should take no arguments**, and should return a value of any type.
> React will call your function during the initial render. On next renders, React
> will return the same value again **if the `dependencies` have not changed.**

The dependency array is the same contract as everywhere else — inline, constant
size, compared with `Object.is`, verified by the linter
([Phase 4 · 03](../phase-4-effects/03-the-dependency-array.md)).

## 🔴 The cache is not a guarantee

The caveat people miss, and it changes what you may build on:

> React **will not throw away the cached value unless there is a specific reason to
> do that.** For example, in development, React throws away the cache when you edit
> the file of your component. Both in development and in production, **React will
> throw away the cache if your component suspends during the initial mount.** In the
> future, React may add more features that take advantage of throwing away the
> cache … **This should be fine if you rely on `useMemo` solely as a performance
> optimization.** Otherwise, a state variable or a ref may be more appropriate.

So `useMemo` is the same category of promise as `memo`
([topic 02](02-memo.md)): an optimisation React may decline. If correctness depends
on the value being the *same object* forever — an identity used as a `Map` key, a
cached class instance — the docs point you at `useState`'s initializer or the
`useRef` idiom ([Phase 5 · 01](../phase-5-refs-context-reducers/01-useref.md))
instead.

And under `StrictMode`:

> React will **call your calculation function twice** … The result from one of the
> calls will be ignored.

Which is why `calculateValue` must be pure — the same stress test reducers and
component bodies get.

## 🔴 The three reasons, and only these

> Optimizing with `useMemo` is only valuable in a few cases:
>
> - The calculation you're putting in `useMemo` is **noticeably slow**, and its
>   dependencies rarely change.
> - You pass it as a prop to a component wrapped in **`memo`**. You want to skip
>   re-rendering if the value hasn't changed.
> - The value you're passing is later **used as a dependency of some Hook.** For
>   example, maybe another `useMemo` calculation value depends on it. Or maybe you
>   are depending on this value from `useEffect`.

> **There is no benefit** to wrapping a calculation in `useMemo` in other cases.

Two of the three are about **identity**, not cost. That is the reframe: most
`useMemo` in a healthy codebase is not caching an expensive computation, it is
producing a stable reference so that something downstream — a `memo` boundary or a
dependency array — can work at all.

Recognising which of the three you are doing matters, because they have different
success criteria. An identity `useMemo` either stabilises the reference or it does
not; a cost `useMemo` needs a measurement.

## Is the calculation actually expensive?

The docs answer this instead of leaving it to instinct:

> In general, **unless you're creating or looping over thousands of objects, it's
> probably not expensive.**

```jsx
console.time('filter array');
const visibleTodos = filterTodos(todos, tab);
console.timeEnd('filter array');
```

> If the overall logged time adds up to a significant amount (say, **`1ms` or
> more**), it might make sense to memoize that calculation. As an experiment, you can
> then wrap the calculation in `useMemo` to verify whether the total logged time has
> decreased.

A named threshold, and a before/after method rather than a guess. Three conditions
attached to trusting the number:

> **`useMemo` won't make the *first* render faster.** It only helps you skip
> unnecessary work on updates.

> your machine is probably faster than your users' so it's a good idea to test the
> performance with an **artificial slowdown** … Chrome offers a CPU Throttling
> option.

> measuring performance in development will not give you the most accurate results.
> (For example, when Strict Mode is on, you will see each component render twice
> rather than once.) To get the most accurate timings, **build your app for
> production** and test it on a device like your users have.

## Should you memoize everything?

The docs take the "memoize by default" position seriously rather than dismissing it:

> There is **no significant harm** to doing that either, so some teams choose to not
> think about individual cases, and memoize as much as possible. **The downside of
> this approach is that code becomes less readable. Also, not all memoization is
> effective: a single value that's "always new" is enough to break memoization for
> an entire component.**

That last clause is the argument against blanket memoization that actually lands.
Memoization is a chain, and one unmemoized object anywhere in it makes every link
above it useless — while leaving all the `useMemo` calls in place, looking like they
work.

## 🔴 The five principles that make memoization unnecessary

The most valuable list on the page, and the reason topics 13 and 06 exist:

> 1. When a component **visually wraps other components, let it accept JSX as
>    children.** This way, when the wrapper component updates its own state, React
>    knows that its children don't need to re-render.
> 2. **Prefer local state and don't lift state up** any further than necessary. …
>    don't keep transient state like forms and whether an item is hovered at the top
>    of your tree.
> 3. **Keep your rendering logic pure.** If re-rendering a component causes a
>    problem or produces some noticeable visual artifact, **it's a bug in your
>    component! Fix the bug instead of adding memoization.**
> 4. **Avoid unnecessary Effects that update state.** **Most performance problems in
>    React apps are caused by chains of updates originating from Effects** that cause
>    your components to render over and over.
> 5. Try to **remove unnecessary dependencies from your Effects.**

Point 4 deserves emphasis: react.dev's own claim is that *most* React performance
problems come from effect chains — which is
[Phase 4 · 06 · 02](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md),
not this phase at all. The fastest performance fix is often deleting an effect.

## Gotchas

**Symptom:** `useMemo` added and nothing improved.
**Cause:** the calculation was not slow. The docs' bar is roughly 1ms or more,
measured.
**Fix:** `console.time` around it before and after. Below the threshold, remove it.

**Symptom:** a memoized value still changes identity every render.
**Cause:** one of its dependencies is itself "always new".
**Fix:** stabilise that dependency first — a single always-new value breaks the
whole chain.

**Symptom:** the first render is still slow.
**Cause:** `useMemo` does not make the first render faster; it only skips work on
updates.
**Fix:** the answer is lazy loading, deferring, or less work — not memoization.

**Symptom:** code relies on a memoized object being the same instance forever.
**Cause:** treating the cache as a guarantee. React throws it away when a component
suspends during initial mount, and may in future for other reasons.
**Fix:** `useState`'s initializer or the `useRef` idiom for a genuinely stable
instance.

**Symptom:** the calculation runs twice in development.
**Cause:** `StrictMode` calls it twice to expose impurity.
**Fix:** fine if it is pure — which the docs require. If it has a side effect, that
is the bug.

**Symptom:** measured timings look great locally and users still complain.
**Cause:** development build, StrictMode double-render, and a faster machine.
**Fix:** production build, real device, CPU throttling.

## Interview questions

**★ What are the three documented reasons to use `useMemo`?**
The calculation is noticeably slow and its dependencies rarely change; the value is
passed to a `memo`-wrapped component; or the value is used as a dependency of
another Hook. The docs say there is no benefit in other cases. Notably two of the
three are about **referential identity**, not cost — most `useMemo` in a healthy
codebase exists so that a `memo` boundary or a dependency array can work at all.

**★ How do you decide whether a calculation is expensive enough?**
Measure it. The docs suggest `console.time`/`console.timeEnd` around the
calculation, performing the interaction, and treating roughly **1ms or more** as
worth memoizing — then wrapping it and checking the total dropped. With three
caveats: `useMemo` never makes the first render faster, your machine is faster than
your users', and development measurements are distorted by StrictMode's double
render, so measure a production build.

**★ Is the memoized value guaranteed to persist?**
No. React will not discard it without reason, but it does discard it in development
when you edit the file, and **in both development and production if the component
suspends during initial mount** — and the docs reserve the right to add more such
cases. That is fine when you rely on it purely as an optimisation; if you need a
genuinely stable instance, use `useState`'s initializer or a ref.

**What is the strongest argument against memoizing everything?**
That memoization is a chain, and one value that is "always new" is enough to break
it for an entire component — while every `useMemo` call stays in place looking like
it works. The docs also note the readability cost. They are fair about it: there is
no *significant harm*, and some teams do memoize by default.

**What do the docs say causes most React performance problems?**
Chains of updates originating from Effects that make components render over and over
— which is a Phase 4 problem, not a memoization one. That is first among five
principles for making memoization unnecessary: accept `children` in wrappers, keep
state local, keep rendering pure and fix bugs rather than memoizing around them,
avoid effects that update state, and remove unnecessary effect dependencies.

---

← Prev: [`memo`](02-memo.md) · Index: [Phase 6](README.md) · Next → [`useCallback`](04-usecallback.md)
