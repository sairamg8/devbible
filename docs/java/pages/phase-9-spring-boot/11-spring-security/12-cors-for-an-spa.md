---
title: "CORS for an SPA and an API"
sidebar_label: "12 · CORS"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *CORS*
> (docs.spring.io/spring-security/reference/servlet/integrations/cors.html —
> "CORS must be processed before Spring Security…", the
> `UrlBasedCorsConfigurationSource` bean, `http.cors(withDefaults())`,
> per-chain `cors(cors -> cors.configurationSource(...))`, the multiple-bean
> restriction and the `CorsConfigurer::disable` warning) and the Spring
> Framework reference on CORS. Spring Boot 4.1.0, Spring Framework 7.0.x,
> Spring Security 7.x, JDK 25.

**CORS is not a security feature of your server. It is a rule the *browser*
enforces on *its own* JavaScript, and every configuration option you set is you
telling the browser to relax it. Understanding that inversion is the difference
between configuring CORS and cargo-culting it: nothing you do here protects your
API, and everything you do here decides whether a browser will let a page talk
to it.**

## What actually happens

The same-origin policy stops a page at `https://app.example.com` reading a
response from `https://api.example.com` — different host, different origin.
CORS is the opt-in: the *server* sends headers saying which origins may read its
responses, and the browser obeys them.

For anything beyond a simple request, the browser asks first:

1. Page calls `fetch('https://api.example.com/orders', { method: 'POST',
   headers: { 'Content-Type': 'application/json' }})`.
2. Browser sends an **`OPTIONS`** request to that URL — the **preflight** —
   carrying `Origin`, `Access-Control-Request-Method` and
   `Access-Control-Request-Headers`. **No cookies. No `Authorization` header.**
   The application's JavaScript never sees it.
3. Server answers with `Access-Control-Allow-Origin`, `-Allow-Methods`,
   `-Allow-Headers`, optionally `-Allow-Credentials` and `-Max-Age`.
4. Only if that answer permits it does the browser send the real request.

Step 2 is the whole reason Spring Security has a CORS integration at all.

## 🔴 Why CORS must be in the security chain

The reference states it directly:

> CORS must be processed before Spring Security, because the pre-flight request
> does not contain any cookies (that is, the `JSESSIONID`). If the request does
> not contain any cookies and Spring Security is first, the request determines
> that the user is not authenticated (since there are no cookies in the request)
> and rejects it.

So: preflight arrives with no credentials → your `anyRequest().authenticated()`
rule denies it → 401 → the browser reports a CORS failure → you spend an
afternoon adding origins to a configuration the request never reached.

**Configuring CORS on your MVC controllers with `@CrossOrigin` does not fix
this.** `@CrossOrigin` is handled inside `DispatcherServlet`, which is
downstream of the security filters. If Spring Security rejects the preflight,
MVC never runs. This is the same "filters are upstream of MVC" fact that
explains why `@ControllerAdvice` cannot see a 403
([chunk 2](02-the-filters-that-matter.md)), showing up in a second disguise.

## The configuration

The simplest correct form — one bean, one line in the chain:

```java
@Bean
UrlBasedCorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://app.example.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN"));
    config.setAllowCredentials(true);
    config.setMaxAge(Duration.ofMinutes(30));

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}

@Bean
SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")
        .cors(Customizer.withDefaults())          // ← picks up the bean above
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(CsrfConfigurer::disable)
        .build();
}
```

Three documented details that decide whether this works:

- **"Spring Security will automatically configure CORS only if a
  `UrlBasedCorsConfigurationSource` instance is present."** Declaring the bean as
  the interface type `CorsConfigurationSource` is not enough — the concrete type
  is what the auto-detection looks for.
- **Two such beans and it does nothing**, "because it cannot decide which one to
  use". A second one introduced by a library is a silent breakage.
- For several chains with different policies, pass the source per chain:

```java
.cors(cors -> cors.configurationSource(apiConfigurationSource()))
```

Without a `CorsConfigurationSource` bean and with Spring MVC on the classpath,
Spring Security "will use CORS configuration provided to Spring MVC" — so a
`WebMvcConfigurer#addCorsMappings` setup is honoured. That is a genuine option;
what does not work is `@CrossOrigin` on a controller as the *only* CORS
configuration, because it is per-handler and Spring Security has no handler at
preflight time.

## 🔴 `allowCredentials` and the wildcard

`setAllowedOrigins(List.of("*"))` together with `setAllowCredentials(true)` is
**rejected** — the CORS specification forbids the combination, and Spring throws
rather than silently producing a header no browser will honour.

The reason is worth understanding rather than working around. `*` means "any
site may read this response". `allowCredentials` means "and the browser should
attach the user's cookies". Together they say: *any page on the internet may
make authenticated requests as the logged-in user and read the results.* That is
CSRF with the response body included.

If you need a pattern rather than an exact list, use
`setAllowedOriginPatterns(List.of("https://*.example.com"))`, which echoes the
matching origin back rather than sending `*`. Note the property this preserves:
the response names one origin, so the browser only grants that origin access.
It is a convenience for many subdomains, not a way to say "everyone".

⚠️ Reaching for `allowedOriginPatterns("*")` to make the exception go away
recreates exactly the situation the specification banned, one step further from
anyone noticing.

## What disabling CORS actually does

The reference is blunt about the common misreading:

> CORS is a browser-based security feature. By disabling CORS in Spring Security
> with `.cors(CorsConfigurer::disable)`, you are not removing CORS protection
> from your browser. Instead, you are removing CORS support from Spring
> Security, and users will not be able to interact with your Spring backend from
> a cross-origin browser application.

