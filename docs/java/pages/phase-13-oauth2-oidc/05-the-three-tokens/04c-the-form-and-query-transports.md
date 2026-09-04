---
title: "The URI query parameter transport is in RFC 6750 only to document deployments that already existed, and the specification says so — treating it as one of three equal options is the misreading that puts credentials in your access logs"
sidebar_label: "04c · The form and query transports"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §2 (Authenticated Requests), §2.2 (Form-Encoded Body
> Parameter), §2.3 (URI Query Parameter), §5.3 (Summary of Recommendations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 9700 §4.3.2 (Access
> Token in Browser History) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt));
> RFC 7662 §4 (Security Considerations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7662.txt));
> `DefaultBearerTokenResolver` source on `main`
> ([github.com/spring-projects](https://github.com/spring-projects/spring-security)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**RFC 6750 lists three transports and people read that as a menu. It is not: two of the three
carry `SHOULD NOT`s with stated reasons, and the third — the query parameter — carries a
sentence saying it was included to document existing practice and that its use "is not
recommended". Knowing exactly why each was constrained is what lets you push back when
someone proposes `?access_token=` because their frontend framework makes headers awkward.**

## §2.2 · The form-encoded body parameter

The mechanism: put the token in the request body as `access_token=…`. The RFC surrounds it
with five preconditions, all of which must hold:

> *"The client MUST NOT use this method unless all of the following conditions are met:"*
> - *"The HTTP request entity-header includes the `Content-Type` header field set to
>   `application/x-www-form-urlencoded`."*
> - *"The entity-body follows the encoding requirements of the
>   `application/x-www-form-urlencoded` content-type […]"*
> - *"The HTTP request entity-body is single-part."*
> - *"The content to be encoded in the entity-body MUST consist entirely of ASCII
>   characters."*
> - *"The HTTP request method is one for which the request-body has defined semantics. In
>   particular, this means that the `GET` method MUST NOT be used."*

And then the constraint that decides the matter:

> *"The `application/x-www-form-urlencoded` method SHOULD NOT be used except in application
> contexts where participating browsers do not have access to the `Authorization` request
> header field. Resource servers MAY support this method."*

Note what that carve-out is *not*. It is not "when headers are inconvenient", not "when our
gateway strips headers", and not "when the client library makes it hard". It is specifically
about browsers that cannot set the header — a scenario that in 2026 is essentially a legacy
form-post integration, not a modern SPA.

The practical costs beyond the spec:

- **It forces a body, so it forces a method.** `GET` is prohibited, so a read becomes a
  `POST`, which breaks caching, breaks idempotent retries, and confuses every piece of
  routing infrastructure that keys on method.
- **`Content-Type` must be `application/x-www-form-urlencoded`,** so you cannot send JSON. An
  API that takes JSON bodies cannot use this transport at all.
- **The token is now in the body,** which means anything that logs request bodies — API
  gateways, WAFs, debug middleware, some tracing exporters — has logged a credential.

Spring's resolver implements the preconditions literally:

```java
// DefaultBearerTokenResolver (Spring Security 7.x, main)
private @Nullable String resolveAccessTokenFromBody(HttpServletRequest request) {
    if (!this.allowFormEncodedBodyParameter
            || !MediaType.APPLICATION_FORM_URLENCODED_VALUE.equals(request.getContentType())
            || HttpMethod.GET.name().equals(request.getMethod())) {
        return null;
    }
    String queryString = request.getQueryString();
    if (queryString != null && queryString.contains(ACCESS_TOKEN_PARAMETER_NAME)) {
        return null;                       // avoid double-counting the same parameter
    }
    return resolveToken(request.getParameterValues(ACCESS_TOKEN_PARAMETER_NAME));
}
```

Three of the RFC's preconditions are right there as guard clauses, and the fourth check —
looking at the query string before reading the parameter — exists because
`HttpServletRequest.getParameterValues` merges query and form parameters, so without it a
token in the query would be mistaken for a token in the body.

Enabling it, if you truly must:

```java
DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
resolver.setAllowFormEncodedBodyParameter(true);

http.oauth2ResourceServer((oauth2) -> oauth2.bearerTokenResolver(resolver));
```

There is no Spring Boot property for this. It is a deliberate code change, and that friction
is the framework's opinion.

## §2.3 · The URI query parameter

The mechanism, and RFC 6750's own example:

```http
GET /resource?access_token=mF_9.B5f-4.1JqM HTTP/1.1
Host: server.example.com
```

Then the constraint, which is the sentence to memorise:

> *"Because of the security weaknesses associated with the URI method (see Section 5),
> including the high likelihood that the URL containing the access token will be logged, it
> SHOULD NOT be used unless it is impossible to transport the access token in the
> `Authorization` request header field or the HTTP request entity-body. Resource servers MAY
> support this method."*

And then the paragraph that settles the argument:

> *"This method is included to document current use; its use is not recommended, due to its
> security deficiencies (see Section 5) and also because it uses a reserved query parameter
> name, which is counter to URI namespace best practices […]"*

**"Included to document current use."** It is not a design option. It is a description of
what people were already doing in 2012, written down so that resource servers implementing it
would at least agree on the parameter name.

§5.3 restates the prohibition as a recommendation with the reasons enumerated:

> *"Don't pass bearer tokens in page URLs: Bearer tokens SHOULD NOT be passed in page URLs
> (for example, as query string parameters). Instead, bearer tokens SHOULD be passed in HTTP
> message headers or message bodies for which confidentiality measures are taken. Browsers,
> web servers, and other software may not adequately secure URLs in the browser history, web
> server logs, and other data structures. If bearer tokens are passed in page URLs, attackers
> might be able to steal them from the history data, logs, or other unsecured locations."*

## Where a token in a URL actually ends up

The RFC says "logs and history". In a real deployment the list is longer, and this is the
list to read out in the design meeting:

1. **The web server access log** — every reverse proxy, load balancer and app server logs the
   request line by default. That is the token, in plaintext, in a file with a retention policy
   measured in months and a much wider read audience than your database.
2. **Browser history** — RFC 9700 §4.3.2 names it: *"An access token may end up in the browser
   history if a client or a website that already has a token deliberately navigates to a page
   like `provider.com/get_user_profile?access_token=abcdef`."* On a shared or corporate
   device that is durable.
3. **The `Referer` header** — if the page at that URL loads any third-party resource, the
   browser may send the full URL, including the token, to that third party. RFC 9700 §4.2 is
   an entire section on credential leakage via `Referer`.
4. **Distributed tracing** — most auto-instrumentation records `http.url` or `url.full` as a
   span attribute. Your tracing backend now stores credentials, and traces are typically
   readable by the whole engineering organisation.
5. **CDN and WAF logs** — request URLs are the primary key of most edge analytics.
6. **Bookmarks, chat pastes, screenshots, bug reports.** A URL is the unit humans share.

RFC 9700 §4.3.2's countermeasure is stated as a client-side `MUST NOT`:

> *"Clients MUST NOT pass access tokens in a URI query parameter in the way described in
> Section 2.3 of [RFC6750]."*

That is the BCP upgrading RFC 6750's `SHOULD NOT` to a `MUST NOT` for clients. When someone
cites "the RFC says SHOULD NOT, so it is allowed", this is the answer.

The same reasoning appears in RFC 7662 §4 about the introspection endpoint:

> *"To prevent the values of access tokens from leaking into server-side logs via query
> parameters, an authorization server offering token introspection MAY disallow the use of
> HTTP GET on the introspection endpoint and instead require the HTTP POST method."*

Same threat, different endpoint. It is a general rule about URLs, not a quirk of RFC 6750.

## Spring's query-parameter path

```java
private @Nullable String resolveAccessTokenFromQueryString(HttpServletRequest request) {
    if (!this.allowUriQueryParameter || !HttpMethod.GET.name().equals(request.getMethod())) {
        return null;
    }
    return resolveToken(request.getParameterValues(ACCESS_TOKEN_PARAMETER_NAME));
}
```

Off by default, `GET` only, and — like the form parameter — settable only in code. If you find
`setAllowUriQueryParameter(true)` in a codebase, it is worth an incident-grade conversation
about what forced it and what compensating controls exist (short-lived, single-audience,
single-scope tokens minted for exactly that call, and log redaction at the proxy).

## The one case that keeps coming up: a browser download or an `img` tag

The recurring legitimate-sounding request is: "the browser has to fetch a PDF/image directly
via `<a href>` or `<img src>`, and I cannot set a header there." Three answers that do not put
a token in a URL:

1. **A short-lived, single-use signed URL** minted by your API. The API authenticates the
   request normally with a bearer header, then returns a URL whose signature grants access to
   exactly one object for a minute. The credential in the URL is not an access token, it is
   scoped to one resource, and its leakage is bounded.
2. **Fetch it with JavaScript** using `fetch()` with the header, then create an object URL
   from the blob. Costs memory for large files, but keeps the header path.
3. **A cookie-authenticated download route** on your own origin, which is really the BFF
   answer — **13 · Sessions vs tokens, honestly** *(not written yet)*.

The pattern in all three: the thing in the URL, if anything, is a *narrow* capability, not the
user's full access token.

## Gotchas

**★ Enabling either non-header transport can break every request from that client.**
RFC 6750 §2: *"Clients MUST NOT use more than one method to transmit the token in each
request."* Spring enforces it with `invalid_request` and the message *"Found multiple bearer
tokens in the request"*. If you turn on the form parameter and something else — a proxy, a
polyfill, an SDK — also sets the header, every call from that client now 400s.

**★ `getParameterValues` merges query and form parameters, which is why Spring checks the
query string first.**
Without that guard, a token supplied in the query would be picked up by the *body* resolver
even with `allowUriQueryParameter` off, silently defeating the default. If you write your own
`BearerTokenResolver`, you need the same guard.

**★ The form transport forces `POST` on reads.**
`GET` is prohibited by §2.2. So an endpoint that should be a cacheable, retryable `GET`
becomes a `POST`, and you lose HTTP caching, safe retries and any routing that keys on method.
That cost is usually larger than the problem the team was trying to solve.

**★ TLS does not help with a token in a URL.**
The URL is encrypted in transit, and then written in plaintext to the access log at both ends,
to the browser's history, and to every tracing span. The exposure is at rest and after the
fact, which is exactly the surface TLS does not cover.

**★ Redacting `access_token` from logs is necessary and not sufficient.**
You would also have to redact it from browser history, `Referer` headers sent to third
parties, tracing spans, CDN analytics and every screenshot. The only reliable redaction is not
putting it there.

**★ RFC 9700 upgraded the `SHOULD NOT` to a `MUST NOT` for clients.**
§4.3.2: *"Clients MUST NOT pass access tokens in a URI query parameter in the way described in
Section 2.3 of [RFC6750]."* If your team's argument rests on RFC 6750's weaker wording, the
current Best Current Practice has already closed it.

**★ The parameter name `access_token` is itself criticised by the RFC.**
§2.3: *"it uses a reserved query parameter name, which is counter to URI namespace best
practices"*. Any application that also has a query parameter called `access_token` — an admin
tool, a webhook receiver — will collide with the resolver in confusing ways.

**★ A "temporary" enablement outlives the reason for it.**
`setAllowUriQueryParameter(true)` added for one legacy integration stays in the codebase after
that integration is retired, because nothing fails when it is left on. Pair every such change
with a dated comment and a ticket, or with a config flag that fails the build after a
deadline.

## Interview questions

**★ RFC 6750 defines three transports. Are they equivalent alternatives?**
No. §2.1's header method is the only one resource servers *"MUST support"* and the only one
clients *"SHOULD"* use. §2.2's form-encoded body method carries a `SHOULD NOT` with a narrow
exception — *"except in application contexts where participating browsers do not have access
to the `Authorization` request header field"* — plus five preconditions including a
prohibition on `GET`. §2.3's query parameter carries a `SHOULD NOT` and a sentence saying the
method *"is included to document current use; its use is not recommended"*. So it is one
transport plus two documented legacy accommodations, and RFC 9700 §4.3.2 has since turned the
query one into a client-side `MUST NOT`.

**★ Someone argues that a token in a query string is fine because the connection is HTTPS.
Answer them.**
TLS protects the URL in transit and does nothing about it at rest, which is where the exposure
lives. The full URL is written to the web server access log, the reverse proxy log, the CDN
log and the WAF log at both ends; it goes into the browser's history; it is emitted as an
`http.url` attribute by most tracing instrumentation; and if the page loads any third-party
resource, the browser may put it in a `Referer` header to that third party. RFC 6750 §2.3
names *"the high likelihood that the URL containing the access token will be logged"* as the
specific weakness, and §5.3 adds browser history. None of those are transit exposures.

**★ Your frontend must render an image from a protected endpoint and cannot set headers on an
`img` tag. What do you do?**
Not a token in the URL. Three supported options: have the API mint a short-lived, single-use
signed URL scoped to that one object, so the credential in the URL grants one thing for one
minute rather than everything the user can do; fetch the bytes with `fetch()` carrying the
`Authorization` header and render from an object URL; or serve the download from your own
origin behind a session cookie, which is the BFF shape. The principle in every case is that
whatever ends up in the URL is a narrow capability, not the user's access token.

**★ You enable `setAllowFormEncodedBodyParameter(true)` for a legacy client and now all of its
requests fail with 400 `invalid_request`. Why?**
Because the client is sending the token twice. RFC 6750 §2 says *"Clients MUST NOT use more
than one method to transmit the token in each request"*, and Spring's `DefaultBearerTokenResolver`
enforces it by throwing `invalid_request` with *"Found multiple bearer tokens in the request"*
whenever two resolution paths both produce a value. Typically an SDK or a proxy is still
setting the `Authorization` header while the application now also puts `access_token` in the
form body. The fix is on the client: pick one transport.

**★ Why does Spring make both non-header transports code-only rather than properties?**
Because a property is something an operator can flip in an environment file under time
pressure, and both transports have security consequences the RFC states plainly. Requiring a
`BearerTokenResolver` bean puts the change in source control, in a diff, in front of a
reviewer, with a place to write down why. That is the framework encoding *"Resource servers
MAY support this method"* as a decision rather than a setting.

---

← [Safeguarding a bearer token](04b-safeguarding-a-bearer-token.md) · [Topic index](README.md) · Next → [WWW-Authenticate challenges](05-www-authenticate-challenges.md)
