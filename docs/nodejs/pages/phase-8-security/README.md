---
title: "Phase 8 — Security"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example was executed on **Node 24.19.0**, using the built-in `node:crypto`
> unless a page names a package.

**All 27 pages written.** The largest phase in the syllabus, and the one
the syllabus itself introduces with *"Not optional, and not a phase you do 'later'.
Every item here has cost someone their weekend."*

Node-side concerns. Express owns route-level authorization wiring; the database
sections own their own hardening. Injection's data-access half is already written as
[Phase 6, page 02](../phase-6-data-access/02-parameterized-queries.md) — this phase
generalises it.

## Authentication and authorization

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Password storage](./01-password-storage.md)** | <span className="db-tier t-master">Master</span> | ~422,000 MD5 guesses/sec against about 11 scrypt hashes — and the 23 logins/sec your thread pool actually allows |
| 02 | **[Sessions vs JWT](./02-sessions-vs-jwt.md)** | <span className="db-tier t-master">Master</span> | The whole trade is revocation against a lookup. Short expiry plus refresh is sessions with extra steps |
| 03 | **[Where to store tokens](./03-token-storage.md)** | <span className="db-tier t-master">Master</span> | `localStorage` is readable by any script on the page; `SameSite` already closed most of the CSRF objection |
| 04 | **[Authz vs authn](./04-authentication-vs-authorization.md)** | <span className="db-tier t-master">Master</span> | Authentication is a chokepoint; authorization is a decision at every object — which is why it gets forgotten |
| 05 | **[Session management](./05-session-management.md)** | <span className="db-tier t-understand">Understand</span> | Rotate on every privilege change; two expiry clocks, not one |
| 06 | **[OAuth 2.0 and OIDC](./06-oauth-oidc.md)** | <span className="db-tier t-know">Know</span> | An access token is not proof of identity. Authorization Code + PKCE, and nothing else |
| 07 | **[MFA and TOTP](./07-mfa-totp.md)** | <span className="db-tier t-when">When Needed</span> | Thirty lines of `node:crypto`, reproducing all RFC 6238 vectors — and the replay check most implementations omit |

## The vulnerability set you must recognize on sight

| # | Page | Tier | In one line |
|---|---|---|---|
| 08 | **[Injection](./08-injection.md)** | <span className="db-tier t-master">Master</span> | `id` really executed through `exec`; six shell constructs, including a bare newline |
| 09 | **[XSS and encoding](./09-xss.md)** | <span className="db-tier t-master">Master</span> | `JSON.stringify` does not escape `</script>`, and Node sends no `Content-Type` at all |
| 10 | **[Path traversal](./10-path-traversal.md)** | <span className="db-tier t-master">Master</span> | `path.join` returned `/etc/passwd`; a prefix check without the separator lets `uploads-evil` through |
| 11 | **[CSRF](./11-csrf.md)** | <span className="db-tier t-understand">Understand</span> | CORS never stopped it; `SameSite=Lax` mostly did. Unsigned double-submit trusts every subdomain you have |
| 12 | **[SSRF](./12-ssrf.md)** | <span className="db-tier t-understand">Understand</span> | A custom DNS guard is **never called** for a literal IP — verified, the request went straight through |
| 13 | **[Prototype pollution](./13-prototype-pollution.md)** | <span className="db-tier t-understand">Understand</span> | `JSON.parse` is innocent; the recursive merge is the bug. `structuredClone` does not sanitise |
| 14 | **[ReDoS](./14-redos.md)** | <span className="db-tier t-understand">Understand</span> | 28 characters bought 3.6 s of CPU, during which a 10 ms interval fired **zero** times |
| 15 | **[Deserialization, open redirects, mass assignment](./15-deserialization-redirects-mass-assignment.md)** | <span className="db-tier t-know">Know</span> | `//evil.example` and `/\evil.example` both pass `startsWith('/')`; a denylist ships the next column writable |
| 16 | **[Timing attacks](./16-timing-attacks.md)** | <span className="db-tier t-know">Know</span> | The naive compare drew a clean staircase, 5.4 → 141.2 ms. The leak that gets exploited is 83 ms of user enumeration |

