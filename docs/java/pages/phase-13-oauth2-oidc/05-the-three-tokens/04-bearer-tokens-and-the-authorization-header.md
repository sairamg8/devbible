---
title: "A bearer token is defined by what it does not require — no proof of possession — which is why the entire specification around it is a set of rules for not losing it"
sidebar_label: "04 · Bearer tokens"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §1.2 (Terminology), §2 (Authenticated Requests),
> §2.1 (Authorization Request Header Field), §5.3 (Summary of Recommendations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 6749 §10.3 (Access
> Tokens) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); Spring Security
> 7.x reference — OAuth 2.0 Bearer Tokens
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/bearer-tokens.html)),
> and `DefaultBearerTokenResolver` source on `main`.
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**"Bearer" is not branding. It is a precise technical claim about what the token does *not*
do, and RFC 6750's definition is the most consequential sentence in the whole
specification: possession is sufficient. There is no key, no signature from the client, no
binding to a sender. Everything else in RFC 6750 — the header rule, the ban on query
parameters, the TLS requirement, the short-lifetime recommendation — is downstream of that
one property.**

## The definition

RFC 6750 §1.2:

> *"Bearer Token — A security token with the property that any party in possession of the
> token (a 'bearer') can use the token in any way that any other party in possession of it
> can. Using a bearer token does not require a bearer to prove possession of cryptographic
> key material (proof-of-possession)."*

Two sentences; read them as a threat model.

- **"any party in possession"** — the resource server cannot tell your client from an
  attacker who copied the token. Not "will not"; *cannot*. There is no information in the
  request that distinguishes them.
- **"in any way that any other party […] can"** — the attacker does not get a degraded
  subset. They get everything the token grants, at every resource server that accepts it,
  with any HTTP method.

The `draft-ietf-oauth-browser-based-apps` BCP (an Internet-Draft, not an RFC, at rev 27 as
of this writing) states the consequence flatly in §5.2.2:

> *"Note that the possession of the access token allows its unrestricted use by the attacker.
> The attacker can send arbitrary requests to resource servers, using any HTTP method,
> destination URL, header values, or body."*

This is the analogy to hold: a bearer token is a **cinema ticket**, not a passport. The
usher checks the ticket, not you. Everything else follows.

## The one transport that matters

RFC 6750 §2 defines three ways to send a bearer token and immediately constrains their use:

> *"Clients MUST NOT use more than one method to transmit the token in each request."*

§2.1 is the one you will use, and it is the only one a resource server is required to
support:

> *"Clients SHOULD make authenticated requests with a bearer token using the `Authorization`
> request header field with the `Bearer` HTTP authorization scheme. Resource servers MUST
> support this method."*

The syntax, from §2.1's ABNF:

```
b64token    = 1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="
credentials = "Bearer" 1*SP b64token
```

And the RFC's own example request:

```http
GET /resource HTTP/1.1
Host: server.example.com
Authorization: Bearer mF_9.B5f-4.1JqM
```

`mF_9.B5f-4.1JqM` is RFC 6750's published example value; it is safe to repeat because the RFC
publishes it and it authorizes nothing.

Three things about that ABNF that bite in practice:

1. **`b64token` is a character class, not "base64".** It permits `-`, `.`, `_`, `~`, `+`, `/`
   and trailing `=`. A JWT's three dot-separated base64url segments fit. So does an opaque
   handle. A token containing a space, a colon or a comma does **not**, and an AS that issues
   one has produced something no conformant resource server can parse out of the header.
2. **`1*SP` is one or more spaces** — the scheme and the token are separated by whitespace,
   and a parser that splits on a single space is technically stricter than the ABNF.
3. **The scheme name is matched case-insensitively** in HTTP's authentication framework;
   Spring's resolver does `startsWithIgnoreCase(authorization, "bearer")`.

## Spring's resolver, and its defaults

`DefaultBearerTokenResolver` is where a Spring resource server turns the request into a token
string. Its defaults encode RFC 6750's preferences:

```java
// DefaultBearerTokenResolver (Spring Security 7.x, main)
private boolean allowFormEncodedBodyParameter = false;
private boolean allowUriQueryParameter = false;
```

Both non-header transports are **off by default**. You have to opt into them, deliberately,
in code — there is no property that turns them on by accident. That is the framework
encoding *"Resource servers MAY support this method"* as "not unless you say so".

The header path itself:

```java
private @Nullable String resolveFromAuthorizationHeader(HttpServletRequest request) {
    String authorization = request.getHeader(this.bearerTokenHeaderName);
    if (!StringUtils.startsWithIgnoreCase(authorization, "bearer")) {
        return null;                                  // not a bearer request at all
    }
    Matcher matcher = authorizationPattern.matcher(authorization);
    if (!matcher.matches()) {
        BearerTokenError error = BearerTokenErrors.invalidToken("Bearer token is malformed");
        throw new OAuth2AuthenticationException(error);
    }
    return matcher.group("token");
}
```

