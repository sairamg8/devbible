---
title: "The type of a validated request is a mapped type over the schemas that validated it, which is how one middleware factory types every route differently"
sidebar_label: "03 · The validated request type"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo
> (`classic/parse.d.ts` — `ZodSafeParseResult`, `ZodSafeParseSuccess`,
> `ZodSafeParseError`) and the TypeScript handbook's
> [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html).
> **TypeScript 7.0.2**, zod **4.4.3**, Express **5**. Concept homes:
> [TypeScript 5·01 — mapped types](../../../../typescript/pages/phase-5-type-level/01-mapped-types/README.md),
> [TypeScript 3·04 — `keyof`](../../../../typescript/pages/phase-3-generics/04-keyof/README.md).
> The middleware being typed is
> [3·02's `validate`](../../phase-3-express-api/02-the-validation-boundary.md).

**`validate({query: ListProductsQuery})` and `validate({body: CheckoutBody})`
are the same function and must produce different types.** That is a mapped type
over the schemas bag, and it is the single piece of type-level machinery this
phase genuinely needs. Get it right and every handler in the API knows the
exact shape of its own input with no annotation, no cast and no `as`. Get it
wrong — the usual way is a global `req.valid: any` — and the boundary still
runs, still rejects bad input, and tells the compiler nothing, which means the
validation is real and the types around it are decoration.

## The requirement, written as a type

The middleware receives a bag with up to three keys, each holding a schema. It
must produce an object with **the same keys** — no more, no fewer — each holding
that schema's parsed type.

```ts
// apps/api/src/middleware/validate.ts
import {z} from 'zod';

export type Schemas = {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
};

export type Valid<S extends Schemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.infer<S[K]> : never;
};
```

Two things are doing work here and both are easy to lose.

**The mapping is homomorphic** — `[K in keyof S]` over the *type parameter*
itself, not over a fixed key union. That is what makes optionality flow
through: if the caller passed only `{query}`, `S` has one key, `Valid<S>` has
one key, and `v.body` is a compile error rather than `undefined`. Writing
`[K in 'params' | 'query' | 'body']` instead gives every route all three keys
with `never` in the unused slots, and `never` propagates into consumers as an
error message about the wrong line.

**The conditional unwraps rather than indexes.** `S[K]` is
`z.ZodType | undefined` as far as the constraint knows, and `z.infer` of
`undefined` is `unknown` (its conditional falls through). The
`S[K] extends z.ZodType ? … : never` guard makes the failure a `never` you
cannot use rather than an `unknown` that swallows everything.

## The factory, typed

```ts
// apps/api/src/middleware/validate.ts (continued)
import type {Request, Response, NextFunction, RequestHandler} from 'express';
import {ApiError} from './errors.js';

const PARTS = ['params', 'query', 'body'] as const;

export function validate<const S extends Schemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    const out: Record<string, unknown> = {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return next(new ApiError(400, 'VALIDATION', 'invalid request', {
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'), message: i.message,
          })),
        }));
      }
      out[part] = result.data;
    }
    req.valid = out as Valid<S>;
    next();
  };
}
```

📌 **`safeParse` instead of `parse` plus a `catch`.** The declared result is a
discriminated union, verbatim from `zod/v4/classic/parse.d.ts`:

```ts
export type ZodSafeParseResult<T> = ZodSafeParseSuccess<T> | ZodSafeParseError<T>;
export type ZodSafeParseSuccess<T> = { success: true; data: T; error?: never };
export type ZodSafeParseError<T> = { success: false; data?: never; error: ZodError<T> };
```

`error?: never` and `data?: never` are the reason this narrows perfectly:
after `if (!result.success)`, `result.data` is not merely possibly-undefined, it
is `never`, so reading it is an error rather than a silent `undefined`. The
`try`/`catch` version in
[3·02](../../phase-3-express-api/02-the-validation-boundary.md) works and needs
`err instanceof ZodError` to recover a type the compiler could have kept.
`safeParse` is the typed spelling of the same middleware.

🔴 **`req.valid = out as Valid<S>` is a cast, and it is the one unsound line in
the design.** It has to be: `req` is Express's one global `Request` interface,
so `valid` has one type for every route, while `Valid<S>` differs per route.
Nothing the compiler can see connects the middleware that ran to the handler
that follows. That is not a zod problem — it is an Express-shaped hole, and
[chapter 05 · Typed Express handlers](../05-typed-express-handlers/README.md) is where it gets
closed properly. What follows is how this app avoids needing it at all.

## Typing the failure path

`ZodError.issues` is `$ZodIssue[]`, and the wire shape 3·02 sends is a
projection of it:

```ts
import {z} from 'zod';

export type ValidationIssue = {path: string; message: string};

export function toIssues(err: z.ZodError): ValidationIssue[] {
  return err.issues.map((i) => ({path: i.path.join('.'), message: i.message}));
}
```

`i.path` is an array of `PropertyKey`-ish segments, not a string, which is why
the `.join('.')` is not cosmetic — the error contract's `issues[].path` field is
documented as a dotted string and `String(i.path)` would produce a
comma-separated one on nested fields. zod also ships `z.treeifyError`,
`z.flattenError` and `z.prettifyError`; this app maps by hand because the wire
shape is
[the error contract's](../../phase-3-express-api/09-the-error-contract.md), not
zod's, and pinning it here means a zod upgrade cannot silently reshape an API
response.

## Gotchas

**★ A non-homomorphic mapped type gives every route all three keys.**
`{[K in 'params'|'query'|'body']: …}` looks equivalent and is not: routes that
declared no body get `body: never`, `v.body` type-checks, and the error appears
at the first property access with a message about `never` rather than about the
missing schema. Map over `keyof S`.

**★ Without `const` on the type parameter, the schemas bag widens.**
`validate<S extends Schemas>` infers `S` as `Schemas` itself when the argument
is an object literal in some positions, which makes every key optional and
every parsed type `unknown`. `<const S extends Schemas>` keeps the literal
shape. `const` type parameters are
[TypeScript 3·12](../../../../typescript/pages/phase-3-generics/12-const-type-parameters/README.md);
this is the app's load-bearing use of them.

**★ `safeParse` narrows only if you check `success` first.**
`result.data` before the `if` is `T | undefined` at best; after `if
(!result.success) return`, it is `T`. Destructuring immediately —
`const {data} = schema.safeParse(x)` — throws the discriminant away and leaves
you with `T | undefined` and no way back. Keep the result object until you have
branched on it.

**★ `Valid<S>` is computed at every use site, and deep schemas make it slow.**
The mapped type is cheap; `z.infer` of a 40-field object with nested unions is
not, and it is re-evaluated per route. If editor responsiveness degrades, the
fix is to name the inferred types once (`type ListProductsParsed = z.infer<typeof
ListProductsQuery>`) so the compiler caches an alias instead of re-deriving —
[TypeScript 5·09 on type-level performance](../../../../typescript/pages/phase-5-type-level/09-type-level-performance/README.md)
covers why.

**★ The parsed value replaces the raw one only in `req.valid`, not in
`req.query`.** Express 5 makes `req.query` a getter, and 3·02 deliberately does
not overwrite it. So a handler that reads `req.query.limit` gets the *string*
`'24'` with type `string | string[] | ParsedQs | …`, and TypeScript will let
you compare it to a number without complaint under `==`. The lint rule that
bans `req.query` in `routes/` is not stylistic; it is the only thing keeping the
unparsed value out of handlers.

## Interview questions

**★ Why must `Valid<S>` be a mapped type rather than an interface?**
Because the shape depends on the argument. One route validates a query, another
a body, a third both — an interface would have to declare all three keys as
optional, and then every handler starts with a non-null assertion. The mapped
type makes "this route has no body" a fact the compiler knows, so `v.body` is an
error and not a runtime `undefined`.

**★ Why does mapping over `keyof S` behave differently from mapping over a
fixed key union?**
A mapped type over the type parameter's own keys is *homomorphic*: TypeScript
preserves the source's optionality and readonly modifiers and produces exactly
the source's key set. A fixed union produces all the keys unconditionally, so
unused slots become `never` and the mistake surfaces far from its cause.

---

← Prev: [Defaults, optionals and the parsed shape](02b-defaults-and-optionals.md) ·
[Overview](README.md) ·
Next → [The route helper](03b-the-route-helper.md)
