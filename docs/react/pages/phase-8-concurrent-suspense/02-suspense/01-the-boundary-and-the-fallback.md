---
title: "The boundary and the fallback"
sidebar_label: "01 · The boundary and the fallback"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (definition, props, Caveats,
> *Displaying a fallback while content is loading*, *Revealing content together at once*,
> *Revealing nested content as it loads*).
> No sandbox script backs this page; claims are cited, not measured.

**A Suspense boundary is a place in the tree where React is allowed to show something
else while what belongs there is not ready. It is not a loading-state manager and it does
not know anything about your data — it reacts to a component *suspending*, which is a
specific thing that only specific APIs do.**

## The component

> `<Suspense>` lets you display a fallback until its children have finished loading.

```jsx
<Suspense fallback={<Loading />}>
  <SomeComponent />
</Suspense>
```

> **`children`**: The actual UI you intend to render. **If `children` suspends while
> rendering, the Suspense boundary will switch to rendering `fallback`.**

> **`fallback`**: An alternate UI to render in place of the actual UI if it has not
> finished loading. Any valid React node is accepted, though in practice, a fallback is a
> lightweight placeholder view, such as a loading spinner or skeleton. Suspense will
> automatically switch to `fallback` when `children` suspends, and back to `children` when
> the data is ready. **If `fallback` suspends while rendering, it will activate the
> closest parent Suspense boundary.**

That last sentence is a real constraint, not a footnote: a fallback is rendered like
anything else, so a "skeleton" that itself imports a lazy component or reads a promise
will push the fallback up to the *parent* boundary — and the loading state you designed
never appears. **Keep fallbacks dumb.**

## 🔴 What "suspends" actually means

This is the caveat that resolves most Suspense confusion, and it is worth reading twice:

> **Suspense does not detect when data is fetched inside an Effect or event handler.** It
> only activates in specific cases (lazy components, data read with `use`, stylesheets
> with precedence, fonts, images, and CPU-bound render work in `defer` boundaries).

The sources that activate a boundary, from the same page:

> - Lazy-loading component code with **`lazy`**
> - Reading a Promise with **`use`**, including data streamed from Server Components or
>   loaded through a Suspense-enabled framework
> - Loading a stylesheet with **`<link rel="stylesheet">` and a `precedence` prop**

> A *Suspense-enabled framework* gives you a way to read data in your component in a way
> that activates the closest Suspense boundary. Under the hood, a Suspense-enabled
> framework **maintains a cache of Promises and calls `use`** to suspend on a Promise.

> By contrast, **code that fetches data outside of `use`, such as inside an Effect, does
> not activate the boundary.**

So the single most common expectation is wrong: wrapping a component that does
`useEffect(() => { fetch(...) }, [])` in a `<Suspense>` **does nothing at all**. No
matter how many boundaries you nest, the effect runs after the commit — by which time the
render already succeeded and there was nothing to suspend. That component must manage its
own `isLoading` state, exactly as it did before Suspense existed.

Note also what the framework sentence reveals: there is no separate mechanism for
frameworks. A router or data library that "supports Suspense" caches promises and calls
`use`. Topic 03 takes the full list apart; topic 04 covers `use(promise)` and the caching
requirement that makes it work.

⚠️ The `defer` prop in that caveat is **experimental**:

> **`defer`** (experimental, optional): A boolean. When `true`, React may show the
> `fallback` first and render or stream `children` later, **even when nothing in them
> suspends.** Use it for content that is expensive to render. Defaults to `false`.

Treat it as not-in-your-toolbox for a stable 19.2.8 app, alongside the other experimental
APIs this phase flags.

## The boundary is one unit

> By default, **the whole tree inside Suspense is treated as a single unit.** For example,
> even if *only one* of these components suspends waiting for some data, *all* of them
> together will be replaced by the loading indicator … Then, after all of them are ready
> to be displayed, **they will all appear together at once.**

```jsx
<Suspense fallback={<Loading />}>
  <Biography />
  <Panel>
    <Albums />
  </Panel>
</Suspense>
```

`Biography` may have been ready instantly; it is hidden anyway until `Albums` arrives.
That is a **feature** when the pieces only make sense together — a chart and its legend, a
price and its currency — and a bug when it means the entire page waits on the slowest
widget on it.

**The boundary, therefore, is a design decision about what appears together**, not a
technical detail. That is the whole of topic 10.

## Nesting produces a loading sequence

> When a component suspends, **the closest parent Suspense component shows the fallback.**
> This lets you nest multiple Suspense components to create a loading sequence. Each
> Suspense boundary's fallback will be filled in as the next level of content becomes
> available.

```jsx
<Suspense fallback={<BigSpinner />}>
  <Biography />
  <Suspense fallback={<AlbumsGlimmer />}>
    <Panel>
      <Albums />
    </Panel>
  </Suspense>
</Suspense>
```

