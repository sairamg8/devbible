---
title: "Scope the query"
sidebar_label: "02 · Scope the query"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Do not load the row and then compare owner ids. Make the scope part of the
query, so an unauthorized row never enters the process — and put the rule in the
service, where every caller inherits it.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Nothing on this
> page is an Express API; it is repository and service design. The layering
> argument is [Phase 7](../../phase-7-layering/01-controller-service-repository/README.md),
> and the database-side backstop is PostgreSQL row-level security
> ([RLS](../../../../postgresql/pages/phase-13-ops/14-rls/README.md)) and the
> tenancy models in
> [PostgreSQL Phase 3 · 20](../../../../postgresql/pages/phase-3-ddl/20-multi-tenancy/README.md)
> — both written against the PostgreSQL manual in their own track and not restated
> here. **The repository discipline, the write pattern and the admin-path guidance
> are this bible's.**

## Compare, or scope?

The instinctive fix is a comparison after fetching:

```js
// ⚠️ works, and it is a check you can forget on the next endpoint
const order = await orderRepo.findById(id);
if (order.userId !== actorId) throw new NotFoundError('ORDER_NOT_FOUND');
```

The stronger fix makes the scope part of the query, so there is no window in
which an unauthorized row exists in memory:

```js
// ✅ the row cannot be loaded at all unless it is theirs
const order = await orderRepo.findOwned(id, actorId);
if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
```

Four reasons the second is better, and the fourth is the one people miss:

1. **The unauthorized row never enters the process**, so it cannot be logged,
   cached, serialized into an error, or returned by a later refactor that moves
   the comparison.
2. **"Not found" and "not yours" become one code path**, so the 404-versus-403
   decision is made once rather than at every call site
   ([chunk 03](03-status-and-proving-it.md)).
3. **It composes with lists.** `WHERE user_id = $actor` on the collection query is
   the same defence, and list endpoints are where per-row comparisons are most
   often forgotten.
4. **It closes the gap between check and use.** A comparison is a decision made at
   one moment about a row that is written at another; scoping the *write* makes
   the decision and the effect a single statement — see below.

## The repository is where the discipline lives

Make the actor a parameter of the method, not an afterthought inside it:

```js
// ⛔ an unscoped method is a loaded gun in the codebase
findById(id)

// ✅ scope is part of the signature — forgetting it is a type/arity error
findOwned(id, actorId)
listForActor(actorId, {limit, cursor})
```

🔴 **The point is that the unscoped method should not exist.** A repository that
offers `findById` alongside `findOwned` will get `findById` called by the next
endpoint written in a hurry, and nothing about that call looks wrong. Repository
methods that take an actor or tenant id are a small, boring discipline that
removes an entire vulnerability class
([Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md)).

## Writes: scope the statement, then check what it did

Reads are the famous case; **writes are the dangerous one**, because a comparison
made before an update is a decision about a row that may change underneath it:

```js
// ⚠️ check-then-act: correct today, and it has a window
const order = await repo.findOwned(id, actorId);
if (!order) throw new NotFoundError();
await repo.updateStatus(id, 'cancelled');      // ⛔ unscoped write

// ✅ one statement decides and acts
const changed = await repo.cancelOwned(id, actorId);   // UPDATE … WHERE id AND user_id
if (changed === 0) throw new NotFoundError();
```

**Check the affected-row count, not just the absence of an error.** An `UPDATE`
that matched nothing succeeds — it is not an error, it is zero rows — so a write
that silently did nothing looks identical to one that worked unless the count is
read. This is also what makes the operation safe to retry
([Phase 6 · 06](../../phase-6-rest-surface/06-idempotency-keys.md)).

⚠️ **Where a genuine read-then-write is unavoidable** — a rule that needs the
loaded record to decide — both statements belong in **one transaction**, and the
scope belongs on both
([Phase 7 · 07](../../phase-7-layering/07-transaction-middleware.md)).

## Nested resources: scope by the parent, assert the relationship

`GET /projects/:projectId/tasks/:taskId` has two identifiers and therefore two
decisions — and a third, implicit one:

```js
// ✅ the parent is scoped, and the child is required to belong to it
const task = await taskRepo.findInProject(taskId, projectId, actorId);
if (!task) throw new NotFoundError('TASK_NOT_FOUND');
```

Checking `taskId` alone leaks whenever the task's project is not visible to the
caller. Checking `projectId` alone lets a foreign `taskId` ride along inside a
project the caller *can* see. **The query must express both, plus the edge between
them** — which in SQL is a join and a `WHERE` on the parent's owner, and in a
document store is the same predicate spelled differently.

## Scope from the credential, never from the payload

```js
// ⛔ tenant hopping: the caller chooses their own scope
const rows = await repo.list({tenantId: req.body.tenantId});

// ✅ scope comes from the verified credential
const rows = await repo.list({tenantId: req.user.tenantId});
```

A `tenantId` in the body, the query string, or a header is **caller-supplied
input** wearing the costume of configuration. If it must appear in the request at
all — some clients legitimately send it — it is checked *against* `req.user`, and
a mismatch is a denial, never a substitution
([page 08](../08-tenant-and-logout.md)).

## The actor is an argument, not ambient state

```js
// ✅ the signature says what the rule depends on
await orders.cancel(orderId, actor);
```

