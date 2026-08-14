---
title: "useOptimistic"
sidebar_label: "07 · useOptimistic"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useOptimistic`](https://react.dev/reference/react/useOptimistic) (definition,
> parameters, returns, the Caveat, and the revert behaviour) and
> [`useTransition`](https://react.dev/reference/react/useTransition) (Actions).
> No sandbox script backs this page; claims are cited, not measured.

**Show the result before the server confirms it, and let React take it back automatically
when the action settles. The reverting is the feature — it is what you would otherwise get
wrong, because it has to happen without a flicker on success and without a trace on
failure.**

## The API

> `useOptimistic` is a React Hook that lets you **optimistically update the UI**.

```js
const [optimisticState, addOptimistic] = useOptimistic(value, updateFn?);
```

> - **`value`**: The value returned **when there are no pending Actions**.
> - **`updateFn(currentState, action)`** (optional): The reducer function that specifies how
>   the optimistic state gets updated. **It must be pure**, should take the current state
>   and action arguments, and should return the next optimistic state.

> 1. **`optimisticState`**: The current optimistic state. It is **equal to `value` unless an
>    Action is pending**, in which case it is equal to the state returned by the reducer.
> 2. **The set function**: Lets you update the optimistic state to a different value
>    **inside an Action**.

```jsx
function Comments({ comments, addComment }) {
  const [optimistic, addOptimisticComment] = useOptimistic(
    comments,
    (current, newText) => [...current, { id: 'pending', text: newText, sending: true }]
  );

  async function action(formData) {
    const text = formData.get('text');
    addOptimisticComment(text);        // ← inside the Action
    await addComment(text);
  }

  return (
    <>
      {optimistic.map((c) => (
        <p key={c.id} style={{ opacity: c.sending ? 0.5 : 1 }}>{c.text}</p>
      ))}
      <form action={action}>
        <input name="text" />
        <button>Post</button>
      </form>
    </>
  );
}
```

**The reducer must be pure**, and it is a reducer in the full
[Phase 5 · 03](../phase-5-refs-context-reducers/03-usereducer.md) sense — same
`(state, action) => nextState` shape, same purity requirement. It may run more than once,
because a transition can be interrupted and restarted
([Phase 8 · 01](../phase-8-concurrent-suspense/01-usetransition/01-marking-an-update-non-urgent.md)).

## 🔴 The set function must be called inside an Action

> **The set function must be called inside an Action.** If you call the setter **outside**
> an Action, React will show a **warning** and the optimistic state will **briefly render.**

"Briefly render" is the precise failure: the optimistic value appears and then vanishes,
because there is no pending action to hold it. It is the same constraint as
`useActionState`'s dispatch ([topic 03](03-useactionstate.md)), and like that one it
**does** warn in development — unlike the post-`await` limitation, which does not.

Inside a `<form action>` function you are already in an Action, so the common case needs no
thought. From a click handler you need `startTransition`.

And a specific case worth flagging: calling it **after an `await`** inside an async Action
puts it outside the transition scope
([Phase 8 · 09](../phase-8-concurrent-suspense/09-async-transitions.md)). It should be the
**first** thing the action does anyway — the point is to show the result immediately, not
after a round trip.

## How the revert works, and why it is the hard part

> **Optimistic state is temporary.** It only renders **while an Action is in progress.**
> Otherwise, `value` is rendered.

**On success:**

> The final state is determined by the `value` argument. **There is no extra render to
> "clear" the optimistic state** — the optimistic and real state **converge in the same
> render** when the Transition completes.

That sentence is the whole value proposition. A hand-rolled version has two pieces of state
— the real list and the pending item — and must remove the pending one at the exact moment
the real one arrives. Get it wrong by one render and the item **flickers** or **appears
twice**. React converges them in a single render, so neither is possible.

**On failure:**

> React renders with **whatever `value` currently is.** Since the parent typically only
> updates `value` on success, **a failure means `value` hasn't changed**, so the UI shows
> what it showed **before** the optimistic update. You can **catch the error to show a
> message** to the user.

So the rollback is not special-cased — it falls out of the model. The optimistic state
existed only while the action was pending; when it stops being pending, `value` is what
renders, and `value` was never changed. **You write no rollback code**, which is the second
thing hand-rolled versions get wrong.

But note the clause: *"Since the parent typically only updates `value` on success"*. The
guarantee depends on your data flow. If the parent updates `value` optimistically too, or
from a cache that was written before confirmation, the revert has nothing to revert to.
**`value` must be the confirmed truth.**

And the last sentence is a real instruction: the UI silently returning to its previous state
is not an error message. **Catch the failure and tell the user**, or they will assume the
action worked.

## What it is not

| | |
|---|---|
| **Not a cache** | It holds nothing between actions. When no action is pending, `value` renders, full stop |
| **Not a retry** | A failure reverts; retrying is yours to offer |
| **Not a substitute for `isPending`** | It shows the *result*; a disabled button and a spinner still communicate that work is happening |
| **Not for uncertain outcomes** | If the action often fails, showing success first teaches users not to trust the UI |

That last row is the design judgement. ⚠️ **Judgement, not documentation:** optimistic UI is
right when the action **almost always succeeds** and the result is **easy to undo visually**
— posting a comment, toggling a like, reordering a list. It is wrong for a payment, an
irreversible delete, or anything where showing a false success does real harm.

## `useOptimistic` versus `useFormStatus`'s `data`

[Topic 06](06-useformstatus.md) noted that `useFormStatus` exposes the `FormData` in flight,
which can render *"Sending “…”…"*. That is not the same thing:

- **`useFormStatus().data`** shows *what is being sent* — a status line about a request.
- **`useOptimistic`** shows *the expected result* — the comment already in the list, styled
  as pending.

The second is what makes an app feel instant; the first is a progress indicator. Use `data`
for an upload progress line, `useOptimistic` for the item itself.

## Gotchas

**Symptom:** the optimistic value flashes on screen and disappears immediately.
**Cause:** the setter was called outside an Action, so there is no pending action to hold
it. React warns about this.
**Fix:** call it inside the form action, or wrap it in `startTransition`.

**Symptom:** the optimistic item appears only after the request finishes.
**Cause:** the setter was called after an `await`, so it ran too late — and outside the
transition scope.
**Fix:** call it first, before any awaiting.

**Symptom:** the item flickers or briefly appears twice on success.
**Cause:** a hand-rolled optimistic list alongside the real one.
**Fix:** `useOptimistic` — the optimistic and real state converge in the same render, with
no extra render to clear it.

**Symptom:** a failed action leaves the optimistic value on screen.
**Cause:** `value` was updated before confirmation, so reverting to it changes nothing.
**Fix:** `value` must be the confirmed truth. Update it only on success.

**Symptom:** a failure silently reverts and users retry endlessly.
**Cause:** the revert is not a message.
**Fix:** catch the error and show one. The docs say to.

**Symptom:** the reducer runs more than once per submission.
**Cause:** transitions can be interrupted and restarted, and the reducer must be pure.
**Fix:** expected — keep it pure and idempotent.

## Interview questions

**★ What does `useOptimistic` give you that you cannot easily write yourself?**
The revert, on both paths. On success, the optimistic and real state converge **in the same
render** — there is no extra render to clear the optimistic value, so the item cannot
flicker or briefly appear twice, which is exactly what a hand-rolled version gets wrong. On
failure, it simply renders `value` again, and since `value` was never changed, the UI
returns to its previous state with **no rollback code at all**.

**★ Where must the setter be called?**
Inside an Action — a `<form action>` function, or wrapped in `startTransition`. Called
outside one, React warns and the optimistic state renders only briefly, because there is no
pending action to sustain it. It should also be the first thing the action does, before any
`await`, both so the user sees the result immediately and because a call after an `await` is
outside the transition scope.

**★ What does the failure behaviour depend on?**
That `value` is the confirmed truth. React renders whatever `value` currently is when the
action is no longer pending — and the docs note this works because the parent typically
updates `value` only on success. If your data flow updates it optimistically too, or from a
cache written before confirmation, there is nothing to revert to. And the revert is not a
message: catch the error and tell the user, or they will assume it worked.

**★ When is optimistic UI the wrong choice?**
When the action can plausibly fail, or when a false success does harm — a payment, an
irreversible delete. Showing success first teaches users not to trust the UI. It is right
when the action almost always succeeds and the result is visually easy to take back — a
comment, a like, a reorder.

**How does it differ from reading `useFormStatus().data`?**
`data` shows what is *being sent* — a status line about the request in flight. `useOptimistic`
shows the *expected result*, rendered as if it had already happened. The first is a progress
indicator; the second is what makes the app feel instant.

---

← Prev: [`useFormStatus`](06-useformstatus.md) ·
Index: [Phase 9](README.md) ·
Next → [Multiple actions in one form](08-multiple-actions.md)
