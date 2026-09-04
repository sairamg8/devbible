---
title: "An API key and a client-credentials token are the same idea separated by one property — where the credential that travels is not the credential that is stored — and the honest comparison is short enough that you should be able to give it in an interview without reaching for the word 'standard'"
sidebar_label: "02 · Why not just an API key"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 §1.3.4, §4.4, §4.4.2, §4.4.3, §3.3 (Access Token
> Scope), §10.3 (Access Token Credentials); RFC 6750 §1 (Bearer); RFC 7009 (Token
> Revocation); RFC 7662 (Token Introspection); and RFC 8705 (mTLS) — at
> [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**"Why not just use an API key?" is a good question and it deserves a better answer than
"because OAuth2 is the standard". Both are bearer credentials; both are a string in a
header; both authorise a machine caller. The difference is one structural property — with a
client-credentials token, the long-lived secret stays put and a short-lived derived
credential does the travelling — and everything else on the list follows from it. If your
deployment does not actually benefit from that property, the API key may genuinely be the
better engineering choice.**

## The comparison, honestly

| | Long-lived API key | Client-credentials token |
|---|---|---|
| What travels on each call | 🔴 The long-lived secret itself | A short-lived derived token |
| Blast radius of a leaked call | Permanent, until someone notices | Bounded by `expires_in` |
| Where the durable secret lives | Every caller **and** every callee that verifies it | Client + AS only; callees hold a public key |
| Revocation | Delete the key — if you can find every user of it | Stop issuing; live tokens still run out |
| Rotation | Coordinated across every holder | Re-issue at the AS; callers pick it up |
| Scoping | Whatever you build | `scope`, standardised (§3.3) |
| Audience | Whatever you build | `aud`, if the provider sets it |
| Verification cost at the callee | A lookup, usually a database hit | A local signature check, no I/O |
| Audit | Whatever you build | `sub`, `client_id`, `jti`, `iat` on every token |
| Extra moving parts | None | An authorization server, its availability, its keys |
| Standard tooling | ⛔ none | ✅ every framework, every gateway |

## The property that actually matters

🔴 **With an API key, the thing you must protect forever is the thing you transmit
constantly.** Every call, every log line that captures a header, every proxy, every crash
dump is an opportunity to leak a credential that is valid until a human revokes it. With
client credentials, the durable secret is transmitted only to the authorization server — one
endpoint, one call every few minutes — and what flows to your fifty resource servers is a
token that expires on its own.

The second-order effect is more important than it looks: **the callee never holds a
verification secret.** A resource server checking a signed JWT needs only the issuer's
public key. An API-key checker needs the key or a hash of it, which means every service that
verifies is also a service that can leak. Compromise one API-key verifier and you have the
keys; compromise one JWT-validating resource server and you have a public key.

## When the API key is genuinely the right call

Do not pretend otherwise. All of these are real:

- **You do not already run an authorization server.** Standing one up to secure three
  internal calls is a large fixed cost against a small variable one, and it adds a hard
  runtime dependency where there was none.
- **The callers are few and stable.** Three services with three keys in a secret manager,
  rotated on a schedule that is actually followed, is a defensible design.
- **The callee cannot do public-key cryptography or reach a JWKS endpoint.** Rare, but real
  in embedded and legacy contexts.
- **The relationship is commercial, not architectural.** A key a customer copies out of a
  dashboard is a product decision. OAuth2 client credentials for external partners is
  better, and it is also more onboarding friction than some products can carry.

## When the API key stops being defensible

- **The caller count grows.** Rotation cost scales with holders, and un-rotated keys are the
  normal end state.
- **You need per-operation limits.** Standardised `scope` beats a bespoke permissions column
  you now have to design, store, evaluate and audit.
- **You need attribution.** "Which service made this call" from a shared key is guesswork.
- **A key must be revoked immediately.** With a key, revocation means finding every holder.
  With tokens, you stop issuing and the longest-lived outstanding token is one `expires_in`
  away — and RFC 7009 revocation or RFC 7662 introspection shortens even that.
- **The same credential is reaching services with different sensitivity.** One key that
  opens the reporting API and the payments API is one leak away from both. Audience-scoped
  tokens separate them.

## The middle ground people forget

You are not choosing between "a permanent string" and "a full identity platform". Between
them:

1. **Per-caller keys, in a secret manager, with rotation actually rehearsed.** Most of the
   benefit of the good end of the table, for far less machinery than an AS.
2. **mTLS.** The credential is a private key that never travels at all — strictly better
   than both on the leak dimension — and RFC 8705 lets you bind tokens to the certificate if
   you later add them. If you already have a mesh, this is nearly free.
3. **Client credentials, if you already run an authorization server for user-facing flows.**
   The fixed cost is already paid; the marginal cost is a registration.

🔴 **The decision is dominated by whether you already run an AS**, not by which mechanism is
theoretically superior. Adopting an authorization server *solely* for service-to-service
calls puts a new runtime dependency on every call path — and possibly on startup, if
resource servers use `issuer-uri` — to replace a secret you were already managing.

## What both designs still owe you

Neither mechanism answers these, and both get blamed when they are missing:

- **Least privilege.** A token with every scope is no better than a key with every
  permission.
- **Per-caller identity.** One shared credential across ten services is unattributable
  either way.
- **Transport security.** Both are bearer credentials; both are stolen by anyone who reads
  the request. RFC 6750's bearer semantics apply to a raw API key just as much.
- **Log hygiene.** An `Authorization` header printed at DEBUG leaks either one.

## Gotchas

**★ A client-credentials token is still a bearer token.**
Anyone who obtains it can use it until it expires. The improvement is the *duration* of the
exposure, not its existence. Sender-constraining it (mTLS or DPoP) is what removes the
exposure — see **14 · mTLS and workload identity** *(not written yet)*.

**★ Long access-token lifetimes throw away the entire advantage.**
A twenty-four-hour service token is an API key with extra infrastructure. If the argument
for tokens is bounded blast radius, the lifetime has to be bounded — minutes, not hours.

**★ "We rotate our API keys" is a claim to verify, not to accept.**
Ask when the last rotation happened and what broke. Rotation that is possible but never
performed is the same risk profile as a permanent key, with the added belief that it is fine.

**★ Adopting an AS only for service-to-service calls adds a dependency to replace a
secret.** Weigh the fixed cost honestly. If no user-facing flow needs an authorization
server, mTLS is usually the better buy.

**★ API-key verification usually means a database hit on every request.**
A signed token is verified locally against a cached public key. At high call volume this is
a real latency and availability difference, and it is the argument nobody makes.

**★ Every service that verifies an API key can leak it.**
Verification requires possessing the secret or its hash, so the credential's exposure
surface is every callee. JWT validation requires only a public key.

**★ Scopes on a machine token are the only constraint there is.**
No user bounds the token, so a service account with every scope in the realm is exactly as
dangerous as an all-permissions API key. The standard mechanism does not enforce restraint.

**★ A key in a query string is worse than either design contemplates.**
It lands in access logs, browser history and `Referer` headers. If you support it for
convenience, plan to remove it, and treat every key ever sent that way as compromised.

## Interview questions

**★ We already use API keys between services. Why would we move to client credentials?**
Because the credential that travels stops being the credential you must protect forever. An
API key is transmitted on every call and is valid until someone revokes it, so any leak — a
log, a proxy, a crash dump — is permanent until noticed. With client credentials the durable
secret goes only to the authorization server and what flows onward is a short-lived token
whose exposure expires on its own. Secondary gains: every callee holds only a public key
rather than a verification secret, scopes and audience are standardised rather than
bespoke, verification is a local signature check instead of a database lookup, and every
token carries `sub`, `client_id` and `iat` for audit. The cost is running an authorization
server and depending on it.

**★ When is the API key the better choice?**
When you do not already run an authorization server and would be standing one up purely for
this; when the callers are few and stable and rotation is genuinely rehearsed; when the
callee cannot do public-key cryptography or reach a JWKS endpoint; or when the relationship
is commercial and onboarding friction matters. Adopting an AS solely for machine-to-machine
traffic buys a runtime dependency on every call path to replace a secret you were already
managing — and if you have a mesh, mTLS is usually a better trade than either.

**★ Does moving to tokens make our service calls secure?**
Not by itself. A client-credentials token is still a bearer credential, so anyone who reads
the request can use it — the improvement is that the window is minutes rather than
indefinite, and that window only shrinks if you actually keep the lifetime short. It does
nothing for least privilege if you grant every scope, nothing for attribution if all
services share one client, and nothing about a header printed at DEBUG. To remove bearer
exposure rather than shorten it, sender-constrain the token with mTLS (RFC 8705) or DPoP.

**★ What is the middle ground between an API key and full OAuth2?**
Per-caller keys held in a secret manager with rotation that is rehearsed rather than merely
possible; or mTLS, where the credential is a private key that never travels at all and which
RFC 8705 lets you bind tokens to later. Both give most of the benefit for far less
machinery, and mTLS is close to free if a service mesh already exists.

**★ Why is a database lookup per API key a problem when signature verification is not?**
Because it is I/O on the hot path of every request: latency added to every call, load
proportional to traffic, and a dependency that can fail. Verifying a signed JWT is a local
CPU operation against a public key cached from a JWKS endpoint — no I/O per request, no
shared store, and a resource server that keeps working through an authorization-server
outage for as long as its cached keys and the tokens remain valid.

---

← [The grant with no user](01-the-grant-with-no-user.md) · [Topic index](README.md) · Next → [When there is a user after all](03-when-there-is-a-user-after-all.md)
