---
title: "useActionState is a reducer over the network — each dispatch receives the previous call's return value as its first argument — and the caveat that decides your error strategy is that a dispatch which throws cancels every queued action and hands control to the nearest Error Boundary"
sidebar_label: "05d · The action hooks in depth"
sidebar_position: 23
description: "The useActionState signature and its full caveat list, why a thrown action reaches an Error Boundary and a returned one does not, refilling a form the automatic reset just cleared, the key-remount trick, useFormStatus versus the third tuple element, and optimistic list keys and rollback."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against React's [`useActionState`](https://react.dev/reference/react/useActionState) reference — signature, parameters, returns and the caveats list. Export surfaces **probed** on the installed packages: `react` **19.2.8** exports `useActionState` and `useOptimistic`; `react-dom` **19.2.8** exports `useFormStatus` and `useFormState`.
> Target: **Next.js 16.3.4**, React **19.2.8**, App Router, Node >= 20.9. Documentation-verified and probe-verified; **no sandbox run**.

**[01c](01c-server-action-hooks-optimistic-ui-and-security.md) establishes the three hooks and the two import-shaped bugs — `useFormStatus` comes from `react-dom`, and the dispatch `useActionState` hands you returns `void`. This page is what is underneath that. `useActionState` is not a state hook with a form attached; it is a **reducer over the network**: the function you pass receives the previous state as its first argument and its return value becomes the next state, and React queues concurrent dispatches so that each call receives the result of the previous one. Three consequences follow that nothing in a quick-start will tell you. A thrown action does not populate the state — it **cancels every queued action and shows the nearest Error Boundary**, which is why returning errors and throwing them are two entirely different product decisions. A `<form>` with an `action` prop resets automatically after submission, including after the submission you rejected, so the user's typing is gone unless the state carries it back. And `useOptimistic` reverts silently, which is a state-consistency mechanism and never an error message.**

## The signature, and the reducer that is hiding in it

```ts
const [state, dispatchAction, isPending] = useActionState(reducerAction, initialState, permalink?)
```

- **`reducerAction`** receives the **previous state** as its first argument — `initialState` on the first call, then its own previous return value — followed by the payload passed to `dispatchAction`.
- **`initialState`** is ignored after the first dispatch. When the action is a Server Function it must be **serializable** ([05c](05c-what-crosses-the-wire.md)).
- **`permalink`** is the pre-hydration navigation target, covered on [05b](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md).
- The return is **three** elements: the current state, a `dispatchAction` that returns `void`, and an `isPending` flag for any dispatched actions belonging to this hook.

The "previous state" parameter is what makes it a reducer, and React states the chaining explicitly: **multiple calls to the dispatch are queued and executed sequentially, and each call to the action receives the result of the previous call.** That is not a detail — it is the mechanism that lets a form accumulate rather than clobber:

```ts
// app/projects/actions.ts
'use server'

export type CreateState = {
  ok: boolean
  error: string | null
  fields: Record<string, string[]>
  values: { name: string; description: string }   // echoed back so the form can refill
  createdIds: string[]                            // accumulated ACROSS submissions
}

export async function createProject(prev: CreateState, formData: FormData): Promise<CreateState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
  }

  const session = await auth()
  if (!session?.user) {
    return { ...prev, ok: false, error: 'Please sign in.', fields: {}, values }
  }

  const parsed = CreateProject.safeParse(values)
  if (!parsed.success) {
    return {
      ...prev,
      ok: false,
      error: null,
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      values,
    }
  }

  const created = await db.project.create({
    data: { ...parsed.data, ownerId: session.user.id },
  })
  updateTag('projects')   // read-your-own-writes — see 01b

  return {
    ok: true,
    error: null,
    fields: {},
    values: { name: '', description: '' },
    createdIds: [...prev.createdIds, created.id],   // ← the previous state, used
  }
}
```

## Refilling the form the automatic reset just cleared

A `<form>` with an `action` prop **resets automatically after submission**, and React does not distinguish a rejection from a success — a returned error is an ordinary return value. So a validation failure clears the fields the user just filled in, and they type it all again to find out whether the rule is the same. The `values` field above exists for exactly that, and the client uses it as `defaultValue`:

```tsx
// components/CreateProjectForm.tsx
'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'          // 🔴 react-dom, not react
import { createProject, type CreateState } from '@/app/projects/actions'

const initialState: CreateState = {
  ok: false, error: null, fields: {}, values: { name: '', description: '' }, createdIds: [],
}

function SubmitButton() {
  const { pending } = useFormStatus()               // reads the ENCLOSING form
  return <button disabled={pending}>{pending ? 'Creating…' : 'Create project'}</button>
}

export function CreateProjectForm() {
  const [state, formAction, isPending] = useActionState(createProject, initialState)

  return (
    <form action={formAction}>
      <label>
        Name
        <input name="name" defaultValue={state.values.name} aria-invalid={Boolean(state.fields.name)} />
      </label>
      {state.fields.name?.map((m) => <p key={m} role="alert">{m}</p>)}

      <label>
        Description
        <textarea name="description" defaultValue={state.values.description} />
      </label>
      {state.fields.description?.map((m) => <p key={m} role="alert">{m}</p>)}

      {state.error && <p role="alert">{state.error}</p>}
      <SubmitButton />
      {isPending && <span className="sr-only">Saving…</span>}
    </form>
  )
}
```

The alternative React documents for a *deliberate* reset is a `key` prop on the component holding the hook, which forces a remount with fresh state — useful when "create another" should genuinely start clean rather than from the last values.

## 🔴 Thrown versus returned: two different products

This is the single caveat that should drive your error strategy, and it is easy to read past:

**If the dispatched action throws, React cancels all queued actions and shows the nearest Error Boundary.**

So the two error channels are not two spellings of the same thing:

| | Return an error | Throw |
|---|---|---|
| Where the user ends up | the same form, with a message beside the field | the nearest Error Boundary — in the App Router, `error.tsx` |
| Their typing | recoverable, if the state carries it | gone, along with the form |
| Other queued actions | unaffected | **cancelled** |
| Right for | validation, business rules, conflicts, "please sign in" | genuinely exceptional failures the user cannot act on |

An action that throws on a failed password check therefore blows away the login form and shows an error page — technically correct, and a terrible product. Return the failure. Reserve throwing for the case where continuing is meaningless, and understand that it takes the queue with it. [05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md) covers the full error strategy including `unauthorized()` and `forbidden()`.

## The rest of the caveats, with what each one costs

- **Top level only** — no loops, no conditions. If you need one per row, extract a component and move the hook into it. That is also the shape that makes the pending state per-row rather than per-page.
- **The dispatch has a stable identity**, so it is safe to omit from Effect dependency arrays; including it will not cause the Effect to re-fire.
- **The dispatch must be called from an Action** — wrap it in `startTransition` or pass it to an Action prop. Calls outside that scope are not treated as part of the transition and log an error in development ([05b](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md)).
- **Multiple ongoing Actions are batched together.** React documents this as a limitation that may be removed in a future release, which is a good reason not to build behaviour that depends on observing them separately.
- **`initialState` must be serializable** when the action is a Server Function — plain objects, arrays, strings, numbers ([05c](05c-what-crosses-the-wire.md)).

## `useFormStatus`, `useFormState`, and the third tuple element

Probed on the installed packages: `react` **19.2.8** exports `useActionState` and `useOptimistic` and **not** `useFormStatus`; `react-dom` **19.2.8** exports `useFormStatus` **and** `useFormState`. Three practical consequences.

**`useFormStatus` reads the enclosing form**, so it returns nothing useful in the component that renders `<form>` — it has to be a child. That constraint is the feature: a shared `SubmitButton` learns about whichever form it lands inside, with no prop drilling.

**`isPending` from `useActionState` covers most cases and costs nothing extra.** If the component that owns the tuple also renders the pending affordance, reach for the third element; `useFormStatus` earns its place only for a shared child that has no access to the tuple.

**`useFormState` still exists in `react-dom` 19.2.8** — it is the earlier name for what became `useActionState` in `react`. New code uses `useActionState`. ⚠️ The pages verified here do not document the rename or a deprecation timeline, so treat "still exported" as an observation about the installed package rather than a statement about its future.

## `useOptimistic`: keys, reducers and the silent rollback

The two overloads are on [01c](01c-server-action-hooks-optimistic-ui-and-security.md). What that page does not cover is what breaks in a **list**, which is where optimistic UI is actually used.

```tsx
'use client'
import { useOptimistic, startTransition } from 'react'
import { addComment } from './actions'

type Comment = { id: string; body: string; pending?: boolean }

export function CommentList({ postId, comments }: { postId: string; comments: Comment[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    comments,
    (current: Comment[], body: string): Comment[] => [
      ...current,
      // a stable temporary key: React needs one, and the real id does not exist yet
      { id: `optimistic-${body.length}-${current.length}`, body, pending: true },
    ],
  )

  async function submit(formData: FormData) {
    const body = String(formData.get('body') ?? '')
    addOptimistic(body)
    await addComment(postId, body)      // awaited INSIDE the action scope
  }

  return (
    <>
      <ul>
        {optimistic.map((c) => (
          <li key={c.id} style={{ opacity: c.pending ? 0.5 : 1 }}>{c.body}</li>
        ))}
      </ul>
      <form action={submit}>
        <textarea name="body" required />
        <button type="submit">Comment</button>
      </form>
    </>
  )
}
```