> 1. If `Biography` hasn't loaded yet, `BigSpinner` is shown in place of the entire
>    content area.
> 2. Once `Biography` finishes loading, `BigSpinner` is replaced by the content.
> 3. If `Albums` hasn't loaded yet, `AlbumsGlimmer` is shown in place of `Albums` and its
>    parent `Panel`.
> 4. Finally, once `Albums` finishes loading, it replaces `AlbumsGlimmer`.

Two things to take from the sequence. **"Closest parent" is the entire routing rule** —
a suspending component looks upward and stops at the first boundary, which is why adding
an inner boundary changes *which* fallback appears without touching the component that
suspends. And note step 3: the glimmer replaces `Albums` **and its parent `Panel`**,
because the boundary is placed outside `Panel`. The fallback replaces everything inside
the boundary, not just the component that suspended.

## Reveals are throttled

> React reveals suspended content **at most once every 300ms**, measured from the last
> reveal. Boundaries that become ready within that window are **revealed together** rather
> than one at a time.

A documented, deliberate anti-flicker rule, and it explains two things that otherwise look
like bugs:

- **Content that was ready "immediately" still appears after a beat.** It was waiting out
  the window.
- **Several boundaries pop in simultaneously** even though their data arrived at different
  times. That is the batching, not a coincidence.

The practical consequence: **do not build a design that depends on boundaries revealing
in a precise order or instantly.** If the ordering genuinely matters, that is what
`SuspenseList` would be for — and it is still `unstable_` (topic 18).

## Gotchas

**Symptom:** a component fetches in an effect, is wrapped in `<Suspense>`, and the
fallback never shows.
**Cause:** Suspense does not detect data fetched inside an Effect or an event handler.
**Fix:** nothing about the boundary can fix it. Either read the data with `use` from a
cached promise, or keep the component's own loading state.

**Symptom:** the fallback you designed never appears; a parent's fallback shows instead.
**Cause:** the fallback itself suspended, which activates the closest *parent* boundary.
**Fix:** keep fallbacks lightweight — no lazy components, no `use`, no stylesheet with
precedence.

**Symptom:** a fast section of the page waits for a slow one.
**Cause:** they share a boundary, and the whole tree inside a boundary is one unit.
**Fix:** give the slow part its own nested boundary.

**Symptom:** more of the UI disappears than expected when something suspends.
**Cause:** the fallback replaces everything inside the boundary, including wrappers like
a `Panel` that did not suspend.
**Fix:** move the boundary inside the wrapper if the wrapper should stay.

**Symptom:** content that loaded instantly still appears after a short delay.
**Cause:** reveals are throttled to at most once every 300 ms.
**Fix:** working as documented. Do not design around precise reveal timing.

**Symptom:** a framework's data loading "just works" with Suspense and hand-written
`fetch` does not.
**Cause:** the framework caches promises and calls `use`; there is no other mechanism.
**Fix:** do the same — a cached promise read with `use`.

## Interview questions

**★ What actually makes a component "suspend"?**
Only specific things: lazy-loaded component code via `lazy`, a promise read with `use`
(including data streamed from Server Components or supplied by a Suspense-enabled
framework), stylesheets loaded with a `precedence` prop, and fonts and images. The docs
state plainly that Suspense does **not** detect data fetched inside an Effect or an event
handler — so wrapping an effect-fetching component in a boundary does nothing, no matter
how many boundaries you nest.

**★ How does a framework "support Suspense"?**
There is no separate mechanism. Under the hood it maintains a cache of promises and calls
`use` to suspend on one. That is why the caching requirement on `use` is not an
optimisation but the thing that makes the whole pattern work.

**★ What does a boundary do when one of several children suspends?**
Replaces all of them. The whole tree inside a boundary is treated as a single unit, so
everything is hidden until everything is ready, and then it appears together. That is
right when the pieces only make sense together and wrong when it makes the page wait on
its slowest widget — which is why boundary placement is a design decision.

**★ Which boundary shows the fallback when a component suspends?**
The closest parent Suspense component. That single rule is what makes nesting produce a
loading sequence: adding an inner boundary changes which fallback appears without
touching the component that suspends. And the fallback replaces everything inside that
boundary, including wrapper components that did not suspend themselves.

**Why does content sometimes appear later than its data arrived?**
React reveals suspended content at most once every 300 ms, measured from the last reveal,
and boundaries that become ready inside that window are revealed together. It is a
deliberate anti-flicker rule, and it means a design must not depend on exact reveal
timing or ordering.

**What happens if the fallback itself suspends?**
It activates the closest parent Suspense boundary, so the parent's fallback is shown
instead of the one you wrote. Fallbacks are rendered like any other UI, so a skeleton that
lazily imports a component or reads a promise will quietly escalate.

---

← Index: [`<Suspense>`](README.md) ·
Prev: [`startTransition` and `useTransition`](../01-usetransition/README.md) ·
Next → [State, effects and re-suspending](02-state-effects-and-resuspending.md)
