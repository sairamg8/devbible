---
title: "Defaults and optionals change the shape of the parsed object, so three chains that read alike produce three different types"
sidebar_label: "02b · Defaults & optionals"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo
> (`core/schemas.d.ts` — `$ZodDefaultInternals`; `classic/schemas.d.ts`) and the
> [zod API reference](https://zod.dev/api) for `.default()` semantics.
> **TypeScript 7.0.2**, zod **4.4.3**. Concept homes:
> [TypeScript 1·10 — null and undefined](../../../../typescript/pages/phase-1-type-vocabulary/10-null-and-undefined.md)
> and
> [TypeScript 10·05 — `exactOptionalPropertyTypes`](../../../../typescript/pages/phase-10-strictness/05-exactoptionalpropertytypes/README.md).
> The OpenAPI consequence is
> [3·12](../../phase-3-express-api/12-openapi.md).

**`.optional()`, `.default()`, `.nullable()` and their orderings are four
different statements about a field, and the inferred type is the only place the
difference is visible.** [The previous chunk](02-input-versus-output.md)
established that `z.infer` reads the *output* side; this one is what the output
side actually looks like once modifiers are stacked, why `.default()` deletes a
whole class of `?? fallback` from consumers, and the one place in this app
where `z.input` is genuinely the type you want.

## `.optional()`, `.default()` and the shape of the parsed object

Three spellings that read alike and produce three different output types:

```ts
z.string().optional()             // out: string | undefined,  key optional
z.string().default('x')           // out: string,              key REQUIRED
z.string().optional().default('x')// out: string,              key required
z.string().nullable()             // out: string | null,       key required
```

The rule underneath: **`.default()` removes `undefined` from the output**
(`util.NoUndefined<core.output<T>>` in the declaration above), which makes the
key required in the inferred object. That is why 3·12's OpenAPI chapter finds
every defaulted field marked `required` in the generated document — the
document describes the *parsed* contract, and the parsed contract really does
always have the field.

🔴 **Order matters and the two orders are not equivalent.**
`.default('x').optional()` produces `string | undefined` again, because
`.optional()` wraps the defaulted schema and re-admits `undefined` on the
output side. That is almost never what anyone means, and it compiles.

**Under `exactOptionalPropertyTypes`** — which this app sets, per
[TypeScript 10·05](../../../../typescript/pages/phase-10-strictness/05-exactoptionalpropertytypes/README.md)
— the difference between `category?: string` and `category?: string |
undefined` becomes visible: the first refuses an explicit `category: undefined`,
the second accepts it. zod's inferred optionals are the second form, so
constructing a request object with `category: undefined` still compiles. If you
want "omit it or give a string, never both", the request object has to be built
by conditional spreads:

```ts
const query = {
  ...(filters.category != null && {category: filters.category}),
  ...(filters.minCents != null && {min_cents: filters.minCents}),
  sort: filters.sort,
} satisfies ListProductsRequest;
```

## Where `z.input` genuinely is the right type

It is not useless — it is the right type in exactly one place: **a form's raw
values, before submit.** `useForm` holds strings in text inputs and parses on
submit, so its state is the input side and its `onSubmit` receives the output
side:

```ts
// apps/web/src/hooks/useForm.ts — the signature, typed both ways
export function useForm<S extends z.ZodType>(opts: {
  schema: S;
  initial: z.input<S>;                      // what the inputs hold
  onSubmit: (parsed: z.infer<S>) => Promise<void>;   // what the handler gets
}): UseForm<S> { … }
```

That is a real distinction with a real payoff: the checkout form's `initial`
may hold `''` for a field the schema requires to be non-empty, and `onSubmit`
cannot be handed anything but a fully parsed `Address`. The typing of the whole
hook is
**chapter 06 · Typing the custom hooks** *(not written yet)*.

## Gotchas

**★ `.default()` after `.optional()` is not the same as before it.**
`.optional().default('x')` gives a required `string`; `.default('x').optional()`
gives `string | undefined`. Both compile, and the second reintroduces exactly
the `?? fallback` in every consumer that the default was added to delete. Read
every chain right-to-left: the last wrapper decides the output type.

**★ The default value is checked against the *output* type, not the input
type.** The zod docs: *"the default value must be assignable to the output type
of the schema."* So `z.coerce.number().default('24')` is a compile error — even
though `'24'` is exactly what the wire sends and exactly what the schema would
happily coerce if it arrived. Write `.default(24)`. The error message names the
default's type and not the coercion, so it reads like a mystery until you know
the rule.

**★ Response schemas must not carry `.default()`.**
A default on a response schema means the *parser* invents data when the server
omits a field, so a missing `total_cents` renders as a free order rather than
raising. Defaults encode a server policy about absent *input*; on a response
they encode a client fabrication about absent *output*. Response schemas use
`.optional()` or `.nullable()` and force the consumer to decide:

```ts
export const OrderSummary = z.object({
  id: z.number().int(),
  status: OrderStatusSchema,
  total_cents: z.number().int(),           // required: absence is a bug
  shipped_at: z.iso.datetime().nullable(), // explicitly "not yet"
});
```

**★ `.transform()` inside a request schema moves an error code.**
It is tempting to `.transform()` the base64 cursor into `{value, id}` in
`ListProductsQuery`, since the schema already runs at the boundary. The parse
failure then becomes 3·02's `VALIDATION` 400 with a zod issue path — but
[3·05's contract](../../phase-3-express-api/05-catalog-endpoints.md) says a bad
cursor is `BAD_CURSOR`. A convenience at the type level silently rewrote the
wire contract. Keep decoding in `decodeCursor`, where it throws the documented
error, and let the schema check only that the string is plausible:

```ts
cursor: z.string().max(200).optional(),   // shape only; decodeCursor owns meaning
```

**★ `.catch()` is `.default()`'s dangerous cousin and infers the same way.**
`z.coerce.number().catch(24)` yields `number` and swallows *every* failure —
`?limit=abc` silently becomes 24 instead of a 400. The inferred type is
identical to `.default(24)`'s, so nothing in the type system distinguishes "I
supplied a value for absence" from "I suppressed all validation". This app uses
`.catch()` nowhere on a request path; the one legitimate use is parsing
persisted client state (`useLocalStorage`'s mirror), where a corrupt value must
degrade rather than throw.

**★ `.nullable()` and `.optional()` are not interchangeable and JSON knows the
difference.** `null` is a value JSON can carry; `undefined` is not — it
disappears in `JSON.stringify`. So a response field that is *sometimes absent*
must be `.nullable()`, because "absent" cannot round-trip through the wire as
`undefined` and the client would see the key missing rather than null. Requests
are the reverse: a client omits a key it has no value for, so request fields are
`.optional()`.

**★ A defaulted field makes the *whole object* required in a nested schema.**
`z.object({page: z.object({limit: z.number().default(24)})})` still requires
`page` — the default lives on `limit`, not on `page`. Consumers read "it has a
default" and assume the parent is optional too. If the parent may be absent,
`.default({})` on the parent as well, and then the inner default fires for the
synthesised object.

## Interview questions

**★ Why does `.default()` make a field required in the inferred type?**
Because the inferred type is the output type, and `$ZodDefaultInternals`
declares the output as `util.NoUndefined<core.output<T>>`. Parsing an absent
field yields the default, so the parsed value always has the key. It is a
feature, not an artifact: it deletes every `?? 24` from every consumer and
guarantees they all agree on what the fallback is, because there is one.

**★ 3·12's generated OpenAPI marks every defaulted query field `required`.
Bug or correct?**
Correct, and it is describing the parsed contract rather than the wire. A
caller may omit `limit`; the parsed request always has it. If you want the
document to describe what a caller may send, generate with `io: 'input'` — and
then accept `unknown` for every coerced field, which is why the generation step
has to make a deliberate choice rather than take the default.

**★ Someone puts `.default(0)` on a response schema field. What breaks?**
Nothing visibly, which is the problem. The client's parse fills in `0` for a
field the server did not send, so an omitted `total_cents` renders as a free
order instead of failing loudly. The failure has been converted from a loud
parse error into a quiet wrong number, which is the worst trade in the
catalogue.

**★ What does `exactOptionalPropertyTypes` change about zod's inferred types?**
zod infers `key?: T | undefined`, which under that flag is meaningfully
different from `key?: T`: the first accepts an explicit `key: undefined`, the
second accepts only omission. A hand-written application type and a zod-inferred
type that read identically are therefore not assignable in the direction you
expect. Build request objects with conditional spreads rather than assigning
`undefined`, and the difference stops mattering.

**★ When is `z.input` the type you actually want?**
When something holds the *unparsed* values: a controlled form. `useForm`'s
`initial` is `z.input<S>` because text inputs hold strings including the empty
string, and its `onSubmit` receives `z.infer<S>` because it may not run until
parsing succeeded. Naming both in one signature is what makes the hook's
contract readable — the form's state and the submit payload are different types
and the schema relates them.

**★ Why not simply use `.catch()` everywhere and never return a 400?**
Because `.catch()` makes every malformed request look like a well-formed one.
The client's bug never surfaces, the scraper's probe gets a 200, and the
inferred type is identical to the honest version's, so review cannot see the
difference. A boundary exists to make bad input *visible*; `.catch()` is for
data you already own and cannot re-request, such as a corrupt localStorage
mirror.

---

← Prev: [Input types and output types](02-input-versus-output.md) ·
[Overview](README.md) ·
Next → [The validated request type](03-the-validated-request-type.md)
