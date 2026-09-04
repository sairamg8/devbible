---
title: "What Spring already gives you"
sidebar_label: "6 · What Spring gives you"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference *Web MVC →
> Filters* (docs.spring.io/spring-framework/reference/web/webmvc/filters.html —
> `FormContentFilter`, `ForwardedHeaderFilter`, `ShallowEtagHeaderFilter`,
> `CorsFilter`, `UrlHandlerFilter`), *CORS* (`web/webmvc-cors.html`),
> *Observability* (`integration/observability.html` — `ServerHttpObservationFilter`,
> `http.server.requests` and its key values), the `RequestContextFilter`
> javadoc, the Spring Security 7 reference *Servlet Applications → Architecture*,
> and the Spring Boot 4.1 reference — *Running Behind a Front-end Proxy Server*
> and *Enable HTTP Response Compression*
> (docs.spring.io/spring-boot/how-to/webserver.html), *Actuator → Metrics* and
> *Actuator → Tracing*. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Almost every filter written by hand in a Spring application is a worse copy of
one that is already in the chain. Before you write anything at this layer, the
correct first move is to find out what is running: security, CORS, encoding,
proxy-header handling, request-context exposure, ETags, and a full HTTP
observation with metrics and trace correlation are all there, most of them turned
on by a property. The pipeline is not an empty pipe you fill; it is a populated
one you extend.**

## See what is actually registered, before anything else

```properties
logging.level.web=debug
```

The Boot reference states that this logs "details of the registered filters,
including their order and URL patterns" at startup. Read that list once for any
service you did not build yourself. It is faster than reasoning about
auto-configuration and it includes everything a starter contributed.

## Spring Security is a filter — one filter

The whole of Spring Security enters the pipeline through a single servlet filter,
and the layering is worth knowing because it explains why security decisions
happen before routing.

```
servlet container
└── DelegatingFilterProxy          a container-registered Filter that looks up a bean
    └── FilterChainProxy           ONE Spring bean: "a special Filter provided by
        │                          Spring Security that allows delegating to many
        │                          Filter instances through SecurityFilterChain"
        └── SecurityFilterChain    the first chain whose RequestMatcher matches wins
            ├── CsrfFilter                     ← exploit protection
            ├── BasicAuthenticationFilter      ← authentication
            ├── UsernamePasswordAuthenticationFilter
            └── AuthorizationFilter            ← authorization
                └── ... the rest of your filter chain, then DispatcherServlet
```

`DelegatingFilterProxy` exists to bridge two lifecycles: the container registers
it, and it looks the real `Filter` bean up from the `ApplicationContext` lazily.
That is also the general solution to the "filter beans are initialised very early"
problem from [chunk 8](08-registration-and-ordering.md).

`FilterChainProxy` being one bean is what gives Spring Security its ordering
guarantees. It selects a `SecurityFilterChain` by `RequestMatcher` rather than by
URL pattern alone, clears the `SecurityContext` at the end to avoid leaking it on
a pooled thread, and applies `HttpFirewall` checks. The internal ordering is
fixed and meaningful — exploit protection, then authentication, then
authorization — which is exactly the ordering a hand-written auth filter gets
wrong.

The practical consequence for this topic: **if your filter needs an
authenticated principal, it must be ordered after `FilterChainProxy`; if it must
run for requests security will reject, it must be before.** Everything else about
the chain is [Topic 11 — Spring Security](../11-spring-security/README.md).

## CORS: three mechanisms, and when the filter is the right one

The reference is precise about where CORS is handled: "Spring MVC `HandlerMapping`
implementations provide built-in support for CORS. After successfully mapping a
request to a handler, `HandlerMapping` implementations check the CORS
configuration for the given request and handler and take further actions.
Preflight requests are handled directly, while simple and actual CORS requests
are intercepted, validated, and have required CORS response headers set."

So preflight never reaches your controller, but it *is* routed — which is why
`@CrossOrigin` on a handler method can work at all.

```java
@Configuration
class WebConfiguration implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("https://app.example.com")
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
```

Defaults worth knowing, because they differ between the two entry points.
`@CrossOrigin` by default allows all origins, all headers, and all HTTP methods
the handler is mapped to. Global configuration defaults to all origins, all
headers, `GET`/`HEAD`/`POST`, `allowCredentials` disabled, and a `maxAge` of 30
minutes. `allowCredentials` is off deliberately — the reference notes it
"establishes a trust level that exposes sensitive user-specific information (such
as cookies and CSRF tokens) and should only be used where appropriate" — and when
it is on, wildcards are rejected in `allowedOrigins`; use `allowedOriginPatterns`
instead.

