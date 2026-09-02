---
title: "useForm holds z.input on the way in and hands z.output to the submit handler, and every field name and error key is derived from the same schema so a typo is a compile error rather than a control that never renders"
sidebar_label: "08c · useForm, typed from the schema"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read in this repo —
> `export type input<T> = T extends {_zod: {input: any}} ? T["_zod"]["input"] :
> unknown;`, `export type output<T> = …`, `export type { output as infer };`,
> and `ZodSafeParseResult<T> = ZodSafeParseSuccess<T> | ZodSafeParseError<T>`
> in `zod/v4/classic/parse.d.cts` — the **`@types/react` 19.2.18** handler
> types (`ChangeEventHandler`, `FocusEventHandler`, `FormEventHandler`), and
> the TypeScript handbook on
> [`keyof`](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html)
> and [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**, zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 02·02b](../02-zod-as-the-source-of-truth/02b-defaults-and-optionals.md)
promised this hook's typing and pointed here.** `useForm` is the one hook in
the app whose type parameter is a *schema* rather than a data type, and that
choice pays four times over: the state is `z.input<S>`, the submit handler
receives `z.output<S>`, the field names are the schema's keys, and the error
map is keyed by those same names. One generic parameter, and a mistyped field
name stops compiling instead of rendering an input that is wired to nothing.

## The signature

```ts
// apps/web/src/hooks/useForm.ts
import {z} from 'zod';
import type {ChangeEventHandler, FocusEventHandler, FormEventHandler} from 'react';
import type {ApiFailure} from '@storefront/shared';

type FieldKeys<S extends z.ZodType> = Extract<keyof z.input<S>, string>;

export interface FieldProps {
  name: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  onBlur: FocusEventHandler<HTMLElement>;
  'aria-invalid': boolean;
}

export interface UseForm<S extends z.ZodType> {
  field: (name: FieldKeys<S>) => FieldProps;
  errors: Partial<Record<FieldKeys<S>, string>>;
  handleSubmit: FormEventHandler<HTMLFormElement>;
  submitting: boolean;
  formError: ApiFailure | null;
  valid: boolean;
}

export function useForm<S extends z.ZodType>(opts: {
  schema: S;
  initial: z.input<S>;                                // what the inputs hold
  onSubmit: (parsed: z.output<S>) => Promise<void>;   // what the handler gets
}): UseForm<S> { … }
```

Four typing decisions, each removing a class of bug:

- **`initial` is `z.input<S>` and `onSubmit` receives `z.output<S>`.** The
  checkout form's `initial` may hold `''` for a field the schema requires to be
  non-empty; `onSubmit` cannot be handed anything but a parsed `Address`. This
  is chapter 02's input/output distinction landing in a component, and it is
  the reason the hook is generic over the schema and not over the data.
- **`field(name)` takes `FieldKeys<S>`**, so `form.field('postcode')` is checked
  against the schema's keys and `form.field('postocde')` does not compile.
- **`errors` is `Partial<Record<FieldKeys<S>, string>>`**, not
  `Record<string, string>`: reading `form.errors.postocde` is a compile error
  rather than a permanent `undefined`, and the `Partial` is honest because a
  valid field has no entry.
- **`handleSubmit` is `FormEventHandler<HTMLFormElement>`**, which types the
  `e.preventDefault()` inside it and checks the wiring at
  `<form onSubmit={form.handleSubmit}>`.

## The consumer

```tsx
// apps/web/src/components/CheckoutForm.tsx
import {AddressSchema} from '@storefront/shared';

const form = useForm({
  schema: AddressSchema,
  initial: {name: '', line1: '', city: '', postcode: '', country: 'US'},
  onSubmit: async (address) => {                 // address: Address, parsed
    await placeOrder({address, idempotencyKey});
  },
});

return (
  <form onSubmit={form.handleSubmit} noValidate>
    <input {...form.field('name')} autoComplete="name" />
    {form.errors.name && <p role="alert">{form.errors.name}</p>}
    <input {...form.field('postcode')} autoComplete="postal-code" />
    {form.errors.postcode && <p role="alert">{form.errors.postcode}</p>}
    <button disabled={form.submitting}>Place order</button>
  </form>
);
```

