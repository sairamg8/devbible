---
title: "Access, refresh and ID are three protocol roles, not three flavours of one thing — and almost every token bug in production is a token being used in the role that belongs to one of the other two"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against RFC 6749 §1.4 (Access Token), §1.5 (Refresh Token), §4.1.4,
> §5.1 (Successful Response), §5.2 (Error Response), §6 (Refreshing an Access Token), §10.4
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 6750 §1.2,
> §2.1 (Authorization Request Header Field), §2.2 (Form-Encoded Body Parameter), §2.3 (URI
> Query Parameter), §3 (The WWW-Authenticate Response Header Field), §5.3 (Threat
> Mitigation) ([rfc-editor.org/rfc/rfc6750](https://www.rfc-editor.org/rfc/rfc6750.txt));
> RFC 9700 §2.2.1 (sender-constrained tokens), §4.13
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 9449 (DPoP) ([datatracker.ietf.org/doc/html/rfc9449](https://datatracker.ietf.org/doc/html/rfc9449));
> RFC 8705 (mTLS) ([datatracker.ietf.org/doc/html/rfc8705](https://datatracker.ietf.org/doc/html/rfc8705));
> RFC 9068 (JWT access-token profile) ([rfc-editor.org/rfc/rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt));
> OpenID Connect Core 1.0 §2, §3.1.3.3 ([openid.net](https://openid.net/specs/openid-connect-core-1_0.html)).
> Target: **JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x**.
> **No sandbox** — Java source, config and specification-quoted field definitions only;
> token *structure* where shown is labelled illustrative, never a real token.

**The three tokens differ in who they are for, how long they live, and where they are legally
allowed to appear — and those three answers are different for each one. The access token is
for the resource server, is short-lived, and travels on every API call. The refresh token is
for the authorization server alone, is long-lived, and must never reach a resource server.
The ID token is for the client, is proof that an authentication event happened, and is not a
credential for anything. Nearly every token defect worth the name is one of these three being
used in another's role: a client parsing an access token, an API accepting an ID token, a
resource server handed a refresh token by a well-meaning SDK.**

The second argument this topic makes is the one that gets skipped. An access token is
**opaque to the client by contract**. That it is often a JWT is a private implementation
choice of the authorization server, and RFC 6749 gives the client no licence to depend on it.
A client that decodes an access token to read `sub` or `exp` has coupled itself to a format
the AS may change on a Tuesday, and every concrete thing it wanted from inside the token has
a supported source outside it. Topic 06 owns the JWT wire format; this topic stops at the
boundary and defends it.

**16 chunks, ~3,982 lines.** Read 01 first; the rest can be read by concern.

## Chunks

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[Three tokens, three roles](01-three-tokens-three-roles.md)** | <span className="db-tier t-master">Master</span> | Three audiences, three lifetimes, three places each may legally appear |
| 2 | **[Opaque by contract](02-the-access-token-is-opaque-by-contract.md)** | <span className="db-tier t-master">Master</span> | 🔴 JWT-ness is a private choice of the AS that a client is forbidden to depend on |
| 3 | **[What parsing costs you](02b-what-parsing-an-access-token-costs-you.md)** | <span className="db-tier t-master">Master</span> | The four things teams reach into the token for, and the supported source for each |
| 4 | **[The token response](03-the-token-response.md)** | <span className="db-tier t-master">Master</span> | Five fields, two conditional, two mandatory cache headers — and one parameter whose absence means the opposite of what clients assume |
| 5 | **[The token error response](03b-the-token-error-response.md)** | <span className="db-tier t-master">Master</span> | Six error codes, each naming a different party at fault — fix a registration or page the identity team |
| 6 | **[Bearer tokens](04-bearer-tokens-and-the-authorization-header.md)** | <span className="db-tier t-master">Master</span> | Defined by what it does *not* require; the whole spec around it is rules for not losing it |
| 7 | **[Safeguarding a bearer token](04b-safeguarding-a-bearer-token.md)** | <span className="db-tier t-master">Master</span> | RFC 6750 §5.3's six-line recommendation list, the most under-read checklist in OAuth2 |
| 8 | **[The form and query transports](04c-the-form-and-query-transports.md)** | <span className="db-tier t-master">Master</span> | 🔴 The query transport documents deployments that already existed — treating it as an equal third option puts credentials in your access logs |
| 9 | **[`WWW-Authenticate` challenges](05-www-authenticate-challenges.md)** | <span className="db-tier t-master">Master</span> | Three things a resource server can say about a token; 401 and 403 are different instructions, not shades of failure |
| 10 | **[Implementing the challenge](05b-implementing-and-consuming-the-challenge.md)** | <span className="db-tier t-master">Master</span> | Spring builds the challenge from the error object, so the status travels with the error — and the client side needs a retry guard |
| 11 | **[What a bearer token cannot do](06-what-a-bearer-token-cannot-do.md)** | <span className="db-tier t-master">Master</span> | It cannot say who is presenting it; mTLS and DPoP are the only structural answer to theft |
| 12 | **[DPoP and choosing a constraint](06b-dpop-and-choosing-a-constraint.md)** | <span className="db-tier t-master">Master</span> | Proof-of-possession moved to the application layer so a browser can do it — priced in a signed JWT per request |
| 13 | **[Access-token lifetime](07-access-token-lifetime-as-a-design-decision.md)** | <span className="db-tier t-master">Master</span> | Lifetime *is* the time a stolen credential keeps working; write that down and the number becomes arithmetic |
| 14 | **[The long-lived token failure](07b-the-long-lived-access-token-failure.md)** | <span className="db-tier t-master">Master</span> | 🔴 The commonest real failure is a one-year access token issued because refresh was inconvenient — and nothing about it looks like a bug |
| 15 | **[What refresh tokens are for](08-refresh-tokens-what-they-are-for.md)** | <span className="db-tier t-master">Master</span> | One long-lived credential you can supervise, traded for many short-lived ones you cannot |
| 16 | **[Never at a resource server](08b-why-a-resource-server-must-never-see-one.md)** | <span className="db-tier t-master">Master</span> | The violation always arrives disguised as a convenience feature |

## The five things this topic is really about

**1 · Role, not format.** Ask of any token: *who is the audience, how long does it live, and
where may it appear?* Access → the resource server, minutes, the `Authorization` header.
Refresh → the authorization server only, days-to-months, the token endpoint body. ID → the
client, single-use-ish and short, never an API. Those nine answers settle most design
arguments before they start.

**2 · Opacity is a contract, and it is the one clients break first.** RFC 6749 §1.4 describes
the access token as a string *"usually opaque to the client"*, and the client-side rule that
follows is absolute: do not parse it. The seductive cases are all real — reading `exp` to
pre-emptively refresh, reading `sub` to key a cache, reading `scope` to grey out a button.
Chunk 03 replaces each with the supported source: `expires_in` from the token response, the
ID token or UserInfo for identity, the response's own `scope` parameter for scope.

**3 · Bearer means "whoever holds it".** RFC 6750's entire security posture follows from
there being no proof of possession: TLS everywhere, never in a URL, short lifetimes, no
storage in a place a script can read. The structural fix is sender-constraining — mTLS
(RFC 8705) or DPoP (RFC 9449) — and RFC 9700 §2.2.1 says servers **SHOULD** use one. Chunks
11 and 12 are that argument, including what DPoP actually costs a browser client.

**4 · The refresh token is the credential you can supervise.** It is long-lived on purpose,
which is only safe because exactly one party ever sees it and that party can rotate, detect
reuse and revoke. The moment a resource server sees one — usually because an SDK "helpfully"
refreshes for you, or because a gateway forwards the whole token set — you have handed a
long-lived credential to a component with no way to revoke it. Chunk 16 is the whole failure
mode.

**5 · Lifetime is a number you can defend or a number you inherited.** Chunk 13 turns it into
arithmetic: how long is a stolen token useful, how long can revocation take to bite, how much
traffic does refresh add. Chunk 14 is what happens when nobody does that arithmetic — the
one-year access token that passes review because it has no symptom until the breach.

## Still owed in this topic

Named in the prose of chunks 01, 03, 06, 07, 07b and 08 and not written yet:

- **10 · Refresh-token rotation** *(not written yet)* — RFC 9700's rotation guidance, what
  changes on every refresh, and why a rotating refresh token is a different operational
  object from a static one.
- **11 · The rotation race** *(not written yet)* — concurrent requests refreshing at once,
  the single-flight guard, and why "reuse detected" fires on your own clients.
- **12 · Reuse detection and revocation (RFC 7009)** *(not written yet)* — what an AS does
  when an old refresh token comes back, and what your client should do about it.
- **13 · Revocation reach** *(not written yet)* — why revoking at the AS does not stop a
  self-contained access token, and the cache/introspection trade.
- **14 · Introspection (RFC 7662)** *(not written yet)* — asking the AS instead of trusting
  the token, and what it costs per request.
- **15 · Opaque vs JWT as an AS choice** *(not written yet)* — the decision from the
  authorization server's side, which is where it actually belongs.
- **17 · The ID token as a token role** *(not written yet)* — the third token's role here;
  its claims and validation belong to topic 07.

## Phase gate

You are done with this topic when you can say, for each of the three tokens, who its audience
is, how long it should live and where it may appear — and when you can explain, without
looking it up, why a client reading `exp` out of an access token is a design defect rather
than a shortcut.

## Where this connects

- [03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md) — the exchange
  that produces all three.
- [04 · Client credentials](../04-client-credentials/README.md) — the grant with no user, and
  therefore no refresh token and no ID token.
- **06 · JWT anatomy and validation** — the wire format the access token often, but not
  necessarily, arrives in.
- **07 · OpenID Connect** — the ID token's claims and validation algorithm.
- **08 · Spring Security as resource server** — where `Bearer` resolution and the
  `WWW-Authenticate` challenge are implemented for you.

---

Start → [Three tokens, three roles](01-three-tokens-three-roles.md)
