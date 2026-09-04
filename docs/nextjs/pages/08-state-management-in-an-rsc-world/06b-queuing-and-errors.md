---
title: "useActionState is a queue, and its two most surprising behaviours follow from that: dispatches run strictly one at a time so each can receive the previous result, and a reducerAction that throws cancels every dispatch already queued behind it"
sidebar_label: "06b · Queuing and errors"
sidebar_position: 37
description: "Sequential dispatch inside useActionState, known errors as state versus thrown errors to an error boundary, and why a thrown action cancels the dispatches queued behind it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the React reference — [`useActionState`](https://react.dev/reference/react/useActionState)
> and [`useTransition`](https://react.dev/reference/react/useTransition) — and the Next.js
> [Building interactive apps](https://nextjs.org/docs/app/guides/interactive-apps) guide (`lastUpdated: 2026-08-25`)
> and [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) guide (`lastUpdated: 2026-06-17`).
> React reference text read from the react.dev source (`reactjs/react.dev`,
> `src/content/reference/react/useActionState.md`).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**`useActionState` is a queue, and once you know that, its two most confusing behaviours stop being confusing. Four rapid clicks take four times as long as one because each call must receive the previous call's return value as its `previousState` — the reference calls that intentional, in bold. And a `reducerAction` that throws does not merely fail its own dispatch; React cancels every dispatch already queued behind it, which is why a routine validation error thrown instead of returned silently swallows the user's next three clicks. Both are the price of the ordering guarantee that makes the hook worth using, and both have a documented fix.**

## Dispatches are sequential, on purpose

> *"React queues and executes multiple calls to `dispatchAction` sequentially. Each call to `reducerAction` receives the result of the previous call."*
> — [`useActionState` · Caveats](https://react.dev/reference/react/useActionState#caveats)

The reference's own deep dive spells out what that costs, using an example with an artificial one-second delay:

> *"Try clicking 'Add Ticket' multiple times. Every time you click, a new `addToCartAction` is queued. Since there's an artificial 1 second delay, that means 4 clicks will take ~4 seconds to complete. **This is intentional in the design of `useActionState`.** We have to wait for the previous result of `addToCartAction` in order to pass the `prevCount` to the next call to `addToCartAction`. That means React has to wait for the previous Action to finish before calling the next Action."*
> — [`useActionState` · How `useActionState` queuing works](https://react.dev/reference/react/useActionState#how-useactionstate-queuing-works)

And the three ways out, in the reference's own words: *"You can typically solve this by using with `useOptimistic` but for more complex cases you may want to consider cancelling queued actions or not using `useActionState`."*

The first is the one you reach for in practice — the queue still takes four seconds, but the user sees four increments immediately, because the optimistic value is not waiting on the server. That pattern is [06d](06d-useoptimistic.md).

If you want the work parallel rather than ordered, the reference says to stop using this hook: *"If you want to perform Actions in parallel, use `useState` and `useTransition` directly."*

⚠️ There is a second, independent serialisation underneath this one when the action is a Server Action: *"Next.js dispatches Server Actions one at a time per client."* Both queues are real, and they compose — the React queue orders dispatches for one hook, the Next.js dispatcher orders action requests for the whole client.

## A thrown action cancels the queue

React's model has two distinct error paths and they are not interchangeable.

> *"There are two ways to handle errors with `useActionState`. For known errors, such as 'quantity not available' validation errors from your backend, you can return it as part of your `reducerAction` state and display it in the UI. For unknown errors, such as `undefined is not a function`, you can throw an error. React will cancel all queued Actions and shows the nearest Error Boundary by rethrowing the error from the `useActionState` hook."*
> — [`useActionState` · Handling errors](https://react.dev/reference/react/useActionState#handling-errors)

The queue-cancelling half is what bites, because the symptom looks unrelated to the throw:

> *"If you call `dispatchAction` multiple times and some of them don't run, it may be because an earlier `dispatchAction` call threw an error. When a `reducerAction` throws, React skips all subsequently queued `dispatchAction` calls."*
> — [`useActionState` · My actions are being skipped](https://react.dev/reference/react/useActionState#actions-skipped)

```ts filename="app/tasks/actions.ts"
'use server'

export type MoveState = { moved: number; error: string | null }

export async function moveTask(
  previousState: MoveState,
  payload: { id: string; column: string },
): Promise<MoveState> {
  try {
    await db.task.update({ where: { id: payload.id }, data: { column: payload.column } })
    updateTag('board')
    return { moved: previousState.moved + 1, error: null }
  } catch {
    // ✅ A known, recoverable failure: state, not a throw — the queue survives.
    return { ...previousState, error: 'Could not move that card. Try again.' }
  }
}
```

```ts
// the shape the reference recommends, written out plainly
async function myReducerAction(prevState, data) {
  try {
    const result = await submitData(data)
    return { success: true, data: result }
  } catch (error) {
    // ✅ Return error state instead of throwing
    return { success: false, error: error.message }
  }
}
```

Throw only when the failure is a bug rather than an outcome. `undefined is not a function` should reach an error boundary; "that column is full" should be a string in state.

## Gotchas

**★ Symptom: clicking a button five times quickly takes five times as long as clicking it once.** Cause: the hook queues dispatches so each one can receive the previous return value — documented and intentional. Fix: keep the queue for correctness and stop the user waiting on it, with an optimistic value alongside.

```tsx
const [count, dispatchAction, isPending] = useActionState(updateCartAction, 0)
const [optimisticCount, setOptimisticCount] = useOptimistic(count)

async function formAction(formData: FormData) {
  setOptimisticCount((c) => c + 1)
  return dispatchAction(formData)
}
```

**★ Symptom: some dispatches simply never run, with no error visible in the UI.** Cause: an earlier `reducerAction` threw, and React skips every dispatch queued behind a throw. Fix: catch inside the reducer and return an error state.

```ts
async function myReducerAction(prevState, data) {
  try {
    return { success: true, data: await submitData(data) }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
```

**★ Symptom: the whole route is replaced by the error boundary when one field fails validation.** Cause: the action threw for a *known* failure. A throw is the "unknown error" path and is rethrown from the hook into the nearest error boundary. Fix: return validation failures as state.

```ts
if (!parsed.success) {
  return { errors: z.flattenError(parsed.error).fieldErrors, message: null }
}
```

**★ Symptom: two independent operations in one component block each other.** Cause: they share one `useActionState`, so they share one queue. Fix: give each its own hook — one queue per thing that needs ordering.

```tsx
const [renameState, rename, renaming] = useActionState(renameTask, { error: null })
const [moveState, move, moving] = useActionState(moveTask, { error: null })
```

**★ Symptom: an action is dispatched from an effect and React logs the outside-a-transition error.** Cause: an effect body is not an Action. Fix: wrap the dispatch, exactly as in an event handler.

```tsx
useEffect(() => {
  startTransition(() => dispatchAction({ type: 'sync' }))
}, [dispatchAction])
```

## Interview questions

**★ Why does `useActionState` run dispatches one at a time, and what do you do when that is too slow?**
Because each `reducerAction` call receives the previous call's return value as `previousState`, and React cannot produce that value until the previous call resolves. The ordering is the feature: a sequence of mutations composes correctly instead of racing. When the wait is user-visible, the answer is not to remove the queue but to stop the user waiting on it — `useOptimistic` shows the projected result immediately while the queue drains behind it. If the operations genuinely are independent and should run in parallel, the reference's own advice is to drop the hook and use `useState` with `useTransition`.

**★ When should a Server Action throw, and when should it return an error as state?**
Throw for unknown errors — a bug, a null dereference, an unreachable dependency — because React will cancel the queued actions and surface it at the nearest error boundary, which is the correct treatment for something nobody can recover from in place. Return state for known, expected failures: validation, business rules, conflicts. The practical reason the distinction matters is the queue: a throw does not just fail its own dispatch, it skips every dispatch already queued behind it, so throwing for a routine validation failure silently drops the user's next three clicks.

**Two dispatchers, or one dispatcher with a typed payload?**
One dispatcher with a discriminated payload when the operations mutate the same state and must be ordered — an add and a remove on the same cart share a queue and a running total, and mixing them into two hooks means two states that can disagree. Two dispatchers when the operations are independent, because then a shared queue makes one operation wait for the other for no reason, and you also get a separate `isPending` per operation, which is usually what the UI wants to render.

**A colleague reports the action running twice in development and blames Strict Mode. Are they right?**
No. The reference is explicit that `reducerAction` is not invoked twice in Strict Mode, precisely because it is designed to have side effects — unlike a `useReducer` reducer, which is double-invoked to catch impurity. A doubled action means two dispatches: typically a submit button that both submits the form and calls the dispatcher in an `onClick`, or a handler that calls the action directly as well as through the form's `action` prop. Remove the second trigger.

---

← [06 · useActionState](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md) · [Chapter 8 overview](01-explanation.md) · Next → [06c · Reset, transitions and permalink](06c-reset-transitions-and-permalink.md)