Disabling CORS does not open anything up. It closes the browser door and leaves
every non-browser client — curl, another service, a mobile app — entirely
unaffected, because none of them enforce the same-origin policy in the first
place.

Which is the whole point: **CORS protects users of other sites from your API's
authority over their browser session. It has never protected your API.** An
attacker with an HTTP client ignores all of it.

## The trade-off

Same-origin serving — the SPA and the API behind one origin, via a reverse proxy
or Boot serving the built frontend — removes this entire topic. No preflights,
no origin list, no `allowCredentials` question, and cookies work without
`SameSite` gymnastics. The cost is a deployment coupling: one origin means one
routing layer that has to know about both, and independently deployed frontends
become slightly harder.

Cross-origin buys that independence and pays for it with a configuration that
must be correct in two places (browser policy and security chain), fails in a
way the browser reports misleadingly, and has one combination that is a genuine
vulnerability if forced.

## Gotchas

**Symptom:** The browser reports a CORS error; the server log shows a 401 on an
`OPTIONS` request.
**Cause:** CORS is not configured in the security chain, so the credential-free
preflight was rejected by an `authenticated()` rule.
**Fix:** `http.cors(Customizer.withDefaults())` plus a
`UrlBasedCorsConfigurationSource` bean.

**Symptom:** `@CrossOrigin` on the controller has no effect at all.
**Cause:** MVC never ran — Spring Security rejected the preflight first.
**Fix:** Configure CORS in the security chain. `@CrossOrigin` can stay, but it
cannot be the only configuration.

**Symptom:** A startup or runtime error about `allowCredentials` and a wildcard
origin.
**Cause:** `*` origins with `allowCredentials(true)` — forbidden by the spec.
**Fix:** List the origins explicitly, or use `setAllowedOriginPatterns` with a
real pattern. Do not pattern-match `*` to silence it.

**Symptom:** CORS worked, then stopped after adding a library.
**Cause:** A second `UrlBasedCorsConfigurationSource` bean; Spring Security
cannot choose and configures nothing.
**Fix:** One bean, or per-chain `cors(cors -> cors.configurationSource(...))`.

**Symptom:** `GET` works cross-origin, `POST` with JSON does not.
**Cause:** A `GET` with simple headers needs no preflight; a JSON `POST` does.
The preflight path was never exercised until now.
**Fix:** Same fix, and test with a preflighted request rather than a simple one.

**Symptom:** The frontend cannot read a custom response header it needs.
**Cause:** Only a small set of response headers is exposed by default.
**Fix:** `config.setExposedHeaders(List.of("X-Total-Count", "Location"))`.

**Symptom:** Cookies are not sent cross-origin even with `allowCredentials(true)`.
**Cause:** The browser also needs the request to opt in (`credentials:
'include'`) and the cookie to carry `SameSite=None; Secure`.
**Fix:** Both sides. Server-side `allowCredentials` alone changes nothing.

**Symptom:** Preflights on every single request, and latency to match.
**Cause:** No `Access-Control-Max-Age`, so the browser cannot cache the answer.
**Fix:** `config.setMaxAge(Duration.ofMinutes(30))` — browsers cap it, so treat
it as a hint rather than a guarantee.

**Symptom:** Everything works locally and fails in production.
**Cause:** The allowed-origin list is environment-specific and was hardcoded.
**Fix:** Bind it from configuration
([Topic 06 — Configuration and profiles](../06-configuration-and-profiles/01-the-environment-and-precedence.md))
so each environment names its own frontend origin.

## Interview questions

**★ What is CORS actually protecting, and from whom?**
It protects a user's browser session from other sites. The same-origin policy
stops a page at one origin reading responses from another; CORS is the server's
opt-in to relax it for named origins. It does not protect your API — any
non-browser client ignores it entirely.

**★ Why must CORS be configured in the Spring Security chain and not only in MVC?**
Because the preflight `OPTIONS` request carries no cookies and no
`Authorization` header, so if authentication runs first it rejects it as
unauthenticated. Security filters run upstream of `DispatcherServlet`, so
`@CrossOrigin` never gets the chance.

**★ What is a preflight, and when does the browser send one?**
An `OPTIONS` request the browser sends on its own before a cross-origin request
that is not "simple" — a non-simple method, a `Content-Type` outside the small
allowed set, or custom headers. It asks whether the real request is permitted
and carries no credentials.

**★ Why is `allowedOrigins("*")` with `allowCredentials(true)` rejected?**
Because it would mean any page on the internet could make authenticated requests
as the logged-in user *and read the responses*. The specification forbids the
combination and Spring enforces it rather than emitting a header browsers would
ignore. Use an explicit list, or `allowedOriginPatterns`, which echoes the single
matching origin back.

**★ What does `.cors(CorsConfigurer::disable)` do?**
Removes Spring Security's CORS support, which means cross-origin browser
applications can no longer talk to the backend. It does not disable any
protection on the client side and has no effect at all on non-browser clients —
so it is never a way to "make CORS problems go away", only a way to make browser
integration stop working.

**★ Your CORS configuration silently stops taking effect after a dependency upgrade. First hypothesis?**
A second `UrlBasedCorsConfigurationSource` bean arrived with the dependency.
Spring Security auto-configures CORS only when exactly one such bean exists,
because with two it cannot choose. Fix by consolidating, or configure the source
per chain explicitly.

**★ How would you avoid this whole topic?**
Serve the SPA and the API from one origin — a reverse proxy in front of both, or
Boot serving the built frontend as static resources. There are then no
cross-origin requests, so no preflights, no origin list and no credentials
question, at the cost of coupling the two deployments to a shared routing layer.

---

← Prev: [Password encoding](11-password-encoding.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [CSRF decisions](13-csrf-decisions.md)
