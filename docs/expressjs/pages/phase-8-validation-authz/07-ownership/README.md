---
title: "Resource ownership"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**"Is this row mine?" — the question no middleware can answer, the bug that
survives review and tests, and the query discipline that removes the whole
class.**

> 🔴 **The one page to read in this phase.** RBAC present and ownership absent is
> IDOR: a valid token, a correct permission, and any authenticated user reads any
> record by changing an id.

> Verified: 2026-08-14 — **no sandbox run and no console block in any chunk.**
> **Nothing here is an Express feature** — Express has no authorization layer
> ([express reference](https://expressjs.com/en/5x/api/express.html)). The one
> framework fact that shapes the topic is structural: middleware runs **before**
> the handler ([using middleware](https://expressjs.com/en/guide/using-middleware.html)),
> so it cannot see a record that has not been fetched. Status semantics are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.5.4 — which
> explicitly permits **404** in place of 403 to hide a forbidden resource's
> existence — and §15.5.5. The failure is catalogued as **Broken Object Level
> Authorization**, first in the
> [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).
> The database backstop is
> [PostgreSQL RLS](../../../../postgresql/pages/phase-13-ops/14-rls/README.md).
> **The design guidance is this bible's.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The bug that survives review](01-the-bug-that-survives-review.md)** | Why every line is individually correct, why the tests pass, and the six places the caller's identifier arrives besides `:id` |
| 02 | **[Scope the query](02-scope-the-query.md)** | `findOwned` over compare-after-load, scoped writes and the affected-row count, nested routes, scope from the credential, and the privileged path made loud |
| 03 | **[Status, and proving it](03-status-and-proving-it.md)** | 404 or 403 by what the caller may learn, the channels that leak what the status hides, the second-user test, and the six-question checklist |

**Split on concept boundaries at the 300-line mark.** 01 is the failure, 02 is the
fix, 03 is the answer you return and the proof it still holds.

## Phase gate

You can explain why this check cannot be middleware, name at least four places an
identifier reaches you besides the path, say why scoping the query beats
comparing after the load in four respects, give the 404-versus-403 rule in one
sentence, and describe the test whose absence lets IDOR ship.

## Where this connects

- **← [04 · Authn middleware](../04-authn-middleware/README.md)** — the first
  question, and why the actor is an argument rather than `req.user`.
- **← [06 · RBAC middleware](../06-rbac-middleware/README.md)** — the second
  question, and chunk 03 there for why the third cannot live in middleware.
- **← [01 · Validate at the boundary](../01-validate-at-boundary/README.md)** —
  why a validated identifier is still an unauthorized one.
- **→ [08 · Tenant and logout](../08-tenant-and-logout.md)** — tenant hopping, and
  the uniform scoping case.
- **→ [Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md)**
  — the repository whose signatures carry the actor.
- **→ [Phase 7 · 07](../../phase-7-layering/07-transaction-middleware.md)** — when
  a read-then-write genuinely cannot be one statement.
- **→ [Phase 6 · 06](../../phase-6-rest-surface/06-idempotency-keys.md)** — the
  affected-row count that also makes a write safe to retry.
- **→ [Phase 10 · 04 · Auth in tests](../../phase-10-app-factory/04-auth-in-tests.md)**
  — the second user, against the real query.
- **→ [PostgreSQL · RLS](../../../../postgresql/pages/phase-13-ops/14-rls/README.md)**
  — the same predicate, enforced by the table.

---

← Prev topic: [06 · RBAC middleware](../06-rbac-middleware/README.md) · Start → [The bug that survives review](01-the-bug-that-survives-review.md)
