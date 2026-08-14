---
title: "State that belongs elsewhere"
sidebar_label: "03 · State that belongs elsewhere"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Notifying parent components about state changes, § Passing data to the
> parent, § Subscribing to an external store).
> No sandbox script backs this page; claims are cited, not measured.

**Three cases where the effect is not solving a timing problem but papering over
a state-location problem. In each one the fix moves the state, and the effect
disappears with it.**

Chunks [01](01-logic-that-belongs-to-an-event.md) and
[02](02-chains-of-effects.md) were about *when* code runs. This is about *where
the state lives* — and the tell is an effect whose whole job is to copy a value
from one component to another.

## Case 9 — Notifying the parent about state changes

A child owns some state and tells its parent whenever it changes:

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);

  // 🔴 Avoid: The onChange handler runs too late
  useEffect(() => {
    onChange(isOn);
  }, [isOn, onChange]);

  function handleClick() {
    setIsOn(!isOn);
  }
}
```

react.dev's objection is named in the comment — *runs too late*. The child sets
state, React renders the child, *then* the effect fires and the parent sets its
own state, which renders again. Two passes for one click.

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);

  function updateToggle(nextIsOn) {
    // ✅ Good: Perform all updates during the event that caused them
    setIsOn(nextIsOn);
    onChange(nextIsOn);
  }

  function handleClick() {
    updateToggle(!isOn);
  }
}
```

> React batches updates from different components together. By calling both
> `setIsOn` and `onChange` in the same event handler, there's only one render
> pass instead of two.

The batching point matters and is easy to misread. Both updates land in **one**
render because they happen in the same event
([Phase 3 · 04](../../phase-3-state/04-automatic-batching.md)). Split across a
render boundary by an effect, they cannot be batched — no amount of batching
merges updates that happen in different commits.

Note also that the effect version passes `onChange` as a dependency, so a parent
that defines it inline re-runs the effect every render. The handler version has
no dependency array to get wrong.

### The better fix: lift the state up

react.dev offers a second answer and prefers it:

```jsx
// ✅ Also good: the component is fully controlled by its parent
function Toggle({ isOn, onChange }) {
  function handleClick() {
    onChange(!isOn);
  }
}
```

> Lifting state up lets the parent fully control the component, reducing overall
> state complexity.

There is now **one** `isOn` in the application instead of two that must be kept
in agreement. The synchronisation problem is not solved — it is deleted. Which is
the general shape of this chunk: *if two components need the same value, the
question is which one should own it, not how to copy it.*

## Case 10 — Passing data to the parent

The same mistake with the data flowing the wrong way:

```jsx
function Parent() {
  const [data, setData] = useState(null);
  return <Child onFetched={setData} />;
}

function Child({ onFetched }) {
  const data = useSomeAPI();
  // 🔴 Avoid: Passing data to the parent in an Effect
  useEffect(() => {
    if (data) {
      onFetched(data);
    }
  }, [onFetched, data]);
}
```

> When you see something wrong on the screen, you can trace where the information
> comes from by going up the component chain.

That is the actual cost, and it is a debugging cost rather than a performance
one. React's data flow is one-directional by design: to find where a value came
from you walk *up* the tree. A child that pushes data upward breaks the property
that makes that walk work — the parent's state now originates somewhere below it,
and nothing in the parent says so.

```jsx
function Parent() {
  const data = useSomeAPI();
  // ✅ Good: Passing data down to the child
  return <Child data={data} />;
}

function Child({ data }) {
  // ...
}
```

Fetch in the parent, pass down. The effect, the `onFetched` prop, the `if (data)`
guard and the extra render all disappear together — which is the usual sign that
the diagnosis was right.

## Case 11 — Subscribing to an external store

This one is different in kind: the effect is not *wrong*, it is **not ideal**,
and React ships a purpose-built hook instead.

```jsx
function useOnlineStatus() {
  // Not ideal: Manual store subscription in an Effect
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function updateState() {
      setIsOnline(navigator.onLine);
    }
    updateState();
    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);
    return () => {
      window.removeEventListener('online', updateState);
      window.removeEventListener('offline', updateState);
    };
  }, []);
  return isOnline;
}
```

Note that this effect is *correct* — the cleanup is symmetrical, the dependency
array is honest. It still copies external mutable data into React state, and that
copy is what goes wrong under concurrent rendering.

