---
title: "Spring Security 7 moved typ validation out of Nimbus and into the default validator chain, where it now rejects exactly the token RFC 9068 requires an authorization server to issue — a two-line fix behind a mystifying 401"
sidebar_label: "06 · The Spring 7 typ collision"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against Spring Security 7.0.x sources
> `NimbusJwtDecoder.JwkSetUriJwtDecoderBuilder` (`typeVerifier`, `NO_TYPE_VERIFIER`,
> `JWT_TYPE_VERIFIER`, `validateType`), `JwtValidators` (`createDefault`,
> `createDefaultWithIssuer`, `createDefaultWithValidators`, `AtJwtBuilder`),
> `JwtTypeValidator`; the Spring Security *OAuth 2.0 Changes* migration guide,
> section "Validate `typ` Header with `JwtTypeValidator`";
> [spring-security#19115](https://github.com/spring-projects/spring-security/issues/19115);
> RFC 9068 §2.1, §4; RFC 8725 §3.11.
> ([migration guide](https://docs.spring.io/spring-security/reference/6.5/migration-7/oauth2.html),
> [JwtValidators javadoc](https://docs.spring.io/spring-security/site/docs/current/api/org/springframework/security/oauth2/jwt/JwtValidators.html),
> [rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt))
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**This is a real behaviour change between Spring Security 6 and 7, it produces a 401 on the
day you upgrade against an authorization server that did not change, and the error message
mentions a header nobody was thinking about. The mechanism is worth knowing precisely,
because the obvious fix — deleting the type check — is a security regression, and the correct
fix depends on an undocumented detail of how `createDefaultWithValidators` merges lists.**

## What 6.x did

Nimbus performed `typ` verification inside the JWT processor. Spring Security 6.5 added the
builder method `validateType(boolean)` to toggle Nimbus's `JOSEObjectTypeVerifier`, and its
6.5 javadoc read:

> *"Whether to use Nimbus's `typ` header verification. This is `true` by default, however it
> may change to `false` in a future major release. By turning off this feature,
> `NimbusJwtDecoder` expects applications to check the `typ` header themselves in order to
> determine what kind of validation is needed."*

So in 6.x the check existed, lived in Nimbus, and accepted `JWT` or an absent `typ` — Nimbus's
`DefaultJOSEObjectTypeVerifier(JOSEObjectType.JWT, null)`, where the `null` is what permits
absence.

## What 7.x does

The check moved out of Nimbus and into Spring's own validator chain — *"This brings it in
line with `NimbusJwtDecoder` validating claims instead of relying on Nimbus to validate
them"*, says the migration guide. In the 7.0.x source the two verifiers are:

```java
private static final JOSEObjectTypeVerifier<SecurityContext> JWT_TYPE_VERIFIER = new DefaultJOSEObjectTypeVerifier<>(
        JOSEObjectType.JWT, null);

private static final JOSEObjectTypeVerifier<SecurityContext> NO_TYPE_VERIFIER = (header, context) -> {
};
```

and the builder field now starts at the *no-op*:

```java
private JOSEObjectTypeVerifier<SecurityContext> typeVerifier = NO_TYPE_VERIFIER;
```

with the javadoc updated to *"Whether to use Nimbus's `typ` header verification. This is
`false` by default."* The check has not disappeared, though — it reappears in the default
validator:

```java
public static OAuth2TokenValidator<Jwt> createDefault() {
    return new DelegatingOAuth2TokenValidator<>(Arrays.asList(JwtTypeValidator.jwt(), new JwtTimestampValidator(),
            new X509CertificateThumbprintValidator(
                    X509CertificateThumbprintValidator.DEFAULT_X509_CERTIFICATE_SUPPLIER)));
}
```

`JwtTypeValidator.jwt()` — per its javadoc — *"Require[s] that the `typ` header be `JWT` or
absent"*. The validator compares with `equalsIgnoreCase`, and its `allowEmpty` flag (default
`false`) is what the `jwt()` factory flips on to permit an absent header.

## The collision

RFC 9068 §2.1 says a JWT access token **MUST** carry `at+jwt`. Spring Security 7's default
validator accepts only `JWT` or nothing. Therefore:

**A fully conformant RFC 9068 access token fails the Spring Security 7 defaults.**

Keycloak's `typ: Bearer` fails too. The migration guide's own note explains the reasoning:

> *"Note the default value verifies that the `typ` value either be `JWT` or not present, which
> is the same as the Nimbus default. It is also aligned with RFC 7515 which states that `typ`
> is optional."*

Both halves are true; the result still contradicts RFC 9068, and the tension is tracked in
[spring-security#19115](https://github.com/spring-projects/spring-security/issues/19115),
which reports three things worth knowing:

1. The migration guide's snippet spells the builder method **`validateTypes(false)`**; the
   7.0.x source declares **`validateType(boolean)`**. Copying the guide will not compile.
2. `JwtValidators.createDefaultWithIssuer(location)` — the method the guide recommends —
   composes `JwtTypeValidator.jwt()` and therefore rejects `at+jwt`.
3. `JwtValidators.createAtJwtValidator()` does accept `at+jwt`, but its builder *"mandates a
   `.clientId()` call, throwing 'client_id must be validated' at startup"*, which is awkward
   for a resource server that has no business caring which client obtained the token.

The issue was open and without a documented maintainer resolution when this page was written;
treat the workaround below as the working answer rather than as an official one.

⚠️ One point I could **not** settle from the sources: the javadoc rendered at
`docs.spring.io/spring-security/site/docs/current/api/` still shows the 6.5 wording
(*"This is `true` by default"*), while the `7.0.x` branch source shows `false`. The
`7.0.x` source is what ships in Spring Security 7 and is what this page follows. If you are
on a specific patch release, read the source for that tag before relying on the default.

## The fix

Build the validator explicitly and supply your own `JwtTypeValidator`:

```java
@Bean
JwtDecoder jwtDecoder(
        @Value("${app.issuer}") String issuer,
        @Value("${app.audience}") String audience) {

    NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuer).build();

    decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
            new JwtIssuerValidator(issuer),
            new JwtTypeValidator("at+jwt", "application/at+jwt"),   // RFC 9068 §4
            new JwtAudienceValidator(audience)));                   // RFC 8725 §3.9

    return decoder;
}
```

The merge behaviour is the part you need to know, and it is only visible in the source.
`createDefaultWithValidators` adds each standard validator **only if the supplied list does
not already contain one of that type**:

```java
JwtTypeValidator typeValidator = CollectionUtils.findValueOfType(tokenValidators, JwtTypeValidator.class);
if (typeValidator == null) {
    tokenValidators.add(0, JwtTypeValidator.jwt());
}
```

So supplying your own `JwtTypeValidator` **replaces** the default rather than stacking a
second, contradictory check next to it. The same pattern applies to `JwtTimestampValidator`
and `X509CertificateThumbprintValidator`: supply one and yours wins; supply none and the
default is inserted at position 0. That merge rule is what makes the fix two lines instead of
a hand-built `DelegatingOAuth2TokenValidator`.

## The purpose-built alternative

`JwtValidators.createAtJwtValidator()` returns an `AtJwtBuilder` (since 6.5) whose javadoc
says it *"needs you to specify at least the `audience`, `issuer`, and `clientId`"*. Its
internal validator map is seeded with exactly RFC 9068's requirements:

```java
JwtTimestampValidator timestamps = new JwtTimestampValidator();
this.validators.put(JoseHeaderNames.TYP, new JwtTypeValidator(List.of("at+jwt", "application/at+jwt")));
this.validators.put(JwtClaimNames.EXP, require(JwtClaimNames.EXP).and(timestamps));
this.validators.put(JwtClaimNames.SUB, require(JwtClaimNames.SUB));
this.validators.put(JwtClaimNames.IAT, require(JwtClaimNames.IAT).and(timestamps));
this.validators.put(JwtClaimNames.JTI, require(JwtClaimNames.JTI));
```

Used as intended:

```java
OAuth2TokenValidator<Jwt> rfc9068 = JwtValidators.createAtJwtValidator()
        .issuer(issuer)
        .audience(audience)
        .clientId(clientId)      // required by the builder — see below
        .build();
```

It is the *most* correct thing in the API — it enforces `sub`, `iat` and `jti` as **required**,
which nothing else does. The friction is `clientId`: RFC 9068 §2.2 does list `client_id` as a
REQUIRED claim, so the builder is following the profile, but a resource server pinning a
single client id only works when exactly one client calls it. If several clients call the same
API, this builder is the wrong tool and the `createDefaultWithValidators` form above is right.
**05 · The RFC 9068 access-token profile** *(not written yet)* and
**12b · The default validator chain** *(not written yet)* go further.

## Gotchas

**★ Spring Security 7's default validator rejects `typ: at+jwt`.**
`JwtValidators.createDefault()` composes `JwtTypeValidator.jwt()`, which accepts only `JWT` or
an absent `typ`. Any authorization server that follows RFC 9068 — which *requires* `at+jwt` —
produces tokens a default-configured resource server rejects with a `JwtValidationException`
naming the `typ` value. Supply your own `JwtTypeValidator`.

**★ `createDefaultWithIssuer` has the same problem, because it delegates to the same merge.**
`createDefaultWithIssuer(issuer)` is literally
`createDefaultWithValidators(new JwtIssuerValidator(issuer))`, and since that list contains no
`JwtTypeValidator`, the default `jwt()` one is inserted. Adding an issuer validator does not
get you out of the type check.

**★ Keycloak's access tokens carry `typ: Bearer`, which also fails the Security 7 default.**
Not `JWT`, not `at+jwt`. Configure a `JwtTypeValidator` for the value your realm actually
emits, or configure the realm to emit `at+jwt`. Do not delete the type validator.

**★ The migration guide's snippet says `validateTypes(false)`; the method is
`validateType(boolean)`.**
Reported in spring-security#19115. Copying the guide gives a compile error, which at least
fails loudly — but it also means the guide has not been exercised against 7.0.x, so read the
rest of it with that in mind.

**★ `validateType(true)` and a custom `JwtTypeValidator` are two different checks and can
contradict each other.**
Turning Nimbus's verifier back on restores the `JWT`-or-absent check *inside the processor*,
before your validator runs. A token with `at+jwt` then fails in Nimbus regardless of what your
validator would have allowed. Leave `validateType` at its default and do all type checking in
the validator chain.

**★ `JwtTypeValidator` compares case-insensitively.**
The 7.0.x source uses `validType.equalsIgnoreCase(typ)`. Convenient when an AS lowercases the
value; not a security property, and not something other stacks replicate.

**★ `JwtTypeValidator` rejects an absent `typ` unless you allow it.**
`allowEmpty` defaults to `false`; only the `jwt()` factory turns it on. `new
JwtTypeValidator("at+jwt")` therefore rejects a token with no `typ` — usually what you want,
but it is a behaviour change if your issuer omits the header. Use `setAllowEmpty(true)`
deliberately.

**★ `createAtJwtValidator()` fails at startup, not at request time, if you omit `clientId`.**
The builder throws with a message about `client_id` needing validation. That is better than a
runtime surprise, but it means the method is unusable for a multi-client API without writing
your own `client_id` validator into the map via `validators(...)`.

**★ Fixing this by calling `setJwtValidator` with only your own validators silently drops the
timestamp check.**
`setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerValidator, typeValidator))`
replaces the whole chain, including `JwtTimestampValidator` — so `exp` stops being checked.
Always go through `createDefaultWithValidators`, which re-inserts the standard validators you
did not supply.

## Interview questions

**★ A team upgrades to Spring Boot 4.1 / Security 7 and every request starts returning 401
with a `typ` error, against an authorization server that did not change. What happened, and
what do you do?**
Security 7 moved `typ` checking out of Nimbus's processor and into the validator chain, and
`JwtValidators.createDefault()` now includes `JwtTypeValidator.jwt()`, which accepts only
`JWT` or no `typ` at all. If the AS emits RFC 9068's `at+jwt`, or a vendor value such as
Keycloak's `Bearer`, the default rejects it. The fix is to build the validator explicitly with
`JwtValidators.createDefaultWithValidators(...)` and supply a `JwtTypeValidator` configured
with the values you actually accept. Because that factory only adds its own type validator
when the supplied list contains none, yours replaces the default rather than fighting it. The
wrong fix is deleting the type check, which reintroduces cross-JWT confusion, and the
second-wrong fix is calling `setJwtValidator` with a hand-built delegating validator, which
silently drops the timestamp check as well.

**★ Why did Spring move the `typ` check from Nimbus into its own validator chain at all?**
Consistency and observability. Everything else Spring validates — `exp`, `nbf`, `iss`, `aud`,
custom claims — goes through `OAuth2TokenValidator<Jwt>` and produces an `OAuth2Error` with a
description you can log and test. The `typ` check living inside Nimbus's processor meant it
failed differently, was configured differently (`jwtProcessorCustomizer`), and could not be
composed with the rest. Moving it makes `JwtTypeValidator` a first-class, replaceable element
of the chain, which is precisely what lets you swap in `at+jwt` in two lines. The cost was a
changed default, which is the incident you are debugging.

**★ How does `createDefaultWithValidators` decide what to add?**
It copies your list, then for each of the three standard validators —
`X509CertificateThumbprintValidator`, `JwtTimestampValidator`, `JwtTypeValidator` — it looks
for an instance of that class in your list with
`CollectionUtils.findValueOfType(...)` and inserts a default at position 0 only if it finds
none. So it is a type-keyed merge, not an append. The practical consequences are: supplying
your own of a given type replaces the default; supplying two of the same type is allowed and
both run (the delegating validator collects errors from all of them); and there is no way to
*remove* a standard validator through this API — if you truly need no timestamp validation,
you must build the `DelegatingOAuth2TokenValidator` yourself and accept that you are on your
own for everything else.

**★ When would you use `createAtJwtValidator()` rather than assembling validators yourself?**
When the API is called by exactly one client and you want the strictest RFC 9068 conformance
available out of the box. It is the only thing in the API that makes `sub`, `iat` and `jti`
*required* rather than merely validated-if-present, which closes several soft spots at once —
notably a token with no `exp`, which `JwtTimestampValidator` allows by default. Its constraint
is that the builder demands a `clientId`, and pinning a single `client_id` is only meaningful
for a single-client API. For a multi-client API, use `createDefaultWithValidators` with an
explicit `JwtTypeValidator`, and if you want the required-claim strictness, add your own
`JwtClaimValidator` instances for `sub`, `iat` and `jti`.

**★ Is the Spring default wrong?**
It is defensible and it is inconvenient. It matches RFC 7515, which makes `typ` optional, and
it matches what Nimbus did before, so it is not a *new* policy so much as a relocated one. But
`NimbusJwtDecoder` is overwhelmingly used as an OAuth2 resource server decoder, and the
governing profile for that role is RFC 9068, which mandates `at+jwt`. A default that rejects
the profile-conformant token for the library's primary use case is a poor default even if
every individual decision behind it was reasonable. The honest summary for a review: not a
vulnerability, a friction, and one you should encode in a test so nobody "fixes" it by
deleting the validator.

---

← [Explicit typing](03b-explicit-typing.md) · [Topic index](README.md) · Next → [kid, cty and crit](03d-kid-cty-and-crit.md)