Three things that decide whether this works. The optimistic item needs a **key that does not collide** with a real one and does not change between renders — a `key` that changes remounts the node and loses focus and animation state. The `pending` flag is what makes the optimism *visible*, so the user can tell a posted comment from a posting one. And the server call is awaited **inside** the same action scope that applied the optimistic update, because that is what keeps the optimistic value owned until the real value lands; awaiting the `useActionState` dispatch instead awaits `undefined` and the value snaps back early ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)).

🔴 Rollback is silent by construction. The list reverts, the comment vanishes, and nothing says why. That is correct behaviour for a state-consistency mechanism and unacceptable as an error report — the reason has to come from the action's return value into a visible `role="alert"` region, which means an optimistic list almost always wants a `useActionState` beside it rather than instead of it.

## Which hook answers which question

| Question | Hook | Where it lives |
|---|---|---|
| What did the action return, and is it running? | `useActionState` | `react` |
| Is the form I am *inside* submitting? | `useFormStatus` | `react-dom` |
| What should the screen say before the server replies? | `useOptimistic` | `react` |

Reaching for all three by default is how a twelve-line form becomes a sixty-line one. Start with `useActionState`; add `useFormStatus` when a shared child needs status it cannot receive; add `useOptimistic` only when the round trip is long enough to feel and the outcome is predictable enough that guessing is honest.

## Gotchas

**★ Symptom: an action throws on a bad password and the whole login page is replaced by an error screen.** Cause: a dispatched action that throws cancels all queued actions and shows the nearest Error Boundary — in the App Router, the segment's `error.tsx`. Fix: return the failure as state and render it beside the field.

```ts
if (!user) return { ...prev, ok: false, error: 'Email or password is incorrect.', values }
```

**★ Symptom: a validation failure clears every field the user filled in.** Cause: a `<form>` with an `action` prop resets automatically after submission, and React does not treat a returned error differently from a success. Fix: echo the submitted values in the returned state and use them as `defaultValue`, as in `CreateProjectForm` above.

**★ Symptom: a "create another" flow keeps the previous entry's values.** Cause: the same mechanism working correctly — the state is preserved and you are refilling from it. Fix: reset deliberately with a `key` on the component that owns the hook, which forces a remount with fresh state.

```tsx
<CreateProjectForm key={formGeneration} />
```

**★ Symptom: `useActionState` is called inside a `.map()` over rows and React complains about hook order.** Cause: hooks must be called at the top level of a component, never in loops or conditions. Fix: extract a `<ProjectRow>` component and move the hook into it — which also gives each row its own `isPending` instead of one shared flag.

**★ Symptom: the action's first parameter is `undefined` and the payload is in the wrong position.** Cause: the action passed to `useActionState` receives the **previous state** first and the payload second; a plain `(formData: FormData) => …` signature silently receives the state as `formData`. Fix: `(prev: State, formData: FormData) => Promise<State>`, and put an explicit return type on it so the shape cannot drift.

**★ Symptom: an action dispatched from an event handler logs a development error about being called outside a transition.** Cause: the dispatch must be called from an Action — wrapped in `startTransition` or passed to an Action prop. Fix: wrap it. A form's `action` and a button's `formAction` do this for you; an `onClick` does not.

**★ Symptom: an optimistic list item loses focus, or its animation restarts, on every keystroke elsewhere.** Cause: the temporary key is derived from something that changes between renders, so React remounts the node. Fix: derive the key from something stable for the lifetime of that optimistic entry, and never from an index that shifts when the real item arrives.

**★ Symptom: an optimistic comment appears, disappears, and reappears.** Cause: the optimistic update and the server's re-rendered payload are two separate commits and the optimistic scope ended before the payload arrived. Fix: keep the optimistic update and the awaited server call inside the same action scope, so the optimistic value is still owned when the real value lands ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)).

**★ Symptom: a failed optimistic update reverts and the user believes it worked, then does not.** Cause: rollback is silent by design — it is a state-consistency mechanism, not an error report. Fix: pair `useOptimistic` with a `useActionState` whose returned error feeds a visible `role="alert"` region; the optimistic layer undoes, the state layer explains.

**★ Symptom: `useFormStatus` is imported from `react` and the module has no such export.** Cause: it lives in `react-dom` — probing the installed 19.2.8 packages, `react` exports `useActionState` and `useOptimistic`, and `react-dom` exports `useFormStatus` and `useFormState`. Fix: import from `react-dom`, and call it from a **child** of the form, because it reads the enclosing form through context.

**Symptom: `useFormStatus` was added and duplicates state the component already had.** Cause: `useActionState` returns `isPending` as its third element and half the codebases that reach for `useFormStatus` never destructured it. Fix: use `isPending` when the affordance lives in the same component as the tuple; reserve `useFormStatus` for a shared child.

