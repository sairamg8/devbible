---
title: "Everything around the edges of a form — clearing it after success, closing the dialog on the same frame as the list updates, and surviving a submit that happens before hydration — is three separate mechanisms, and none of them is a method on the hook"
sidebar_label: "06c · Reset, transitions, permalink"
sidebar_position: 146
description: "The three ways to reset useActionState, why a state update after an await needs its own startTransition, and what the permalink argument does for progressive enhancement."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the React reference — [`useActionState`](https://react.dev/reference/react/useActionState)
> and [`useTransition`](https://react.dev/reference/react/useTransition) — and the Next.js
> [Building interactive apps](https://nextjs.org/docs/app/guides/interactive-apps) guide
> (`lastUpdated: 2026-08-25`). React reference text read from the react.dev source
> (`reactjs/react.dev`, `src/content/reference/react/useActionState.md`).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**A form is not finished when the action returns. The fields have to clear, the dialog has to close on the same frame the list behind it updates, and a submission that arrives before the JavaScript does still has to land somewhere. React handles none of these for you automatically, and each has a distinct mechanism: a reset signal or a `key`, a `startTransition` around post-`await` state updates, and the `permalink` third argument. The middle one is the least obvious and produces the most visible defect — a dialog that closes one frame early, which reviewers describe as "feels janky" and nobody can attribute.**

## There is no reset function

> *"`useActionState` doesn't provide a built-in reset function. To reset the state, you can design your `reducerAction` to handle a reset signal … Alternatively, you can add a `key` prop to the component using `useActionState` to force it to remount with fresh state, or a `<form>` `action` prop, which resets automatically after submission."*
> — [`useActionState` · My state doesn't reset](https://react.dev/reference/react/useActionState#reset-state)

**Technique 1 — a reset payload.** The reducer recognises a sentinel:

```ts
const initialState = { name: '', error: null }

async function formAction(prevState, payload) {
  if (payload === null) return initialState     // the reset signal
  return await submitData(payload)
}
```

```tsx
function handleReset() {
  startTransition(() => dispatchAction(null))
}
```

Right when the state must go back but the component should not remount — a "clear filters" button that leaves focus and scroll where they are.

**Technique 2 — remount by key.** Note carefully what is keyed: not the component holding the hook, but a wrapper around the inputs, with the key held *in* the action state. The hook's own state and its `isPending` survive; the DOM fields reset. This is Next.js's documented pattern:

```tsx filename="features/task/components/create-task-modal.tsx"
'use client'

import { useActionState, startTransition, useState } from 'react'
import { createTask } from '@/features/task/task-actions'

export function CreateTaskModal() {
  const [isOpen, setIsOpen] = useState(false)

  const [{ key }, formAction, isPending] = useActionState(
    async (prev, formData) => {
      const title = String(formData.get('title'))
      if (!title.trim()) return prev

      await createTask({
        title,
        description: String(formData.get('description')),
        status: 'todo',
        priority: 'medium',
      })

      startTransition(() => setIsOpen(false))
      return { key: prev.key + 1 }
    },
    { key: 0 },
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <form action={formAction}>
        <div key={key}>
          <input name="title" placeholder="Task title..." required />
          <input name="description" placeholder="Describe the task..." />
        </div>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </Dialog>
  )
}
```

> *"The `key` in the returned state controls form reset. On success, `key` increments, which remounts the `<div key={key}>` and resets every input inside it."*
> — [Building interactive apps · Step 6](https://nextjs.org/docs/app/guides/interactive-apps)

**Technique 3 — let the form do it.** An uncontrolled `<form action={formAction}>` resets its fields automatically after a successful submission. Reach for techniques 1 or 2 only when the inputs are controlled, or when the *state* rather than the DOM has to go back.

## 🔴 State updates after an `await` are not in the Transition

In the example above, `startTransition(() => setIsOpen(false))` looks redundant — the action already runs inside a Transition. It is not redundant.

> *"If you set state after `await` in the `reducerAction` you currently need to wrap the state update in an additional `startTransition`."*
> — [`useActionState` · `reducerAction` caveats](https://react.dev/reference/react/useActionState#reduceraction-caveats)

Next.js documents the visible consequence in full:

> *"`useActionState` runs the action as a transition, so the dialog stays open and `isPending` stays `true` while `createTask` runs. State updates after the `await` aren't automatically part of that transition, so wrapping `setIsOpen(false)` in `startTransition` runs the close as part of the transition. With that wrap in place, React batches the dialog close with the board update that `refresh()` triggers inside `createTask`, so the new task appears at the moment the dialog closes. Without it, the dialog closes first and the board updates a frame later."*
> — [Building interactive apps · Step 6](https://nextjs.org/docs/app/guides/interactive-apps)

> **Good to know from the same guide:** *"This limitation is documented in React under 'React doesn't treat my state update after `await` as a transition'. Until it's fixed, wrapping post-`await` state updates in `startTransition` is the recommended workaround."*

The rule is narrow and worth stating exactly: it applies to **React state updates**, not to side effects generally.

```tsx
await createTask({ title })

startTransition(() => setIsOpen(false))   // React state: needs the wrap
toast.success('Task created')             // not React state: does not
analytics.track('task_created')           // not React state: does not
inputRef.current?.focus()                 // not React state: does not
```

Next.js says the same: *"Side effects that don't affect rendered state, such as analytics, toasts, and focus changes, run after the `await` resolves. They don't need a transition because they don't update React state."*

Note also what the action's own response is doing on the other side of this. The `createTask` action calls [`refresh()`](10-refresh.md), so Next.js re-renders the route and ships a fresh RSC payload inside the action's response. The wrap is what lets the dialog close *commit with* that payload rather than a frame ahead of it.

## The third argument: `permalink`

> *"**optional** `permalink`: A string containing the unique page URL that this form modifies. For use on pages with React Server Components with progressive enhancement. If `reducerAction` is a Server Function and the form is submitted before the JavaScript bundle loads, the browser will navigate to the specified permalink URL rather than the current page's URL."*
> — [`useActionState` · Parameters](https://react.dev/reference/react/useActionState#parameters)

This is a pre-hydration feature and nothing else. A user on a slow connection submits before React has hydrated; the browser performs a native form POST; the response has to render somewhere, and `permalink` says where.

> *"When using the `permalink` option, ensure the same form component is rendered on the destination page (including the same `reducerAction` and `permalink`) so React knows how to pass the state through. Once the page becomes interactive, this parameter has no effect."*
> — [`useActionState` · Caveats](https://react.dev/reference/react/useActionState#caveats)

```tsx
const [state, formAction] = useActionState(
  subscribe,
  { message: null },
  '/newsletter',   // the same form must render at /newsletter, with the same action
)
```

Three consequences worth holding on to:

- It only matters for forms whose action is a **Server Function**. A client-side action cannot run before the bundle loads at all.
- It is inert after hydration, so you cannot test it by clicking around a warm page.
- If the destination does not render the same form with the same action and the same permalink, the returned state has nowhere to land, and the degradation is silent — the user sees the page, without the message.

## Gotchas

**★ Symptom: the form fields keep their values after a successful submit.** Cause: the inputs are controlled, or the state that drives them did not change, so nothing told React to re-create them. Fix: return an incrementing key and remount the field wrapper with it.

```tsx
const [{ key }, formAction] = useActionState(async (prev, formData) => {
  await createTask(formData)
  return { key: prev.key + 1 }
}, { key: 0 })

return <form action={formAction}><div key={key}><input name="title" /></div></form>
```

**★ Symptom: changing the value passed as `initialState` does not reset the state.** Cause: `initialState` is read once; React ignores it after the first dispatch. Fix: dispatch an explicit reset signal the reducer understands.

```ts
async function formAction(prevState, payload) {
  if (payload === null) return initialState
  return await submitData(payload)
}
// startTransition(() => dispatchAction(null))
```

**★ Symptom: putting the `key` on the component that calls `useActionState` clears the error message you wanted to keep, and `isPending` flickers.** Cause: remounting the component destroys the hook's state along with the DOM fields. Fix: key only the wrapper around the inputs, and hold the key in the action state so it is the action that decides when to reset.

```tsx
<form action={formAction}>
  <div key={key}><input name="title" /></div>
  <p aria-live="polite">{state.message}</p>   {/* survives the reset */}
</form>
```

**★ Symptom: a dialog closes a frame before the list behind it updates, producing a visible flash.** Cause: `setIsOpen(false)` ran after an `await` inside the action, so it was not part of the Transition and could not be batched with the re-render the action's response carried. Fix: wrap the post-`await` state update.

```tsx
await createTask(data)
startTransition(() => setIsOpen(false))
```

**★ Symptom: wrapping a toast in `startTransition` after the `await` changes nothing, or makes the code read as though it might.** Cause: the workaround applies to React state updates only; a toast, an analytics call and a `focus()` are not state. Fix: leave them unwrapped, and keep the wrap on the actual `setState`.

```tsx
await createTask(data)
startTransition(() => setIsOpen(false))   // state
toast.success('Task created')             // not state — no wrap
```

**★ Symptom: with JavaScript disabled or before hydration, submitting the form lands on a page with no message.** Cause: no `permalink`, so the native POST resolves against the current URL and the returned state has nowhere to be rendered. Fix: pass the permalink and render the same form, with the same action and the same permalink, at that URL.

```tsx
const [state, formAction] = useActionState(subscribe, { message: null }, '/newsletter')
```

**★ Symptom: `permalink` is set but appears to do nothing when tested.** Cause: it is inert once the page is interactive, so any test performed by clicking around a hydrated page will see no effect. Fix: exercise the pre-hydration path — submit before the bundle loads (a throttled connection or a JavaScript-disabled load), which is the only condition the argument applies to.

## Interview questions

**★ There is no reset function. Give three ways to reset, and say when each is right.**
First, a reset payload: the reducer recognises a sentinel (often `null`) and returns `initialState`. Right when the state must go back but the component should not remount, so focus and scroll are preserved. Second, a `key` — either on the component holding the hook, to remount everything, or, as Next.js does, on a wrapper around the inputs with the key held *in* the action state, so the DOM fields reset while the hook's own state and `isPending` survive. Third, do nothing: an uncontrolled `<form action>` resets its fields automatically after a successful submission, so the other two are only needed for controlled inputs or for state that outlives the DOM.

**★ Why does `startTransition` need to wrap a `setState` that runs after an `await` inside an action?**
Because React currently does not carry the Transition across the `await` boundary — the documented limitation is "React doesn't treat my state update after `await` as a transition". The visible consequence is that the post-`await` update commits on its own frame instead of being batched with the re-render the action produces, so a dialog closes one frame before the list behind it updates. Wrapping the update in `startTransition` puts it back into the transition and the two commit together. It applies to React state only; toasts, analytics and focus changes are not state and need no wrap.

**★ What is the `permalink` argument actually for?**
Progressive enhancement before hydration, and nothing else. If a user submits a form built on a Server Function before the JavaScript has loaded, the browser does a native form POST and the response has to render somewhere; `permalink` names the URL the browser navigates to instead of the current one. It only works if the destination renders the same form component with the same `reducerAction` and the same `permalink`, so React can pass the state through, and once the page is interactive the argument has no effect at all — which also means you cannot verify it by clicking around a warm page.

**Why is the `key` placed on a wrapper around the inputs rather than on the component that owns the hook?**
Because they reset different things. Keying the component remounts the hook, which throws away the action state — the success message, the error, and `isPending` — along with the DOM. Keying a wrapper inside the form resets only the uncontrolled inputs, so the form can show "Task created" beside empty fields. Holding the key *in* the action state completes the pattern: the reset is decided by the action returning a new key on success, so a failed submission leaves the user's typing intact.

**Where does the re-render that follows a successful action come from, in the Next.js case?**
From the action's own HTTP response. When the Server Action calls `refresh()`, `updateTag` or `revalidatePath`, Next.js re-renders the current route server-side and includes the new RSC payload in the same response, so no follow-up fetch is needed. That is why the post-`await` transition wrap matters visually: with it, the client state change and the newly arrived payload commit together; without it, the client change lands first and the server-rendered content follows a frame later.

**A reviewer says the dialog "feels janky" but cannot say why. What do you look for first?**
A `setState` after an `await` inside a `useActionState` action, without a `startTransition` around it. It is the highest-frequency cause of a one-frame mismatch between a client-side UI change and the server-rendered content that arrives with the action's response, and it produces exactly the "closes then updates" impression that people describe as jank without being able to name.

---

← [06b · Queuing and errors](06b-queuing-and-errors.md) · [Chapter 8 overview](01-explanation.md) · Next → [06d · useOptimistic](06d-useoptimistic.md)
