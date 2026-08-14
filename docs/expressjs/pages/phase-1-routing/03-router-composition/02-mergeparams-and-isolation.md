---
title: "mergeParams and isolation"
sidebar_label: "02 · mergeParams and isolation"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**A router's `req.params` is replaced, not extended — and restored when the
router finishes. `mergeParams` opts into a copy of the parent's, with the child
winning every name collision.**

> Verified: 2026-08-14. Read from **`router@2.2.0`**'s `index.js` —
> `Router.prototype.handle`, `mergeParams`, `restore` — in
> `sandbox/express-verify/node_modules/`, cited by function. **Reading source is
> not a run: nothing was executed for this page and it carries no console block**,
> apart from the one below, which is **re-used unchanged from the earlier
> authorised `sandbox/express-verify` run** and is sandbox-measured. The
> [routing guide](https://expressjs.com/en/guide/routing.html) states that a
> parent route's path params are *"not accessible by default from the
> sub-routes"* without the `mergeParams` option.

## The default: parent params are gone

```js
// nested.mjs
import express from 'express';

const comments = express.Router({mergeParams: true});
comments.get('/:commentId', (req, res) => {
  res.json(req.params);
});

const app = express();
app.use('/posts/:postId/comments', comments);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/posts/1/comments/2`,
  );
  console.log(await res.json());
  server.close();
});
```

```console
$ node nested.mjs
{ postId: '1', commentId: '2' }
```

Remove `{mergeParams: true}` and `postId` is simply absent — not `undefined` in
a way you would notice, just missing, so `req.params.postId` reads `undefined`
and a query scoped by it silently matches everything.

## Why: two lines in `handle`

```js
// router/index.js — Router.prototype.handle()
let done = restore(callback, req, 'baseUrl', 'next', 'params')
// …
req.params = self.mergeParams
  ? mergeParams(layer.params, parentParams)
  : layer.params
```

Read as behaviour:

- **`req.params` is assigned, not merged.** Without `mergeParams`, the matched
  layer's own captures *replace* whatever was there. Nothing is deleted from an
  object; a different object is installed.
- **`restore` puts the parent's back on the way out.** It captures the current
  `baseUrl`, `next` and `params` at router entry and reassigns them before calling
  the parent's callback. So the isolation runs in **both** directions: a child
  cannot see the parent's params, and a child cannot leak its own upward. Code
  after `app.use('/posts/:postId/comments', comments)` sees the app's params
  again, unchanged.

## `mergeParams`: copy the parent, child wins

```js
// router/index.js — mergeParams()
if (typeof parent !== 'object' || !parent) return params

const obj = Object.assign({}, parent)      // copy the parent as the base