The `CorsFilter` is for when the decision has to be made **before** something
else in the chain. The Framework's filters page puts it plainly: "when used with
Spring Security, we advise relying on the built-in `CorsFilter` that must be
ordered ahead of Spring Security's chain of filters." Otherwise Security rejects
the unauthenticated preflight `OPTIONS` before the handler mapping ever sees it,
and the browser reports a CORS failure for what is really a 401. Spring Security
also has its own CORS support for exactly this reason — see
[Topic 11, chunk 12](../11-spring-security/12-cors-for-an-spa.md).

## The rest of the standing chain

| Filter | What it does, in the reference's words | How you get it |
|---|---|---|
| `CharacterEncodingFilter` | Applies a character encoding to request and response; can force it even when one is already set | Auto-configured; `server.servlet.encoding.charset`, `.enabled`, `.force` |
| `ForwardedHeaderFilter` | "modifies the request in order to a) change the host, port, and scheme based on `Forwarded` headers, and b) to remove those headers to eliminate further impact" | `server.forward-headers-strategy=FRAMEWORK` |
| `FormContentFilter` | Reads `application/x-www-form-urlencoded` bodies on `PUT`, `PATCH` and `DELETE` and makes them visible to `getParameter*()` | Auto-configured |
| `RequestContextFilter` | "exposes the request to the current thread, through both `LocaleContextHolder` and `RequestContextHolder`" | Auto-configured — but see the note below |
| `ShallowEtagHeaderFilter` | Caches the response body, computes an MD5 ETag, and answers `304` when `If-None-Match` matches | Register it yourself |
| `UrlHandlerFilter` | "removes the trailing slash from URL paths to ensure a consistent view of paths with or without a trailing slash" | Register it yourself |
| `CorsFilter` | CORS, at filter depth | Register it yourself, or use Security's |
| `ServerHttpObservationFilter` | The `http.server.requests` observation — metrics and tracing | Auto-configured |

Two of these are worth more than a table row.

**`ForwardedHeaderFilter` is what makes generated URLs correct behind a proxy.**
Without it, a service behind a TLS-terminating load balancer sees `http`, its
internal port, and its pod hostname, so every absolute URL it generates —
`Location` on a 201, pagination links, an OAuth2 redirect URI — points somewhere
the client cannot reach. Boot's own guidance is to try `server.forward-headers-strategy=NATIVE`
first, since "the Web servers themselves natively support this feature", and to
use `FRAMEWORK` when that is not enough. The property defaults to `NATIVE` on a
supported cloud platform and to `NONE` everywhere else — which is why this breaks
on a self-managed Kubernetes cluster and not on a PaaS. The filter also *removes*
the headers after applying them, deliberately, so nothing downstream re-applies
them. Ordering matters: the reference says it "must be ordered ahead of other
filters, such as `RequestContextFilter`, that should work with the modified and
not the original request".

**`RequestContextFilter` is probably not what you want.** Its javadoc says so:
"This filter is mainly for use with third-party servlets, for example, the JSF
FacesServlet. Within Spring's own web support, DispatcherServlet's processing is
perfectly sufficient." `DispatcherServlet` already exposes the same request
context, so `RequestContextHolder` works inside a controller without it. What the
filter buys is that the context is available *earlier* — in other filters, and in
code reached outside `DispatcherServlet`.

## Compression is not a filter you write

`server.compression.enabled=true` and the embedded container does it. The
defaults are conservative and correct: responses must be at least
`server.compression.min-response-size` bytes (default 2048), and only a fixed set
of content types is compressed — `text/html`, `text/xml`, `text/plain`,
`text/css`, `text/javascript`, `application/javascript`, `application/json`,
`application/xml` — adjustable with `server.compression.mime-types` (replacing the
list) or `server.compression.additional-mime-types` (adding to it). A hand-written
compressing filter has to wrap the response, negotiate `Accept-Encoding`,
recompute `Content-Length`, and avoid compressing already-compressed payloads.
There is no version of that which beats a property.

## Observability: metrics and correlation, already wired

