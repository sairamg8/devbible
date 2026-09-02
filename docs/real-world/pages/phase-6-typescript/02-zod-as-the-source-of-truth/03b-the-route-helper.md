---
title: "Passing the parsed values as an argument replaces declaration merging with ordinary inference, and confines the one unavoidable cast to a single seam"
sidebar_label: "03b · The route helper"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/express-serve-static-core` 5.1.3**
> declarations in this repo (`RequestHandler`, `Request`) and the **zod 4.4.3**
> `classic/parse.d.ts`. **TypeScript 7.0.2**, Express **5**. Concept homes:
> [TypeScript 3·01 — generic functions and inference](../../../../typescript/pages/phase-3-generics/01-generic-functions-and-inference/README.md),
> [TypeScript 10·12 — assertion discipline](../../../../typescript/pages/phase-10-strictness/12-assertion-discipline/README.md).
> The routes being wrapped are
> [3·05](../../phase-3-express-api/05-catalog-endpoints.md) and
> [3·07](../../phase-3-express-api/07-the-checkout-endpoint.md).

**`req.valid` is typed globally and needed per route; a function argument is
typed per call and inferred for free.** [The previous chunk](03-the-validated-request-type.md)
built `Valid<S>` and ended on the one line the compiler cannot justify — the
assignment onto Express's single `Request` interface. This chunk removes the
need for that line from every handler in the API by moving the parsed values
into the handler's parameter list, and it is the decision that makes the rest of
the phase's typing work without a `declare global` block in application code.

## The route helper: inference instead of merging

Make the parsed values an **argument** rather than a property, and the whole
problem becomes ordinary function inference:

```ts
// apps/api/src/lib/route.ts
import type {Request, Response, RequestHandler} from 'express';
import {z} from 'zod';
import {validate, type Schemas, type Valid} from '../middleware/validate.js';

export interface Ctx {
  req: Request;          // for the rare handler that needs the raw request
  res: Response;         // for cache-control, cookies, streaming
  userId: number | null; // set by the auth middleware, read-only here
}

