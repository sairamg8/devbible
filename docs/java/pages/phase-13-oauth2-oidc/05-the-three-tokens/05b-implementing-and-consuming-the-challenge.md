---
title: "Spring builds the challenge from the error object rather than the handler, which is why the status code travels with the error — and the client side of the same header is a three-branch decision table that must have a retry guard"
sidebar_label: "05b · Implementing the challenge"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §3 (The WWW-Authenticate Response Header Field) and
> §3.1 (Error Codes) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt));
> RFC 9449 §7.1 (The DPoP Authentication Scheme) and §9 (Resource Server-Provided Nonce)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9449.txt));
> `BearerTokenAuthenticationEntryPoint`, `BearerTokenAccessDeniedHandler` and
> `OAuth2ResourceServerConfigurer` sources on `main`
> ([github.com/spring-projects](https://github.com/spring-projects/spring-security));
> Spring Security 7.x reference — Bearer Tokens
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/bearer-tokens.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**[05](05-www-authenticate-challenges.md) is the specification's three codes and three
statuses. This chunk is the two pieces of code that make them real: the entry point that
writes the header, and the client branch that reads it. The second is where the bugs are —
almost every "our app logged everyone out" incident is a client that treated one of these
three cases as another.**

## Spring's implementation

`BearerTokenAuthenticationEntryPoint.commence` builds the header, and the source is worth
reading because it settles a documentation discrepancy:

```java
// BearerTokenAuthenticationEntryPoint (Spring Security 7.x, main)
HttpStatus status = HttpStatus.UNAUTHORIZED;
Map<String, String> parameters = new LinkedHashMap<>();
if (this.realmName != null) {
    parameters.put("realm", this.realmName);
}
if (authException instanceof OAuth2AuthenticationException oAuth2AuthenticationException) {
    OAuth2Error error = oAuth2AuthenticationException.getError();
    parameters.put("error", error.getErrorCode());
    if (StringUtils.hasText(error.getDescription())) {
        parameters.put("error_description", error.getDescription());
    }
    if (StringUtils.hasText(error.getUri())) {
        parameters.put("error_uri", error.getUri());
    }
    if (error instanceof BearerTokenError bearerTokenError) {
        if (StringUtils.hasText(bearerTokenError.getScope())) {
            parameters.put("scope", bearerTokenError.getScope());
        }
        status = bearerTokenError.getHttpStatus();
    }
}
parameters.put("resource_metadata", this.resourceMetadataParameterResolver.apply(request));
```

Four things to take from that:

1. **The parameter is `error`, not `error_code`.** The Spring Security 7.x reference page on
   Bearer Tokens shows an example challenge reading
   `WWW-Authenticate: Bearer error_code="invalid_token", …`. That does not match RFC 6750 §3,
   which names the attribute `error`, and it does not match the source above. Treat the
   reference example as a documentation typo and the source as authoritative. *(I could not
   find an issue or changelog entry confirming it as a known doc bug — the claim here rests on
   reading the source.)*
2. **The status comes from the error**, not from the entry point. `BearerTokenError` carries
   its own `HttpStatus`, which is how `insufficient_scope` produces 403 from an
   `AuthenticationEntryPoint` whose default is 401.
3. **`realm` is only emitted if you set it.** `setRealmName(...)` on the entry point; by
   default there is no realm, which is conformant (`realm` is a `MAY`).
4. **`resource_metadata` is always added** in 7.x. That is RFC 9728 (OAuth 2.0 Protected
   Resource Metadata) support — a URL pointing at this resource server's metadata document,
   so a client can discover which authorization servers it trusts. It is a newer parameter
   than RFC 6750 and will look unfamiliar in a header dump.

`BearerTokenAccessDeniedHandler` is the counterpart for the authorization side: once a token
has authenticated successfully and then fails an authorization check, it is an
`AccessDeniedException`, and that handler emits the 403 with `insufficient_scope`.

## The `DPoP` challenge, for completeness

RFC 9449 §7.1 defines a parallel challenge using the `DPoP` scheme, reusing RFC 6750's
parameters:

> *"A `scope` authentication parameter MAY be included as defined in [RFC6750], Section 3. An
> `error` parameter […] SHOULD be included to indicate the reason why the request was
> declined […] The error parameter values described in [RFC6750], Section 3.1 are suitable, as
> are any appropriate values defined by extension. The value `use_dpop_nonce` can be used […]
> Additionally, `invalid_dpop_proof` is used to indicate that the DPoP proof itself was deemed
> invalid […] An `algs` parameter SHOULD be included to signal to the client the JWS algorithms
> that are acceptable for the DPoP proof JWT."*

`use_dpop_nonce` is the interesting one: unlike every RFC 6750 code, it is *recoverable within
the same request cycle* — the server supplies a nonce, the client rebuilds its proof with it
and retries. Sender-constraining is [06](06-what-a-bearer-token-cannot-do.md).

## What the client's error handling should look like

```java
// Sketch. In Spring, OAuth2AuthorizedClientManager handles the refresh;
// this is the decision table it is implementing.
switch (status) {
    case 401 -> {
        // invalid_token (or no credentials): the credential is the problem.
        if (!alreadyRetried) {
            forceRefreshAccessToken();     // once
            retry();
        } else {
            requireReauthentication();     // refresh did not help
        }
    }
    case 403 -> {
        // insufficient_scope: a new token from the same grant will not help.
        String needed = parseScopeFromChallenge(wwwAuthenticate); // may be null
        if (needed != null) {
            requestIncrementalAuthorization(needed);
        } else {
            showPermissionDenied();
        }
    }
    case 400 -> reportClientBug();         // invalid_request: our request is malformed
}
```

The `alreadyRetried` guard is not optional. Without it, a token the AS keeps issuing and the
RS keeps rejecting — a misconfigured audience, a clock-skew problem, a `kid` the RS cannot
resolve — becomes an infinite refresh loop that will take down your token endpoint before it
takes down your API.

## When a token authenticates and then fails authorization

The 401 path and the 403 path go through different Spring components, and knowing which is
which saves you an hour of breakpoints:

| Situation | Spring path | Result |
|---|---|---|
| No token, or an unparseable one | `BearerTokenAuthenticationFilter` → `AuthenticationEntryPoint` | 401, bare challenge or `invalid_token` |
| Token present, signature/`exp`/`aud` rejected | `AuthenticationEntryPoint` | 401 `invalid_token` |
| Token valid, authority check fails | `ExceptionTranslationFilter` → `BearerTokenAccessDeniedHandler` | 403 `insufficient_scope` |

The third row is the one that surprises people: by then the request *is* authenticated. The
`Authentication` is in the `SecurityContext`, the principal is real, and the failure is an
`AccessDeniedException`, not an `AuthenticationException`. That is why it does not go through
the entry point and why hand-written `@ExceptionHandler` methods for
`AccessDeniedException` silently take over the 403 path and stop emitting the challenge.

Wiring both, with a realm:

```java
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    BearerTokenAuthenticationEntryPoint entryPoint = new BearerTokenAuthenticationEntryPoint();
    entryPoint.setRealmName("orders-api");

    BearerTokenAccessDeniedHandler deniedHandler = new BearerTokenAccessDeniedHandler();
    deniedHandler.setRealmName("orders-api");

    return http
        .authorizeHttpRequests((auth) -> auth.anyRequest().authenticated())
        .oauth2ResourceServer((oauth2) -> oauth2
            .authenticationEntryPoint(entryPoint)
            .accessDeniedHandler(deniedHandler)
            .jwt(Customizer.withDefaults()))
        .build();
}
```

That is the Security 7 lambda DSL — there is no `and()` and no `http.oauth2ResourceServer()`
overload returning the configurer, both of which appear in older tutorials. Wiring the
decoder, the issuer and the authorities converter is
[08 · Spring Security as resource server](../08-spring-security-resource-server/README.md).

## Gotchas

**★ Spring's reference doc shows `error_code=` in the challenge; the source emits `error=`.**
RFC 6750 §3 names the attribute `error`. If you wrote a client parser against the
documentation example rather than against a real response, it will never match.

**★ Each auth-param `MUST NOT appear more than once`.**
A custom entry point that appends to an existing `WWW-Authenticate` header, rather than
replacing it, can emit two `realm`s or two `error`s. Spring builds the header from a
`LinkedHashMap`, which makes duplication structurally impossible; hand-rolled string
concatenation does not.

**★ `resource_metadata` in the challenge is new and is not RFC 6750.**
Spring Security 7.1 adds it unconditionally (RFC 9728, Protected Resource Metadata). A strict
client parser written against RFC 6750's parameter list may choke on an unknown param — the
RFC does say *"Other auth-param attributes MAY be used as well"*, so the parser is the one at
fault, but you will still be the one debugging it.

**★ A `@ControllerAdvice` handler for `AccessDeniedException` silently disables the 403
challenge.**
`ExceptionTranslationFilter` sits *outside* the `DispatcherServlet`, so it normally handles
the exception before any controller advice sees it — but an advice that catches
`AccessDeniedException` thrown from inside a controller (for example by a method-security
check on a service call) will produce a 403 with no `WWW-Authenticate` header at all. The
symptom is a client that works against one endpoint and cannot parse the challenge from
another.

**★ Setting `realmName` on the entry point does not set it on the denied handler.**
They are separate objects with separate `setRealmName`. Configure one and your 401s carry a
realm while your 403s do not, which is confusing to anyone reading a header dump and
inconsistent to a strict client.

**★ `BearerTokenError` carries the status; `OAuth2Error` does not.**
If you throw a plain `OAuth2AuthenticationException` with a bare `OAuth2Error`, the entry
point emits your `error` code but keeps its default 401 — so a custom `insufficient_scope`
raised that way comes out as a 401 and clients will refresh on it. Use
`BearerTokenErrors.insufficientScope(...)` so the 403 travels with the error.

**★ The retry guard on the client is not optional.**
A 401 `invalid_token` that a refresh cannot fix — a wrong `aud`, an unresolvable `kid`, a
skewed clock — turns "refresh and retry" into an unbounded loop that hammers the token
endpoint. One refresh, one retry, then fail loudly.

**★ `use_dpop_nonce` is the only challenge error that is recoverable in place.**
Every RFC 6750 code means "go do something else". RFC 9449's `use_dpop_nonce` means "rebuild
your proof with the nonce I just gave you and try again". A DPoP client that treats it like
`invalid_token` will refresh a perfectly good access token for no reason.

## Interview questions

**★ How does Spring produce a 403 from an `AuthenticationEntryPoint` whose default status is
401?**
`BearerTokenAuthenticationEntryPoint` starts with `HttpStatus.UNAUTHORIZED`, then, if the
`OAuth2Error` it is rendering is a `BearerTokenError`, it takes the status from the error
object: `status = bearerTokenError.getHttpStatus()`. `BearerTokenErrors.insufficientScope`
carries 403. So the status is a property of the error, not of the handler. In the normal flow
an already-authenticated request that fails an authorization check goes through
`BearerTokenAccessDeniedHandler` instead, which produces the 403 directly.

**★ A client sees a 401 with `invalid_token`, refreshes, retries, and gets 401
`invalid_token` again. Where is the bug?**
Almost certainly on the resource server, not the client. `invalid_token` covers everything
from expiry to *"invalid for other reasons"*, and the causes that survive a refresh are all
server-side validation failures: the token's `aud` does not name this resource server, the
`iss` does not exactly match the configured issuer, the RS cannot resolve the signing `kid`
from the JWKS (a rotation the RS has not picked up), the RS's clock is far enough off that a
fresh token looks not-yet-valid, or — with RFC 9068 tokens — the `typ` header is not
`at+jwt`. The client's job here is to stop after one retry and surface the failure; the
diagnosis needs the resource server's logs and `error_description`.

**★ Why do the 401 and 403 paths go through different Spring components?**
Because they are different exception types raised at different points. A request with no
token or an unusable one never authenticates, so `BearerTokenAuthenticationFilter` throws an
`AuthenticationException` and `ExceptionTranslationFilter` routes it to the
`AuthenticationEntryPoint` — that is the 401. A request whose token authenticated fine and
then failed an authority check throws `AccessDeniedException`, which
`ExceptionTranslationFilter` routes to the `AccessDeniedHandler` — that is the 403, emitted by
`BearerTokenAccessDeniedHandler` with `insufficient_scope`. The practical consequence is that
you have to configure both if you want a consistent `realm`, and that catching
`AccessDeniedException` in a `@ControllerAdvice` will quietly replace the conformant 403 with
one that carries no challenge.

**★ You wrote a custom validator that raises `insufficient_scope`, but clients receive 401 and
refresh in a loop. What did you do wrong?**
You almost certainly built a plain `OAuth2Error` rather than a `BearerTokenError`.
`BearerTokenAuthenticationEntryPoint` reads the status off the error object —
`if (error instanceof BearerTokenError bearerTokenError) { status = bearerTokenError.getHttpStatus(); }`
— and defaults to 401 otherwise. So the `error` parameter says `insufficient_scope` while the
status line says 401, and any conformant client branches on the status. Constructing the error
through `BearerTokenErrors.insufficientScope(...)` attaches the 403.

---

← [WWW-Authenticate challenges](05-www-authenticate-challenges.md) · [Topic index](README.md) · Next → [What a bearer token cannot do](06-what-a-bearer-token-cannot-do.md)
