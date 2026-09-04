---
title: "The action's return value is the form's error API, so design it as a discriminated union keyed by field name — and know which zod formatter throws away the information you need"
sidebar_label: "02c · Field errors the form can render"
sidebar_position: 8
description: "The state shape useActionState wants, why flattenError loses array indices and treeifyError does not, why a ZodError cannot cross the boundary, re-populating a form without echoing a password, and the ARIA wiring that makes the error audible."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`), Zod's [Formatting errors](https://zod.dev/error-formatting), the React reference for [`useActionState`](https://react.dev/reference/react/useActionState) and [`'use client'`](https://react.dev/reference/rsc/use-client). Formatter output shapes are quoted from Zod's documentation; the surface was **probed on the installed package** (`zod` **4.4.3**).
> Target: **Next.js 16.3.4 · React 19.2.8 · zod 4.4.3**. Documentation-verified; **no sandbox run**.

**Chapter 08 owns `useActionState` — its signature, its queuing, what a throw does to the queue, how to reset a form by key. This page owns the thing chapter 08 deliberately left as `state`: the value your action returns. It is a public API consumed by a component you also wrote, which is why nobody designs it, and it is the reason so many forms show one error at a time, lose what the user typed, or announce nothing to a screen reader.**

## The contract, written down once

The hook's `<form action>` form is documented as `(previousState, formData)` — the mechanics are in [chapter 08](../08-state-management-in-an-rsc-world/06-useoptimistic-and-useactionstate-as-framework-native-alterna.md). What matters here is that `previousState` and the return value are the *same type*, so the type has to cover every outcome including the first render.

```ts filename="lib/schemas/task.ts"
export type FieldErrors = Partial<Record<'title' | 'priority' | 'estimateHours' | 'dueAt', string[]>>

export type TaskFormState =
  | { status: 'idle' }
  | { status: 'success'; id: string }
  | {
      status: 'invalid'
      formErrors: string[]
      fieldErrors: FieldErrors
      values: { title: string; priority: string; estimateHours: string; dueAt: string }
    }
  | { status: 'error'; message: string; ref?: string }

export const initialTaskFormState: TaskFormState = { status: 'idle' }
```

Four states, not two. `idle` exists because the first render has no result and `{}` is not a good stand-in for it. `invalid` and `error` are separate because they are rendered in different places — field errors go beside inputs, an unexpected failure goes at the top of the form with a reference the user can quote. And `values` exists because a Server Action response replaces the rendered form, so anything the user typed is gone unless you send it back.

```ts filename="app/tasks/actions.ts"
'use server'

import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { toPlainObject } from '@/lib/form-data'
import { CreateTaskSchema, type TaskFormState } from '@/lib/schemas/task'
import { createTask } from '@/data/tasks'

