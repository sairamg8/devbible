---
title: "The second question"
sidebar_label: "01 · The second question"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Authorization asks *what may this caller do?* — after identity is settled, and
before any record is loaded. Its answer is 403, never 401, and every uncertainty
inside it resolves toward denial.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** **Express has no
> authorization primitives**: no roles, no permissions, no guards — its six
> built-ins are `json`, `urlencoded`, `raw`, `text`, `static` and `Router`
> ([express reference](https://expressjs.com/en/5x/api/express.html)). The factory
> below is the documented *"configurable middleware"* shape — a function taking
> options and returning the middleware
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)) — and
> `req.user` is a convention set by
> [page 04](../04-authn-middleware/README.md), not an Express property. Status
> semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): **401**
> (§15.5.2) means the request lacks valid authentication credentials and the
> response must carry `WWW-Authenticate`; **403** (§15.5.4) means the server
> understood the request and refuses to authorize it — and RFC 9110 also notes a
> server may answer **404** instead when it wishes not to reveal that the target
> exists. `next(err)` reaching the error handler with `err.status` is
> [error handling](https://expressjs.com/en/guide/error-handling.html).
> **The design guidance is this bible's.**

## Three questions, and this is the second

[Page 04 · chunk 01](../04-authn-middleware/01-one-question-only.md) split
authorization into three questions. This page is the middle one:

| Question | Where it can live | Answer on failure |
|---|---|---|
| Who is this? | middleware | 401 |
| **What may this role do?** | **middleware — this page** | **403** |
| May they touch *this row*? | **the service**, after the load | 404 ([page 07](../07-ownership.md)) |

The middle question is the one middleware is actually good at, for a precise
reason: **it needs nothing but `req.user`**. No database, no route parameters, no
record. That is what makes it declarative, greppable, and safe to run before the
handler.

## The shape

```js
export function requirePermission(permission) {
  return function requirePermission(req, res, next) {
    if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED'));

    const granted = ROLE_PERMISSIONS[req.user.role] ?? [];   // unknown role ⇒ []
    if (!granted.includes(permission)) {
      return next(new HttpError(403, 'FORBIDDEN'));
    }
    next();
  };
}
```

Four decisions in nine lines, and each is the subject of a section below:

1. It is a **factory** — `requirePermission('orders:delete')` is configured at
   mount time and closes over its permission
   ([Phase 2 · 04](../../phase-2-middleware/04-middleware-factories.md)).
2. It goes through **`next(err)`**, not `res.status(403).json(…)`, so the envelope
   comes from the one error handler and a 403 looks like every other failure to a
   client ([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)).
3. The returned function is **named**, so `DEBUG=router` and stack traces show
   `requirePermission` rather than `<anonymous>`
   ([Phase 2 · 02 · chunk 02](../../phase-2-middleware/02-execution-order/02-ordering-in-practice.md)).
4. The lookup **defaults to an empty list**, not to a permissive one.

## 401 and 403 are not two shades of "no"

They are instructions to the client, and picking the wrong one produces a bug
rather than an imprecision:

| | 401 Unauthorized | 403 Forbidden |
|---|---|---|
| Means | *we do not know who you are* | *we know, and the answer is no* |
| Client should | authenticate and retry | **not retry** |
| Required header | `WWW-Authenticate` | none |
| Fixed by | a fresh token | a permission change |

🔴 **A 403 answered as 401 creates a retry loop that can never succeed.** A
well-behaved client refreshes its token, retries, is refused again, refreshes
again — the failure looks like an authentication outage while the real cause is a
missing permission, and the refresh endpoint absorbs the traffic
([Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md)).

⚠️ **The inverse also matters**: a 401 answered as 403 tells a client "stop
retrying" when a token refresh would have fixed it, and users see a permission
error for an expired session.

**When 404 is the right answer instead.** RFC 9110 explicitly permits it: if
admitting the resource exists is itself the leak — another tenant's order,
another user's document — the honest 403 tells the caller their guess was
correct. That reasoning belongs to ownership, where the record is in hand
([page 07](../07-ownership.md)); at this layer, the caller's *own* permissions
are not a secret from them, so 403 is right.

## Fail closed, in four places

"Fail closed" is not a slogan; it is four specific lines that each turn a bug
into a denial.

**1 · Unknown role → no permissions.**

```js
const granted = ROLE_PERMISSIONS[req.user.role] ?? [];   // ✅
const granted = ROLE_PERMISSIONS[req.user.role] ?? ALL;  // ⛔ never
```

A typo in a seeded role, a role deleted from the map, a token issued before a
rename — all of them must lock someone out rather than let them in. Being locked
out is reported in minutes; the other direction is found in an audit, if at all.

**2 · Missing `req.user` → 401, not a crash.** Reaching this middleware without
authentication means the chain is misordered. `req.user.role` on `undefined`
throws a TypeError, which Express 5 forwards to the error handler as a **500** —
turning a wiring bug into "the server is broken" instead of "you are not
authenticated" ([Phase 5 · 02](../../phase-5-errors/02-async-errors/README.md)).

**3 · A thrown lookup → deny.** If permissions come from anywhere that can fail —
a cache, a database, a remote service — the `catch` must produce 403 or 503, never
`next()`. This is the same fall-through bug as
[page 04 · chunk 01](../04-authn-middleware/01-one-question-only.md), and it is
worse here: the caller *is* authenticated, so nothing downstream will stop them.

**4 · An unguarded route → unreachable, not open.** If it is possible to forget a
guard, that is the design to fix rather than the discipline to demand — the
opt-out argument in
[page 04 · chunk 03](../04-authn-middleware/03-mounting-and-testing.md).

## Normalize the role at the boundary, once

Role values arrive from a token, a database seed, or an environment-specific
fixture, and they drift: `'Admin'`, `'admin'`, `' admin'`, `'ADMIN'`. A
comparison in middleware silently fails for exactly one environment.

```js
// ✅ in the authn middleware, where req.user is built
req.user = {id: payload.sub, role: String(payload.role ?? '').trim().toLowerCase()};
```

Normalizing where identity is *created* means every guard downstream compares
already-clean values — the same "parse at the boundary" argument as
[page 01](../01-validate-at-boundary/README.md), applied to the one field that
decides access.

⚠️ **Do not normalize inside each guard.** Two guards normalizing slightly
differently is precisely the drift that produces "it works for admins in staging".

## Where it mounts

Authorization is **always after authentication and always before the handler**,
and it composes as a plain array:

```js
router.delete('/orders/:id',
  requireAuth,                          // who
  requirePermission('orders:delete'),   // what
  ordersController.remove);             // which row — checked inside
```

With opt-out authn on the router, the route line carries only the second guard —
which is the arrangement that reads best, because **the line then states exactly
what this route protects** and nothing that is true of every route:

```js
router.use(requireAuth);                                    // once
router.delete('/orders/:id', requirePermission('orders:delete'), ordersController.remove);
```

🔴 **Do not put `requirePermission` in `router.use` for a whole resource.**
Different verbs on the same resource need different permissions — reading orders
is not deleting them — and a router-wide guard either over-grants the reads or
locks out everyone who cannot delete. Authentication is a router-level concern;
authorization is a route-level one.

## Gotchas

**Symptom:** A client loops re-authenticating after a permission error
**Cause:** 401 returned for an authorization failure
**Fix:** 403. The credentials were fine; a new token cannot help

**Symptom:** Users see "forbidden" when their session simply expired
**Cause:** 403 returned where 401 belongs
**Fix:** No `req.user` means 401; a known caller lacking a permission means 403

**Symptom:** A typo in a role name grants access
**Cause:** A permissive default in the permission lookup
**Fix:** `?? []`. Unknown role resolves to no permissions

**Symptom:** `Cannot read properties of undefined (reading 'role')`, surfacing as
a 500
**Cause:** The guard ran without authentication before it
**Fix:** Guard for missing `req.user` and answer 401 — the crash is a symptom of a
broken chain, not the bug itself

**Symptom:** Admins are refused in staging but not in production
**Cause:** Role values differ in case or whitespace between environments
**Fix:** Normalize once where `req.user` is built, never inside each guard

**Symptom:** Every route on a resource requires the strongest permission
**Cause:** `requirePermission` mounted with `router.use` for the whole resource
**Fix:** Authentication at the router, authorization per route

**Symptom:** A 403 body looks nothing like the API's other errors
**Cause:** The guard responded directly instead of calling `next(err)`
**Fix:** One error handler owns the envelope

## Interview questions

**★ 401 or 403 when a role check fails?**
403 — the caller is known and the answer is no. 401 says the credentials were
rejected, so a well-behaved client refreshes its token and retries into a loop
that cannot succeed. 401 is for a missing or invalid credential; 403 is for a
valid one that is not enough.

**★ What does "fail closed" mean concretely in an authorization guard?**
Unknown role resolves to an empty permission list; a missing `req.user` returns
401 rather than throwing; a failed permission lookup denies rather than falls
through; and a route with no guard should be unreachable rather than open. Every
uncertainty resolves toward denial.

**★ Why does the guard call `next(err)` instead of responding directly?**
So the response envelope comes from the single error handler and a 403 is shaped
like every other failure. Responding inside the guard duplicates the contract and
guarantees it drifts.

**★ Why is authorization a per-route concern when authentication is per-router?**
Because every route on a resource needs *a* caller, but different verbs need
different permissions. A router-wide permission guard either over-grants reads or
locks out everyone who cannot perform the strongest operation.

**When is 404 the correct answer to an authorization failure?**
When admitting the resource exists is itself the leak — another tenant's record,
for instance. RFC 9110 explicitly permits it. It applies to ownership, where the
record has been loaded; a caller's own permissions are not a secret from them, so
role checks answer 403.

**Where should role values be normalized?**
Once, where `req.user` is built. Normalizing inside each guard invites two guards
to normalize differently, which is exactly the drift that makes authorization
work in one environment and not another.

---

Index: [RBAC middleware](README.md) · Next → [Permissions, not role names](02-permissions-not-roles.md)
