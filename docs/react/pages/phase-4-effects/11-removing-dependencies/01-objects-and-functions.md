---
title: "Objects and functions"
sidebar_label: "01 · Objects and functions"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies).
> No sandbox script backs this page; claims are cited, not measured.

**The single most common reason an effect re-runs constantly, and the one with
four distinct documented fixes depending on where the value comes from.**

## The cause, in one sentence

> In JavaScript, **objects and functions are considered different if they were
> created at different times.**

React compares dependencies with `Object.is`
([topic 02](../02-useeffect-anatomy.md)). An object literal in the component body
is a *new* object on every render, so the comparison fails every time, and the
effect re-synchronizes on every render — disconnecting and reconnecting,
resubscribing, refetching.

Nothing about the *contents* changed. Only the identity did. And the dependency
array is doing exactly what it was told.

react.dev's summary advice is worth taking literally:

> **Try to avoid object and function dependencies.** Move them outside the
> component or inside the Effect.

Which is the first two of the four moves.

## Move 1 — outside the component, when it is static

If the value involves no props and no state, it never needed to be inside the
component at all:

```jsx
const options = {
  serverUrl: 'https://localhost:1234',
  roomId: 'music'
};

function ChatRoom() {
  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, []); // ✅ All dependencies declared
}
```

At module scope the object is created once, so it is not reactive at all
([topic 09](../09-effect-lifecycle.md)) and the array is genuinely `[]` — not a
suppressed `[]`, a correct one. Note this is the same reasoning as the
module-level application initialisation in
[topic 04 · 03](../04-cleanup/03-when-cleanup-is-not-the-answer.md): things that
do not come from rendering do not belong in the render scope.

## Move 2 — inside the effect, when it is dynamic

