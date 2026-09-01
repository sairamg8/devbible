---
title: "The Request generics are the right tool for the three routes that cannot use the helper, and their parameter order is a trap the compiler will not mention"
sidebar_label: "02 · The five generics"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — `Request`, `RequestHandler`, `Response`, `Send`,
> `ParamsDictionary` — and **`@types/qs`** (`ParsedQs`). **TypeScript 7.0.2**,
> Express **5**. The mechanism is
> [TypeScript 7·05 — typed Express handlers](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/README.md),
> which quotes the same declarations and owns the argument; this chunk is the
> app's *decision* about when to use them. The routes are
> [3·08's upload](../../phase-3-express-api/08-the-uploads-endpoint.md) and
> [3·11's webhook](../../phase-3-express-api/11-inbound-webhooks.md).

**This app types twenty routes with a helper and three routes with the raw
generics, and the three are the interesting ones.** They are the routes that
stream, that need the raw body, or that return something other than a JSON 200
— exactly the cases a helper cannot cover without becoming a framework. Typing
them means using `Request`'s five generic parameters directly, in an order that
is not the order anybody guesses.

## The declaration and the order

Verbatim from `@types/express-serve-static-core@5.1.3`:

```ts
export interface Request<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
> extends http.IncomingMessage, Express.Request { … }

export interface RequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
> {
    (
        req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
        res: Response<ResBody, LocalsObj>,
        next: NextFunction,
    ): unknown;
}
```

🔴 **`ResBody` is second and `ReqBody` is third.** The natural-looking
`Request<{}, CreateOrderBody>` types the *response* body and leaves `req.body`
at its default of `any` — no error, no squiggle, and `req.body.anything`
compiles. The concept page
[TypeScript 7·05](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/README.md)
carries this argument in full; it is repeated here only because the three routes
below are where this codebase would hit it.

The defaults that matter for un-annotated handlers:

| Slot | Default | Consequence |
|---|---|---|
| `P` | `ParamsDictionary` | `req.params.slug` is `string \| string[]` — see below |
| `ResBody` | `any` | `res.json(anything)` compiles |
| `ReqBody` | `any` | `req.body.whatever` compiles |
| `ReqQuery` | `ParsedQs` | `req.query.limit` is a four-way union |
| `LocalsObj` | `Record<string, any>` | `res.locals.anything` compiles |

`ParamsDictionary` and `ParsedQs`, verbatim:

```ts
export interface ParamsDictionary {
    [key: string]: string | string[];
    [key: number]: string;
}
```

```ts
interface ParsedQs {
    [key: string]: undefined | string | ParsedQs | (string | ParsedQs)[];
}
```

📌 **Both are honest and both are unusable.** `?sort=a&sort=b` really does
produce an array, and `?filter[min]=1` really does produce a nested object —
that is `qs` doing what Express asks of it. The union is the truth about
untyped query parsing, and it is precisely why
[3·02's boundary](../../phase-3-express-api/02-the-validation-boundary.md)
parses rather than reads. A handler that touches `req.query` directly is
handling that union or ignoring it.

## Route one: the upload, which streams

[3·08](../../phase-3-express-api/08-the-uploads-endpoint.md) parses a multipart
body with busboy and writes the response after the stream finishes. There is no
parsed body to hand a helper.

```ts
// apps/api/src/routes/uploads.ts
import type {RequestHandler} from 'express';
import type {ParamsDictionary} from 'express-serve-static-core';

type UploadResponse = {object_key: string; width: number; height: number};

export const uploadImage: RequestHandler<
  ParamsDictionary,     // P — no route params, but the slot must be named
  UploadResponse,       // ResBody — res.json is now checked
  unknown,              // ReqBody — multipart: there is no JSON body
  Record<string, never> // ReqQuery — this route takes no query
> = (req, res, next) => {
  const bb = busboy({headers: req.headers, limits: {files: 1, fileSize: MAX_BYTES}});
  bb.on('error', next);                       // Express 5 does NOT catch this
  bb.on('file', (_name, stream, info) => { … });
  bb.on('close', () => {
    res.json({object_key: key, width, height});   // checked against ResBody
  });
  req.pipe(bb);
};
```

Three things the generics bought and one they did not:

- **`res.json` is checked** against `UploadResponse`, so the route cannot
  silently start returning a different shape.
- **`ReqBody` is `unknown`**, so `req.body.anything` is a compile error —
  correct, because `express.json()` did not run on this route.
- **`ReqQuery` is `Record<string, never>`**, so reading a query parameter is an
  error rather than a `ParsedQs` union to ignore.
- 🔴 **Nothing types the busboy events.** `bb.on('error', next)` is the line
  that matters and it is a runtime wiring decision: Express 5 forwards rejected
  *promises* from handlers, not errors emitted by streams the handler created.
  The type system has no opinion about it and the concept page's title —
  [*a promise the compiler cannot keep*](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/02-a-promise-the-compiler-cannot-keep.md)
  — is the general form.

## Route two: the webhook, which needs the raw bytes

[3·11](../../phase-3-express-api/11-inbound-webhooks.md) verifies an HMAC over
the exact bytes received, so it must run before any body parsing — and the body
it eventually gets is a `Buffer`.

```ts
// apps/api/src/routes/webhooks.ts
import express, {type RequestHandler} from 'express';

type WebhookAck = {received: true};

export const providerWebhook: RequestHandler<
  ParamsDictionary, WebhookAck, Buffer
> = (req, res, next) => {
  //                        ^ ReqBody is Buffer: express.raw() ran, not express.json()
  if (!verifySignature(req.body, req.get('x-signature'))) {
    return next(new ApiError(401, 'BAD_SIGNATURE', 'signature mismatch'));
  }
  const event = WebhookEvent.parse(JSON.parse(req.body.toString('utf8')));
  …
  res.json({received: true});
};

router.post('/webhooks/provider', express.raw({type: 'application/json'}), providerWebhook);
```

⚠️ **`ReqBody = Buffer` is a claim about which body parser is mounted**, in
exactly the way
[chapter 3's row types](../03-typing-raw-pg-results/01-the-generic-is-an-assertion.md)
are claims about which type parser is installed. Mount `express.json()` in front
of this route by accident and `req.body` is a parsed object at run time, typed
`Buffer` at build time, and `req.body.toString('utf8')` returns
`'[object Object]'` — which fails the signature check, which reads as a
provider problem.

## Route three: the one that returns 204

```ts
export const deleteCartItem: RequestHandler<
  {productId: string},     // P — route params are ALWAYS strings
  never                    // ResBody — this route sends no body
> = async (req, res) => {
  await carts.removeItem(req.userId!, Number(req.params.productId));
  res.status(204).end();
};
```

`P` as an explicit object type is the one generic worth reaching for even in
helper-covered routes when you read `req.params` directly: it replaces
`ParamsDictionary`'s `string | string[]` with `string`, which is what a route
parameter actually is.

⚠️ **`req.params.productId` is a `string`, always** — `'42'`, not `42`. The
`Number()` call is not defensive, it is required, and the reason the app's other
routes get their params through
[the validated request type](../02-zod-as-the-source-of-truth/03-the-validated-request-type.md)
with a coercing schema is that `Number('abc')` is `NaN` and `NaN` reaches SQL as
a bind parameter.

## The rule this app applies

| Route shape | Typing |
|---|---|
| JSON in, JSON out, 200 | `route()` / `authedRoute()` — no generics written by hand |
| Streams, raw bodies, non-200, non-JSON | `RequestHandler<P, ResBody, ReqBody, ReqQuery>` written out |
| Anything else | there is no anything else — if a fourth appears, decide deliberately |

🔴 **Three hand-typed routes is the budget.** The moment a fourth appears, the
question is whether the helper should grow a feature or whether the route is
genuinely exceptional; growing the helper for the second time is how a
twenty-line function becomes a framework nobody can leave.

## Gotchas

**★ `Request<{}, MyBody>` types the response body.** The order is `P`,
`ResBody`, `ReqBody` — response before request — so the most natural two-argument
call types the wrong end and leaves `req.body` as `any`, which accepts every
property. The correct form names three slots.

**★ `req.params.x` is `string | string[]` by default.** `ParamsDictionary` has a
string index signature returning `string | string[]`, so `Number(req.params.id)`
compiles and `req.params.id.trim()` does not. Supply `P` explicitly —
`RequestHandler<{id: string}>` — or go through the boundary schema.

**★ `req.query.x` is a four-way union including `undefined` and a nested
object.** `ParsedQs` is honest about what `qs` produces. Any handler comparing
`req.query.limit` to a number is comparing a union to a number, and TypeScript
permits it under `==`. Handlers do not read `req.query`; the boundary does.

**★ `express.raw()` versus `express.json()` is invisible to the type and
decisive at run time.** Declaring `ReqBody = Buffer` does not mount the raw
parser. If the wrong parser runs, `req.body.toString()` yields
`'[object Object]'` and the signature check fails in a way that looks like the
partner's fault. Mount order is tested, not typed.

**★ Express 5 forwards rejected promises from handlers; it does not forward
`'error'` events from streams you created.** `bb.on('error', next)` is
mandatory and unenforceable. Every hand-typed streaming route in this codebase
has that line, and a review checklist rather than a compiler is what keeps it
there.

**★ `LocalsObj` is the fifth slot and is easy to reach by accident.**
`RequestHandler<P, ResBody, ReqBody, ReqQuery, {user: User}>` types `res.locals`
for that handler — useful, and unrelated to the merged global `Locals`
interface. Mixing the two produces a `res.locals` that is the intersection, and
a property that exists in one place and not the other.

**★ Writing the generics on the *handler* and not on the route registration
gives no cross-check.** `router.post('/x', handlerTypedForY)` compiles: Express's
`post` accepts any `RequestHandler`, and nothing verifies the path's parameters
match `P`. The path string and the params type are two declarations, and the
mismatch is a run-time `undefined`.

## Interview questions

**★ Why does `Request<{}, CreateOrderBody>` fail to type the request body?**
Because the second parameter is `ResBody`, not `ReqBody` — the response body
comes before the request body so that `Request` and `Response` can be threaded
through `RequestHandler` with one parameter list. `ReqBody` is third, so it stays
at its default of `any`, and `any` accepts every property access, which is why
there is no error to notice.

**★ Why does this app hand-type only three routes?**
Because the helper covers JSON-in, JSON-out, status-200 routes completely, and
the three exceptions are exceptional for concrete reasons: a stream with no
parsed body, a raw-bytes body for signature verification, and a 204. Extending
the helper to cover them would mean modelling statuses, streams and content
types — at which point it is a framework, and the routes are harder to read than
before.

**★ What is `ParsedQs` and why does it look so unhelpful?**
It is `@types/qs`'s description of what Express's query parser actually
produces: a string, an array of strings, a nested object, an array of those, or
`undefined`. It looks unhelpful because it is accurate — `?sort=a&sort=b`
genuinely yields an array. The response is not to fight the type but to parse
the query once at the boundary and never read `req.query` in a handler.

**★ You declare `ReqBody = Buffer` on the webhook route. What guarantees it?**
The mount order — `express.raw({type: 'application/json'})` in front of the
handler — and nothing else. The generic is an assertion about which body parser
ran, exactly as a row type is an assertion about which `pg` type parser is
installed. If `express.json()` runs instead, the type is wrong and the failure
is a signature mismatch that looks external.

**★ Express 5 catches async errors. Does that cover the upload route?**
Only partly. It forwards rejections from the promise a handler returns; the
busboy instance the handler creates emits `'error'` on its own event emitter,
outside that promise. Without `bb.on('error', next)` the error becomes an
unhandled emitter error and can take the process down. The compiler has no
opinion on this at all.

---

← Prev: [Merging, not casts](01-declaration-merging-not-casts.md) ·
**Overview** *(not written yet)* ·
Next → **Middleware, locals and the error handler** *(not written yet)*
