---
title: "The classify table needs guards where the JavaScript had dots, and the handler that uses it is written so that no path through it can throw"
sidebar_label: "03d · Classify and the handler"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — `ErrorRequestHandler`, `RequestHandler` — and the
> Express guide on [error handling](https://expressjs.com/en/guide/error-handling.html)
> (`headersSent`, the default handler, the Express 5 promise rule).
> **TypeScript 7.0.2**, Express **5**. Concept homes:
> [TypeScript 7·04 — making an error recognisable](../../../../typescript/pages/phase-7-server/04-catch-e-unknown/02-making-an-error-recognisable.md),
> [TypeScript 2·07 — type guards](../../../../typescript/pages/phase-2-narrowing/07-type-guards.md).
> The funnel being typed is
> [3·09's](../../phase-3-express-api/09-the-error-contract.md).

**With `err: unknown`, every property 3·09's classify table read off the error
is a compile error until a guard admits it — and the guards are the honest
version of what the JavaScript was assuming.** This chunk rewrites the table
against [the previous chunk's](03c-the-typed-error-handler.md) `ApiError` and
`ErrorBody`, then writes the handler around it with one property the type
cannot state and the design must: nothing inside it throws.

## The classify table, with guards instead of dots

```ts
// apps/api/src/middleware/errors.ts  (continued)
import type {ErrorCode} from '@storefront/shared';
import {OutOfStockError} from '../../db/errors.js';   // phase 1's domain error

interface PgError { code: string; constraint?: string }
const isPgError = (e: unknown): e is PgError =>
  typeof e === 'object' && e !== null && typeof (e as {code?: unknown}).code === 'string';

const hasType = (e: unknown, type: string): boolean =>
  typeof e === 'object' && e !== null && (e as {type?: unknown}).type === type;

const UNIQUE: Record<string, [number, ErrorCode, string] | null> = {
  users_email_key: [409, 'EMAIL_TAKEN', 'email already registered'],
  reviews_order_id_product_id_key: [409, 'ALREADY_REVIEWED', 'this purchase already has a review'],
  orders_idempotency_key_key: null,     // handled inside checkout — reaching here is a bug
};

export function classify(err: unknown): ApiError | null {
  if (err instanceof ApiError) return err;
  if (err instanceof OutOfStockError) {
    return new ApiError(409, 'OUT_OF_STOCK', 'insufficient stock', {product_ids: err.productIds});
  }
  if (isPgError(err)) {
    if (err.code === '23505' && err.constraint) {
      const hit = UNIQUE[err.constraint];
      if (hit) return new ApiError(...hit);
    }
    if (err.code === '23503') return new ApiError(422, 'BAD_REFERENCE', 'referenced item does not exist');
    if (err.code === '57014') return new ApiError(504, 'TIMEOUT', 'the operation timed out');
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return new ApiError(504, 'TIMEOUT', 'the operation timed out');
  }
  if (hasType(err, 'entity.too.large')) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'request body too large');
  }
  return null;                          // unknown ⇒ 500, details withheld
}
```

Three typing decisions inside that:

- **`isPgError` is structural, not `instanceof DatabaseError`.** `pg` does
  export a `DatabaseError` class, and `instanceof` against it would be tighter;
  the structural guard is chosen so the funnel's tests can throw
  `{code: '23505', constraint: 'users_email_key'}` without constructing a
  driver error, and because the guard reads only the two fields the table
  uses. [TypeScript 7·04](../../../../typescript/pages/phase-7-server/04-catch-e-unknown/02-making-an-error-recognisable.md)
  is the general argument for structural recognition.
- **`OutOfStockError` is a class, so `instanceof` is the guard** — it is this
  codebase's own error, and its `productIds: number[]` is typed on the class
  rather than read off `unknown`. Phase 1's JavaScript threw an `Error` with a
  `code` string; the port promotes it to a class precisely so the funnel does
  not need a second structural guard.
- **The `UNIQUE` table's value type is a tuple** `[number, ErrorCode, string]`
  so that `new ApiError(...hit)` spreads into the constructor with each slot
  checked. `null` stays in the type so that the idempotency-key row can say
  "this should never reach here" and fall through to the 500 that
  [3·09](../../phase-3-express-api/09-the-error-contract.md) wants for it.

⚠️ **`UNIQUE[err.constraint]` is `[…] | null | undefined` under
`noUncheckedIndexedAccess`**, and `if (hit)` handles all three. Without the
flag the type is `[…] | null`, the `undefined` for an unlisted constraint is
invisible, and `new ApiError(...hit)` on `undefined` would be a throw inside
the error handler — the one place a throw goes to the default HTML handler.
[TypeScript 10·02](../../../../typescript/pages/phase-10-strictness/02-nouncheckedindexedaccess.md)
is why the flag is on.

## The handler itself

```ts
import type {ErrorRequestHandler, RequestHandler} from 'express';
import type {ParamsDictionary} from 'express-serve-static-core';
import type {ErrorBody} from '@storefront/shared';

export const errorHandler = ({config}: Deps): ErrorRequestHandler<ParamsDictionary, ErrorBody> =>
  (err: unknown, req, res, _next) => {
    //                        ^^^^^ keep it — the next chunk is about why
    if (res.headersSent) return _next(err);     // mid-stream: delegate to Express

    const known = classify(err);
    const status = known?.status ?? 500;
    req.log[status >= 500 ? 'error' : 'warn']({err, code: known?.code ?? 'INTERNAL', status});

    const body: ErrorBody = known
      ? {type: `${config.ERROR_DOC_BASE}/${known.code}`, title: known.message,
         status, code: known.code, request_id: req.id, ...known.extra}
      : {type: `${config.ERROR_DOC_BASE}/INTERNAL`, title: 'internal error',
         status: 500, code: 'INTERNAL', request_id: req.id};
    res.status(status).json(body);              // checked against ErrorBody
  };

export const notFound: RequestHandler<ParamsDictionary, ErrorBody> = (req, res) => {
  res.status(404).json({
    type: 'about:blank', title: 'not found', status: 404,
    code: 'NOT_FOUND', request_id: req.id,
  });
};
```

`req.log` and `req.id` are no longer optional-chained — chunk 01 declared them
required and the mount order makes that true. The `body: ErrorBody` annotation
is deliberate over inference: with it, a spread of `known.extra` that
overwrote `code` with a non-literal would fail here, at the construction,
rather than at `res.json`. The guide's `headersSent` rule, verbatim: *"when you
add a custom error handler, you must delegate to the default Express error
handler, when the headers have already been sent to the client"*.

**The property the type cannot state.** A throw from inside an error handler
is forwarded by the router to `next(err)`, and there is no handler after the
last one, so it reaches Express's default handler — which answers with HTML,
breaking the contract for exactly the requests that already failed once. The
handler above cannot throw: `classify` dereferences nothing unguarded, the
table lookup is checked, `req.log` and `req.id` are guaranteed by mount order,
and there is no `await`. That is a design property, verified by the funnel's
tests throwing `null`, a string, a plain object and a `DatabaseError` at it.

## Gotchas

**★ Throwing inside the error handler goes to Express's default handler,
which sends HTML.** The router calls `next(err)` on a throw from an error
handler, and there is no handler after this one. So `classify` must not throw
on a weird value — the structural guards are what guarantee that; `err.code`
on a `null` would have thrown in the JavaScript version.

**★ The error handler typed `ResBody = ErrorBody` rejects the JavaScript
version's body construction.** 3·09 built the body with `...known.extra`
*then* assigned `request_id`; the typed version spreads `extra` last, after
the required keys, and annotates the result. If `extra` contains a `code` key
— it should not — the spread overwrites the literal and the annotation fails,
which is the correct outcome.

**★ An `async` error handler is legal and Express 5 forwards its rejection —
to nothing.** The rejection goes to `next(err)`, and there is no handler after
the last one, so it reaches the default handler as HTML. If the error handler
has to hand off to something asynchronous (an error-tracking flush, say),
detach it and never await it:

```ts
(err: unknown, req, res, _next) => {
  …
  void tracker.capture(err, {request_id: req.id}).catch(e => req.log.error({e}, 'tracker'));
  res.status(status).json(body);          // never waits on the tracker
}
```

**★ `errorHandler` mounted before the routers handles nothing, and the type is
identical.** The `ErrorRequestHandler` annotation says nothing about
position; the guide's *"you define error-handling middleware last"* is a
mount-order rule, and [3·01](../../phase-3-express-api/01-project-structure.md)
puts it after `notFound`. An integration test that throws from a route and
asserts a JSON body is what enforces it.

**★ A driver condition with no classify row falls through to `INTERNAL`
silently.** A new unique constraint — `products_slug_key`, say — raises
`23505` with a constraint name the `UNIQUE` table does not list; `hit` is
`undefined`, the function returns `null`, and the client sees a 500 for what
is a 409. The test 3·09 asked for — every exported domain error maps to a
non-500 — covers domain classes, not constraint names; the schema's
constraint list is diffed against `UNIQUE`'s keys in a second test.

**★ `err.name === 'AbortError'` is a string comparison the type cannot
tighten.** `AbortError` is a DOM-style name on an `Error` subclass Node
creates, not a class the app can `instanceof`; the guard is `err instanceof
Error && err.name === 'AbortError'` and a typo in the string is a 500 instead
of a 504. A single `isAbortError` helper with the string in one place is the
only defence.

**★ `known.extra` spread after `request_id` can overwrite it.** The order in
the body literal is deliberate — required keys first, spread last — so that
the annotation catches a `code` overwrite. A `request_id` in `extra` would
also overwrite, and the annotation would *not* catch it because both are
`string`. Nothing in the codebase puts `request_id` in `extra`, and the
contract test asserts the body's `request_id` equals the request's.

## Interview questions

**★ The classify table used to read `err.code` directly. What changed and
what did it buy?**
`err` is `unknown`, so every property read needs a guard. `isPgError` admits
`{code: string; constraint?: string}` structurally; `OutOfStockError` became a
class so `instanceof` types its `productIds`; `hasType` reads
`express.json`'s `type` field. What it bought is that `classify` cannot throw
on a strange value — `err.code` on `null` used to be a `TypeError` inside the
error handler, which reaches Express's default handler and sends HTML.

**★ What happens if the error handler itself throws, or is `async` and
rejects?**
Both reach `next(err)` — the throw via the router's `try`/`catch` around the
call, the rejection via Express 5's promise forwarding — and there is no layer
after the last error handler, so Express's default handler answers with HTML.
The typed handler avoids throwing by construction: the guards never
dereference an unchecked value, and any asynchronous hand-off inside it is
detached so the function always reaches `res.json`.

**★ Why a structural guard for `pg` errors when `pg` exports a class?**
Because the table reads two fields, `code` and `constraint`, and a guard that
admits any object carrying a string `code` is exactly as wide as the table's
needs. It also lets the funnel's tests throw plain objects. `instanceof
DatabaseError` would be tighter and would couple the error handler's tests to
constructing driver errors; if a second field ever mattered, the guard grows
by one line.

**★ Why is the `UNIQUE` table's value a tuple rather than an object?**
So that `new ApiError(...hit)` spreads into the constructor with each
position checked: the first must be a `number`, the second an `ErrorCode`, the
third a `string`. An object would need a destructure and a second call site
to keep in sync. The `| null` member is a documented "must not reach here"
that falls through to the 500, and `noUncheckedIndexedAccess` adds the
`undefined` for an unlisted constraint, which `if (hit)` handles.

**★ What does `res.headersSent` protect, and why can the type not?**
A response whose headers are already on the wire — an image stream that died
mid-pipe — cannot become JSON. The guide says to delegate to the default
handler in that case, which destroys the connection so the client sees
truncation rather than a 200 with half a body. `headersSent` is a runtime
boolean about bytes already sent; no type describes the state of a socket.

---

← Prev: [The error contract, typed](03c-the-typed-error-handler.md) ·
[Overview](README.md) ·
Next → [The arity trap](03e-the-arity-trap.md)
