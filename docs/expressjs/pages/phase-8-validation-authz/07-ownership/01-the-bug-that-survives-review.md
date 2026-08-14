---
title: "The bug that survives review"
sidebar_label: "01 · The bug that survives review"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Every line individually correct, a valid token, a correct permission — and any
authenticated user reads any record by changing a number in the URL. This is the
most consequential bug in this corpus, and it hides in more places than `:id`.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** **Nothing here
> is an Express feature** — Express has no authorization layer at all
> ([express reference](https://expressjs.com/en/5x/api/express.html)). The one
> framework fact that shapes the page is structural: middleware runs **before**
> the handler ([using middleware](https://expressjs.com/en/guide/using-middleware.html)),
> so it cannot see a record that has not been fetched — which is why this check
> cannot live where RBAC lives
> ([page 06 · chunk 03](../06-rbac-middleware/03-what-rbac-cannot-do.md)).
> `req.params` values are strings the **caller chose**
> ([request reference](https://expressjs.com/en/5x/api/request.html)). The failure
> has a name outside this bible — **IDOR**, catalogued as **Broken Object Level
> Authorization**, the first entry of the
> [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).
> **The design guidance is this bible's.**

## The anatomy

```js
router.get('/orders/:id',
  requireAuth(deps),                  // ✅ authenticated
  requirePermission('orders:read'),   // ✅ authorized to read orders
  async (req, res) => {
    const order = await orderRepo.findById(req.params.id);   // ⛔ ANY order
    res.json(toOrderDto(order));
  },
);
```

A valid token. A correct permission. And `req.params.id` is **a string the caller
typed**, used directly as the identity of the thing to return.

🔴 **It survives review because each line is individually right.** There is no
wrong line to point at. The reviewer checks that the route is authenticated, that
the permission matches the resource, that the DTO does not over-expose — and
every one of those checks passes.

🔴 **It survives testing because tests fetch the user's own records.** The fixture
creates a user, creates their order, requests that order, asserts 200. Nothing in
the happy path ever asks for someone else's id, so nothing fails
([chunk 03](03-status-and-proving-it.md) is the test that would).

It is found by an attacker, a curious user, or a penetration test — in that order
of likelihood.

## Why the permission check does not help

`requirePermission('orders:read')` is doing its job correctly. It confirms this
caller may read **orders as a kind of thing**. It cannot confirm they may read
**order 7**, because at that moment order 7 has not been loaded and nothing in
the request knows who owns it.

| | Answers | Needs |
|---|---|---|
| Authentication | who is this? | the credential |
| RBAC | may this role read orders? | `req.user` and a static map |
| **Ownership** | **may they read *this* order?** | **the record** |

The three are complementary, and only the third can catch an id substitution.
**Two correct guards produce a false sense that the route is protected** — which
is exactly why this bug outlives the ones that look scarier.

## Where it hides beyond `:id`

Most write-ups stop at the path parameter. In real codebases the identifier
arrives by at least six routes, and the later ones are where audits find the
survivors:

**1 · The path parameter.** `GET /orders/:id` — the textbook case.

**2 · A body field.** `POST /transfers {fromAccountId, toAccountId}`. Validation
confirms it is a UUID; nothing confirms it is *theirs*. The schema makes this
worse by making the field look checked
([page 01 · chunk 02](../01-validate-at-boundary/02-parse-dont-validate.md)).

**3 · A nested route's parent.** `GET /projects/:projectId/tasks/:taskId` — a
check on `taskId` alone still leaks if the task belongs to a project the caller
cannot see, and a check on `projectId` alone lets a foreign `taskId` ride along.
**Both must be scoped, and their relationship asserted.**

**4 · A filter or sort key.** `GET /orders?userId=8`. The parameter is
convenient, well-typed, and hands the caller a scope selector.

**5 · A bulk or batch operation.** `POST /orders/bulk-cancel {ids: [...]}`.
A per-item loop that checks the first id, or checks and then acts on the whole
array, protects nothing. **Every element is a separate authorization decision.**

**6 · An indirect reference.** A file key, a signed URL path, an export id, a
webhook delivery id. These are the ones nobody thinks of as resources, and they
are still rows with owners.

⚠️ **Autoincrement ids make all six worse**, because guessing is free. UUIDs are
**not** a fix — they raise the cost of enumeration and change nothing about
authorization. A leaked, logged, or shared UUID is as usable as `7`.

## The mental model: identifiers are input

Everything the caller supplies is untrusted, and an identifier is no exception —
it is untrusted **input naming a row**. Validation makes it well-formed;
authorization decides whether this caller may name that row at all.

```
"7"           → parsed → 7            ← validation's job ends here
7             → owned by user 42?     ← authorization's job starts here
```

This is why "we validate everything with Zod" is not an answer to IDOR: a schema
proves the shape of an id and cannot know who owns it
([page 01 · chunk 02](../01-validate-at-boundary/02-parse-dont-validate.md)).

## The two habits that prevent it

Both are developed in [chunk 02](02-scope-the-query.md); stated as principles:

**1 · Scope the query rather than checking the row.** `findOwned(id, actorId)`
means the unauthorized row never enters the process, and "not found" and "not
yours" collapse into one path.

**2 · Put the rule in the service, not the controller or middleware.** The
service is the only layer that both loads the resource and knows the rule, so the
check applies to every caller — a job, a CLI, a second transport — not just the
HTTP route someone remembered to guard
([Phase 7 · 03](../../phase-7-layering/03-fat-controllers.md)).

## Gotchas

**Symptom:** Changing an id in the URL returns another user's data
**Cause:** No ownership check — every guard present except the one that needs the
record
**Fix:** Scope the query by actor id; treat "not owned" as "not found"

**Symptom:** The detail endpoint is safe and the list endpoint leaks
**Cause:** The check was added to `findById` and forgotten on the collection query
**Fix:** Scope at the repository, so every query carries it — lists included

**Symptom:** A UUID migration was done "to fix IDOR" and the API still leaks
**Cause:** Unguessable ids raise the cost of enumeration and change nothing about
authorization
**Fix:** Scope the query anyway. A UUID that leaks once is as usable as `7`

**Symptom:** A validated request body still reaches another tenant's row
**Cause:** The schema proved the id was a UUID, which says nothing about ownership
**Fix:** Authorize every identifier the caller supplies, wherever it arrives

**Symptom:** A nested route leaks despite a check on the child id
**Cause:** The parent was never scoped, or the child was not asserted to belong to
it
**Fix:** Scope by the parent *and* assert the relationship in the query

**Symptom:** A bulk endpoint cancels records the caller does not own
**Cause:** One authorization decision made for an array of ids
**Fix:** Every element is its own decision — scope the write by actor and compare
the affected count

**Symptom:** Everyone agreed the route was protected
**Cause:** Two correct guards (authn, RBAC) reading as three
**Fix:** Name the third question explicitly in review: *may they touch this row?*

## Interview questions

**★ What is IDOR, in terms of the request?**
An identifier supplied by the caller is used to select a record without asking
whether that caller may have it. The request is authenticated and the role is
permitted; only the row-level decision is missing, so changing the id returns
someone else's data.

**★ Why does this bug survive code review and tests so reliably?**
Because every line is individually correct — valid token, correct permission,
ordinary fetch — so there is nothing for a reviewer to point at; and because
tests only ever request the user's own records, so the happy path never
exercises another user's id.

**★ Why can a permission check not prevent it?**
Because it answers a different question. `orders:read` confirms the caller may
read orders as a kind of thing; the record has not been loaded, so nothing knows
who owns it. Middleware structurally cannot answer the row-level question.

**★ Where does the identifier come from, besides the path?**
Body fields, a nested route's parent, filter and sort parameters, every element
of a bulk operation, and indirect references like file keys and export ids. The
path parameter is the case everyone checks; the others are where audits find
survivors.

**Do UUIDs fix it?**
No. They make enumeration expensive and leave authorization exactly as absent as
before. Ids leak — in logs, in shared links, in exports — and a leaked UUID is as
usable as a small integer.

**Does schema validation help?**
It makes the identifier well-formed, which is necessary and unrelated. A schema
cannot know who owns row 7, and a validated field can read as a checked field,
which makes the omission harder to see.

---

Index: [Resource ownership](README.md) · Next → [Scope the query](02-scope-the-query.md)
