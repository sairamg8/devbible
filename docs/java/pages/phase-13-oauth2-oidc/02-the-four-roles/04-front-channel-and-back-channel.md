---
title: "Half of OAuth2's security reasoning is a single distinction the specification never names in one place — whether a message travels through the user's browser or between two servers — and once you can label every arrow in a flow with it, which attacks are possible on which step becomes something you can derive instead of memorise"
sidebar_label: "04 · Front and back channel"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.2 (Protocol Flow), §3.1 (Authorization Endpoint),
> §3.1.2 (Redirection Endpoint), §3.2 (Token Endpoint), §4.1 (Authorization Code Grant),
> §10.3 (Access Token Credentials) and §10.4 (Refresh Tokens); RFC 9700 §2.1 and §2.1.2 — at
> [datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**The terms "front channel" and "back channel" are OAuth2 folklore rather than RFC 6749
vocabulary, but the distinction is baked into the design and it explains more than any
diagram. A front-channel message travels through the user's browser: it is visible to the
user, logged in history, sent in a URL, and can be tampered with or replayed by anyone with
access to that browser or the network path around it. A back-channel message is a direct
server-to-server HTTPS call: nothing intermediate sees it, and the parties can authenticate
each other. Once you know which arrow is which, every design rule in the specification —
why the code goes to the front and the token to the back, why `state` exists, why the
implicit grant died — stops being a rule and becomes an inference.**

## The two channels, precisely

| | Front channel | Back channel |
|---|---|---|
| Path | Client → browser → AS, and AS → browser → client | Client → AS, directly |
| Mechanism | HTTP redirects with URL parameters | An HTTPS POST |
| Visible to the user | ✅ entirely — address bar, DevTools, history | ⛔ never |
| Logged by | Browser history, proxies, server access logs, `Referer` | Only the two endpoints |
| Client authentication possible | ⛔ no | ✅ yes |
| Integrity | None — the user or malware can alter parameters | TLS, plus mutual authentication if configured |
| Used for | The authorization request and the authorization response | The token request, refresh, introspection, revocation, JWKS |

## Every arrow in the authorization code flow, labelled

| Step | Message | Channel | Why it must be there |
|---|---|---|---|
| 1 | Client redirects browser to `/authorize` | **Front** | The user must see and interact with the AS's login and consent UI |
| 2 | User authenticates and consents at the AS | **Front**, at the AS | This is the whole point — the client is not in the room |
| 3 | AS redirects browser back with `code` and `state` | **Front** | It has to come back through the browser; there is no other path to the client |
| 4 | Client POSTs `code` to `/token`, authenticating itself | **Back** | Where the actual credential is exchanged, invisibly and authenticated |
| 5 | AS returns the access token (and refresh token) | **Back** | ⭐ **the tokens never touch the browser** |
| 6 | Client calls the API with the token | **Back** | Server to server |
| 7 | Resource server fetches JWKS, or introspects | **Back** | Out of band, not part of the flow |

🔴 **Step 5 is the whole design.** The authorization code goes through the front channel,
where it is exposed — and it is *deliberately* the thing exposed, because a code is
single-use, short-lived, and useless without client authentication or a PKCE verifier. The
access token and refresh token go through the back channel, where nothing sees them. The
authorization code exists precisely so that something disposable can take the dangerous
route.

**That sentence is the answer to "why not just return the token in the redirect?" — and
"just return the token in the redirect" is the definition of the implicit grant**, which RFC
9700 §2.1.2 says clients SHOULD NOT use.

## What the front channel leaks, concretely

A URL parameter is not a private place. An authorization response
`https://app.example.com/callback?code=…&state=…` is:

- **In the browser's address bar** — screenshotted, screen-shared, read over a shoulder.
- **In browser history**, surviving the session, readable by extensions with history
  permission.
- **In the `Referer` header** of any request the callback page makes to another origin —
  an analytics beacon, a font, an image. This is a real exfiltration path and the reason a
  callback page should be minimal and redirect immediately.
- **In server access logs**, at your reverse proxy, your CDN, your application server, and
  any corporate middlebox on the path. Query strings are logged by default nearly
  everywhere.
- **In the browser's session restore**, in crash reports, in sync-to-cloud history.

RFC 6749 §10.3 says as much about access tokens generally — they must not be transmitted in
the clear and must be protected in storage — and it is why RFC 6750's query-parameter form
for sending bearer tokens is avoided in practice. Everything in that list applies equally to
an authorization code, which is why a code must be single-use and short-lived.

## The user is an active participant in the front channel

The uncomfortable part: the resource owner **can** modify front-channel parameters. They can
edit the authorization URL to request different scopes, change the `redirect_uri`, or replay
the callback. This is not an attack scenario to defend the user against — it is a structural
fact that determines where trust may be placed.

**Therefore: never trust a front-channel parameter as an authorization decision.** Scopes
requested in the URL are a *request*; the authorization server decides what to grant, and
the token says what was granted. A client that reads the `scope` it asked for and behaves as
though it was granted has trusted a value the user controls.

## `state` and the front channel's missing integrity

Because the front channel has no integrity and no client authentication, the client cannot
tell whether a callback it receives belongs to a flow it started. `state` is the fix: an
unguessable value the client generates, stores against the user's session, sends in the
authorization request, and compares on the callback.

```java
// The property that matters: state is bound to THIS user's session, server-side.
// Comparing the returned state to itself, or to a value in a cookie the attacker also
// controls, proves nothing.
String expected = session.getAttribute("oauth2_state");
if (expected == null || !constantTimeEquals(expected, request.getParameter("state"))) {
    throw new BadCredentialsException("state mismatch");   // CSRF on the callback
}
session.removeAttribute("oauth2_state");   // single use
```

Spring Security's `oauth2Login` and `OAuth2AuthorizationRequestRedirectFilter` do this for
you via an `AuthorizationRequestRepository` — the failure mode to know is that a
misconfigured or missing repository silently disables the check. **`state` defends against
CSRF on the callback; PKCE defends against code interception. They are different attacks and
neither substitutes for the other** — the full argument is
[03 · Authorization code flow with PKCE](../03-authorization-code-pkce/README.md).

## Why back-channel calls need no `state`

The token request is authenticated (for confidential clients), direct, and its response is
tied to the request by the TCP/TLS connection itself. There is no third party to confuse and
no cross-site context. This is also why client authentication is possible only there — there
is nowhere in a redirect to put a secret without publishing it.

## Where this gets subtle: back-channel logout and the device flow

Two places the neat picture blurs, both worth recognising:

- **Back-channel logout** (an OIDC extension) has the AS call each client's logout endpoint
  server-to-server, precisely because a front-channel logout via hidden iframes is defeated
  by third-party cookie restrictions. Same distinction, applied to sign-out.
- **The device authorization grant** (RFC 8628) exists because some clients have *no* front
  channel at all — a TV, a CLI. It replaces the redirect with a user code typed on a second
  device, and the client polls the token endpoint on the back channel. Recognising it as
  "front channel unavailable, so move the user to a different device" makes it obvious
  rather than exotic.

## Gotchas

**★ Anything in a redirect URL is public to the user and to your logs.**
Codes, `state`, error descriptions — all of it. Design as though every query parameter is
written to a log file, because it usually is.

**★ The `Referer` header exfiltrates authorization codes from careless callback pages.**
If the callback page loads an off-origin asset before redirecting, the full URL including
the code can travel in `Referer`. Redirect immediately, and set a `Referrer-Policy`.

**★ `state` is not PKCE and PKCE is not `state`.**
`state` binds the callback to the session that started the flow — it stops CSRF on the
callback. PKCE binds redemption of the code to the party that generated the verifier — it
stops a stolen code being exchanged. Implementing one and calling the other done is a common
review finding.

**★ `state` must be stored server-side against the session, not merely echoed.**
Comparing the returned `state` to a value the attacker can also set — an unprotected cookie,
`localStorage`, a hidden field — proves nothing. Bind it to the session.

**★ Never make an authorization decision from a front-channel parameter.**
The `scope` you requested is not the scope you were granted. Read what was granted from the
token, not from the URL you sent.

**★ Client secrets cannot appear in the front channel, ever.**
There is no way to put one in a redirect without publishing it to the browser. This is the
mechanical reason a public client cannot authenticate, and the reason the implicit grant had
to be secretless.

**★ "It is HTTPS, so the URL is safe" confuses transport with storage.**
TLS protects the parameter in transit. It does nothing about the address bar, browser
history, the `Referer` header or the access log at the other end — all of which happen after
decryption.

**★ Error responses come back on the front channel too.**
`?error=access_denied&error_description=…` is user-visible and user-modifiable. Do not
render `error_description` into your page unescaped — it is attacker-influenced text and has
produced real XSS.

**★ A single-page application's callback runs in the front channel by definition.**
Which is why an SPA doing the code exchange must use PKCE and must never hold a client
secret, and why the BFF pattern exists to move the exchange to the back channel entirely.

**★ Losing `state` across a deployment breaks logins in a way that looks random.**
If `state` lives in an in-memory session and the user's next request lands on a different
instance or after a redeploy, the callback fails validation. Sticky sessions or a shared
session store — otherwise every deploy generates a burst of "login failed" reports.

## Interview questions

**★ What is the difference between the front channel and the back channel?**
The front channel routes a message through the user's browser as redirects with URL
parameters: visible to the user, recorded in history and access logs, modifiable, and with
no way to authenticate the client. The back channel is a direct server-to-server HTTPS call:
invisible to intermediaries, and the place client authentication is possible. OAuth2 puts
the authorization request and response on the front channel because the user must be
involved, and the token exchange on the back channel because the tokens must not be seen.

**★ Why is the authorization code returned in the redirect but the access token is not?**
Because the redirect is the exposed path and the code is designed to survive being exposed:
it is single-use, short-lived, and cannot be redeemed without client authentication or a
PKCE verifier. The tokens are long-lived enough and powerful enough that exposure matters,
so they are returned only on the authenticated back-channel response to the token request.
Returning the token in the redirect instead is exactly the implicit grant, which RFC 9700
§2.1.2 says clients SHOULD NOT use.

**★ Where can an authorization code leak from a redirect URL?**
The address bar, browser history, the `Referer` header of any off-origin request the
callback page makes, reverse-proxy and CDN and application access logs, corporate
middleboxes, browser session-restore data, and screenshots or screen shares. This is why
codes are single-use with lifetimes measured in seconds and why PKCE exists.

**★ What does `state` protect against, and what does it not?**
It protects against cross-site request forgery on the callback: an attacker inducing the
victim's browser to hit the client's callback with the attacker's authorization code, which
would link the attacker's identity to the victim's session. It does not protect against
interception of the code, because an attacker who has the code usually has the `state` too —
they arrived together in the same URL. Code interception is PKCE's job.

**★ Why does the token request not need a `state` parameter?**
There is no cross-site context and no third party. It is a direct authenticated POST from
the client to the authorization server, and the response is bound to the request by the
connection. `state` exists to compensate for the front channel's lack of integrity and
identity, neither of which the back channel lacks.

**★ A colleague says an SPA is fine without PKCE because it validates `state`. Are they
right?** No — they have conflated two defences. `state` stops a forged callback being
accepted into the user's session. It does nothing about an attacker who obtains the code
itself, from history, a log, a `Referer` header or a malicious app registered on the same
redirect scheme, because the code and the `state` travel together and the attacker has both.
PKCE is what makes the stolen code unusable, and RFC 9700 §2.1.1 makes it a MUST for public
clients, which every SPA is.

**★ How does the device authorization grant fit into this model?**
It is the case where the client has no front channel. A TV or a CLI cannot host a browser
redirect, so RFC 8628 replaces the front channel with a user code the person enters on a
separate device that does have one, while the client polls the token endpoint on the back
channel. Framed that way it is not a special protocol so much as the same two channels with
the front one relocated to another device.

---

← [Client authentication](03-client-authentication.md) · [Topic index](README.md) · Next → [Registration and redirect URIs](05-registration-and-redirect-uris.md)
