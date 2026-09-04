---
title: "useActionState is a reducer that is allowed to have side effects — the function you give it receives the previous state first and the payload second, and almost every bug people hit with it is a consequence of forgetting that first argument"
sidebar_label: "06 · useActionState"
sidebar_position: 6
description: "The exact signature and return shape of useActionState, the reducerAction contract, the (previousState, formData) argument order, validation state flowing back instead of into a store, and the transition requirement for isPending."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the React reference — [`useActionState`](https://react.dev/reference/react/useActionState)
> — and the Next.js [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) guide
> (`lastUpdated: 2026-08-25`) and [Building interactive apps](https://nextjs.org/docs/app/guides/interactive-apps)
> guide (`lastUpdated: 2026-08-25`). React reference text read from the react.dev source
> (`reactjs/react.dev`, `src/content/reference/react/useActionState.md`).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · `zod` 4.4.3 · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**`useActionState` is the framework-native answer to "where does the result of this mutation live?" — and the answer is *in React*, not in a store. It takes a function that may do side effects, calls it with the previous state and your payload, and gives you back the state, a dispatcher, and a pending flag. That is the whole surface, and it replaces the four `useState` calls (submitting, error, fieldErrors, lastResult) that a form in a client-store app would otherwise carry. The one thing to internalise before writing any of it: the function's first parameter is the previous state, so with a `<form>` the submitted `FormData` arrives *second*, and every "my action cannot read the form data" bug is that argument order.**

## The signature

```js
const [state, dispatchAction, isPending] = useActionState(reducerAction, initialState, permalink?);
```

**Parameters**, verbatim from the reference:

> *"`reducerAction`: The function to be called when the Action is triggered. When called, it receives the previous state (initially the `initialState` you provided, then its previous return value) as its first argument, followed by the `actionPayload` passed to `dispatchAction`."*
>
> *"`initialState`: The value you want the state to be initially. React ignores this argument after `dispatchAction` is invoked for the first time."*
>
> *"**optional** `permalink`: A string containing the unique page URL that this form modifies."*
> — [`useActionState` · Parameters](https://react.dev/reference/react/useActionState#parameters)

**Returns**, verbatim:

> *"`useActionState` returns an array with exactly three values: 1. The current state. During the first render, it will match the `initialState` you passed. After `dispatchAction` is invoked, it will match the value returned by the `reducerAction`. 2. A `dispatchAction` function that you call inside Actions. 3. The `isPending` flag that tells you if any dispatched Actions for this Hook are pending."*
> — [`useActionState` · Returns](https://react.dev/reference/react/useActionState#returns)

The name the docs now use for the first argument — `reducerAction` — is the whole design in one word:

> *"The function passed to `useActionState` is called a *reducer action* because: It *reduces* the previous state into a new state, like `useReducer`. It's an *Action* because it's called inside a Transition and can perform side effects. Conceptually, `useActionState` is like `useReducer`, but you can do side effects in the reducer."*
> — [`useActionState` · Why is it called `reducerAction`?](https://react.dev/reference/react/useActionState#why-is-it-called-reduceraction)

That distinction is the one to keep straight against `useReducer`:

> *"**Use `useReducer`** to manage state of your UI. The reducer must be pure. · **Use `useActionState`** to manage state of your Actions. The reducer can perform side effects."*
> — [`useActionState` · How is `useActionState` different from `useReducer`?](https://react.dev/reference/react/useActionState#useactionstate-vs-usereducer)

## The `reducerAction` contract

```ts
async function reducerAction(previousState, actionPayload) {
  const newState = await post(actionPayload)
  return newState
}
```

- `previousState` — *"The last state. Initially this is equal to the `initialState`. After the first call to `dispatchAction`, it's equal to the last state returned."*
- `actionPayload` — optional, *"The argument passed to `dispatchAction`. It can be a value of any type."*
- The return value *"must match the type of `initialState`"*, and returning triggers a Transition to re-render with it.
- It *"is not invoked twice in `<StrictMode>` since `reducerAction` is designed to allow side effects"* — unlike a `useReducer` reducer, which is.
- With Server Functions, both `initialState` and `actionPayload` must be serialisable.

## With a `<form>`: the payload is the `FormData`

> *"You can pass the `dispatchAction` function as the `action` prop to a `<form>`. When used this way, React automatically wraps the submission in a Transition, so you don't need to call `startTransition` yourself. The `reducerAction` receives the previous state and the submitted `FormData`."*
> — [`useActionState` · Using with `<form>` Action props](https://react.dev/reference/react/useActionState#use-with-a-form)

```ts filename="app/tasks/actions.ts"
'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { updateTag } from 'next/cache'

const CreateTask = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title is too long'),
  assignee: z.email('Not a valid email').or(z.literal('')),
})

export type CreateTaskState = {
  errors: Partial<Record<'title' | 'assignee', string[]>>
  message: string | null
}

export async function createTask(
  previousState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const parsed = CreateTask.safeParse({
    title: formData.get('title'),
    assignee: formData.get('assignee'),
  })

  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      message: 'Fix the highlighted fields.',
    }
  }

  await db.task.create({ data: parsed.data })
  updateTag('board')
  return { errors: {}, message: 'Task created.' }
}
```

```tsx filename="app/tasks/create-task-form.tsx"
'use client'

import { useActionState } from 'react'
import { createTask, type CreateTaskState } from './actions'

const initialState: CreateTaskState = { errors: {}, message: null }

export function CreateTaskForm() {
  const [state, formAction, isPending] = useActionState(createTask, initialState)

  return (
    <form action={formAction}>
      <label htmlFor="title">Title</label>
      <input id="title" name="title" aria-describedby="title-error" />
      <p id="title-error" aria-live="polite">{state.errors.title?.join(', ')}</p>

      <label htmlFor="assignee">Assignee</label>
      <input id="assignee" name="assignee" aria-describedby="assignee-error" />
      <p id="assignee-error" aria-live="polite">{state.errors.assignee?.join(', ')}</p>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create task'}
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  )
}
```

This is the replacement for a form-state store. Validation errors, the success message and the pending flag are all one `useActionState` call; nothing is lifted, nothing is global, and the state is scoped to exactly the component that renders the form. Next.js documents the same shape:

> *"To display validation errors or messages, turn the component that defines the `<form>` into a Client Component and use React `useActionState`. When using `useActionState`, the Server function signature will change to receive a new `prevState` or `initialState` parameter as its first argument."*
> — [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms#validation-errors)

## Dispatching outside a form requires a Transition

`dispatchAction` is not a plain callback. The reference is explicit:

> *"`dispatchAction` must be called from an Action. You can wrap it in `startTransition`, or pass it to an Action prop. Calls outside that scope won't be treated as part of the Transition and log an error on development mode."*
> — [`useActionState` · Caveats](https://react.dev/reference/react/useActionState#caveats)

The development error text, quoted from the reference's troubleshooting section, is: `An async function with useActionState was called outside of a transition. This is likely not what you intended (for example, isPending will not update correctly). Either call the returned function inside startTransition, or pass it to an` `action` `or` `formAction` `prop.`

```tsx
'use client'

import { useActionState, startTransition } from 'react'
import { setStatus } from './actions'

export function StatusPicker({ taskId }: { taskId: string }) {
  const [state, dispatchStatus, isPending] = useActionState(setStatus, { status: 'todo' })

  function choose(next: string) {
    // ✅ inside a Transition: isPending updates, the action is ordered
    startTransition(() => {
      dispatchStatus({ taskId, next })
    })
  }

  return (
    <select value={state.status} disabled={isPending} onChange={(e) => choose(e.target.value)}>
      <option value="todo">To do</option>
      <option value="doing">Doing</option>
      <option value="done">Done</option>
    </select>
  )
}
```

The `<form action>` and `<button formAction>` props do the wrapping for you; a bare `onClick` does not.

## Gotchas

**★ Symptom: `formData.get('title')` returns `undefined`, or the action receives a `FormData`-shaped object where you expected a string.** Cause: the action still has the pre-`useActionState` signature. Wiring it through the hook prepends the previous state, so the form data has moved to the second parameter. The reference states it directly: *"the `reducerAction` receives an extra argument as its first argument: the previous or initial state. The submitted form data is therefore its second argument instead of its first."* Fix: add the first parameter.

```ts
// 🚩 Without useActionState
export async function createTask(formData: FormData) { /* … */ }

// ✅ With useActionState
export async function createTask(previousState: CreateTaskState, formData: FormData) { /* … */ }
```

**★ Symptom: `isPending` never becomes `true` when the action is triggered from a button click.** Cause: `dispatchAction` was called directly from the handler instead of inside a Transition, so React does not treat the work as part of one. Fix: wrap it.

```tsx
import { startTransition } from 'react'

function handleClick() {
  startTransition(() => {
    dispatchAction()
  })
}
```

**★ Symptom: TypeScript complains that the action's return type does not match the state type, and the state ends up `any`.** Cause: one branch of the `reducerAction` returns a differently-shaped object — a bare string on the error path, say. The reference: *"The return type of `reducerAction` must match the type of `initialState`. If TypeScript infers a mismatch, you may need to explicitly annotate your state type."* Fix: name the state type and annotate both ends.

```ts
export type CreateTaskState = { errors: Record<string, string[]>; message: string | null }

export async function createTask(
  previousState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> { /* every branch returns CreateTaskState */ }
```

**★ Symptom: "Cannot update action state while rendering", and the component loops.** Cause: `dispatchAction` was called in the component body. It schedules a state update, which re-renders, which calls it again. Fix: dispatch only from an event, a form action, or an effect.

```tsx
// 🚩 dispatchAction()            — during render
// ✅
<button onClick={() => startTransition(() => dispatchAction())}>Retry</button>
```

**★ Symptom: passing an `initialState` containing a class instance, a `Date` or a function throws when the action is a Server Function.** Cause: `initialState` crosses the RSC boundary and must be serialisable — *"values like plain objects, arrays, strings, and numbers"*. Fix: keep the state a plain object and convert at the edges.

```ts
const initialState = { errors: {}, message: null, createdAtIso: null as string | null }
```

**★ Symptom: a `useActionState` call inside a `.map()` over rows produces "Rendered more hooks than during the previous render".** Cause: it is a Hook, and *"you can only call it at the top level of your component or your own Hooks"*. Fix: extract the row into its own component so each row has its own hook.

```tsx
function TaskRow({ task }: { task: Task }) {
  const [state, dispatchAction, isPending] = useActionState(updateTask, { error: null })
  return <li>{/* … */}</li>
}
```

**★ Symptom: the state resets to `initialState` on a later render even though the action succeeded.** Cause: `initialState` is only read once — *"React ignores this argument after `dispatchAction` is invoked for the first time"* — so a reset means the component **remounted**, usually because a `key` above it changed or a parent conditionally re-created it. Fix: stabilise the key, or make the remount deliberate (which is itself a reset technique — see [06c](06c-reset-transitions-and-permalink.md)).

**★ Symptom: the action runs twice in development and creates two rows.** Cause: not `useActionState`. The reference is explicit that `reducerAction` *"is not invoked twice in `<StrictMode>` since `reducerAction` is designed to allow side effects"* — so a double write is a double dispatch (a submit handler that also calls the action, a nested `<button type="submit">` and an `onClick`), not Strict Mode. Fix: remove the second trigger; let the form action be the only path.

```tsx
// 🚩 <button type="submit" onClick={() => dispatchAction(payload)}>
// ✅ <button type="submit">   — the form's action prop dispatches
```

## Interview questions

**★ Why does the function passed to `useActionState` take the previous state as its first argument?**
Because it is a reducer that is allowed to have side effects. React queues dispatches and runs them in order, feeding each call the result of the previous one, which is what makes a sequence of actions composable — an "add to cart" action can read the count it produced last time rather than a stale closure. The cost of that design is the argument shift: when the dispatcher is used as a `<form action>`, the submitted `FormData` becomes the second parameter, and an action written before the hook was introduced silently receives the state where it expected the form data.

**★ How does `useActionState` differ from `useReducer`, given they look almost identical?**
The reducer's purity contract. `useReducer` is for UI state and its reducer must be pure — React may call it twice in Strict Mode precisely to catch impurity. `useActionState` is for the state of *actions*, so its reducer may be async and may perform side effects (post to a server, write to a database), and React does not double-invoke it in Strict Mode. It also returns a third value, `isPending`, and it orders dispatches sequentially so each call can see the previous result.

**★ Why do validation errors belong in `useActionState` rather than in a client store?**
Because they are the return value of one action for one form, and they have exactly that lifetime. Putting them in a store means deciding when to clear them, guarding against a second form writing over them, and keeping them out of the store's persisted slice. Returning them as state means React scopes them to the component, resets them when the component unmounts, and hands you `isPending` for free. The server action returns `{ errors, message }`; the form renders `state.errors.title`; there is no third place where the truth could differ.

**★ What happens if you call `dispatchAction` from a plain `onClick` handler?**
The action still runs, but it is not part of a Transition, so `isPending` will not update correctly and React logs a development error saying so. The fix is either `startTransition(() => dispatchAction(payload))` or passing the dispatcher to an Action prop — `<form action>`, `<button formAction>`, or a custom prop named `…Action` — which wraps it for you. This is the same rule `useOptimistic`'s setter obeys, and for the same reason: the Transition is what defines the pending window.

**Where does `initialState` actually get used, and why does that matter?**
Only on the first render, and as the `previousState` of the first dispatch. After that React ignores it entirely — *"React ignores this argument after `dispatchAction` is invoked for the first time"*. This matters because people try to reset a form by changing what they pass as `initialState` and nothing happens. It also means the value must be stable enough to be serialisable when the action is a Server Function, since it crosses the boundary as the first argument.

**Your form component needs to be a Client Component to use `useActionState`. Does that mean the page must be too?**
No, and this is the shape to reach for. Keep the page a Server Component that does the reads, and make only the component that owns the `<form>` a Client Component. Next.js's guide says exactly this — *"turn the component that defines the `<form>` into a Client Component"* — so the client boundary is the form, not the route. The Server Action itself stays on the server regardless, because it is defined in a `'use server'` module.

**Can a single component use `useActionState` for several different operations?**
Yes, in two ways, and they have different properties. Several separate `useActionState` calls give each operation its own state and its own `isPending`, which is what you want when they are unrelated. One call whose `actionPayload` carries a discriminant (`{ type: 'ADD' }` / `{ type: 'REMOVE' }`) gives you one state that all of them reduce into, and one queue — which is what you want when they mutate the same thing, because it guarantees ordering.

---

← [05f · RTK Query and Redux](05f-rtk-query-and-the-redux-question.md) · [Chapter 8 overview](01-explanation.md) · Next → [06b · Queuing and errors](06b-queuing-and-errors.md)
