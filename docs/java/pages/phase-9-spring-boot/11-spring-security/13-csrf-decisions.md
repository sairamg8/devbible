---
title: "CSRF: one decision, two right answers"
sidebar_label: "13 · CSRF decisions"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Cross Site
> Request Forgery (CSRF)*
> (docs.spring.io/spring-security/reference/servlet/exploits/csrf.html —
> when to disable, `HttpSessionCsrfTokenRepository`, `CookieCsrfTokenRepository.withHttpOnlyFalse()`,
> `XorCsrfTokenRequestAttributeHandler` and BREACH protection, deferred token
> loading, the SPA guidance and `csrf.spa()`, `CsrfAuthenticationStrategy` and
> `CsrfLogoutHandler`). Spring Boot 4.1.1, Spring Security 7.x, JDK 25.

**`csrf.disable()` is correct for one kind of application and reckless for
another, and the two look almost identical from the outside. The question is not
"is this an API" — it is "does the browser attach the credential to the request
automatically?" If the answer is yes, you need CSRF protection. If the answer is
no, you do not.**

## The attack, in four steps

1. A user logs into `bank.example.com`. The browser holds a session cookie.
2. They visit `evil.example.com`, which contains
   `<form action="https://bank.example.com/transfer" method="POST">` and submits
   it with script.
3. **The browser attaches the `bank.example.com` cookie**, because cookies are
   scoped to the destination, not to the page that caused the request.
4. The server sees a perfectly authenticated request and performs the transfer.

Nothing was stolen. The attacker never read a response and never saw the cookie.
They caused an *authenticated* action by exploiting the fact that the browser
supplies the credential on its own.

That last sentence is the entire criterion.

## The criterion, stated once

**CSRF is possible exactly when the browser attaches the credential
automatically.** Cookies do that. Session ids do that. HTTP Basic credentials
cached by the browser do that. `Authorization: Bearer …` does **not** — some
JavaScript has to read the token from memory or storage and set the header, and
the attacker's page cannot run JavaScript in your origin.

So:

| Credential | Automatic? | CSRF-vulnerable? |
|---|---|---|
| Session cookie | yes | **yes** |
| Any cookie-based auth, including a JWT-in-a-cookie | yes | **yes** |
| `Authorization: Bearer …` set by JS | no | no |
| Client TLS certificate | yes | yes |

The reference's guidance says the same thing in terms of who is calling:

> A backend application that *does not* serve browser traffic may choose to
> disable CSRF.

with protection recommended for applications where end users log in and browser
traffic uses session cookies.

⚠️ **A JWT stored in a cookie is cookie-based authentication.** People disable
CSRF because "we use JWTs" and then store the JWT in a cookie for convenience,
which reintroduces the vulnerability while the configuration says it was
considered and dismissed. The token format is irrelevant; the transport is
everything.

## Answer one: a stateless bearer-token API

```java
.csrf(CsrfConfigurer::disable)
.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
```

Correct, and correct for a stated reason: nothing about this chain accepts an
ambient credential, so a cross-site form post arrives with no `Authorization`
header and is rejected as unauthenticated.

The two lines belong together. `STATELESS` is what makes the claim true — it
installs a `NullSecurityContextRepository` so a session cookie cannot
authenticate anything. Disabling CSRF while leaving `IF_REQUIRED` in place means
a session *can* be created and *can* authenticate, and you have removed the
protection for it.

**Write the reason in a comment.** `csrf.disable()` with no justification is
indistinguishable from `csrf.disable()` copied from a tutorial, and the next
person to add a cookie-based login to this chain will not know they broke
something.

## Answer two: a cookie-session SPA

Here disabling it is a genuine vulnerability. The mechanism Spring Security uses
is the synchronizer token: a random token is issued, the client must return it
in a header or parameter, and an attacker's page cannot read it (same-origin
policy) so cannot include it.

The token has to reach JavaScript, so it goes in a cookie the script can read:

```java
http.csrf(csrf -> csrf
        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()));
```

The reference is careful here:

