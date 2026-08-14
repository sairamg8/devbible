---
title: "flushSync"
sidebar_label: "12 · flushSync"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`flushSync`](https://react.dev/reference/react-dom/flushSync) (description, parameters,
> returns, all four caveats, the Pitfall callout and the third-party integration usage).
> No sandbox script backs this page; claims are cited, not measured.

**`flushSync` is the escape hatch from React's scheduling.** It takes a callback, runs it
immediately, and forces every update inside it to be applied to the DOM before the call
returns:

> `flushSync` lets you force React to flush any updates inside the provided callback
> synchronously. This ensures that the DOM is updated immediately.

```js
flushSync(() => {
  setSomething(123);
});
// By this line, the DOM is updated.
```

That comment is React's own, and it is the entire value proposition: **by the next statement,
the DOM is real.** Everything else on this page is about what that costs.

It returns `undefined`.

## What problem it solves

React batches. Several `setState` calls in one event handler produce one render, and that render
is committed when React chooses — usually microseconds later, but not synchronously inside your
handler. Concurrent features widen the gap further, because React is explicitly allowed to work
on an update in pieces.

That is right almost always, and wrong in one situation, which the reference states directly:

> When integrating with third-party code such as browser APIs or UI libraries, it may be
> necessary to force React to flush updates.

and, more precisely:

> Some browser APIs expect results inside of callbacks to be written to the DOM synchronously,
> by the end of the callback, so the browser can do something with the rendered DOM. In most
> cases, React handles this for you automatically. But in some cases it may be necessary to
> force a synchronous update.

🔴 **The shape of the legitimate case is always the same:** something outside React is going to
look at the DOM the moment your callback returns, and it will not wait for a render. If nothing
outside React is reading the DOM at that instant, you do not need `flushSync`.

React is unusually blunt about the corollary:

> If your app only uses React APIs, and does not integrate with third-party libraries,
> `flushSync` should be unnecessary.

## The four caveats, and why each one bites

These are the whole reference, and they are worth reading as one argument: **you asked React to
stop scheduling, so all of React's scheduling guarantees are off.**

### 1. It costs performance

> `flushSync` can significantly hurt performance. Use sparingly.

A synchronous flush is a render and a commit on the spot, blocking whatever was going to happen
next — including work React had planned to do more cheaply, later, or in pieces. Called once per
integration point, that is fine. Called on every keystroke or every scroll event, you have
turned off the scheduler for the life of the interaction.

### 2. 🔴 It can show your Suspense fallbacks

> `flushSync` may force pending Suspense boundaries to show their `fallback` state.

**This is the caveat that produces bug reports.** The normal behaviour of an update that
suspends is that React keeps the current UI on screen while the new content loads
([Phase 8 · Suspense](../phase-8-concurrent-suspense/02-suspense/README.md)). A synchronous flush
cannot wait for anything — so a boundary that would have stayed put visibly collapses to its
fallback and comes back.

The parameter documentation says the same from the other side: *"If an update suspends as a
result of this `flushSync` call, the fallbacks may be re-shown."*

⚠️ **It is not deterministic from where you are standing.** Whether it happens depends on
whether anything in the flushed tree suspends, which can change with cache state, a new data
dependency, or a component someone else edits. A `flushSync` that is safe today is not
guaranteed safe next month.

### 3. It can run pending Effects

> `flushSync` may run pending Effects and synchronously apply any updates they contain before
> returning.

So the callback you passed is not the only code that runs. Effects queued from earlier updates
may execute inside your `flushSync` call, and **their** state updates may be applied too. If one
of those effects assumed it would run after the browser had painted, that assumption is now
wrong.

### 4. It can flush work you did not ask about

> `flushSync` may flush updates outside the callback when necessary to flush the updates inside
> the callback. For example, if there are pending updates from a click, React may flush those
> before flushing the updates inside the callback.

React cannot apply your update on top of a queue it has not processed, so it processes the
queue. **The unit of the flush is "everything pending", not "my callback".**

Caveats 3 and 4 together are why `flushSync` is hard to reason about locally: the call site
tells you what you asked for, and nothing about what else went out with it.

## The Pitfall, quoted in full

React puts a Pitfall callout on this page — a rare thing in the reference — and it says:

> Using `flushSync` is uncommon and can hurt the performance of your app.
>
> `flushSync` can significantly hurt performance, and may unexpectedly force pending Suspense
> boundaries to show their fallback state. Most of the time, `flushSync` can be avoided, so use
> `flushSync` as a last resort.

**"Last resort" is the documented status of this API.** Treat a `flushSync` in a code review as
a claim that needs its justification written next to it: *which* thing outside React is about to
read the DOM, and *why* it cannot wait.

## When it is actually the right tool

The reference gives one category — third-party integration — and describes it as *"browser APIs
or UI libraries"* where results *"inside of callbacks"* must be *"written to the DOM
synchronously, by the end of the callback"*.

