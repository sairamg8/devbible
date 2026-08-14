---
title: "Lazy loading components"
sidebar_label: "12 · Lazy loading components"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`lazy`](https://react.dev/reference/react/lazy) and
> [`<Suspense>`](https://react.dev/reference/react/Suspense).
> Suspense itself is Phase 8; this page covers only what `lazy` needs from it.
> No sandbox script backs this page.

**The first optimisation in this phase that reduces work rather than remembering
it. Everything in topics 02–11 makes re-rendering cheaper; `lazy` stops code from
being downloaded at all until it is needed.**

```jsx
const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));
```

> `load`: A function that returns a Promise … **React will not call `load` until the
> first time you attempt to render the returned component.** After React first calls
> `load`, it will wait for it to resolve, and then render the resolved value's
> **`.default`** as a React component.

Two details in that sentence: it resolves `.default`, so the module needs a default
export; and the call is deferred until first render, not until first import.

## 🔴 Declare it at module level

The pitfall, and the consequence is severe:

```jsx
function Editor() {
  // 🔴 Bad: This will cause all state to be reset on re-renders
  const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));
}
```

> Declaring lazy components inside other components will cause **all state to be
> reset on re-renders.**

```jsx
// ✅ Good: Declare lazy components outside of your components
const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));

function Editor() {
  // ...
}
```

The mechanism is [Phase 3 · 15](../phase-3-state/15-preserving-and-resetting.md)'s:
`lazy()` returns a **new component type** every time it is called, and React
resets state when the type at a position changes. So this is not merely
inefficient — it silently wipes everything below it on every parent render, which
looks like a state bug with no obvious cause.

It is the same failure as defining a component inside a component, which is why
`static-components` is a lint rule ([topic 10](10-eslint-plugin-react-hooks.md)).

## The promise is cached

> Both the returned Promise **and the Promise's resolved value will be cached**, so
> **React will not call `load` more than once.**

So the chunk downloads once, no matter how many times the component mounts and
unmounts. There is nothing to memoize here and no need to hold the component
mounted to "keep it loaded".

## Suspense is required

> While the code for the lazy component is still loading, attempting to render it
> will **suspend.** Use `<Suspense>` to display a loading indicator.

```jsx
<Suspense fallback={<Loading />}>
  <h2>Preview</h2>
  <MarkdownPreview />
</Suspense>
```

The boundary can be the lazy component's parent or any ancestor — and **where you
put it decides how much of the screen disappears while loading**, which is the whole
design question. A boundary at the route level replaces the page; one wrapped tightly
around the lazy component replaces only that region.

And failure:

> If the Promise rejects, React will **`throw` the rejection reason for the nearest
> Error Boundary** to handle.

A chunk that fails to load — a deploy that removed the old hash, a flaky network —
is an error boundary's problem, not a `catch`. Route-level code splitting without an
error boundary means a failed chunk fetch takes down the screen with no recovery,
and this is common enough after a deploy that it is worth handling deliberately.

## Where to split

**Route level** is the default and the highest-value: users load the route they
asked for, not every route.

**Heavy leaf dependencies** are the other clear win — a rich text editor, a chart
library, a map, a PDF viewer. One heavy import in a rarely-used component otherwise
ships to everyone ([topic 16](16-bundle-size.md)).

**Below the fold or behind interaction** — a modal's contents, a settings panel, an
admin-only section.

What is *not* worth splitting: small components. Each split is a separate request
and a potential loading state, so splitting a 3KB component trades a real cost for
nothing.

## Preloading on intent

The gap `lazy` leaves is that the download starts when the component *renders*,
which is the moment the user is already waiting. Since `load` is an ordinary
function returning a promise, you can call the same dynamic `import()` earlier — on
hover, on focus, or when a route becomes likely:

```jsx
const load = () => import('./MarkdownPreview.js');
const MarkdownPreview = lazy(load);

// elsewhere
<button onMouseEnter={load} onFocus={load} onClick={open}>Preview</button>
```

Calling `import()` twice is safe — the module system caches it, as React caches the
promise. So the hover starts the download and the click finds it already in flight
or complete.

⚠️ **This is a community pattern built on documented behaviour** (the promise is
cached; `load` is a plain function), not a documented React API. Include `onFocus`
as well as `onMouseEnter` or keyboard users get none of the benefit.

## A loading state that does not flash

The failure mode of fine-grained splitting is a spinner appearing for 80ms and
disappearing — worse than no spinner, because motion draws the eye to a problem that
has already resolved.

Three mitigations, in order of preference:

1. **Preload on intent**, so the code arrives before the boundary is reached and no
   fallback shows at all.
2. **Fewer, larger boundaries** — one per route rather than one per component.
3. **A fallback that resembles the final layout** — a skeleton of the right shape
   rather than a centred spinner, so the transition is a fill rather than a jump.

Suspense's own tools for this — transitions, and avoiding an already-visible UI
being replaced — are Phase 8.

## Gotchas

**Symptom:** all state below a lazy component resets on every parent render.
**Cause:** `lazy()` called inside a component, producing a new component type each
render.
**Fix:** declare it at module level. Documented, and the same failure as defining a
component inside a component.

**Symptom:** `A React component suspended while rendering, but no fallback UI was
specified.`
**Cause:** no `<Suspense>` boundary above the lazy component.
**Fix:** add one, and choose its position deliberately — it decides how much of the
screen is replaced.

**Symptom:** the app breaks after a deploy when someone opens a rarely-used screen.
**Cause:** the chunk hash changed and the old one is gone; the rejected promise is
thrown to the nearest error boundary, and there is not one.
**Fix:** an error boundary around lazily-loaded regions, ideally offering a reload.

**Symptom:** a spinner flashes for a fraction of a second on every navigation.
**Cause:** boundaries too fine-grained and no preloading.
**Fix:** preload on hover and focus, fewer boundaries, skeletons shaped like the
content.

**Symptom:** `Element type is invalid` when the lazy component renders.
**Cause:** the module has no `default` export — `lazy` resolves `.default`.
**Fix:** default-export the component, or map it in the `load` function.

**Symptom:** dozens of small chunks and no measurable improvement.
**Cause:** splitting components too small to matter, each costing a request.
**Fix:** split routes and heavy dependencies.

## Interview questions

**★ Why must `lazy` be called at module level?**
Because it returns a new component type on every call, and React resets state when
the type at a tree position changes — so calling it inside a component wipes all
state below it on every render. The docs state the consequence directly. It is the
same failure as defining a component inside a component, which is why there is a
`static-components` lint rule.

**★ What does `lazy` require around it, and what happens on failure?**
A `<Suspense>` boundary, because rendering a not-yet-loaded lazy component suspends.
If the promise rejects, React throws the rejection to the nearest error boundary —
so a failed chunk fetch after a deploy takes down the screen unless you have one.
Both the promise and its resolved value are cached, so `load` is never called twice.

**★ How do you avoid the loading state flashing?**
Preload on intent — `load` is a plain function returning a dynamic `import()`, so
calling it on hover and focus starts the download before the user commits, and the
module system caches it so calling twice is free. Failing that, use fewer and larger
boundaries, and make the fallback a skeleton shaped like the content rather than a
centred spinner.

**Where is code splitting actually worth it?**
Route level first, then heavy leaf dependencies — an editor, a chart library, a map
— which otherwise ship to every user for a screen most never open. Splitting small
components is a loss: each split costs a request and a potential loading state in
exchange for a few kilobytes.

**How does this differ from everything else in the phase?**
Memoization makes re-rendering cheaper; `lazy` stops code being downloaded at all
until it is needed. It is one of the few optimisations here that improves the *first*
load, which `useMemo` explicitly does not.

---

← Prev: [Do you still write `useMemo`?](11-do-you-still-write-usememo.md) · Index: [Phase 6](README.md) · Next → [Moving state down and lifting content up](13-moving-state-down.md)
