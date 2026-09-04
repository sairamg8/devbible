---
title: "React Hook Form buys you uncontrolled inputs, field arrays and one re-render per touched field — and it costs you the form that works before hydration, so the choice is about which of those the form actually needs"
sidebar_label: "02d · React Hook Form and the resolver"
sidebar_position: 9
description: "What zodResolver does, the z.input versus z.output generic clash that the resolvers README documents, why RHF cannot participate in progressive enhancement, the two integration shapes with a Server Action, and mapping server errors back with setError."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the [`@hookform/resolvers` README](https://github.com/react-hook-form/resolvers) and the [React Hook Form `handleSubmit` reference](https://react-hook-form.com/docs/useform/handlesubmit), the React [`<form>`](https://react.dev/reference/react-dom/components/form) reference, and the Next.js [forms guide](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`). Versions read from the npm registry on 2026-09-05.
> Target: **react-hook-form 7.87.0 · @hookform/resolvers 5.9.1 · zod 4.4.3 · Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**.

**React Hook Form is a client-side library. That single fact decides every question in this page. It means the schema you share with the server can drive instant field feedback, field arrays and multi-step wizards without re-rendering the whole form on every keystroke — and it means none of that exists until the JavaScript bundle has arrived and hydrated. A Server Action form works without JavaScript by design; an RHF form does not. Both are legitimate, and picking one per form is a better answer than pretending the two compose cleanly.**

## What the resolver is

React Hook Form keeps values in a ref-backed store populated by `register`, so a keystroke updates form state without re-rendering every field. A *resolver* is the adapter that lets an external schema library produce the errors:

```
resolver(schema: object, schemaOptions?: object, resolverOptions?: { mode: 'async' | 'sync', raw?: boolean })
```

```tsx filename="app/tasks/task-form.tsx"
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateTaskSchema } from '@/lib/schemas/task'

export function TaskFields() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateTaskSchema),
    mode: 'onBlur',
  })

  return (
    <form onSubmit={handleSubmit((values) => console.log(values))}>
      <input {...register('title')} />
      {errors.title?.message && <p role="alert">{errors.title.message}</p>}
      <input type="number" {...register('estimateHours', { valueAsNumber: true })} />
      {errors.estimateHours?.message && <p role="alert">{errors.estimateHours.message}</p>}
      <button type="submit">Add task</button>
    </form>
  )
}
```

`@hookform/resolvers` also ships `standardSchemaResolver` from `@hookform/resolvers/standard-schema`, which works against any library implementing the Standard Schema interface — including zod. Either import works; `zodResolver` is the zod-specific one and is what the README documents for zod.

Note `valueAsNumber`. The README flags it explicitly — *"Example below uses the `valueAsNumber`, which requires `react-hook-form` v6.12.0 (released Nov 28, 2020) or later."* — because a DOM input hands back a string and a `z.number()` field would otherwise fail type validation on every submission. It is the client-side counterpart of the coercion problem in [02b](02b-formdata-is-all-strings-coercion-at-the-boundary.md), solved in a different layer.

## 🔴 The generic that fights the resolver

The single most reported RHF-plus-zod type error, straight from the README:

> *"If your schema uses `.default(...)` on a field, that field becomes optional on the schema's *input* type (`z.input`) but stays required on its *output* type (`z.output`/`z.infer`) — the default only fills it in after validation. Passing a single generic to `useForm<T>` pins both to the same type and will conflict with `zodResolver`, which infers input and output separately. Either omit the generic and let it infer from `resolver`, or specify all three explicitly"*

```tsx
const schema = z.object({ debug_mode: z.boolean().default(true) });

useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
  resolver: zodResolver(schema),
});
```

The three-parameter form is `useForm<Input, Context, Output>()`. The same asymmetry appears with `z.preprocess` and `z.coerce`, whose input type is `unknown` by default — which is why [02b](02b-formdata-is-all-strings-coercion-at-the-boundary.md) mentions `z.coerce.number<number>()`. Zod's own docs make the connection: narrowing a preprocessor's parameter type *"is useful when integrating with libraries like `react-hook-form` that derive their form value type from `z.input<>`."*

**The simplest working advice is the README's first option: omit the generic entirely and let it infer from the resolver.** Reach for the three-parameter form only when you need to name the types elsewhere.

## What it costs: the form before hydration

React's `<form>` reference states the progressive-enhancement rule precisely:

> *"When `<form>` is rendered by a Server Component, and a Server Function is passed to the `<form>`'s `action` prop, the form is progressively enhanced."*

and, for showing an error in that pre-hydration window:

> *"Displaying a form submission error message before the JavaScript bundle loads for progressive enhancement requires that: `<form>` be rendered by a Client Component; the function passed to the `<form>`'s `action` prop be a Server Function; the `useActionState` Hook be used to display the error message."*

**React Hook Form appears in neither list, and cannot.** Its state lives in a hook; before hydration there is no hook. So in the window between first paint and hydration:

- A plain Server Action form submits, and the server validates and responds. It works.
- An RHF form's `onSubmit` handler does not exist yet. What happens depends entirely on what else is on the element.

That is the whole trade. It matters for a signup form on a slow connection and does not matter at all for an internal dashboard behind a login. Decide per form, not per project.

## Two integration shapes

**Shape A — React Hook Form owns submission.** The form is a Client Component, `handleSubmit` gates on validity, and the Server Action is called as a plain async function inside a transition:

```tsx filename="app/tasks/task-form.tsx"
'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateTaskSchema } from '@/lib/schemas/task'
import { createTaskFromValues } from './actions'

export function TaskForm() {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(CreateTaskSchema) })

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await createTaskFromValues(values)
      if (result.status === 'invalid') {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as 'title' | 'estimateHours', { message: messages?.[0] })
        }
        return
      }
      if (result.status === 'error') {
        setError('root.serverError', { type: 'server', message: result.message })
      }
    })
  })

  return (
    <form onSubmit={onSubmit}>
      <input {...register('title')} aria-invalid={Boolean(errors.title) || undefined} />
      {errors.title?.message && <p role="alert">{errors.title.message}</p>}
      {errors.root?.serverError?.message && <p role="alert">{errors.root.serverError.message}</p>}
      <button disabled={isPending}>Add task</button>
    </form>
  )
}
```

`setError('root.serverError', …)` is the documented channel for a failure that belongs to the form rather than a field. The RHF reference explains why it also matters for state:

> *"handleSubmit function will not swallow errors that occurred inside your onSubmit callback, so we recommend that you use try/catch blocks inside your async requests and handle those errors gracefully for your customers. Use setError inside the catch block to register a server-side error — this also ensures formState.isSubmitSuccessful is set to false"*

Shape A gives up progressive enhancement and gains everything RHF is good at. The server still validates — `createTaskFromValues` parses with the same schema in its Data Access Layer, because [the client copy is not a control](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md).

**Shape B — the Server Action owns submission, RHF only decorates.** `<form action={formAction}>` with `useActionState` as in [02c](02c-field-errors-in-a-shape-the-form-can-render.md), and RHF used *only* for live per-field feedback while typing, never to gate the submit.

⚠️ **I could not confirm from either React's `<form>` documentation or React Hook Form's documentation what happens when `onSubmit` and a function `action` are both present on the same element** — specifically whether calling `preventDefault()` inside `onSubmit` cancels the Action. Neither source addresses the combination. Treat any pattern that depends on that interaction as unverified, and choose a single submission owner per form. That is the honest version of the advice, and it is also the one that produces fewer bugs.

## When it earns its place

| Use React Hook Form | Use the Server Action alone |
|---|---|
| Field arrays — `useFieldArray` for repeatable rows | Two to six independent fields |
| Multi-step wizards holding state across steps | A single-step create or edit |
| Cross-field rules the user should see while typing | Rules the server can report on submit |
| Very wide forms where per-keystroke re-render is felt | Forms where it is not |
| Complex controlled widgets needing a `Controller` | Native inputs |

A create-task dialog with three fields does not need a form library, and adding one ships a dependency to every user to solve a problem the platform already solved. Conversely, an invoice editor with a variable number of line items and running totals is exactly what `useFieldArray` exists for, and hand-rolling it is worse code.

## Gotchas

**★ Symptom: `useForm<FormValues>({ resolver: zodResolver(schema) })` produces an unassignable-type error after adding `.default()` to a field.** Cause: the default makes the field optional on the input type and required on the output type, and a single generic pins both. Fix: drop the generic, or name all three.

```tsx
// Fix 1 — infer from the resolver
useForm({ resolver: zodResolver(schema) })

// Fix 2 — name input, context and output
useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
  resolver: zodResolver(schema),
})
```

**★ Symptom: a number field always fails validation with "expected number, received string".** Cause: DOM inputs return strings, and `z.number()` does not coerce. Fix: `valueAsNumber` at the registration, which is the client-side equivalent of the schema-level coercion the server needs.

```tsx
<input type="number" {...register('estimateHours', { valueAsNumber: true })} />
```

**★ Symptom: the form validates beautifully once loaded and does nothing at all on a slow connection before hydration.** Cause: RHF's submit handler is a hook-owned function that does not exist yet, and progressive enhancement is documented only for a Server Function passed to `action`. Fix: for forms that must work pre-hydration, use shape B — `<form action={formAction}>` with `useActionState` — and accept coarser feedback until hydration.

**★ Symptom: every failed submission shows each message twice.** Cause: both renderers are live — RHF's `formState.errors` and the action state's `fieldErrors` — because the migration from one shape to the other was half finished. Fix: pick the owner. In shape A, map server errors into RHF with `setError` and render only `errors`. In shape B, render only the action state and let RHF touch nothing.

**Symptom: an unhandled rejection appears when the Server Action throws inside `handleSubmit`.** Cause: *"handleSubmit function will not swallow errors that occurred inside your onSubmit callback"*. Fix: `try`/`catch` in the callback and `setError` in the catch — which also leaves `formState.isSubmitSuccessful` correctly `false`.

```tsx
try {
  await createTaskFromValues(values)
} catch (error) {
  setError('root.serverError', { type: 'server', message: 'Could not save the task.' })
}
```

**Symptom: `register` cannot be used on an input rendered by a Server Component.** Cause: `register` returns props produced by a hook, so the element must live inside a `'use client'` component. Fix: keep the interactive fields in a Client Component and pass server-rendered content in as children, rather than marking the whole page `'use client'`.

**Symptom: the client and the server disagree about a rule after a schema change.** Cause: the client validates with the schema imported at build time; a deployed server may have a newer one, and an open tab certainly has the old one. Fix: treat the server's answer as authoritative and always surface it — the client copy exists to reduce round trips, not to be the last word.

**Symptom: a controlled third-party widget never updates RHF's state.** Cause: `register` wires native events; a component that manages its own value emits none of them. Fix: RHF's `Controller` for that field, and leave the rest uncontrolled — mixing the two per field is expected, not a smell.

**Symptom: bundle size grew for a page whose form has three inputs.** Cause: a form library plus a resolver plus the schema shipped to the client for a form the platform could have handled with `action` and `required`. Fix: use the library where the table above says it earns its place.

## Interview questions

**★ Why can React Hook Form not participate in progressive enhancement?**
Because its entire model is hook state in a Client Component, and before hydration there are no hooks. React documents progressive enhancement for a specific arrangement — a Server Function passed to a `<form>`'s `action` prop — and documents that showing an error message pre-hydration requires a Client Component, a Server Function in `action`, and `useActionState`. RHF is not in that arrangement and cannot be, so a form whose validation and submission it owns is inert until the bundle lands. That is acceptable for authenticated internal UI and a real cost on a public signup page.

**★ What does `zodResolver` actually do, and what is the `z.input`/`z.output` clash it causes?**
It adapts a zod schema into the shape React Hook Form expects from a resolver, running the schema against the form's values and translating zod issues into RHF's error object keyed by field path. The clash arises because zod distinguishes the type going in from the type coming out — `.default()`, `.transform()`, `z.coerce` and `z.preprocess` all make them differ — while `useForm<T>` with one generic assumes they are the same. The resolvers README says to either omit the generic and let it infer, or supply all three of `Input`, `Context` and `Output`.

**★ You have a Server Action form and you want live per-field validation. What do you do?**
Decide who owns submission first, because that is the real question. If the form must work before hydration, keep `<form action={formAction}>` and `useActionState` as the submission path and layer client feedback on top without gating the submit. If it does not, let RHF own submission via `handleSubmit`, call the action as a plain async function inside a transition, and map its returned field errors back with `setError`. What you should not do is build something that depends on `onSubmit` and a function `action` cooperating on the same element — neither library documents that interaction.

**★ The client validated with the shared schema. Why does the server validate again?**
Because the client's validation is a rendering feature running on the attacker's machine. The action is a POST endpoint that can be called without any browser at all, and even for honest users the client's schema is the copy that was in the bundle when the tab was opened, which may be older than the deployed rules. The server's parse is the only one that decides whether data reaches the database; the shared module exists so the two copies say the same thing when both run.

**★ When is a form library the wrong choice in an App Router application?**
When the form is small and its rules are checkable on submit. Three independent fields with `required`, a schema parse in the action and `useActionState` for the results is less code, ships nothing extra to the browser, and works before hydration. The library starts paying for itself with repeatable rows via `useFieldArray`, state that has to survive across wizard steps, cross-field feedback the user needs while typing, or a form wide enough that a re-render per keystroke is perceptible.

**How do you get a server-side failure to appear in React Hook Form's error state?**
`setError`. Per-field errors map onto the field names — `setError('title', { message })` — and failures that belong to the whole form go to `setError('root.serverError', { type, message })`, which RHF exposes at `errors.root.serverError`. The documentation notes the side benefit: calling `setError` in the catch block also leaves `formState.isSubmitSuccessful` as `false`, so any UI keyed on that flag stays honest.

---

← [02c · Field errors the form can render](02c-field-errors-in-a-shape-the-form-can-render.md) · [Chapter 10 overview](01-explanation.md) · Next → [02e · File inputs](02e-file-inputs-and-the-checks-that-must-be-server-side.md)
