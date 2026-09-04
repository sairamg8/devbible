---
title: "A JWT is a signed document that anybody can read and that tells the verifier, in attacker-controlled fields, how to verify it — and the whole discipline of JWT validation is deciding what you will let the token influence and what you decided in advance"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against RFC 7515 (JWS) §3, §4.1.1 (`alg`), §4.1.2 (`jku`), §4.1.3
> (`jwk`), §4.1.4 (`kid`), §4.1.5 (`x5u`), §4.1.6 (`x5c`), §4.1.9 (`typ`), §4.1.10 (`cty`),
> §4.1.11 (`crit`), §7.1 (Compact Serialization)
> ([rfc-editor.org/rfc/rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt)); RFC 7519 (JWT)
> §4.1 (Registered Claim Names), §7.2 (Validating a JWT)
> ([rfc-editor.org/rfc/rfc7519](https://www.rfc-editor.org/rfc/rfc7519.txt)); RFC 7517 (JWK),
> RFC 7518 (JWA) §3; RFC 8725 (JWT BCP) §2.1, §3
> ([datatracker.ietf.org/doc/html/rfc8725](https://datatracker.ietf.org/doc/html/rfc8725));
> RFC 9068 (JWT profile for access tokens) §2.1, §4
> ([rfc-editor.org/rfc/rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt)); RFC 4648 §5
> (base64url); the Spring Security 7.x reference and `NimbusJwtDecoder` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/)).
> Target: **JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x**.
> **No sandbox** — Java source, config and specification-quoted definitions; token structure
> where shown is illustrative and labelled as such, signatures written `<base64url-signature>`.

**Two sentences carry this entire topic. The first: a JWT is encoded, not encrypted — every
claim in it is readable by anyone who holds it, and no amount of "it's signed" changes that.
The second: the JOSE header is attacker-controlled input that the verifier must act on
*before* it has verified anything. Every classic JWT attack — `alg: none`, RS-to-HS
confusion, `kid` injection, `jku` pointing at the attacker's own key set — is the same bug
seen from a different angle: the verifier let the token decide something the verifier should
have decided in advance.**

The rule that makes the header survivable is narrow and worth memorising: **`alg` may narrow
a choice you already made, but it may never widen it.** You decide which algorithms and which
keys are acceptable, out of band, before the first token arrives; the header is then allowed
to pick from that set and nothing else. `kid` is a *hint* for selecting among keys you already
trust, not a lookup key you may dereference. `jku`, `jwk`, `x5u` and `x5c` let the token
nominate its own key, which is the one thing a verifier must never permit — and the
specifications say so in the same breath as defining them.

The topic ends where the framework begins. `NimbusJwtDecoder` is the concrete implementation
that has already paid all of these costs correctly; wiring it into a filter chain is
**08 · Spring Security as resource server**.

**11 chunks, ~3,005 lines.** Read 01 and 03 first — they are the two sentences above.

## Chunks

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[Encoded, not encrypted](01-encoded-not-encrypted.md)** | <span className="db-tier t-master">Master</span> | 🔴 Every claim is readable by anyone holding the token; almost every JWT design mistake is a failure to internalise that |
| 2 | **[Compact serialization](02-compact-serialization.md)** | <span className="db-tier t-master">Master</span> | Three base64url segments joined by dots — the signature covers the *encoded bytes*, not the JSON, which explains what a verifier may do |
| 3 | **[base64url and JSON traps](02b-base64url-and-json-traps.md)** | <span className="db-tier t-master">Master</span> | Unpadded ≠ padded, and a permissive JSON parser will disagree with the verifier about what the token said |
| 4 | **[The header contract and `alg`](03-the-jose-header.md)** | <span className="db-tier t-master">Master</span> | 🔴 Attacker-controlled input acted on before verification; `alg` may narrow a choice you already made, never widen it |
| 5 | **[Explicit typing](03b-explicit-typing.md)** | <span className="db-tier t-master">Master</span> | `typ` is optional in RFC 7515 and mandatory in RFC 9068 — because an AS signs every kind of token it issues with the same key |
| 6 | **[The Spring 7 `typ` collision](03c-the-spring-7-typ-collision.md)** | <span className="db-tier t-master">Master</span> | 🔴 Spring Security 7's default chain rejects exactly the token RFC 9068 requires an AS to issue — a two-line fix behind a mystifying 401 |
| 7 | **[`kid`, `cty` and `crit`](03d-kid-cty-and-crit.md)** | <span className="db-tier t-master">Master</span> | `kid` is a hint, not a dereferenceable lookup key; `crit` is a fail-closed extension point a verifier must honour by rejecting |
| 8 | **[The dangerous headers](03e-the-dangerous-headers.md)** | <span className="db-tier t-master">Master</span> | 🔴 `jku`, `jwk`, `x5u`, `x5c` let the token nominate its own verification key — never let it |
| 9 | **[`iss` and `sub`](04-registered-claims-identity.md)** | <span className="db-tier t-master">Master</span> | Compare `iss` to a *key*, not just a string; `sub` is not a globally unique user id |
| 10 | **[The audience claim](04b-the-audience-claim.md)** | <span className="db-tier t-master">Master</span> | 🔴 The only defence against a token legitimately issued to one recipient being replayed at another — and Spring does not check it unless you say so |
| 11 | **[Configuring audience validation](04c-configuring-audience-validation.md)** | <span className="db-tier t-master">Master</span> | The one-line property, and how the audience identifier you pick decides whether a compromised service can spend its tokens elsewhere |

## The six things this topic is really about

**1 · Readable by design.** Base64url is an encoding, not a cipher. Anything in a JWT payload
is public to everyone who ever holds the token — the browser, the log aggregator, the APM
vendor, the support engineer pasting it into a decoder. The rule that follows is simply: do
not put in a JWT what you would not put in a URL. If you need confidentiality you need JWE,
and that is a different specification with different operational costs.

**2 · The signature covers the encoded bytes.** The signing input is
`BASE64URL(header) || "." || BASE64URL(payload)` — the exact octets on the wire, not a
re-serialisation of the parsed JSON. That is why a verifier must never re-encode before
checking, why whitespace and key order are load-bearing, and why a lenient JSON parser that
"fixes" duplicate keys can make the verifier and the application disagree about the token's
contents while the signature still checks out.

**3 · `alg` narrows, never widens.** The verifier's accepted algorithm set is configured out
of band. `alg: none` is an attack only against a verifier that consults the header for
permission rather than for selection; RS256→HS256 confusion is the same bug where the
attacker gets the verifier to treat a *public* key as an HMAC secret. RFC 8725 §3.1's
instruction is to use algorithm-specific validation with a pre-decided list.

**4 · The four headers that let a token pick its own key are the ones to switch off.** `jku`
and `x5u` are URLs the verifier would fetch; `jwk` and `x5c` are keys embedded in the token
itself. Honouring any of them means the token both makes the claim and supplies the proof.
Chunk 08 is the concrete list plus what a safe deployment does instead: keys from a
pre-configured JWKS endpoint tied to the issuer you already trust.

**5 · `aud` is the claim nobody validates until an incident makes them.** A token minted for
service A is a perfectly valid, correctly signed, unexpired token at service B unless B
checks the audience. Spring's `issuer-uri` configuration validates `iss`, `exp` and `nbf` by
default and does **not** validate `aud` until you configure it. Chunks 10 and 11 are the
argument and the one-line fix.

**6 · The Spring Security 7 `typ` collision is the version trap of this whole phase.** Spring
Security 7 moved `typ` handling into the default validator chain, and the default now rejects
`typ: at+jwt` — the exact media type RFC 9068 §2.1 requires an authorization server to stamp
on a JWT access token. It presents as a 401 with no useful message on a token that is
correct. Chunk 06 has the two-line fix; do not let a reader meet this in production first.

## Still owed in this topic

The chunks below are named in the prose of chunks 01, 02, 02b, 03, 03b, 03d and 04c and are
not written yet. The topic's argument is complete without them; its *coverage* is not.

- **04b · The time claims** *(not written yet)* — `exp`, `nbf`, `iat`, clock skew, and why
  `long` versus `double` matters above 2⁵³.
- **05 · The RFC 9068 access-token profile** *(not written yet)* — what a compliant JWT
  access token must carry.
- **06 · The algorithm table** *(not written yet)* — RS256, PS256, ES256, EdDSA, HS256 side
  by side, with the symmetric-vs-asymmetric argument.
- **08b · `kid` lookup** *(not written yet)* — selecting among trusted keys safely.
- **09 · Key rotation** *(not written yet)* — JWKS refresh, overlap windows, and the outage
  a naive cache causes.
- **11 · The `none` attack**, **11b · RS/HS confusion**, **11c · Header injection**,
  **11d · Issuer and audience confusion**, **11e · Decoding is not validating**
  *(none written yet)* — the classic attack set, one chunk each.
- **12b · The default validator chain**, **12c · Custom token validators**,
  **12d · `NimbusJwtDecoder` internals** *(none written yet)*.
- **13 · `JwtEncoder`** *(not written yet)* — minting, and the trap that comes with it.

## Phase gate

You are done with this topic when you can state, without looking it up, what the signature is
computed over, why `alg` may narrow but never widen, which four headers must never be
honoured, and which claims Spring validates by default versus which one you have to ask for.

## Where this connects

- [03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md) — how the token
  was obtained in the first place.
- **05 · The three tokens** — why the *client* must not parse the access token even though
  this topic explains exactly how to.
- **07 · OpenID Connect** — the ID token, the one JWT that is a JWT by specification.
- **08 · Spring Security as resource server** — `NimbusJwtDecoder` in a real filter chain,
  plus the validator composition trap.

---

Start → [Encoded, not encrypted](01-encoded-not-encrypted.md)
