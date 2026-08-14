---
title: "State, effects and re-suspending"
sidebar_label: "02 · State, effects, re-suspending"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (Caveats and
> *Showing stale content while fresh content is loading*).
> No sandbox script backs this page; claims are cited, not measured.

**The boundary is easy. What it does to state and effects when content suspends, and
what happens the *second* time it suspends, is where the surprises are — and one of those
caveats is the reason topic 11 exists.**

## Suspending before first mount discards state

> React **does not preserve any state for renders that got suspended before they were able
> to mount for the first time.** When the component has loaded, React will **retry
> rendering the suspended tree from scratch.**

Two consequences, both easy to trip over:

- **Anything the suspended render computed is thrown away.** The retry starts over, so a
  component that suspends on its first render effectively renders twice — once to
  discover it cannot finish, once for real. Impure render code is multiplied again, for
  the same reason as transitions
  ([topic 01](../01-usetransition/01-marking-an-update-non-urgent.md)).
- **You cannot seed state above a suspending component and expect it to survive.** There
  is no partial mount to preserve; the tree had never mounted.

This is also why a promise created *during* that render is fatal rather than merely
wasteful: the retry runs the component again, creates another new promise, suspends
again, and never terminates. That is topic 04's caching requirement, seen from the
boundary's side.

## Re-suspending hides content again — unless

The caveat that defines the phase:

> If Suspense was displaying content for the tree, but then it **suspended again**, the
> `fallback` will be **shown again** unless the update causing it was caused by
> **`startTransition`** or **`useDeferredValue`**.

Read as a rule for building UI:

| The update that caused the re-suspend | What the user sees |
|---|---|
| An ordinary `setState` | The visible content **vanishes**, replaced by the fallback |
| Inside `startTransition` | The old content **stays** on screen until the new content is ready |
| Via `useDeferredValue` | The old content stays, and `query !== deferredQuery` tells you it is stale |

The first row is the bug people ship: a working page that flashes back to a skeleton every
time the user changes a filter. Nothing is broken — the boundary is doing exactly what it
says — but the experience is worse than no Suspense at all, because the content the user
was reading disappeared.

**So a transition is not an optimisation you add later. For any update that re-enters a
boundary already showing content, it is part of the correct implementation.**
[Topic 11](../11-suspense-inside-a-transition.md) is entirely about this, and
[topic 01 · 02](../01-usetransition/02-ispending-and-which-tool.md) explains why
`isPending` becomes your only feedback once you do it.

## The stale-content pattern, from the docs

The documented shape for "keep showing the old results while the new ones load":

```jsx
export default function App() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  return (
    <>
      <label>
        Search albums:
        <input value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <Suspense fallback={<h2>Loading...</h2>}>
        <SearchResults query={deferredQuery} />
      </Suspense>
    </>
  );
}
```

> The `query` will update immediately, so the input will display the new value. However,
> the **`deferredQuery` will keep its previous value until the data has loaded**, so
> `SearchResults` will show the **stale results** for a bit.

And the part most implementations leave out:

> To make it more obvious to the user, you can add a **visual indication** when the stale
> result list is displayed:

```jsx
<div style={{
  opacity: query !== deferredQuery ? 0.5 : 1
}}>
  <SearchResults query={deferredQuery} />
</div>
```

`query !== deferredQuery` is the trick worth remembering: **comparing the live value with
the deferred one is your staleness flag**, and it needs no extra state. Without it the
user sees results that silently do not match what they typed — which is a worse failure
than a spinner, because it looks correct.

Note the division of labour, which is exactly
[topic 01 · 02](../01-usetransition/02-ispending-and-which-tool.md)'s decision rule: the
input's own state stays urgent because transitions cannot control text inputs, and the
expensive consequence is deferred.

## Layout effects are cleaned up while content is hidden

A caveat that matters to anyone measuring the DOM:

> If React needs to **hide the already visible content** because it suspended again, it
> will **clean up layout Effects in the content tree.** When the content is ready to be
> shown again, React will **fire the layout Effects again.** This ensures that Effects
> measuring the DOM layout don't try to do this while the content is hidden.

So a hidden-then-revealed subtree runs its `useLayoutEffect` cleanup and setup again —
without unmounting. Practically:

