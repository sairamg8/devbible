---
title: "What can actually suspend"
sidebar_label: "03 · What can actually suspend"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (Caveats and the list of
> activating sources), [`lazy`](https://react.dev/reference/react/lazy) (parameters,
> returns, and the declare-outside guidance), and
> [`use`](https://react.dev/reference/react/use).
> No sandbox script backs this page; claims are cited, not measured.

**Suspense is not a loading-state framework. It activates for a short, closed list of
things — and the thing everybody expects to be on that list is explicitly not on it.**

## The list

> Data sources that activate a Suspense boundary include:
>
> - Lazy-loading component code with **`lazy`**
> - Reading a Promise with **`use`**, including data streamed from Server Components or
>   loaded through a Suspense-enabled framework
> - Loading a stylesheet with **`<link rel="stylesheet">` and a `precedence` prop**

Plus, from the caveat that enumerates the mechanism:

> It only activates in specific cases (**lazy components, data read with `use`,
> stylesheets with precedence, fonts, images**, and CPU-bound render work in `defer`
> boundaries).

So, in a stable 19.2.8 app, four things you will actually meet:

| Source | How it suspends |
|---|---|
| `lazy(() => import(...))` | The component's code is not loaded yet |
| `use(promise)` | The promise has not resolved |
| A framework loader / Server Component data | Same mechanism — it caches a promise and calls `use` |
| `<link rel="stylesheet" precedence>`, fonts, images | The asset has not loaded |

And one that is experimental: `defer` boundaries, for CPU-bound render work. Not
available to you on stable.

## 🔴 What is not on the list

> **Suspense does not detect when data is fetched inside an Effect or event handler.**

> By contrast, **code that fetches data outside of `use`, such as inside an Effect, does
> not activate the boundary.**

```jsx
// 🔴 The boundary does nothing here. Not "sometimes" — nothing.
function Profile({ id }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(setUser);
  }, [id]);
  return <h1>{user.name}</h1>;   // crashes on the first render
}

<Suspense fallback={<Spinner />}>
  <Profile id={7} />
</Suspense>
```

The mechanical reason is worth holding onto because it makes the rule obvious rather than
arbitrary: **suspending is something that happens *during render*.** An effect runs
**after** the commit. By the time `fetch` is called, the render has already succeeded —
there was nothing for the boundary to catch, and the component has already returned JSX
using data it does not have.

No amount of boundary placement changes this. A component fetching in an effect owns its
own loading state, exactly as it did before Suspense existed
([Phase 4 · 07](../phase-4-effects/07-fetching-data.md)) — and the honest fix is usually
to stop fetching in an effect at all
([Phase 4 · 06](../phase-4-effects/06-you-might-not-need-an-effect/README.md)), which is
Phase 12's subject.

Two more that are not on the list and get assumed:

- **A slow render.** Rendering 10,000 rows takes a second and suspends nothing. The
  boundary is for *unavailable* things, not *expensive* ones — that is what a transition
  is for ([topic 01](01-usetransition/README.md)), and on the experimental channel what
  `defer` is aimed at.
- **A pending mutation.** Submitting a form and waiting for the server is an event
  handler's business. Phase 9's Actions and `useActionState` own that; Suspense does not.

## `lazy`, and the two rules it comes with

> `lazy` lets you defer loading a component's code until it is rendered for the first
> time.

> `lazy` returns a React component you can render in your tree. **While the code for the
> lazy component is still loading, attempting to render it will *suspend*.** Use
> `<Suspense>` to display a loading indicator while it's loading.

**Rule 1 — the promise is cached for you.**

> React will **not call `load` until the first time you attempt to render** the returned
> component. After React first calls `load`, it will wait for it to resolve, and then
> render the resolved value's **`.default`** as a React component. **Both the returned
> Promise and the Promise's resolved value will be cached, so React will not call `load`
> more than once.** If the Promise rejects, React will **`throw` the rejection reason for
> the nearest Error Boundary** to handle.

Three things in one paragraph: loading is lazy in the real sense (nothing happens until
the first render attempt); the module's **default export** is what gets rendered, so a
named-export-only module fails; and **rejection goes to an error boundary**, not to the
Suspense boundary — which is why the two are always designed as a pair (topic 16).

**Rule 2 — 🔴 declare it outside your components.**

```jsx
function Editor() {
  // 🔴 Bad: This will cause all state to be reset on re-renders
  const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));
  // ...
}
```

```jsx
// ✅ Good: Declare lazy components outside of your components
const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));

function Editor() {
  // ...
}
```

The docs' comment names the symptom — *"all state to be reset on re-renders"* — and the
cause is the reconciliation rule from
[Phase 3 · 15](../phase-3-state/15-preserving-and-resetting.md): calling `lazy()` during
render produces **a new component type on every render**, and a different type at the same
position destroys the subtree's state. The caching that `lazy` provides is per returned
component, so a fresh one each render caches nothing either.

This is the same shape as the `use(promise)` requirement — **create the thing once,
outside the render that consumes it** — and it is the single idea that unifies this whole
topic.

## The unifying rule

Everything on the list is something React can **identify across renders**:

- `lazy` gives React one stable component object, so it can cache the module against it.
- `use` needs the **same promise instance** across renders, which is why it must be
  cached (topic 04).
- A stylesheet or font is identified by its URL.

Everything that fails does so because it produces a **new thing every render** — a new
promise, a new component type, a new fetch. A boundary that retries a suspended tree from
scratch ([topic 02 · 02](02-suspense/02-state-effects-and-resuspending.md)) will retry
straight back into a fresh promise and never terminate.

**"Can React tell that this is the same request it was already waiting for?"** If no, it
cannot suspend on it usefully.

## Gotchas

**Symptom:** a `<Suspense>` boundary never shows its fallback.
**Cause:** nothing inside it suspends — most often a `fetch` in an effect.
**Fix:** the boundary cannot help. Read the data with `use` from a cached promise, or keep
the component's own loading state.

**Symptom:** a component crashes reading `user.name` on first render.
**Cause:** effect-fetched data is `null` on the render that matters; the boundary did not
intervene.
**Fix:** a null check and real loading state, or move to a Suspense-enabled data source.

**Symptom:** a lazy component resets all its state on re-render.
**Cause:** `lazy()` called inside a component creates a new component type each render.
**Fix:** declare it at module top level.

**Symptom:** a lazy import loads but renders nothing / errors on `.default`.
**Cause:** React renders the resolved value's `.default`; the module has only named
exports.
**Fix:** give the module a default export, or wrap the import to provide one.

**Symptom:** a failed chunk load shows the Suspense fallback forever.
**Cause:** a rejected `load` is thrown for the nearest **Error** Boundary, not handled by
Suspense.
**Fix:** put an error boundary above it. The two are a pair.

**Symptom:** a slow render is wrapped in Suspense and nothing improves.
**Cause:** expensive is not the same as unavailable; slow rendering does not suspend.
**Fix:** a transition, memoization or virtualization — not a boundary.

**Symptom:** a form submission is wrapped in Suspense and the fallback never shows.
**Cause:** event handlers do not suspend.
**Fix:** Phase 9's Actions and pending state.

## Interview questions

**★ What can make a component suspend?**
A short closed list: lazy-loaded component code via `lazy`, a promise read with `use`
(including Server Component data or a Suspense-enabled framework's loader, which caches
promises and calls `use` underneath), and assets — stylesheets with a `precedence` prop,
fonts and images. On the experimental channel, `defer` boundaries add CPU-bound render
work.

**★ Why doesn't a `fetch` inside `useEffect` trigger a boundary?**
Because suspending happens during render and an effect runs after the commit. By the time
the fetch is called the render has already succeeded, so there was never anything for the
boundary to catch — and the docs state outright that Suspense does not detect data
fetched inside an Effect or event handler. No amount of boundary nesting changes it.

**★ Why must `lazy()` be declared outside a component?**
Because calling it during render returns a new component type on every render, and a
different type at the same position resets the whole subtree's state — the docs' own
comment says "this will cause all state to be reset on re-renders". It also defeats the
caching, since the cache lives on the returned component.

**★ What does `lazy` guarantee about the loading?**
That `load` is not called until the first render attempt, that both the returned promise
and its resolved value are cached so `load` is never called more than once, and that the
resolved value's `.default` is rendered as the component. A rejection is thrown for the
nearest **error** boundary — Suspense handles pending, not failed.

**What is the single rule behind everything on and off the list?**
Whether React can identify the thing across renders. `lazy` gives it one stable component
object; `use` needs the same promise instance, which is why caching is mandatory; an asset
is identified by URL. Everything that fails produces a new thing each render, and since a
suspended tree is retried from scratch, a fresh promise each time means it never
terminates.

**Is Suspense the answer to a slow render?**
No. It is for content that is unavailable, not content that is expensive. A slow render
suspends nothing; the tools are transitions, memoization and virtualization. The
experimental `defer` prop is React's move in that direction and is not in stable 19.2.8.

---

← Prev: [`<Suspense>`](02-suspense/README.md) ·
Index: [Phase 8](README.md) ·
Next → [`use(promise)`](04-use-promise.md)
