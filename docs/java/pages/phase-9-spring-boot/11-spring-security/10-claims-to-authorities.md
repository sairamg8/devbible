---
title: "Claims to authorities"
sidebar_label: "10 · Claims to authorities"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *OAuth 2.0
> Resource Server JWT*
> (docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html
> — the `SCOPE_` default, `JwtAuthenticationConverter`,
> `JwtGrantedAuthoritiesConverter` with `setAuthoritiesClaimName` and
> `setAuthorityPrefix`, `DelegatingJwtGrantedAuthoritiesConverter`,
> `OAuth2AuthorizationManagers.hasScope`) and *Session Management*
> (docs.spring.io/spring-security/reference/servlet/authentication/session-management.html
> — `SessionCreationPolicy.STATELESS` and `NullSecurityContextRepository`).
> Spring Boot 4.1.1, Spring Security 7.x, JDK 25.

**A verified token is a bag of claims; your authorization rules are written
against `GrantedAuthority` strings. The converter between the two is small,
configurable and — because its default is `SCOPE_` and every codebase's rules
say `hasRole` — is where a working resource server most often denies everybody.**

## The default mapping

By default, the `scope` (or `scp`) claim is split on whitespace and each value
becomes an authority with a **`SCOPE_`** prefix:

```
"scope": "messages contacts"   →   SCOPE_messages, SCOPE_contacts
```

Nothing else is mapped. A `roles` claim, a `groups` claim, a `permissions`
claim: all present in the token, none of them authorities.

This is why `hasRole("ADMIN")` never matches on a fresh resource server —
nothing is producing a `ROLE_` authority for it to find. Three ways forward, and
they are genuinely different decisions rather than three spellings of one.

### 1. Write the rules in terms of scopes

```java
.requestMatchers("/api/orders/**").hasAuthority("SCOPE_orders.read")
```

Honest, and it says exactly what is being checked. It also puts the literal
prefix in your source, which some people find noisy.

### 2. Use the purpose-built manager

```java
import static org.springframework.security.oauth2.core.authorization
        .OAuth2AuthorizationManagers.hasScope;

@Bean
SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/messages/**").access(hasScope("messages"))
            .requestMatchers("/contacts/**").access(hasScope("contacts"))
            .anyRequest().authenticated()
        )
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .build();
}
```

This reads best and expresses the intent — "the token must carry this scope" —
without either the prefix or a converter. `access(...)` is the general form all
the convenience methods sit on top of, from
[chunk 5](05-configuring-the-chain.md).

### 3. Reshape the authorities to match your codebase

If the rest of the application (including [method security](07-method-security.md))
is written with `hasRole`, convert the token's roles claim instead:

```java
@Bean
JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
    authorities.setAuthoritiesClaimName("roles");
    authorities.setAuthorityPrefix("ROLE_");

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authorities);
    return converter;
}
```

Declaring that bean is enough — Boot's resource-server auto-configuration picks
it up.

⚠️ Setting `setAuthoritiesClaimName("roles")` **replaces** the default rather
than adding to it, so scopes stop becoming authorities entirely. If you need
both, say so:

```java
JwtGrantedAuthoritiesConverter scopes = new JwtGrantedAuthoritiesConverter();
// defaults: scope/scp claim, SCOPE_ prefix

JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
roles.setAuthoritiesClaimName("roles");
roles.setAuthorityPrefix("ROLE_");

var converter = new DelegatingJwtGrantedAuthoritiesConverter(scopes, roles);
```

## Scopes and roles are not the same thing

They are routinely conflated and they answer different questions.

- A **scope** is what the *client application* was authorised to do on the
  user's behalf. "This mobile app may read orders."
- A **role** is what the *user* is. "This person is an administrator."

A token can carry a user with `ROLE_ADMIN` and a client with only
`SCOPE_orders.read`, and the correct decision for a write endpoint is **deny**:
the human is entitled, the application acting for them is not. Mapping roles
into the same authority space as scopes flattens that distinction, and rules
written against the flattened set cannot express it any more.

Where the distinction matters, keep both prefixes (the delegating converter
above) and write rules that name both:

```java
.requestMatchers(HttpMethod.POST, "/api/orders/**")
    .access(AuthorizationManagers.allOf(
            AuthorityAuthorizationManager.hasRole("ADMIN"),
            hasScope("orders.write")))
```

## Where the principal comes from

Once converted, the `Authentication` is a `JwtAuthenticationToken` whose
principal is the `Jwt` itself, and whose name comes from the `sub` claim by
default. So a controller can take it directly:

```java
@GetMapping("/api/me")
Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
    return Map.of("sub", jwt.getSubject(), "email", jwt.getClaimAsString("email"));
}
```

`converter.setPrincipalClaimName("preferred_username")` changes which claim
`getName()` returns — worth setting if anything logs or audits the principal
name, because an opaque `sub` in an audit trail is not much use.

## Why `STATELESS` belongs with all of this

`SessionCreationPolicy.STATELESS` installs a `NullSecurityContextRepository`, so
nothing is persisted between requests and every request re-derives its identity
from its own token. It also disables the saved-request machinery, which exists
to replay a request after an interactive login a resource server never performs.

