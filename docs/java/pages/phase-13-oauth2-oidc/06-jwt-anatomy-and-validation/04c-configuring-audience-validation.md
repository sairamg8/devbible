---
title: "Spring validates the audience only if you tell it to, the one-line property is usually right, and the audience identifier you choose determines whether a compromised service can spend its tokens anywhere else in the estate"
sidebar_label: "11 · Configuring audience validation"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security reference *OAuth 2.0 Resource Server
> JWT* — "Supplying Audiences", "Configuring a Custom `OAuth2TokenValidator`";
> Spring Security 7.0.x sources `JwtValidators.createDefaultWithValidators`,
> `JwtClaimValidator`, `JwtAudienceValidator`, `NimbusJwtDecoder`; RFC 7519 §4.1.3 (`aud`);
> RFC 8725 §3.9 (Use and Validate Audience); RFC 9068 §4 (Validating JWT Access Tokens),
> §5; RFC 8707 (Resource Indicators for OAuth 2.0).
> ([Spring reference](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt),
> [rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt))
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**`JwtValidators.createDefault()` contains a type validator, a timestamp validator and an
X.509 thumbprint validator. It does not contain an audience validator, and `issuer-uri` does
not add one. Every Spring resource server that has not been explicitly configured for
audiences accepts any token that issuer ever minted — for any service, for any client. This
chunk is the two ways to fix that and the design decision hiding underneath: what string you
choose as your service's identifier determines whether an incident is contained to one
service or spreads across the estate.**

## The property

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          audiences: https://orders.example.com
```

The reference states the effect verbatim:

> *"The result will be that if the JWT's `iss` claim is not `idp.example.com`, and its `aud`
> claim does not contain `my-resource-server.example.com` in its list, then validation will
> fail."*

`audiences` is a list, so two values during a migration is a comma-separated property or a
YAML sequence — no code change. That is the reason to prefer the property over a hand-written
validator wherever it suffices: **the accepted audience set is configuration, and it changes
on a config push rather than a release.**

## The Java forms

Purpose-built, present in the 7.x `org.springframework.security.oauth2.jwt` package:

```java
OAuth2TokenValidator<Jwt> audience = new JwtAudienceValidator("https://orders.example.com");
```

Or a claim predicate, which is what you reach for when the rule is more than equality:

```java
OAuth2TokenValidator<Jwt> audience =
        new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                aud -> aud != null && aud.contains("https://orders.example.com"));
```

🔴 The `aud != null` is not defensive padding. `JwtClaimValidator`'s predicate is invoked with
`null` when the claim is absent, and `null.contains(...)` throws an NPE that surfaces as a
**500, not a 401** — turning a security check into an availability incident, and one that an
attacker can trigger at will with a token that simply omits the claim. The Spring reference's
own example is:

```java
OAuth2TokenValidator<Jwt> audienceValidator() {
    return new JwtClaimValidator<List<String>>(AUD, aud -> aud.contains("messaging"));
}
```

which omits the null check. Add it.

The fully explicit form, for when the rule is genuinely custom:

```java
static class AudienceValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error ERROR = new OAuth2Error(
            OAuth2ErrorCodes.INVALID_TOKEN,
            "The required audience is missing",
            "https://datatracker.ietf.org/doc/html/rfc9068#section-4");

    private final String audience;

    AudienceValidator(String audience) {
        this.audience = audience;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        List<String> aud = jwt.getAudience();          // never null; empty list if absent
        return (aud != null && aud.contains(this.audience))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(ERROR);
    }
}
```

Note the error code: `invalid_token` is the RFC 6750 §3.1 code a resource server returns for a
token that *"is expired, revoked, malformed, or invalid for other reasons"*, and it maps to a
401 with a `WWW-Authenticate` header. Using a made-up code produces a technically-valid but
non-standard response; **12c · Custom token validators** *(not written yet)* covers
error shaping properly.

## Wiring it without losing the standard validators

```java
@Bean
JwtDecoder jwtDecoder(@Value("${app.issuer}") String issuer,
                      @Value("${app.audience}") String audience) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuer).build();
    decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
            new JwtIssuerValidator(issuer),
            new JwtAudienceValidator(audience)));
    return decoder;
}
```

🔴 The failure mode to avoid:

```java
// ❌ Silently drops JwtTimestampValidator. exp is now unchecked.
decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
        new JwtIssuerValidator(issuer),
        new JwtAudienceValidator(audience)));
