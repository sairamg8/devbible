---
title: "STATELESS, CSRF and CORS are three decisions that look like boilerplate and are not — and the CSRF one is the only place in this topic where the framework has already done the right thing and the internet will tell you to undo it"
sidebar_label: "04c · STATELESS, CSRF and CORS"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *Session Management*
> (`SessionCreationPolicy`, `NullSecurityContextRepository`)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html)),
> *CORS*
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/integrations/cors.html))
> — the Spring Security sources `OAuth2ResourceServerConfigurer#registerDefaultCsrfOverride`,
> `OAuth2ResourceServerConfigurer.BearerTokenRequestMatcher`,
> `BearerTokenAuthenticationFilter` (default `securityContextRepository` is
> `RequestAttributeSecurityContextRepository`)
> ([github.com](https://github.com/spring-projects/spring-security)) — **RFC 9700** §2.6
> (CORS guidance) ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**Three lines that appear in every resource-server example, two of which most people copy
without a reason and one of which is usually unnecessary. `STATELESS` is load-bearing and
under-explained. `csrf(...disable)` is broader than what `oauth2ResourceServer` has already
done for you and occasionally opens something. `cors(...)` is a preflight problem, not a
security problem, and the request that fails is never the one you are debugging.**

## `SessionCreationPolicy.STATELESS`

Concretely, `STATELESS` does two things: it installs a `NullSecurityContextRepository`, so
no `SecurityContext` is persisted between requests, and it disables the saved-request
machinery that exists to replay a request after an interactive login.

Note that the `BearerTokenAuthenticationFilter` is already careful here — its default
`securityContextRepository` is `RequestAttributeSecurityContextRepository`, which stores the
context on the request and forgets it at the end. So the bearer path itself does not create
a session. What *does* create one is everything else in a servlet application: an error
view, a flash attribute, a `HttpSession` parameter on a controller method, Spring MVC's
`RequestContextHolder` interplay, a third-party filter. `IF_REQUIRED` — the default — means
any of those silently gets a session, and because the API still works, nothing tells you
until memory grows in proportion to traffic and a rolling restart "fixes" it.

```java
.sessionManagement(session -> session
    .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
```

`NEVER` is not the same and the distinction matters for a token API: `NEVER` will not
create a session but will happily *read* one that already exists, so a session cookie
created elsewhere still authenticates requests. If the requirement is "a cookie must never
be proof of identity on this API", `STATELESS` is the only policy that says it.

## CSRF, and the thing the framework already did

🔴 **`oauth2ResourceServer(...)` exempts bearer-token requests from CSRF for you.** From the
configurer:

```java
private void registerDefaultCsrfOverride(H http) {
    CsrfConfigurer<H> csrf = http.getConfigurer(CsrfConfigurer.class);
    if (csrf != null) {
        csrf.ignoringRequestMatchers(this.requestMatcher);
    }
}
```

and `this.requestMatcher` is:

```java
private static final class BearerTokenRequestMatcher implements RequestMatcher {
    @Override
    public boolean matches(HttpServletRequest request) {
        try {
            return this.authenticationConverter.convert(request) != null;
        }
        catch (OAuth2AuthenticationException ex) {
            return false;
        }
    }
}
```

Read that carefully: the exemption applies **per request**, and only to requests from which
the configured `AuthenticationConverter` can extract a bearer token. That is exactly the
right rule, and it is more precise than anything you would write by hand.

### So why does everyone write `csrf(CsrfConfigurer::disable)`?

Partly inertia, partly because CSRF's *reason for existing* does not apply to a bearer
token. CSRF exists because browsers attach **ambient credentials** — cookies — to
cross-origin requests automatically. An `Authorization` header is not ambient; a foreign
page cannot make the browser add it. So a request authenticated purely by a bearer token
cannot be forged cross-site, and the framework's per-request exemption encodes precisely
that.

The difference between the framework's exemption and `disable()`:

| | Request **with** bearer token | Request **without** bearer token |
|---|---|---|
| default (`oauth2ResourceServer` exemption) | CSRF skipped | CSRF **enforced** |
| `csrf(CsrfConfigurer::disable)` | CSRF skipped | CSRF skipped |

On a chain that only ever sees bearer tokens the two are identical. On a chain that can also
authenticate a cookie — a mixed chain, a chain that inherited `formLogin`, a chain where an
upstream gateway sets a session — `disable()` removes the protection that still mattered.

**The rule:** if the chain's `securityMatcher` covers only a token API and nothing in it can
authenticate a cookie, `disable()` is honest and explicit; write it and move on. If the
chain is mixed, or you are not sure, delete the `disable()` call and let the configurer's
exemption do the narrower thing.

The full CSRF decision — when disabling is correct and when it is reckless — is
[phase 9 chunk 13](../../phase-9-spring-boot/11-spring-security/13-csrf-decisions.md).
Whether the token should be in a cookie at all is **13 · Sessions vs tokens, honestly**
*(not written yet)*.

## CORS

CORS is not authentication and it does not protect anything on the server. It is the
browser asking your server for permission on behalf of a page from another origin. It shows
up in this topic because a bearer token makes the request non-simple, which makes it
preflighted, which means the request that fails is an `OPTIONS` your controller never sees.

```java
.cors(Customizer.withDefaults())
```

`Customizer.withDefaults()` on `cors()` tells Spring Security to install its
`CorsFilter`-equivalent using a `CorsConfigurationSource` bean if one exists. Supply it:

```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://app.example.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    config.setMaxAge(Duration.ofMinutes(30));

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

Three points that decide whether this works:

**1 · `Authorization` must be in `allowedHeaders`.** It is not a CORS-safelisted header. If
it is missing, the preflight response omits it from `Access-Control-Allow-Headers` and the
browser refuses to send the actual request. The server logs nothing, because the actual
request never happens.

**2 · The preflight `OPTIONS` carries no token.** By specification a preflight request must
not include credentials. So it must reach the CORS handling *before* it can be rejected for
being unauthenticated. Spring Security's `cors()` places the CORS logic early enough in the
chain for that; a hand-rolled `CorsFilter` registered as a plain servlet filter often is
not, and the symptom is a 401 on an `OPTIONS` request with no `Origin` handling.

**3 · `allowCredentials(true)` is for cookies, and you do not need it.** With a bearer token
in a header there are no ambient credentials to send. Setting it forces you to enumerate
origins (the wildcard is illegal with credentials) for no benefit. Leave it off.

RFC 9700 §2.6 discusses CORS on the authorization-server side and is worth knowing for the
contrast:

> *"To support browser-based clients, endpoints directly accessed by such clients including
> the Token Endpoint, Authorization Server Metadata Endpoint, jwks_uri Endpoint, and Dynamic
> Client Registration Endpoint MAY support the use of Cross-Origin Resource Sharing (CORS).
> However, CORS MUST NOT be supported at the authorization endpoint, as the client does not
> access this endpoint directly; instead, the client redirects the user agent to it."*

Your resource server is not in that list — but the JWKS endpoint is, which is why a
browser-side library can fetch keys and your server-side one does not need CORS at all.

The full CORS-for-an-SPA treatment is
[phase 9 chunk 12](../../phase-9-spring-boot/11-spring-security/12-cors-for-an-spa.md).

## Gotchas

**★ `csrf(CsrfConfigurer::disable)` is broader than the exemption you already had.**
`oauth2ResourceServer` calls `csrf.ignoringRequestMatchers(bearerTokenRequestMatcher)`,
which skips CSRF only for requests carrying a token. `disable()` skips it for every request
on the chain, including cookie-authenticated ones.

**★ `STATELESS` is not a statement about JWTs.**
It installs a `NullSecurityContextRepository` and disables request caching. You can have
`STATELESS` with basic auth and `IF_REQUIRED` with JWTs. It is a statement about
server-side state, and a token API that leaves it at the default will create sessions.

**★ `NEVER` still reads an existing session.**
So a session cookie minted by any other part of the application authenticates API requests.
Only `STATELESS` refuses to consider one.

**★ The bearer filter alone does not create sessions, so "it works" proves nothing.**
`BearerTokenAuthenticationFilter` defaults to `RequestAttributeSecurityContextRepository`.
Sessions come from elsewhere — an error view, a flash attribute, a stray `HttpSession`
parameter. That is why the symptom is a slow memory climb rather than an obvious defect.

**★ Missing `Authorization` from `allowedHeaders` fails the preflight and logs nothing.**
The actual request is never sent, so there is no server-side trace at all. The only evidence
is in the browser console.

**★ A `CorsFilter` registered outside the security chain runs too late.**
The preflight `OPTIONS` reaches the security filters first, carries no credentials, and is
rejected before your CORS filter ever sees it. Use `http.cors(...)` with a
`CorsConfigurationSource` bean.

**★ `allowCredentials(true)` on a bearer-token API buys nothing and costs you wildcards.**
The browser will not send an `Authorization` header ambiently, so there are no credentials
to allow. With it enabled, `Access-Control-Allow-Origin: *` becomes illegal and you must
enumerate every origin.

**★ CORS is not a security control for your server.**
It restricts what *browsers* let scripts do with your responses. `curl`, a mobile app and
any server-side client ignore it entirely. A permissive CORS policy is a client-side
weakening, not a server-side one — but "we allow `*`" is still the wrong answer, because it
lets any page in the world read authenticated responses on behalf of a logged-in user.

## Interview questions

**★ Does a resource server need CSRF protection?**
Not for requests authenticated by a bearer token, because CSRF depends on ambient
credentials and an `Authorization` header is not ambient — a cross-origin page cannot make
the browser attach it. Spring Security already encodes that: `oauth2ResourceServer` calls
`csrf.ignoringRequestMatchers(...)` with a matcher that returns true exactly when a bearer
token is present. Disabling CSRF wholesale is broader and only safe if nothing on that chain
can authenticate a cookie.

**★ What does `SessionCreationPolicy.STATELESS` actually change?**
It installs a `NullSecurityContextRepository`, so no `SecurityContext` is written or read
between requests, and it turns off the saved-request mechanism used to replay a request
after login. It does not stop other parts of the application from touching `HttpSession`; it
stops Spring Security from treating one as an identity store.

**★ `NEVER` versus `STATELESS` — when does the difference bite?**
When a session already exists. `NEVER` will not create one but will read one, so an
identity established by another chain or another filter authenticates API calls. `STATELESS`
refuses to consider it. For an API whose contract is "every request carries its own
credential", only `STATELESS` expresses that.

**★ Your SPA gets a CORS error on every API call and the server logs show nothing. Where do
you look?**
At the preflight. A bearer token makes the request non-simple, so the browser sends an
`OPTIONS` first; if `Authorization` is not in `allowedHeaders`, or the CORS handling sits
after security in the filter order, the preflight fails and the real request is never sent —
which is exactly why the server log is empty. Check the browser network tab for the
`OPTIONS`, not the server.

**★ Is CORS a security control?**
For your server, no. It is a browser-enforced restriction on what scripts from other origins
may do with your responses; non-browser clients ignore it completely. It is still worth
configuring tightly, because a wildcard policy lets an arbitrary page read authenticated
responses using a user's live token.

**★ Why might you deliberately keep CSRF enabled on a chain that also accepts bearer
tokens?**
Because the chain can authenticate something else as well. A BFF-style deployment where the
browser holds a session cookie and internal callers use tokens has both credential types on
one path; the framework's per-request exemption gives the token callers a pass while keeping
the cookie callers protected, and `disable()` would give both a pass.

---

← [Matcher and chain order](04b-matcher-order.md) · [Topic index](README.md) · Next → [The request path](05-the-request-path.md)
