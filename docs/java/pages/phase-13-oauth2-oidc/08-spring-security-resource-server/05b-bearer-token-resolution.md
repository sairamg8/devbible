---
title: "The token is extracted by a regex and two switches that default to off, and the two switches are off because RFC 6750 spends most of section 2 explaining why the alternatives to the Authorization header are a bad idea"
sidebar_label: "05b · Bearer token resolution"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Bearer
> Tokens* §"Bearer Token Resolution" (custom header, `HeaderBearerTokenResolver`, form
> parameter)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/bearer-tokens.html))
> — the Spring Security source `DefaultBearerTokenResolver` (the `authorizationPattern`
> regex, `resolveToken`, `allowFormEncodedBodyParameter`, `allowUriQueryParameter`)
> ([github.com](https://github.com/spring-projects/spring-security)) — **RFC 6750** §2.1
> (Authorization Request Header Field), §2.2 (Form-Encoded Body Parameter), §2.3 (URI Query
> Parameter), §3.1 (Error Codes)
> ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc6750)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**Before any cryptography happens, a string has to come out of the request, and the object
that does it has more opinions than its name suggests. `DefaultBearerTokenResolver` enforces
RFC 6750's `b64token` grammar with a regex, rejects requests that present the token twice,
and keeps the two non-header transports switched off — one of which the RFC itself describes
as included only *"to document current use"*.**

## The default: the `Authorization` header, and only that

> *"By default, Resource Server looks for a bearer token in the `Authorization` header."*

RFC 6750 §2.1 defines the grammar:

```
b64token    = 1*( ALPHA / DIGIT /
                  "-" / "." / "_" / "~" / "+" / "/" ) *"="
credentials = "Bearer" 1*SP b64token
```

and Spring implements it literally:

```java
private static final Pattern authorizationPattern =
        Pattern.compile("^Bearer (?<token>[a-zA-Z0-9-._~+/]+=*)$", Pattern.CASE_INSENSITIVE);
```

Four things follow directly from that regex, and each of them is a support ticket:

- **The scheme match is case-insensitive** (`bearer`, `BEARER` both work), but the header
  must *start* with it — `StringUtils.startsWithIgnoreCase(authorization, "bearer")` is
  checked first, and a non-Bearer scheme returns `null` rather than throwing, so `Basic`
  auth on the same chain is unaffected.
- **Exactly one space.** `Bearer  eyJ...` (two spaces) does not match.
- **The character class is closed.** A token containing a character outside
  `A-Za-z0-9-._~+/=` fails. A JWT is base64url and always fits; an opaque token from a
  vendor that includes `:` or `%` does not, and the failure is `invalid_token` with
  *"Bearer token is malformed"*.
- **Quoting breaks it.** `Authorization: Bearer "eyJ..."` — a client that JSON-encoded the
  header value — fails the regex.

A failure here throws before any decoder is involved:

```java
Matcher matcher = authorizationPattern.matcher(authorization);
if (!matcher.matches()) {
    BearerTokenError error = BearerTokenErrors.invalidToken("Bearer token is malformed");
    throw new OAuth2AuthenticationException(error);
}
```

`BearerTokenErrors.invalidToken(...)` carries `HttpStatus.UNAUTHORIZED`, so this is a 401.

## Presenting the token twice is a 400, not a 401

```java
private static @Nullable String resolveToken(@Nullable String... accessTokens) {
    String accessToken = null;
    for (String token : accessTokens) {
        if (accessToken == null) {
            accessToken = token;
        }
        else if (token != null) {
            BearerTokenError error = BearerTokenErrors
                .invalidRequest("Found multiple bearer tokens in the request");
            throw new OAuth2AuthenticationException(error);
        }
    }
    if (accessToken != null && accessToken.isBlank()) {
        BearerTokenError error = BearerTokenErrors
            .invalidRequest("The requested token parameter is an empty string");
        throw new OAuth2AuthenticationException(error);
    }
    return accessToken;
}
```

`BearerTokenErrors.invalidRequest(...)` carries `HttpStatus.BAD_REQUEST`. This tracks RFC
6750 §3.1 exactly:

> *"invalid_request — The request is missing a required parameter, includes an unsupported
> parameter or parameter value, repeats the same parameter, **uses more than one method for
> including an access token**, or is otherwise malformed. The resource server SHOULD respond
> with the HTTP 400 (Bad Request) status code."*

So a client that sets the header *and* a form parameter gets 400. It only fires when the
alternative transports are enabled — with the defaults, there is only one source to check.

## Where the token can come from instead

The `Authorization` header is the default and the only transport enabled out of the box.
Three alternatives — a form parameter, a query parameter, a differently-named header — plus
a resolver you write yourself, are
[05c · Alternative token transports](05c-alternative-token-transports.md). Read that page
before enabling any of them; two of the three change your CSRF analysis.

## Gotchas

**★ `Bearer` followed by two spaces fails the regex with `invalid_token`.**
The grammar is `"Bearer" 1*SP b64token` and Spring's pattern hard-codes one space. A client
that string-concatenates with a trailing space in the scheme constant produces a 401 that
looks like a bad token.

**★ A quoted header value fails.**
`Authorization: Bearer "eyJ..."` does not match the character class. Some HTTP client
wrappers quote header values by default.

**★ An opaque token containing characters outside `b64token` cannot be presented in the
header.**
The regex is the RFC grammar, not a Spring restriction. If a vendor issues tokens with `:`
or `%` in them, they are not RFC 6750-conformant bearer tokens and you need
`HeaderBearerTokenResolver` on a custom header.

**★ Sending the token in two places is 400, not 401.**
`invalid_request`, per RFC 6750 §3.1's *"uses more than one method for including an access
token"*. Clients that "helpfully" add a query parameter as a fallback while also setting the
header will fail every request once you enable the query transport.

## Interview questions

**★ Where does Spring Security look for a bearer token, and what does it do if it finds
none?**
Only the `Authorization` header, unless you enable the form-parameter or query-parameter
transports on `DefaultBearerTokenResolver`. If no token is found, the resolver returns
`null`, the filter calls `doFilter` and the request proceeds anonymously — it is not an
error at that layer.

**★ A client sends the token in the header and in a query parameter. What does the resource
server return?**
400 with `error="invalid_request"`, and only if the query transport is enabled at all.
`DefaultBearerTokenResolver.resolveToken` throws `invalidRequest("Found multiple bearer
tokens in the request")`, matching RFC 6750 §3.1's "uses more than one method for including
an access token".

**★ What error does a malformed `Authorization` header produce, and at which stage?**
`invalid_token` with the description "Bearer token is malformed", thrown by
`DefaultBearerTokenResolver` before any decoder runs, and rendered as 401 by
`BearerTokenAuthenticationEntryPoint`. It is worth knowing this is a *resolution* failure —
the token was never decoded, so nothing about signatures, issuers or expiry is implicated.

---

← [The request path](05-the-request-path.md) · [Topic index](README.md) · Next → [Alternative token transports](05c-alternative-token-transports.md)
