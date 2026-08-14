---
title: "Authentication middleware"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Authentication answers *who is this?* — sets `req.user` or 401s, and does
nothing else. How it answers decides what you can revoke; where it is mounted
decides what happens when someone forgets it.**

> Verified: 2026-08-14 — **no sandbox run and no console block in any chunk.**
> **Express ships no authentication and no sessions**: its six built-ins are
> `json`, `urlencoded`, `raw`, `text`, `static` and `Router`
> ([express reference](https://expressjs.com/en/5x/api/express.html)), with
> `express-session`, `cookie-parser` and `cors` listed as separate packages
> ([Express middleware](https://expressjs.com/en/resources/middleware.html)). So
> `req.user` is a convention resting on middleware's documented ability to modify
> the request ([using middleware](https://expressjs.com/en/guide/using-middleware.html)),
> with **no reserved-name list** to protect it. Standards behind the chunks:
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.5.2 (401 and
> `WWW-Authenticate`), [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html)
> (Bearer), [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html) §4.1 (claims),
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §5 (431), and
> [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests)
> for cookie attributes and credential-free preflight. Signing, hashing and
> storage are [Node Phase 8](../../../../nodejs/pages/phase-8-security/README.md).
> **The design guidance is this bible's.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[One question only](01-one-question-only.md)** | The middleware shape, three questions in three layers, fail-closed rules, the optional-auth trap, and why `req.user` should not reach a service |
| 02 | **[Tokens, sessions and cost](02-tokens-sessions-and-cost.md)** | Where the truth lives, what a signature check does *not* prove, the three honest answers to revocation, refresh rotation, and the size a token costs on every request |
| 03 | **[Mounting and testing](03-mounting-and-testing.md)** | Opt-in vs opt-out and the asymmetry of forgetting, CORS before authn, and the deny-path tests nobody writes |

**Split on concept boundaries at the 300-line mark.** 01 is what it does, 02 is
how it knows, 03 is where it goes and how you prove it.

## Phase gate

You can say what belongs on `req.user` and what does not, explain why an invalid
token must never fall through to the handler, give the real difference between a
stateless token and a session in one sentence about *where the truth lives*, name
the three ways to revoke and what each costs, and say why CORS must be mounted
before authentication.

## Where this connects

- **← [Phase 2 · 01 · chunk 03](../../phase-2-middleware/01-middleware-contract/03-what-middleware-must-not-do.md)**
  — why ownership cannot be checked in middleware at all.
- **← [Phase 2 · 04](../../phase-2-middleware/04-middleware-factories.md)** — the
  factory shape every guard on this page uses.
- **← [Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md)**
  — 401 means retry, 403 means do not.
- **← [Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)** — the
  envelope an auth failure shares with every other failure.
- **→ [05 · Cookies and sessions wire-up](../05-cookies-sessions-wireup.md)** —
  the packages and flags behind chunk 02's choice.
- **→ [06 · RBAC middleware](../06-rbac-middleware/README.md)** — the second question,
  and the 403 that goes with it.
- **→ [07 · Ownership](../07-ownership.md)** — the third question, in the
  service, answered with 404.
- **→ [08 · Tenant and logout](../08-tenant-and-logout.md)** — what revocation
  has to mean in practice.
- **→ [Phase 9 · 02 · CORS](../../phase-9-hardening/02-cors.md)** — the preflight
  that must not be authenticated.
- **→ [Phase 10 · 04 · Auth in tests](../../phase-10-app-factory/04-auth-in-tests.md)**
  — issuing real tokens for the deny-path suite.

---

← Prev topic: [03 · Coercion traps](../03-coercion-traps.md) · Start → [One question only](01-one-question-only.md)