`initial` is checked against `z.input<typeof AddressSchema>` — omit `city` and
the object literal fails at the hook call. `form.field('name')` and
`form.errors.name` are both checked against the schema's keys. Rename
`postcode` to `postal_code` in the schema and this component stops compiling in
four places, which is the phase gate stated for one form.

## Why `Extract<keyof z.input<S>, string>` and not `keyof z.input<S>`

`keyof T` produces `string | number | symbol`. An HTML `name` attribute is a
`string`, and `Record`'s key parameter is `keyof any`, so leaving the symbols
and numbers in produces an error about `symbol` not being assignable to
`string` — several layers away from the `keyof` that caused it. `Extract` is
the filter, and [chapter 08·05](../08-utility-types-in-app-code/05-exclude-extract-and-distributivity.md)
is why it works on a union of key types.

## What the hook cannot type

⚠️ **`FieldProps.value` is `string`, and the schema may not be about strings.**
A number field's control holds `'42'`, the schema coerces it, and the hook's
state is `z.input<S>` — which for a coerced field is `unknown`, as
[chapter 02·02](../02-zod-as-the-source-of-truth/02-input-versus-output.md)
established. So `value` is stringified on the way into the DOM and parsed on
the way out, and the hook's `value: string` is a claim about the *control*, not
about the state. That is honest, and it means a field whose input type is not
string-shaped needs its own control component rather than a raw `<input>`
spread.

⚠️ **Nothing checks that a field rendered exists in the form.** `form.field`
is checked, but a `<input name="coupon" />` written by hand alongside the
spread fields is not part of the form's state at all and submits nothing. The
type covers the fields you route through the hook; it has no view of the DOM.

## Gotchas

**★ `Record<string, string>` for form errors reads fine and checks nothing.**
Every key is valid, so a typo in `errors.postocde` is `undefined` forever and
the field silently never shows its error — a bug that survives review because
the code looks exactly like the working version.
`Partial<Record<FieldKeys<S>, string>>` makes the typo a compile error.

**★ `keyof z.input<S>` includes `symbol`, so it cannot be used as a `name`
prop.** `Extract<keyof z.input<S>, string>` narrows it to string keys. Skipping
the `Extract` produces an error about `symbol` not being assignable to
`string`, reported at the `Record` or at the JSX prop rather than at the
`keyof`.

**★ `Partial<Record<K, string>>` and `Record<K, string | undefined>` are not the
same type.** The first makes the key optional, so `'postcode' in errors` is a
meaningful check; the second requires every key to be present with a possibly
undefined value. Under `exactOptionalPropertyTypes` the difference is sharper
still. Use `Partial` for "the key may be absent", which is what an error map
is.

**★ The generic is `S extends z.ZodType`, so `z.input<S>` and `z.output<S>` are
resolved per call.** Constraining it to a concrete schema type
(`S extends z.ZodObject<any>`) buys nothing and rejects the perfectly ordinary
`AddressSchema.refine(…)`, which is not a `ZodObject`. Constrain to the widest
thing whose projections you need.