Note the distinction, which maps exactly onto RFC 6750 §3.1: a header that is not a Bearer
header at all yields `null` — the request is simply unauthenticated, and the entry point
will emit a bare challenge. A header that *claims* to be Bearer but does not match the ABNF
yields `invalid_token`, a 401 with a reason. Those are different responses to the client and
the distinction is deliberate.

And the multi-transport rule from §2 is enforced:

```java
BearerTokenError error = BearerTokenErrors.invalidRequest("Found multiple bearer tokens in the request");
```

Two tokens in one request — say, a header *and* a form parameter — is `invalid_request`, a
400. That is RFC 6750 §2's `MUST NOT` implemented as a rejection.

## Reading from a non-standard header

Some gateways strip or rewrite `Authorization`. Spring lets you move the read:

```java
@Bean
BearerTokenResolver bearerTokenResolver() {
    DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
    resolver.setBearerTokenHeaderName(HttpHeaders.PROXY_AUTHORIZATION);
    return resolver;
}
```

The reference notes that where a provider uses *"both a custom header and value"* you use
`HeaderBearerTokenResolver` instead. Both are escape hatches for infrastructure you do not
control — neither changes the token's semantics, and both are worth a comment in the config
saying which proxy forced it.

## What the rest of RFC 6750 is about

Everything above is *how* to carry a bearer token. The two remaining halves of the
specification are consequences of the definition and get their own chunks:

- **Not losing it** — the TLS requirements, the storage rules and RFC 6750 §5.3's full
  recommendation checklist: [04b · Safeguarding a bearer token](04b-safeguarding-a-bearer-token.md).
- **The two transports you should not use** — the form-encoded body parameter and the URI
  query parameter, and exactly why the second one is effectively forbidden:
  [04c · The form and query transports](04c-the-form-and-query-transports.md).
- **What the resource server says back** when the token is missing, invalid or insufficient:
  [05 · WWW-Authenticate challenges](05-www-authenticate-challenges.md).
- **What a bearer token structurally cannot do**, and the two specifications that fix it:
  [06 · What a bearer token cannot do](06-what-a-bearer-token-cannot-do.md).

## Gotchas

**★ Two tokens in one request is a 400, not "the header wins".**
RFC 6750 §2's `MUST NOT` is implemented by Spring as `invalid_request` with the message
*"Found multiple bearer tokens in the request"*. If you enabled the form parameter for a
legacy client and something also sets the header, every request from that client fails —
and the error will not obviously point at the duplication.

**★ A malformed Bearer header and a missing one produce different responses on purpose.**
Missing → a bare `WWW-Authenticate: Bearer` challenge with no error code, because RFC 6750
§3.1 says *"If the request lacks any authentication information […] the resource server
SHOULD NOT include an error code or other error information."* Malformed → `invalid_token`.
Client code that treats every 401 identically will retry the unrecoverable case.

**★ `b64token`'s character class excludes characters some vendors put in tokens.**
Spaces, commas and colons are not in the class. A token containing them cannot be
transported in the `Authorization` header per the ABNF, and a strict resolver will reject it
as malformed. If you are designing an AS, stay inside the class.

## Interview questions

**★ What does "bearer" actually mean, and what is the security consequence?**
It means possession is sufficient. RFC 6750 §1.2: *"any party in possession of the token
(a 'bearer') can use the token in any way that any other party in possession of it can",*
and *"Using a bearer token does not require a bearer to prove possession of cryptographic key
material"*. The consequence is that the resource server cannot distinguish the legitimate
client from a thief — there is nothing in the request that would let it. That is why the
mitigations are all about not losing the token (TLS everywhere, headers not URLs, no logging,
no clear-text cookies) and about limiting the damage when you do (short lifetimes, audience
restriction) rather than about detecting misuse, which is impossible for a pure bearer token.

**★ RFC 6750 defines three ways to send a token. Which do you use and why do the other two
exist?**
The `Authorization: Bearer` header, always — §2.1 says clients *"SHOULD"* use it and resource
servers *"MUST support"* it, making it the only universally available option. The
form-encoded body parameter exists for environments where the browser cannot set an
`Authorization` header, and §2.2 restricts it to that case: *"SHOULD NOT be used except in
application contexts where participating browsers do not have access to the `Authorization`
request header field."* The URI query parameter exists to document existing deployments and
§2.3 says its use *"is not recommended, due to its security deficiencies"*. Both are opt-in
and off by default in Spring's `DefaultBearerTokenResolver`.

**★ Why does Spring's resolver return `null` for a non-Bearer `Authorization` header but
throw for a malformed Bearer one?**
Because RFC 6750 §3.1 distinguishes the two cases. A request with no bearer credentials at
all is simply unauthenticated: the RS should challenge without disclosing an error code —
*"If the request lacks any authentication information […] the resource server SHOULD NOT
include an error code or other error information."* A request that presents something that
claims to be a bearer token but is not well-formed is a failed authentication attempt and
gets `invalid_token` with a 401, so the client knows to obtain a new token rather than to
prompt for one. Collapsing them either leaks information or misleads the client.

---

← [The token error response](03b-the-token-error-response.md) · [Topic index](README.md) · Next → [Safeguarding a bearer token](04b-safeguarding-a-bearer-token.md)