export function route<const S extends Schemas, R extends z.ZodType>(
  spec: {schemas: S; response: R},
  handler: (v: Valid<S>, ctx: Ctx) => Promise<z.infer<R>>,
): RequestHandler[] {
  return [
    validate(spec.schemas),
    async (req, res, next) => {
      try {
        const body = await handler(req.valid as Valid<S>, {
          req, res, userId: req.userId ?? null,
        });
        res.json(body);
      } catch (err) {
        next(err);
      }
    },
  ];
}
```

Used, the annotations disappear entirely:

```ts
// apps/api/src/routes/catalog.ts
router.get('/', ...route(
  {schemas: {query: ListProductsQuery}, response: ProductPage},
  async (v) => {
    //     ^ v.query: {sort: 'newest'|'price_asc'|'price_desc'; limit: number; …}
    const page = await catalog.list({
      categorySlug: v.query.category,
      minCents: v.query.min_cents,
      maxCents: v.query.max_cents,
      sort: v.query.sort,
      cursor: decodeCursor(v.query.cursor),
      limit: v.query.limit,
    });
    return {
      items: page.items.map(productSummary),
      next_cursor: encodeCursor(page.nextCursor),
    };
  },
));
```

`v.query.sortt` is a compile error. `v.body` is a compile error, because this
route declared no body schema. And the **return** value is checked against
`z.infer<typeof ProductPage>`, so a mapper that forgets `cover_url` fails to
compile in the route file rather than shipping a `undefined` to the grid.

⚠️ **The cast has not disappeared, it has been confined.** `req.valid as
Valid<S>` still happens — once, inside `route`, in a function whose two
arguments are the only things that could make it wrong. That is the honest
version of "no casts in application code": one assertion at the seam, reviewed
once, rather than one per handler reviewed never.
[TypeScript 10·12 — assertion discipline](../../../../typescript/pages/phase-10-strictness/12-assertion-discipline/README.md)
is the general rule; this is it applied.

## What the helper deliberately cannot do

Three routes in this app opt out, and naming them is part of the design:

- **`POST /uploads`** streams a multipart body ([3·08](../../phase-3-express-api/08-the-uploads-endpoint.md)).
  There is no parsed body to hand a handler, and the response is written after
  a stream completes. It uses a plain `RequestHandler`.
- **The webhook endpoint** ([3·11](../../phase-3-express-api/11-inbound-webhooks.md))
  needs the **raw** body bytes for signature verification, so it must run before
  any parsing at all.
- **Anything returning a non-JSON body** — a redirect, a 204. `route` always
  calls `res.json`, so a 204 route writes its own handler. That is deliberate:
  a helper that also handles status codes and empty bodies becomes a framework,
  and a framework is a thing to learn instead of a thing to read.

## Gotchas

**★ The response type is only checked if the helper declares it.**
`route` takes `response: R` and types the handler's return as `z.infer<R>`. Drop
that parameter "because the schema is only for OpenAPI" and the handler's return
type is inferred from the handler — which is to say, whatever it happens to
return is correct by definition. The response schema has to be *in the
signature* to be a check rather than a document.

**★ `res.json` inside a handler bypasses the return-type check.**
A handler that calls `ctx.res.json(...)` and then returns nothing satisfies
`Promise<z.infer<R>>` only if `R` admits `undefined` — usually it does not, so
this fails, which is the good case. The bad case is a handler that calls
`res.json` *and* returns the right shape: two responses, the second throwing
`ERR_HTTP_HEADERS_SENT` into the error handler. Grep for `res.json` outside
`route` in review; there should be three.
**★ Spreading the helper's array into `router.get` is load-bearing.**
`route()` returns `[validate, handler]`; `router.get('/', route(…))` — without
the spread — passes an array where Express accepts one, which it tolerates,
and the middleware order becomes an implementation detail of Express's
flattening rather than of your code. Return a tuple typed
`readonly [RequestHandler, RequestHandler]` if you want the arity fixed:

```ts
export function route<const S extends Schemas, R extends z.ZodType>(
  spec: {schemas: S; response: R},
  handler: (v: Valid<S>, ctx: Ctx) => Promise<z.infer<R>>,
): readonly [RequestHandler, RequestHandler] { … }
```

**★ The helper always sends 200, so "created" and "no content" need their own
door.** `res.json(body)` after a `POST /checkout` returns 200 where
[3·07](../../phase-3-express-api/07-the-checkout-endpoint.md) documents 201 for
a fresh order and 200 for a replay — a status that depends on the *result*.
Either the handler returns `{status, body}` and the helper reads it, or that
route writes a plain handler. This app does the second: one route with an
unusual status is cheaper than a helper that models statuses for all of them.

**★ `RequestHandler`'s return type in Express 5's types is `unknown`, so an
`async` handler that rejects compiles.** Verbatim from
`@types/express-serve-static-core@5.1.3`:

```ts
(
    req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
    res: Response<ResBody, LocalsObj>,
    next: NextFunction,
): unknown;
```

`unknown` accepts a `Promise`, which is what makes Express 5's async error
propagation type-check. It also means the compiler will never tell you that you
forgot to `await` something inside — `route`'s explicit `try`/`catch` around
`await handler(...)` is the thing that guarantees a rejection reaches
`next(err)` rather than becoming an unhandled rejection.

**★ `ctx.userId` typed `number | null` pushes the authorization check into the
handler, which is where it belongs — and is easy to skip.** A handler that
ignores `ctx.userId` compiles perfectly on a route mounted behind
`requireAuth`. The type cannot express "this route is authenticated"; only the
mount does. [Chapter 05 · Typed Express handlers](../05-typed-express-handlers/README.md) covers
the narrowing wrapper that makes `userId: number` non-null for the routes that
are actually behind auth.

## Interview questions

**★ There is one cast in this design. Where, and why is it acceptable?**
`req.valid as Valid<S>` inside `route`. It is unavoidable because Express's
`Request` is a single global interface while the parsed type is per-route.
It is acceptable because it is *one* assertion in a function whose correctness
depends only on its two arguments — the schemas that produced `req.valid` and
the handler that consumes it are both in scope. The alternative is one cast per
handler, in files nobody reviews for this.

**★ Why does the app pass parsed values as an argument instead of reading
`req.valid`?**
Because an argument's type is inferred and a property's type is declared
globally. Passing them turns the whole problem into ordinary function
inference, which the compiler is very good at, and removes the need for
declaration merging in application code. The cost is that handlers no longer
have `req` and `res` by default, which is why `Ctx` hands them over explicitly
to the routes that genuinely need them.

**★ How does the response schema make the mapper functions safe?**
`route` declares the handler as returning `Promise<z.infer<R>>`, so
`productSummary`'s output is checked against the response schema at the route.
Change a column, break the row type, break the mapper, and the route stops
compiling — which is the phase gate. Without the response parameter, the
handler's return type is whatever it returns, and the schema is a document
about a thing it does not constrain.

**★ Why `safeParse` and not `parse` in a middleware that is going to call
`next(err)` anyway?**
Because `parse` throws, and a thrown value is `unknown` in a `catch` — you get
the type back only by re-testing `instanceof ZodError`. `safeParse` returns a
discriminated union whose failure branch declares `data?: never`, so the
compiler enforces that you branch before reading. Same behaviour, one fewer
place where a type has to be recovered by hand.

**★ What does this helper give up compared with a plain Express handler?**
Direct control of the response: status codes other than 200, streaming, and
non-JSON bodies. That is three routes out of roughly twenty, and each writes a
plain handler. The alternative — teaching the helper about statuses, streams
and content types — turns a twenty-line function into a framework, and a
framework has to be learned before the routes can be read.

**★ Express 5's `RequestHandler` returns `unknown`. Why does that matter for an
async handler?**
Because `unknown` accepts a `Promise`, so `async` handlers type-check and
Express 5's automatic rejection forwarding works. The flip side is that the
compiler cannot flag a forgotten `await`, and a rejected promise created inside
a handler but never returned escapes as an unhandled rejection. The helper's
`try`/`catch` around the awaited call is what makes the guarantee explicit
rather than assumed.

---

← Prev: [The validated request type](03-the-validated-request-type.md) ·
[Overview](README.md) ·
Next → [Response schemas and the mappers](04-response-schemas-and-mappers.md)