## Practices and tooling

| # | Page | Tier | In one line |
|---|---|---|---|
| 17 | **[Input validation](./17-input-validation.md)** | <span className="db-tier t-master">Master</span> | The size cap, not the schema, is what saves you 40.7 ms of blocked loop — and a failing parse costs 45× a passing one |
| 18 | **[Secrets handling](./18-secrets.md)** | <span className="db-tier t-master">Master</span> | `--env-file` values never reach `/proc/<pid>/environ`; `git rm` plus `.gitignore` left the key in two commits |
| 19 | **[HTTPS, HSTS, cookies](./19-https-hsts-cookies.md)** | <span className="db-tier t-master">Master</span> | Node validated no cookie attribute — `SameSite=None` without `Secure` and a 5004-byte cookie both went out with a 200 |
| 20 | **[`node:crypto`](./20-node-crypto.md)** | <span className="db-tier t-understand">Understand</span> | MD5 is *slower* than SHA-256 on this CPU, and a `Buffer` key costs 4× a `KeyObject` for the same HMAC |
| 21 | **[Rate limiting](./21-rate-limiting.md)** | <span className="db-tier t-understand">Understand</span> | A fixed window let 10 requests through in 80 ms against a 5/s limit; four workers made the limit 40 |
| 22 | **[Security headers and CSP](./22-security-headers.md)** | <span className="db-tier t-understand">Understand</span> | 0.80 µs and 356 bytes for the whole set — and a CSP with `unsafe-inline` is not a CSP |
| 23 | **[Supply chain](./23-supply-chain.md)** | <span className="db-tier t-understand">Understand</span> | npm 12 blocks install scripts by default; an approved one read 103 env vars. A release cooldown is one config line |
| 24 | **[The Permission Model](./24-permission-model.md)** | <span className="db-tier t-know">Know</span> | Locked down to one readable directory, the process still opened a TCP connection — there is no `--allow-net` |
| 25 | **[Web Crypto API](./25-web-crypto.md)** | <span className="db-tier t-know">Know</span> | `extractable: false` is the one thing `node:crypto` cannot express; constant-time verify is built in |
| 26 | **[Encryption and keys](./26-encryption-and-keys.md)** | <span className="db-tier t-know">Know</span> | Two messages, one IV: XOR returned the second plaintext with no key involved |
| 27 | **[Audit logging](./27-audit-logging.md)** | <span className="db-tier t-when">When Needed</span> | A hash chain catches edits and deletions and reports **truncation as intact** — anchor the head externally |
| 28 | **[bcrypt](./28-bcrypt/README.md)** | <span className="db-tier t-understand">Understand</span> | The hash you inherit: the limit is **72 bytes not characters**, the sync API blocks the whole event loop, and it is a native addon that fails at startup on Alpine |

## Where this connects

- **[Phase 4 — filesystem](../phase-4-filesystem/README.md)** first covered path traversal;
  this phase revisits it as an attack rather than an API detail.
- **[Phase 6 — data access](../phase-6-data-access/README.md)** owns parameterized queries and
  NoSQL operator injection.
- **[Phase 7 — background work](../phase-7-background-work/README.md)** promised this phase the
  webhook-signing and SSRF halves of
  [its outbound side-effects page](../phase-7-background-work/09-outbound-side-effects.md);
  the SSRF half is now [page 12](./12-ssrf.md).
- **Phase 10 — observability** owns what must never be logged, which is the other half
  of secrets hygiene.
- **Phase 11 — deployment** owns TLS termination behind a proxy and the trusted-IP
  configuration that rate limiting depends on.

---

← Phase 7: [Background work and resilience](../phase-7-background-work/README.md) · Start → [Password storage](./01-password-storage.md)