**Symptom: `useFormState` is found in `react-dom` and someone concludes it is the current API.** Cause: `react-dom` 19.2.8 still exports it — it is the earlier name for what became `useActionState` in `react`. Fix: write new code against `useActionState`. The pages verified here do not document the rename or a removal timeline, so treat its continued presence as an observation rather than a guarantee.

**Symptom: the dispatch is added to a `useEffect` dependency array and a reviewer objects.** Cause: neither position is wrong — the dispatch has a stable identity, so including it will not cause the Effect to fire and omitting it is safe. Fix: follow whatever the linter accepts, and do not spend review time on it.

**Symptom: `initialState` is a class instance and the first render behaves oddly.** Cause: when the action is a Server Function, `initialState` must be serializable — plain objects, arrays, strings, numbers. Fix: make it a plain object literal, which it should be anyway, since it is the same shape the action returns.

## Interview questions

**★ Why is `useActionState` better described as a reducer than as a state hook?**
Because the function you give it receives the **previous state** as its first argument and its return value becomes the next state — exactly the reducer signature, with the reduction happening on the server. React also documents that multiple dispatch calls are queued and executed sequentially and that each call receives the result of the previous call, so the chaining is guaranteed rather than incidental. That is what lets a form accumulate across submissions — a list of created ids, a retry count, the last-submitted values — instead of each submission starting from nothing.

**★ What happens if a dispatched action throws, and why does that decide your error strategy?**
React cancels all queued actions and shows the nearest Error Boundary. So throwing is not "returning an error the hard way" — it takes the user off the form entirely, into `error.tsx`, along with any queued work, and their typing goes with it. Returning an error keeps them on the form with a message beside the offending field. The rule that follows is that validation failures, business rules, conflicts and "please sign in" are all *returned*, and throwing is reserved for failures where continuing is meaningless.

**★ A validation failure clears the form. Why, and what is the fix?**
Because a `<form>` with an `action` prop resets automatically after submission, and a returned error is an ordinary return value — React has no way to know you consider that submission a failure. The fix is to echo the submitted values back in the action's returned state and bind them as the inputs' `defaultValue`, so a rejected submission refills the form it just cleared. React's documented alternative, a `key` on the component to force a remount with fresh state, is the tool for the opposite requirement: deliberately starting clean.

**★ Your action's first parameter keeps receiving something that is not the form data. What is wrong?**
The signature. An action used with `useActionState` receives the previous state first and the payload second, so a function declared as `(formData: FormData) => …` gets the state where it expected the form and everything downstream reads `undefined` off it. It type-checks in JavaScript and in loosely typed TypeScript, which is why it survives to runtime. Declaring `(prev: State, formData: FormData) => Promise<State>` with an explicit return type makes both ends of the contract enforceable.

**★ When does `useFormStatus` earn its place over `isPending`?**
Only when the component that needs the pending state cannot see the tuple. `useActionState` returns `isPending` as its third element, which covers any component that owns the form. `useFormStatus` reads the *enclosing* form through context — which is why it returns nothing useful in the component that renders `<form>` and must be called from a child — and that constraint is exactly its value: a shared `SubmitButton` in a design system knows about whichever form it happens to land inside, with no prop drilling and no props at all.

**★ `useOptimistic` reverts automatically on failure. Why is that not enough?**
Because a value that silently returns to its previous state tells the user nothing. The comment they wrote disappears and no part of the UI says why — they will assume a rendering glitch and try again. The rollback is a state-consistency mechanism, not an error-reporting one, so the reason has to come from somewhere else: the action's return value, surfaced through `useActionState` into a visible `role="alert"` region. In practice that means an optimistic list almost always wants both hooks, not one.

**★ What makes an optimistic *list* harder than an optimistic counter?**
Keys. A counter has no identity to invent; a list item does, and the real id does not exist yet. The temporary key has to be unique against the real items, stable for the lifetime of the optimistic entry — a key that changes between renders remounts the node and destroys focus and animation state — and gone cleanly when the server's version arrives. The second difference is that a list wants the optimistic entry to *look* provisional, because a pending item styled identically to a committed one is a lie the user cannot see through.

**Why must an optimistic update and the server call live inside the same action scope?**
Because the optimistic value is owned by that scope, and when the scope ends the value returns to the passthrough state. If you apply the optimistic update and then await the `useActionState` dispatch — which returns `void` — the await resolves immediately, the scope ends, and the value snaps back before the server has replied. Awaiting the **server function** inside the same inline action keeps the scope alive until the real value lands, which is the difference between one commit and a visible flicker.

---

← [05c · What crosses the wire](05c-what-crosses-the-wire.md) · [Chapter 4 overview](01-explanation.md) · Next → [05e · Errors, authorization and choosing a Route Handler](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)