export async function createTaskAction(
  _previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const raw = toPlainObject(formData)
  const parsed = CreateTaskSchema.safeParse(raw)

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error)
    return {
      status: 'invalid',
      formErrors: flat.formErrors,
      fieldErrors: flat.fieldErrors,
      values: {
        title: String(raw.title ?? ''),
        priority: String(raw.priority ?? 'normal'),
        estimateHours: String(raw.estimateHours ?? ''),
        dueAt: String(raw.dueAt ?? ''),
      },
    }
  }

  try {
    const { id } = await createTask(parsed.data)
    return { status: 'success', id }
  } catch (error) {
    const ref = randomUUID()
    console.error('[createTaskAction]', { ref, error })
    return { status: 'error', message: `Could not save the task. Reference ${ref}.`, ref }
  }
}
```

Note what `values` does **not** contain. It is an explicit list, not `...raw` — echoing the whole payload back is how a password ends up in the response, and [01d](01d-return-values-dtos-and-tainting.md) covers why a return value is a client payload.

## Which formatter, and what each one throws away

Zod ships three, and they are not interchangeable.

**`z.flattenError()`** produces `{ formErrors: string[], fieldErrors: Record<string, string[]> }` — the documentation's own example, for a schema with a bad `username`, a bad element inside `favoriteNumbers` and an unrecognised key:

```ts
{
  formErrors: [ 'Unrecognized key: "extraKey"' ],
  fieldErrors: {
    username: [ 'Invalid input: expected string, received number' ],
    favoriteNumbers: [ 'Invalid input: expected number, received string' ]
  }
}
```

Look at `favoriteNumbers`. The underlying issue had `path: [ 'favoriteNumbers', 1 ]` — **the index is gone.** The docs say when this is the right tool: *"the majority of schemas are *flat*—just one level deep. In this case, use `z.flattenError()` to retrieve a clean, shallow error object."* For a flat form it is exactly right and trivially renderable.

**`z.treeifyError()`** keeps the structure, which is what a field array or a nested object needs:

```ts
{
  errors: [ 'Unrecognized key: "extraKey"' ],
  properties: {
    username: { errors: [ 'Invalid input: expected string, received number' ] },
    favoriteNumbers: {
      errors: [],
      items: [
        undefined,
        { errors: [ 'Invalid input: expected number, received string' ] }
      ]
    }
  }
}
```

`errors` at each node, `properties` to descend into an object, `items` to index into an array — and the docs' own warning that the shape is sparse: *"Be sure to use optional chaining (`?.`) to avoid errors when accessing nested properties."*

```tsx
const tree = z.treeifyError(parsed.error)
tree.properties?.lineItems?.items?.[2]?.properties?.quantity?.errors?.[0]
```

**`z.prettifyError()`** returns a human-readable multi-line string. It is for logs and CLI output, not for a form — it flattens everything into prose with no field association.

⚠️ `error.flatten()` and `error.format()` still exist as methods but are **deprecated** in zod 4 in favour of the top-level functions. The Next.js forms guide still shows the method form; see [02b](02b-formdata-is-all-strings-coercion-at-the-boundary.md).

## Do not return the `ZodError`

`parsed.error` is a class instance. React's serializable set — enumerated in the [`'use client'` reference](https://react.dev/reference/rsc/use-client) — includes plain objects, arrays, `Map`, `Set`, `Date` and JSX, and excludes *"Classes"* and class instances. So returning the error object itself from an action is not a design preference to argue about; it is a value the boundary is documented not to carry.

Return one of the plain shapes instead:

```ts
// ❌ a class instance
return { status: 'invalid', error: parsed.error }

// ✅ a plain array of plain objects
return { status: 'invalid', issues: parsed.error.issues }

// ✅ better still — already shaped for rendering
return { status: 'invalid', ...z.flattenError(parsed.error) }
```

`parsed.error.issues` is fine because each issue is a plain object with `code`, `path`, `message` and friends. It is also more than the form needs, and it describes your schema to anyone reading the network tab — prefer the flattened form unless the client genuinely needs `code`.

## Rendering it, including for people who cannot see it

The forms guide's own snippet contains the one accessibility detail most implementations miss — the live region:

```tsx
<p aria-live="polite">{state?.message}</p>
```

`aria-live="polite"` is what makes a screen reader announce text that appears after the page has settled. Without it the error is rendered, correct, and silent. The full wiring adds `aria-invalid` on the control and `aria-describedby` pointing at the message, so focusing the field reads the error:

```tsx filename="app/tasks/task-form.tsx"
'use client'

import { useActionState } from 'react'
import { createTaskAction } from './actions'
import { initialTaskFormState } from '@/lib/schemas/task'

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p id={id} role="alert" className="field-error">
      {errors.join(' ')}
    </p>
  )
}