```

`setJwtValidator` **replaces** the whole chain. `createDefaultWithValidators` re-inserts every
standard validator you did not supply — the merge rules are in
[06 · The Spring 7 typ collision](03c-the-spring-7-typ-collision.md). Writing a
`DelegatingOAuth2TokenValidator` by hand is how a service ends up not checking expiry, and
nothing in the build or the tests will notice.

## Choosing audience values

The value is *"generally application specific"* per RFC 7519 §4.1.3, but there is a right
answer: **a stable, globally unique identifier for the service, usually its canonical HTTPS
base URL.**

| Value | Verdict |
|---|---|
| `https://orders.example.com` | ✅ Unique, stable, obviously not another team's |
| `urn:example:orders-api` | ✅ Fine if your AS prefers URNs |
| `orders-api` | ⚠️ Works until two business units both have an "orders API" |
| the client id | ❌ Makes ID tokens and access tokens indistinguishable by audience |
| `internal`, shared by every service | ❌ Audience validation that validates nothing |

The last row deserves its own sentence, because it is proposed in good faith in most
organisations at least once: a single shared audience means every service accepts every other
service's tokens, so a compromise of the least important service yields tokens spendable at the
most important one. RFC 9068 §5 requires the opposite — *"authorization servers MUST use a
distinct identifier as an `'aud'` claim value to uniquely identify access tokens issued by the
same issuer for distinct resources."*

If the objection is "then a client needs three tokens to call three services", that is correct
and it is what RFC 8707 resource indicators are for: the client sends a `resource` parameter to
the token endpoint and receives a token whose `aud` is that resource. Token management belongs
in one library on the client side, not in the audience design.

## Migrating an audience identifier without downtime

Three deploys, and the shape is identical to a key rotation:

1. **Widen the acceptor.** Configure the resource server to accept both the old and the new
   identifier. Deploy everywhere. Confirm with a metric before proceeding.
2. **Switch the issuer.** Change the AS to mint the new identifier. Tokens with the old value
   remain valid until they expire — which is why short access-token lifetimes make this cheap.
3. **Narrow the acceptor.** Once the maximum token lifetime has elapsed since step 2, remove
   the old value.

The overlap window in step 3 must be at least the maximum token lifetime, and you should
*measure* rather than assume:

```java
@Bean
OAuth2TokenValidator<Jwt> audienceMetrics(MeterRegistry registry, JwtDecoder ignored) {
    return jwt -> {
        jwt.getAudience().forEach(a ->
                registry.counter("jwt.audience", "value", a).increment());
        return OAuth2TokenValidatorResult.success();
    };
}
```

An always-succeeding validator used purely for observation is a legitimate pattern — it runs
inside the chain, sees only tokens whose signature already verified, and gives you the one
number step 3 needs. Add it to the list you pass to `createDefaultWithValidators`.

## Gotchas

**★ Spring does not validate `aud` unless you configure it.**
`JwtValidators.createDefault()` has no audience validator, and `issuer-uri` does not add one.
Signature, `exp`, `nbf` and `iss` are checked; audience is not. This is the single most common
"we thought we were secure" finding in a Spring resource server review.

**★ `JwtClaimValidator`'s predicate receives `null` for an absent claim.**
`aud -> aud.contains("x")` throws an NPE, which Spring surfaces as a 500 rather than a 401 —
so a token that simply omits `aud` becomes a denial-of-service primitive. Write
`aud != null && aud.contains("x")`. The reference documentation's own example omits the null
check; do not copy it verbatim.

**★ `setJwtValidator` replaces the entire chain, including the timestamp validator.**
`new DelegatingOAuth2TokenValidator<>(issuer, audience)` silently stops checking `exp`. Always
go through `JwtValidators.createDefaultWithValidators(...)`, which re-inserts the standard
validators you did not supply.

**★ Accepting many audiences "to be safe" inverts the point of the claim.**
Each additional accepted value is another service whose tokens you now honour. The accepted set
should be one value, or two during a migration, and the migration should have an end date and a
metric that tells you when it has passed.