Reading that shape rather than a list of names is the useful skill, because the test is
mechanical:

1. **Is something outside React going to read the DOM immediately?** A browser API invoked at
   the end of your callback, a measurement a non-React library takes, an imperative widget you
   are handing an updated node to.
2. **Can it wait a tick?** If a `useEffect`, a `useLayoutEffect`, or simply the next render would
   do, use those — they are cheaper and they keep the scheduler intact.
3. **Is the update in the flush free of anything that might suspend?** If not, expect caveat 2.

⬜ **This page does not enumerate the browser APIs that need it.** The reference does not, and
listing names from memory is exactly the kind of confident invention that ages badly. What it
does say is the criterion, and the criterion is checkable in your own code.

### What to reach for instead

| You want | Use |
|---|---|
| to read layout after a change, before paint | `useLayoutEffect` |
| to react to a committed change | `useEffect` |
| to keep the old UI while new data loads | a transition — the opposite of a sync flush |
| to hand an updated DOM node to a non-React API *right now* | `flushSync`, with a comment saying why |

## Where this sits in a server-rendering phase

Nowhere on the server — and that is the point of including it here. `flushSync` is a client-only
tool about **when the DOM is updated**, and the DOM only exists after
[`hydrateRoot`](04-hydrateroot.md) has taken over. It appears in this phase as the last of the
`react-dom` client APIs, next to the metadata and preloading functions that are also about the
document rather than about your components.

The connection worth drawing: [topic 07 · Selective hydration](07-selective-hydration.md) and
Suspense both exist because React decides *when* to do work. `flushSync` is the one API that
takes that decision back, and caveat 2 is the bill for it.

## Gotchas

**Symptom:** a Suspense boundary flashes its fallback after adding `flushSync`.
**Cause:** documented — *"`flushSync` may force pending Suspense boundaries to show their
`fallback` state"*, because a synchronous flush cannot wait for the update to resolve.
**Fix:** move the update out of the flush, or drop `flushSync`.

**Symptom:** an effect ran earlier than expected, in the middle of a `flushSync` call.
**Cause:** *"`flushSync` may run pending Effects and synchronously apply any updates they
contain before returning."*
**Fix:** do not rely on effect timing around a flush; treat everything pending as in scope.

**Symptom:** an unrelated pending update was applied at the same time.
**Cause:** *"`flushSync` may flush updates outside the callback when necessary to flush the
updates inside the callback."* React processes the queue to get to yours.
**Fix:** none needed — expect it. The flush is not scoped to your callback.

**Symptom:** the app got slower after `flushSync` was added to a frequent handler.
**Cause:** every call is a full synchronous render and commit. *"Use sparingly."*
**Fix:** call it once at the integration point, not per event.

**Symptom:** `flushSync` inside a render or an effect misbehaves.
**Cause:** it forces a flush of pending work, which is not a thing to do while React is already
rendering. The documented use is integration code — event handlers and callbacks from outside
React.
**Fix:** call it from the boundary between React and the other system.

**Symptom:** someone reaches for `flushSync` to "make state update immediately" in a handler.
**Cause:** the mental model that `setState` should be synchronous. The DOM being updated is not
the same as the state variable changing in the current closure.
**Fix:** it does not do that. `flushSync` flushes to the **DOM**; your local `const` is still the
value from this render.

## Interview questions

**★ What does `flushSync` actually guarantee?**
That by the time the call returns, React has flushed the updates inside the callback to the DOM.
It returns `undefined` and guarantees nothing about your local variables — the state you read in
the current closure is still this render's value.

**★ Why does React call it a last resort?**
Because it can significantly hurt performance and *"may unexpectedly force pending Suspense
boundaries to show their fallback state"*. It replaces scheduling — the thing that makes
concurrent React work — with a blocking render.

**★ What is the legitimate use case?**
Integration with code outside React that reads the DOM the moment a callback returns — a browser
API or a UI library expecting results *"written to the DOM synchronously, by the end of the
callback"*. If your app only uses React APIs, the reference says it should be unnecessary.

**★ Why can a `flushSync` cause a fallback to appear when the same update outside one does not?**
Because a normal update that suspends lets React keep the existing UI while the new content
loads. A synchronous flush has no room to wait, so a boundary that would have held its content
falls back instead.

**★ Does `flushSync` only flush what is in the callback?**
No. It may flush pending updates from outside the callback when it needs to in order to get to
yours — a pending click update, for example — and it may run pending effects and apply their
updates too.

**★ You see `flushSync` in a code review. What do you ask?**
Which thing outside React reads the DOM immediately after this callback, and why a
`useLayoutEffect` or the next render is not enough. Then whether anything in the flushed subtree
can suspend, because that is the caveat most likely to surface later as a flicker.

---

← Index: [Phase 11](README.md) ·
Prev: [Resource preloading](11-resource-preloading/README.md) ·
Next → [Root error options (19)](13-root-error-options/README.md)
