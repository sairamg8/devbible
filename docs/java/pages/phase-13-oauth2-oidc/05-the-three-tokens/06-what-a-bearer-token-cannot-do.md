---
title: "A bearer token cannot tell the resource server who is presenting it, and the two specifications that fix that — mTLS-bound tokens and DPoP — are the only structural answer to token theft that does not depend on nobody ever stealing one"
sidebar_label: "06 · What a bearer token cannot do"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §1.2 (Terminology)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 9700 §2.2.1 (Access
> Tokens), §2.2.2 (Refresh Tokens), §4.10.1 (Sender-Constrained Access Tokens)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt)); RFC 8705 §3.1
> (Confirmation Method for JWTs) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc8705.txt));
> RFC 9449 §1 (Introduction), §5 (DPoP Access Token Request), §6 (Public Key Confirmation),
> §7 (Protected Resource Access), §7.1 (The DPoP Authentication Scheme)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9449.txt));
> `OAuth2ResourceServerConfigurer` and `DPoPAuthenticationProvider` sources on `main`
> ([github.com/spring-projects](https://github.com/spring-projects/spring-security)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Every mitigation in [04b](04b-safeguarding-a-bearer-token.md) is about *not losing* the
token, and every one of them is a process control that a single mistake defeats. The
structural question is different: could the resource server tell a stolen token from a
legitimate one, even if the token leaked? For a bearer token the answer is no, by definition.
Two specifications change that answer, and RFC 9700 now says you SHOULD use one of them.**

## The property, restated as an impossibility

RFC 6750 §1.2 again:

> *"Using a bearer token does not require a bearer to prove possession of cryptographic key
> material (proof-of-possession)."*

Turn it around: there is no field in a bearer request that only the legitimate client could
have produced. The header contains the token; the token is the whole credential; anyone with
the bytes produces a byte-identical request. This is not a gap in the implementation — a
resource server that wanted to distinguish them has nothing to look at.

Consequences, in order:

- **No detection.** A stolen token is used exactly like a legitimate one. Anomaly detection on
  IP or user-agent is heuristic and defeated by any attacker who cares.
- **No containment.** RFC 9700 §4.9.1 describes a counterfeit resource server phishing tokens
  that *"are valid for other resource servers"*. Without audience restriction, one leak is a
  leak everywhere.
- **No revocation, in the JWT case.** The token validates locally; the AS is not consulted; a
  revocation reaches nobody until expiry. See **13b** *(not written yet)*.
- **Lifetime is the only lever.** Which is why [07](07-access-token-lifetime-as-a-design-decision.md)
  is about arithmetic rather than taste.

## What RFC 9700 now requires

Two clauses, and they differ in strength — read them carefully, because the difference is
often misquoted.

For **access tokens**, §2.2.1 is a `SHOULD`:

> *"Authorization and resource servers SHOULD use mechanisms for sender-constraining access
> tokens, such as mutual TLS for OAuth 2.0 [RFC8705] or OAuth 2.0 Demonstrating Proof of
> Possession (DPoP) [RFC9449] (see Section 4.10.1), to prevent misuse of stolen and leaked
> access tokens."*

For **refresh tokens issued to public clients**, §2.2.2 is a `MUST`, with an alternative:

> *"Refresh tokens for public clients MUST be sender-constrained or use refresh token rotation
> as described in Section 4.14. [RFC6749] already mandates that refresh tokens for
> confidential clients can only be used by the client for which they were issued."*

So: sender-constraining access tokens is recommended; for public-client refresh tokens you
must do *either* sender-constraining *or* rotation. Rotation is
**10 · Refresh token rotation** *(not written yet)*; the "or" is why rotation is what
almost everybody actually deploys.

§4.10.1 defines the term:

> *"As the name suggests, sender-constrained access tokens scope the applicability of an access
> token to a certain sender. This sender is obliged to demonstrate knowledge of a certain
> secret as a prerequisite for the acceptance of that token at the recipient (e.g., a resource
> server)."*

"Demonstrate knowledge of a certain secret" — that is the missing field. Add it and the
resource server can, for the first time, distinguish the client from a thief.

## Option one: mTLS-bound tokens (RFC 8705)

The client already authenticates its TLS connection with a certificate. The AS binds the
issued token to the hash of that certificate; the resource server checks that the certificate
on *this* connection hashes to the same value.

The binding lives in a `cnf` (confirmation) claim. RFC 8705 §3.1:

> *"To represent the hash of a certificate in a JWT, this specification defines the new JWT
> Confirmation Method [RFC7800] member `x5t#S256` for the X.509 Certificate SHA-256
> Thumbprint. The value of the `x5t#S256` member is a base64url-encoded SHA-256 hash […] of
> the DER encoding of the X.509 certificate."*

The claim shape, from RFC 8705 §3.1's own non-normative example:

```json
{
  "iss": "https://server.example.com",
  "sub": "ty.webb@example.com",
  "exp": 1493726400,
  "nbf": 1493722800,
  "cnf": {
    "x5t#S256": "bwcK0esc3ACC3DB2Y5_lESsXE8o9ltc05O89jdN-dg2"
  }
}
```

RFC 8705 §3.2 defines the same `cnf`/`x5t#S256` structure for **introspection responses**, so
the mechanism works for opaque tokens too — the resource server introspects and gets the
thumbprint back.

**Where it fits:** service-to-service, and any environment where you already run a PKI or a
service mesh. The client needs no OAuth-specific code at all beyond presenting its existing
client certificate. **Where it does not:** browsers. TLS client authentication in a browser is
a user-experience disaster, which is exactly what RFC 9449 §1 says motivated DPoP.

The certificate-rotation and workload-identity side of this is
**14 · mTLS and workload identity** *(not written yet)*.

## Option two: DPoP, and choosing between them

The application-layer alternative — DPoP (RFC 9449) — its Spring Security 7 support, the
comparison table, and the limit both mechanisms share, are
[06b · DPoP and choosing a constraint](06b-dpop-and-choosing-a-constraint.md).

## Gotchas

**★ mTLS-bound tokens work with opaque tokens too — the binding is not JWT-specific.**
RFC 8705 §3.2 defines the same `cnf` / `x5t#S256` structure for token *introspection*
responses, so a resource server that introspects an opaque token gets the thumbprint back and
can compare it against the connection's certificate. People assume sender-constraining
requires JWTs; it does not.

**★ Certificate rotation invalidates every token bound to the old certificate.**
The binding is to a thumbprint of a specific DER encoding. Rotate the client certificate and
every outstanding token bound to the old one stops being accepted. With short access-token
lifetimes that is a non-event; with long ones it is an outage. Plan rotation and token
lifetime together.

**★ RFC 9700 §2.2.1 is a `SHOULD` for access tokens and §2.2.2 is a `MUST` for public-client
refresh tokens — and the `MUST` has an "or rotation" escape.**
People quote this as "the BCP requires DPoP". It does not. It requires public-client refresh
tokens to be *"sender-constrained or use refresh token rotation"*, and it recommends
sender-constraining access tokens. Getting the strength right matters when you are arguing for
budget.

**★ mTLS binding and a TLS-terminating load balancer are in direct tension.**
If TLS terminates at the edge, the resource server never sees the client certificate and
cannot compare thumbprints. You need the proxy to forward the certificate (or its hash) over a
trusted header, and then that header becomes a spoofing target that must be stripped from
inbound requests. This is a real deployment cost, not a footnote.

## Interview questions

**★ Where does the mTLS binding actually live, and what does the resource server compare?**
In a `cnf` (confirmation) claim on the token, using the member RFC 8705 §3.1 defines:
*"the new JWT Confirmation Method member `x5t#S256` for the X.509 Certificate SHA-256
Thumbprint"*, whose value is *"a base64url-encoded SHA-256 hash […] of the DER encoding of the
X.509 certificate"*. On each request the resource server takes the client certificate from the
TLS connection, hashes its DER encoding, and compares. For opaque tokens the same structure
comes back in the introspection response per §3.2. Nothing about the client's request changes
— which is why mTLS binding is nearly free when you already have client certificates.

**★ What is a sender-constrained token, and what problem does it solve that short lifetimes do
not?**
It is a token whose acceptance requires the presenter to demonstrate knowledge of a secret —
RFC 9700 §4.10.1: *"This sender is obliged to demonstrate knowledge of a certain secret as a
prerequisite for the acceptance of that token at the recipient."* Short lifetimes bound how
long a stolen token is useful; sender-constraining makes a stolen token useless *immediately*,
because the thief has the token bytes and not the key. The two are complementary: lifetimes
limit the window, constraining removes the replay. Concretely, a bearer token in a log file is
a working credential; a DPoP-bound token in a log file is not.

**★ Does RFC 9700 require DPoP?**
No, and the distinction is worth getting right. §2.2.1 says authorization and resource servers
*"SHOULD use mechanisms for sender-constraining access tokens, such as mutual TLS […] or
DPoP"* — a recommendation, naming two options. §2.2.2 is a `MUST`, but with a disjunction:
*"Refresh tokens for public clients MUST be sender-constrained or use refresh token
rotation"*. So the only hard requirement is on public-client refresh tokens, and rotation
satisfies it, which is why rotation is what almost every deployment actually ships.

{/* FOOTER */}
