---
title: "Resource ownership"
sidebar_label: "07 · Ownership"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

**"Is this row mine?" — load the resource, compare owner id to `req.user.id`, else 404 or 403 by policy.**

> Verified: 2026-08-14 — **no sandbox run**, and **nothing here is an Express feature**.
> Express has no authorization layer at all. The one framework-level fact that shapes the
> page is structural: middleware runs **before** the handler, so it cannot see a record
> that has not been fetched — which is why this check cannot live where RBAC lives
> ([page 06](06-rbac-middleware.md)).
> Status semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): 403 means
> the server understood and refuses to authorise; 404 means no current representation was
> found. **Choosing 404 to avoid confirming existence is a deliberate, standard-compatible
> use of it** — the spec explicitly permits a server to withhold the reason for refusal.
> This failure has a name outside this bible: **IDOR / broken object-level authorization**,
> the top item in the OWASP API Security Top 10.

Prefer **404** when existence should stay secret; **403** when the resource is visible but forbidden. Document the choice.

## Why this is the bug that keeps happening

Every ingredient of a correct-looking endpoint can be present while this is missing:

```js
router.get('/orders/:id',
  requireAuth(deps),                  // ✅ authenticated
  requirePermission('orders:read'),   // ✅ authorised to read orders
  async (req, res) => {
    const order = await orderRepo.findById(req.params.id);   // ⛔ ANY order
    res.json(toOrderDto(order));
  },
);
```

A valid token. A correct permission. And any authenticated user reads any order by
changing a number in the URL.

It survives review because **each line is individually right**, and it survives
testing because tests fetch the user's *own* records — the happy path never
exercises someone else's id. It is found by an attacker, a curious user, or a
penetration test.

## Filter in the query, do not check after the load

The instinctive fix is a comparison after fetching:

```js
// ⚠️ works, but it is a check you can forget on the next endpoint
const order = await orderRepo.findById(id);
if (order.userId !== actorId) throw new NotFoundError('ORDER_NOT_FOUND');
```

The stronger fix makes the scope part of the query, so there is no window in which
an unauthorised row exists in memory:

```js
// ✅ the row cannot be loaded at all unless it is theirs
const order = await orderRepo.findOwned(id, actorId);
if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
```

Three reasons this is better than the comparison:

1. **The unauthorised row never enters the process**, so it cannot be logged,
   cached, or accidentally returned by a later refactor.
2. **"Not found" and "not yours" become the same code path**, so the 404-versus-403
   decision is made once instead of at every call site.
3. **It composes with pagination and lists.** A `WHERE user_id = $actor` on the
   collection query is the same defence, and list endpoints are where per-row
   comparisons are most often forgotten.

Repository methods that take an actor or tenant id are a small, boring discipline
that removes an entire vulnerability class.

## The service owns this check

It cannot be middleware. It should not be the controller either — a controller
that loads a record to check ownership has started doing business logic
([Phase 7](../phase-7-layering/03-fat-controllers.md)).

**The service is the only layer that both loads the resource and knows the rule.**
That placement also means the check applies to every caller — a job, a CLI, a
second transport — not just to the HTTP route someone remembered to guard.

## 404 or 403 — decide by what the caller may know

| Situation | Answer | Why |
|---|---|---|
| Another tenant's or user's private record | **404** | A 403 confirms the id exists — free enumeration |
| A record they can see but not modify (a shared doc, read-only role) | **403** | Existence is not a secret; the refusal is the information |
| A record that genuinely does not exist | **404** | Indistinguishable from the first row, by design |

The rule: **if the caller could not otherwise learn the resource exists, 404.**
Whichever you choose, choose it per resource type and write it down, because an
endpoint that returns 403 where its neighbours return 404 leaks by contrast.

## Trade-off

Scoping every query by actor or tenant costs a parameter on every repository
method and a little duplication in queries. It also makes some legitimate
operations awkward — an admin tool that genuinely must read across users now needs
a separate, explicitly-named path (`findByIdAsAdmin`), which is more code.

That awkwardness is the feature. **A privileged read should be hard to write by
accident and obvious in review.** The alternative — unscoped repository methods
plus a remembered check — optimises for convenience in exactly the place where
forgetting is catastrophic.

## Gotchas

**Symptom:** Changing an id in the URL returns another user's data  
**Cause:** No ownership check — IDOR  
**Fix:** Scope the query by actor id; treat "not owned" as "not found"

**Symptom:** The detail endpoint is safe but the list endpoint leaks  
**Cause:** Per-row checks were added to `findById` and forgotten on the collection query  
**Fix:** Scope at the repository so every query carries it, lists included

**Symptom:** An attacker maps valid ids by comparing 403 and 404 responses  
**Cause:** 403 for another tenant's record  
**Fix:** 404 whenever existence itself is not something the caller may learn

**Symptom:** The check exists in the route but not when called from a job  
**Cause:** It lives in the controller instead of the service  
**Fix:** The service owns the rule, so every caller inherits it

**Symptom:** A `tenantId` from the request body scopes the query  
**Cause:** Trusting client-supplied scope — tenant hopping
([page 08](08-tenant-and-logout.md))  
**Fix:** Scope from `req.user`, never from the payload

**Symptom:** An admin feature required weakening the ownership rule everywhere  
**Cause:** One repository method serving both normal and privileged reads  
**Fix:** A separate, explicitly named privileged method. Make the powerful path visible

## Interview questions

**★ Why 404 instead of 403 for another user's private doc?**  
Avoids leaking that the id exists.

**★ Why can an ownership check not be middleware?**  
Middleware runs before the resource is loaded, so there is nothing to compare against.
The check needs the record, which means it belongs where the record is fetched — the
service.

**★ What is wrong with loading the row and then comparing owner ids?**  
It works, but it is a check that must be repeated and can be forgotten — especially on
list endpoints. Scoping the query (`findOwned(id, actorId)`) means the unauthorised row
never enters the process at all, and "not found" and "not yours" collapse into one path.

**Why does this bug survive code review and tests so reliably?**  
Because every line is individually correct — valid token, correct permission, ordinary
fetch — and tests only ever request the user's own records. Nothing in the happy path
exercises another user's id.

**Where does the check belong if not the controller?**  
The service. A controller that loads a record to inspect it is doing business logic,
and the check then applies only to that HTTP route rather than to every caller.

**How do you handle a legitimate admin who must read across users?**  
A separate, explicitly named repository path. Making the privileged read verbose is
deliberate — it should be hard to write by accident and obvious in review.

---

← Prev: [RBAC middleware](06-rbac-middleware.md) · Next → [Multi-tenant and logout](08-tenant-and-logout.md)
