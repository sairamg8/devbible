---
title: "There are four different sources of a pending flag and they are not interchangeable — useActionState owns the form, useFormStatus owns the parent form from inside it, useTransition owns the hook, and only a per-item flag in an optimistic reducer owns a single row"
sidebar_label: "06f · Pending feedback"
sidebar_position: 41
description: "Combining useOptimistic with useActionState, the three documented ways to detect a pending optimistic update, and useFormStatus — its return shape, its react-dom import, and the parent-form rule."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the React reference —
> [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus),
> [`useOptimistic`](https://react.dev/reference/react/useOptimistic) and
> [`useActionState`](https://react.dev/reference/react/useActionState) — and the Next.js
> [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) guide
> (`lastUpdated: 2026-08-25`). React reference text read from the react.dev source
> (`reactjs/react.dev`).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**"Is it saving?" has four different correct answers in React 19, and picking the wrong one produces UI that is not wrong so much as wrongly scoped: a spinner on every row when one is saving, or a submit button that needs its `isPending` threaded down three components. `useActionState` gives you the flag for the action state it owns. `useFormStatus` gives you the nearest *parent* `<form>`'s status, which is what makes a reusable submit button possible — and returns `false` forever if you call it in the component that renders the form. `useTransition` gives you the flag for one Transition. And only a `pending` flag set inside an optimistic reducer belongs to an individual item.**

## Combining `useOptimistic` with `useActionState`

The two compose directly: the action state is the truth, the optimistic value is the projection while the queue drains.

```tsx
const [count, dispatchAction, isPending] = useActionState(updateCartAction, 0)
const [optimisticCount, setOptimisticCount] = useOptimistic(count)

async function formAction(formData: FormData) {
  const type = formData.get('type')
  if (type === 'ADD') {
    setOptimisticCount((c) => c + 1)
  } else {
    setOptimisticCount((c) => Math.max(0, c - 1))
  }
  return dispatchAction(formData)
}
```

```tsx
<form action={formAction}>
  <span>{isPending && '🌀'}</span>
  <span>{optimisticCount}</span>
  <button type="submit" name="type" value="ADD">▲</button>
  <button type="submit" name="type" value="REMOVE">▼</button>
</form>
```

`formAction` is passed to `<form action>`, so React wraps it in a Transition and the optimistic setter is legal without an explicit `startTransition`. This is the documented answer to `useActionState`'s sequential queue ([06b](06b-queuing-and-errors.md)): four clicks still take four round trips, but the number on screen moves four times immediately.

Note which value each element reads. The stepper shows `optimisticCount` because that is what the user is manipulating; a running total elsewhere in the page would read `count`, the value the server has actually acknowledged. Rendering `count` in the stepper is the bug that makes optimistic UI look broken.

## The three ways to know an optimistic update is pending

> *"To know when `useOptimistic` is pending, you have three options: 1. **Check if `optimisticValue === value`** … If the values are not equal, there's a Transition in progress. 2. **Add a `useTransition`** … Since `useTransition` uses `useOptimistic` for `isPending` under the hood, this is equivalent to option 1. 3. **Add a `pending` flag in your reducer** … Since each optimistic item has its own flag, you can show loading state for individual items."*
> — [`useOptimistic` · I don't know if my optimistic update is pending](https://react.dev/reference/react/useOptimistic#i-dont-know-if-my-optimistic-update-is-pending)

```tsx
// 1 — no extra hook
const [optimistic, setOptimistic] = useOptimistic(value)
const isPending = optimistic !== value

// 2 — equivalent, and gives you a startTransition to use
const [isPending, startTransition] = useTransition()

// 3 — per-item pending, which is what a list actually needs
const [optimistic, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, { ...newItem, isPending: true }],
)
```

Options 1 and 2 give one flag for the whole hook. Option 3 gives one per row, which is the only one of the three that can answer "is *this* item saving" when three rows are in flight at once.

## `useFormStatus`: the status of the *parent* form

```js
const { pending, data, method, action } = useFormStatus();
```

> *"`pending`: A boolean. If `true`, this means the parent `<form>` is pending submission. Otherwise, `false`."*
>
> *"`data`: An object implementing the `FormData interface` that contains the data the parent `<form>` is submitting. If there is no active submission or no parent `<form>`, it will be `null`."*
>
> *"`method`: A string value of either `'get'` or `'post'`. This represents whether the parent `<form>` is submitting with either a `GET` or `POST` HTTP method."*
>
> *"`action`: A reference to the function passed to the `action` prop on the parent `<form>`. If there is no parent `<form>`, the property is `null`. If there is a URI value provided to the `action` prop, or no `action` prop specified, `status.action` will be `null`."*
> — [`useFormStatus` · Returns](https://react.dev/reference/react-dom/hooks/useFormStatus#returns)

🔴 The caveats are the whole reason this hook confuses people:

> *"The `useFormStatus` Hook must be called from a component that is rendered inside a `<form>`. · `useFormStatus` will only return status information for a parent `<form>`. It will not return status information for any `<form>` rendered in that same component or children components."*
> — [`useFormStatus` · Caveats](https://react.dev/reference/react-dom/hooks/useFormStatus#caveats)

And the troubleshooting entry says the same thing from the symptom end: *"If the component that calls `useFormStatus` is not nested in a `<form>`, `status.pending` will always return `false`."*

```tsx filename="app/ui/submit-button.tsx"
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? `${label}…` : label}
    </button>
  )
}
```

```tsx filename="app/ui/signup.tsx"
import { SubmitButton } from './submit-button'
import { createUser } from '@/app/actions'

export function Signup() {
  return (
    <form action={createUser}>
      {/* Other form elements */}
      <SubmitButton label="Sign up" />
    </form>
  )
}
```

Two details that catch people. The import is from **`react-dom`**, not `react` — it is a DOM-specific hook, alongside the other `react-dom` hooks. And ⚠️ a version note from the Next.js guide, worth remembering when reading older code: *"In React 19, `useFormStatus` includes additional keys on the returned object, like data, method, and action. If you are not using React 19, only the `pending` key is available."*

The `data` key is more useful than it looks: because it is the `FormData` being submitted, a child of the form can render what is being saved without any of it being lifted into state.

```tsx
'use client'

import { useFormStatus } from 'react-dom'

export function PendingPreview() {
  const { pending, data } = useFormStatus()
  if (!pending || !data) return null
  return <p aria-live="polite">Saving “{String(data.get('title'))}”…</p>
}
```

## Choosing between the four

| Source | Scope | Reach for it when |
|---|---|---|
| `useActionState`'s `isPending` | Every dispatch of that hook | The component already owns the action state and the errors |
| `useFormStatus().pending` | The nearest **parent** `<form>` | A reusable child — a design-system button, a footer spinner — must work in any form with no props |
| `useTransition`'s `isPending` | One Transition | You needed `startTransition` anyway for a non-form trigger |
| `pending` flag in an optimistic reducer | One item | Several rows can be in flight and each needs its own indicator |

## Gotchas

**★ Symptom: `status.pending` is always `false`.** Cause: `useFormStatus` was called in the component that *renders* the form, not in a child of it — the hook only reports on a parent `<form>`. Fix: extract the button.

```tsx
// 🚩 function Signup() { const { pending } = useFormStatus(); return <form action={createUser}>…</form> }
// ✅
function SubmitButton() { const { pending } = useFormStatus(); return <button disabled={pending}>Save</button> }
function Signup() { return <form action={createUser}><SubmitButton /></form> }
```

**★ Symptom: `useFormStatus` is not exported from `react`.** Cause: it lives in `react-dom`, with the other DOM-specific hooks. Fix: change the import.

```tsx
import { useFormStatus } from 'react-dom'
```

**★ Symptom: a spinner shows on every row in the list while only one is being saved.** Cause: a single hook-wide pending flag (`optimistic !== value`, or `useTransition`'s `isPending`) is driving per-row UI. Fix: put the flag on the item, in the reducer.

```tsx
const [optimistic, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, { ...newItem, isPending: true }],
)
```

**★ Symptom: a reusable submit button needs `isPending` passed down through three components.** Cause: the pending state was taken from `useActionState` in the form's owner. Fix: read it where it is needed, from the form itself.

```tsx
'use client'
import { useFormStatus } from 'react-dom'

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending}>{pending ? `${label}…` : label}</button>
}
```

**★ Symptom: the stepper number does not move until the server responds, even though `useOptimistic` is wired up.** Cause: the element renders the action state (`count`) instead of the optimistic value. Fix: render the optimistic value where the user is interacting, and the acknowledged value where correctness matters more than immediacy.

```tsx
<span className="qty">{optimisticCount}</span>   {/* the control the user is clicking */}
<Total quantity={count} isPending={isPending} /> {/* the number that must be right */}
```

**★ Symptom: `useFormStatus` in a component that itself renders a `<form>` reports on the wrong form, or on none.** Cause: the hook deliberately ignores forms rendered by the same component or by its children — it looks only upward. Fix: move the hook into a component that is a descendant of the form you care about.

```tsx
// 🚩 <Panel>  reads useFormStatus and renders <form>
// ✅ <Panel> renders <form><Status /></form>, and <Status /> reads it
```

**★ Symptom: a `data`-driven preview crashes with "cannot read property of null".** Cause: `data` is `null` when there is no active submission or no parent form, and the component rendered before checking. Fix: guard on both.

```tsx
const { pending, data } = useFormStatus()
if (!pending || !data) return null
```

## Interview questions

**★ Why must `useFormStatus` be read from a child of the `<form>` rather than from the component that renders it?**
Because it reports on the nearest **parent** `<form>` in the tree, and a component is not its own descendant. The reference states both halves: the hook must be called from a component rendered inside a form, and it will not return status for a form rendered in that same component or in its children. The practical consequence is structural — the submit button becomes its own component. That is not a workaround; it is what makes the button reusable in any form without a prop, which is the reason the hook is shaped this way.

**★ Give three ways to know an optimistic update is in flight, and say when each is right.**
Compare `optimisticValue !== value`, which needs no extra hook and works for a single projected value. Add a `useTransition` and use its `isPending` — the reference notes this is equivalent to the first, since `useTransition` uses `useOptimistic` under the hood — and take it when you needed `startTransition` anyway. Or set a `pending` flag on each item inside the optimistic reducer, which is the only one of the three that distinguishes *which* item is pending, and therefore the right choice for a list where several rows can be in flight at once.

**★ When would you use `useFormStatus` rather than the `isPending` from `useActionState`?**
When the component that needs the flag is not the component that owns the action state. A design-system submit button, a spinner in a footer, a fieldset that disables itself while saving: all of them can read `useFormStatus` and work in any form, with no props and no knowledge of the action. `useActionState`'s `isPending` is the right source when the same component already holds the state and the errors, which is the common case for a bespoke form. `useOptimistic` is the right source when the pending state belongs to a single row rather than to the form as a whole.

**★ In the combined `useActionState` + `useOptimistic` cart example, what is each hook responsible for?**
`useActionState` owns the truth and the ordering: it queues dispatches, feeds each the previous count, and exposes `isPending` for the whole sequence. `useOptimistic` owns the projection: it renders count + 1 immediately so the user is not waiting on a serial queue. When the last dispatch resolves, the real count and the optimistic count converge in one commit. Remove the optimistic hook and the UI is correct but sluggish; remove the action state and the count has no authoritative source to converge onto.

**What is `useFormStatus().data` for, and why is it more than a curiosity?**
It is the `FormData` currently being submitted by the parent form, which means a descendant can render *what* is being saved without any of it being lifted into React state — "Saving 'Ship the release notes'…" beside a spinner, from a component that receives no props. It is `null` when there is no active submission or no parent form, so it always needs a guard. Together with `method` and `action` it makes the hook a read-only view of the submission itself, not merely a boolean.

**Someone renders the acknowledged `count` in the stepper and the optimistic one in the total. What breaks?**
The interaction feels dead and the total lies. The control the user is clicking should show the value they are producing — that is the entire purpose of the optimistic projection — while a figure that must be correct, such as a price, should show the value the server has acknowledged, possibly annotated with `isPending`. Swapping them gives you a stepper that does not respond until the round trip finishes and a total that briefly shows a number nobody has charged.

---

← [06e · Optimistic patterns](06e-optimistic-patterns-and-pending-feedback.md) · [Chapter 8 overview](01-explanation.md) · Next → [06g · Where the framework hooks stop](06g-where-the-framework-hooks-stop.md)
