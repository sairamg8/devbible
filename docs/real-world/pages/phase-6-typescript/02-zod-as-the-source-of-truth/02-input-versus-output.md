---
title: "A schema has two types and the wrong one is the one that looks right, because coercion and defaults make input and output different shapes"
sidebar_label: "02 · Input vs output"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo —
> `core/schemas.d.ts` (`$ZodTypeInternals`, `$ZodDefaultInternals`,
> `$ZodNumberInternals`), `classic/coerce.d.ts`, `classic/parse.d.ts` — and the
> [zod API reference](https://zod.dev/api). **TypeScript 7.0.2**, zod **4.4.3**.
> Concept home: **optional vs undefined** is
> [TypeScript 1·10](../../../../typescript/pages/phase-1-type-vocabulary/10-null-and-undefined.md);
> **`exactOptionalPropertyTypes`** is
> [TypeScript 10·05](../../../../typescript/pages/phase-10-strictness/05-exactoptionalpropertytypes/README.md).
> The schema being typed is
> [3·02's `ListProductsQuery`](../../phase-3-express-api/02-the-validation-boundary.md).

**Every zod schema carries two types, and for this app's query schemas they are
wildly different: the output is a precise object of numbers and unions, the
input is very nearly `unknown`.** That asymmetry is created by exactly the two
features 3·02's boundary depends on — `z.coerce` and `.default()` — so it is not
an edge case in this codebase, it is the main case. Getting it wrong produces a
client that compiles against a type meaning "anything" and a server that
compiles against a type meaning "already parsed", with the actual wire format
described by neither.

## The declaration, and what it forces

`$ZodTypeInternals` is parameterised **output first**, verbatim from
`zod/v4/core/schemas.d.ts`:

```ts
export interface $ZodTypeInternals<out O = unknown, out I = unknown>
  extends _$ZodTypeInternals { … }
```

Two schema kinds in this app fill those slots asymmetrically.

**`.default()`** — verbatim:

```ts
export interface $ZodDefaultInternals<T extends SomeType = $ZodType>
  extends $ZodTypeInternals<util.NoUndefined<core.output<T>>,
                            core.input<T> | undefined> { … }
```

Read it as a sentence: **output loses `undefined`, input gains it.** The zod
docs put the runtime half the same way:

> *"In Zod, setting a default value will short-circuit the parsing process. If
> the input is `undefined`, the default value is eagerly returned."*

**`z.coerce.*`** — verbatim from `zod/v4/classic/coerce.d.ts`:

```ts
export interface ZodCoercedNumber<T = unknown>
  extends schemas._ZodNumber<core.$ZodNumberInternals<T>> {}
export declare function number<T = unknown>(
  params?: string | core.$ZodNumberParams): ZodCoercedNumber<T>;
```

and `$ZodNumberInternals<Input = unknown> extends $ZodTypeInternals<number,
Input>`. The output is `number`. **The input parameter defaults to `unknown`
and nothing in a normal call site supplies it**, because coercion means "I will
take whatever you have and try". Compare plain `z.number()`, declared
`ZodNumber extends _ZodNumber<core.$ZodNumberInternals<number>>` — input
`number`.

## The two types of one real schema

```ts
export const ListProductsQuery = z.object({
  category:  z.string().min(1).max(80).optional(),
  min_cents: z.coerce.number().int().min(0).optional(),
  max_cents: z.coerce.number().int().min(0).optional(),
  sort:      z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  cursor:    z.string().max(200).optional(),
  limit:     z.coerce.number().int().min(1).max(48).default(24),
}).strict();
```

```ts
type Out = z.infer<typeof ListProductsQuery>;
// {
//   category?: string | undefined;
//   min_cents?: number | undefined;
//   max_cents?: number | undefined;
//   sort: 'newest' | 'price_asc' | 'price_desc';   // required — default applied
//   cursor?: string | undefined;
//   limit: number;                                  // required — default applied
// }

type In = z.input<typeof ListProductsQuery>;
// {
//   category?: string | undefined;
//   min_cents?: unknown;      // ← coercion: input parameter left at its default
//   max_cents?: unknown;
//   sort?: 'newest' | 'price_asc' | 'price_desc' | undefined;
//   cursor?: string | undefined;
//   limit?: unknown;
// }
```

Look at what each is good for.

**`Out` is the handler's type and it is excellent.** `sort` and `limit` are
required because the default guarantees them, so no handler writes `q.limit ??
24` and no two handlers disagree about the fallback. This is the payoff of
parse-don't-validate expressed in the type system: the defaulting happened once,
at the door, and the type records that it happened.

🔴 **`In` is not the type of an HTTP query string, and it is not a useful
client type either.** Two independent reasons:

1. `min_cents` and `limit` are `unknown`, so a client building a request object
   against `In` gets no checking on the fields most likely to be wrong.
2. Even with plain `z.number()`, `In` would say `number` — and a query string
   is text. `?limit=24` is the string `"24"`. The input type of a coercing
   schema describes *the thing before coercion in JavaScript terms*, which for
   a query string is a level of abstraction that does not exist on the wire.

## So what type does the client build a request against?

Not `z.input`. Write the wire shape as its own schema, in the shared package,
and let the server's schema be the parser for it:

```ts
// packages/shared/src/api.ts — what the CLIENT constructs
export const ListProductsRequest = z.object({
  category:  z.string().min(1).max(80).optional(),
  min_cents: z.number().int().min(0).optional(),
  max_cents: z.number().int().min(0).optional(),
  sort:      z.enum(['newest', 'price_asc', 'price_desc']).optional(),
  cursor:    z.string().max(200).optional(),
  limit:     z.number().int().min(1).max(48).optional(),
});
export type ListProductsRequest = z.infer<typeof ListProductsRequest>;
```

The client holds numbers, serialises them, and the server's coercing schema
turns the text back into numbers. Two schemas, deliberately — they describe two
different things (a JavaScript request object, and an HTTP query string) and
collapsing them is what produced `unknown` in the first place. The pair is kept
honest by one type-level assertion in the API app:

```ts
// apps/api/src/routes/catalog.contract.ts
import type {ListProductsRequest} from '@storefront/shared';
import {ListProductsQuery} from './catalog.schemas.js';

// every field the client may send must be parseable by the server schema,
// and the parsed result must have no field the client cannot influence
type ServerOut = z.infer<typeof ListProductsQuery>;
const _covers: (req: ListProductsRequest) => ServerOut = (req) =>
  ListProductsQuery.parse(req);
```

If someone adds `brand` to the client request and not to the server schema,
`.strict()` makes the parse reject it at run time — and this assignment is
where you find out at build time, because `ListProductsQuery.parse` accepts
`unknown` but the *return* type must still cover every field the handler reads.

⚠️ **Be honest about what that assertion does and does not catch.** It is a
compile-time check that the two schemas are structurally compatible where the
types overlap; it does not run the parse, so a *value* constraint that only the
server has (`.max(48)` vs the client's `.max(48)`) is still two declarations.
The one bulletproof arrangement is a single shared schema plus a coercion
wrapper, and this app declines it because the coercion wrapper then has to live
in the shared package and the client pulls in a parser it never runs.

## Gotchas

**★ `z.input` of a coerced field is `unknown`, so it type-checks everything.**
`ZodCoercedNumber<T = unknown>` never has its parameter supplied at a normal
call site. A client request type derived from `z.input` therefore accepts
`{limit: 'lots'}` with no complaint, and the failure moves to a 400 in
production. Derive client request types from a separate non-coercing schema.

**★ `.default()` makes the key required in the output and optional in the
input, and people read only one of those.** The handler sees `limit: number`
and concludes the client must send it; the client sees `limit?: unknown` and
concludes anything goes. Both are reading a true statement about a different
type. Name the two types explicitly wherever both matter —
`type ListProductsParsed = z.infer<…>` and `type ListProductsRequest =
z.infer<…>` from the request schema — so no one has to remember which side of a
`z.` prefix they are on.

**★ `z.infer` of a schema built by a generic helper collapses to `unknown`.**
Write `function page<T extends z.ZodType>(item: T) { return z.object({items:
z.array(item), next_cursor: z.string().nullable()}); }` and the return type is
inferred well — but only if the helper's return type is left to inference. Add
an explicit `: z.ZodType` return annotation and every caller's `z.infer` becomes
`unknown`, because `ZodType`'s output parameter defaults to `unknown`. Never
annotate a schema *factory*'s return type.

**★ `z.output` and `z.infer` on a `ZodPipe` are the far end, not the near
end.** `z.string().pipe(z.coerce.date())` outputs `Date`; `z.input` is `string`.
The app has one of these (the admin CSV import) and it is the one place where
both types are named in the same function signature — parse takes `z.input`,
returns `z.infer`, and neither name is optional for a reader.

## Interview questions

**★ A schema has two types. Name them and say which one a handler uses.**
`z.input` (before parsing) and `z.output`, aliased `z.infer` (after). The
handler uses `z.infer` — it runs behind the boundary, so it sees coerced values
and applied defaults. The client does not use `z.input`, because for a coercing
schema the input type is `unknown`.

**★ Why is `z.input<typeof ListProductsQuery>` nearly useless as a client
type?**
Two reasons compound. `z.coerce.number()` is declared `ZodCoercedNumber<T =
unknown>`, so its input type is `unknown` unless someone supplies the parameter
— nobody does. And even without coercion, the input type would describe
JavaScript values while the wire carries a query string, so it is describing a
stage that does not exist. The fix is a separate, non-coercing request schema
whose output type *is* the client's request object.

**★ How do you keep a client request schema and a server query schema from
drifting, given they must be two schemas?**
A compile-time bridge in the API app: a function typed `(req:
ListProductsRequest) => z.infer<typeof ListProductsQuery>` implemented as
`ListProductsQuery.parse(req)`. Adding a field on either side breaks it. It
does not check value bounds — those are still two declarations — so bounds that
must match live as shared constants (`MAX_PAGE_SIZE`) referenced by both.

---

← Prev: [One schema, two artifacts](01-one-schema-two-artifacts.md) ·
[Overview](README.md) ·
Next → [Defaults, optionals and the parsed shape](02b-defaults-and-optionals.md)
