---
title: "Marking an update as non-urgent"
sidebar_label: "01 · Marking an update non-urgent"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useTransition`](https://react.dev/reference/react/useTransition) and
> [`startTransition`](https://react.dev/reference/react/startTransition)
> (definition, parameters, returns and the full Caveats lists).
> No sandbox script backs this page; claims are cited, not measured.

**A transition is a state update you have told React it may take its time over, throw
away, and restart. It is not a delay, not a debounce, and not a scheduling hint — it
changes what React is allowed to do with the render, which is why an interface built on
it stays responsive under work that would otherwise freeze it.**

## The API, both halves

> `useTransition` is a React Hook that lets you **render a part of the UI in the
> background**.

```js
const [isPending, startTransition] = useTransition()
```

> `useTransition` returns an array with exactly two items:
>
> 1. The **`isPending`** flag that tells you whether there is a pending Transition.
> 2. The **`startTransition`** function that lets you mark updates as a Transition.

And the standalone form:

> `startTransition` lets you render a part of the UI in the background by marking a
> state update as a Transition.

> `startTransition` is very similar to `useTransition`, except that it **does not
> provide the `isPending` flag** … `startTransition` **works outside components, such as
> from a data library, since it is not a Hook.**

That is the entire difference, and it is worth fixing early: **same mechanism, one
without a pending flag and without the Rules of Hooks attached.** A router or a data
library marks its own updates as transitions with the standalone form because it has no
component to call a hook from.

## What `startTransition(action)` actually does

The parameter description is dense and every clause earns its place:

> `action`: A function that updates some state by calling one or more `set` functions.
> **React calls `action` immediately with no parameters** and **marks all state updates
> scheduled synchronously during the `action` function call as Transitions.** Any async
> calls that are awaited in the `action` will be included in the Transition, but
> currently require wrapping any `set` functions after the `await` in an additional
> `startTransition`. State updates marked as Transitions will be **non-blocking** and
> **will not display unwanted loading indicators.**

Four separate facts:

1. **The action runs immediately and synchronously.** `startTransition` is not a
   scheduler you hand work to — it opens a window, calls your function, and marks
   whatever state updates happen inside that window.
2. **The marking is by *when*, not by *what*.** Any `set` call that happens
   synchronously inside the action becomes a transition, regardless of which state it
   touches or which component owns it.
3. **`await` inside the action needs a second `startTransition` after it.** Documented as
   a current limitation, not a design (topic 09 covers async transitions properly).
4. **Non-blocking, and no unwanted loading indicators.** The second half is the one
   nobody expects — topic 11.

```jsx
function TabContainer() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');

  function selectTab(nextTab) {
    startTransition(() => {
      setTab(nextTab);            // ✅ synchronous inside the action → a Transition
    });
  }
  // ...
}
```

## 🔴 The action must be synchronous

The most common way a transition silently does nothing:

> The function you pass to `startTransition` **is called immediately**, marking all state
> updates that happen while it executes as Transitions. **If you try to perform state
> updates in a `setTimeout`, for example, they won't be marked as Transitions.**

```jsx
// 🔴 Not a transition — the window has closed by the time setTab runs
startTransition(() => {
  setTimeout(() => setTab(nextTab), 0);
});
```

```jsx
// 🔴 Also not a transition — same reason, after the await
startTransition(async () => {
  const data = await fetchTab(nextTab);
  setTab(data);                        // outside the synchronous window
});
```

> You must **wrap any state updates after any async requests in another
> `startTransition`** to mark them as Transitions. This is a **known limitation that will
> be fixed in the future.**

```jsx
// ✅ the second window re-opens the marking
startTransition(async () => {
  const data = await fetchTab(nextTab);
  startTransition(() => setTab(data));
});
```

The failure is silent — the update still happens, it is just urgent, so the interface
blocks exactly as it did before you added the transition. **There is no warning**, which
is why this belongs near the front of the topic rather than in a troubleshooting note.

## Two properties that define a transition

### Non-blocking

> **State updates marked as Transitions will be non-blocking.**

The urgent update — the one that keeps the UI feeling alive — commits immediately. The
transition renders in the background and commits when it is ready. Typing into a filter
box updates the input on the next frame while the 5,000-row table it filters renders
behind it.

### Interruptible

> A state update marked as a Transition **will be interrupted by other state updates**.
> For example, if you update a chart component inside a Transition, but then start typing
> into an input while the chart is in the middle of a re-render, **React will restart the
> rendering work on the chart component after handling the input update.**

Read that carefully: **restart**, not resume. Half-finished work is discarded and the
render begins again with the newer state. Two consequences follow immediately, and both
are the reason [Phase 7](../../phase-7-custom-hooks/README.md) exists:

- **A component may render several times per visible update, and some of those renders
  are never committed.** Anything impure in render — a counter, a `fetch`, a mutation,
  an analytics ping — now happens an unpredictable number of times, and sometimes for a
  render nobody ever sees.
- **A discarded render must be harmless.** That is exactly the *"has no side effects in
  render"* clause of
  [Phase 7 · 04 · 01](../../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/01-purity-and-idempotence.md),
  restated as a runtime requirement rather than a rule.

This is where the bill for breaking purity actually arrives. In a synchronous world an
impure render was untidy; here it is a bug you cannot reproduce.

## What it does *not* do

| It is not | Why the distinction matters |
|---|---|
| A delay or a debounce | Nothing is scheduled later. The action runs now; only the *commit* may wait, and only for as long as the work takes |
| A guarantee of speed | It does not make the expensive render cheaper — it keeps it from blocking the urgent one. A slow render is still slow |
| A way to batch | Batching is automatic and unrelated ([Phase 3 · 04](../../phase-3-state/04-automatic-batching.md)) |
| A replacement for memoization | If the table is slow because of 5,000 unmemoized rows, that is still true; the transition stops it freezing the input, not the render taking a second |

That last row is the practical trap: a transition can make a performance problem *feel*
solved while every measurement stays identical. Profile before and after
([Phase 6 · 05](../../phase-6-performance/05-measure-before-you-optimise.md)).

## Gotchas

**Symptom:** a transition is added and the UI blocks exactly as before.
**Cause:** the `set` call happened after an `await`, in a `setTimeout`, or in a callback —
outside the synchronous window.
**Fix:** call `set` synchronously inside the action, or re-wrap it in a second
`startTransition` after the `await`.

**Symptom:** no warning appears when a transition fails to mark anything.
**Cause:** there is none — the update simply stays urgent.
**Fix:** treat "it did nothing" as evidence that the marking window was missed.

**Symptom:** a component's render runs more times than there are visible updates.
**Cause:** transitions are interrupted and **restarted**, not resumed.
**Fix:** expected. Ensure render is pure so discarded renders are harmless.

**Symptom:** an analytics event or a network call fires several times per interaction.
**Cause:** a side effect in render, now multiplied by restarts.
**Fix:** move it to an event handler or an effect. Concurrent rendering makes this
non-negotiable.

**Symptom:** the expensive screen is still slow, just not blocking.
**Cause:** a transition changes scheduling, not cost.
**Fix:** it worked as designed. Fix the cost separately if the cost is the problem.

**Symptom:** a data library cannot use `useTransition`.
**Cause:** it has no component to call a hook from.
**Fix:** the standalone `startTransition`, which is not a Hook.

## Interview questions

**★ What does marking an update as a Transition actually change?**
Two things. It becomes non-blocking: the urgent update commits immediately while the
transition renders in the background. And it becomes interruptible — another state update
will interrupt it, and React *restarts* the rendering work rather than resuming it. It
does not delay anything, does not make the render cheaper, and does not schedule work for
later; the action runs immediately.

**★ What is the difference between `useTransition` and `startTransition`?**
The same mechanism, minus the pending flag. `startTransition` does not provide a way to
track whether a transition is pending, and it is not a Hook — so it works outside
components, which is how a router or a data library marks its own updates. `useTransition`
adds `isPending` and comes with the Rules of Hooks attached.

**★ Why does a transition sometimes appear to do nothing?**
Because the `set` call fell outside the synchronous marking window. React calls the action
immediately and marks only the state updates scheduled synchronously during that call, so
an update inside a `setTimeout`, a `.then`, or after an `await` is not a transition. There
is no warning — the update just stays urgent — and updates after an `await` currently
need to be wrapped in a second `startTransition`, which the docs call a known limitation.

**★ Why does concurrent rendering make the purity rules non-negotiable?**
Because a transition can be interrupted and restarted, so a component may render several
times for one visible update and some of those renders are never committed. Any side
effect in render — a fetch, a mutation, a counter, an analytics call — now happens an
unpredictable number of times, including for renders nobody sees. In a synchronous world
an impure render was untidy; here it is an unreproducible bug.

**A colleague wraps a slow table update in `startTransition` and reports it "fixed the
performance". Is it fixed?**
The responsiveness is fixed; the cost is not. A transition stops the expensive render
blocking the urgent one — the input stays live — but the table still takes exactly as long
to render. If the goal was a faster table, profile it: the memoization, the row count or
the virtualization is still the answer.

---

← Index: [`startTransition` and `useTransition`](README.md) ·
Prev: [Phase 8](../README.md) ·
Next → [`isPending`, and which tool](02-ispending-and-which-tool.md)