Without it, a resource server will happily create an `HttpSession` per caller.
That defeats the horizontal scaling the token model was chosen for and pins
memory in proportion to traffic — and because it still *works*, nothing tells
you until the memory graph does.

## The trade-off

Mapping claims to authorities lets one set of authorization rules serve every
authentication style: form login and bearer tokens both end up as authority
strings, and `hasRole("ADMIN")` does not care which produced it. That uniformity
is genuinely valuable. What it costs is that **the mapping is a translation
layer nobody reads**. The rule says `ROLE_ADMIN`; whether anyone can ever have
it depends on a converter bean in another file and on a claim the IdP team
controls. When the answer is "denied for everyone", the rule is the last place
the problem actually is.

## Gotchas

**Symptom:** `hasRole("ADMIN")` never matches for any user.
**Cause:** The default converter emits only `SCOPE_`-prefixed authorities.
**Fix:** `hasAuthority("SCOPE_…")`, `access(hasScope("…"))`, or a
`JwtAuthenticationConverter` reading your roles claim with a `ROLE_` prefix.

**Symptom:** After adding a roles converter, scope-based rules stopped matching.
**Cause:** `setAuthoritiesClaimName` replaced the default claim rather than
adding one.
**Fix:** `DelegatingJwtGrantedAuthoritiesConverter` over both converters.

**Symptom:** Authorities are empty although the token clearly has a `roles`
claim.
**Cause:** The claim is nested (`realm_access.roles` in some IdPs) rather than
top level; `JwtGrantedAuthoritiesConverter` reads a top-level claim.
**Fix:** Write a small `Converter<Jwt, Collection<GrantedAuthority>>` that digs
the nested claim out, and set it on the `JwtAuthenticationConverter`.

**Symptom:** A client application can perform actions its user is entitled to
but it was never granted.
**Cause:** Roles and scopes mapped into one flat authority set, so the rule
cannot distinguish "the user may" from "this app may on their behalf".
**Fix:** Keep both prefixes and require both where it matters, as shown above.

**Symptom:** Audit logs record an opaque UUID as the acting user.
**Cause:** `getName()` returns the `sub` claim by default.
**Fix:** `converter.setPrincipalClaimName("preferred_username")` — and keep the
`sub` too, since it is the stable identifier and the username is not.

**Symptom:** `@AuthenticationPrincipal` is `null` in a controller.
**Cause:** The endpoint is `permitAll` and the caller sent no token, so the
principal is the anonymous one — or a custom converter returned a token type the
parameter's declared type does not match.
**Fix:** Declare the parameter as `Jwt` for a resource server, and treat `null`
as "anonymous" rather than an error.

**Symptom:** Memory grows steadily on a "stateless" API.
**Cause:** Sessions are being created — `SessionCreationPolicy` left at
`IF_REQUIRED`.
**Fix:** `STATELESS`, and check that nothing in the request path (error
handling, a stray `HttpSession` parameter) touches the session.

## Interview questions

**★ What does a resource server map to authorities by default?**
The `scope` or `scp` claim, split on whitespace, each value prefixed with
`SCOPE_`. Nothing else — a `roles` or `groups` claim in the token becomes no
authority at all unless you configure a converter.

**★ Why is `hasRole("ADMIN")` useless on a default resource server?**
Because `hasRole` looks for the authority `ROLE_ADMIN`, and the default
converter only ever produces `SCOPE_`-prefixed authorities. There is no
`ROLE_` authority for it to find, so it denies everyone silently.

**★ Scopes versus roles — is the distinction worth preserving?**
Yes. A scope is what the client application was authorised to do on the user's
behalf; a role is what the user is. A token can carry an admin user and a
read-only client, and a write should be denied. Flattening both into one
authority space makes that decision inexpressible.

**★ You add a roles converter and your scope rules break. Why?**
`setAuthoritiesClaimName` replaces the claim the converter reads rather than
adding to it, so scopes are no longer mapped. Use
`DelegatingJwtGrantedAuthoritiesConverter` with one converter for each claim.

**★ The IdP nests roles under `realm_access.roles`. How do you handle it?**
`JwtGrantedAuthoritiesConverter` reads a top-level claim, so it cannot reach a
nested one. Implement a `Converter<Jwt, Collection<GrantedAuthority>>` that
navigates the nested map and set it on the `JwtAuthenticationConverter` — a few
lines, and the only place in the resource server that knows your IdP's shape.

**★ What is the principal on a `JwtAuthenticationToken`, and how do you use it?**
The `Jwt` itself. Inject it with `@AuthenticationPrincipal Jwt jwt` and read
claims directly. `getName()` returns `sub` unless you set
`setPrincipalClaimName(...)`, which is worth doing when the name ends up in logs
or audit records.

**★ Why does a resource server need `SessionCreationPolicy.STATELESS`?**
Because otherwise Spring Security will create an `HttpSession` per caller, which
pins memory in proportion to traffic and undoes the horizontal scalability that
motivated bearer tokens in the first place. `STATELESS` installs a
`NullSecurityContextRepository` so identity is re-derived from the token every
time.

---

← Prev: [The stateless JWT resource server](09-jwt-resource-server.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Password encoding](11-password-encoding.md)