A service that reaches for `req.user`, or pulls identity out of
`AsyncLocalStorage`, has an authorization rule that **no signature declares and
no test can vary**. Passing the actor keeps the rule callable from a job, a CLI
and a test, and puts the dependency where a reviewer checking authorization will
look ([page 04 · chunk 01](../04-authn-middleware/01-one-question-only.md),
[Phase 7 · 02](../../phase-7-layering/02-domain-vs-transport.md)).

## The privileged path, made loud

Some callers genuinely must read across users — an admin console, a support tool,
a reconciliation job. Give them a **separate, explicitly named method**:

```js
// ✅ verbose on purpose; greppable; auditable
findByIdAcrossTenants(id, {actor, reason})
```

Three properties worth insisting on: the name says what it does, it takes the
actor so the access can be logged with a subject, and it is **grep-able as a
class of call** — `grep -rn AcrossTenants src/` is a complete audit of every
privileged read in the codebase.

⛔ **The alternative — adding an `ignoreOwnership: true` option to the normal
method — is the failure mode.** A boolean that disables authorization will
eventually be passed by a caller that did not mean it, and it makes the audit
impossible because the dangerous call looks like the safe one.

## The database as a backstop

Application-level scoping is the primary control. A second, independent one is
available when the data lives in PostgreSQL: **row-level security** makes the
predicate a property of the table, so a query that forgets the scope returns
nothing rather than everything
([PostgreSQL Phase 13 · 14](../../../../postgresql/pages/phase-13-ops/14-rls/README.md)).

It is a real backstop and it is not free — the identity has to be carried into
the session, and the policies participate in planning. Treat it as defence in
depth for a system where the cost of one forgotten `WHERE` is unacceptable, not
as a replacement for scoping in the repository. The tenancy models it sits inside
are [PostgreSQL Phase 3 · 20](../../../../postgresql/pages/phase-3-ddl/20-multi-tenancy/README.md).

## Trade-off

Scoping every query by actor or tenant costs a parameter on every repository
method and a little duplication in queries. It also makes some legitimate
operations awkward — an admin tool that must read across users now needs a
separate, explicitly named path, which is more code.

**That awkwardness is the feature.** A privileged read should be hard to write by
accident and obvious in review. The alternative — unscoped repository methods
plus a remembered check — optimizes for convenience in exactly the place where
forgetting is catastrophic.

## Gotchas

**Symptom:** An unauthorized record appears in a log or an error payload
**Cause:** It was loaded and then rejected, so it existed in memory
**Fix:** Scope the query; the row never arrives

**Symptom:** An update silently does nothing
**Cause:** A scoped write matched zero rows and the count was never checked
**Fix:** Read the affected-row count and translate 0 into a 404

**Symptom:** A record was modified between the ownership check and the write
**Cause:** Check-then-act across two statements
**Fix:** One scoped statement, or both inside a transaction

**Symptom:** A nested route leaks despite scoping the child
**Cause:** The parent was unscoped, or the child-to-parent edge was never asserted
**Fix:** One query expressing both identifiers and the relationship

**Symptom:** A caller reads another tenant by sending `tenantId`
**Cause:** Scope taken from the payload rather than the credential
**Fix:** `req.user.tenantId`; if the request carries one, compare and deny on
mismatch

**Symptom:** A background job bypasses ownership entirely
**Cause:** The rule lives in the controller, or reads `req.user`
**Fix:** The rule lives in the service and takes the actor as an argument

**Symptom:** Nobody can enumerate the privileged reads in the codebase
**Cause:** An `ignoreOwnership` flag on the normal repository method
**Fix:** A separately named method — the audit becomes a grep

## Interview questions

**★ What is wrong with loading the row and then comparing owner ids?**
It works, and it is a check that must be repeated and can be forgotten —
especially on lists. Scoping the query means the unauthorized row never enters
the process at all, so it cannot be logged or leaked by a later refactor, and
"not found" and "not yours" collapse into a single path.

**★ How do you make a write safe?**
Put the scope in the statement — `UPDATE … WHERE id = $1 AND user_id = $2` — and
check the affected-row count, translating zero into a 404. A matched-nothing
update is not an error, so without the count a write that did nothing is
indistinguishable from one that worked.

**★ How do you authorize a nested route?**
With one query that carries the parent's scope, the child's id, and the
relationship between them. Checking the child alone leaks when its parent is not
visible; checking the parent alone lets a foreign child ride along.

**★ Where does the ownership rule belong, and why not the controller?**
The service — the only layer that both loads the resource and knows the rule.
In a controller the check protects one HTTP route rather than every caller, and
a controller that loads a record to inspect it has started doing business logic.

**How do you handle an admin who must legitimately read across users?**
A separate, explicitly named repository method that takes the actor. Making the
privileged path verbose is deliberate: hard to write by accident, obvious in
review, and greppable as a complete audit. An `ignoreOwnership` flag is the
opposite of all three.

**Is row-level security a replacement for scoping in the application?**
No — a backstop. It makes the predicate a property of the table, so a forgotten
`WHERE` returns nothing instead of everything, at the cost of carrying identity
into the session and of policies participating in planning. Defence in depth,
not a substitute.

---

← Prev: [The bug that survives review](01-the-bug-that-survives-review.md) · Index: [Resource ownership](README.md) · Next → [Status, and proving it](03-status-and-proving-it.md)
