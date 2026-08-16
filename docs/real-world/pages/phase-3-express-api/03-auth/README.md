---
title: "Auth"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Node v24 crypto docs, OWASP session and
> password-storage cheat sheets, and MDN Set-Cookie. Concept home:
> [Node — password storage](../../../../nodejs/pages/phase-8-security/01-password-storage.md),
> [sessions vs JWT](../../../../nodejs/pages/phase-8-security/02-sessions-vs-jwt.md),
> [token storage](../../../../nodejs/pages/phase-8-security/03-token-storage.md),
> [Express — authn middleware](../../../../expressjs/pages/phase-8-validation-authz/04-authn-middleware/README.md).

Signup, login, logout, and the middleware that turns a cookie into
`req.user` — built on database sessions, with the JWT variant implemented
and honestly compared rather than argued about in the abstract.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Sessions](01-sessions.md)** | The default: scrypt-hashed passwords, opaque tokens hashed at rest, `__Host-` cookies, the session middleware, logout and rotation |
| 2 | **[The JWT variant, and choosing](02-jwt-variant-and-choosing.md)** | The same endpoints on access + refresh tokens; what it buys, what it costs, and when this app would switch |

## Where this connects

The [schema's](../../phase-1-database/01-the-schema/01-conventions-identity-catalog.md)
`users` and `sessions` tables are the storage; chapter 04 builds
authorization on the `req.user` this chapter produces; the React client's
half is Phase 4's auth chapter.
