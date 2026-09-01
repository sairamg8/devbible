---
title: "Express hands you one global Request interface, so the choice is declaration merging once or a cast in every handler"
sidebar_label: "01 · Merging, not casts"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — the `global.Express` namespace, `Request`,
> `Response`, `Locals` — and the TypeScript handbook's
> [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html).
> **TypeScript 7.0.2**, Express **5**, Node **24.19.0**. Concept homes:
> [TypeScript 7·05 — typed Express handlers](../../../../typescript/pages/phase-7-server/05-typed-express-handlers/README.md)
> owns the five generics;
> [TypeScript 6·07 — authoring `.d.ts` files](../../../../typescript/pages/phase-6-modules-build/07-authoring-d-ts-files/README.md)
> owns the file mechanics. The middleware being typed is
> [3·01's](../../phase-3-express-api/01-project-structure.md) and
> [3·03's](../../phase-3-express-api/03-auth/01-sessions.md).

**Every request-scoped value this app attaches — `req.id`, `req.log`,
`req.valid`, `req.userId` — is a property Express's types do not declare.** There
are exactly two ways to make TypeScript accept them, and the choice is made once
for the whole codebase: merge them into the global `Request` interface, or cast
at every use. This chunk is the merge, the augmentation file that does it, and
the one thing the merge cannot express — which is the reason
[chapter 2's route helper](../02-zod-as-the-source-of-truth/03b-the-route-helper.md)
exists.

## What the types invite you to do

`@types/express-serve-static-core@5.1.3` opens with this, verbatim — comment
included, because the comment is the instruction:

```ts
declare global {
    namespace Express {
        // These open interfaces may be extended in an application-specific manner via declaration merging.
        // See for example method-override.d.ts (https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/method-override/index.d.ts)
        interface Request {}
        interface Response {}
        interface Locals {}
        interface Application {}
    }
}
```

Four empty interfaces in a global namespace, existing for no purpose except to
be merged into. `Request` in the same file `extends http.IncomingMessage,
Express.Request`, so anything added to `Express.Request` appears on every
`req` in the process.

## The augmentation, in one file

```ts
// apps/api/src/types/express.d.ts
import 'express';                     // makes this a module; required
import type {Logger} from 'pino';

declare global {
  namespace Express {
    interface Request {
      /** correlation id, set by the first middleware — always present */
      id: string;
      /** the request logger, child of the root logger with `id` bound */
      log: Logger;
      /** parsed request parts, written by validate(); shape is per-route */
      valid: unknown;
      /** set by requireAuth; ABSENT on public routes */
      userId?: number;
    }
  }
}

export {};
```

Four decisions in twelve lines:

**`import 'express'` at the top and `export {}` at the bottom.** A `.d.ts` with
no imports or exports is a *script*, and its top-level declarations are already
global — `declare global` inside a script is an error. The import makes the file
a module; `export {}` is the belt to the import's braces, and either alone is
enough. Get this wrong and the symptom is that the augmentation silently does
nothing, which reads as "declaration merging does not work".

**`id` and `log` are required, not optional.** They are set by the first two
middlewares on the app, before any route can run, so declaring them optional
would put a `?.` in every log call for a value that is always there. This is a
promise the type system cannot verify and the mount order can —
[3·01's mount-order rule](../../phase-3-express-api/01-project-structure.md) is
what makes it true, and the type is downstream of it.

**`valid` is `unknown`, not `any`.** The parsed parts have a different shape per
route, so no single type is correct. `unknown` forces a cast or a parse at the
point of use, which is honest; `any` would let `req.valid.qeury.limit` compile
everywhere. The route helper's single `as Valid<S>` is that cast, made once.

🔴 **`userId` is optional and stays optional, and that is the merge's hard
limit.** It is set by `requireAuth`, which runs on some routes and not others.
The type is global, so it must describe the union of all routes — meaning even
a handler mounted behind `requireAuth` sees `number | undefined` and has to
narrow. There is no way to say "on this route it is definitely there" in a
merged interface, because the interface does not know about routes.

## The cast parade, and what it actually costs

Without the merge, the alternative that appears in most codebases:

```ts
// ✗ what this app does not do
interface AuthedRequest extends Request { userId: number; }

router.post('/orders', requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;   // ← one per handler
  const body = (req as any).valid.body;           // ← and one more
  …
});
```

Each cast is individually defensible and collectively fatal:

- **`as AuthedRequest` is unchecked.** Mount the handler without `requireAuth`
  and it still compiles; `userId` is `undefined` at run time and the query runs
  with `where user_id = undefined`, which `pg` sends as a null parameter.
- **`as any` on `req.valid` disables checking for the whole expression**, so a
  misspelled part or field compiles.
- **The casts multiply.** Twenty routes, two casts each, in the files that
  change most often — and every one is a place where a future reader has to
  re-derive whether the assertion is still true.
- **They are invisible in review.** `(req as AuthedRequest)` reads like typing,
  not like an assertion.

⚠️ **The merge does not eliminate the assertion, it relocates it.** `req.valid`
is `unknown` and something must narrow it; `req.userId` is optional and
something must check it. What changes is the *number* of places: one cast inside
the route helper and one narrowing wrapper for auth, both reviewed once, instead
of forty scattered through the routes.

## Narrowing the optional `userId`, once

```ts
// apps/api/src/middleware/require-auth.ts
import type {RequestHandler} from 'express';
import {ApiError} from './errors.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.userId == null) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'sign in to continue'));
  }
  next();
};
```

The middleware guarantees the value at run time and can say nothing to the
compiler — **TypeScript has no mechanism for "after this middleware runs, this
property is non-null"**, because middleware composition is an array of
functions, not a type-level sequence. The guarantee has to be re-established
where the handler receives its context:

```ts
// apps/api/src/lib/route.ts — the Ctx from chapter 2·03b, with an authed variant
export interface AuthedCtx extends Omit<Ctx, 'userId'> {
  readonly userId: number;         // narrowed, not optional
}

export function authedRoute<const S extends Schemas, R extends z.ZodType>(
  spec: {schemas: S; response: R},
  handler: (v: Valid<S>, ctx: AuthedCtx) => Promise<z.infer<R>>,
): RequestHandler[] {
  return [
    requireAuth,
    validate(spec.schemas),
    async (req, res, next) => {
      try {
        if (req.userId == null) throw new Error('authedRoute without requireAuth');
        res.json(await handler(req.valid as Valid<S>, {
          req, res, userId: req.userId,
        }));
      } catch (err) { next(err); }
    },
  ];
}
```

📌 **`authedRoute` mounts `requireAuth` itself**, so the type and the mount
cannot disagree — using the authed handler shape *is* what puts the middleware
in the chain. The internal `throw` is unreachable if the helper is used
correctly, and it is a loud failure rather than a `undefined` user id if
someone ever composes the middleware by hand. That is the whole trick: the
guarantee the compiler cannot make is made by construction instead.

## Gotchas

**★ A `.d.ts` with no import or export is a script, and `declare global` in it
is an error — or worse, silently different.** The augmentation appears to do
nothing and the usual next step is to conclude that merging is broken. One
`import 'express';` or one `export {};` makes the file a module and the
`declare global` block meaningful.

**★ The augmentation file must be *included* by the `tsconfig`.**
A `.d.ts` outside `include` is never loaded, so the merge never happens. Put it
under `src/` where the include glob already reaches, not in a `types/` folder at
the repo root that nobody added to the config.

**★ `namespace Express` must not be inside a `declare module 'express'`
block.** The open interfaces live in the *global* `Express` namespace, not in
the `express` module's exports. A `declare module 'express'` block that
augments `interface Request` targets a different, unrelated interface, and
produces no error and no effect.

**★ Merged properties are global, so an optional one stays optional
everywhere.** `req.userId?: number` cannot be non-optional on authed routes,
because the interface has no knowledge of routes. Anyone who "fixes" this by
declaring it required has made every public route lie.

**★ Two libraries merging the same property collide silently or loudly, and
both are bad.** `@types/passport` declares `req.user`; a hand-rolled
augmentation declaring `req.user` with a different type produces a duplicate
identifier error at best and an intersection at worst. This app uses `userId`
rather than `user` specifically to stay out of the namespace every auth library
claims.

**★ `valid: any` instead of `unknown` erases the boundary the whole phase is
about.** With `any`, `req.valid.query.limit` compiles on a route that validated
only the body. With `unknown`, it does not compile at all until something
narrows it — and the only thing that narrows it is the helper that knows the
schemas.

**★ The augmentation applies to the client build too, if the package is
shared.** A `.d.ts` in the API app is scoped to the API app's compilation.
Moving it into the shared package would put `Express.Request` into the browser
app's global scope — harmless in effect, wrong in principle, and a signal that
the boundary
[chapter 1](../01-the-shared-types-package/01-why-a-package.md) drew is being
eroded.

**★ `req.id` typed as required is a claim about mount order that nothing
checks.** If someone moves the correlation-id middleware below the router, `id`
is `undefined` with type `string` and the logs correlate nothing. The mount
order is tested — an integration test asserting a response carries a
`request_id` — because the type cannot be.

## Interview questions

**★ Why does `@types/express-serve-static-core` declare four empty interfaces in
a global namespace?**
So applications and middleware packages can add request-scoped properties by
declaration merging. The comment in the source says exactly that: *"These open
interfaces may be extended in an application-specific manner via declaration
merging."* Without them, every attached property would need a cast at every use.

**★ What makes a `.d.ts` file's `declare global` block actually take effect?**
The file must be a module — at least one top-level `import` or `export` — and it
must be inside the `tsconfig`'s `include`. A script-mode `.d.ts` already
declares into the global scope, so `declare global` inside it is an error, and a
file outside `include` is simply never read. Both failures look like "merging
does not work".

**★ You merge `userId: number` into `Request`. What have you broken?**
Every public route. The interface is global and knows nothing about which
middleware ran, so declaring the property required makes the type claim
something false on every unauthenticated request. It stays optional, and the
narrowing happens once, in a helper that also mounts the middleware that
guarantees it.

**★ Why is `req.valid` typed `unknown` rather than `any`?**
Because its shape differs per route, so no single type is correct, and `any`
would silently accept every wrong access — including reading a part the route
never validated. `unknown` forces a narrowing at the point of use, and the route
helper performs it once with the schemas in scope.

**★ Can a middleware narrow a property for the handlers after it?**
No. Express composes middleware as an array of functions at run time; there is
no type-level sequence for the compiler to follow, and no way to express "after
this element, the request type is different". The guarantee has to be
re-established by a helper that both mounts the middleware and hands the handler
a context type in which the value is non-optional.

**★ What is wrong with `(req as AuthedRequest).userId` in twenty handlers?**
It is an unchecked assertion repeated twenty times in the files that change most
often. Nothing connects it to the middleware that would make it true, so
mounting a handler without `requireAuth` still compiles and produces `undefined`
at run time. It also reads like an annotation rather than an assertion, so
review does not treat it as one.

---

← **Overview** *(not written yet)* ·
Next → [The five generics in practice](02-the-five-generics-in-practice.md)