if (!(0 in params) || !(0 in parent)) {
  return Object.assign(obj, params)        // child overwrites on collision
}
// …numeric-index reindexing, below…
```

Two rules and one special case:

**1 · The child wins on a name collision.** `Object.assign(copyOfParent, params)`
— so if both the parent mount and the child route declare `:id`, the value inside
the child is the child's.

🔴 **That is a silent correctness bug waiting to happen.**
`app.use('/users/:id', express.Router({mergeParams: true}))` with a child route
`/orders/:id` gives you `req.params.id` = the *order* id, in a handler that looks
like it is scoped to a user. The fix is naming discipline, not configuration:
`:userId` and `:orderId`, never bare `:id` on a nested route. Nothing warns.

**2 · A copy is made per matched layer.** `Object.assign({}, parent)` allocates.
Cheap, but it means `req.params` inside a merged child is not the same object as
the parent's — mutating it (a `router.param` callback replacing a value) does not
reach back up.

**3 · Numeric indices are re-indexed, not overwritten.** This is the branch most
people never hit and cannot debug when they do. RegExp routes capture into
numeric keys (`req.params[0]`, `[1]`, …). If *both* parent and child have
numeric captures, a plain merge would clobber `[0]`. So the source counts the
parent's numeric keys and **offsets the child's by that many**:

```js
// parent RegExp captured 2 groups → parent has [0], [1]
// child  RegExp captured 1 group  → child's [0] becomes [2]
req.params   // { 0: parentFirst, 1: parentSecond, 2: childFirst }
```

Parent indices keep their positions; child indices follow. Worth knowing exists;
worth avoiding by using **named** params, which have none of this ambiguity.

## When to nest at all

Nesting is the feature people reach for first and regret third. The honest
positions:

**Nest when the child cannot exist without the parent** — comments on a post,
line items on an order. The URL is the containment, and the parent id is a
required scope for every query underneath. This is exactly when `mergeParams`
earns its place.

**Do not nest merely because the data is related.** `/users/:userId/orders` is a
worse route than `/orders?userId=…` if an order is a first-class resource you
also fetch by id — you now have two URLs for the same object and a cache with two
keys for it.

**Never nest more than two levels.** `/orgs/:orgId/teams/:teamId/projects/:projectId/tasks/:taskId`
is four ids to validate, four authorization checks to remember, and a
`mergeParams` chain where any missing flag silently drops a scope. Flatten:
`/tasks/:taskId` and let the handler load the chain it needs.

🔴 **The security consequence of getting this wrong is the important one.** In
`/orgs/:orgId/projects/:projectId`, it is tempting to check that the caller
belongs to `orgId` and stop. But `projectId` is independently attacker-chosen —
nothing in the route guarantees the project is *in* that org. The check must be
`findProject(projectId, callerOrgId)`, scoping the query, not comparing after the
load. That is the highest-consequence gap in most APIs and it is
[Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md).

## Trade-off

Deep nesting mirrors the URL structure and gives every id an obvious home. It
costs mount-path bookkeeping, a `mergeParams` flag per level that fails silently
when forgotten, a name-collision hazard on `:id`, and one authorization check per
segment that the framework will not remind you about.

**Prefer feature routers at one level** — `/api/orders`, `/api/users` — and nest
only where containment is real. When you do nest, name every param uniquely and
scope every query by the full chain.

## Gotchas

**Symptom:** `req.params.postId` is `undefined` in a child router
**Cause:** Default `mergeParams: false`; `handle` assigned the child layer's own
params over the parent's
**Fix:** `express.Router({mergeParams: true})` on the child. Note the option is
read at construction — it cannot be set later

**Symptom:** With `mergeParams` on, `req.params.id` is the wrong id
**Cause:** Both parent mount and child route declare `:id`, and
`Object.assign(copyOfParent, childParams)` lets the child win
**Fix:** Never use bare `:id` on a nested route. `:userId`, `:orderId` —
uniqueness is the only defence, and nothing warns

**Symptom:** A `router.param` callback mutates `req.params` and the change is not
visible in the parent
**Cause:** `mergeParams` copies (`Object.assign({}, parent)`), and `restore`
reassigns the parent's original object on the way out
**Fix:** Put derived values on `req` (`req.order`), not back into `req.params`

**Symptom:** `req.params[0]` from a parent RegExp route has moved
**Cause:** It has not — the *child's* numeric indices were offset past the
parent's, which is the intended merge. Reading them positionally is the bug
**Fix:** Use named params. Numeric captures across a nesting boundary are
unreadable by design

**Symptom:** An authorization check on `:orgId` passes and the caller reads
another org's project
**Cause:** `projectId` is independently attacker-supplied; the route implies
containment that nothing verified
**Fix:** Scope the query — `findProject(projectId, callerOrgId)` — rather than
checking the first segment and trusting the rest

## Interview questions

**★ Why is `req.params.postId` missing in a nested router by default?**
Because `Router.prototype.handle` *assigns* `req.params = layer.params` for the
matched layer rather than merging. `mergeParams: true` switches that to
`mergeParams(layer.params, parentParams)`, which copies the parent and layers the
child on top.

**★ What happens to `req.params` when a nested router finishes?**
It is restored. `handle` wraps its callback in `restore(callback, req, 'baseUrl',
'next', 'params')`, which captures those three at entry and reassigns them before
calling the parent's callback — so the isolation works in both directions.

**★ With `mergeParams: true`, which value wins if parent and child both declare
`:id`?**
The child's. The merge is `Object.assign(copyOfParent, childParams)`. It is
silent, and it is the reason nested routes should never use a bare `:id`.

**★ What does `mergeParams` do with numeric params from RegExp routes?**
It re-indexes rather than overwriting: the parent's numeric keys keep their
positions and the child's are offset past them. It is correct, and it is a strong
argument for named params.

**When should you nest routers, and when should you not?**
Nest when the child cannot exist outside the parent — comments on a post, items
on an order — so the parent id is a required scope for every query. Do not nest
merely because the data is related, and do not go past two levels: each level is
another id to validate and another authorization check to forget.

**What is the security risk specific to nested resource routes?**
That the URL implies containment nothing verified. Checking the caller's access
to `:orgId` says nothing about whether `:projectId` belongs to that org, because
both come from the caller. Scope the lookup by the full chain instead of checking
the first segment.

---

← Prev: [Mounting a router](01-mounting-a-router.md) · Index: [Router composition](README.md) · Next → [Composition at scale](03-composition-at-scale.md)
