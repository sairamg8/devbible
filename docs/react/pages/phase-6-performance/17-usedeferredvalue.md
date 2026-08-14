---
title: "useDeferredValue for a laggy list"
sidebar_label: "17 · useDeferredValue"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useDeferredValue`](https://react.dev/reference/react/useDeferredValue).
> 🔴 **This topic is deliberately short.** `useDeferredValue` belongs to concurrent
> rendering and is taught properly in **Phase 8**, alongside `startTransition`,
> `useTransition` and Suspense. It appears here so the phase's decision procedure is
> complete, not to teach it.
> No sandbox script backs this page.

**The fourth answer to a laggy list, and the only one that does not make the work
cheaper — it makes the work *later*, so typing stays responsive while results catch
up.**

## Where it sits in this phase

The phase has offered three kinds of fix. This is a fourth kind:

| Approach | What it changes |
|---|---|
| Memoization ([02–04](02-memo.md)) | skip work that would repeat |
| Structure ([13](13-moving-state-down.md)) | do less work |
| Fewer nodes ([14](14-list-virtualization.md)) | render less |
| **`useDeferredValue`** | **do the same work, at a lower priority** |

Nothing gets faster. The expensive render still happens — it is just allowed to lag
behind the input, so the character appears immediately and the filtered list updates
a beat later.

```jsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <SlowResults query={deferredQuery} />
    </>
  );
}
```

`query` updates immediately, so the input never feels stuck. `deferredQuery` lags,
so `SlowResults` re-renders at lower priority and can be interrupted by the next
keystroke.

## When it is the right tool

**When the work is genuinely necessary and genuinely expensive**, and you have
already tried the other three. If the list can be virtualized, virtualize it. If the
filtering can move server-side, move it. `useDeferredValue` is what you reach for
when the expensive render must happen on the client and cannot be made cheaper.

It also composes with the others rather than replacing them: a virtualized list fed
a deferred query is a perfectly reasonable combination.

## Two things worth knowing now

**It pairs with `memo`.** The deferred value only helps if the expensive subtree
actually skips re-rendering when the value has not changed — otherwise it re-renders
at every priority anyway. This is one of the clear cases where `memo` earns its place
([topic 02](02-memo.md)).

**Stale content stays on screen.** While the deferred render is pending, the previous
results remain visible rather than being replaced by a fallback. That is usually what
you want for a search list, and it is a different behaviour from Suspense's fallback
— which is precisely why both exist and why the distinction is Phase 8's subject.

## Where it is taught

Phase 8 — Concurrent rendering, Suspense and transitions — covers this properly:
what "lower priority" actually means, how it relates to `startTransition` and
`useTransition`, how to indicate pending state, and the interaction with Suspense
boundaries. Reaching for it before understanding that machinery tends to produce
either no measurable change or a confusing one.

## Gotchas

**Symptom:** `useDeferredValue` added and nothing improved.
**Cause:** the expensive subtree re-renders regardless, because it is not memoized
and the deferred value is not its only input.
**Fix:** `memo` the subtree and pass it the deferred value only.

**Symptom:** the input is still laggy.
**Cause:** the input's own state is deferred too, or the expensive work is in the
same component as the input.
**Fix:** keep the immediate value on the input and pass the deferred one downward —
which is also [topic 13](13-moving-state-down.md)'s shape.

**Symptom:** results look wrong for a moment.
**Cause:** they are stale by design while the deferred render is pending.
**Fix:** expected. Indicate it visually if it matters — Phase 8 covers pending
indication.

**Symptom:** reached for before virtualization or server-side filtering.
**Cause:** deferring expensive work rather than removing it.
**Fix:** try the other three approaches first. This one keeps the cost.

## Interview questions

**★ How does `useDeferredValue` differ from everything else in this phase?**
It does not make anything faster. Memoization skips repeated work, structural fixes
do less work, and virtualization renders fewer nodes — this does the same work at a
lower priority, so the input stays responsive while the expensive subtree lags a beat
behind. It is the right tool only when the work is genuinely necessary and cannot be
made cheaper.

**★ Why does it usually need `memo`?**
Because deferring the *value* only helps if the expensive subtree actually skips
re-rendering when that value has not changed. Without memoization it re-renders at
every priority regardless, and the deferral buys nothing. It is one of the clearest
cases where `memo` earns its place.

**When would you not use it?**
When the work can be removed instead — virtualize the list, filter server-side, or
render less. Deferring keeps the cost and only moves it, so it is the fourth thing to
try, not the first. It does compose with the others: a virtualized list fed a
deferred query is reasonable.

---

← Prev: [Bundle size](16-bundle-size.md) · Index: [Phase 6](README.md)