> The example explicitly sets `HttpOnly` to `false`. This is necessary to let
> JavaScript frameworks (such as Angular) read it. If you do not need the
> ability to read the cookie with JavaScript directly, we *recommend* omitting
> `HttpOnly` (by using `new CookieCsrfTokenRepository()` instead) to improve
> security.

A readable CSRF cookie is not the same risk as a readable session cookie — the
CSRF token is not a credential — but a non-`HttpOnly` cookie is still readable by
any injected script, so only make it readable if the client genuinely reads it.

The default repository, if you say nothing, is `HttpSessionCsrfTokenRepository`,
which keeps the expected token in the session and is right for server-rendered
forms.

## The BREACH subtlety, and why the SPA case needs a handler

Spring Security defends against BREACH by randomising the token on every
request:

> BREACH protection is provided by encoding randomness into the CSRF token value
> to ensure the returned `CsrfToken` changes on every request. When the token is
> later resolved as a header value or request parameter, it is decoded to obtain
> the raw token which is then compared to the persisted `CsrfToken`.

This is `XorCsrfTokenRequestAttributeHandler`, on by default. It creates a
mismatch for the cookie-plus-SPA combination:

> When storing the expected CSRF token in a cookie, JavaScript applications will
> only have access to the plain token value and *will not* have access to the
> encoded value. A customized request handler for resolving the actual token
> value will need to be provided.

The cookie holds the **raw** token; the handler expects the **XOR-encoded** one.
The SPA sends what it read, the server decodes something that was never encoded,
and every mutating request 403s — with correct-looking configuration on both
sides. This is the hardest failure in the topic to diagnose from symptoms.

Spring Security ships the answer as one method:

```java
http.csrf(CsrfConfigurer::spa);
```

`spa()` applies the cookie repository and the matching request handler together.
Use it rather than assembling the pieces, because assembling them is exactly
where the mismatch comes from.

One more documented requirement:

> Refreshing the token after authentication success and logout success is
> required because the `CsrfAuthenticationStrategy` and `CsrfLogoutHandler` will
> clear the previous token.

The token is deliberately rotated at login and logout — otherwise a token
obtained before login would remain valid after it. The client must therefore
re-read the cookie after both events; an SPA that caches the token at startup
will start failing immediately after a login.

## Deferred loading

> By default, Spring Security defers loading of the `CsrfToken` until it is
> needed.

Because the token normally lives in the session, deferring means a read-only
`GET` need not load the session at all. Useful, and it produces one surprise: a
`GET` endpoint that exists only to hand the token to a client may return nothing
unless something actually causes the token to be resolved — which is why the
usual pattern is to read it from the cookie rather than from a bespoke endpoint.

## The trade-off

CSRF protection costs a token round-trip and a class of confusing 403s, and
protects against an attack that is invisible in your logs when it succeeds
(every forged request looks legitimate, because it *is* legitimate — it simply
was not intended). Disabling it costs nothing today and everything on the day
somebody adds a cookie login.

The decision should be written down next to the code, because the failure mode
of a wrong `csrf.disable()` is not an error — it is normal operation with one
protection missing.

## Gotchas

**Symptom:** Every `POST` returns 403 with no useful message.
**Cause:** CSRF enabled and no token sent.
**Fix:** Send it, or make the deliberate decision to disable for a genuinely
stateless chain.

**Symptom:** An SPA sends the token from the cookie and still gets 403.
**Cause:** The BREACH XOR mismatch — the cookie holds the raw token, the default
handler expects the encoded one.
**Fix:** `http.csrf(CsrfConfigurer::spa)`.

**Symptom:** Everything works until the user logs in, then all mutations 403.
**Cause:** `CsrfAuthenticationStrategy` rotated the token on login and the
client is still sending the pre-login one.
**Fix:** Re-read the cookie after login and after logout.

**Symptom:** `csrf.disable()` and the app is still CSRF-vulnerable.
**Cause:** Session cookies still authenticate, because `SessionCreationPolicy`
was not `STATELESS` — or the JWT is stored in a cookie.
**Fix:** Make the chain genuinely stateless, or re-enable CSRF. The two lines go
together.