```jsx
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function useOnlineStatus() {
  // ✅ Good: Subscribing to an external store with a built-in Hook
  return useSyncExternalStore(
    subscribe,               // React won't resubscribe for as long as you pass the same function
    () => navigator.onLine,  // How to get the value on the client
    () => true               // How to get the value on the server
  );
}
```

> `useSyncExternalStore` is purpose-built for this use case and less error-prone
> than manually syncing mutable data to React state with an Effect.

Three things the effect version cannot offer: React reads the value at the moment
it needs it rather than from a stale copy, the third argument gives a **server
snapshot** so the hook works during SSR, and `subscribe` being defined outside
the component is what stops React resubscribing. The tearing problem this
prevents is [topic 16](../16-external-store.md); the hook itself is Phase 5.

**`subscribe` must be declared outside the component** — defined inline it is a
new function every render, and React resubscribes each time.

## Gotchas

**Symptom:** one click produces two render passes across parent and child.
**Cause:** the child sets its own state and notifies the parent from an effect,
so the two updates land in different commits and cannot be batched.
**Fix:** call both in the same handler, or lift the state to the parent.

**Symptom:** an effect that calls a callback prop re-runs on every parent render.
**Cause:** the callback is in the dependency array and the parent defines it
inline, so it is a new reference each time.
**Fix:** the handler version has no dependency array. If the effect is genuinely
needed, the callback is a candidate for `useEffectEvent`
([10](../10-useeffectevent.md)).

**Symptom:** the same value exists in two components and they drift apart.
**Cause:** it was copied rather than owned. Any copy needs synchronising, and
synchronisation is what fails.
**Fix:** decide which component owns it and pass it down. One source of truth
cannot disagree with itself.

**Symptom:** you cannot tell where a parent's state came from by reading the
parent.
**Cause:** a child is pushing data upward through a callback in an effect.
**Fix:** move the data source to the parent and pass it down, restoring the
one-directional flow that makes the tree traceable.

**Symptom:** an external value read through `useState` plus an effect shows a
stale value, or differs between two components in the same render.
**Cause:** the effect keeps a *copy* of mutable external data, and the copy can
be out of date when React renders.
**Fix:** `useSyncExternalStore`, which reads the value when React needs it.

**Symptom:** `useSyncExternalStore` resubscribes constantly.
**Cause:** `subscribe` is defined inside the component, so it is a new function
every render.
**Fix:** hoist it to module scope, as react.dev's example does.

## Interview questions

**★ A child notifies its parent of a state change from an effect. What is wrong
with that?**
It runs too late. The child sets state, React renders the child, the effect
fires, the parent sets state, React renders again — two passes for one click.
Calling both the child's setter and the parent's callback in the same event
handler lets React batch them into one render. Better still, lift the state to
the parent so there is only one copy to keep in agreement.

**★ Why is passing data from a child to a parent through an effect a problem?**
It breaks the one-directional data flow that makes React debuggable. Normally you
trace a wrong value by walking up the tree; when a child pushes data upward, the
parent's state originates below it and nothing in the parent reveals that. Fetch
the data in the parent and pass it down — the effect, the callback prop, the
guard and the extra render all disappear.

**★ When is `useSyncExternalStore` better than an effect that subscribes?**
Whenever the source is external mutable data. A correct subscribing effect still
keeps a *copy* in React state, and that copy can be stale or inconsistent when
React renders — the tearing problem. `useSyncExternalStore` reads the value when
React needs it, takes a server snapshot as its third argument so it works under
SSR, and will not resubscribe as long as `subscribe` keeps the same identity.

**Why can't React batch the child's update and the parent's notification when an
effect is involved?**
Because batching merges updates that occur within the same event; it cannot merge
updates that occur in different commits. The effect runs after the child has
already rendered, so the parent's update belongs to a later commit by
construction. Doing both in one handler puts them in the same event, and one
render results.

**Two components need the same value. What is the question to ask?**
Which one should own it — not how to keep the two copies in sync. Every
synchronisation mechanism is a thing that can fail; lifting the state up removes
the second copy so there is nothing left to disagree. react.dev's phrasing is
that it "reduces overall state complexity", and the effect goes away as a side
effect of that.

**Why must `subscribe` be declared outside the component?**
Because React compares its identity to decide whether to resubscribe. Declared
inline it is a new function on every render, so React tears down and rebuilds the
subscription every time. Module scope gives it a stable identity, which is what
the comment in react.dev's example is pointing at.

---

← Prev: [Chains of effects](02-chains-of-effects.md) · Index: [You might not need an effect](README.md)
