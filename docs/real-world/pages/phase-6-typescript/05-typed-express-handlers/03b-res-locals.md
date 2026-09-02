---
title: "res.locals is typed from a global merge and the fifth generic at once, and their intersection narrows a nullable local for one handler until it collapses to never"
sidebar_label: "03b · res.locals"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — `Locals`, `Response.locals`, the `LocalsObj` slot —
> and the [Express 5.x `res.locals` reference](https://expressjs.com/en/5x/api/response/).
> **TypeScript 7.0.2**, Express **5**. Concept homes:
> [TypeScript 4·06 — global augmentation](../../../../typescript/pages/phase-4-classes-declarations/06-global-augmentation.md),
> [TypeScript 1·11 — intersection types](../../../../typescript/pages/phase-1-type-vocabulary/11-intersection-types.md).
> The gate that reads these locals is
> [3·04's](../../phase-3-express-api/04-authorization.md).

**`res.locals` is the one per-request bag Express itself declares, and it is
typed from two places at once.** A global `Locals` interface that an
application merges into, and the fifth generic slot on every handler type —
combined by intersection, not by override. That intersection is what lets one
handler assert a narrower type than the global without a cast, and it is also
what turns a stale declaration into a property typed `never` with an error
message that points somewhere else.

## Two type sources, one intersection

Verbatim from the declarations, three lines that decide everything about
`res.locals`:

```ts
export interface Locals extends Express.Locals {}
```

```ts
export interface Response<
    ResBody = any,
    LocalsObj extends Record<string, any> = Record<string, any>,
    StatusCode extends number = number,
> extends http.ServerResponse, Express.Response {
    …
    locals: LocalsObj & Locals;
```

So `res.locals` is the **intersection** of the fifth generic slot — per
handler, default `Record<string, any>` — and the global `Locals` interface,
which is empty until an application merges into it. Two sources, two scopes:

| Source | Scope | Typed by | Use it for |
|---|---|---|---|
| `Express.Locals` merge | every response in the process | the augmentation file | values *every* chain may read — the session record |
| `LocalsObj` generic | one handler | the fifth type argument | a narrowing this handler asserts — below |

The merge sits beside chunk 01's `Request` block:

```ts
// apps/api/src/types/express.d.ts  (continued from chunk 01)
declare global {
  namespace Express {
    interface Request { /* id, log, valid, userId — chunk 01 */ }
    interface Locals {
      /** the resolved session, set by sessionMiddleware on every request */
      user: SessionUser | null;
    }
  }
}
```

Now `res.locals.user` is `SessionUser | null` in every handler and every
middleware, [the previous chunk's](03-typed-middleware.md) `requireRole`
compiles without a cast, and — because the global `Locals` is an interface
with a *required* key — a `res.locals.usr` typo is an error rather than an
`any`.

**Why the record goes on `res.locals` and the id goes on `req`.** Chunk 01
chose `req.userId` over `req.user` to stay out of the property `@types/passport`
claims. The full record still has to live somewhere the role gate can reach it,
and `res.locals` is the place Express *itself* nominates for request-scoped
values — the 5.x reference, verbatim: *"The variables set on `res.locals` are
available within a single request-response cycle, and will not be shared
between requests."* The sentence before it says the property exists for
`res.render`; this app has no templates, and the scoping guarantee is the part
that matters. The alternative — a second `Request` merge for `user` — puts the
record on exactly the property every auth library also merges.

## The fifth slot as a per-handler narrowing

Admin routes are mounted behind `requireRole('admin')`, and their handlers know
`res.locals.user` is not null. The global type cannot say so — the same limit
chunk 01 hit with `userId`. The fifth generic can, for one handler:

```ts
// apps/api/src/routes/admin.ts
import type {RequestHandler} from 'express';
import type {ParamsDictionary} from 'express-serve-static-core';
import type {ParsedQs} from 'qs';

type Authed = {user: SessionUser};        // LocalsObj for handlers behind requireRole

export const listOrders: RequestHandler<ParamsDictionary, OrderPage, unknown, ParsedQs, Authed> =
  async (req, res) => {
    const {user} = res.locals;            // SessionUser — not null
    req.log.info({admin: user.id}, 'listing orders');
    res.json(await orders.listForAdmin());
  };
```

Why that narrows rather than conflicts: `res.locals` is `Authed & Locals`, so
`user` is `SessionUser & (SessionUser | null)`. Intersection distributes over
the union — `(SessionUser & SessionUser) | (SessionUser & null)` — and
`SessionUser & null` is `never`, so the property is `SessionUser`. **The fifth
slot narrows a nullable global local for one handler by ordinary type
algebra.**

🔴 **And it is an assertion, exactly as `ReqBody` is.** Nothing connects
`Authed` to `requireRole('admin')` being in the chain; mount `listOrders` on a
public router and `res.locals.user` is `null` at run time with type
`SessionUser`. This is the same shape as chunk 01's `AuthedRequest` cast, one
level more polite. This app allows it on the admin router only, because
[3·04](../../phase-3-express-api/04-authorization.md) mounts the gate with
`router.use(requireRole('admin'))` at the top of that router — one mount, every
route below it — and the review rule is that `Authed` appears in `admin.ts` and
nowhere else.

📌 **Four slots have to be named to reach the fifth.** There is no way to
supply `LocalsObj` alone; `ParamsDictionary`, the response type, `unknown` and
`ParsedQs` are written out so the fifth can be. That verbosity is a feature —
it makes an `Authed` handler visibly different from an ordinary one in review.

## When the intersection becomes `never`

The algebra that narrows can also destroy. If a handler declares
`LocalsObj = {user: string}` — a stale type, a copy from another project —
then `res.locals.user` is `string & (SessionUser | null)`, which is `never`.
Every read of it compiles as `never`, every assignment to it fails, and the
error message is about the assignment, not about the two declarations that
disagree. The tell is `never` appearing on a property nobody declared as
`never`.

The collapse is only ever partial when the two sides share a member —
`{user?: SessionUser}` against the global gives `(SessionUser | undefined) &
(SessionUser | null)`, which is `SessionUser`, and nothing is lost. It is
total when they share none, and a *renamed* type is the usual way to share
none: `SessionUser` becomes `Session` in the shared package, the admin file
still says `SessionUser` from a stale import, and the intersection of two
object types with different required keys is not `never` but an object no
value from the middleware satisfies. The rule that avoids all of it: **the
per-handler type only ever removes `null` from a global property, never
restates its base type** — write `{user: NonNullable<Express.Locals['user']>}`
rather than naming the type a second time.

## Gotchas

**★ A `.d.ts` merging `Locals` under `declare module 'express'` targets the
wrong interface.** The open `Locals` is in the *global* `Express` namespace;
`express-serve-static-core` re-exports it as `export interface Locals extends
Express.Locals {}`, and `Response.locals` is `LocalsObj & Locals` referring to
that re-export. A `declare module 'express'` block declaring `interface Locals`
creates an unrelated export on the `express` module and `res.locals` stays
`Record<string, any>`.

**★ `res.locals.user` typed by the merge is required, so every response must
set it.** The interface says `user: SessionUser | null`, not `user?:`. That is
correct — `sessionMiddleware` runs on every request below its mount — and it
means a test that builds a `Response` stub without `locals.user` fails to
compile, which is the test telling you the stub is missing the middleware's
effect.

**★ The fifth slot and the merge intersect, so a disagreement is `never`, not
an error at the declaration.** `LocalsObj = {user: string}` against
`Locals.user: SessionUser | null` yields `user: never`. Nothing complains where
the handler is declared; every use complains about something else. When a
property reads as `never`, look for two declarations of it.

**★ `Authed` on a handler is an assertion about a `router.use` line in another
file.** Mount an `Authed`-typed handler outside the admin router and
`res.locals.user` is `null` with type `SessionUser`. The only defence is
positional: `Authed` is declared and used in `admin.ts`, whose router mounts
`requireRole('admin')` on line one, and a handler exported from `admin.ts`
into another router is a review failure.

**★ The default `LocalsObj` is `Record<string, any>`, and it wins on any key
the merge does not name.** `res.locals.anything` still compiles as `any` on
every handler, because the intersection with an index signature of `any`
admits every key. The merge types the keys it declares and nothing else; it
does not close the bag. A handler stashing `res.locals.cart` with no
declaration is writing `any`, and the reader of it is reading `any`.

**★ `app.locals` is a different object with a different lifetime and the same
name.** `res.locals` is per request; `app.locals` is process-wide and shared
across every request. Both are typed loosely by default. A value that belongs
to a request — a user, a request id — put on `app.locals` is a cross-request
leak, and the reference's own sentence about `res.locals` is the one that
draws the line.

**★ Reading `res.locals` in the route helper's handler is the wrong seam.**
`route()` hands handlers a `Ctx` with `userId`; a handler that reaches for
`ctx.res.locals.user` has stepped around the helper's contract. If a
helper-covered route genuinely needs the role, the `Ctx` grows a `role` field
set from `res.locals.user` inside `route()` — one place, typed once — rather
than each handler reading the bag.

## Interview questions

**★ `res.locals` is typed from two places. Which, and how do they combine?**
The global `Express.Locals` interface, reached through `export interface
Locals extends Express.Locals {}`, and the fifth generic `LocalsObj` on
`Request`/`Response`/`RequestHandler`. `Response.locals` is declared as
`LocalsObj & Locals` — an intersection. A per-handler `{user: SessionUser}`
against a global `user: SessionUser | null` narrows to `SessionUser` because
`SessionUser & null` is `never`; a per-handler `{user: string}` against the
same global collapses to `never`, with the error surfacing at every use rather
than at the declaration.

**★ Why put the session record on `res.locals` and the id on `req`?**
Chunk 01 keeps `req.user` free because auth libraries claim it. The route
helper only needs the id, so `req.userId` is what `Ctx` reads. The role gate
needs the role, so the full record needs a home, and `res.locals` is the place
Express itself scopes to *"a single request-response cycle"*. One middleware
sets both from one resolved value, so they cannot disagree.

**★ Can the fifth generic make `res.locals.user` non-null for the admin
routes? Is that safe?**
It can — `RequestHandler<…, {user: SessionUser}>` intersects with the global
and the `null` member vanishes. It is safe in exactly the way `ReqBody` is
safe: it is an assertion about which middleware ran, verified by nothing. The
app confines the assertion to `admin.ts`, whose router mounts
`requireRole('admin')` once at the top, and treats that file as the boundary.

**★ Does merging into `Locals` make `res.locals` a closed object?**
No. The default fifth slot is `Record<string, any>`, and an intersection with
an index signature of `any` admits any key. The merge gives declared keys a
type; undeclared keys remain `any`. Closing the bag would mean supplying a
fifth slot without an index signature on every handler, which is not worth
doing — the discipline is that nothing is written to `res.locals` without a
line in the merge.

**★ What is the difference between `res.locals` and `app.locals`, in one
sentence from the docs?**
The reference says values on `res.locals` *"are available within a single
request-response cycle, and will not be shared between requests"*, and points
to `app.locals` for values that should persist between requests. One is
request-scoped, the other is the process; the names are the only thing they
share.

---

← Prev: [Typed middleware](03-typed-middleware.md) ·
[Overview](README.md) ·
Next → [The typed error handler](03c-the-typed-error-handler.md)