**★ `audiences` is a list property, so a migration is a config change — use that.**
Hardcoding the audience in a `@Bean` turns step 1 and step 3 of the migration into releases. If
you need Java for other reasons, still read the value from configuration.

**★ `Jwt#getAudience()` returns an empty list, not `null`, for an absent claim — but
`jwt.getClaim("aud")` returns `null`.**
Two accessors, two behaviours. The typed accessor is the safe one; the untyped one is where the
NPE comes from.

**★ An audience validator that logs but returns success is not a validator.**
It is a metric. That is a legitimate thing to build — see the migration section — but it must be
named so that nobody reads it as enforcement, and it must not be the only audience-related thing
in the chain.

**★ The error code matters for the response the client sees.**
`OAuth2ErrorCodes.INVALID_TOKEN` produces a 401 with a `WWW-Authenticate: Bearer` challenge, as
RFC 6750 §3.1 defines. An invented code still fails the request but produces a response that
generic OAuth2 clients cannot interpret, which turns "refresh and retry" into "give up".

## Interview questions

**★ A Spring resource server is configured with only `issuer-uri`. What is it actually
checking, and what is it not?**
It checks the signature against keys fetched from the JWKS URI in the issuer's discovery
document; it checks `exp` and `nbf` with a 60-second clock skew; it checks `iss` against the
configured issuer; and on Security 7 it also checks the `typ` header and, if a `cnf` claim is
present, the RFC 8705 certificate thumbprint. It does **not** check `aud`. So any token that
issuer minted — for another service, for another client, an ID token if the type check passes —
is accepted. The fix is one line, `spring.security.oauth2.resourceserver.jwt.audiences`, and
the reason it is not the default is that Spring cannot guess your service's identifier.

**★ Why prefer the `audiences` property over writing a `JwtAudienceValidator` bean?**
Because it makes the accepted set configuration rather than code, and the operation you will
actually perform on it is a migration: accept old and new, switch the issuer, then drop the old.
With the property that is two config pushes; with a hardcoded bean it is two releases across
every service that consumes the token. Write Java when the rule is genuinely conditional — a
different audience per URL path, say — and even then read the values from configuration.

**★ You add an audience validator and now a token with no `aud` returns 500 instead of 401.
Why?**
Because `JwtClaimValidator` invokes your predicate with `null` when the claim is absent, and
`aud.contains(...)` on a `null` throws. The exception escapes the validator, Spring's exception
translation does not recognise it as an authentication failure, and you get a server error. That
is worse than a 401 in three ways: it is the wrong status, it may leak a stack trace, and it is
an attacker-triggerable error path — anyone can send a token without `aud`. Guard with
`aud != null &&`, or use `Jwt#getAudience()` in a full `OAuth2TokenValidator`, which returns an
empty list rather than `null`.

**★ How would you prove that an audience migration is safe to complete?**
By measuring, not by counting hours. Add an always-succeeding validator to the chain that
increments a counter tagged with each audience value it sees on a successfully-verified token.
After switching the authorization server to the new identifier, watch the counter for the old
value fall to zero and stay there for longer than the maximum access-token lifetime. Only then
remove the old value from the accepted set. Without that metric you are relying on the AS's
configured lifetime being the true maximum, which it is not if any client caches tokens, if any
token was issued with an extended lifetime, or if a clock somewhere disagrees.

**★ What is the relationship between audience validation and RFC 8707 resource indicators?**
They are the two halves of the same design. Resource indicators are the *request* side: the
client tells the token endpoint which resource the token is for, via a `resource` parameter, and
the AS mints a token whose `aud` is that resource. Audience validation is the *acceptance* side:
the resource server requires its own identifier in `aud`. Together they give you tokens that are
useful at exactly one service, which is what makes a compromise containable. Without resource
indicators you either get an AS-decided audience list — often "everything this client may reach",
which widens the blast radius — or you get the shared-audience anti-pattern. Without audience
validation the resource indicator is decoration.

---

← [The audience claim](04b-the-audience-claim.md) · [Topic index](README.md) · Next topic → [07 · OpenID Connect](../07-openid-connect/README.md)
