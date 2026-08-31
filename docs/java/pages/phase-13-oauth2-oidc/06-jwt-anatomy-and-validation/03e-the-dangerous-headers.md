---
title: "jku, jwk, x5u and x5c let the token tell the verifier where to find the key that verifies it, which is the one thing a verifier must never let a token decide — and the specifications say so in the same breath as defining them"
sidebar_label: "08 · The dangerous headers"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7515 §4.1.2 (`jku`), §4.1.3 (`jwk`), §4.1.5 (`x5u`),
> §4.1.6 (`x5c`), §4.1.7 (`x5t`), §4.1.8 (`x5t#S256`), §6 (Key Identification),
> §10.3, §10.5; RFC 7517 §4.6 (`x5u`), §4.7 (`x5c`), §9 (Security Considerations);
> RFC 8725 §2.9 (Indirect Attacks on the Server), §3.10 (Do Not Trust Received Claims);
> RFC 8705 §3.1 (JWT Certificate Thumbprint Confirmation Method); Spring Security 7.0.x
> source `JwtValidators.createDefault`, `X509CertificateThumbprintValidator`.
> ([rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc7517](https://www.rfc-editor.org/rfc/rfc7517.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Four header parameters exist whose entire function is to tell the verifier where to get the
key. `jwk` carries the key inline. `jku` and `x5u` carry a URL to fetch it from. `x5c`
carries a certificate chain. Each of them, used naively, converts "verify this token against
the key I trust" into "verify this token against the key the token brought", which is not
verification at all. They are not a design flaw in JOSE — they exist for protocols where the
key is genuinely dynamic and where a separate trust anchor validates it. They are a design
flaw in *your* verifier the moment you honour one without an independent reason to trust
what it points at.**

## The four, defined

**`jwk` — RFC 7515 §4.1.3:**

> *"The `'jwk'` (JSON Web Key) Header Parameter is the public key that corresponds to the key
> used to digitally sign the JWS. This key is represented as a JSON Web Key [JWK]. Use of this
> Header Parameter is OPTIONAL."*

The key is *in the token*. An attacker generates a key pair, signs their forged token with
the private key, and puts the matching public key in `jwk`. A verifier that honours it will
verify the signature successfully every single time. There is no cryptography to break.

**`jku` — RFC 7515 §4.1.2:**

> *"The `'jku'` (JWK Set URL) Header Parameter is a URI [RFC3986] that refers to a resource
> for a set of JSON-encoded public keys, one of which corresponds to the key used to digitally
> sign the JWS. … The protocol used to acquire the resource MUST provide integrity
> protection; an HTTP GET request to retrieve the JWK Set MUST use Transport Layer Security
> (TLS) [RFC2818] [RFC5246]; and the identity of the server MUST be validated, as per Section
> 6 of RFC 6125 [RFC6125]."*

Note what the MUST protects: it guarantees the URL is fetched *securely*, not that the URL is
*trustworthy*. TLS to `https://attacker.example/jwks.json` is a perfectly valid TLS
connection.

**`x5u` — RFC 7515 §4.1.5:** the same idea with an X.509 certificate or chain in PEM at the
end of the URL, with the same TLS requirements.

**`x5c` — RFC 7515 §4.1.6:**

> *"The `'x5c'` (X.509 certificate chain) Header Parameter contains the X.509 public key
> certificate or certificate chain [RFC5280] corresponding to the key used to digitally sign
> the JWS. The certificate or certificate chain is represented as a JSON array of certificate
> value strings. Each string in the array is a base64-encoded (Section 4 of [RFC4648] -- not
> base64url-encoded) DER PKIX certificate value."*

An inline chain. It is only meaningful if you validate it to a trust anchor you configured —
otherwise it is `jwk` with extra steps, and a self-signed certificate satisfies it.

(Two encoding traps hide in that quote: `x5c` is **base64, not base64url**, unlike every
other segment of a JWT, and it is **DER**, not PEM. `x5u` points at PEM. Mixing them up is a
common bug in hand-rolled tooling.)

## What the specifications say about trusting them

RFC 7515 §6, *Key Identification*, is the sentence to memorise:

> *"It is not possible to describe all possible mechanisms for key identification and use in
> this specification. … The Header Parameter values used to identify the key … MUST be
> integrity protected if the information that they convey is to be utilized in a trust
> decision."*

Integrity protection is necessary and it is nowhere near sufficient — the header is protected
by a signature made with the very key the header points at, so an attacker who supplies both
is entirely self-consistent. RFC 7515 §10.3 closes the loop:

> *"The key management technique employed to obtain public keys must authenticate the origin
> of the key; otherwise, it is unknown what party signed the message."*

RFC 8725 §3.10 states the operational rule for `jku`/`x5u`:

> *"Blindly following a `'jku'` (JWK set URL) or `'x5u'` (X.509 URL) header, which may contain
> an arbitrary URL, could result in server-side request forgery (SSRF) attacks."*

and §2.9 puts it in context:

> *"Various JWT claims are used by the recipient to perform lookup operations … Any of these
> claims can be used by an attacker as vectors for injection attacks or server-side request
> forgery (SSRF) attacks."*

So there are two distinct harms from `jku`/`x5u`, and both are real:

1. **Trust bypass** — you fetch the attacker's JWK set and verify their forged token with it.
2. **SSRF** — you make an HTTP request to a URL of the attacker's choosing, from inside your
   network, before you have authenticated anything. `http://169.254.169.254/latest/meta-data/`
   does not need to return a valid JWK set to be a successful attack.

## The rule

🔴 **A resource server obtains its keys from a JWKS URL it was configured with, and from
nowhere else.**

`jwk`, `jku`, `x5u` and `x5c` must be **ignored** — not fetched, not parsed, not partially
validated. There is no OAuth2 or OIDC scenario in which a resource server needs a token to
tell it where the issuer's keys live: that comes from `jwk-set-uri`, or from `issuer-uri` plus
the `/.well-known/openid-configuration` discovery document, which is itself fetched from a
configured origin.

**Spring's position is that this is not configurable, which is correct.**
`NimbusJwtDecoder`'s builders take a JWK set URI, a public key, or a secret key. There is no
builder method that enables `jku` resolution and no property that turns it on. To honour a
`jku` you would have to install a custom `JWKSource` through `jwtProcessorCustomizer` and
deliberately write the code. The absence of the feature *is* the defence, and it is the same
design principle as splitting `withPublicKey` from `withSecretKey`:
**do not offer an API shape whose misuse is a vulnerability.**

If you have inherited a hand-rolled verifier, the audit is one grep:

```java
// Anything resembling this is the finding.
String jku = (String) header.get("jku");
JWKSet keys = JWKSet.load(new URL(jku));   // ← unauthenticated fetch, attacker-chosen URL
```

The fix is not an allow-list of hosts — although if you are cornered, an exact-match
allow-list of full URLs is better than nothing. The fix is to delete the branch and read the
JWKS URI from configuration.

## Where these headers legitimately belong

They are not vestigial. They matter in protocols where the signing key is genuinely per-actor
and a separate trust anchor validates it:

- **`x5c` with PKIX validation.** Some financial and government profiles sign with a
  certificate issued by a named CA. The verifier validates the chain to a *configured* trust
  anchor, checks the certificate's subject or a policy OID, and only then uses the leaf key.
  The trust decision is made by the PKI, not by the token; `x5c` is transport for the chain.
- **`jwk` in DPoP proofs.** RFC 9449 DPoP proofs carry the client's ephemeral public key
  inline — and the binding that makes it safe is external: the access token's `cnf.jkt` claim
  contains the thumbprint of the key that must be in `jwk`. The token from the AS is what
  authorises the key; the proof cannot introduce its own.
- **`jku` inside a closed federation** where the set of legal URLs is enumerated in
  configuration. This is rare and always worth challenging.

The pattern in all three: **something you already trust constrains what the header may
introduce.** Absent that constraint, the header is a bypass.

## `x5t` and `x5t#S256`, which are different and mostly benign

RFC 7515 §4.1.7 and §4.1.8:

> *"The `'x5t'` (X.509 certificate SHA-1 thumbprint) Header Parameter is a base64url-encoded
> SHA-1 thumbprint (a.k.a. digest) of the DER encoding of the X.509 certificate [RFC5280]
> corresponding to the key used to digitally sign the JWS."*

These are **identifiers**, like `kid` — a fingerprint used to select among certificates you
already have. They do not introduce key material and they do not cause a fetch. `x5t` uses
SHA-1, `x5t#S256` uses SHA-256; prefer the latter, and note that SHA-1's collision weakness
matters here only if you are using the thumbprint as a *security* decision rather than as a
selector.

There is a second, unrelated use of the same string that Spring Security 7 now has in its
default validator chain, and it is worth not confusing: **RFC 8705 §3.1** defines a `cnf`
*claim* member named `x5t#S256` that binds an access token to a client's mTLS certificate.
That is the claim, not the header. `JwtValidators.createDefault()` composes:

```java
new X509CertificateThumbprintValidator(
        X509CertificateThumbprintValidator.DEFAULT_X509_CERTIFICATE_SUPPLIER)
```

whose javadoc describes it as *"An `OAuth2TokenValidator` responsible for validating the
`x5t#S256` claim (if available) in the `Jwt` against the SHA-256 …"* thumbprint of the
certificate on the current request. **If the token has no `cnf` claim it returns success
immediately**, so it is inert for ordinary bearer tokens — but it means every Spring Security
7 resource server is already certificate-binding-aware for free. Sender-constrained tokens are
**14 · mTLS and workload identity** *(not written yet)*.

## Gotchas

**★ `jku`'s MUST-use-TLS requirement does not make `jku` safe.**
RFC 7515 §4.1.2 requires TLS and server-identity validation for the fetch. That guarantees you
talked to the server the URL named — it says nothing about whether that server should be
trusted. A valid TLS connection to an attacker's host is still an attacker's key.

**★ Honouring `jku` or `x5u` is an SSRF primitive even when the fetch fails.**
Your server makes an outbound request to an attacker-chosen URL before authenticating anything.
Cloud metadata endpoints, internal admin ports and `file:` handlers are all reachable that way,
and the timing of the failure leaks whether the host exists. RFC 8725 §3.10 calls this out
explicitly.

**★ `x5c` without chain validation to a configured trust anchor is `jwk` with extra steps.**
A self-signed certificate is a perfectly well-formed `x5c`. Parsing the chain and using the
leaf key is not validation; validating the chain to a trust anchor *you* configured, and
checking the subject, is.

**★ `x5c` is base64, not base64url, and DER, not PEM.**
RFC 7515 §4.1.6 says so explicitly — *"base64-encoded (Section 4 of [RFC4648] -- not
base64url-encoded)"*. Every other segment of a JWT is base64url. Hand-rolled tooling gets this
backwards constantly, and the symptom is a certificate parse failure that looks like
corruption.

**★ An allow-list of `jku` *hosts* is weaker than it looks.**
If any allowed host serves user-controlled content — an S3 bucket, a CDN with a public upload
path, a wiki with attachments — the allow-list is bypassed. If you must allow-list, match the
full URL exactly, and prefer deleting the feature.

**★ `x5t` uses SHA-1.**
It is a selector, not a signature, so collision resistance is not directly load-bearing — but
if any part of your logic treats an `x5t` match as *proof* of which certificate signed, prefer
`x5t#S256`. RFC 7515 defines both for exactly this reason.

**★ The header `x5t#S256` and the RFC 8705 `cnf` member `x5t#S256` are different things.**
One identifies a certificate for key selection; the other binds a token to the client
certificate on the TLS connection. Spring's `X509CertificateThumbprintValidator` is about the
second and lives in the default validator chain.

**★ `X509CertificateThumbprintValidator` being in the Spring 7 defaults is silent until it is
not.**
It returns success when there is no `cnf` claim, so ordinary tokens are unaffected. The moment
your AS starts issuing certificate-bound tokens, every resource server on Security 7 starts
enforcing the binding — which is what you want, and which will look like a mysterious 401 to
anyone who did not know the validator existed.

**★ "We validate `jku` against the issuer's domain" is not a defence you can state casually.**
Subdomain takeover, open redirects, and hosts that serve user content all defeat
domain-suffix matching. If the check is not exact-URL equality against configuration, write
down the threat model that makes it sufficient — usually you cannot.

## Interview questions

**★ What is wrong with honouring the `jku` header?**
It lets the token choose the key that verifies it, which makes verification circular and
therefore meaningless: an attacker generates a key pair, signs a forged token, hosts the
matching public key at a URL they control, and puts that URL in `jku`. RFC 7515 §4.1.2 requires
the fetch to use TLS with server-identity validation, which guarantees the fetch was not
tampered with — it does not make the URL trustworthy. There is a second, independent harm: the
fetch itself is server-side request forgery, an outbound request to an attacker-chosen URL
made from inside your network before anything has been authenticated, which RFC 8725 §3.10
names directly. A resource server should take its keys from a configured `jwk-set-uri` (or from
discovery on a configured `issuer-uri`) and ignore `jku` entirely.

**★ Then why do `jku` and `jwk` exist at all?**
Because JOSE is a general signature format, not an OAuth2-specific one, and there are
protocols in which the signing key genuinely is per-message or per-actor and is validated by
something outside the JWS. DPoP is the clean example: the proof carries the client's ephemeral
public key in `jwk`, and it is safe because the *access token* — issued by the authorization
server you already trust — carries a `cnf.jkt` thumbprint that the `jwk` must match. The
header transports the key; the trust decision is made elsewhere. `x5c` with PKIX chain
validation to a configured trust anchor is the same pattern. The rule that unifies them is
that something you already trust must constrain what the header may introduce; absent that
constraint, the header is a bypass.

**★ How would you audit a hand-rolled JWT verifier for this class of bug?**
Grep for the four header names — `jwk`, `jku`, `x5u`, `x5c` — and for anything that constructs
a URL, a `URLConnection`, an HTTP client call, a `KeyFactory` or a `CertificateFactory` from
data taken out of the header. Then ask, for each hit, *what would have to be true for the key
this produces to be trusted*, and check that the answer refers to configuration rather than to
the token. Separately, check the negative: confirm the verifier obtains its keys from exactly
one configured source, and that the code path from token to key contains no branch. In Spring
this audit is short because the API offers no such branch — the builders take a JWKS URI, a
public key or a secret key, and honouring `jku` would require you to write a custom `JWKSource`
on purpose.

**★ Is an allow-list of permitted `jku` URLs an acceptable mitigation?**
It is better than nothing and it is not a good answer. Host-level allow-listing fails if any
permitted host can serve attacker-influenced content — an S3 bucket with a public upload path,
a CDN, a wiki with attachments, a subdomain that has been taken over. Exact-full-URL matching
is meaningfully stronger, but at that point you have hardcoded the URL, which means you did not
need `jku`: you could read the same URL from configuration and ignore the header. The
allow-list is only genuinely useful in a federation with many issuers, and even there the
right design is a configured map from issuer identifier to JWKS URI, resolved after checking
`iss` against that map — not a URL taken from the header at all.

**★ What is `x5t#S256` and why is Spring Security 7 validating it by default?**
There are two things with that name. As a JOSE *header*, RFC 7515 §4.1.8 defines it as a
base64url SHA-256 thumbprint of a certificate — an identifier for key selection, like `kid`.
As a member of the `cnf` *claim*, RFC 8705 §3.1 defines it as the thumbprint of the client
certificate the token is bound to, which is how mutual-TLS sender-constrained access tokens
work. Spring Security 7's `JwtValidators.createDefault()` includes an
`X509CertificateThumbprintValidator` for the second one; per its javadoc it validates the
claim *"(if available)"*, returning success immediately when there is no `cnf`, so it is inert
for ordinary bearer tokens and becomes active the moment your authorization server starts
issuing bound ones. That is a good default — the enforcement arrives with the feature rather
than needing to be remembered — but it is worth knowing it is there before it produces a 401
nobody configured.

{/* FOOTER */}