- **A tooltip positioner, a scroll-restorer or a measurement hook will re-run.** That is
  correct: the measurement it took before is meaningless while the content is hidden.
- **Layout effects must therefore be idempotent and symmetric**, the ordinary cleanup
  contract ([Phase 4 · 04](../../phase-4-effects/04-cleanup/README.md)) — now with a
  trigger that is not mount or unmount.
- **`useLayoutEffect` and `useEffect` differ here**, and the caveat names only layout
  effects. Do not assume the same handling for ordinary effects
  ([Phase 4 · 12](../../phase-4-effects/12-uselayouteffect.md)).

## What comes for free

> React includes under-the-hood optimizations like **Streaming Server Rendering** and
> **Selective Hydration** that are integrated with Suspense.

Worth knowing now even though Phase 11 covers it: the boundaries you place for *client*
loading states are the same boundaries that let the server stream HTML in pieces and let
React hydrate the part the user interacted with first. **A boundary is not only a
client-side concern**, which raises the value of getting placement right and is another
argument against one giant boundary at the root.

## Gotchas

**Symptom:** changing a filter makes the whole panel flash back to a skeleton.
**Cause:** an ordinary `setState` re-entered a boundary that was already showing content,
so the fallback is shown again.
**Fix:** wrap the update in `startTransition`, or drive the subtree from
`useDeferredValue`.

**Symptom:** a component that suspends on first render appears to run twice.
**Cause:** React preserves no state for a render suspended before first mount and retries
the tree from scratch.
**Fix:** expected. Ensure render is pure — and never create the promise during that
render, or the retry creates another one and never terminates.

**Symptom:** results shown do not match what the user just typed, with no indication.
**Cause:** deferred content is stale by design.
**Fix:** compare `query !== deferredQuery` and dim or mark the stale content, as the docs
demonstrate.

**Symptom:** a tooltip or measurement re-positions itself after a boundary re-reveals
content.
**Cause:** React cleans up layout effects while content is hidden and fires them again on
reveal.
**Fix:** correct behaviour — the old measurement was taken against hidden content. Make
layout effects symmetric.

**Symptom:** state inside a suspended subtree is lost.
**Cause:** if it had never mounted, there was no state to preserve.
**Fix:** hold state above the boundary if it must survive the first load.

**Symptom:** one boundary at the app root, and streaming SSR gives no benefit.
**Cause:** boundaries are also the unit of streaming and selective hydration.
**Fix:** place them where the page genuinely has independent regions.

## Interview questions

**★ A page works, then flashes back to its skeleton whenever a filter changes. Why?**
Because the boundary was already displaying content and something suspended again — and
the docs say the fallback is shown again *unless* the update came from `startTransition`
or `useDeferredValue`. Nothing is broken; the fix is to mark the update as a transition,
or to drive the subtree from a deferred value so the old content stays until the new
content is ready.

**★ What happens to state and work in a render that suspends before its first mount?**
It is discarded. React preserves no state for renders that suspended before they were
able to mount, and retries rendering the tree from scratch once the data is ready — so
the component effectively renders twice, and any impurity in render is multiplied. It is
also why creating a promise during that render never terminates: the retry creates a new
one and suspends again.

**★ Describe the stale-content pattern and the part people leave out.**
Keep the input's own state urgent and pass `useDeferredValue(query)` into the suspending
subtree, so the input updates immediately while the results keep their previous value
until the new data loads. The part usually left out is the staleness indicator: comparing
`query !== deferredQuery` tells you the content is out of date, and the docs dim the list
with it. Without that, the user sees results that quietly do not match what they typed.

**★ What does a boundary do to layout effects when it hides content?**
It cleans up the layout effects in the content tree while the content is hidden, and
fires them again when it is shown — so that effects measuring DOM layout do not run
against hidden content. The consequence is that layout effects can be torn down and set
up again without an unmount, so they must be symmetric.

**Why does boundary placement matter beyond loading states?**
Because Suspense is integrated with streaming server rendering and selective hydration.
The boundaries you place for client loading states are the same ones that let the server
stream HTML in pieces and let React hydrate the region the user touched first — so a
single boundary at the root gives that up along with everything else.

---

← Prev: [The boundary and the fallback](01-the-boundary-and-the-fallback.md) ·
Index: [`<Suspense>`](README.md) ·
Next → [What can actually suspend](../03-what-can-suspend.md)
