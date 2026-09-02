---
title: "Middleware is typed by the constant it is assigned to, so the session resolver and the role gate carry one annotation each and the compiler checks the shape Express will call"
sidebar_label: "03 · Typed middleware"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — `RequestHandler`, `NextFunction` — and the Express
> guide on [error handling](https://expressjs.com/en/guide/error-handling.html)
> for the Express 5 promise rule. **TypeScript 7.0.2**, Express **5**, Node
> **24.19.0**. Concept homes:
> [TypeScript 3·10 — inference sites and contextual typing](../../../../typescript/pages/phase-3-generics/10-inference-sites-and-contextual-typing.md),
> [TypeScript 7·05](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/README.md).
> The middleware being typed is
> [3·03's session resolver](../../phase-3-express-api/03-auth/01-sessions.md)
> and [3·04's role gates](../../phase-3-express-api/04-authorization.md).

**The handlers got the previous two chunks; the things that run before them
get this one.** Middleware in this app is a `RequestHandler` constant, never a
function with annotated parameters, because the constant's type is what makes
the parameters inferred and the assignment checked. Two middlewares carry the
whole session story — the resolver that turns a cookie into a user, and the
gate that turns a user into a permission — and between them they show every
decision a typed middleware has to make: where the value lands, what the
factory's parameter is derived from, and what `next` actually accepts.

## Middleware is a constant with a type, not a function with annotations

[3·03's session middleware](../../phase-3-express-api/03-auth/01-sessions.md)
set `req.user`; the TypeScript port sets `req.userId` (the id, for the route
helper's `Ctx`) and `res.locals.user` (the record, for the role gates), from one
resolved value:

```ts
// apps/api/src/middleware/auth.ts
import type {RequestHandler} from 'express';
import type {SessionUser} from '@storefront/shared';

const COOKIE = '__Host-session';

export function sessionMiddleware({auth}: Deps): RequestHandler {
  return async (req, res, next) => {
    //           ^ req, res, next all inferred from RequestHandler — no annotation
    const user: SessionUser | null = await auth.resolve(req.cookies?.[COOKIE] ?? null);
    res.locals.user = user;               // typed by the merged Locals — next chunk
    req.userId = user?.id;                // typed by chunk 01's merged Request
    next();
  };
}
```

📌 **The return annotation is the whole typing.** `: RequestHandler` on the
factory contextually types the arrow function, so `req`, `res` and `next` get
their types from `RequestHandler`'s call signature and nothing is written
twice. Annotating the parameters instead — `(req: Request, res: Response, next:
NextFunction)` — works, is longer, and loses the check that the function is
*assignable* to what Express wants; the constant form fails at the assignment
if the shape is wrong, which is where you want it to fail.

Express 5 forwards a rejected promise from this `async` function to the error
handler — the guide's sentence, verbatim: *"Route handlers and middleware that
return a Promise call `next(value)` automatically when they reject or throw an
error, and `async` functions always return a Promise, so their errors reach
Express with no extra work."* So the `try`/`catch` 3·03 wrote is gone, and the
`unknown` return type on `RequestHandler` (chunk 02) is what lets the `async`
function type-check.

**Why two properties from one value.** Chunk 01 chose `req.userId` over
`req.user` to stay out of the property `@types/passport` claims, and the route
helper's `Ctx` needs only the id. The role gate needs the role, so the full
record needs a home; [the next chunk](03b-res-locals.md) argues that home is
`res.locals`. Setting both on adjacent lines from one `user` is what stops
them disagreeing — there is no second resolve and no second cookie read.

## The role gate is a factory, and its parameter is the schema's enum

```ts
// apps/api/src/middleware/require.ts
import type {RequestHandler} from 'express';
import type {Role} from '@storefront/shared';   // 'customer' | 'admin', from user_role
import {ApiError} from './errors.js';

export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    const user = res.locals.user;         // SessionUser | null — next chunk
    if (user == null) {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'authentication required'));
    }
    if (user.role !== role) {
      return next(new ApiError(403, 'FORBIDDEN', 'insufficient permissions'));
    }
    next();
  };
}
```

`requireRole('moderator')` is a compile error, because `Role` is derived from
the same `as const` array
[chapter 1](../01-the-shared-types-package/01-why-a-package.md) built for
`OrderStatus`, and `user_role` in Postgres has two labels. That is the phase
gate at the middleware layer: add a role to the enum without adding it to the
array and the gate that uses it does not compile.

`requireAuth` from chunk 01 is the same shape with no parameter. Both return
`RequestHandler`, both are mounted by
[3·04's](../../phase-3-express-api/04-authorization.md) `router.use(requireRole('admin'))`
at the top of the admin router, and neither can say anything to the compiler
about the handlers below them — that limit is chunk 01's, and the next chunk
shows the one place the fifth generic is allowed to paper over it.

## `NextFunction`, verbatim

The overloads are the reason `next('route')` type-checks and `next('rouet')`
does not fail:

```ts
export interface NextFunction {
    (err?: any): void;
    (deferToNext: "router"): void;
    (deferToNext: "route"): void;
}
```

⚠️ **`(err?: any)` accepts everything, including the typo.** `next('rouet')`
matches the first overload as an error whose value is the string `'rouet'`,
and the error handler receives a string. The two literal overloads exist for
autocomplete and documentation, not as a check — which is one more reason the
error handler's parameter has to be treated as `unknown`
([03c](03c-the-typed-error-handler.md)).

## Gotchas

**★ `next('rouet')` compiles.** `NextFunction`'s first overload is `(err?:
any)`, so any string is a valid *error*. The literal overloads for `'route'`
and `'router'` exist for documentation, and a typo becomes an error object of
type `string` in the error handler — which `classify` returns `null` for,
producing a 500 whose log line contains the typo.

**★ An `async` middleware that forgets `next()` compiles and hangs the
request.** `RequestHandler` returns `unknown`, so a function that resolves
without calling `next` satisfies the type completely. Express 5's promise
forwarding only acts on *rejection*; a fulfilled promise with no `next()` call
leaves the request open until the client times out. The shape of every
middleware in this app ends in `next()` on the success path, and the test for
each one asserts that the downstream handler ran.

**★ `next()` after a `return next(err)` is a double call, and the type cannot
see it.** A gate that writes `if (!user) next(err);` without the `return`
falls through to the final `next()`, and the handler after the gate runs on an
unauthenticated request *and* the error handler runs. Both calls type-check.
Every early exit in a middleware is `return next(…)`.

**★ Middleware order is still meaning, and the types cannot see it.**
`sessionMiddleware` mounted after a router leaves `res.locals.user`
`undefined` on that router with a type that says `SessionUser | null`, and
`req.userId` `undefined` on a route whose type says the same — which is the
correct type, and the wrong reason. The
[mount-order rule](../../phase-3-express-api/01-project-structure.md) is
tested with an integration test, not typed.

**★ `req.user` no longer compiles, and that is the point.** Ported
JavaScript that reads `req.user.role` fails at every site, because chunk 01's
merge declared `userId` and nothing else. Each failure is a place that now
reads `res.locals.user`, and the compiler enumerates them — the migration is
the error list.

## Interview questions

**★ Why annotate the middleware constant rather than the parameters?**
Because the constant's type contextually types the function: `req`, `res` and
`next` are inferred from `RequestHandler`'s call signature, and the assignment
itself checks that the function fits what Express will call. Annotating the
parameters produces the same inferred types inside the body but skips the
assignability check, and it is three annotations per middleware instead of
one.

**★ What did Express 5 change for the session middleware, and what did it not
change?**
The `try`/`catch` around the `await` is gone: a rejected promise returned from
a middleware is forwarded to `next(err)` by the router. What did not change is
that a *fulfilled* promise with no `next()` call still hangs the request, and
that an error emitted by something the middleware created — a stream, an
emitter — is outside the promise and still needs `next(err)` by hand.

**★ Why is `requireRole('moderator')` a compile error, and why does that
matter?**
`Role` is `(typeof ROLES)[number]` over an `as const` array in the shared
package, mirroring the `user_role` enum's two labels. A role that is not in
the array is not in the union, so the call does not compile. It matters
because the alternative — `role: string` — lets a gate check for a role no
user can have, which is a route that is silently admin-only for nobody.

**★ Why does one middleware set both `req.userId` and `res.locals.user`?**
Because two consumers need different things and one of them lives in a
namespace the app is keeping clear. The route helper's `Ctx` reads the id
from `req`; the role gates read the record from `res.locals`; and setting both
on adjacent lines from a single resolved value is what guarantees they refer
to the same session.

---

← Prev: [The five generics in practice](02-the-five-generics-in-practice.md) ·
[Overview](README.md) ·
Next → [`res.locals`: two type sources](03b-res-locals.md)
