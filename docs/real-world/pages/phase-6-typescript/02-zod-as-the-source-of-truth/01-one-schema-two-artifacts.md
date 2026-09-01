---
title: "One schema is the only artifact that exists at build time and at run time, which is why it gets to be the source of truth"
sidebar_label: "01 · One schema, two artifacts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** type declarations read directly
> from `node_modules/zod/v4/` in this repo (`core/core.d.ts`,
> `core/schemas.d.ts`, `classic/schemas.d.ts`, `classic/parse.d.ts`) and the
> [zod API reference](https://zod.dev/api). Compiler target **TypeScript
> 7.0.2** on **Node 24.19.0**, matching the
> [TypeScript syllabus](../../../../typescript/README.md).
> Concept homes: **`z.infer` and schema-first typing** belong to
> [Express — validate at the boundary](../../../../expressjs/pages/phase-8-validation-authz/01-validate-at-boundary/README.md);
> **literal types and `as const`** are
> [TypeScript 1·02](../../../../typescript/pages/phase-1-type-vocabulary/02-literal-types-and-as-const.md).
> The boundary this chapter types is
> [chapter 3·02](../../phase-3-express-api/02-the-validation-boundary.md).

**Types are erased and SQL is not checked, so at the two edges of this app the
compiler knows nothing.** A zod schema is the one thing that survives the
erasure: it runs at the boundary as a parser and it produces a type at build
time from the same declaration. That is not a convenience — it is the only
arrangement in which the check and the type cannot disagree, because there is
one declaration and two readings of it. Everything in this chapter follows
from that single property, including the parts that go wrong.

## Why the arrow points schema → type, never type → schema

There are two ways to make a type and a runtime check agree.

**Write the type, then write a check that matches it.** The check is a second
declaration of the same fact. Nothing relates them. Add `phone` to the type and
the parser silently keeps rejecting requests that carry it — or worse, keeps
accepting them and hands you a value the type says is present and the parser
never validated.

**Write the schema, then read the type off it.** One declaration. The type is a
*projection* of the check, so the two are related by construction and the
question "do they agree?" stops being a question.

```ts
// apps/api/src/routes/catalog.schemas.ts
import {z} from 'zod';

export const ProductParams = z.object({
  slug: z.string().min(1).max(120),
});

export type ProductParams = z.infer<typeof ProductParams>;
//   ^ { slug: string }
```

📌 **The schema and the type share a name on purpose.** TypeScript keeps values
and types in separate declaration spaces, so `const ProductParams` and `type
ProductParams` coexist. `import {ProductParams}` gets you the schema; `x:
ProductParams` gets you the type. One import, one name, no `ProductParamsType`
suffix that nobody remembers to update.

## What `z.infer` actually is

This is worth pinning down exactly, because the whole chapter's second chunk is
downstream of it. From `zod/v4/core/core.d.ts`, verbatim:

```ts
export type output<T> = T extends {
    _zod: {
        output: any;
    };
} ? T["_zod"]["output"] : unknown;
export type { output as infer };
```

> **`z.infer` is an alias for `z.output`.** Not a distinct inference
> mechanism — literally the same type, re-exported under a second name.

Two consequences you should hold now and cash in later:

1. **`z.infer` gives you the type of the value that comes *out* of `parse`** —
   after coercion, after defaults, after transforms. It is the *parsed* type,
   which is what handlers and services want.
2. **It is not the type of the value a client sends.** That is `z.input`, and
   for this app's query schemas it is not the type you want either. Chunk 02 is
   that argument in full.

Note the fallback: `T extends { _zod: { output: any } } ? … : unknown`. Hand
`z.infer` something that is not a schema — a plain object of schemas, a
function that returns a schema — and you do not get an error. **You get
`unknown`**, and `unknown` then fails at the use site with a message about the
use site, not about the mistake.

## The four schema families in this app, and where each lives

Not every schema is a boundary schema, and they do not all belong in the same
place. The storefront has four kinds:

| Family | Example | Lives in | Crosses the wire? |
|---|---|---|---|
| **Request** — query, params, body | `ListProductsQuery` | next to its route, `routes/*.schemas.ts` | the client builds against it |
| **Response** — what `res.json` promises | `ProductPage` | next to its route, exported | yes — both sides parse it |
| **Domain values** — reusable value shapes | `Address`, `Money`, `OrderStatus` | `@storefront/shared` | yes |
| **Environment** — config read once at boot | `Env` | `apps/api/src/config.ts` | 🔴 **never** |

The placement rule is
[chapter 1's inclusion test](../01-the-shared-types-package/01-why-a-package.md)
applied to schemas: *would both sides be wrong if they disagreed about this?*
`Address` yes — the checkout form and the checkout endpoint must agree field for
field. `Env` no — the client has no business knowing `DATABASE_URL` exists, and
a schema is a *description of the infrastructure* even though it holds no
values.

⚠️ **Request and response schemas live beside their routes, not in the shared
package, and the client imports them from there.** That looks like it violates
chapter 1's "never import across the boundary" rule and it does not: what
crosses is the *published contract module*, re-exported through the shared
package's `index.ts`. The rule that survives is mechanical — nothing under
`routes/` may import `pg`, `node:*` or the config, and the `exports` map means
a stray import fails to resolve rather than fails to notice.

## The one place the arrow legitimately reverses

Sometimes the type already exists — it came from the shared package, or from a
third party's `.d.ts` — and you need a schema that produces exactly it. zod's
`ZodType` is declared, verbatim from `zod/v4/classic/schemas.d.ts`:

```ts
export interface ZodType<
  out Output = unknown,
  out Input = unknown,
  out Internals extends core.$ZodTypeInternals<Output, Input>
    = core.$ZodTypeInternals<Output, Input>,
> extends core.$ZodType<Output, Input, Internals> { … }
```

So you can constrain a schema by the type it must produce:

```ts
import type {Address} from '@storefront/shared';

export const AddressSchema: z.ZodType<Address> = z.object({
  name:     z.string().min(1).max(120),
  line1:    z.string().min(1).max(200),
  city:     z.string().min(1).max(120),
  postcode: z.string().min(1).max(20),
  country:  z.string().length(2),
});
```

Drop a field and the annotation fails: `Output` is covariant (`out Output`), so
a schema producing `{name, line1, city, postcode}` is not assignable to
`ZodType<Address>` when `Address` also requires `country`.

🔴 **The check is one-directional, and that is the trap.** Covariance also means
a schema producing *extra* fields is still assignable — `{…Address, secret:
string}` is assignable to `Address`, so `z.ZodType<Address>` accepts a schema
that parses and keeps a field the type never mentions. And the second parameter
defaults to `unknown`, which every schema's input satisfies, so it constrains
nothing at all. Use the annotation to catch *omissions*; do not read it as
"this schema is exactly `Address`".

The honest version, when exactness matters, is a type-level assertion beside the
schema:

```ts
import type {Address} from '@storefront/shared';

export const AddressSchema = z.object({ /* … as above … */ });

// both directions, checked: neither type may have a field the other lacks
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _addressMatches: Exact<z.infer<typeof AddressSchema>, Address> = true;
```

If the schema and the type drift, `_addressMatches` stops being assignable from
`true` and the file fails to compile. It costs one unused constant per shape
you care about, and it is the only spelling here that fails in **both**
directions.

## What this buys at the phase gate

The gate for this phase is *rename a column, break the build everywhere it is
read*. Schemas are the second link in that chain: the query module's row type
(**chapter 03** *(not written yet)*) feeds a mapper whose return type is
`z.infer` of a response schema, and the client's rendering code consumes the
same `z.infer`. Break the mapper's input and the mapper stops compiling; change
the response schema and every consumer of the inferred type stops compiling.
Nothing in that chain is a runtime discovery.

## Gotchas

**★ `z.infer` on a non-schema silently yields `unknown`.**
The conditional falls through to `unknown` rather than erroring. The usual
victim is `z.infer<typeof schemas>` where `schemas` is the `{params, query,
body}` *bag* rather than one schema. The error then appears wherever the
`unknown` is used — a property access three files away — and reads like the
consumer's fault. Assert the input is a schema where it matters:

```ts
type InferSchema<S extends z.ZodType> = z.infer<S>;
// InferSchema<typeof someBag> is now an error at the definition, not the use
```

**★ Two names for one concept means two things to update, and one of them is a
comment.** The pattern `const X = z.object(…)` plus `type XType = z.infer<typeof
X>` reads fine and rots: someone adds `const Y` and forgets `YType`, and the
handler falls back to an implicitly-`any` parameter. Give the schema and the
type the same name so an incomplete addition is visibly incomplete.

**★ A schema is a value, so importing one is a runtime import.**
`import type {Address}` is erased; `import {AddressSchema}` is not. A React component that
only needs the *type* must use `import type`, or the entire zod schema graph for
that module lands in the bundle. `verbatimModuleSyntax` — already on, per
[chapter 1·02](../01-the-shared-types-package/02-consuming-it.md) — makes the
distinction explicit instead of incidental.

**★ Circular schema definitions do not infer.** `z.lazy` handles a recursive
category tree at run time, but the inferred type of a lazily self-referential
schema needs an explicit annotation — TypeScript cannot infer a type that
mentions itself through a function call. The app's category tree is one level
deep by
[schema constraint](../../phase-1-database/01-the-schema/01-conventions-identity-catalog.md),
so it never hits this; if it ever nests arbitrarily, the shape is declared by
hand and the schema is annotated with `z.ZodType<CategoryNode>`.

**★ `z.object()` strips unknown keys by default, and stripping is a silent
type lie in the other direction.** The inferred type says `{slug: string}` and
the parsed value is `{slug: string}` — accurate. What is lost is the *client's*
mistake: the docs say *"unrecognized keys are stripped from the parsed
result"*. This app writes `.strict()` on every request object precisely so the
mistake surfaces; the argument is
[3·02's](../../phase-3-express-api/02-the-validation-boundary.md) and the type
consequence is that no inferred request type ever carries an index signature.

**★ The `zod` version is part of the contract, not a dependency detail.**
`z.infer` resolved through `_zod.output` is a 4.x internal shape; a package
compiled against zod 3 and consumed by an app on zod 4 produces two unrelated
`ZodType` interfaces and a wall of assignability errors that never mentions
versions. Pin zod once at the workspace root, like `strict`.

## Interview questions

**★ Why is a schema a better source of truth than a TypeScript type?**
Because types are erased and the boundary is where erasure hurts. At the moment
untrusted bytes arrive, the compiler has already left; something has to check
at run time. Given that a runtime check must exist anyway, the only question is
whether the type is derived from it or declared separately — and separately
declared facts drift. Deriving costs nothing extra and removes the drift by
construction.

**★ `z.infer` and `z.output` — what is the difference?**
None. `zod/v4/core/core.d.ts` ends the definition of `output` with the
re-export `export type { output as infer }`. `z.infer` is a second name for the output type, kept
because it reads better at call sites. The distinction that matters is
`output` versus `input`, which is a real difference and the subject of the next
chunk.

**★ You already have an `Order` type from a third party. How do you get a
schema that provably matches it?**
Annotate the schema `z.ZodType<Order>` to catch missing and mistyped fields —
that works because the output parameter is covariant. It will *not* catch extra
fields, and its second parameter defaults to `unknown` so it says nothing about
input. When exactness matters, add a bidirectional type-level assertion beside
the schema (`Exact<z.infer<typeof S>, Order>` assigned `true`) so drift in
either direction is a compile error in the file that owns the schema.

**★ Where does an environment schema belong, and why not in the shared
package?**
In the API app, read once at boot. It never crosses the wire, so the shared
package's inclusion test rejects it, and a schema documents structure even
without values — `STRIPE_WEBHOOK_SECRET: z.string().min(32)` in a browser
bundle tells a reader what to go looking for. Typing `process.env` is
[TypeScript 7·03](../../../../typescript/pages/phase-7-server/03-typing-process-env/README.md).

**★ A colleague writes `const X = z.object(…)` and `type XShape = z.infer<typeof
X>`. What is wrong with it?**
Nothing mechanically — it is a naming choice that creates a second thing to
maintain. Because the two live in different declaration spaces, giving them the
same name works, so the suffix buys no disambiguation and costs a convention
every new schema has to follow correctly. Conventions that must be followed
correctly every time are the ones that are not.

**★ How does a schema help the phase gate — "a column rename breaks the
build"?**
The schema is the middle link. The row type describes what the query returns,
the mapper turns a row into `z.infer<typeof ResponseSchema>`, and the client
renders that same inferred type. Renaming a column breaks the row type, which
breaks the mapper, which is the function whose *output* type every consumer
depends on. The failure is at build time in three files and never at run time
in one user's browser.

---

← [Overview](README.md) ·
Next → [Input types and output types](02-input-versus-output.md)
