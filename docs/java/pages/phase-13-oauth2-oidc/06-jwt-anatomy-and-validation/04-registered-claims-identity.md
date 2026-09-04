---
title: "iss says which authorization server signed the token and sub says who it is about, and the two mistakes that follow are comparing iss to a string instead of to a key, and treating sub as a globally unique user id"
sidebar_label: "09 · iss and sub"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7519 §4.1 (Registered Claim Names), §4.1.1 (`iss`),
> §4.1.2 (`sub`); RFC 8725 §3.8 (Validate Issuer and Subject); RFC 9068 §2.2 (Data
> Structure), §4 (Validating JWT Access Tokens); Spring Security 7.x `JwtIssuerValidator`,
> `JwtClaimValidator`, `JwtClaimNames`, `JwtIssuerAuthenticationManagerResolver`;
> Spring Security reference *OAuth 2.0 Resource Server JWT* (Multi-tenancy).
> ([rfc7519](https://www.rfc-editor.org/rfc/rfc7519.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt),
> [rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt))
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**RFC 7519 ends every single registered-claim definition with the same four words: *"Use of
this claim is OPTIONAL."* That is not laxity — RFC 7519 defines a container, and it is the
*profile* on top (RFC 9068 for access tokens, OIDC Core for ID tokens) that decides what is
required. The consequence for you is uncomfortable and precise: **the base specification will
not tell you to check anything.** If your resource server does not positively require `iss`
and compare it to a configured constant — and, crucially, to the key that actually verified
the signature — then a valid token from a different issuer is a valid token for you. This
chunk is `iss` and `sub`; the third identity claim, `aud`, is large enough to have its own:
[10 · The audience claim](04b-the-audience-claim.md).**

## `iss` — who signed it

RFC 7519 §4.1.1, in full:

> *"The `'iss'` (issuer) claim identifies the principal that issued the JWT. The processing of
> this claim is generally application specific. The `'iss'` value is a case-sensitive string
> containing a StringOrURI value. Use of this claim is OPTIONAL."*

Three things follow.

**`iss` is a case-sensitive string, compared exactly.** Not "starts with", not "contains", not
"the host matches". `https://idp.example.com` and `https://idp.example.com/` are *different
issuers*. That trailing slash has cost more debugging hours in OIDC than any other character;
the issuer identifier is whatever the authorization server publishes in its metadata, byte for
byte, and you copy it rather than typing it.

**`iss` is not proof of anything by itself.** It is a claim inside the token. What binds it to
reality is that you verified the signature with a key you obtained *because of* the configured
issuer. RFC 8725 §3.8 states the requirement:

> *"When a JWT contains an `'iss'` (issuer) claim, the application MUST validate that the
> cryptographic keys used for the cryptographic operations in the JWT belong to the issuer. If
> they do not, the application MUST reject the JWT."*

Read that carefully: it is not "check that `iss` equals a string". It is "check that the key
that verified this token belongs to the issuer this token names". In a single-issuer resource
server the two collapse, because there is only one key source and it came from the configured
issuer. In a **multi-issuer** deployment they do not collapse, and getting it wrong means
issuer A's key can validate a token claiming to be from issuer B. Multi-tenancy is
[08 · Spring Security as resource server](../08-spring-security-resource-server/README.md); the trap is worth naming
here because it is invisible until you add the second tenant.

**RFC 9068 §4 makes it exact for access tokens:**

> *"The issuer identifier for the authorization server (which is typically obtained during
> discovery) MUST exactly match the value of the `'iss'` claim."*

In Spring, `JwtIssuerValidator` does this. Its javadoc: *"Validates the `'iss'` claim in a
`Jwt`, that is matches a configured value"*, and internally it is a `JwtClaimValidator` whose
predicate calls `issuer.equals(claimValue.toString())` — exact string equality, on the
configured value.

```java
// Spring Boot sets this up for you from issuer-uri; this is what it amounts to.
OAuth2TokenValidator<Jwt> issuer = new JwtIssuerValidator("https://idp.example.com");
```

## `sub` — who the token is about

RFC 7519 §4.1.2, in full:

> *"The `'sub'` (subject) claim identifies the principal that is the subject of the JWT. The
> claims in a JWT are normally statements about the subject. The subject value MUST either be
> scoped to be locally unique in the context of the issuer or be globally unique. The
> processing of this claim is generally application specific. The `'sub'` value is a
> case-sensitive string containing a StringOrURI value. Use of this claim is OPTIONAL."*

The load-bearing sentence is the uniqueness one: **`sub` is unique *in the context of the
issuer*, not globally.** Therefore:

🔴 **The primary key for a user in your database is the pair `(iss, sub)`, never `sub`
alone.** The moment you add a second identity provider — an acquisition, a B2B tenant, a
migration from one IdP to another — `sub` values from different issuers can collide, and a
collision is one user seeing another user's data. Store both, index both, compare both.

