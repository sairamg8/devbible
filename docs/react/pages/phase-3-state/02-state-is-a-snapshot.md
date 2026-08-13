---
title: "State is a snapshot"
sidebar_label: "02 · State is a snapshot"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [State as a Snapshot](https://react.dev/learn/state-as-a-snapshot) and
> [`useState`](https://react.dev/reference/react/useState) caveats. No sandbox
> script backs this page; claims are cited, not measured.

**The single most useful sentence in React: "Setting state only changes it for
the next render." Every stale-value confusion — the log that prints the old
number, the timeout that uses a value from three clicks ago, the handler that
sees yesterday's props — is this one fact, and it is not a bug.**

## The claim

react.dev states it directly:

> **State behaves more like a snapshot. Setting it does not change the state
> variable you already have, but instead triggers a re-render.**

> When React calls your component, it gives you a snapshot of the state for that
> particular render. Your component returns a snapshot of the UI with a fresh set
> of props and event handlers, all calculated **using the state values from that
> render**.

So within one render, `count` is a `const`. Not conceptually — literally. It was
destructured at the top of the function and nothing in that function can change
it. Calling `setCount` does not reach back and rewrite a value that has already
been read.

## The demonstration

```jsx
<button onClick={() => {
  setNumber(number + 5);
  alert(number);            // 0
}}>+5</button>
```

The alert shows `0`. Not because the update failed — the screen will show `5` —
but because `number` in *this* handler is the value from the render that created
the handler. The docs' next example makes it unmissable:

```jsx
<button onClick={() => {
  setNumber(number + 5);
  setTimeout(() => {
    alert(number);          // still 0, three seconds later
  }, 3000);
}}>+5</button>
```

Three seconds later, with `5` plainly on screen, the alert says `0`. react.dev:

> Even though React may have updated the state by the time the alert runs, the
> state value captured in the event handler remains fixed at the time the user
> interacted with it.

**The timeout is not stale in the sense of "wrong". It is correct — it is
faithfully reporting the state as it was when the user clicked.**

## Why: every render is a separate call

This is where the mental model clicks, and it is worth being explicit rather
than metaphorical.

Each render is a **new invocation of your function**. Each invocation creates:

- new local `const`s, holding that render's state values,
- new closures for every function defined inside — every handler, every callback,
  every effect body,
- and each of those closes over *that invocation's* variables.

```jsx
// render with count = 0                 // render with count = 1
function Counter() {                     function Counter() {
  const count = 0;                         const count = 1;
  const onClick = () => alert(count);      const onClick = () => alert(count);
  …                                        …
}                                        }
```

Two different `onClick` functions, each closing over a different `count`. The one
attached to the DOM at the moment of the click is the one that runs. There is no
shared mutable `count` for anything to be stale *about*.

react.dev's recap says the same thing in five bullets:

> - Setting state requests a new render.
> - React stores state outside of your component, as if on a shelf.
> - When you call `useState`, React gives you a snapshot of the state *for that
>   render*.
> - Variables and event handlers don't "survive" re-renders. Every render has its
>   own event handlers.
> - Every render (and functions inside it) will always "see" the snapshot of the
>   state that React gave to *that* render.

**This is ordinary JavaScript closure behaviour.** Nothing React-specific is
happening. What is React-specific is only that React calls your function again
and swaps which closure is attached to the DOM.

## The mental substitution

The docs offer a technique worth adopting as a habit:

> You can mentally substitute state in event handlers, similarly to how you think
> about the rendered JSX.

When reading a handler, replace every state variable with its literal value for
that render. The three-clicks puzzle becomes trivial:

```jsx
// render where number = 0
onClick={() => {
  setNumber(0 + 1);      // substitute
  setNumber(0 + 1);
  setNumber(0 + 1);
}}
```

Three requests to set the state to `1`. The result is `1`, not `3`, and no
further explanation is needed. Fixing it means not depending on the snapshot —
[updater functions](03-updater-functions.md).

## Where it bites in real code

**A `setTimeout` or `setInterval` reading state.** The callback closes over the
render in which it was created. An interval created once in a mount effect will
read the initial state forever.

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);   // 🔴 always 0 + 1
  return () => clearInterval(id);
}, []);
```

The fix is the updater form, which does not read the snapshot at all:

```jsx
const id = setInterval(() => setCount(c => c + 1), 1000);    // ✅
```

**An async function after `await`.** The values it uses are from before the
await, however long the request took:

```jsx
async function onSubmit() {
  await save(draft);
  console.log(draft);      // the draft as it was when submit was clicked
}
```

Usually this is what you want — you saved *that* draft. When it is not, read the
current value from a ref, or re-derive it.

**A stale value inside an effect with a wrong dependency array.** Omitting a
dependency freezes it at whatever it was when the effect last ran. Phase 4.

**An event handler passed to a memoized child.** The child holds the handler
from the render it last accepted, which closes over that render's state. This is
the mechanism behind most "why is my callback stale" questions, and why
`useCallback`'s dependency array exists.

## When you genuinely need the latest value

Four options, roughly in order of preference:

| Need | Use |
|---|---|
| Compute the next state from the previous | An **updater function** — `setX(x => …)` |
| Use the value later in the same handler | A **local `const`** you computed before calling the setter |
| Read a mutable "latest" from an async callback | A **ref** you keep updated |
| Read the DOM immediately after an update | **`flushSync`** — rare, and a last resort |

The first covers the large majority. The second is underused and worth naming:

```jsx
function onClick() {
  const next = count + 1;
  setCount(next);
  analytics.track('count', next);   // ✅ no staleness — it is a plain variable
}
```

There is no need to read state back after setting it if you already have the
value you set.

## Gotchas

**Symptom:** logging state immediately after `setState` prints the old value.
**Cause:** the setter only affects the next render — the docs list this as a
caveat outright.
**Fix:** log the value you passed. Nothing needs to change.

**Symptom:** an interval counts to 1 and stops.
**Cause:** the callback closes over the first render's state, so it sets the
same value forever — and setting the same value is a bail-out
([topic 11](11-bailing-out.md)).
**Fix:** the updater form.

**Symptom:** three `setCount(count + 1)` calls increment by one.
**Cause:** all three read the same snapshot.
**Fix:** the updater form. [Topic 03](03-updater-functions.md).

**Symptom:** an async handler uses data from before the `await`.
**Cause:** correct closure behaviour — that is the state as it was when the
action started.
**Fix:** usually nothing. If you genuinely need the newest, use a ref.

**Symptom:** adding the state variable to a `useEffect` dependency array makes it
run constantly.
**Cause:** the effect sets the state it depends on — an
[infinite loop](17-infinite-render-loops.md), not a snapshot problem.
**Fix:** the updater form removes the dependency entirely.

## Interview questions

**★ What does "state is a snapshot" mean?**
That the state value inside a given render is fixed for that render. Setting
state does not modify the variable you already have — it requests a new render
which will get a new snapshot. react.dev's phrasing is "setting state only
changes it for the next render", and it is why reading state immediately after
setting it gives the old value.

**★ Why does `alert(number)` inside a `setTimeout` show the old value three
seconds later, when the screen already shows the new one?**
Because the callback closed over the variables of the render in which it was
created, and those are `const`s local to that invocation. It is faithfully
reporting the state as it was when the user clicked. This is ordinary JavaScript
closure behaviour — the only React-specific part is that React ran the function
again and attached a different closure to the DOM.

**★ Why do three `setCount(count + 1)` calls in one handler increment by one?**
All three read the same snapshot, so all three are `setCount(0 + 1)` — three
requests to set the value to 1. The updater form `setCount(c => c + 1)` does not
read the snapshot; each updater receives the result of the previous one in the
queue, so three of them give 3.

**How do you get the newest value inside an async callback?**
Prefer not to need it: use an updater function if you are computing the next
state, or keep the value in a local variable you already have. When you truly
need a mutable "latest", keep it in a ref and update the ref — a ref is not
snapshotted, which is exactly the property that makes it unsuitable for
rendering and suitable for this.

**Is a stale closure a bug?**
Usually not — it is the value as of when the action began, which is often
precisely correct for things like "save the draft the user submitted". It
becomes a bug only when the code needs the current value and reads a captured
one instead. Naming that distinction is most of debugging it.

**Why does the updater form fix the interval case?**
Because it never reads the render's snapshot. `setCount(c => c + 1)` asks React
to apply a transformation to whatever the value is when the update is processed,
so the callback does not need to close over the current count — which also means
the effect no longer needs `count` as a dependency and can stay mounted.

---

← Prev: [`useState`](01-usestate.md) · Index: [Phase 3](README.md) · Next → [Updater functions](03-updater-functions.md)
