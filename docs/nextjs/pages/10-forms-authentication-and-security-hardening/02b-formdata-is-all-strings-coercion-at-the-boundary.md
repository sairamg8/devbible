---
title: "`FormData` has no types — every value is a string or a File — so coercion is part of the schema, and `z.coerce` has three behaviours that turn an empty form field into valid data"
sidebar_label: "02b · FormData is all strings"
sidebar_position: 7
description: "Why an empty text input coerces to 0, why z.coerce.boolean() calls \"false\" true, what an unchecked checkbox actually sends, the $ACTION_ keys Object.fromEntries picks up, and the zod 3 API the Next.js forms guide still shows."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the [Zod API reference](https://zod.dev/api) and [Formatting errors](https://zod.dev/error-formatting), the [Zod 4 changelog](https://zod.dev/v4/changelog), and the Next.js [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`). Every coercion result below was **probed on the installed package** (`zod` **4.4.3**, matching the corpus pin) rather than recalled.
> Target: **Next.js 16.3.4 · zod 4.4.3**. Documentation-verified plus installed-package probes; **no sandbox run**.

**A form posts strings. Not numbers that look like strings — strings, plus `File` objects for file inputs, plus nothing at all for controls the browser considers unset. Every typed value your action works with is therefore the output of a conversion, and the only question is whether that conversion is written down in the schema or scattered through the action as `Number(...)` and `=== 'on'`. Putting it in the schema is right. It is also where `z.coerce` will quietly accept an empty field as the number zero, so this page is the conversion layer in detail.**

## What actually arrives

`formData.get(name)` returns `string | File | null` — `null` when the form contained no control with that name, or when the control was one the browser does not submit. That last category is the one that surprises people:

- An **unchecked checkbox** submits nothing at all. A checked one submits its `value`, which defaults to the string `"on"`.
- An **unselected radio group** submits nothing.
- A **disabled** control submits nothing, regardless of its value.
- An empty text input submits the **empty string**, not `null`.
- A **multiple** select or repeated field name needs `formData.getAll(name)`; `get` returns only the first.
- An empty file input submits a `File` with a size of zero, not `null`.

The forms guide's shortcut for wide forms comes with a caveat that matters for strict schemas:

> *"When working with forms that have multiple fields, use JavaScript's [`Object.fromEntries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries). For example: `const rawFormData = Object.fromEntries(formData)`. Note that this object will contain extra properties prefixed with `$ACTION_`."*

Those are React's own dispatch metadata. `z.object` strips unknown keys, so it never notices them — **probed on zod 4.4.3, an object schema parsing `{ a: 'x', $ACTION_ID_1: 'y' }` returns `{ a: 'x' }`**. `z.strictObject` rejects the same input with an `unrecognized_keys` issue. If you prefer strict schemas, filter first.

```ts filename="lib/form-data.ts"
/** FormData → a plain object, with React's dispatch metadata removed and
 *  repeated field names collapsed into arrays. */
export function toPlainObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$ACTION_')) continue
    if (key in out) {
      const existing = out[key]
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
    } else {
      out[key] = value
    }
  }
  return out
}
```

## `z.coerce` and its three sharp edges

The API is a thin wrapper over the built-in constructors, and the documentation says so in a table:

| Zod API | Coercion |
|---|---|
| `z.coerce.string()` | `String(value)` |
| `z.coerce.number()` | `Number(value)` |
| `z.coerce.boolean()` | `Boolean(value)` |
| `z.coerce.bigint()` | `BigInt(value)` |
| `z.coerce.date()` | `new Date(value)` |

Everything below follows mechanically from that table, which is why it is worth reading the table before reaching for the API.

**Edge one — an empty field is the number zero.** `Number('')` is `0`, and `Number(null)` is `0`. Probed on zod 4.4.3: `z.coerce.number()` parses both `''` and `null` **successfully, to `0`**. So an untouched "quantity" input does not produce a "required" error; it produces a quantity of zero, and a `.min(1)` on top reports *too small* rather than *missing* — a message that sends the user looking at the wrong thing.

**Edge two — every non-empty string is `true`.** The documentation is explicit:

> *"Boolean coercion with `z.coerce.boolean()` may not work how you expect. Any [truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) value is coerced to `true`, and any [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy) value is coerced to `false`."*

with `schema.parse("false"); // => true` in its own list. Probed on 4.4.3: `z.coerce.boolean().parse('false')` is `true`. Since a checkbox posts the string `"on"` and a hidden field commonly posts `"false"`, `z.coerce.boolean()` is almost always the wrong tool for a form.

**Edge three — the input type is `unknown`.** *"The input type of these coerced schemas is `unknown` by default."* That is convenient at a boundary and unhelpful in a React Hook Form generic, where it widens the form's value type; the fix is the generic parameter, `z.coerce.number<number>()`.

The documentation's own escape hatch for anything beyond the table:

> *"For total control over coercion logic, consider using `z.transform()` or `z.pipe()`."*

## The conversions a form actually needs

**Booleans from checkboxes.** zod 4 ships `z.stringbool()` for boolish strings — `"true"`, `"1"`, `"yes"`, `"on"`, `"y"`, `"enabled"` are true; `"false"`, `"0"`, `"no"`, `"off"`, `"n"`, `"disabled"` are false, case-insensitively, and anything else is an `invalid_value` issue. It does not handle *absent*, which is exactly what an unchecked box is, so pair it with a default:

```ts
// "on" → true, "off"/"false" → false, missing → false
const checkbox = z.stringbool().or(z.undefined().transform(() => false)).or(z.null().transform(() => false))

// Equivalent and shorter when you do not need stringbool's vocabulary:
const checkboxSimple = z.preprocess((v) => v === 'on' || v === 'true', z.boolean())
```

**Numbers that distinguish empty from zero.** Preprocess the empty cases to `undefined` so `required` behaves like `required`:

```ts
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number(),
)

const requiredNumber = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number({ error: 'Enter a quantity.' }).int().min(1),
)
```

**Strings that are only whitespace.** `.trim()` runs as part of parsing, so put it before the length check — `z.string().trim().min(1)` rejects `"   "`, while `z.string().min(1).trim()` accepts it and then trims it to nothing.

**Dates.** An `<input type="date">` posts `YYYY-MM-DD`. `z.iso.date()` validates that format as a string; `z.coerce.date()` builds a `Date` via `new Date(value)`, which parses that format as **UTC midnight** — a difference that shows up as an off-by-one day for users west of Greenwich. Keep the string unless you need a `Date`, and if you need one, construct it in the timezone you mean.

**Optional versus nullable.** `formData.get()` returns `null`, not `undefined`, for a missing field — so `z.string().optional()` does *not* accept it and `.nullish()` does. Preprocessing `null` to `undefined` once, as above, is usually cleaner than making every field nullish.

## A complete boundary adapter

```ts filename="lib/schemas/task.ts"
import { z } from 'zod'

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v)

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, { error: 'Give the task a title.' }).max(200),
  priority: z.enum(['low', 'normal', 'high']),
  estimateHours: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ error: 'Estimate must be a number.' }).positive().max(1000).optional(),
  ),
  dueAt: z.preprocess(emptyToUndefined, z.iso.date().optional()),
  notify: z.preprocess((v) => v === 'on' || v === 'true', z.boolean()),
  tagIds: z.array(z.uuid()).max(10).default([]),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
```

```ts filename="app/tasks/actions.ts"
'use server'

import { z } from 'zod'
import { toPlainObject } from '@/lib/form-data'
import { CreateTaskSchema } from '@/lib/schemas/task'
import { createTask } from '@/data/tasks'

export async function createTaskAction(_prev: unknown, formData: FormData) {
  const parsed = CreateTaskSchema.safeParse(toPlainObject(formData))
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  return createTask(parsed.data)
}
```

## ⚠ The framework's own example is zod 3

The Next.js forms guide still shows this:

```ts
const schema = z.object({
  email: z.string({
    invalid_type_error: 'Invalid Email',
  }),
})
// ...
return { errors: validatedFields.error.flatten().fieldErrors }
```

Both halves have moved. The zod 4 changelog states that it *"drops `invalid_type_error` and required_error"* — *"The `invalid_type_error` / `required_error` params have been dropped"* — in favour of a single `error` param, and that it *"deprecates `.flatten()`"* on `ZodError` in favour of the top-level `z.flattenError()`.

**Probed on the installed zod 4.4.3:** `z.string({ invalid_type_error: 'CUSTOM' })` parsing a number produces the default message `Invalid input: expected string, received number` — the custom string is silently ignored, because the key is no longer recognised. `z.string({ error: 'CUSTOM' })` produces `CUSTOM`. This is the failure mode worth knowing about: **not a crash, a message you thought you had customised and did not.**

The zod 4 form of the guide's example:

```ts
const schema = z.object({
  email: z.email({ error: 'Invalid Email' }),
})

const validatedFields = schema.safeParse({ email: formData.get('email') })
if (!validatedFields.success) {
  return { errors: z.flattenError(validatedFields.error).fieldErrors }
}
```

`.flatten()` still exists and still works — deprecated, not removed — so nothing breaks loudly. `invalid_type_error` is the one that fails silently.

## Gotchas

**★ Symptom: leaving a numeric field blank saves `0` instead of reporting a missing value.** Cause: `z.coerce.number()` is `Number(value)`, and `Number('')` and `Number(null)` are both `0` — probed on zod 4.4.3, both parse successfully. Fix: map the empty cases to `undefined` before coercing.

```ts
const quantity = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number({ error: 'Enter a quantity.' }).int().min(1),
)
```

**★ Symptom: a "false" value from a hidden input or a select is stored as `true`.** Cause: `z.coerce.boolean()` is `Boolean(value)`, and every non-empty string is truthy — the docs list `schema.parse("false"); // => true`. Fix: use `z.stringbool()`, or preprocess explicitly.

```ts
const subscribed = z.stringbool()          // "false"/"0"/"no"/"off" → false
const notify = z.preprocess((v) => v === 'on' || v === 'true', z.boolean())
```

**★ Symptom: a required checkbox never triggers its error; the field is simply absent from the parsed object.** Cause: an unchecked checkbox submits nothing, so `formData.get()` is `null` and an `.optional()` boolean happily omits it. Fix: default the missing case to `false` and assert on the value.

```ts
const acceptedTerms = z
  .preprocess((v) => v === 'on' || v === 'true', z.boolean())
  .refine((v) => v === true, { error: 'You must accept the terms.' })
```

**★ Symptom: a custom validation message set with `invalid_type_error` never appears.** Cause: zod 4 dropped the parameter; the object key is now ignored, and the default message is produced instead — probed on 4.4.3. Fix: the unified `error` param.

```ts
z.string({ error: 'Enter your name.' })
z.number({ error: 'Enter a number.' }).min(1, { error: 'Must be at least 1.' })
```

**★ Symptom: `z.strictObject` rejects every submission with `Unrecognized key: "$ACTION_ID_1"`.** Cause: `Object.fromEntries(formData)` includes React's dispatch metadata, which the guide warns about. Fix: strip the prefix before parsing — `toPlainObject` above does it — or use a plain `z.object`, which strips unknown keys.

**Symptom: only the first of several checkboxes with the same name is saved.** Cause: `formData.get()` returns the first value; repeated names need `getAll`. Fix: collapse repeats into an array at the adapter, then validate with `z.array`.

```ts
const tagIds = formData.getAll('tagIds').map(String)
```

**Symptom: a whitespace-only title passes `min(1)`.** Cause: the check ran before the trim. Fix: order the chain so trimming happens first — `z.string().trim().min(1)`.

**Symptom: a date is stored one day earlier than the user picked.** Cause: `z.coerce.date()` is `new Date('2026-03-14')`, which the language parses as UTC midnight; rendered in a negative-offset timezone that is the previous day. Fix: keep the calendar date as a string (`z.iso.date()`) and convert at the point where a timezone is actually known.

**Symptom: a field that the client sends is missing on the server with no error.** Cause: `z.object` strips keys the schema does not declare. Fix: declare it, or use `z.strictObject` after filtering `$ACTION_` keys if you want unknown fields to be an error.

**Symptom: a `.default()` on a field makes TypeScript complain when the schema is reused for form typing.** Cause: `.default()` makes the field optional on the schema's *input* type and required on its *output* type; a single generic pins them together. Fix: reference the two sides explicitly — `z.input<typeof schema>` and `z.output<typeof schema>`. [02d](02d-react-hook-form-and-the-resolver.md) covers the React Hook Form version of this exact clash.

**Symptom: a transform throws and the error escapes `safeParse`.** Cause: zod does not catch exceptions from transform functions — *"Transform functions should never throw. Thrown errors are not caught by Zod."* Fix: report the failure through the issue channel instead of throwing.

```ts
const parsedJson = z.transform((val, ctx) => {
  try {
    return JSON.parse(String(val))
  } catch {
    ctx.issues.push({ code: 'custom', message: 'Not valid JSON', input: val })
    return z.NEVER
  }
})
```

## Interview questions

**★ Why does an empty numeric input pass `z.coerce.number()`?**
Because `z.coerce.number()` is documented as `Number(value)`, and `Number('')` is `0` — as is `Number(null)`, which is what a missing field produces. So the empty case is not a validation failure at all; it is a successful parse to zero, and any `.min()` you add reports the wrong problem. The fix is to normalise the empty cases to `undefined` in a `preprocess` before the coercion runs, which restores the distinction between "missing" and "zero" that the form itself never had.

**★ What does a checkbox actually submit, and how should a schema model it?**
A checked box submits its `value` attribute, defaulting to the string `"on"`. An unchecked box submits nothing at all, so the key is absent from `FormData` entirely and `get()` returns `null`. Modelling it as `z.boolean()` therefore fails, and `z.coerce.boolean()` is worse — every non-empty string is truthy, so `"false"` becomes `true`. The two workable shapes are `z.stringbool()` for boolish strings combined with a default for the absent case, or an explicit `preprocess` that maps `"on"` and `"true"` to `true` and everything else, including `null`, to `false`.

**★ The Next.js forms guide shows `invalid_type_error`. What happens if you copy it onto zod 4?**
Nothing visible, which is the problem. zod 4 dropped `invalid_type_error` and `required_error` in favour of one `error` param; an unrecognised key in the params object is ignored, so the schema still compiles, still validates, and produces the default message instead of yours. There is no warning. The other half of that example, `error.flatten()`, is merely deprecated in favour of `z.flattenError()` and still works — so the guide's snippet runs, and only one of its two intentions is honoured.

**★ Why is coercion better placed in the schema than in the action body?**
Because the schema is the thing both sides import, so a conversion written in the action exists only on the server and the client's copy of the "same" rules is quietly different. It also keeps the failure in the issue channel: a `preprocess`-plus-coerce that rejects a value produces a field error with a path, which the form can render next to the input, whereas a `Number(...)` in the action body produces `NaN` and then some other check fails somewhere else with a message about the wrong field.

**When would you use `z.strictObject` for a form, and what breaks?**
When an undeclared field arriving is a signal you want to see — a renamed input, a stale client, a probe. What breaks is `Object.fromEntries(formData)`, because React adds `$ACTION_`-prefixed dispatch metadata to the payload and strict mode rejects the whole submission with `unrecognized_keys`. Filter those keys in the adapter that builds the plain object, and strict mode becomes usable.

**Why does the order of `.trim()` and `.min()` matter?**
Because zod applies the chain in order as part of parsing, not as an independent set of assertions. `z.string().trim().min(1)` trims first, so `"   "` becomes `""` and fails the length check. `z.string().min(1).trim()` checks the raw three-space string, passes, and then trims it to the empty string — a value the schema has certified as non-empty. The same reasoning applies to any normalisation before a constraint: lowercase before a format check, strip before a length check.

---

← [02 · The schema as a trust boundary](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md) · [Chapter 10 overview](01-explanation.md) · Next → [02c · Field errors through `useActionState`](02c-field-errors-in-a-shape-the-form-can-render.md)
