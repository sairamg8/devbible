---
title: "Whether an unauthenticated MockMvc request comes back 401 or 302 is not arbitrary and is not about credentials — Boot's default chain registers two authentication entry points behind media-type matchers, form login IGNORES */* while HTTP Basic matches it by equality, and a MockMvc request with no Accept header resolves to exactly */*"
sidebar_label: "08b · The 401 and the 302"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Security 7.1.1** sources —
> [`HttpBasicConfigurer`](https://github.com/spring-projects/spring-security/blob/7.1.1/config/src/main/java/org/springframework/security/config/annotation/web/configurers/HttpBasicConfigurer.java),
> [`AbstractAuthenticationFilterConfigurer`](https://github.com/spring-projects/spring-security/blob/7.1.1/config/src/main/java/org/springframework/security/config/annotation/web/configurers/AbstractAuthenticationFilterConfigurer.java),
> [`ExceptionHandlingConfigurer`](https://github.com/spring-projects/spring-security/blob/7.1.1/config/src/main/java/org/springframework/security/config/annotation/web/configurers/ExceptionHandlingConfigurer.java),
> [`DelegatingAuthenticationEntryPoint`](https://github.com/spring-projects/spring-security/blob/7.1.1/web/src/main/java/org/springframework/security/web/authentication/DelegatingAuthenticationEntryPoint.java),
> [`MediaTypeRequestMatcher`](https://github.com/spring-projects/spring-security/blob/7.1.1/web/src/main/java/org/springframework/security/web/util/matcher/MediaTypeRequestMatcher.java)
> and `AbstractConfiguredSecurityBuilder`; the **Spring Framework 7.0.9**
> [`HeaderContentNegotiationStrategy`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/accept/HeaderContentNegotiationStrategy.java);
> and the **Spring Boot 4.1.1** `ServletWebSecurityAutoConfiguration` plus its own
> `MockMvcSecurityIntegrationTests`. Version spine from `spring-boot-dependencies:4.1.1`:
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security
> 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries library source and derives behaviour from it; it does
> not report a test run.

**"Why is it a 401 here and a 302 there?" is the most-asked question about security in a
slice, and almost every answer given to it is wrong. It is not about which credentials you
sent, not about form login "winning", and not about ordering. Boot's default chain
registers two authentication entry points, each behind a media-type matcher, and the
matchers disagree about one media type: `*/*`. Form login is configured to ignore it; HTTP
Basic is configured to match it by equality. A `MockMvc` request with no `Accept` header
resolves to exactly `*/*`. That single asymmetry decides the status, which is why adding
`.accept(TEXT_HTML)` to an unrelated assertion flips it.** The wiring that makes security
active at all is [08](08-security-in-a-slice.md).

## Two entry points, one list, first match wins

`formLogin()` and `httpBasic()` each register a *preferred* `AuthenticationEntryPoint`
paired with a `RequestMatcher`, through the same method:

```java
public ExceptionHandlingConfigurer<H> defaultAuthenticationEntryPointFor(
        AuthenticationEntryPoint entryPoint, RequestMatcher preferredMatcher) {
    if (this.defaultEntryPoint == null) {
        this.defaultEntryPoint = DelegatingAuthenticationEntryPoint.builder();
    }
    this.defaultEntryPoint.addEntryPointFor(entryPoint, preferredMatcher);
    return this;
}
```

whose javadoc states the rule:

> *"Sets a default `AuthenticationEntryPoint` to be used which prefers being invoked for the
> provided `RequestMatcher`. If only a single default `AuthenticationEntryPoint` is
> specified, it will be what is used for the default `AuthenticationEntryPoint`. If multiple
> default `AuthenticationEntryPoint` instances are configured, then a
> `DelegatingAuthenticationEntryPoint` will be used."*

At request time that delegate walks the list in registration order and stops at the first
matcher that says yes:

```java
for (RequestMatcherEntry<AuthenticationEntryPoint> entry : this.entryPoints) {
    RequestMatcher requestMatcher = entry.getRequestMatcher();
    if (requestMatcher.matches(request)) {
        entry.getEntry().commence(request, response, authException);
        return;
    }
}
this.defaultEntryPoint.commence(request, response, authException);
```

So everything hangs on the two matchers.

## Basic's matcher

`HttpBasicConfigurer.registerDefaults`:

```java
MediaTypeRequestMatcher restMatcher = new MediaTypeRequestMatcher(contentNegotiationStrategy,
        MediaType.APPLICATION_ATOM_XML, MediaType.APPLICATION_FORM_URLENCODED,
        MediaType.APPLICATION_JSON, MediaType.APPLICATION_OCTET_STREAM,
        MediaType.APPLICATION_XML, MediaType.MULTIPART_FORM_DATA, MediaType.TEXT_XML);
restMatcher.setIgnoredMediaTypes(Collections.singleton(MediaType.ALL));
MediaTypeRequestMatcher allMatcher =
        new MediaTypeRequestMatcher(contentNegotiationStrategy, MediaType.ALL);
allMatcher.setUseEquals(true);
RequestMatcher notHtmlMatcher = new NegatedRequestMatcher(
        new MediaTypeRequestMatcher(contentNegotiationStrategy, MediaType.TEXT_HTML));
RequestMatcher restNotHtmlMatcher =
        new AndRequestMatcher(Arrays.asList(notHtmlMatcher, restMatcher));
RequestMatcher preferredMatcher = new OrRequestMatcher(
        Arrays.asList(X_REQUESTED_WITH, restNotHtmlMatcher, allMatcher));
```

Three alternatives: the `X-Requested-With: XMLHttpRequest` header; "asks for a REST media
type and does not ask for HTML"; or **exactly `*/*`**.

## Form login's matcher

`AbstractAuthenticationFilterConfigurer.getAuthenticationEntryPointMatcher`:

```java
MediaTypeRequestMatcher mediaMatcher = new MediaTypeRequestMatcher(contentNegotiationStrategy,
        MediaType.APPLICATION_XHTML_XML, new MediaType("image", "*"), MediaType.TEXT_HTML,
        MediaType.TEXT_PLAIN);
mediaMatcher.setIgnoredMediaTypes(Collections.singleton(MediaType.ALL));
RequestMatcher notXRequestedWith = new NegatedRequestMatcher(
        new RequestHeaderRequestMatcher("X-Requested-With", "XMLHttpRequest"));
return new AndRequestMatcher(Arrays.asList(notXRequestedWith, mediaMatcher));
```

"Looks like a browser, and is not an XHR."

## 🔴 The asymmetry: one ignores `*/*`, the other matches it

Both matchers are `MediaTypeRequestMatcher`. The difference is two setter calls.

Form login calls `setIgnoredMediaTypes(singleton(MediaType.ALL))`, and `shouldIgnore` skips
any requested type that *includes* the ignored one:

```java
private boolean shouldIgnore(MediaType httpRequestMediaType) {
    for (MediaType ignoredMediaType : this.ignoredMediaTypes) {
        if (httpRequestMediaType.includes(ignoredMediaType)) {
            return true;
        }
    }
    return false;
}
```

Basic's `allMatcher` calls `setUseEquals(true)`, which switches matching from compatibility
to identity:

```java
if (this.useEquals) {
    return this.matchingMediaTypes.contains(httpRequestMediaType);
}
```

`MediaTypeRequestMatcher`'s own javadoc spells out that this is deliberate — a request for
`*/*` matched by equality against a specific type returns **false**, and by the same token
`*/*` matched by equality against `MediaType.ALL` returns **true**.

And a request with no `Accept` header resolves to exactly `*/*`, because
`HeaderContentNegotiationStrategy` says so:

```java
String[] headerValueArray = request.getHeaderValues(HttpHeaders.ACCEPT);
if (headerValueArray == null) {
    return MEDIA_TYPE_ALL_LIST;
}
```

`MockMvc` sends no `Accept` header unless you ask for one — the request is empty until you
fill it ([01b](01b-the-blank-request.md)). So: resolved type `*/*`; form login ignores it;
Basic's `allMatcher` matches it; entry point is `BasicAuthenticationEntryPoint`; status
**401**, with `WWW-Authenticate: Basic realm="Realm"`.

```java
mvc.get().uri("/orders");                                              // 401
mvc.get().uri("/orders").accept(MediaType.TEXT_HTML);                  // 302 -> /login
mvc.get().uri("/orders").accept(MediaType.APPLICATION_JSON);           // 401
mvc.get().uri("/orders").header("X-Requested-With", "XMLHttpRequest"); // 401
mvc.get().uri("/orders").accept(MediaType.APPLICATION_PDF);            // 302 -> /login
```

Read off the two matchers, row by row:

| Request | Form-login matcher | Basic matcher | Entry point |
|---|---|---|---|
| no `Accept` → `*/*` | ignores `*/*` — no | `allMatcher` equals `*/*` — yes | 401 Basic |
| `Accept: text/html` | `text/html` — yes | never reached | 302 `/login` |
| `Accept: application/json` | no | `restNotHtmlMatcher` — yes | 401 Basic |
| `Accept: text/html, application/json` | `text/html` — yes | never reached | 302 `/login` |
| `X-Requested-With: XMLHttpRequest` | negated — no | `X_REQUESTED_WITH` — yes | 401 Basic |
| `Accept: application/pdf` | no | no | 302 `/login` (fallback) |

## The fallback, and why it is the redirect

The last row is the sharp edge: when nothing matches, `DelegatingAuthenticationEntryPoint`
uses its default, and the builder javadoc fixes what that is:

> *"Set the default `AuthenticationEntryPoint` if none match. The default is to use the
> first `AuthenticationEntryPoint` added in `addEntryPointFor(...)`."*

Boot's chain calls `formLogin(withDefaults())` before `httpBasic(withDefaults())`;
`AbstractConfiguredSecurityBuilder` holds configurers in a `LinkedHashMap` and runs `init()`
over `getConfigurers()` in insertion order; `Builder.addEntryPointFor` appends to an
`ArrayList`. Form login is registered first, so it is the fallback. An `Accept` type that
neither matcher recognises produces a redirect to a login page your API does not have.

Boot's own slice integration test pins the JSON row rather than the bare one —
`this.mvc.get().uri("/").accept(MediaType.APPLICATION_JSON)` asserted
`HttpStatus.UNAUTHORIZED`. The bare-request row is derived here from the matcher sources
above, not from a Boot test; it is a source derivation and it is the row that bites, because
a bare request is what everybody writes first.

## Gotchas

**★ Adding `.accept(MediaType.TEXT_HTML)` and watching the status flip 401 → 302.**
Nothing about authentication changed; the content-negotiation matcher picked the other
entry point. If a status assertion starts failing after somebody adjusted an `Accept` header
for an unrelated reason — to render a Thymeleaf view, to test a CSV export — this is why.

**★ Writing the test without an `Accept` header and never realising the test made a choice.**
A bare request is not neutral. It resolves to `*/*` and therefore *selects* HTTP Basic. If
your production clients always send `Accept: application/json`, the test is exercising a
branch the clients never take — the same status here, by luck rather than by design.

**★ An `Accept` type matching neither matcher redirects instead of challenging.**
`Accept: application/pdf` hits nothing in either list — not `text/html`, not the REST set,
not `*/*` by equality — so the fallback is form login's `LoginUrlAuthenticationEntryPoint`.
A binary-download endpoint therefore 302s where its JSON sibling 401s, in the same chain,
with the same absent credentials.

**★ Assuming `Accept: text/html, application/json` behaves like the JSON case.**
`HeaderContentNegotiationStrategy` sorts the parsed list by specificity, and
`MediaTypeRequestMatcher` returns on the **first non-ignored** entry it can decide. Form
login is consulted first and `text/html` is in its list, so a browser-ish `Accept` that also
mentions JSON still redirects. The question the matcher asks is not "does this client accept
JSON", it is "what is the first thing it says".

**★ Reading `X-Requested-With` as legacy noise you can ignore.**
It is a full first-class alternative in Basic's `OrRequestMatcher` and a hard *negation* in
form login's `AndRequestMatcher`. A test that sets it — or a `RequestPostProcessor` that
sets it for you — forces the Basic branch regardless of `Accept`, which is convenient when
you want determinism and confusing when you did not know it was there.

**★ Expecting the chosen entry point to depend on which authentication you sent.**
It does not depend on authentication at all. `ExceptionTranslationFilter` resolves the entry
point *after* authentication has already failed or been absent, purely from the request. A
wrong password and a missing password reach the same entry point and therefore the same
status.

**★ Assuming the matchers are the same in a custom chain.**
Both matchers are built inside the respective configurers, so they exist only if you called
`formLogin()` / `httpBasic()`. Call one, and its entry point is used unconditionally —
`DelegatingAuthenticationEntryPoint` is not even created, because the builder returns the
single entry point directly rather than wrapping it. The 401-versus-302 dance is specific to
chains that enable both, which is exactly what Boot's default does.

## Interview questions

**★ Why does the same unauthenticated request return 401 in one test and 302 in another?**
Because Boot's default chain enables both `formLogin()` and `httpBasic()`, and each registers
its entry point behind a media-type matcher. Form login's covers `application/xhtml+xml`,
`image/*`, `text/html` and `text/plain` and **ignores** `MediaType.ALL`; Basic's is an
`OrRequestMatcher` of `X-Requested-With: XMLHttpRequest`, a "REST but not HTML" matcher, and
an `allMatcher` on `MediaType.ALL` with `setUseEquals(true)`. A `MockMvc` request with no
`Accept` header resolves through `HeaderContentNegotiationStrategy` to `*/*` — form login
ignores it, Basic matches it by equality — so the answer is 401. Send `Accept: text/html`
and form login matches first, so the answer is 302 to `/login`. The status is a function of a
header, not of the credentials.

**★ What is `setUseEquals(true)` doing, and why does it matter here?**
It switches `MediaTypeRequestMatcher` from `isCompatibleWith` to `contains` — from "these
types overlap" to "this is exactly that type". Without it, `MediaType.ALL` would be
compatible with everything and Basic's `allMatcher` would match every request, making form
login unreachable. With it, the `allMatcher` fires only for a client that literally said
`*/*` — precisely the "I have no opinion" case, where a browser redirect would be the wrong
answer.

**★ What does `setIgnoredMediaTypes(singleton(MediaType.ALL))` accomplish on the other side?**
It makes form login refuse to claim the no-opinion case. `shouldIgnore` skips any requested
type that *includes* the ignored one, so `*/*` is dropped from consideration before the
`text/html` comparison ever happens. The two settings are a matched pair: one side declines
`*/*`, the other side claims it, and between them the ambiguous request is routed to the
machine-friendly challenge.

**★ What happens when the `Accept` header matches neither entry point?**
`DelegatingAuthenticationEntryPoint` falls back to its default, and the builder's default is
*the first entry point added*. Boot registers form login before HTTP Basic — the configurers
live in a `LinkedHashMap` and `init()` runs in insertion order — so the fallback is the login
redirect. That is why `Accept: application/pdf` produces a 302 in a chain that gives
`Accept: application/json` a 401.

**★ Does sending the wrong password change which entry point answers?**
No. The entry point is selected by `ExceptionTranslationFilter` from the request alone, once
authentication has already failed or was never attempted. Bad credentials, absent
credentials and an expired session all arrive at the same matcher evaluation and therefore
the same status.

What all of this means for the assertions you write is
[08c · Asserting protection, not the challenge](08c-asserting-protection-not-the-challenge.md).

{/* FOOTER */}
