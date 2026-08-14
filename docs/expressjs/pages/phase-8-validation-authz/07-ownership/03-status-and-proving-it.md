---
title: "Status, and proving it"
sidebar_label: "03 · Status, and proving it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**404 or 403 is decided by what the caller is allowed to *learn*, not by what
went wrong. And the only thing that keeps the decision true next month is a test
that asks for somebody else's record.**

> Verified: 2026-08-14 — **no sandbox run and no console block.**
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.5.4 defines **403**
> as the server understanding the request and refusing to authorize it, and
> states that an origin server wishing to hide the existence of a forbidden
> target **may respond with 404 instead**; §15.5.5 defines **404** as no current
> representation found *or* the server being unwilling to disclose that one
> exists — so the substitution is standard-compatible, not a trick. 401 and its
> required `WWW-Authenticate` are §15.5.2. Express itself supplies none of this
> ([express reference](https://expressjs.com/en/5x/api/express.html)); the status
> is whatever the error handler maps
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> **The decision table, the side-channel list, the tests and the checklist are
> this bible's.**

## The decision, in one rule

> **If the caller could not otherwise learn that the resource exists, answer
> 404.**

| Situation | Answer | Why |
|---|---|---|
| Another tenant's or user's private record | **404** | A 403 confirms the id exists — free enumeration |
| A record they can see but not modify (a shared doc, a read-only role) | **403** | Existence is not a secret; the refusal *is* the information |
| A record that genuinely does not exist | **404** | Indistinguishable from row one, by design |
| A record they may see, but their session expired | **401** | Not an ownership answer at all — the caller is unknown |

Two consequences follow, and both matter more than the choice itself:

**1 · Choose per resource type, and write it down.** An endpoint that returns 403
where its neighbours return 404 leaks by contrast — an attacker who sees both
learns which ids exist without ever getting a 200.

**2 · Scoping the query gives you the consistency for free.** When "not found"
and "not yours" are the same code path
([chunk 02](02-scope-the-query.md)), there is no branch in which the wrong status
can be chosen — the service simply has no row and throws `NotFoundError`.

⚠️ **404 hides the resource; it does not hide the route.** The route still exists,
still requires authentication, and still answers 401 without a credential. Do not
read 404-for-forbidden as security through obscurity: the control is the scoped
query, and the status merely declines to volunteer a fact.

## The channels that leak what the status hides

Answering 404 is worth nothing if something else in the response distinguishes
"yours, missing" from "someone else's, present". Worth checking, roughly in order
of how often they bite:

- **A distinct error code inside the envelope.** `ORDER_NOT_FOUND` on one path and
  `FORBIDDEN_RESOURCE` on the other rebuilds the oracle in the body while the
  status pretends otherwise. **One code, one message**
  ([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)).
- **Headers that only exist when the row does** — an `ETag`, a `Last-Modified`, a
  `Location`, a cache directive computed from the record.
- **Response time.** A path that loads, then rejects, is slower than one that
  finds nothing. Scoping the query narrows this to the difference between two
  queries that both return no rows — which is the strongest reason to prefer
  scoping over comparing, on top of the ones in chunk 02.
- **A different response body shape** — an empty object versus the standard error
  envelope — which is what happens when one path throws and another returns.
- **Side effects.** A rejected request that still bumped a rate-limit counter,
  wrote an audit row visible to the caller, or emitted a webhook, tells the caller
  the row existed.

🔴 **Do not attempt constant-time responses for this.** It is difficult, it is
rarely the real exposure, and the effort is better spent making the *code path*
identical — which scoping already does.

## The test that would have caught it

Everything in [chunk 01](01-the-bug-that-survives-review.md) comes down to one
missing fixture: **a second user who owns something.**

```js
describe('ownership', () => {
  let alice, bob, alicesOrder;

  beforeEach(async () => {
    alice = await createUser();
    bob = await createUser();                    // 🔴 the fixture nobody creates
    alicesOrder = await createOrder({owner: alice});
  });

  it("404s when Bob reads Alice's order", async () => {
    const res = await request(app)
      .get(`/api/orders/${alicesOrder.id}`)
      .set(authHeaderFor(bob));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');   // same code as a real miss
  });

  it("404s when Bob cancels Alice's order — and it is still open", async () => {
    const res = await request(app)
      .post(`/api/orders/${alicesOrder.id}/cancel`)
      .set(authHeaderFor(bob));

    expect(res.status).toBe(404);
    expect((await repo.findById(alicesOrder.id)).status).toBe('open');   // 🔴 the write assert
  });
});
```

Three things this suite gets right:

1. **Bob is a real, fully-formed user** — authenticated, with the same role as
   Alice. A test using an unauthenticated request proves the 401 path and nothing
   about ownership.
2. **The write test asserts the record did not change.** A handler can answer 404
   *after* performing the update; only reading the row back catches that.
3. **The error code is asserted**, not just the status — that is the oracle from
   the section above, pinned.

⚠️ **A mocked repository defeats this entirely.** If `findOwned` is a stub that
returns the fixture regardless of the actor, the test asserts your mock. Ownership
tests belong against the real query
([Phase 10 · 04](../../phase-10-app-factory/04-auth-in-tests.md)).

## Make it structural, not per-endpoint

Individual tests protect individual routes, and routes are added by people in a
hurry. Two cheap structural habits:

**A shared helper per resource.** One `expectNotOwned(request)` used by every
route's suite means adding a route to a resource makes the omission visible as a
missing line in a familiar block.

**A repository-level test that the unscoped method does not exist.** If the rule
is "no method returns a row without an actor", assert it once — over the exported
surface of the repository — rather than trusting review to catch the next
`findById`.

The role × route matrix from
[page 06 · chunk 03](../06-rbac-middleware/03-what-rbac-cannot-do.md) does **not**
cover any of this: every row there uses records the test user owns. The two suites
are complementary and neither substitutes for the other.

## The checklist for a new endpoint

Six questions, worth running whenever a route touches a record. They are ordered
so the cheapest disqualifier comes first:

1. **Which identifiers does the caller supply?** Path, body, query, every element
   of an array, and any indirect reference — file key, export id, delivery id.
2. **Is each one scoped in the query**, rather than compared after loading?
3. **For writes, is the scope in the statement**, and is the affected-row count
   checked?
4. **For nested routes, is the parent scoped and the relationship asserted?**
5. **Does the failure return the same status and code as a genuine miss**, and no
   header or timing that distinguishes them?
6. **Is there a test where a second real user asks for the first user's record** —
   for reads *and* writes?

## Audit the successful access, not only the denial

[Page 06 · chunk 03](../06-rbac-middleware/03-what-rbac-cannot-do.md) argued for
logging denials. Ownership adds the mirror case: **log the privileged reads that
succeeded.**

```js
logger.info({actorId: actor.id, resource: 'order', resourceId: id,
             via: 'findByIdAcrossTenants', requestId: req.id},
            'cross-tenant read');
```

A denial tells you someone tried. A successful cross-tenant read tells you an
administrator, a support tool or a compromised account **actually saw** a
customer's data — which is the record you need when someone asks what was
accessed, and the one that does not exist unless the privileged path was named
separately in the first place ([chunk 02](02-scope-the-query.md)).

Log identifiers and the actor, never the record's contents
([Phase 5 · 07](../../phase-5-errors/07-error-logging.md)).

## Gotchas

**Symptom:** An attacker maps valid ids by comparing 403 and 404 responses
**Cause:** 403 returned for another tenant's record
**Fix:** 404 whenever existence itself is not something the caller may learn

**Symptom:** One endpoint answers 403 where the rest of the API answers 404
**Cause:** The choice was made per endpoint rather than per resource type
**Fix:** Decide per resource, document it, and let the scoped query make it
automatic

**Symptom:** The status is 404 and the error code still says "forbidden"
**Cause:** The oracle moved from the status line into the envelope
**Fix:** One code and one message for both cases

**Symptom:** A 404 response carries an `ETag`
**Cause:** Headers computed before the authorization decision
**Fix:** Nothing derived from the record may survive into a denial

**Symptom:** A write returns 404 and the record changed anyway
**Cause:** The update ran before the ownership decision
**Fix:** Scope the write; assert in the test that the row is unchanged

**Symptom:** Ownership tests pass against a mocked repository
**Cause:** The stub ignores the actor argument
**Fix:** Test against the real query, with two real users

**Symptom:** Nobody can answer "what did this admin see?"
**Cause:** Only denials are logged
**Fix:** Log successful privileged reads with actor, resource and id — never
contents

## Interview questions

**★ Why 404 instead of 403 for another user's private record?**
Because 403 confirms the id exists, which is free enumeration. RFC 9110
explicitly allows a server that wishes to hide a forbidden resource's existence
to answer 404 instead, and defines 404 as covering "unwilling to disclose that
one exists" — so it is a standard-compatible choice, not a trick.

**★ When is 403 the right answer?**
When existence is not a secret and the refusal is the information — a shared
document a read-only collaborator may see but not edit, or an action their role
cannot perform on a record they legitimately know about.

**★ What can leak the fact that a 404 was really a 403?**
A distinct error code in the body, headers computed from the record such as
`ETag` or `Location`, response-time differences between load-then-reject and
find-nothing, a different body shape, and side effects like an audit row or a
webhook. Making the code path identical — by scoping the query — closes most of
them at once.

**★ What single test would have caught the IDOR?**
One where a second fully authenticated user requests the first user's record and
expects 404 — for writes as well as reads, asserting that the record did not
change. The fixture nobody creates is the second user.

**Why is the role × route matrix not enough?**
Because every row in it uses records the test user owns. It proves which roles
reach which routes; it says nothing about which rows they reach.

**What should be logged, and when?**
Denials, with actor, permission and route; and successful privileged reads, with
actor, resource type and id. The second is the record that answers "what was
accessed" after an incident, and it only exists if the privileged path was named
separately from the normal one.

---

← Prev: [Scope the query](02-scope-the-query.md) · Index: [Resource ownership](README.md) · Next → [Multi-tenant and logout](../08-tenant-and-logout.md)