The other rules about `sub` that get broken:

- **`sub` is opaque.** It is *not* an email address, not a username, not something to display.
  Some IdPs make it look like an email; that is a coincidence of that IdP's implementation and
  it can change. **07 · OpenID Connect** *(not written yet)* owns the full "`sub` is not an
  email" argument, including why `email` is mutable and unsuitable as a key.
- **`sub` is stable for the life of the account at that issuer**, and that is the only
  guarantee you get. If the user changes their email, `sub` does not change. If the tenant
  migrates IdP, `sub` does change — which is why the migration is painful and why storing
  `(iss, sub)` at least makes it *possible*.
- **A client-credentials token's `sub` is the client, not a person.** RFC 9068 §2.2 makes
  `sub` REQUIRED and notes that in the client-credentials case the subject is typically the
  client itself. Code that assumes `sub` resolves to a row in your `users` table will throw or,
  worse, auto-create a phantom user. [04 · Client credentials](../04-client-credentials/README.md) owns that
  flow.

In Spring, `jwt.getSubject()` reads it; `JwtClaimNames.SUB` is the constant.

## The multi-issuer trap, stated once

In a single-issuer resource server, "check `iss` equals the configured string" and "check the
key belongs to the issuer" are the same check, because there is exactly one JWK source and it
was derived from the configured issuer. **They stop being the same check the moment you accept
two issuers**, and the failure is silent:

```java
// ❌ The shape that breaks. One decoder, both JWK sets merged;
//    iss checked separately against an allow-list.
NimbusJwtDecoder decoder = /* JWK source combining tenant-a and tenant-b keys */;
decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
        new JwtTimestampValidator(),
        new JwtClaimValidator<String>(JwtClaimNames.ISS,
                iss -> ISSUERS.contains(iss))));   // ← independent of which key verified
```

A token signed with tenant A's key, carrying `"iss": "https://tenant-b.example.com"`, passes
both checks. RFC 8725 §3.8 is the requirement that forbids this:

> *"When a JWT contains an `'iss'` (issuer) claim, the application MUST validate that the
> cryptographic keys used for the cryptographic operations in the JWT belong to the issuer. If
> they do not, the application MUST reject the JWT."*

The correct shape is **one decoder per issuer**, selected by the (still unverified) `iss`
value, with each decoder holding only that issuer's keys and its own `JwtIssuerValidator`:

```java
// ✅ Spring's own multi-tenant resolver. One AuthenticationManager per issuer,
//    each with its own decoder, its own JWK source and its own issuer validator.
JwtIssuerAuthenticationManagerResolver resolver =
        JwtIssuerAuthenticationManagerResolver.fromTrustedIssuers(
                "https://tenant-a.example.com",
                "https://tenant-b.example.com");
```

Reading `iss` before verification to *route* is safe here precisely because the route cannot
introduce a key: every branch ends at a JWK set you configured, and the post-verification
`JwtIssuerValidator` re-checks that the token's `iss` matches the branch it took. The full
wiring — including why `fromTrustedIssuers` and not a `Map` you build yourself — is
[08 · Spring Security as resource server](../08-spring-security-resource-server/README.md).

## Gotchas

**★ Every registered claim in RFC 7519 is OPTIONAL, including `iss`.**
The base specification defines a container, not a policy. A validator that only checks claims
*that are present* passes a token with no `iss` at all. Require it explicitly; RFC 9068 §2.2
makes it REQUIRED for access tokens, and RFC 9068 §4 requires that it *"MUST exactly match"*
the authorization server's issuer identifier.

**★ A trailing slash makes `iss` a different issuer.**
`https://idp.example.com` ≠ `https://idp.example.com/`. `JwtIssuerValidator` compares with
`equals` on the configured value. Copy the string from the AS's
`/.well-known/openid-configuration` document rather than typing it, and never "normalise" it.

**★ Checking `iss` as a string is not the same as checking the key belongs to the issuer.**
RFC 8725 §3.8 requires the second. In a single-issuer service they coincide; the moment you
support two issuers with two JWK sets in one decoder, a token claiming issuer B can be
validated by issuer A's key. One decoder per issuer is the fix, not a longer allow-list.

**★ `sub` is unique only within an issuer.**
RFC 7519 §4.1.2: *"MUST either be scoped to be locally unique in the context of the issuer or
be globally unique."* Key users on `(iss, sub)`. A single-IdP system where this cannot bite
today becomes a two-IdP system the week after an acquisition, and the symptom is one user
seeing another's data.

**★ `sub` is not an email and must not be displayed.**
It is an opaque, issuer-scoped identifier. Some IdPs make it look like an email, which teaches
a generation of developers the wrong lesson; that mapping is not guaranteed and can change
under you. **07 · OpenID Connect** *(not written yet)* owns the full argument.

