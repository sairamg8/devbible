---
title: "useCallback"
sidebar_label: "04 · useCallback"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useCallback`](https://react.dev/reference/react/useCallback).
> No sandbox script backs this page; claims are cited, not measured.

**Caching a function definition between re-renders. Two documented reasons to use
it, both about identity — and a documented debugging procedure for the case where
it silently does nothing.**

```jsx
const cachedFn = useCallback(fn, dependencies);
```

> `fn`: The function value that you want to cache. … **React will return (not
> call!) your function** back to you during the initial render. On next renders,
> React will give you the same function again if the `dependencies` have not
> changed.

## It is `useMemo` returning a function

The relationship, stated by the docs as an implementation sketch:

```jsx
// Simplified implementation (inside React)
function useCallback(fn, dependencies) {
  return useMemo(() => fn, dependencies);
}
```

> - **`useMemo` caches the *result* of calling your function.**
> - **`useCallback` caches *the function itself*.** Unlike `useMemo`, it does not
>   call the function you provide.

So everything from [topic 03](03-usememo.md) carries over: the dependency array
contract, the `StrictMode` behaviour, and the caveat that the cache is not a
promise —

> React **will not throw away the cached function unless there is a specific reason
> to do that.** … React will throw away the cache if your component **suspends
> during the initial mount.**

## 🔴 It does not stop the function being created

The single most misunderstood thing about it:

> Note that `useCallback` **does not prevent *creating* the function.** You're
> always creating a function (and that's fine!), but React ignores it and gives you
> back a cached function if nothing changed.

The arrow is constructed on every render regardless. `useCallback` decides which
one you *receive*, not whether one is *made*. So "I added `useCallback` to avoid
allocating a function" is not a real benefit — allocating a closure is cheap, and
you are doing it anyway. The only thing being bought is **referential stability**.

## The two reasons

> Caching a function with `useCallback` is only valuable in a few cases:
>
> - You pass it as a prop to a component wrapped in **`memo`.**
> - The function you're passing is later **used as a dependency of some Hook.** For
>   example, another function wrapped in `useCallback` depends on it, or you depend
>   on this function from `useEffect`.

> **There is no benefit** to wrapping a function in `useCallback` in other cases.

Both are identity. Note what is *not* on the list: passing a handler to a plain
`<button onClick>`, or to a component that is not memoized. Those are the majority
of handlers in an application, and `useCallback` around them does nothing at all.

**The honest test:** follow the function to where it lands. If the destination is a
`memo` boundary or a dependency array, the `useCallback` is doing work. Otherwise it
is decoration — and if the `memo` boundary is itself defeated by another inline prop
([topic 02](02-memo.md)), it is decoration even then.

## 🔴 When it silently returns a new function

Two documented causes, and a procedure for the second.

**Cause 1 — no dependency array at all:**

```jsx
const handleSubmit = useCallback((orderDetails) => {
  post('/product/' + productId + '/buy', { referrer, orderDetails });
}); // 🔴 Returns a new function every time: no dependency array
```

No error, no warning. It just never caches.

**Cause 2 — a dependency that is itself always new.** The docs give a real debugging
recipe rather than advice:

```jsx
const handleSubmit = useCallback((orderDetails) => {
  // ..
}, [productId, referrer]);

