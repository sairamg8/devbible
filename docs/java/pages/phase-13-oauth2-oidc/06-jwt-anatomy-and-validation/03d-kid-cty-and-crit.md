---
title: "kid is a hint and not a lookup key you may dereference, cty means the payload is another JWT, and crit is the fail-closed extension point that a verifier must honour by rejecting what it does not understand"
sidebar_label: "07 · kid, cty and crit"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7515 §4.1.4 (`kid`), §4.1.10 (`cty`), §4.1.11 (`crit`),
> §5.2 (Message Signature or MAC Validation), §6 (Key Identification), §10.7;
> RFC 7519 §5.2 (`cty`), §7.2 (Validating a JWT); RFC 7517 §4.2 (`use`), §4.4 (`alg`),
> §4.5 (`kid`); RFC 8725 §2.9 (Indirect Attacks on the Server), §3.10 (Do Not Trust
> Received Claims); Spring Security 7.x `JoseHeaderNames`, `Jwt` javadocs.
> ([rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc7517](https://www.rfc-editor.org/rfc/rfc7517.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Three header parameters that are individually small and collectively responsible for a
disproportionate share of JWT incidents. `kid` looks like a lookup key and is treated as one,
which is how path traversal and SQL injection got into a cryptographic protocol. `cty` means
the payload is not what you think it is. `crit` is the only mechanism in JOSE that makes a
verifier fail *closed* on something it does not understand — and a verifier that logs and
ignores it has converted a security feature into a no-op.**

## `kid` — a hint, and only a hint

RFC 7515 §4.1.4, in full:

> *"The `'kid'` (key ID) Header Parameter is a hint indicating which key was used to secure
> the JWS. This parameter allows originators to explicitly signal a change of key to
> recipients. The structure of the `'kid'` value is unspecified. Its value MUST be a
> case-sensitive string. Use of this Header Parameter is OPTIONAL."*
> … *"When used with a JWK, the `'kid'` value is used to match a JWK `'kid'` parameter
> value."*

Four load-bearing words: **hint**, **unspecified**, **case-sensitive**, **OPTIONAL**.

- **Hint.** It tells you which key the *producer says* it used. It is not authoritative,
  because it is not verified until after you have already chosen a key.
- **Unspecified structure.** A `kid` may be a UUID, a date, a base64url thumbprint (RFC 7638
  defines a canonical one), an opaque vendor string, or — because nothing forbids it —
  `../../../../etc/passwd`. The specification imposes no grammar, which means **your
  validation must**.
- **Case-sensitive.** Comparisons are exact. Do not lowercase, do not trim.
- **Optional.** A single-key issuer may omit it entirely, and your selector must cope.

The only legitimate use of `kid` in a verifier is: **as an equality filter over a set of keys
you already trust.** Not as a filename. Not as a database key you concatenate into SQL. Not
as a URL. RFC 8725 §2.9 names the general problem:

> *"Various JWT claims are used by the recipient to perform lookup operations … Any of these
> claims can be used by an attacker as vectors for injection attacks or server-side request
> forgery (SSRF) attacks."*

and §3.10 states the rule:

> *"Applications should ensure that this does not create SQL or LDAP injection vulnerabilities
> by validating and/or sanitizing the received value."*

The concrete exploits — `kid` path traversal, `kid` SQL injection, `kid` command injection —
are worked through in **11c · Header injection attacks** *(not written yet)*. The
rule to carry from here: **a `kid` you cannot find in your cached JWK set is a rejection, not
a prompt to go looking somewhere else.**

## `kid` is not guaranteed unique

RFC 7517 §4.5, the producer-side rule:

> *"When `'kid'` values are used within a JWK Set, different keys within the JWK Set SHOULD
> use distinct `'kid'` values."*

with the exception spelled out:

> *"(One example in which different keys might use the same `'kid'` value is if they have
> different `'kty'` (key type) values but are considered to be equivalent alternatives by the
> application using them.)"*

SHOULD, not MUST. So a correct selector filters on `kid` **and** the key type implied by the
header's `alg`, **and** the key's own `alg` (RFC 7517 §4.4) and `use` (§4.2) members when
present, and tries every survivor. That is what Nimbus's `JWSVerificationKeySelector` does,
which is one reason not to hand-roll it. **08b · kid lookup** *(not written yet)* is the whole
algorithm.

## `cty` — the payload is another JWT

RFC 7515 §4.1.10:

> *"The `'cty'` (content type) Header Parameter is used by JWS applications to declare the
> media type [IANA.MediaTypes] of the secured content (the payload)."*

RFC 7519 §5.2 narrows it for JWTs:

> *"In the normal case in which nested signing or encryption operations are not employed, the
> use of this Header Parameter is NOT RECOMMENDED. In the case that nested signing or
> encryption is employed, this Header Parameter MUST be present; in this case, the value MUST
> be `'JWT'`, to indicate that a Nested JWT is carried in this JWT."*

RFC 7519 §7.2 makes checking it a numbered validation step, between validating the JWS and
parsing the claims. The reason is simple and easy to get wrong: **when `cty` is `JWT`, the
payload segment is a complete JWT, not a claims set.** Parsing it as claims yields either an
exception or, worse, a `Map` with one weird key.

You will meet nested JWTs when someone signs and then encrypts — RFC 7519 §11.2's
recommended order — producing a JWE whose plaintext is a JWS. In mainstream OAuth2 and OIDC
deployments this is rare. If you find yourself needing it in a resource server, the prior
question is whether the resource server should be holding a decryption key at all.

Two operational notes:

- A `cty` on a token that is *not* nested is something RFC 7519 says is NOT RECOMMENDED. Some
  issuers emit `cty: JWT` unconditionally. It is not an attack, but it is a signal that the
  issuer is not careful, and a strict verifier following §7.2 will try to treat the payload as
  a nested JWT and fail.
- `NimbusJwtDecoder` targets signed JWTs; nested JWE requires configuring Nimbus directly
  through `jwtProcessorCustomizer`.

## `crit` — fail-closed, or pointless

RFC 7515 §4.1.11:

> *"The `'crit'` (critical) Header Parameter indicates that extensions to this specification
> and/or [JWA] are being used that MUST be understood and processed. Its value is an array
> listing the Header Parameter names present in the JOSE Header that use those extensions. If
> any of the listed extension Header Parameters are not understood and supported by the
> recipient, then the JWS is invalid."*
> … *"Producers MUST NOT include Header Parameter names defined by this specification or
> [JWA] for use with JWS, duplicate names, or names that do not occur as Header Parameter
> names within the JOSE Header in the `'crit'` list."*
> … *"This Header Parameter MUST be integrity protected; therefore, it MUST occur only within
> the JWS Protected Header."*

RFC 7515 §5.2 step 5 makes honouring it part of validation: the recipient must verify that it
understands and can process all fields required by the `crit` list, and reject otherwise.

The design intent is worth stating because it explains the asymmetry: **JOSE ignores header
parameters it does not recognise.** That is deliberate — it lets the format evolve. But it is
lethal for security-relevant extensions: a producer adding, say, a header that scopes the
token to a particular request could have that header silently ignored by an older recipient,
which would then accept a token in a context the producer meant to forbid. `crit` inverts the
default for exactly the parameters that matter.

Where you will meet it in practice:

- **DPoP proofs** and other sender-constraining mechanisms.
- **Financial-grade / eIDAS profiles** that add signing-time or certificate-policy headers.
- **Nowhere at all** in a plain OAuth2 access token — which is why a `crit` header arriving at
  your resource server is worth an alert, not just a rejection.

The Nimbus processor behind `NimbusJwtDecoder` rejects unrecognised critical headers, because
that is what RFC 7515 requires. You have to go out of your way — via
`jwtProcessorCustomizer` and a deferred-critical-headers configuration — to make it not.
Do not.

## Reading the headers afterwards

Once validation succeeds the headers are on the `Jwt`, and they are safe to read **because
they have been verified**:

```java
@GetMapping("/whoami")
Map<String, Object> whoami(@AuthenticationPrincipal Jwt jwt) {
    return Map.of(
        "alg", jwt.getHeaders().get(JoseHeaderNames.ALG),
        "kid", jwt.getHeaders().get(JoseHeaderNames.KID),
        "typ", jwt.getHeaders().get(JoseHeaderNames.TYP),
        "sub", jwt.getSubject());
}
```

`org.springframework.security.oauth2.jwt.JoseHeaderNames` holds the constants: `ALG`, `JKU`,
`JWK`, `KID`, `X5U`, `X5C`, `X5T`, `X5T_S256`, `TYP`, `CTY`, `CRIT`.

**Logging the verified `kid` is genuinely valuable.** It is how you discover, three weeks
after a rotation, that a fifth of your traffic is still signed by the old key because one
service pinned a stale JWKS cache. A counter keyed on `kid` costs nothing and turns
**09 · Key rotation** *(not written yet)* from a hope into an observation.

## Gotchas

**★ `kid` is optional, so a verifier that requires it breaks on single-key issuers.**
Some authorization servers publish a one-key JWK set and omit `kid` entirely. The selector
must fall back to trying every candidate key of the right type and algorithm — which Nimbus's
`JWSVerificationKeySelector` does and a hand-rolled `keys.get(kid)` does not.

**★ `kid` is not guaranteed unique within a JWK set.**
RFC 7517 §4.5 makes distinct values a SHOULD and explicitly allows the same `kid` on keys with
different `kty`. Filter by key type and algorithm as well, or you will select an EC key to
verify an RS256 signature and get a failure that reads like a corrupt token.

**★ `kid` has no defined structure, so anything you do with it beyond equality is your
liability.**
Interpolating it into a path, a SQL string, a URL or a shell command is the entire class of
attacks in **11c** *(not written yet)*. If you must log it, log it length-limited
and escaped — a `kid` containing a newline will forge log lines.

**★ Comparing `kid` case-insensitively contradicts RFC 7515 §4.1.4.**
The value *"MUST be a case-sensitive string."* Normalising case invents matches the producer
did not intend and, in a multi-tenant key store, can select another tenant's key.

**★ `cty: JWT` means the payload is not a claims set.**
Parsing it as claims produces garbage or an exception. RFC 7519 §7.2 makes checking `cty` an
explicit validation step precisely so this is not discovered by accident downstream.

**★ An issuer emitting `cty: JWT` on a non-nested token is doing something RFC 7519 says is
NOT RECOMMENDED.**
It will make strict verifiers attempt a nested-JWT parse and fail. If you see it, the fix is
at the issuer, not a workaround in the verifier.

**★ `crit` must cause rejection when unrecognised, not be logged and ignored.**
The whole point of the parameter is fail-closed extension. A verifier that skips unknown
`crit` entries has converted a security mechanism into a no-op — and an attacker who can
influence headers can then use `crit` to hide behaviour from a monitoring layer that *does*
inspect headers.

**★ Producers must not list standard header names in `crit`.**
RFC 7515 §4.1.11 forbids listing names defined by JWS/JWA, duplicates, or names not actually
present in the header. If you mint tokens, do not put `alg` or `kid` in `crit` "for safety" —
you make the token invalid.

**★ `crit` on an ordinary OAuth2 access token is an anomaly worth alerting on.**
Plain bearer tokens do not use it. Its unexpected appearance means either your AS changed
profile without telling you, or someone is probing your verifier's `crit` handling.

**★ Reading headers off an unverified token in a filter or gateway is the same mistake as
reading claims off one.**
Routing by `kid` or `iss` before verification is sometimes necessary — multi-tenant issuer
resolution is the legitimate case — but nothing about the routing decision may grant access,
and the route chosen must not be able to introduce a key you did not already trust.
Multi-tenancy is [08 · Spring Security as resource server](../08-spring-security-resource-server/README.md).

## Interview questions

**★ Is `kid` trustworthy?**
It is untrustworthy before verification and trustworthy after it, and the more useful framing
is that it is never *authoritative* at all — RFC 7515 §4.1.4 calls it *"a hint"*. Before
verification it is an attacker-controlled string of unspecified structure, so it may be used
only as an equality filter into an already-trusted set, with no interpolation into a path, a
URL, a query or a command. After verification it tells you which of the issuer's keys signed
the token, which is genuinely useful: log it, count it, and alert when a key you retired is
still in use.

**★ Why can a JWK set legitimately contain two keys with the same `kid`?**
RFC 7517 §4.5 makes distinct `kid` values a SHOULD rather than a MUST, and gives the case:
keys with different `kty` that are *"considered to be equivalent alternatives"* — for example
an RSA key and an EC key offered for the same logical purpose during a migration. The
consequence for a verifier is that `kid` alone is an insufficient selector. You filter
additionally on the key type implied by the header's `alg`, on the key's own `alg` and `use`
members if present, and if more than one candidate survives you attempt verification with
each. A `Map<String, Key>` keyed by `kid` cannot express any of that, which is why the
"obvious" implementation is the wrong one.

**★ What does `crit` do, and why does it exist given that JOSE already ignores unknown
headers?**
Ignoring unknown headers is what makes the format extensible, and it is exactly wrong for a
security-relevant extension: an older recipient would silently drop a constraint the producer
intended to impose. `crit` inverts that default for a named list of parameters — RFC 7515
§4.1.11 says that if any listed parameter is not understood, *"the JWS is invalid."* It is
the fail-closed escape hatch. RFC 7515 §5.2 step 5 makes honouring it part of validation, and
§4.1.11 constrains producers too: they must not list standard parameter names, duplicates, or
names that are not actually present, and it must appear only in the protected header so that
it is integrity-protected.

**★ You are asked to build a JWKS cache. What is the data structure?**
Not `Map<String, Key>`. You need the full JWK objects, because selection depends on `kty`,
`alg`, `use` and `crv` as well as `kid`, and because `kid` may be absent or duplicated. The
right shape is the JWK Set itself plus a selector function that takes the header's `alg` and
optional `kid` and returns a *list* of candidate keys, ordered but not assumed unique. That is
literally what Nimbus's `JWKSource` and `JWSVerificationKeySelector` are, which is the
argument for using them. If you build your own, the properties to preserve are: absent `kid`
returns all type-compatible keys; a `kid` miss returns empty (and triggers a bounded refresh,
not an unbounded one); and no candidate is ever returned whose `use` or `alg` contradicts the
requested operation.

**★ What is a nested JWT and how would you notice you had one?**
A JWT whose payload is itself a complete JWT — the result of signing and then encrypting, the
order RFC 7519 §11.2 recommends when you need both. You notice by the `cty` header: RFC 7519
§5.2 says that when nesting is employed the parameter MUST be present with the value `JWT`,
and §7.2 makes checking it a distinct validation step. Structurally you would also notice the
five-segment JWE compact serialization on the outside. In OAuth2 resource servers this is
rare, and the design question it should raise is why the resource server holds a decryption
key — usually the answer is that it should not, and the sensitive data should not have been
in the token.

---

← [The Spring 7 typ collision](03c-the-spring-7-typ-collision.md) · [Topic index](README.md) · Next → [The dangerous headers](03e-the-dangerous-headers.md)