**★ A client-credentials token's `sub` is a client, not a person.**
Code that looks `sub` up in a `users` table either throws or silently auto-creates a phantom
user with machine-level privileges. Branch on the presence of `client_id`, or on a scope, and
decide deliberately.

**★ `sub` may be absent, and Spring will hand you `null`.**
`jwt.getSubject()` returns `null` rather than throwing. RFC 9068 §2.2 makes `sub` REQUIRED for
access tokens, but nothing in `JwtValidators.createDefault()` enforces it — only
`createAtJwtValidator()` does, via `require(JwtClaimNames.SUB)`. If your code uses `sub` as a
map key or a database key, a `null` becomes a shared "anonymous" row.

**★ `iss` is a *StringOrURI*, so it need not be a URL.**
RFC 7519 §4.1.1 only requires URI validity if the value contains a `:`. OIDC constrains it
further (an `https` URL with no query or fragment), but a plain OAuth2 AS may use an opaque
string. Do not write code that parses `iss` as a `URI` unconditionally.

**★ Deriving anything about the user from the *shape* of `sub` is a coupling you will regret.**
`sub` values that look like UUIDs, or like `auth0|abc123`, or like emails, are implementation
details of that IdP. Parsing them — splitting on `|`, extracting a tenant prefix — breaks on
the next IdP version and is invisible until it does.

## Interview questions

**★ Why is `(iss, sub)` the right database key rather than `sub`?**
Because RFC 7519 §4.1.2 only guarantees that `sub` is unique *within the issuer's context* —
*"scoped to be locally unique in the context of the issuer or be globally unique."* Most
issuers pick locally unique, typically a database id or a UUID from their own store. So two
identity providers can and eventually will mint the same `sub` for two different humans. In a
single-IdP system nothing goes wrong, which is exactly why the mistake ships; it detonates when
a second IdP arrives via an acquisition, a B2B tenant or a migration, and the symptom is one
user reading another's data. Storing and comparing both values costs one column and makes the
eventual multi-IdP migration merely difficult rather than impossible.

**★ Your service accepts tokens from two identity providers. What is the subtle bug?**
That validating the `iss` *string* is not the same as validating that the key which verified
the token belongs to that issuer. If your decoder pulls candidate keys from both JWK sets and
then separately checks `iss` against an allow-list of two values, a token signed by issuer A's
key but claiming `iss` of issuer B passes both checks independently. RFC 8725 §3.8 requires the
joint condition: *"the application MUST validate that the cryptographic keys used for the
cryptographic operations in the JWT belong to the issuer."* The implementation is one decoder
per issuer, selected by the `iss` value *before* verification and then re-checked after — which
is exactly what Spring's `JwtIssuerAuthenticationManagerResolver` does, and why merging JWK
sets is the wrong instinct.

**★ Is `iss` allowed to be something other than a URL?**
Yes. RFC 7519 §4.1.1 says the value is a *StringOrURI*, which means it may be any string, and
only if it contains a `:` must it be a valid URI. In practice OIDC constrains it much harder —
the issuer identifier must be an `https` URL with no query or fragment — but a plain OAuth2
authorization server that is not an OpenID Provider may legitimately use an opaque string. The
operational rule is unaffected: whatever the value is, you compare it byte for byte with the
one you configured, and you obtain the configured value from the AS's own metadata rather than
from a wiki page or a colleague's memory.

**★ A user changes their email address at the identity provider. What must not change in your
system?**
Their identity. `sub` is stable for the life of the account at that issuer and is precisely the
claim designed to survive attribute changes — email, name, phone number are all mutable and
none of them is an identifier. If your `users` table is keyed on email, that change either
creates a duplicate account or, if you "helpfully" match on the new email, merges two people.
The rule is: key on `(iss, sub)`, treat every other claim as a mutable attribute to be
refreshed, and never write a query that joins on `email`.

**★ How do you decide, at request time, that a token is from a machine rather than a human?**
Not from `sub`, which is populated in both cases — for a client-credentials token the subject
is typically the client itself. RFC 9068 §2.2 makes `client_id` a REQUIRED claim, so its
presence together with the absence of user-identity claims (`auth_time`, `acr`, `amr`, or an
`email`/`name` in your profile) is the signal. Better still is to decide it at the
authorization server: issue machine tokens with a distinct scope or a distinct audience, and
let the resource server branch on that rather than on heuristics over identity claims. The
version of this that goes wrong in production is a service that assumes every `sub` resolves to
a user row and auto-provisions one when it does not — you end up with a "user" that has the
machine's privileges and no owner.

---

← [The dangerous headers](03e-the-dangerous-headers.md) · [Topic index](README.md) · Next → [The audience claim](04b-the-audience-claim.md)