console.log([productId, referrer]);
```

> You can then right-click on the arrays from different re-renders in the console
> and select **"Store as a global variable"** for both of them. Assuming the first
> one got saved as `temp1` and the second as `temp2`:

```js
Object.is(temp1[0], temp2[0]); // Is the first dependency the same between the arrays?
Object.is(temp1[1], temp2[1]);
```

> When you find which dependency is breaking memoization, either **find a way to
> remove it, or memoize it as well.**

That procedure is worth committing to memory. Memoization failures are otherwise
invisible — the code looks correct, the linter is satisfied, and nothing reports
that the cache never hits.

## The dependency array must be inline

> The list of dependencies **must have a constant number of items and be written
> inline** like `[dep1, dep2, dep3]`.

Same as effects ([Phase 4 · 02](../phase-4-effects/02-useeffect-anatomy.md)): a
variable defeats the lint rule that would otherwise tell you what is missing.

## `useCallback` in a loop

Not allowed, and the fix is structural:

```jsx
// 🔴 You can't call useCallback in a loop like this:
{items.map(item => {
  const handleClick = useCallback(() => sendReport(item), [item]);
  return <figure key={item.id}><Chart onClick={handleClick} /></figure>;
})}
```

> Instead, **extract a component for an individual item**, and put `useCallback`
> there:

```jsx
function Report({ item }) {
  // ✅ Call useCallback at the top level:
  const handleClick = useCallback(() => sendReport(item), [item]);
  return <figure><Chart onClick={handleClick} /></figure>;
}
```

And the better alternative the docs offer immediately after:

> Alternatively, you could **remove `useCallback`** in the last snippet and instead
> **wrap `Report` itself in `memo`.** If the `item` prop does not change, `Report`
> will skip re-rendering, so `Chart` will skip re-rendering too.

```jsx
const Report = memo(function Report({ item }) {
  function handleClick() {
    sendReport(item);
  }
  return <figure><Chart onClick={handleClick} /></figure>;
});
```

This is the phase's argument in miniature. Extracting a component and memoizing at
that boundary removes the need for `useCallback` entirely — **one `memo` at the
right level beats N `useCallback`s at the wrong one.**

## Should you use it everywhere?

The same balanced answer as `useMemo`:

> There is no significant harm to doing that either, so some teams choose to not
> think about individual cases, and memoize as much as possible. The downside is
> that code becomes less readable. Also, not all memoization is effective: **a
> single value that's "always new" is enough to break memoization for an entire
> component.**

And the same five principles — accept `children`, keep state local, keep rendering
pure and fix bugs rather than memoizing around them, avoid effects that update
state, remove unnecessary effect dependencies. Plus the note about where this is
heading:

> In long term, we're researching **doing memoization automatically** to solve this
> once and for all.

Which is the Compiler, [topic 07](07-the-react-compiler.md).

## Gotchas

**Symptom:** `useCallback` returns a new function every render.
**Cause:** the dependency array was omitted entirely — no warning is issued.
**Fix:** add it. If the array is present, one of its dependencies is always new.

**Symptom:** the array is present and the cache still never hits.
**Cause:** a dependency with a new identity each render.
**Fix:** the documented procedure — log the array, store two renders' arrays as
globals, and `Object.is` them element by element to find which one.

**Symptom:** `useCallback` around every handler in the file.
**Cause:** memoizing without asking where the function lands.
**Fix:** it is only valuable for a `memo`-wrapped child or a Hook dependency.
A plain `onClick` gains nothing.

**Symptom:** "I use `useCallback` to avoid creating a function each render."
**Cause:** a misunderstanding — it does not prevent creation, only decides which
function you receive.
**Fix:** the benefit is referential stability, and only where identity matters.

**Symptom:** `useCallback` needed per list item.
**Cause:** hooks cannot be called in a loop.
**Fix:** extract a per-item component — then consider whether wrapping *that* in
`memo` removes the need for the callback altogether.

**Symptom:** every child is memoized and the parent still re-renders everything.
**Cause:** one always-new value breaking the chain.
**Fix:** find it before adding more memoization; the rest are already inert.

## Interview questions

**★ What does `useCallback` actually do — and what does it not do?**
It caches a function definition between renders and returns the same one while the
dependencies are unchanged. It does **not** prevent the function being created: the
docs are explicit that you always create it, and React simply ignores it and hands
back the cached one. The only thing being bought is referential stability, so it is
worthless where identity does not matter.

**★ When is `useCallback` worth using?**
Two documented cases, both about identity: passing the function to a `memo`-wrapped
component, or using it as a dependency of another Hook. There is no benefit
otherwise. The practical test is to follow the function to where it lands — a plain
`onClick` on a DOM element gains nothing, and a `memo` boundary already defeated by
another inline prop gains nothing either.

**★ How do you debug a `useCallback` that never caches?**
First check the dependency array exists at all — omitting it returns a new function
every render with no warning. If it is present, one dependency is always new: log
the array, use "Store as a global variable" on two renders' arrays in the console,
and compare them element by element with `Object.is`. Then either remove that
dependency or memoize it too. Memoization failures are otherwise invisible.

**How is `useCallback` related to `useMemo`?**
It is `useMemo` returning the function itself — the docs give
`useMemo(() => fn, deps)` as a simplified implementation. `useMemo` caches the
*result* of calling a function and will call it during rendering; `useCallback`
caches the function and never calls it. Every `useMemo` caveat applies, including
that the cache is discarded if the component suspends during initial mount.

**You need a callback per list item. What do you do?**
Extract a component for the item and call `useCallback` at its top level, since
hooks cannot be called in a loop. But the docs immediately suggest the better
option: drop the `useCallback` and wrap the extracted component in `memo` instead —
if its `item` prop is unchanged it skips re-rendering, and so does everything below
it. One `memo` at the right boundary beats many `useCallback`s at the wrong one.

---

← Prev: [`useMemo`](03-usememo.md) · Index: [Phase 6](README.md) · Next → [Measure before you optimise](05-measure-before-you-optimise.md)