export function TaskForm() {
  const [state, formAction, pending] = useActionState(createTaskAction, initialTaskFormState)
  const invalid = state.status === 'invalid' ? state : null

  return (
    <form action={formAction} noValidate={false}>
      {state.status === 'error' && (
        <p role="alert" className="form-error">
          {state.message}
        </p>
      )}
      {invalid?.formErrors.length ? (
        <p role="alert" className="form-error">
          {invalid.formErrors.join(' ')}
        </p>
      ) : null}

      <label htmlFor="title">Title</label>
      <input
        id="title"
        name="title"
        required
        maxLength={200}
        defaultValue={invalid?.values.title ?? ''}
        aria-invalid={Boolean(invalid?.fieldErrors.title) || undefined}
        aria-describedby={invalid?.fieldErrors.title ? 'title-error' : undefined}
      />
      <FieldError id="title-error" errors={invalid?.fieldErrors.title} />

      <label htmlFor="estimateHours">Estimate (hours)</label>
      <input
        id="estimateHours"
        name="estimateHours"
        inputMode="numeric"
        defaultValue={invalid?.values.estimateHours ?? ''}
        aria-invalid={Boolean(invalid?.fieldErrors.estimateHours) || undefined}
        aria-describedby={invalid?.fieldErrors.estimateHours ? 'estimateHours-error' : undefined}
      />
      <FieldError id="estimateHours-error" errors={invalid?.fieldErrors.estimateHours} />

      <p aria-live="polite">{state.status === 'success' ? 'Task created.' : ''}</p>
      <button disabled={pending}>{pending ? 'Saving…' : 'Add task'}</button>
    </form>
  )
}
```

`role="alert"` carries an implicit `aria-live="assertive"`, which is right for an error that appears in response to the user's own submission; `aria-live="polite"` is right for the success confirmation, which should not interrupt. Keeping `required` and `maxLength` on the input means the browser still validates before hydration — the baseline the forms guide describes.

Resetting the form after success is a separate mechanic with its own trap, and chapter 08 owns it: [06c · reset, transitions and permalink](../08-state-management-in-an-rsc-world/06c-reset-transitions-and-permalink.md).

## Gotchas

**★ Symptom: an array field's errors all appear under the array's name with no indication of which row failed.** Cause: `z.flattenError` discards everything after the first path segment — the documented example shows a `favoriteNumbers[1]` issue landing in `fieldErrors.favoriteNumbers` with no index. Fix: use `z.treeifyError` for any schema that is not flat.

```ts
const tree = z.treeifyError(parsed.error)
const rowError = tree.properties?.lineItems?.items?.[index]?.properties?.quantity?.errors?.[0]
```

**★ Symptom: submitting an invalid form clears every field the user filled in.** Cause: the action's response re-renders the form, and uncontrolled inputs render their `defaultValue` — which is empty. Fix: return the submitted values in the state and feed them back, whitelisting the fields rather than spreading the payload.

```ts
values: { title: String(raw.title ?? ''), priority: String(raw.priority ?? 'normal') }
```

**★ Symptom: returning the parse error from the action fails at the boundary.** Cause: `parsed.error` is a `ZodError` — a class instance, and React's documented serializable set excludes classes and class instances. Fix: return `parsed.error.issues`, or better, the flattened plain object.

**★ Symptom: the error appears on screen and a screen reader never announces it.** Cause: the message was inserted into the DOM after load with no live region, so assistive technology has no reason to read it. Fix: `role="alert"` on error text, `aria-live="polite"` on confirmations, plus `aria-invalid` and `aria-describedby` on the control so the message is reachable from the field.

**Symptom: TypeScript complains that `state.fieldErrors` may not exist.** Cause: the state is a discriminated union and the success branch has no such property. Fix: narrow once at the top of the component — `const invalid = state.status === 'invalid' ? state : null` — rather than adding optional properties to every variant, which erases the union's value.

**Symptom: a field error renders under the wrong input, or not at all.** Cause: the key in `fieldErrors` is the schema property name, and the input's `name` attribute drifted from it. Fix: derive both from one place — the schema's shape keys — so a rename breaks the build.

```ts
export const TASK_FIELDS = CreateTaskSchema.keyof().options // typed list of field names
```

**Symptom: the state's `values` echoes a password back into the HTML.** Cause: `values: raw` or `values: { ...raw }`. Fix: an explicit whitelist; never re-populate a password field, and let the user retype it.

**Symptom: the first render throws because `state` is `undefined`.** Cause: no initial state was passed, or it was `null` and the component reads a property on it. Fix: an `idle` variant and a real initial value, exported next to the schema so the action and the component cannot disagree.

**Symptom: two different failures render identically and support cannot tell them apart.** Cause: validation failures and unexpected failures were collapsed into one `{ error: string }`. Fix: separate variants — `invalid` carries field-level detail, `error` carries a user-safe sentence plus the log reference from [01b](01b-mutation-shape-and-failure-posture.md).

**Symptom: `z.prettifyError` output is being parsed in the client to find field names.** Cause: it is a formatting helper for humans, not a data structure. Fix: `flattenError` or `treeifyError` for anything a component branches on; keep `prettifyError` for the log line.

## Interview questions

**★ Why does the action's return value need more than a success flag and a message?**
Because it is the only channel through which the form learns anything. A Server Action response re-renders the form, so field-level errors, form-level errors, an unexpected-failure message and the values the user typed all have to travel back inside that one value or they do not exist. Collapsing them into `{ error: string }` forces the component to guess which input to mark, throws away everything the user entered, and makes a validation failure indistinguishable from a database outage.

**★ `flattenError` or `treeifyError` — how do you choose?**
By whether the schema is flat. `flattenError` gives `formErrors` plus `fieldErrors` keyed by top-level property, which maps one-to-one onto a simple form and is trivial to render. It achieves that shape by discarding the rest of each issue's path, so an error at `lineItems[2].quantity` is reported against `lineItems` with no index — useless for a field array. `treeifyError` preserves the structure through `properties` and `items` at the cost of optional chaining at every level. Flat form, flatten; nested or repeating, treeify.

**★ What happens if you return `parsed.error` directly from a Server Action?**
It is a `ZodError` instance, and React's documented serializable set excludes class instances, so it is not a value the server/client boundary carries. The fix is not to reach for a workaround but to notice that you did not want to send it anyway: the raw error contains the full issue list including codes and paths for every field in the schema, which is a description of your API written into the network response. Send the flattened shape the UI renders.

**★ How do you keep a user's input after a failed submission?**
Return it. The response replaces the rendered form, and an uncontrolled input falls back to `defaultValue`, so anything not sent back is lost. The important detail is that the values are whitelisted rather than spread — the raw payload contains everything posted, including fields you would never want echoed into HTML, and a password is the obvious one. An alternative is to keep the form controlled on the client, which trades the round-trip problem for a hydration requirement.

**★ What makes a form error accessible, beyond rendering the text?**
Three things. A live region, so assistive technology knows to announce content that appeared after load — `role="alert"` for errors, which is assertive, and `aria-live="polite"` for confirmations, which is not. `aria-invalid` on the control, so the field itself reports its state. And `aria-describedby` from the control to the message's `id`, so a user navigating field by field hears the error attached to the field rather than having to find it. Rendering red text satisfies none of these.

**Why keep `required` and `maxlength` on the inputs when the schema already checks them?**
Because they are the only validation that works before the JavaScript bundle arrives, which is the case the forms guide documents as client-side validation. They also give the browser's own error UI, which is localised and familiar. They are not a security control — nothing in the browser is — but they are the cheapest possible first pass and they cost one attribute.

---

← [02b · `FormData` is all strings](02b-formdata-is-all-strings-coercion-at-the-boundary.md) · [Chapter 10 overview](01-explanation.md) · Next → [02d · React Hook Form and the resolver](02d-react-hook-form-and-the-resolver.md)