`ServerHttpObservationFilter` is auto-configured, and it is the reason you should
never hand-write a timing filter. It produces an observation named
**`http.server.requests`** whose `uri` key value is "URI pattern for the matching
handler if available", falling back to `NOT_FOUND` for 404s rather than to the
raw path — which is exactly what stops a scanner from creating ten thousand time
series. On the tracing side, Micrometer Tracing plus a bridge gives you `traceId`
and `spanId` in the MDC and in the log pattern with no code at all, which is the
"check whether you need it" warning from [chunk 2](02-filters.md) made concrete.

Both, including the trap that makes the `error` tag read `none` on a dashboard
full of 500s, are [chunk 7](07-observability-and-correlation.md).

## Gotchas

**⚠️ A hand-written CORS filter fighting Spring Security**
**Symptom:** the browser reports a CORS error; the network tab shows a 401 on the
preflight `OPTIONS`.
**Cause:** Security ran before CORS and rejected an unauthenticated preflight,
which carries no credentials by design.
**Fix:** order `CorsFilter` ahead of Security's chain, as the reference advises,
or use Security's own CORS support.

**⚠️ Absolute URLs pointing at the pod behind a load balancer**
**Symptom:** `Location` headers, pagination links or OAuth redirects use `http`,
an internal hostname, or port 8080.
**Cause:** `server.forward-headers-strategy` defaults to `NONE` outside a
recognised cloud platform.
**Fix:** set it to `NATIVE`, or `FRAMEWORK` to use `ForwardedHeaderFilter` — and
make sure the proxy is actually setting the headers.

**⚠️ Trusting `X-Forwarded-*` from anywhere**
**Symptom:** a client spoofs its own scheme or host.
**Cause:** forwarded-header support was enabled on a service reachable directly,
not only through the proxy.
**Fix:** enable it only when a trusted proxy is genuinely in front, and make sure
that proxy overwrites rather than appends the headers.

## Interview questions

**★ How does Spring Security get into the request pipeline?**
Through one servlet filter. The container registers a `DelegatingFilterProxy`,
which lazily looks up the `FilterChainProxy` bean from the application context.
`FilterChainProxy` is described as "a special `Filter` provided by Spring
Security that allows delegating to many `Filter` instances through
`SecurityFilterChain`" — it picks the first chain whose `RequestMatcher` matches
and runs that chain's filters in a fixed order: exploit protection, then
authentication, then authorization. Being a single bean is what lets it also
clear the `SecurityContext` and apply `HttpFirewall` consistently.

**★ Preflight requests are failing with 401. What is going on?**
Spring Security is running before CORS. A preflight `OPTIONS` carries no
credentials by design, so an authenticating filter rejects it, and the browser
reports the whole thing as a CORS failure. The reference's advice is to order the
built-in `CorsFilter` ahead of Security's filters, or to use Security's own CORS
support, so the preflight is answered before authentication is attempted.

**★ Where is CORS actually handled in Spring MVC, and why can `@CrossOrigin` sit on a controller method?**
In `HandlerMapping`. After a request is mapped to a handler, the mapping checks
the CORS configuration for that request and handler: preflight requests are
answered directly, and actual cross-origin requests are validated and given the
response headers. Because the handler is resolved first, configuration attached
to the handler — `@CrossOrigin` — is available at the moment the decision is made.

**★ Why does `allowCredentials(true)` reject a wildcard origin?**
Because credentials plus a wildcard would let any site read authenticated
responses. The reference's framing is that `allowCredentials` "establishes a trust
level that exposes sensitive user-specific information (such as cookies and CSRF
tokens)". When you need a dynamic origin set with credentials, the supported route
is `allowedOriginPatterns`, which matches a pattern per request instead of echoing
anything.

**★ What does `ForwardedHeaderFilter` fix, and why does it also delete the headers?**
It rewrites the request's host, port and scheme from `Forwarded` /
`X-Forwarded-*` headers so that everything downstream — generated `Location`
headers, pagination links, OAuth redirect URIs — reflects the public address
instead of the pod's. It removes the headers afterwards, in the reference's words,
"to eliminate further impact": once the request itself is correct, anything else
re-reading the headers would apply the same transformation twice.

**★ A colleague wants a filter that gzips responses. Talk them out of it.**
`server.compression.enabled=true` is already there, in the container, with
sensible defaults — a 2048-byte minimum and a fixed content-type list, both
configurable. A hand-written version has to wrap the response, negotiate
`Accept-Encoding`, recompute or drop `Content-Length`, avoid double-compressing
images and archives, and interact correctly with every other filter that touches
the response. The container implementation has none of those bugs and costs one
line.

---

← Prev: [The decision table](05-the-decision-table.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Observability and correlation](07-observability-and-correlation.md)
