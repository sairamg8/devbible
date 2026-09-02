---
title: "The error handler takes unknown in and the shared ErrorBody out, so its two generics are the only annotations it needs and an error code outside the union no longer compiles"
sidebar_label: "03c · The error contract, typed"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — `ErrorRequestHandler`, `Response.status` — and the
> **zod 4.4.3** declarations (`z.enum`, `.catchall`).
> **TypeScript 7.0.2**, Express **5**, zod **4.4.3**. Concept homes:
> [TypeScript 7·05](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/01-the-five-generics.md)
> owns the `err: any` argument;
> [TypeScript 1·02 — literal types and `as const`](../../../../typescript/pages/phase-1-type-vocabulary/02-literal-types-and-as-const.md).
> The contract being typed is
> [3·09's](../../phase-3-express-api/09-the-error-contract.md).

**The error handler is the one function in the API whose input is genuinely of
unknown provenance and whose output is a contract the client parses.** Typing
it is two decisions: annotate `err` as `unknown` against a declaration that
says `any`, and name the shared `ErrorBody` as the response type so that every
`res.json` in the funnel is checked against the wire shape. This chunk makes
both decisions and builds the shape they refer to; [the next](03d-the-classify-table-and-the-handler.md)
rewrites 3·09's classify table against them.

## The declaration, and the one annotation

Verbatim:

```ts
export type ErrorRequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
> = (
    err: any,
    req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
    res: Response<ResBody, LocalsObj>,
    next: NextFunction,
) => unknown;
```

`err: any`. [TypeScript 7·05](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/01-the-five-generics.md)
makes the argument for overriding it and this chunk does not repeat it; the
override is one annotation, legal because a parameter may be narrower than the
type it satisfies:

```ts
export const errorHandler = ({config}: Deps): ErrorRequestHandler<ParamsDictionary, ErrorBody> =>
  (err: unknown, req, res, next) => { … };
//  ^^^^^^^^^^^^ narrower than any — restores every guard
```

Two generics are named: `P` because it is first and must be, and `ResBody =
ErrorBody`, so that `res.status(status).json(body)` is checked against the wire
shape [3·09](../../phase-3-express-api/09-the-error-contract.md) fixed. The
same asymmetry chunk 02 named holds here: `ResBody` checks data this function
produces and is therefore a guarantee; `err` describes data that arrived from
anywhere and is therefore `unknown`.

## The error shape, in the shared package

The shape lives in the shared package, because
[chapter 1](../01-the-shared-types-package/01-why-a-package.md) put the error
shape on the client's side of the line:

```ts
// packages/shared/src/api.ts
import {z} from 'zod';

export const ERROR_CODES = [
  'VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
  'OUT_OF_STOCK', 'EMPTY_CART', 'PAYMENT_DECLINED', 'INVALID_TRANSITION',
  'STALE_STATUS', 'EMAIL_TAKEN', 'ALREADY_REVIEWED', 'BAD_REFERENCE',
  'BAD_CURSOR', 'BAD_SIGNATURE', 'TOO_MANY_FILES', 'TOO_LARGE', 'BAD_TYPE',
  'PAYLOAD_TOO_LARGE', 'RATE_LIMITED', 'TIMEOUT', 'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorBody = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.enum(ERROR_CODES),
  request_id: z.string(),
}).catchall(z.unknown());              // per-code extras: product_ids, issues
export type ErrorBody = z.infer<typeof ErrorBody>;
```

The twenty-one codes are every string phases 3 and 6 have passed to
`new ApiError(...)`, collected once. `.catchall(z.unknown())` is what admits
`product_ids` and `issues` without naming them — the extras are per-code and
[chapter 07](../07-the-typed-api-client/README.md) is where the client
narrows them by `code`. Here the point is that `code` is a union of literals,
so an `ApiError` constructed with a code that is not in the array does not
compile:

```ts
// apps/api/src/middleware/errors.ts
import type {ErrorCode} from '@storefront/shared';

export class ApiError extends Error {
  readonly expose = true as const;
  constructor(
    readonly status: number,
    readonly code: ErrorCode,             // ← 'OUT_OF_STOK' is a compile error
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

📌 **`z.enum(ERROR_CODES)` and `ErrorCode` are one declaration.** The schema
takes the `as const` tuple, so the runtime check on the client and the
compile-time union on the server are the same list — the pattern
[chapter 2·05](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
settled for `OrderStatus`, applied to the error path. Adding a code is one
line, and every `switch` on `ErrorCode` that lacks a case for it stops
compiling.

## What the two generics leave unchecked

Honest remainder, because the response type looks like more than it is:

- **`res.status()` takes any `number`.** `Response`'s third generic,
  `StatusCode extends number = number`, could be narrowed; this app does not
  bother — the classify table is the single source of statuses and a test
  asserts each row's status is one the API documents.
- **`body.status` and `res.status(status)` are two values the type never
  relates.** A handler that sends `res.status(500).json({status: 409, …})`
  compiles. The construction in the next chunk uses one `status` variable for
  both, which is discipline, not typing.
- **`extra` is `Record<string, unknown>`.** A route attaching
  `product_ids: 'oops'` compiles on the server. The per-code extras are typed
  where they are consumed — the client — and asserted by the contract test.

## Gotchas

**★ `ErrorRequestHandler` from `express` and from `express-serve-static-core`
are two declarations with the same name.** `@types/express` declares an
`interface ErrorRequestHandler` that extends the core type alias with
`ReqQuery = core.Query`. They are assignable to each other and the choice does
not matter for application code; what matters is importing the *type* with
`import type`, since neither package exports a runtime value by that name.

**★ `res.status(status)` accepts any `number`, and `ErrorBody.status` is
`z.number().int()`, so a status of `0` or `9999` type-checks.** The
`StatusCode` generic on `Response` (third slot, `extends number = number`)
could be narrowed to a union of the statuses this app emits, but the app does
not — the classify table is the single source of statuses, and a test asserts
each row's status is one of the eight the API documents. A literal union here
buys little and costs a cast in every `res.status`.

**★ `.catchall(z.unknown())` admits extras but does not let the server *type*
them.** `ApiError.extra` is `Record<string, unknown>`, so a route can attach
`product_ids: 'oops'` and the server compiles. The per-code extras are typed
on the *client* side, where they are narrowed by `code` — chapter 07. Typing
them on the server too would mean an `ApiError` subclass per code, which is
more ceremony than twenty-one codes justify; the contract test asserts the
shape of each documented extra instead.

**★ `ERROR_CODES` in the shared package is a runtime export, and the shared
package's browser build must carry it.** It is an array, not a type — the
client's `z.enum(ERROR_CODES)` parse needs it at run time. The rule from
[chapter 1](../01-the-shared-types-package/01-why-a-package.md) that the
package holds no server imports is what makes this safe; the array imports
nothing.

**★ `readonly expose = true as const` is a literal, and it exists so nothing
can widen it.** The JavaScript set `this.expose = true` as a flag; the port
makes it a `true` literal so that a `known.expose ? … : …` branch is a
compile-time constant and a subclass cannot set it to `false` without a
type error. There is no "sometimes expose" `ApiError`; a message that must
be hidden is a `null` from classify.

## Interview questions

**★ Express types the error handler's `err` as `any`. What do you do and why
is it allowed?**
Annotate the parameter `err: unknown`. A parameter may be narrower than the
type it satisfies — the function still accepts anything, it just refuses to
let the body read properties without a guard. That restores `instanceof` and
structural checks in the one function whose entire job is classifying a value
of unknown provenance.

**★ Why is `ApiError.code` typed `ErrorCode` and not `string`?**
Because `ErrorBody.code` on the wire is `z.enum(ERROR_CODES)`, and the client
switches on it. A `string` here lets the server emit a code the client's union
does not include, and the client's parse rejects a perfectly good error
response. With the literal union, adding a code is one edit to the `as const`
array and a compile error at every `switch` that should handle it — the phase
gate, on the error path.

**★ What does `ResBody = ErrorBody` on the error handler actually check?**
That every `res.json` call in the handler receives an `ErrorBody` — `type`,
`title`, `status`, `code` from the union, `request_id`. A refactor that drops
`request_id` fails to compile in the error handler rather than shipping
uncorrelatable errors. It does not check the status code passed to
`res.status`, and it does not check that the body's `status` field matches it;
the classify table's tests do.

**★ Where does the per-code extra — `product_ids` on `OUT_OF_STOCK` — get its
type?**
Not on the server. `ApiError.extra` is `Record<string, unknown>` and
`ErrorBody` admits extras through `.catchall(z.unknown())`. The client narrows
`ErrorBody` by `code` into a discriminated union whose `OUT_OF_STOCK` member
declares `product_ids: number[]`, and a contract test parses a real
`OUT_OF_STOCK` response through it. The server-side alternative — a subclass
per code — is priced and declined.

**★ Why does the error shape live in the shared package rather than beside
the error handler?**
Because both sides would be wrong if they disagreed about it — chapter 1's
test for inclusion. The client renders errors, switches on `code`, and
displays `title`; a server-only definition means the client keeps a copy, and
the copy drifts. The schema is the client's parser and the server's response
type, from one file.

---

← Prev: [`res.locals`: two type sources](03b-res-locals.md) ·
[Overview](README.md) ·
Next → [The classify table and the handler](03d-the-classify-table-and-the-handler.md)
