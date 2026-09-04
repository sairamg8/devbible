---
title: "useOptimistic renders a temporary value for exactly as long as an Action is pending, which is why the single most common bug with it is calling the setter outside a Transition — there is then no pending window to hold the value and it reverts on the next frame"
sidebar_label: "06d · useOptimistic"
sidebar_position: 39
description: "The signature and setter of useOptimistic, the Transition requirement, how the optimistic and real values converge in one render, what happens when the action fails, and why a reducer re-bases on changing data where an updater does not."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the React reference — [`useOptimistic`](https://react.dev/reference/react/useOptimistic)
> and [`useTransition`](https://react.dev/reference/react/useTransition) — and the Next.js
> [Building interactive apps](https://nextjs.org/docs/app/guides/interactive-apps) guide
> (`lastUpdated: 2026-08-25`). React reference text read from the react.dev source
> (`reactjs/react.dev`, `src/content/reference/react/useOptimistic.md`).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**`useOptimistic` does not "store" anything. It returns the value you gave it, *unless* an Action is pending, in which case it returns whatever the setter projected. The Transition is what defines "pending", so a setter call outside one has no window to live in: React warns, the value renders for a frame and vanishes. That single fact explains the overwhelming majority of `useOptimistic` bugs. The second most useful fact is that there is no extra render to clear the optimistic value — when the Transition ends, the real value and the optimistic value converge in the same commit, so a correctly-wired optimistic UI never flickers between the guess and the truth.**

## The signature

```js
const [optimisticState, setOptimistic] = useOptimistic(value, reducer?);
```

**Parameters**, verbatim:

> *"`value`: The value returned when there are no pending Actions."*
>
> *"**optional** `reducer(currentState, action)`: The reducer function that specifies how the optimistic state gets updated. It must be pure, should take the current state and reducer action arguments, and should return the next optimistic state."*
> — [`useOptimistic` · Parameters](https://react.dev/reference/react/useOptimistic#parameters)

**Returns**, verbatim:

> *"`useOptimistic` returns an array with exactly two values: 1. `optimisticState`: The current optimistic state. It is equal to `value` unless an Action is pending, in which case it is equal to the state returned by `reducer` (or the value passed to the set function if no `reducer` was provided). 2. The `set` function that lets you update the optimistic state to a different value inside an Action."*
> — [`useOptimistic` · Returns](https://react.dev/reference/react/useOptimistic#returns)

The setter takes either a value or an updater function:

> *"`optimisticState`: The value that you want the optimistic state to be during an Action. If you provided a `reducer` to `useOptimistic`, this value will be passed as the second argument to your reducer. It can be a value of any type. If you pass a function as `optimisticState`, it will be treated as an *updater function*. It must be pure, should take the pending state as its only argument, and should return the next optimistic state."*
> — [`useOptimistic` · `set` parameters](https://react.dev/reference/react/useOptimistic#setoptimistic-parameters)

## 🔴 The setter must be called inside an Action

> *"The `set` function must be called inside an Action. If you call the setter outside an Action, React will show a warning and the optimistic state will briefly render."*
> — [`useOptimistic` · `set` caveats](https://react.dev/reference/react/useOptimistic#setoptimistic-caveats)

An **Action**, in React's vocabulary, is a function called inside `startTransition` — or an Action prop such as `<form action>` or a prop named `…Action`, which React wraps for you. The development error text, quoted from the reference: `An optimistic state update occurred outside a Transition or Action. To fix, move the update to an Action, or wrap with startTransition.`

```js
// 🚩 Incorrect: outside a Transition
function handleClick() {
  setOptimistic(newValue);  // Warning!
  // ...
}

// ✅ Correct: inside a Transition
function handleClick() {
  startTransition(async () => {
    setOptimistic(newValue);
    // ...
  });
}

// ✅ Also correct: inside an Action prop
function submitAction(formData) {
  setOptimistic(newValue);
  // ...
}
```

And the mechanism behind the symptom:

> *"When you call the setter outside an Action, the optimistic state will briefly appear and then immediately revert back to the original value. This happens because there's no Transition to 'hold' the optimistic state while your Action runs."*
> — [`useOptimistic` · Troubleshooting](https://react.dev/reference/react/useOptimistic#an-optimistic-state-update-occurred-outside-a-transition-or-action)

There is a second, narrower error — `Cannot update optimistic state while rendering.` — which means the setter was called in the render phase. It may be called *"from event handlers, effects, or other callbacks"*, never during render.

## How the value flows, and why it does not flicker

```js
const [value, setValue] = useState('a');
const [optimistic, setOptimistic] = useOptimistic(value);

startTransition(async () => {
  setOptimistic('b');
  const newValue = await saveChanges('b');
  setValue(newValue);
});
```

> *"1. **Update immediately**: When `setOptimistic('b')` is called, React immediately renders with `'b'`. 2. **(Optional) await in Action**: If you await in the Action, React continues showing `'b'`. 3. **Transition scheduled**: `setValue(newValue)` schedules an update to the real state. 4. **(Optional) wait for Suspense**: If `newValue` suspends, React continues showing `'b'`. 5. **Single render commit**: Finally, the `newValue` commits for `value` and `optimistic`."*
>
> *"There's no extra render to 'clear' the optimistic state. The optimistic and real state converge in the same render when the Transition completes."*
> — [`useOptimistic` · How optimistic state works](https://react.dev/reference/react/useOptimistic#how-optimistic-state-works)

The consequence people find counter-intuitive:

> *"Optimistic state only renders while an Action is in progress, otherwise `value` is rendered. If `saveChanges` returned `'c'`, then both `value` and `optimistic` will be `'c'`, not `'b'`."*
> — [`useOptimistic` · Optimistic state is temporary](https://react.dev/reference/react/useOptimistic#optimistic-state-is-temporary)

The optimistic value is a *guess for the duration of the request*, not a write. If the server disagrees, the server wins, silently and in one commit.

### What decides the value after the Action

> *"**Hardcoded values** like `useOptimistic(false)`: After the Action, `state` is still `false`, so the UI shows `false`. This is useful for pending states where you always start from `false`. · **Props or state passed in** like `useOptimistic(isLiked)`: If the parent updates `isLiked` during the Action, the new value is used after the Action completes. This is how the UI reflects the result of the Action. · **Reducer pattern** like `useOptimistic(items, fn)`: If `items` changes while the Action is pending, React re-runs your `reducer` with the new `items` to recalculate the state. This keeps your optimistic additions on top of the latest data."*
> — [`useOptimistic` · How the final state is determined](https://react.dev/reference/react/useOptimistic#how-optimistic-state-works)

🔴 The third bullet is the one that matters in an RSC app. `value` is usually a **prop from a Server Component**, and the whole point is that the server sends a new one when the action's response carries a re-render. That new prop becomes the base, the reducer re-runs against it, and your optimistic addition sits on top of the fresh data rather than on top of a snapshot.

### When the Action fails

> *"If the Action throws an error, the Transition still ends, and React renders with whatever `value` currently is. Since the parent typically only updates `value` on success, a failure means `value` hasn't changed, so the UI shows what it showed before the optimistic update. You can catch the error to show a message to the user."*
> — [`useOptimistic` · What happens when the Action fails](https://react.dev/reference/react/useOptimistic#how-optimistic-state-works)

So the rollback is not a feature you implement — it is what happens by default, because the optimistic value only ever existed for the duration of the Transition. What you *do* have to implement is telling the user, because the revert alone is silent.

## Updaters versus reducers, and why the difference is not style

Both forms calculate the next optimistic state from the current one:

```js
// Updater: pass a function to the setter
const [optimistic, setOptimistic] = useOptimistic(value);
setOptimistic(current => !current);

// Reducer: separate the update logic from the call site
const [optimistic, dispatch] = useOptimistic(value, (current, action) => {
  // Calculate next state based on current and action
});
dispatch(action);
```

> *"**Use updaters** for calculations where the setter call naturally describes the update. … **Use reducers** when you need to pass data to the update (like which item to add) or when handling multiple types of updates with a single hook."*
> — [`useOptimistic` · Choosing between updaters and reducers](https://react.dev/reference/react/useOptimistic#choosing-between-updaters-and-reducers)

The correctness argument, which is the real reason to prefer a reducer for lists:

> *"Reducers are essential when the base state might change while your Transition is pending. If `todos` changes while your add is pending (for example, another user added a todo), React will re-run your reducer with the new `todos` to recalculate what to show. This ensures your new todo is added to the latest list, not an outdated copy. An updater function like `setOptimistic(prev => [...prev, newItem])` would only see the state from when the Transition started, missing any updates that happened during the async work."*
> — same deep dive

```tsx
'use client'

import { useOptimistic } from 'react'
import { addComment } from '@/features/task/task-actions'

type Comment = { id: string; body: string; pending?: boolean }

export function CommentBox({ taskId, comments }: { taskId: string; comments: Comment[] }) {
  // Reducer form: re-runs against the newest `comments` if it changes mid-flight.
  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    (current: Comment[], body: string) => [
      ...current,
      { id: `pending-${body}`, body, pending: true },
    ],
  )

  async function submit(formData: FormData) {
    const body = String(formData.get('body'))
    addOptimistic(body)
    await addComment(taskId, body)
  }

  return (
    <>
      <ul>
        {optimisticComments.map((c) => (
          <li key={c.id} data-pending={c.pending ? '' : undefined}>{c.body}</li>
        ))}
      </ul>
      <form action={submit}>
        <input name="body" />
        <button type="submit">Send</button>
      </form>
    </>
  )
}
```

`submit` is passed to `<form action>`, so React wraps it in a Transition and no `startTransition` import is needed here at all. Trigger the same code from a bare `onClick` and you must import `startTransition` and wrap both the setter and the `await` in it — the setter alone is not enough, because the Transition has to stay open for the duration of the request.

## Gotchas

**★ Symptom: the optimistic value appears for a single frame and immediately snaps back.** Cause: the setter was called outside a Transition, so there is no pending window to hold it. React logs `An optimistic state update occurred outside a Transition or Action.` Fix: wrap the call, or move it into an Action prop.

```tsx
function handleClick() {
  startTransition(async () => {
    setOptimistic(newValue)
    await saveChanges(newValue)
  })
}
```

**★ Symptom: `Cannot update optimistic state while rendering.` and the component loops.** Cause: the setter was called in the render phase — often as a way to "initialise" the optimistic value. Fix: call it only from an event handler, an effect, or an action.

```tsx
// 🚩 setPending(true)  — during render
// ✅
function handleClick() {
  startTransition(() => { setPending(true) })
}
```

**★ Symptom: the optimistic value survives the request and then the UI shows the wrong thing until the next navigation.** Cause: the base `value` never changed, so the Transition ended and the component fell back to the stale prop. Fix: make sure the action causes a new `value` — in an RSC app, that means the Server Action must invalidate or refresh so the re-render ships in the action's response.

```ts
'use server'
import { updateTag } from 'next/cache'

export async function addComment(taskId: string, body: string) {
  await db.comment.create({ data: { taskId, body } })
  updateTag(`task-${taskId}`)   // the response now carries the new prop
}
```

**★ Symptom: two rapid clicks produce one increment instead of two.** Cause: the setter was passed a literal computed from the prop (`setOptimistic(priority + 1)`), so the second click read the same stale base. Fix: read from the optimistic value, or use an updater.

```tsx
// 🚩 setOptimisticPriority(PRIORITY_CYCLE[priority])
// ✅
setOptimisticPriority(PRIORITY_CYCLE[optimisticPriority])
// ✅ or, equivalently
setOptimisticPriority((current) => PRIORITY_CYCLE[current])
```

**★ Symptom: an optimistically added row disappears and reappears when another user's change arrives mid-request.** Cause: an updater function closes over the base state as it was when the Transition started, so a new `value` arriving mid-flight discards the projection. Fix: use the reducer form, which React re-runs against the newest base.

```tsx
const [optimisticTodos, addTodo] = useOptimistic(
  todos,
  (current: Todo[], text: string) => [...current, { id: `pending-${text}`, text, pending: true }],
)
```

**★ Symptom: the action fails and the UI silently reverts, so the user believes it worked and then does not.** Cause: the revert is automatic and mute — the Transition ends, `value` is unchanged, the optimistic projection is gone. Fix: catch and surface it; the revert is not the notification.

```tsx
startTransition(async () => {
  setOptimisticStatus('done')
  try {
    await markDone(id)
  } catch {
    toast.error('Could not mark that task done.')
  }
})
```

**★ Symptom: `useOptimistic(false)` for a pending flag stays `true` after the action completes.** Cause: it cannot — the base is the literal `false`, so it returns to `false` the moment the Transition ends. If it appears stuck, the Transition has not ended, which usually means an `await` inside the action never settles. Fix: look at the action, not the hook; the hook is reporting the truth.

**★ Symptom: the optimistic list flashes the old contents between the request finishing and the new data arriving.** Cause: something re-rendered outside the Transition, ending it before the new `value` was ready. Fix: keep the whole sequence inside one Action — the setter, the `await`, and the state update that follows — and wrap post-`await` state updates in `startTransition`, per [06c](06c-reset-transitions-and-permalink.md). Correctly wired, React commits the real and optimistic values in the same render and there is no intermediate frame.

## Interview questions

**★ What is the single most common `useOptimistic` bug, and what is the mechanism behind it?**
Calling the setter outside a Transition. `useOptimistic` returns the base `value` unless an Action is pending, and "pending" means a Transition is in flight — so a setter call from a bare event handler has no window in which its projection is the current value. React logs a warning and the projected value renders for a frame before reverting. The fix is to put the setter, and the async work it is projecting, inside `startTransition`, or to trigger the whole thing from an Action prop such as `<form action>` which React wraps for you.

**★ After the action completes, does the UI show the optimistic value or the server's value?**
The server's — and this surprises people. The optimistic value exists only while the Transition is pending; when it ends, the component renders `value`, whatever `value` now is. If the action produced a different result than you guessed, the UI shows the result, not the guess. And there is no intermediate frame: the reference is explicit that there is *"no extra render to 'clear' the optimistic state"*, because the real and optimistic values converge in the same commit.

**★ Why does the docs' advice prefer a reducer over an updater function for optimistic list updates?**
Because of what happens when the base data changes mid-flight. An updater function is evaluated against the state as it was when the Transition started, so if a new `value` arrives — another user's comment, a socket push, a fresh RSC payload — the projection is computed from an outdated copy and your optimistic row can vanish or duplicate. A reducer is re-run against the newest base whenever it changes, so the optimistic addition is always layered on top of the latest data. In an RSC app the base is typically a prop from a Server Component, and props change exactly when the action's response ships a re-render, so this is the common case rather than the exotic one.

**★ How does rollback work when the action fails?**
It is not a rollback in the sense of an undo; nothing was ever committed. The Transition ends, React renders with whatever `value` currently is, and since the parent only updates `value` on success, `value` is unchanged — so the UI is exactly what it was before the optimistic update. The important corollary is that the failure is *silent*: the user sees the change disappear with no explanation, so catching the error and showing a message is your job, not React's.

**In an RSC app, where does the `value` passed to `useOptimistic` normally come from, and why does that matter?**
From a Server Component, as a prop. That matters because it makes the final state of the optimistic UI a function of the server's response: the action mutates, calls `updateTag`, `revalidatePath` or `refresh()`, and Next.js ships a newly rendered RSC payload inside the action's own response. The new prop becomes the base, the optimistic projection converges onto it in one commit, and the screen is correct without a second fetch. If the action does none of those things, the prop never changes and the optimistic value reverts to stale data — which is the failure that looks like "the optimistic update did not stick".

**Can you use `useOptimistic` for something other than data — a pending flag, for instance?**
Yes, and it is a documented pattern: `useOptimistic(false)` gives you a boolean that is `true` for exactly the duration of the Action and `false` otherwise, because the base is the literal `false`. Next.js uses it to drive a `data-pending` attribute on a delete button so that an ancestor can fade itself with CSS, without lifting state or threading callbacks. It is a nicer fit than `useTransition`'s `isPending` when the flag needs to belong to one row rather than to the whole component.

**Why must the reducer passed to `useOptimistic` be pure, when `useActionState`'s reducer may have side effects?**
Because React may re-run it, more than once, whenever the base value changes during a pending Transition — that re-running is precisely how the optimistic value is re-based onto fresh data. A side effect inside it would fire an unpredictable number of times. `useActionState`'s `reducerAction` has the opposite contract: it is called exactly once per dispatch, in order, and is explicitly designed to perform the side effect (which is also why React does not double-invoke it in Strict Mode).

---

← [06c · Reset, transitions, permalink](06c-reset-transitions-and-permalink.md) · [Chapter 8 overview](01-explanation.md) · Next → [06e · The optimistic patterns in practice](06e-optimistic-patterns-and-pending-feedback.md)