If the value *is* built from reactive values, construct it where it is used:

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const options = {
      serverUrl: serverUrl,
      roomId: roomId
    };
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // ✅ All dependencies declared
}
```

The object is now created inside the setup, so it is not a value the effect
*reads from the render* — it is a value the effect *makes*. What remains in the
array is `roomId`, a string, which compares by value and only changes when the
room actually changes.

**This is the default answer.** Between moves 1 and 2 you can eliminate almost
every object dependency you own.

## Move 3 — read primitives from an object you do not own

Moves 1 and 2 assume you control where the object is created. When it arrives as
a prop, you do not:

```jsx
function ChatRoom({ options }) {
  const { roomId, serverUrl } = options;
  useEffect(() => {
    const connection = createConnection({
      roomId: roomId,
      serverUrl: serverUrl
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]); // ✅ All dependencies declared
}
```

The destructuring happens **during render**, outside the effect, so the effect
reads two strings rather than one object. A parent that rebuilds `options` every
render now causes no reconnection at all, as long as the values inside are the
same.

This is the move that solves the problem you cannot fix from your own component —
and it works without asking the parent to change anything.

## Move 4 — calculate primitives from a function prop

The same idea when the prop is a function returning the configuration:

```jsx
function ChatRoom({ getOptions }) {
  const { roomId, serverUrl } = getOptions();
  useEffect(() => {
    const connection = createConnection({
      roomId: roomId,
      serverUrl: serverUrl
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]); // ✅ All dependencies declared
}
```

⚠️ **This only works for pure functions.** `getOptions()` is being called during
render, so it must be safe to call during render — no side effects, no request,
nothing that mutates. If the function is impure, calling it in the render body is
a purity violation
([Phase 2 · Purity](../../phase-2-components/02-purity/01-the-two-rules.md)) and
the fix is the wrong one. For an impure function prop, the answer is
[`useEffectEvent`](../10-useeffectevent.md) instead.

## Choosing between the four

| The value is… | Move |
|---|---|
| static, yours | outside the component |
| built from props/state, yours | inside the effect |
| an object prop | destructure to primitives during render |
| a **pure** function prop | call during render, depend on its primitives |
| an **impure** function prop | not here — `useEffectEvent` ([02](02-restructuring-the-effect.md)) |

The common thread: **get a primitive into the dependency array.** Strings and
numbers compare by value, so they change when the meaning changes rather than
when the render count changes.

## Gotchas

**Symptom:** a connection tears down and rebuilds on literally every render.
**Cause:** an object or function literal in the dependency array — a new identity
each render, so `Object.is` always fails.
**Fix:** move it outside the component if static, inside the effect if dynamic.

**Symptom:** a child's effect re-runs constantly and the child's own code looks
fine.
**Cause:** the parent rebuilds an object prop every render.
**Fix:** destructure to primitives during render in the child. It needs no
cooperation from the parent.

**Symptom:** destructuring inside the effect did not help.
**Cause:** it has to happen **during render**, outside the effect. Destructuring
inside the setup still leaves the object itself as the thing the effect reads
from the render.
**Fix:** move the destructuring above the `useEffect` call.

**Symptom:** calling a function prop during render caused a request to fire on
every render.
**Cause:** the function is impure, and move 4 requires purity.
**Fix:** wrap it in an Effect Event instead
([02](02-restructuring-the-effect.md)).

**Symptom:** the array became `[]` and the effect now uses stale values.
**Cause:** the object was moved to module scope even though it was built from
props or state — so the values froze at whatever they were.
**Fix:** move 1 is for genuinely static values only. If props are involved, it is
move 2.

**Symptom:** `useMemo` was added to stabilise the object and the effect still
re-runs.
**Cause:** usually a dependency of the `useMemo` that is itself unstable, pushing
the problem up one level.
**Fix:** prefer restructuring over memoizing here — react.dev's advice is to avoid
object dependencies rather than to stabilise them. Memoization is Phase 6's
subject and a different trade-off.

## Interview questions

**★ Why does an object in a dependency array make the effect re-run every
render?**
Because objects and functions created at different times are different values,
and React compares dependencies with `Object.is`. An object literal in the
component body is a new object on every render, so the comparison always fails
even when nothing inside it changed. The array is behaving correctly; the problem
is that an identity was used where a value was meant.

**★ What are the four ways to stop depending on an object?**
Move it outside the component if it is static, so it is created once and is not
reactive. Move it inside the effect if it is built from props or state, so the
effect makes it rather than reads it. If it arrives as a prop, destructure it to
primitives during render and depend on those. If a function prop returns it, call
that function during render — provided it is pure — and depend on the primitives
it returns.

**★ A parent rebuilds an object prop every render and you cannot change the
parent. What do you do?**
Destructure it to primitives during render in the child, and put those in the
dependency array. Strings and numbers compare by value, so the effect only
re-runs when a value actually differs. This is the move that works without any
cooperation from the parent, which is why it exists separately from "move it
inside the effect".

**Why must the destructuring happen during render rather than inside the effect?**
Because the dependency array is computed from what the effect reads *from the
render*. Destructuring inside the setup means the effect still closes over the
object itself, so the object remains the dependency. Pulling the fields out above
the `useEffect` call is what makes the primitives the things being read.

**What is the constraint on calling a function prop during render?**
It must be pure. Move 4 calls `getOptions()` in the render body, so anything with
a side effect — a request, a mutation, logging that matters — would now run on
every render, which is a purity violation. For an impure function prop the
documented answer is an Effect Event, which reads the latest value without the
effect reacting to it.

**Why does react.dev prefer restructuring to memoizing here?**
Because the recap's advice is to *avoid* object and function dependencies rather
than to stabilise them — move them outside the component or inside the effect.
Memoizing keeps the dependency and adds a mechanism that can itself be defeated by
one unstable input, pushing the problem up a level. Restructuring removes the
dependency instead of managing it.

---

Index: [Removing dependencies](README.md) · Next → [Restructuring the effect](02-restructuring-the-effect.md)
