---
title: "Getting and using a DOM ref"
sidebar_label: "01 · Getting and using a ref"
sidebar_position: 1
---


<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs)
> and [`useRef`](https://react.dev/reference/react/useRef).
> Effect-timing and ref-callback lifetime are owned by
> [Phase 4 · 15](../../phase-4-effects/15-effects-and-refs.md) and cross-linked
> rather than restated. No sandbox script backs this page.

**The case `useRef` has dedicated support for: a handle to a real DOM node, so you
can do the handful of things React deliberately does not expose — focus, scroll,
measure, and hand the node to a library.**

> Refs are an escape hatch. You should only use them when you have to "step
> outside React". Common examples of this include **managing focus, scroll
> position, or calling browser APIs that React does not expose.**

## Attaching one

```jsx
const myRef = useRef(null);
// ...
<div ref={myRef}>
```

> Initially, `myRef.current` will be `null`. **When React creates a DOM node for
> this `<div>`, React will put a reference to this node into `myRef.current`.**

So `null` is not a failure state — it is the correct value before the commit, and
the reason [topic 01](../01-useref.md)'s "do not read during render" rule is not
merely stylistic here: during render there is genuinely nothing to read. Refs are
populated by the time effects and event handlers run
([Phase 4 · 13](../../phase-4-effects/13-effect-ordering.md)).

**Focus:**

```jsx
function Form() {
  const inputRef = useRef(null);

  function handleClick() {
    inputRef.current.focus();
  }

  return (
    <>
      <input ref={inputRef} />
      <button onClick={handleClick}>Focus the input</button>
    </>
  );
}
```

**Scroll:**

```jsx
firstCatRef.current.scrollIntoView({
  behavior: 'smooth',
  block: 'nearest',
  inline: 'center'
});
```

Both are read-only or non-destructive, which is exactly the category the docs
bless.

## A ref per item in a list

The obvious approach is illegal, and for a reason worth stating:

```jsx
<ul>
  {items.map((item) => {
    // Doesn't work!
    const ref = useRef(null);
    return <li ref={ref} />;
  })}
</ul>
```

> This is because **Hooks must only be called at the top-level of your
> component.** You can't call `useRef` in a loop, in a condition, or inside a
> `map()` call.

The documented answer is one ref holding a `Map`, populated by a ref callback:

```jsx
const itemsRef = useRef(null);

function getMap() {
  if (!itemsRef.current) {
    // Initialize the Map on first usage.
    itemsRef.current = new Map();
  }
  return itemsRef.current;
}

// ...
<li
  key={cat.id}
  ref={node => {
    const map = getMap();
    map.set(cat, node);

    return () => {
      map.delete(cat);
    };
  }}
>
```

Three things to notice. `getMap()` is [topic 01](../01-useref.md)'s initialization
idiom — one ref, lazily filled. The callback **returns a cleanup**, which is the
React 19 form ([Phase 4 · 15](../../phase-4-effects/15-effects-and-refs.md)); the map
entry is removed when the node goes away, so the map cannot leak detached nodes.
And:

> **When Strict Mode is enabled, ref callbacks will run twice in development.**
> This helps find bugs in callback refs.

Without the `map.delete` cleanup, that extra cycle leaves the map with double the
entries — the diagnostic from [Phase 4 · 05](../../phase-4-effects/05-strictmode-double-invocation.md).

## Gotchas

**Symptom:** `ref.current` is `null` when read in the component body.
**Cause:** correct — React populates it during the commit, after render.
**Fix:** read it in an event handler or an effect.

**Symptom:** `useRef` called inside `map()` and the linter objects.
**Cause:** hooks may only be called at the top level, never in a loop, a condition
or a `map()`.
**Fix:** one ref holding a `Map`, filled by a ref callback.

**Symptom:** a list's ref map keeps growing, or holds detached nodes.
**Cause:** the ref callback sets entries but never deletes them.
**Fix:** return a cleanup that deletes the entry. `StrictMode` makes this visible
by doubling the entries.

**Symptom:** the map is rebuilt on every render.
**Cause:** it was created in the component body instead of lazily inside the ref.
**Fix:** the `getMap()` idiom — one ref, initialised on first use.

**Symptom:** focus or scroll called during render does nothing.
**Cause:** the node does not exist yet; `ref.current` is still `null`.
**Fix:** an event handler, or an effect if it must happen on mount.

## Interview questions

**★ Why is `ref.current` `null` during render, and where should you read it?**
Because React only writes the node into the ref during the commit, after your
component has returned — before that, the DOM for this update does not exist. Read
it in an event handler or an effect, both of which run after the commit. That is
also why the general "do not read `ref.current` during rendering" rule is not
merely stylistic for DOM refs: there is genuinely nothing there.

**★ How do you get a ref to each item of a list of unknown length?**
Not with `useRef` inside `map()` — hooks must be called at the top level. Use one
ref holding a `Map`, and a ref callback on each item that sets the entry and
returns a cleanup deleting it. The cleanup matters: without it the map retains
detached nodes, and `StrictMode`'s extra ref-callback cycle leaves double the
entries, which is the diagnostic for exactly this mistake.

**What are refs legitimately for, according to the docs?**
Stepping outside React — managing focus, scroll position, and calling browser APIs
React does not expose. They are described as an escape hatch, and the safe
operations are the non-destructive ones. Anything that changes what React renders
belongs in state.

---

Index: [DOM refs](README.md) · Next → [Crossing component boundaries](02-crossing-boundaries.md)
