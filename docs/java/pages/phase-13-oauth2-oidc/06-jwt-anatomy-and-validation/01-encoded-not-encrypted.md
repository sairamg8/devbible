---
title: "A JWT is encoded, not encrypted — every claim in it is readable by anyone who holds it, and almost every JWT design mistake is a failure to internalise that one sentence"
sidebar_label: "01 · Encoded, not encrypted"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7519 §3 (JSON Web Token), §6 (Unsecured JWTs),
> §11 (Privacy Considerations); RFC 7515 §2 (Terminology — *Base64url Encoding*),
> §3.1 (JWS Compact Serialization); RFC 4648 §5 (Base 64 Encoding with URL and
> Filename Safe Alphabet); RFC 8725 §2 (Threats and Vulnerabilities).
> ([rfc-editor.org/rfc/rfc7519](https://www.rfc-editor.org/rfc/rfc7519.txt),
> [rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc4648](https://www.rfc-editor.org/rfc/rfc4648.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**A JSON Web Token is a JSON document that has been base64url-encoded and signed. Encoding
is not encryption. Signing is not encryption. The base64url segments of a JWT decode with
three lines of Java and no key at all, which means every claim you put in one — the user's
email, their internal database id, their subscription tier, the feature flags you were too
lazy to look up server-side — is public to anyone who ever holds the token: the browser, a
malicious extension, a proxy log, a crash reporter, an APM trace, the support engineer who
pasted it into a chat. The signature protects *integrity*, not *confidentiality*, and no
amount of "it's encrypted, look at it" in a design review changes that.**

## What the specification actually says

RFC 7519's own abstract:

> *"JSON Web Token (JWT) is a compact, URL-safe means of representing claims to be
> transferred between two parties."*

Note what is absent: any mention of secrecy. §3 continues:

> *"JWTs represent a set of claims as a JSON object that is encoded in a JWS and/or JWE
> structure."*

That "and/or" is the entire story. A JWT wrapped in a **JWS** (JSON Web Signature) is
*signed* — tamper-evident, world-readable. A JWT wrapped in a **JWE** (JSON Web Encryption)
is *encrypted* — opaque, but then it also needs to be signed or authenticated, which is why
RFC 7519 §11.2 says:

> *"If both signing and encryption are necessary, normally producers should sign the
> message and then encrypt the result."*

In practice, essentially every JWT you will meet in an OAuth2/OIDC deployment is a JWS in
**compact serialization**: three base64url segments separated by dots. Nested JWE is rare,
operationally expensive, and almost never what a resource server sees. When this topic says
"JWT" without qualification, it means a signed JWS compact serialization.

RFC 7519 §11 states the privacy consequence directly:

> *"A JWT may contain privacy-sensitive information. When this is the case, measures MUST
> be taken to prevent disclosure of this information to unintended parties."*

The only measure inside the JWT format that does that is JWE. A signature is not one.

## The three lines of Java that prove it

You do not need a key, a library, or the issuer's cooperation to read a JWT. This is plain
JDK:

```java
import java.nio.charset.StandardCharsets;
import java.util.Base64;

static String[] peek(String compactJws) {
    String[] parts = compactJws.split("\\.", -1);   // -1 keeps a trailing empty segment
    Base64.Decoder d = Base64.getUrlDecoder();      // NOT getDecoder() — see 02b
    return new String[] {
        new String(d.decode(parts[0]), StandardCharsets.UTF_8),  // JOSE header JSON
        new String(d.decode(parts[1]), StandardCharsets.UTF_8)   // claims JSON
    };
}
```

That method is the whole of "decoding a JWT". It is also the whole of what jwt.io does when
you paste a token into it — which is why pasting a production token into a web page is an
incident, not a debugging technique. Anything that method can print is not a secret.

🔴 **`peek` is a debugging aid and nothing else.** It performs no signature check, no claim
check, no algorithm check. Calling something like it and then trusting the result is the
single most common JWT vulnerability in real code —
**11e · Decoding is not validating** *(not written yet)* is that whole failure mode.

## What "signed" actually buys you

The signature covers the **JWS Signing Input**, which RFC 7515 §2 defines verbatim as:

> *"The input to the digital signature or MAC computation. Its value is
> `ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))`."*

So the signature is computed over the *encoded* header and the *encoded* payload, joined by
a dot. Three properties follow, and they are the only three:

1. **Integrity.** Change one byte of the header or payload and the signature no longer
   verifies. An attacker cannot flip `"admin": false` to `"admin": true`.
2. **Authenticity, relative to a key.** A verifying signature says "whoever holds the
   private key for this public key produced these bytes". It says nothing about *which*
   holder, or whether that holder meant the token for you — hence
   **11d · Issuer and audience confusion** *(not written yet)*.
3. **Nothing about time, purpose, or revocation.** Those come from the claims, and the
   claims are only checked if your code checks them.

Notably absent: **confidentiality** and **non-replayability**. A signed token is a bearer
credential. Whoever holds it is, to a naive resource server, the subject.

## The design rules that fall straight out of this

**Never put a secret in a JWT.** Not an API key, not a database password, not a
government id number, not a full credit-card PAN, not an internal service URL you were
hoping nobody would find. If it must not leak, it must not be a claim.

**Treat every claim as an input to your privacy review.** An access token that carries
`email`, `phone_number` and `birthdate` has published those fields to every browser
extension on the user's machine. OIDC solves this properly by separating the *ID token*
(for the client, about the user) from the *access token* (for the API, about authorization)
and by offering the UserInfo endpoint for attributes the client needs but the token should
not carry. **07 · OpenID Connect** *(not written yet)* owns that argument.

**Size is a real cost.** Base64 inflates by 4/3 before compression, and the token rides on
*every* request in an `Authorization` header. A 200-claim token is 8 KB of header on every
call and will hit a reverse proxy header limit — nginx's default `large_client_header_buffers`
is the usual casualty. The token is not a cache for your user profile.

**"It is encrypted" in a design document is a red flag, not a reassurance.** Ask which
of JWS or JWE. If the answer is "we use RS256", it is signed and public.

## Where a JWT actually goes on the wire

RFC 6750 §2.1 defines the bearer-token header, and this is the form you should be seeing:

```http
GET /api/orders HTTP/1.1
Host: orders.example.com
Authorization: Bearer <the.compact.jws>
```

(That is the request *shape* from RFC 6750 §2.1, not a captured request.) The RFC's other
two options exist and both are worse:

- **Form-encoded body parameter (§2.2)** — *"SHOULD NOT be used except in application
  contexts where participating browsers do not have access to the `Authorization` request
  header field."*
- **URI query parameter (§2.3)** — *"SHOULD NOT be used unless it is impossible to transport
  the access token in the `Authorization` request header field or the HTTP request
  entity-body."*

The reason the query parameter is discouraged is exactly the argument of this chunk: URLs
land in access logs, `Referer` headers, browser history and analytics pipelines, and the
token in them is readable. RFC 6750 §2 also requires: *"Clients MUST NOT use more than one
method to transmit the token in each request."*

## What this topic covers, and what it does not

This topic owns the **wire format and the validation algorithm** — every field, every
algorithm, the JWKS mechanics and every classic attack, ending in a concrete Spring
`NimbusJwtDecoder` configuration. It deliberately stops at four boundaries:

- **How the token was obtained** (authorization code, PKCE, client credentials) is
  [03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md) and [04 · Client credentials](../04-client-credentials/README.md).
- **Which token goes where, refresh rotation and revocation as protocol** is
  [05 · The three tokens](../05-the-three-tokens/README.md).
- **ID-token semantics, `nonce`, discovery and UserInfo** is **07 · OpenID Connect**
  *(not written yet)*.
- **Wiring a decoder into a `SecurityFilterChain`, authorities mapping and multi-tenancy**
  is [08 · Spring Security as resource server](../08-spring-security-resource-server/README.md). The already-written
  [Phase 9 · JWT resource server](../../phase-9-spring-boot/11-spring-security/09-jwt-resource-server.md)
  is the short version of that config.

## Gotchas

**★ "The token is encrypted" is wrong roughly every time it is said.**
It is base64url-encoded and signed. Base64 looks like ciphertext to the eye and is not.
If someone claims a JWT is confidential, ask them to name the `enc` header parameter; a JWS
does not have one, only a JWE does.

**★ `Base64.getDecoder()` fails on real JWT segments.**
JOSE uses base64url (RFC 4648 §5: the 62nd and 63rd characters are `-` and `_`, not `+` and
`/`) *with padding stripped* — RFC 7515 §2 says *"with all trailing `'='` characters
omitted."* The JDK's standard decoder rejects `-` and `_`, and its non-URL variant also
objects to missing padding in some inputs. Use `Base64.getUrlDecoder()`, which tolerates
absent padding.

**★ Putting user PII in an access token exports it to the browser permanently.**
Access tokens get stored, logged, and forwarded to third-party APM and error trackers. A
`birthdate` claim in an access token is a `birthdate` field in your Sentry payloads. Move
attributes to UserInfo or to a server-side lookup keyed by `sub`.

**★ A JWT is a bearer token: possession is authorization.**
Nothing in the format binds it to a client, a TLS connection, or a device. Sender-constrained
tokens (mTLS-bound per RFC 8705, or DPoP) are the fix, and they are a *different* mechanism
layered on top — **14 · mTLS and workload identity** *(not written yet)* owns that.

**★ Token size is a production failure mode, not a style concern.**
Roles arrays, group memberships and permission lists blow past proxy header limits. The
symptom is a 431 or a 400 from the edge, not from your application, so it looks like a
network problem. Keep tokens lean; look permissions up by `sub`.

**★ Pasting a token into jwt.io is a credential disclosure.**
The site decodes client-side, but the token is now in your clipboard history, possibly in a
browser extension's DOM scrape, and definitely in whatever chat you pasted it into on the
way. Decode locally with the four-line helper above, on a token you minted yourself.

**★ Base64url decoding cannot be trusted to imply "well-formed".**
A segment can decode to bytes that are not valid UTF-8, or to JSON with duplicate member
names. RFC 7519 §7.2 requires rejecting the token if the decoded octets are not a valid
UTF-8 JSON object. [02b · base64url and the JSON traps](02b-base64url-and-json-traps.md)
covers what a hand-rolled decoder gets wrong here.

## Interview questions

**★ Is a JWT encrypted?**
Not by default and not in any deployment you are likely to meet. A JWT is a set of claims
carried inside a JWS or a JWE. The JWS form — three base64url segments separated by dots —
is signed, which gives integrity and authenticity but zero confidentiality; anyone holding
the token can decode the payload with `Base64.getUrlDecoder()` and no key. The JWE form is
genuinely encrypted, but it is rare, and RFC 7519 §11.2 notes that if you need both you
should sign then encrypt. So the honest answer is: a JWT is *signed*, and if you need
secrecy you either use JWE or you keep the secret out of the token.

**★ What exactly does the signature cover, and why does that matter?**
It covers the **JWS Signing Input**, which RFC 7515 §2 defines as
`ASCII(BASE64URL(UTF8(protected header)) || '.' || BASE64URL(payload))` — the *encoded*
header and the *encoded* payload, joined by a dot. It matters for two reasons. First, the
header is signed, so `alg` and `kid` are integrity-protected *once you have verified the
signature* — but you have to pick a key before you can verify, which is exactly the
bootstrapping problem the `alg: none` and algorithm-confusion attacks exploit. Second,
because the signature is over the encoded bytes, you cannot re-serialize the JSON (reorder
keys, re-indent, re-encode) and expect the signature to still verify. You must verify the
exact bytes you received.

**★ A colleague wants to add the user's roles, department, cost centre and feature flags to
the access token so services do not have to look them up. What do you say?**
Three objections, in order of severity. (1) Confidentiality: all of it becomes public to
the browser and to every log and APM trace the token touches — cost centre and department
are often internal-only data. (2) Staleness: a claim is frozen at issuance, so revoking a
role does nothing until the token expires; if the token lives an hour, so does the revoked
role. (3) Size: those lists grow without bound and eventually breach a proxy header limit,
which surfaces as an edge-level 400/431 that looks like a network fault. The right split is
that the token carries identity and coarse authorization (`sub`, `scope`, maybe a small
stable role set) and the service looks up the volatile, large or sensitive parts by `sub`.

**★ Why does RFC 6750 discourage putting the access token in a query parameter?**
Because URLs are recorded in places the request body and headers are not: web-server access
logs, proxy logs, browser history, the `Referer` header sent to third-party origins, and
analytics pipelines. Since the token is a bearer credential, each of those is a credential
store you did not intend to create. RFC 6750 §2.3 says the query-parameter method
*"SHOULD NOT be used unless it is impossible to transport the access token in the
`Authorization` request header field or the HTTP request entity-body."*

**★ If the payload is world-readable, what stops a user from editing their own token?**
Nothing stops them editing it; the signature stops it being *accepted*. Editing any byte of
the header or payload changes the JWS Signing Input, so the recomputed signature will not
match the one attached, and a correct verifier rejects the token. The important qualifier is
"a correct verifier": if the server accepts `alg: none`, or verifies an HMAC using the
public key as the secret, or decodes without verifying at all, then editing works perfectly.
Those are chunks **11** *(not written yet)*, **11b** *(not written yet)* and
**11e** *(not written yet)*.

---

← [Topic index](README.md) · Next → [Compact serialization](02-compact-serialization.md)