**★ Passing the schema inline re-creates it every render.** `useForm({schema:
z.object({…}), …})` allocates a new schema per render, so any memo or effect
keyed on it re-runs constantly — the same identity problem as
[chunk 03's](03-tuple-or-object-returns.md) `useLocalStorage`. Schemas are
module-level constants; the shared package is where these ones already live.

**★ `initial` is `z.input<S>`, so a schema with a `.default()` makes the field
optional in `initial` and present in `onSubmit`.** That is correct and it
surprises people: the form does not have to supply a value the schema will
default, but the submit handler is guaranteed one.
[Chapter 02·02b](../02-zod-as-the-source-of-truth/02b-defaults-and-optionals.md)
is the mechanism, including the `.default().optional()` ordering trap that
would put the `undefined` back.

**★ `onSubmit` returning `Promise<void>` is what makes `submitting` possible,
and a fire-and-forget `onSubmit` breaks it silently.** Declaring the parameter
as `(v) => Promise<void>` means a handler written `(v) => { void doIt(v); }`
fails to compile, which is the point: the hook needs the promise to know when
to clear `submitting`. A handler typed `(v) => void` would compile and leave
the button disabled forever, or never.

**★ Field-level errors coming back from the server are a different shape from
zod's.** The checkout's 409/402 responses carry an `ApiFailure` with a `code`,
not a per-field message, so `formError` is separate from `errors`. Merging them
into one map would require inventing a field name for `PAYMENT_DECLINED`.
Mapping specific codes onto specific fields is a per-form decision, made in the
component, from the discriminated failure type
[chapter 07·04](../07-the-typed-api-client/04-errors-as-a-result.md) produces.

## Interview questions

**★ How is `useForm` typed so that the form's initial values and its submit
handler see different types?**
By making the hook generic over the *schema* and using zod's two projections:
`initial` is `z.input<S>` and `onSubmit` receives `z.output<S>`. The form holds
strings in text inputs, so its state is the input side; the submit path parses,
so the handler receives the output side and cannot be handed anything unparsed.
Being generic over the schema rather than over a data type is what makes both
projections available from one parameter.

**★ Why `Partial<Record<K, string>>` for errors rather than `Record<string,
string>`?**
Because a valid field genuinely has no error, and `Record<string, string>`
claims every possible key is present and typed. Keying on the schema's field
names turns `errors.postocde` from a permanent `undefined` into a compile
error, and the `Partial` keeps the "no error" case expressible without a
sentinel. It is one of the cheapest type-level wins in a form.

**★ What does `Extract<keyof z.input<S>, string>` do that `keyof z.input<S>`
does not?**
Drops the `number` and `symbol` members. `keyof` produces `string | number |
symbol` in general, an HTML `name` attribute needs a `string`, and the error
you get without the `Extract` is reported at the JSX or at the `Record` rather
than at the `keyof`, which makes it hard to trace. It is a filter over a union
of key types, which is exactly what `Extract` is for.

**★ What can this typing not check?**
Two things. The control's `value` is `string` regardless of what the schema's
input type is, so a coerced numeric field is stringified in and parsed out — a
claim about the DOM, not about the state. And nothing relates the fields you
route through `field()` to the inputs actually rendered: a hand-written
`<input name="coupon">` next to the spread fields is invisible to the hook and
submits nothing. Both are boundaries between the type system and the DOM.

**★ Why must `onSubmit` return a promise?**
Because the hook clears `submitting` in a `finally` after awaiting it. Typing
the parameter `(v: z.output<S>) => Promise<void>` makes a synchronous
fire-and-forget handler a compile error, which is the desired outcome: with a
`void`-returning handler the hook has no way to know when the work finished and
the button either stays disabled or is re-enabled immediately, and neither
failure is visible in a type.

**★ Where do server-side errors fit?**
Not in `errors`. Zod's issues are per-field and the API's failures are per-code
— `OUT_OF_STOCK`, `PAYMENT_DECLINED` — with no field to attach to, so the hook
exposes `formError: ApiFailure | null` alongside the field map. Mapping a
particular code onto a particular field is a decision each form makes in its
own component, narrowing the discriminated failure type by `code`; forcing that
mapping into the hook would mean inventing field names for failures that have
none.

---

← Prev: [Events and contextual typing](08b-events-and-contextual-typing.md) ·
[Overview](README.md) ·
Next chapter → [The typed API client](../07-the-typed-api-client/README.md)