**Symptom:** CSRF protection on the API chain breaks non-browser clients.
**Cause:** One chain serving both audiences.
**Fix:** Split them — `securityMatcher` on the API chain
([chunk 6](06-matchers-and-multiple-chains.md)) — rather than weakening the one
policy for both.

**Symptom:** `GET` requests are rejected for a missing token.
**Cause:** They should not be — safe methods are exempt by default. Something
made a state-changing operation a `GET`, or a custom `RequireCsrfProtectionMatcher`
was installed.
**Fix:** If a `GET` changes state, that is the bug; CSRF protection is reporting
it.

**Symptom:** A logout link stops working after enabling CSRF.
**Cause:** `POST /logout` requires a token, and a plain `<a href="/logout">` is a
`GET`.
**Fix:** Submit a form with the token. Logout via `GET` is itself CSRF-able —
harmless-seeming, but it lets any page log your users out.

**Symptom:** The token cookie is not sent to the API at all.
**Cause:** Cross-origin request without `credentials: 'include'`, or a cookie
without `SameSite=None; Secure`.
**Fix:** Both, and note that `SameSite=Lax` is itself a partial CSRF defence —
which is a reason to prefer same-origin deployment, not a replacement for the
token.

## Interview questions

**★ What is CSRF, in one sentence?**
An attacker causing a victim's browser to make an authenticated request to your
site, exploiting the fact that the browser attaches the credential
automatically — without the attacker ever reading a response or seeing the
credential.

**★ When is `csrf.disable()` correct?**
When nothing about the request authenticates ambiently: a stateless chain that
accepts only a bearer token set by JavaScript, with
`SessionCreationPolicy.STATELESS` so no session cookie can authenticate either.
Those two settings are one decision, not two.

**★ "We use JWTs, so CSRF does not apply." What is missing?**
Where the JWT is stored. In a cookie it is attached automatically by the browser
and the application is fully CSRF-vulnerable regardless of the token format. The
transport decides, not the credential's encoding.

**★ Why does an SPA reading the token from a cookie still get 403?**
Because BREACH protection XOR-encodes the token per request. The cookie holds
the raw value while the default `XorCsrfTokenRequestAttributeHandler` expects
the encoded one, so decoding fails. `http.csrf(CsrfConfigurer::spa)` configures
the repository and the matching handler together.

**★ What is BREACH protection doing and why?**
BREACH exploits HTTP compression to recover secrets that repeat across
responses. Randomising the CSRF token on every response means the value never
repeats, so there is nothing for the attack to converge on. It is on by default
and costs nothing except the SPA subtlety above.

**★ Why is the token rotated at login and logout?**
Because a token obtained before authentication would otherwise stay valid
afterwards, which is a session-fixation-shaped hole. `CsrfAuthenticationStrategy`
and `CsrfLogoutHandler` clear it, so clients must re-read the token after both
events.

**★ Why are `GET` requests exempt?**
Because safe methods are not supposed to change state, so forging one achieves
nothing — and requiring a token on every navigation would be unworkable. If a
`GET` in your application does change state, the exemption is not the bug; the
`GET` is.

**★ Does `SameSite=Lax` make CSRF tokens unnecessary?**
No. It is a strong mitigation and a good default, but it is enforced by the
browser and varies by browser and version, it does not cover every request
shape, and it is a property of the cookie rather than of your application. Treat
it as defence in depth alongside the token, not as a replacement.

**★ How do you serve a browser SPA and a machine API from one Boot application without weakening either?**
Two chains. The API chain gets a `securityMatcher`, `STATELESS`, bearer tokens
and CSRF disabled with the reason written down. The browser chain gets sessions,
form login and `csrf(CsrfConfigurer::spa)`. One chain serving both forces a
single answer to a question that has two right ones.

---

← Prev: [CORS for an SPA and an API](12-cors-for-an-spa.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The traps](14-the-traps.md)
