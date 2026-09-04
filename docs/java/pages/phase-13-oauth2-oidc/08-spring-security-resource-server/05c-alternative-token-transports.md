---
title: "Three alternative places a token can come from — a form field, a query string, a custom header — and one you can build in ten lines that quietly undoes the reason a bearer token did not need CSRF"
sidebar_label: "05c · Alternative token transports"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Bearer
> Tokens* §"Reading the Bearer Token from a Custom Header", §"Reading the Bearer Token from
> a Form Parameter"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/bearer-tokens.html))
> — the Spring Security sources `DefaultBearerTokenResolver`
> (`resolveAccessTokenFromQueryString`, `resolveAccessTokenFromBody`,
> `setAllowUriQueryParameter` javadoc), `HeaderBearerTokenResolver`,
> `OAuth2ResourceServerConfigurer.BearerTokenRequestMatcher`
> ([github.com](https://github.com/spring-projects/spring-security)) — **RFC 6750** §2.2,
> §2.3, §5 ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc6750)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**`DefaultBearerTokenResolver` ships with two transports switched off and one header name
that can be changed, and every one of those knobs exists for a real client that could not
set an `Authorization` header. This chunk is the four ways to move the token somewhere else
and, for each, exactly what you are giving up — because the header is not merely a
convention, it is the reason a bearer token is not vulnerable to CSRF.**

## The two switches, and why they default to `false`

### Form-encoded body parameter

```java
DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
resolver.setAllowFormEncodedBodyParameter(true);
http
    .oauth2ResourceServer((oauth2) -> oauth2
        .bearerTokenResolver(resolver)
    );
```

RFC 6750 §2.2 permits it only under five simultaneous conditions:

> *"The client MUST NOT use this method unless all of the following conditions are met:*
> *The HTTP request entity-header includes the 'Content-Type' header field set to
> 'application/x-www-form-urlencoded'. The entity-body follows the encoding requirements
> … The HTTP request entity-body is single-part. … The content to be encoded in the
> entity-body MUST consist entirely of ASCII characters. The HTTP request method is one for
> which the request-body has defined semantics. In particular, this means that the 'GET'
> method MUST NOT be used."*

Spring enforces the content type and the GET prohibition:

```java
if (!this.allowFormEncodedBodyParameter
        || !MediaType.APPLICATION_FORM_URLENCODED_VALUE.equals(request.getContentType())
        || HttpMethod.GET.name().equals(request.getMethod())) {
    return null;
}
```

🔴 There is a practical cost nobody warns about: reading a form parameter **consumes the
request body**. On a `POST` with `application/x-www-form-urlencoded` the servlet container
parses parameters for you, so this is usually harmless — but a chain where something else
wants the raw body, or a JSON API that has been coerced into form encoding, will find the
body already read. Enable this only for a legacy client that genuinely cannot set a header.

### URI query parameter

```java
resolver.setAllowUriQueryParameter(true);
```

The javadoc on the setter is unusually direct:

> *"The spec recommends against using this mechanism for sending bearer tokens, and even
> goes as far as stating that it was only included for completeness."*

RFC 6750 §2.3 is where that comes from:

> *"Because of the security weaknesses associated with the URI method (see Section 5),
> including the high likelihood that the URL containing the access token will be logged, it
> SHOULD NOT be used unless it is impossible to transport the access token in the
> 'Authorization' request header field or the HTTP request entity-body."*

> *"This method is included to document current use; its use is not recommended, due to its
> security deficiencies … and also because it uses a reserved query parameter name."*

"The URL will be logged" is the whole objection and it is not theoretical: access logs,
proxy logs, CDN logs, browser history, `Referer` headers on outbound links, and error
tracking payloads all capture query strings. Every one of them becomes a store of live
credentials with a completely different retention policy from your token store.

Spring restricts it to `GET` (`!HttpMethod.GET.name().equals(request.getMethod())` returns
`null` otherwise), which limits the damage but does not change the argument. Turn it on only
for something like a `<img>` or `<video>` tag that cannot set headers, and then only with a
token minted for that single purpose with a lifetime measured in seconds.

## Changing the header

Some infrastructure eats `Authorization` — a proxy that performs its own auth, an API
gateway that rewrites it. The documented answer:

```java
@Bean
BearerTokenResolver bearerTokenResolver() {
    DefaultBearerTokenResolver bearerTokenResolver = new DefaultBearerTokenResolver();
    bearerTokenResolver.setBearerTokenHeaderName(HttpHeaders.PROXY_AUTHORIZATION);
    return bearerTokenResolver;
}
```

> *"Or, in circumstances where a provider is using both a custom header and value, you can
> use `HeaderBearerTokenResolver` instead."*

`HeaderBearerTokenResolver` reads a named header whose *entire value* is the token — no
`Bearer ` prefix, no regex. That is the one to reach for when a gateway hands you
`X-Access-Token: eyJ...`.

Note the resolver is picked up as a bean: declaring a `BearerTokenResolver` `@Bean` is
enough; you do not have to wire it into the DSL as well.

## A resolver you write yourself

The interface is one method, so a bespoke rule is small:

```java
class HeaderOrCookieBearerTokenResolver implements BearerTokenResolver {

    private final BearerTokenResolver delegate = new DefaultBearerTokenResolver();

    @Override
    public String resolve(HttpServletRequest request) {
        String fromHeader = this.delegate.resolve(request);
        if (fromHeader != null) {
            return fromHeader;
        }
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> "access_token".equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
```

That is a complete, working cookie resolver — and reading it should make you uncomfortable,
because it reintroduces exactly the ambient-credential property that made CSRF unnecessary
([04c · STATELESS, CSRF and CORS](04c-stateless-csrf-cors.md)). A cookie-borne token *is*
sent automatically on cross-origin requests, so a chain using this resolver **must** keep
CSRF enforced, and the framework's automatic exemption will now match those requests and
skip it. If you need tokens in cookies, the honest pattern is a BFF holding a session —
**13 · Sessions vs tokens, honestly** *(not written yet)*.

## Gotchas

**★ Enabling the form-parameter transport reads the request body.**
For `application/x-www-form-urlencoded` the container has usually parsed it already, but
anything downstream that wants the raw stream will find it consumed.

**★ The query-parameter transport puts live credentials in every log on the path.**
Access logs, proxies, CDNs, browser history and `Referer` headers. The RFC's own words are
*"the high likelihood that the URL containing the access token will be logged"*. If you must
enable it, mint a separate short-lived token for that one use.

**★ The query transport only works for `GET`.**
`resolveAccessTokenFromQueryString` returns `null` for any other method. A team that enables
it for a `POST` upload sees no effect and concludes the switch is broken.

**★ A `BearerTokenResolver` bean is picked up automatically.**
You do not need `oauth2ResourceServer(o -> o.bearerTokenResolver(...))` as well. Conversely,
a stray `BearerTokenResolver` bean left over from an experiment silently changes where every
chain looks for the token.

**★ A cookie-based resolver reintroduces CSRF exposure and simultaneously triggers the
framework's CSRF exemption.**
`BearerTokenRequestMatcher` returns true whenever the configured converter finds a token —
including one from a cookie — so `registerDefaultCsrfOverride` skips CSRF for exactly the
requests that now need it. If you build one of these, enforce CSRF explicitly.

**★ `HeaderBearerTokenResolver` does not parse a `Bearer ` prefix.**
It treats the whole header value as the token. Point it at a header that still carries the
prefix and every token fails validation with a leading `Bearer ` embedded in it — which
decodes to nothing and produces `invalid_token`.

**★ Changing the header name does not change the `WWW-Authenticate` challenge.**
`BearerTokenAuthenticationEntryPoint` always writes `WWW-Authenticate: Bearer …`. A client
that follows the challenge literally will retry with `Authorization`, which you are no
longer reading.

**★ Enabling a transport widens `BearerTokenRequestMatcher`, and therefore the CSRF
exemption.**
The matcher asks the configured converter whether it can find a token. Turn on the form
transport and a form-encoded POST carrying `access_token` is now CSRF-exempt — which is
correct for a genuine bearer client and wrong if the parameter can be planted by a
cross-site form.

## Interview questions

**★ Why are the form and query transports disabled by default?**
Because RFC 6750 permits them only grudgingly. §2.2 imposes five conditions on the form
transport, and §2.3 says of the query transport that it "SHOULD NOT be used unless it is
impossible" to use the other two, and that it "is included to document current use; its use
is not recommended" — principally because URLs get logged everywhere.

**★ Your gateway strips `Authorization` and forwards `X-Access-Token`. How do you
configure this?**
Publish a `BearerTokenResolver` bean. If the gateway still sends the `Bearer ` prefix,
`new DefaultBearerTokenResolver()` with `setBearerTokenHeaderName("X-Access-Token")`. If the
header value is the bare token, `HeaderBearerTokenResolver`, which the reference names for
exactly the case where "a provider is using both a custom header and value".

**★ Is it safe to read the token from a cookie?**
It is possible in about ten lines and it changes the threat model. A cookie is an ambient
credential — the browser attaches it to cross-origin requests without the page asking — so
CSRF becomes relevant again, and `oauth2ResourceServer`'s automatic CSRF exemption will
match those requests and skip the check. If you go this route you must re-enable CSRF
explicitly; if you have the choice, put a session behind a BFF instead and keep the token on
the server.

**★ Why does moving the token out of the `Authorization` header change your CSRF
analysis?**
Because CSRF exists to defend against *ambient* credentials — ones the browser attaches
without the page asking. An `Authorization` header is never ambient, so a cross-origin page
cannot forge an authenticated request. A cookie is ambient by definition; a form field can
be planted by an attacker-controlled form; a query parameter can be planted by a link. Any
transport a third-party page can populate puts CSRF back on the table, and
`oauth2ResourceServer`'s automatic exemption will match those very requests.

**★ A partner integration can only send the token as a query parameter on a `GET`. What do
you do?**
Enable it deliberately and contain the blast radius: `setAllowUriQueryParameter(true)`,
scoped to a chain with its own `securityMatcher` covering only the endpoints that need it;
mint a separate, minimally-scoped, very short-lived token for that use; and scrub
`access_token` from access logs at every hop you control. Then write down why, because the
RFC's own position is that this exists only "to document current use".

---

← [Bearer token resolution](05b-bearer-token-resolution.md) · [Topic index](README.md) · Next → [Step 7 and the debug table](05d-step-7-surprises-and-the-debug-table.md)
