---
title: "The JOSE header is attacker-controlled input that a verifier must act on before it has verified anything, and the single rule that makes that survivable is that alg may narrow a choice you already made but never widen it"
sidebar_label: "04 · The header contract and alg"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7515 §4.1 (JOSE Header), §4.1.1 (`alg`), §5.2 (Message
> Signature or MAC Validation), §10.6, §10.7; RFC 7519 §5 (JOSE Header);
> RFC 8725 §2.1 (Weak Signatures and Insufficient Signature Validation),
> §3.1 (Perform Algorithm Verification), §3.2 (Use Appropriate Algorithms);
> RFC 7517 §4.2 (`use`), §4.4 (`alg`); Spring Security 7.0.x source
> `NimbusJwtDecoder` (`defaultAlgorithms`, `jwsKeySelector`, `PublicKeyJwtDecoderBuilder`).
> ([rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt),
> [NimbusJwtDecoder javadoc](https://docs.spring.io/spring-security/site/docs/current/api/org/springframework/security/oauth2/jwt/NimbusJwtDecoder.html))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**The header is the chicken-and-egg problem of JWT validation. It tells you which algorithm
to use and which key to use, and you need both before you can verify the signature that
protects it. So for the duration of one function call, the header is attacker-controlled
input that you must act on. Every safe JOSE implementation resolves this the same way: the
header may *narrow* a choice you have already made, and may never *widen* it. This chunk is
`alg`, which is where the rule was learned. `typ` is [03b](03b-explicit-typing.md); `kid`,
`cty` and `crit` are [03c](03d-kid-cty-and-crit.md); the parameters that make the verifier
go and *fetch* something are [03d](03e-the-dangerous-headers.md).**

## The shape of a header

An illustrative header — this is the *structure*, decoded, not a captured token:

```json
{
  "alg": "RS256",
  "typ": "at+jwt",
  "kid": "2026-08-key-a"
}
```

Three parameters is typical, and two of them are optional by specification. RFC 7515 §4.1.1
makes exactly one mandatory:

> *"The `'alg'` (algorithm) Header Parameter identifies the cryptographic algorithm used to
> secure the JWS. … This Header Parameter MUST be present and MUST be understood and
> processed by implementations."*

Note *"understood and processed"* — not "obeyed". Understanding an `alg` value includes
understanding that you do not accept it.

## The narrow-never-widen rule, stated precisely

Before any cryptographic operation runs, three sets must agree:

1. `alg` ∈ **the set this verifier is configured to accept.** Fixed in code or configuration
   at deployment time; not derived from the token.
2. `alg` ∈ **the set this key may be used with.** Derived from the JWK's `kty`, and narrowed
   further by its optional `alg` (RFC 7517 §4.4) and `use` (§4.2) members.
3. The operation actually performed **is** that algorithm — not "an algorithm chosen by a
   `switch` over the header, with whatever key object was in scope".

RFC 8725 §3.1 states (1) and (3) as requirements on libraries:

> *"Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT
> use any other algorithms when performing cryptographic operations. The library MUST ensure
> that the `'alg'` or `'enc'` header specifies the same algorithm that is used for the
> cryptographic operation."*

RFC 7515 §10.6 states (2) from the signature side:

> *"Implementations MUST ensure that the algorithm information encoded in the signature
> corresponds to that specified with the `'alg'` Header Parameter."*

Point (3) sounds redundant until you read how the vulnerable libraries were written: one
`verify(token, key)` entry point that dispatched on `alg` and accepted whatever `key`
happened to be a `byte[]`. That single design produced both `alg: none`
(**11 · The `none` attack** *(not written yet)*) and RS256→HS256 confusion
(**11b** *(not written yet)*). RFC 8725 §2.1 describes both in one breath:

> *"The algorithm can be changed to `'none'` by an attacker, and some libraries would trust
> this value and 'validate' the JWT without checking any signature."*

> *"An `'RS256'` (RSA, 2048 bit) parameter value can be changed into `'HS256'` (HMAC,
> SHA-256), and some libraries would try to validate the signature using HMAC-SHA256 and
> using the RSA public key as the HMAC shared secret."*

Both are (3) failing: the algorithm named in the header selected the *operation* while the
key stayed the same.

## What Spring actually does

`NimbusJwtDecoder`'s JWK-set builder defaults to a **single** accepted algorithm. From the
7.0.x source:

```java
private Function<JWKSource<SecurityContext>, Set<JWSAlgorithm>> defaultAlgorithms =
        (source) -> Set.of(JWSAlgorithm.RS256);
```

and the key selector that consumes it:

```java
JWSKeySelector<SecurityContext> jwsKeySelector(JWKSource<SecurityContext> jwkSource) {
    if (this.signatureAlgorithms.isEmpty()) {
        return new JWSVerificationKeySelector<>(this.defaultAlgorithms.apply(jwkSource), jwkSource);
    }
    Set<JWSAlgorithm> jwsAlgorithms = new HashSet<>();
    for (SignatureAlgorithm signatureAlgorithm : this.signatureAlgorithms) {
        JWSAlgorithm jwsAlgorithm = JWSAlgorithm.parse(signatureAlgorithm.getName());
        jwsAlgorithms.add(jwsAlgorithm);
    }
    return new JWSVerificationKeySelector<>(jwsAlgorithms, jwkSource);
}
```

So an out-of-the-box `NimbusJwtDecoder.withJwkSetUri(...)` accepts **RS256 and nothing
else**, and the accepted set is passed to the key selector — meaning it constrains key
*selection*, not just a post-hoc check. That is "narrow, never widen" expressed as a
default.

Note also the type of the configuration surface: `SignatureAlgorithm`, a Spring enum whose
values are exactly `RS256`, `RS384`, `RS512`, `ES256`, `ES384`, `ES512`, `PS256`, `PS384`,
`PS512`. There is no `NONE` and no `HS256` in it. You cannot express the vulnerable
configuration through this API at all — the symmetric case has a separate builder,
`withSecretKey`, which is the design decision that matters. **06b · Symmetric vs
asymmetric** *(not written yet)* is why those two are kept apart.

And the single-key builder enforces (2) directly:

```java
Assert.state(JWSAlgorithm.Family.RSA.contains(this.jwsAlgorithm),
    () -> "The provided key is of type RSA; however the signature algorithm is of some other type: "
        + this.jwsAlgorithm + ". Please indicate one of RS256, RS384, or RS512.");
```

An RSA public key may only ever drive an RSA verification, checked at build time, with a
message that tells you what to do.

## `alg` values are case-sensitive strings, not an enum on the wire

The IANA registry values are exact: `RS256`, not `rs256`, not `RSA256`, not `SHA256withRSA`.
A verifier that lowercases before comparing has invented a matching rule the specification
does not have; a verifier that uses `equalsIgnoreCase` on `alg` accepts `NONE`, `None` and
`nOnE` in whatever library still honours the value. Compare exactly, against a fixed set.

The mirror-image bug shows up in *issuers*: a home-grown token minter that writes
`"alg": "HMACSHA256"` because that is the JCA name produces tokens no conforming verifier
accepts. The JOSE name and the JCA name are different namespaces;
**06 · The algorithm table** *(not written yet)* lists both.

## Reading `alg` afterwards, safely

Once validation succeeds, the header is on the `Jwt` object and is safe to read *because it
has been verified*:

```java
@GetMapping("/whoami")
Map<String, Object> whoami(@AuthenticationPrincipal Jwt jwt) {
    return Map.of(
        "alg", jwt.getHeaders().get(JoseHeaderNames.ALG),
        "kid", jwt.getHeaders().get(JoseHeaderNames.KID),
        "sub", jwt.getSubject());
}
```

`org.springframework.security.oauth2.jwt.JoseHeaderNames` holds the constants (`ALG`, `JKU`,
`JWK`, `KID`, `X5U`, `X5C`, `X5T`, `X5T_S256`, `TYP`, `CTY`, `CRIT`). Logging the verified
`alg` and `kid` is genuinely useful — it is how you notice that half your traffic is still
being signed by the key you thought you rotated out three weeks ago.

## Gotchas

**★ Treating `alg` as an instruction rather than as a claim to be checked is the root of two
whole CVE families.**
The header is not trusted until after verification, and verification needs the algorithm.
Resolve it by fixing the acceptable set in configuration and rejecting anything else. RFC
8725 §3.1: *"Libraries MUST enable the caller to specify a supported set of algorithms and
MUST NOT use any other algorithms."*

**★ An `alg` allow-list is necessary but not sufficient — the algorithm must also match the
key.**
RFC 7515 §10.6 requires that *"the algorithm information encoded in the signature corresponds
to that specified with the `'alg'` Header Parameter."* In a verifier that keeps one "key"
variable of type `byte[]`, an HS256 header plus an RSA public key satisfies an allow-list of
`{HS256}` and is still the confusion attack. Bind the algorithm family to the key type.

**★ `NimbusJwtDecoder.withJwkSetUri(...)` accepts only RS256 by default.**
Safe, but it means an authorization server that has moved to ES256 or PS256 produces tokens
your decoder rejects — and the failure surfaces as a key-selection error, not as a legible
"unsupported algorithm". Configure `jwsAlgorithm(...)` explicitly, or use
`discoverJwsAlgorithms()`; see **12d** *(not written yet)*.

**★ `withIssuerLocation` does not use that RS256 default.**
It passes `JwtDecoderProviderConfigurationUtils::getJWSAlgorithms` as the default-algorithm
function, i.e. it takes the set from the authorization server's published metadata. That is
convenient and it means your accepted algorithm set is now controlled by a document you
fetch. If that matters to your threat model, pin the set with `jwsAlgorithm(...)` anyway.

**★ Comparing `alg` case-insensitively invents a rule the specification does not have.**
The registry values are case-sensitive strings. `equalsIgnoreCase` on `alg` is how `None`
gets past a check that was looking for `none`.

**★ A JWK's own `alg` and `use` members further narrow what the key may do, and ignoring them
is a real bug.**
RFC 7517 §4.4 and §4.2 let a publisher say "this key is for RS256 signature verification
only". A selector that matches on `kid` alone can pick an encryption key and try to verify
with it. Nimbus's `JWSVerificationKeySelector` filters on these; a hand-rolled selector
usually does not.

**★ There is no `alg` value that means "whatever the last token used".**
Every token carries its own `alg`, and a rotation from RS256 to ES256 means both are in
flight simultaneously. Your accepted set has to contain both for the duration of the
migration, and then be narrowed again. See **09 · Key rotation** *(not written yet)*.

**★ JOSE algorithm names are not JCA algorithm names.**
`RS256` is `SHA256withRSA` to `java.security.Signature`; `ES256` is `SHA256withECDSAinP1363Format`
(the JOSE encoding is the raw `r||s` concatenation, not the DER form `SHA256withECDSA`
produces). Mixing the two namespaces produces signatures that verify nowhere. Let the library
do the mapping.

## Interview questions

**★ You must read `alg` to verify the signature, but `alg` is inside the unverified header.
How is that not a fatal circularity?**
It is broken by making the header able to narrow but never widen. The verifier starts from a
set of algorithms it is configured to accept — say `{RS256}` — and a set of keys it already
trusts, fetched from a JWKS URL it was configured with over TLS. The header's `alg` is then
checked for *membership* in that set; if it is not a member, the token is rejected without any
cryptographic operation. The same applies to `kid`: it selects among keys already trusted, and
if it matches nothing, rejection. Under that discipline the attacker's control over the header
lets them choose only among options you had already blessed, which is not a capability. Every
one of the classic attacks comes from an implementation that let the header introduce a *new*
option — a new algorithm (`none`, HS256) or a new key (`jwk`, `jku`, `x5u`).

**★ Is it enough to configure an algorithm allow-list of `{RS256}`?**
It is necessary and it is most of the defence, but on its own it does not stop algorithm
confusion in a badly written verifier, because the attack there does not need an algorithm
outside your list — it needs the *key material* to be reinterpreted. What makes the
allow-list sufficient is enforcing it together with RFC 7515 §10.6: an RSA public key may
only ever drive an RSA verification. In Spring you get both halves for free —
`NimbusJwtDecoder.withPublicKey(RSAPublicKey)` asserts
`JWSAlgorithm.Family.RSA.contains(this.jwsAlgorithm)` at build time, and the JWK-set path
passes the accepted algorithms into the *key selector* so a key that cannot do RS256 is never
even a candidate. In a hand-rolled verifier you must write both halves yourself.

**★ Where should the list of accepted algorithms come from — configuration, or the
authorization server's metadata?**
Both are defensible and they trade convenience against pinning. Discovery
(`withIssuerLocation`, or `discoverJwsAlgorithms()`) reads `id_token_signing_alg_values_supported`
and friends from the AS metadata document, so an AS-side rotation from RS256 to PS256 needs no
resource-server change — which is exactly what you want across twenty services. The cost is
that your accepted set is now determined by a document you fetch at runtime; anyone who can
influence that document, including a compromised or misconfigured AS, can widen it. In a
high-assurance service, pin the set explicitly in configuration and accept that a
migration is a deploy. In most services, discovery is the right default and the AS metadata
endpoint is already the root of your trust.

**★ Why does Spring have a separate builder for symmetric keys instead of one builder that
takes a `Key`?**
Because a single entry point that accepts any key and dispatches on `alg` is the exact shape
that produced algorithm confusion. Splitting it into `withJwkSetUri`, `withPublicKey` and
`withSecretKey` means the algorithm family is decided by *which factory method you called* —
a compile-time choice in your source — rather than by a runtime value in the token. The
`SignatureAlgorithm` enum used by the asymmetric builders does not even contain the HMAC
names, so the vulnerable configuration is unrepresentable. That is API design doing security
work, and it is worth copying when you build anything that dispatches on untrusted input.

**★ A token signed with ES256 is rejected by a service that "supports ES256". What do you
check?**
First, whether the accepted-algorithm set actually contains ES256 — a `NimbusJwtDecoder`
built with `withJwkSetUri` and no explicit `jwsAlgorithm` accepts RS256 only, regardless of
what the JWK set contains. Second, whether the JWK set actually publishes the EC key, with
`kty: EC` and the right `crv`, and whether its `alg`/`use` members are consistent. Third,
whether something in the chain is doing a JCA-name conversion by hand — ES256 signatures in
JOSE are the raw `r||s` concatenation, not the DER encoding, and a hand-rolled verifier using
`SHA256withECDSA` will fail on every valid token. The error message tends to be a key
selection failure in all three cases, which is why you check the configuration before you
suspect the token.

{/* FOOTER */}
