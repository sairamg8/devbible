---
title: "isPending, and which tool"
sidebar_label: "02 · isPending, and which tool"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useTransition`](https://react.dev/reference/react/useTransition) and
> [`startTransition`](https://react.dev/reference/react/startTransition)
> (returns, and the full Caveats lists).
> No sandbox script backs this page; claims are cited, not measured.

**`isPending` is the only signal you get, and in the situation where it matters most it
is the only signal that *exists* — because a transition deliberately does not show
Suspense fallbacks. Choosing between the three tools comes down to one question: do you
own the `set` function?**

## What `isPending` is telling you

> The **`isPending`** flag that tells you whether there is a pending Transition.

Precisely: *a transition has been started and its render has not yet committed.* Not
"data is loading", not "the network is busy" — the render is in flight. It goes true
synchronously when the action runs and false when the transition commits.

```jsx
function TabContainer() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');

  return (
    <>
      <TabButton onClick={() => startTransition(() => setTab('posts'))}>
        Posts
      </TabButton>
      {isPending && <Spinner />}
      <TabPanel tab={tab} />
    </>
  );
}
```

**Why it matters more than it looks:** a transition
*"will not display unwanted loading indicators"* — Suspense fallbacks inside a transition
are deliberately suppressed so already-visible content is not replaced by a spinner. That
is the phase's most surprising behaviour and gets its own topic (11). The consequence
here is that **`isPending` is frequently your only feedback**, so a transition without a
pending indicator can look like an interface that ignored the click.

The right shape is usually *subtle and in place*: dim the outgoing content, disable the
control, show a thin progress line. Replacing the content with a spinner throws away the
very thing the transition was protecting.

## The caveats that shape real code

**Text inputs are excluded.**

> **Transition updates can't be used to control text inputs.**

A controlled input's value must track keystrokes immediately; a non-blocking update
cannot promise that. Keep the input's own state urgent and mark only the expensive
*consequence* — which is the `useDeferredValue` shape below.

**`startTransition` has a stable identity.**

> The `startTransition` function has a **stable identity**, so you will often see it
> omitted from Effect dependencies, but **including it will not cause the Effect to
> fire.**

So it is safe either way, and listing it keeps the linter happy without cost — the same
category as `dispatch` from `useReducer`
([Phase 5 · 03](../../phase-5-refs-context-reducers/03-usereducer.md)).

**Transitions are batched together, for now.**

> If there are **multiple ongoing Transitions, React currently batches them together.**
> This is a limitation that may be removed in a future release.

Two independent transitions therefore share one pending window: a fast one can appear
pending because a slow one is still running. Worth knowing before you attribute a
sluggish `isPending` to the wrong feature — and worth not building on, since it is
documented as a limitation rather than a guarantee.

## Which tool: the one question

> You can wrap an update into a Transition **only if you have access to the `set`
> function of that state.** If you want to start a Transition in response to some prop or
> a custom Hook value, **try `useDeferredValue` instead.**

That sentence is the decision procedure, and it appears in both references because it is
the thing people get wrong.

| Situation | Tool |
|---|---|
| You call the `set` function, and you want a pending indicator | **`useTransition`** |
| You call the `set` function, but you are outside a component — a router, a data library | **`startTransition`** |
| The value **arrives** as a prop or from a hook you do not own | **`useDeferredValue`** |
| It is a controlled text input's own value | **None** — keep it urgent |

The distinction is about **an update you control versus a value you receive.** If you can
reach the setter, you can mark the update. If the value is handed to you already changed,
there is no update to mark — you can only choose to lag behind it, which is exactly what
`useDeferredValue` does (topic 08).

## The combination that actually ships

The common case — a search box filtering an expensive list — uses both, and neither alone
is right:

```jsx
function Search() {
  const [query, setQuery] = useState('');       // urgent: the input must keep up
  const deferredQuery = useDeferredValue(query); // non-urgent: the list may lag

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ExpensiveResults query={deferredQuery} />
    </>
  );
}
```

The input's own state stays urgent, because transitions cannot control text inputs. The
expensive consequence lags. A `useTransition` around `setQuery` would be the wrong tool
twice over — it is excluded for text inputs, and the thing that needs deferring is not
the update but the *value the list receives*.

For a navigation or a tab switch, where you own the setter and there is no text input,
`useTransition` is right and `isPending` gives you the feedback.

## Gotchas

**Symptom:** a transition-driven navigation looks like nothing happened.
**Cause:** Suspense fallbacks are suppressed inside transitions, so with no `isPending`
indicator there is no feedback at all.
**Fix:** render something from `isPending` — dim the content, disable the control. Do not
replace the content with a spinner.

**Symptom:** `isPending` stays true longer than the feature it belongs to.
**Cause:** React currently batches multiple ongoing transitions together.
**Fix:** documented limitation. Do not design around it.

**Symptom:** a controlled text input lags or drops characters.
**Cause:** its own update was marked as a transition.
**Fix:** transitions cannot control text inputs. Keep the input urgent and defer the
consequence.

**Symptom:** you want a transition for a value that arrives as a prop.
**Cause:** there is no `set` function to wrap.
**Fix:** `useDeferredValue` — the documented answer for props and hook return values.

**Symptom:** the linter wants `startTransition` in a dependency array.
**Cause:** it does not know the identity is stable.
**Fix:** include it. Its identity is stable, and including it will not cause the effect to
fire.

**Symptom:** `isPending` is used as a data-loading flag and disagrees with the network.
**Cause:** it reports a pending *render*, not a pending request.
**Fix:** track request state separately if that is what the UI needs.

## Interview questions

**★ What exactly does `isPending` tell you, and why does it matter so much here?**
That a transition has been started and its render has not yet committed — a pending
render, not a pending request. It matters because transitions deliberately suppress
Suspense fallbacks so already-visible content is not replaced, which means `isPending` is
often the *only* feedback available. Without it, a transition-driven navigation looks like
a click that was ignored.

**★ How do you choose between `useTransition`, `startTransition` and `useDeferredValue`?**
By asking whether you have access to the `set` function. If you do and you want a pending
flag, `useTransition`; if you do but you are outside a component — a router, a data
library — the standalone `startTransition`, which is not a Hook. If the value arrives as a
prop or from a hook you do not own, there is no update to mark, and the docs point you to
`useDeferredValue` instead.

**★ Why can't transitions control text inputs?**
Because a controlled input's value has to track keystrokes immediately, and a
non-blocking update cannot promise that. The documented pattern is to keep the input's own
state urgent and defer the expensive consequence — `useDeferredValue` on the query, with
the input still driven by ordinary state.

**★ Two transitions are running and one seems slower than it should. What is happening?**
React currently batches multiple ongoing transitions together, so they share a pending
window and a fast one can read as pending because a slow one is still running. The docs
describe this as a limitation that may be removed, so it is something to recognise rather
than something to build on.

**Should `startTransition` go in an effect's dependency array?**
It can, safely. Its identity is stable, so it is often omitted — but including it will not
cause the effect to fire, which makes satisfying the linter free.

---

← Prev: [Marking an update as non-urgent](01-marking-an-update-non-urgent.md) ·
Index: [`startTransition` and `useTransition`](README.md) ·
Next → [Phase 8](../README.md)
