---
title: "Automatic batching"
sidebar_label: "04 · Automatic batching"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates),
> [`useState`](https://react.dev/reference/react/useState) caveats,
> [React v18.0](https://react.dev/blog/2022/03/29/react-v18) §*Automatic
> batching* and [`flushSync`](https://react.dev/reference/react-dom/flushSync).
> No sandbox script backs this page; claims are cited, not measured.

**React waits until your handler has finished before rendering anything. Since
React 18 it does that everywhere, not just in React event handlers — which
removed a whole class of double-render bugs and created one new confusion.**

## What batching is

react.dev:

> React waits until *all* code in the event handlers has run before processing
> your state updates. This is why the re-render only happens *after* all these
> `setNumber()` calls.

And the reason, from the `useState` caveats:

> React **batches state updates.** It updates the screen **after all the event
> handlers have run** and have called their `set` functions. This prevents
> multiple re-renders during a single event.

The docs' analogy is a good one to keep:

> A waiter doesn't run to the kitchen at the mention of your first dish! Instead,
> they let you finish your order, let you make changes to it, and even take
> orders from other people at the table.

So:

```jsx
function onClick() {
  setName('Ada');
  setAge(36);
  setCity('London');
}                       // ← ONE render, after this line
```

Three updates, one render, one commit, one paint. Without batching you would get
three renders and — worse — two intermediate states on screen where the name has
changed but the age has not. Batching is not only a performance feature; it is
what prevents **"half-finished" renders**, which is how the docs describe it.

## What React 18 changed

Before 18, batching applied only inside React event handlers. Everywhere else,
each `setState` rendered immediately. The React 18 post is explicit about which
cases were not batched:

> Updates inside the following contexts were **not batched by default in previous
> versions**: Promises, `setTimeout`, native event handlers, any other event
> outside React event handlers.

with the example:

```js
// Before: only React events were batched.
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // React will render twice, once for each state update (no batching)
}, 1000);

// After: updates inside of timeouts, promises,
// native event handlers or any other event are batched.
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // React will only re-render once at the end (that's batching!)
}, 1000);
```

**This is why "automatic" is in the name.** It is not a new capability; it is the
existing capability no longer being conditional on where the update came from.

Two consequences worth carrying:

- **An `await` is a boundary.** Updates before an `await` batch together, and
  updates after it batch together, but the two groups are separate — they are in
  different tasks. This surprises people who read "everything is batched" as
  "everything in this function is one render".
- **Old advice is now wrong.** `unstable_batchedUpdates`, and the folklore about
  wrapping async updates to avoid double renders, are obsolete. If you meet them
  in a codebase, they are pre-18 residue.

## Batching and the snapshot are different things

These get conflated constantly, and separating them makes both easy.

| | Batching | Snapshot |
|---|---|---|
| What it is | Several updates → one render | State is fixed within a render |
| Explains | Why you get one render, not three | Why `count` is still the old value |
| If it did not exist | Three renders, flickering intermediate UI | Nothing — the snapshot is closure behaviour |

The three-increments puzzle is a **snapshot** problem, not a batching problem:

```jsx
setCount(count + 1);
setCount(count + 1);
setCount(count + 1);      // → 1
```

Turning batching off would not fix it. All three calls read `count` as `0`
because the variable in that closure is `0`
([topic 02](02-state-is-a-snapshot.md)). The fix is the updater form
([topic 03](03-updater-functions.md)), which works *with* batching: three
updaters queue and compose to 3, still in one render.

**Batching decides how many renders. Updaters decide what the value ends up
being.**

## `flushSync` — the deliberate escape

When you genuinely need the DOM updated before the next line runs:

```jsx
import {flushSync} from 'react-dom';

flushSync(() => {
  setItems([...items, newItem]);
});
listRef.current.scrollTop = listRef.current.scrollHeight;   // the row exists now
```

> Call `flushSync` to force React to flush any pending work and update the DOM
> synchronously.
>
> This ensures that, by the time the next line of code runs, React has already
> updated the DOM.

The documentation is unusually insistent about the cost, saying it three
different ways:

> Using `flushSync` is uncommon and can hurt the performance of your app.

> `flushSync` can significantly hurt performance. Use sparingly.

> Most of the time, `flushSync` can be avoided, so use `flushSync` as a last
> resort.

And the caveats are not only about speed:

- It **may force pending Suspense boundaries to show their `fallback` state** —
  so an unrelated part of the screen can flash a spinner because you scrolled a
  list.
- It **may run pending Effects** and synchronously apply any updates they
  contain before returning.
- It **may flush updates outside the callback** when that is necessary to flush
  the ones inside it.

That third one is the trap: `flushSync` is not a scalpel. Wrapping one setter
can synchronously commit unrelated pending work.

**Legitimate uses are narrow**: measuring or scrolling to something that must
already be in the DOM, printing, and integrating with a non-React API that reads
the DOM immediately. If the goal is "run something after the update", an effect
is the right tool and costs nothing.

## Gotchas

**Symptom:** an intermediate UI state flashes on screen.
**Cause:** something is breaking the batch — usually a `flushSync`, or an
`await` between the two updates putting them in different tasks.
**Fix:** move the updates together, before the `await`, or compute both values
first.

**Symptom:** three increments still produce one.
**Cause:** the snapshot, not batching.
**Fix:** updater functions. Turning off batching would not help and there is no
way to turn it off.

**Symptom:** reading the DOM right after `setState` shows the old DOM.
**Cause:** the update has not been committed — the render happens after the
handler returns.
**Fix:** an effect, or `flushSync` if it truly must be synchronous.

**Symptom:** a Suspense fallback flashes when an unrelated action runs.
**Cause:** a `flushSync` forcing pending boundaries to their fallback state —
a documented caveat.
**Fix:** remove the `flushSync`. This is the strongest practical argument
against reaching for it.

**Symptom:** upgrading to React 18 or later changed how many times something
ran.
**Cause:** updates in timeouts, promises and native handlers now batch where
they previously did not.
**Fix:** usually nothing — it is fewer renders. Code that *relied* on a render
between two updates was relying on an accident.

**Symptom:** `unstable_batchedUpdates` in the codebase.
**Cause:** pre-18 residue.
**Fix:** delete it. Automatic batching covers it.

## Interview questions

**★ What is automatic batching and what changed in React 18?**
Batching is React grouping several state updates into a single re-render. Before
18 it applied only inside React event handlers, so updates in promises,
`setTimeout`, native event handlers and anything else rendered immediately, once
each. React 18 made it apply everywhere — hence "automatic". Beyond performance,
it is what prevents half-finished renders where one value has updated and
another has not.

**★ Is batching the reason three `setCount(count + 1)` calls only increment
once?**
No — that is the snapshot. All three calls read `count` as the same value from
the same closure, so all three request the same result. Batching only decides
that you get one render instead of three. The fix is the updater form, which
composes correctly and still produces a single render.

**★ When would you use `flushSync`, and what does it cost?**
When you must read or manipulate the DOM immediately after an update — measuring
a newly added row, scrolling to it, printing. The docs call it uncommon and a
last resort three separate times. It can significantly hurt performance, may
force pending Suspense boundaries to show their fallbacks, may run pending
effects, and may flush updates from outside the callback too.

**Does an `await` break a batch?**
Yes, in the sense that updates before and after it are in different tasks and
therefore batch separately. Everything before the `await` renders together, then
everything after renders together. "Automatic batching" does not mean one render
per function.

**Can you opt out of batching?**
Only per-callback, with `flushSync`. There is no global switch, and
`unstable_batchedUpdates` — which used to opt *in* — is obsolete since React 18.

**Why is batching a correctness feature and not just a performance one?**
Because without it, each update renders on its own, so the user can see a frame
where one piece of state has changed and a related piece has not. The
documentation calls these "half-finished" renders. Batching guarantees that a
group of updates from one event reaches the screen together.

---

← Prev: [Updater functions](03-updater-functions.md) · Index: [Phase 3](README.md) · Next → [Immutable updates](05-immutable-updates/README.md)
