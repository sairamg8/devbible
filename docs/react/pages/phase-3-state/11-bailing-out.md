---
title: "Bailing out"
sidebar_label: "11 · Bailing out"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useState`](https://react.dev/reference/react/useState) set-function caveats
> and [Render and Commit](https://react.dev/learn/render-and-commit). No sandbox
> script backs this page; claims are cited, not measured.

**Setting state to the value it already has does not always cost nothing, and
does not always cost a render either. The precise wording of the caveat matters,
because both over-confident readings produce bugs.**

## The caveat, exactly

> If the new value you provide is identical to the current `state`, as determined
> by an `Object.is` comparison, React will **skip re-rendering the component and
> its children.** This is an optimization. **Although in some cases React may
> still need to call your component before skipping the children, it shouldn't
> affect your code.**

Three separate claims, and each one is load-bearing:

1. **The comparison is `Object.is`** — reference equality for objects, with the
   `NaN` and `-0` corrections. Not deep, not shallow.
2. **It skips the component *and its children*.**
3. **React may still call your component first.** A bail-out is not a guarantee
   that your function will not run.

Point 3 is the one that catches people. Reading "React will skip re-rendering"
as "my function definitely will not be called" leads to putting side effects or
counters in the render body and being surprised. The docs add "it shouldn't
affect your code" precisely because a pure component cannot tell the difference —
which is another way of saying **this optimisation is only safe because purity
is assumed**.

## `Object.is`, not equality

```jsx
setCount(5);                 // was 5 → bail out
setUser(user);               // same reference → bail out
setUser({...user});          // new object, identical contents → RENDER
setItems([]);                // new array each call → RENDER every time
```

The third and fourth lines are the practical consequences. `{...user}` with no
changes is a new object, so React renders — correctly, because it has no way to
know the contents are equivalent and checking would be more expensive than
rendering.

The fourth is a real pattern worth flagging: a "clear" button calling
`setItems([])` when the list is already empty allocates a new array and forces a
render every click. `setItems(items => items.length ? [] : items)` avoids it,
though whether that is worth the noise depends on how hot the path is.

## The failure this creates

Bailing out is why mutation produces *silence* rather than an error:

```jsx
items.push(newItem);
setItems(items);        // same reference → React bails out → nothing happens
```

The data changed. The screen did not. No warning, no error — the update was
correctly identified as a no-op by a rule that assumes you never mutate. This is
the single most confusing consequence of the optimisation and the reason
[immutable updates](05-immutable-updates/README.md) is a Master topic.

The mirror failure appears in `useEffect`: an effect that sets state to an
equal value bails out and so does *not* loop, while the same effect setting a
fresh object every time loops forever. Two nearly identical effects, opposite
outcomes ([topic 17](17-infinite-render-loops.md)).

## `useState` bails out; `memo` does not do the same job

Worth separating, because both are described as "skipping renders".

| | Compares | When |
|---|---|---|
| **`useState` bail-out** | The new state vs the old, with `Object.is` | On every `set` call |
| **`memo`** | New props vs old, shallowly | When the parent re-renders |

They are complementary and neither substitutes for the other. It is also why
`memo` does not compare state: as react.dev notes on `PureComponent`, *"calling
the `set` function with the same state already prevents re-renders by default,
even without `memo`."* The state half is built in.

## Why "may still call your component"

The concrete case: React needs to know whether the update is a no-op *for this
component*, and hooks are matched by call order, so in some situations the
cheapest way to establish that is to run the render function and discover that
nothing changed. React then discards the result and does not descend into
children.

You cannot observe this from pure code — which is the point. You *can* observe it
from an impure one:

```jsx
function Widget() {
  renderCount++;                    // 🔴 impure: now you can "see" bail-outs
  const [n, setN] = useState(0);
  …
}
```

and then draw wrong conclusions from what you see. A render counter is a
purity violation and an unreliable instrument at the same time. If you need to
know what re-rendered, the DevTools Profiler is the supported answer.

## The "same value" idioms

Two places where the bail-out is deliberately useful:

**Guarding a no-op update.**

```jsx
setFilter(f => f === next ? f : next);    // returns the same reference → bail out
```

Returning the *existing* value from an updater is the documented way to say "no
change". It is more reliable than an `if` around the setter when the current
value is not in scope — inside a subscription callback, for instance.

**Idempotent subscriptions.** An external store pushing the same value
repeatedly costs nothing, provided the value is a primitive or a stable
reference. If the store hands you a fresh object each time, every push is a
render — which is exactly the problem `useSyncExternalStore`'s `getSnapshot`
contract is about, and why returning a new object from `getSnapshot` produces the
"getSnapshot should be cached" error rather than an infinite loop.

## Gotchas

**Symptom:** state changed but nothing rendered.
**Cause:** the same object reference was passed to the setter after being
mutated.
**Fix:** create a new object. The bail-out was correct given what React could
see.

**Symptom:** a render counter shows renders that "should" have bailed out.
**Cause:** React may call the component before skipping the children — and the
counter is itself a purity violation.
**Fix:** use the Profiler. Do not instrument renders by mutating.

**Symptom:** setting an empty array repeatedly re-renders.
**Cause:** `[]` is a new reference each time.
**Fix:** return the existing value from an updater when nothing changed, if the
path is hot enough to matter.

**Symptom:** an effect loops forever, while a nearly identical one does not.
**Cause:** one sets a primitive that compares equal and bails out; the other
sets a fresh object that never does.
**Fix:** [topic 17](17-infinite-render-loops.md).

**Symptom:** `getSnapshot should be cached to avoid an infinite loop`.
**Cause:** an external store returning a new object from `getSnapshot`, so the
bail-out never fires.
**Fix:** cache the snapshot in the store and return the same reference until it
genuinely changes.

**Symptom:** a child re-renders even though the parent bailed out.
**Cause:** if the parent truly bailed out, it did not — check whether some other
ancestor rendered, or whether the child has its own state or context.
**Fix:** the Profiler names the reason per commit.

## Interview questions

**★ What happens when you set state to the value it already has?**
React compares with `Object.is` and, if identical, skips re-rendering the
component and its children. The documentation adds an important qualification:
in some cases React may still call your component before skipping the children.
So it is an optimisation, not a guarantee that your function will not run —
which is safe only because components are assumed pure.

**★ Why does mutating state and calling the setter do nothing?**
Because the reference is unchanged, so the `Object.is` comparison reports no
change and React bails out. The data really did change, but React cannot see it.
This is why mutation fails silently rather than erroring, and it is the strongest
practical argument for immutable updates.

**★ Is `{...state}` with no changes a no-op?**
No — it is a new object, so `Object.is` is false and React renders. React does
not compare contents, and checking would usually cost more than rendering.
Equally, `setItems([])` on an already-empty list renders every time, because
each `[]` is a fresh array.

**How is this different from `memo`?**
The bail-out compares the new state against the old on every `set` call; `memo`
compares props shallowly when the parent re-renders. They cover different
triggers. It is also why `memo` does not compare state — setting the same state
already prevents a re-render without it.

**How do you deliberately signal "no change" from an updater?**
Return the current value: `setFilter(f => f === next ? f : next)`. Returning the
existing reference makes the comparison succeed and React bails out. It is more
robust than wrapping the setter in an `if` when the current value is not in
scope, as inside a subscription callback.

**Why is a render counter a bad way to study this?**
Because incrementing a variable during render is itself a purity violation, and
because React may call the component before bailing out — so the counter reports
calls that produced no visible render. The DevTools Profiler reports commits and
reasons, which is what the question is actually about.

---

← Prev: [Structuring state](10-structuring-state.md) · Index: [Phase 3](README.md) · Next → [Render order](12-render-order.md)
