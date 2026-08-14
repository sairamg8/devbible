---
title: "RBAC middleware"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Role checks after authentication, before the handler. Fail closed with 403 —
not 401. Protect capabilities rather than role names, and know the one question
this layer can never answer.**

> Verified: 2026-08-14 — **no sandbox run and no console block in any chunk.**
> **Express has no authorization primitives** — no roles, no permissions, no
> guards; its six built-ins are `json`, `urlencoded`, `raw`, `text`, `static` and
> `Router` ([express reference](https://expressjs.com/en/5x/api/express.html)).
> The guards are the documented *"configurable middleware"* shape
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)) over
> `req.user`, a convention from [page 04](../04-authn-middleware/README.md).
> Status semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> §15.5.2 (401 + `WWW-Authenticate`) and §15.5.4 (403, and the permission to
> answer 404 instead when existence itself is the secret); OAuth scope is
> [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) §3.3 with
> `insufficient_scope` → 403 in
> [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html) §3.1. `router.param`
> running **before** the handler is the
> [router reference](https://expressjs.com/en/5x/api/router.html#router.param).
> **The design guidance is this bible's.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The second question](01-the-second-question.md)** | The guard shape, why 401 and 403 are instructions rather than shades of "no", failing closed in four places, and why authz is per-route where authn is per-router |
| 02 | **[Permissions, not role names](02-permissions-not-roles.md)** | `orders:delete` over `admin`, naming that survives, where the map lives, token vs lookup, the hierarchy trap, and how to migrate when it is already too late |
| 03 | **[What RBAC cannot do](03-what-rbac-cannot-do.md)** | The IDOR gap and why every test passes, why `router.param` is not the fix, when RBAC stops fitting at all, the matrix test, and logging denials |

**Split on concept boundaries at the 300-line mark.** 01 is the mechanism, 02 is
the model, 03 is the limit.

## Phase gate

You can say why a failed role check is 403 and what breaks when it is 401, give
four concrete meanings of "fail closed", explain why routes should name
capabilities rather than roles and what that costs to retrofit, and state exactly
why middleware can never check ownership.

## Where this connects

- **← [04 · Authn middleware](../04-authn-middleware/README.md)** — the first
  question, and the `req.user` every guard here reads.
- **← [Phase 2 · 04](../../phase-2-middleware/04-middleware-factories.md)** — the
  factory shape.
- **← [Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md)**
  — status as a contract with the client.
- **← [Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)** — the
  envelope a 403 shares with every other failure.
- **→ [07 · Ownership](../07-ownership.md)** — the third question, in the service,
  answered with 404.
- **→ [08 · Tenant and logout](../08-tenant-and-logout.md)** — the uniform scoping
  case where a router-level check does earn its place.
- **→ [Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md)**
  — where the data-dependent rules live.
- **→ [Phase 10 · 04 · Auth in tests](../../phase-10-app-factory/04-auth-in-tests.md)**
  — issuing per-role tokens for the matrix.

---

← Prev topic: [05 · Cookies and sessions wire-up](../05-cookies-sessions-wireup.md) · Start → [The second question](01-the-second-question.md)
