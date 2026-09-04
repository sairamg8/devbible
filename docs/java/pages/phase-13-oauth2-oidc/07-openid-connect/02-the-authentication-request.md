---
title: "An OIDC authentication request is an OAuth2 authorization request with one mandatory scope and eight optional parameters, and the specification's own words for what happens when you omit the mandatory one are that the behaviour is entirely unspecified"
sidebar_label: "02 · The authentication request"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.2.1 (Authentication Request) —
> the parameter definitions for `scope`, `response_type`, `nonce`, `prompt`, `max_age`,
> `display`, `id_token_hint`, `login_hint` and `acr_values` — and §2 (ID Token), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> RFC 6749 §4.1.1 (Authorization Request)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
> **No sandbox** — parameter definitions are quoted from the specification; no HTTP
> transcript here is a capture, and the URLs shown are illustrative constructions.

**There is no separate OIDC endpoint, no separate redirect and no separate exchange. An
authentication request *is* the authorization request from
[03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md), with `openid` in
the `scope` parameter. That one string is the entire switch: with it the authorization
server returns an `id_token` alongside the access token, and without it §3.1.2.1 says, in
its own words, that "the behavior is entirely unspecified". Everything else OIDC adds to the
request is optional, and every one of those optional parameters exists to let the client say
something about *the authentication event* that OAuth2 had no vocabulary for.**

That distinction is the useful way to read the parameter list. `client_id`, `redirect_uri`,
`response_type`, `state`, `code_challenge` are OAuth2's — they are about routing and about
binding the flow. `nonce`, `prompt`, `max_age`, `acr_values`, `id_token_hint`, `login_hint`
and `display` are OIDC's, and each is a question about the human: *how recently did they
authenticate, how strongly, do I already know who they are, and may you skip the screen?*

## The one parameter that is not optional

§3.1.2.1 on `scope`:

> *"REQUIRED. OpenID Connect requests MUST contain the `openid` scope value. If the `openid`
> scope value is not present, the behavior is entirely unspecified."*

Read the second sentence carefully — it is unusually blunt for a specification. It does not
say the request is rejected, and it does not say the ID token is omitted. It says the
behaviour is **unspecified**, which in practice means every provider does something
different: some return an ordinary OAuth2 response, some error, some return an `id_token`
anyway. This is the first thing to check when a login integration "works" but no `id_token`
ever arrives.

```java
// A Spring Security ClientRegistration for an OIDC provider.
// The openid scope is not implied by anything — it is a literal string you must include.
ClientRegistration registration = ClientRegistration.withRegistrationId("corp")
        .clientId("s6BhdRkqt3")                       // RFC 6749's own example client id
        .clientSecret("{client-secret}")
        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
        .scope("openid", "profile", "email")         // ← without "openid" this is not OIDC
        .issuerUri("https://idp.example.com")
        .build();
```

## `response_type`, and why `code` is the only sane answer

§3.1.2.1:

> *"REQUIRED. OAuth 2.0 Response Type value that determines the authorization processing flow
> to be used, including what parameters are returned from the endpoints used. When using the
> Authorization Code Flow, this value is `code`."*

OIDC defines other response types — `id_token`, `id_token token`, `code id_token`, and the
rest of the hybrid family — which return an ID token, or an ID token and an access token,
directly on the front channel. They are the OIDC analogue of the implicit grant, they exist
for the same historical reason, and they carry the same problem: a credential in a redirect
URL. RFC 9700 §2.1.2's *"Clients SHOULD NOT use the implicit grant (response type `token`)
or other response types issuing access tokens in the authorization response"* is aimed
squarely at the ones that return an access token. **Use `code`.** The hybrid family and what
it was for is **09 · Response types and response modes** *(not written yet)*.

## The seven OIDC parameters, and the question each one asks

| Parameter | §3.1.2.1 status | The question it asks | What you do with the answer |
|---|---|---|---|
| `nonce` | OPTIONAL | *Is this ID token the one my flow asked for?* | Store it in the session; compare it to the `nonce` claim |
| `max_age` | OPTIONAL | *Was the human authenticated within N seconds?* | Read `auth_time` in the ID token and re-prompt if too old |
| `prompt` | OPTIONAL | *May you skip the screens, or must you show them?* | `none` for silent renewal, `login` to force re-auth |
| `acr_values` | OPTIONAL | *Authenticate them at least this strongly.* | Compare against the `acr` claim; it is a request, not a guarantee |
| `id_token_hint` | OPTIONAL | *This is who I think it is — is that still true?* | Required in practice for RP-initiated logout |
| `login_hint` | OPTIONAL | *Pre-fill this identifier.* | Pure UX; never trust it as identity |
| `display` | OPTIONAL | *Render for a page, popup, touch or wap surface.* | Pure UX; providers may ignore it |

The four that express a *policy about the human* — `max_age`, `acr_values`, `prompt` and
the two hints — are [02b · Asking about the human](02b-the-parameters-about-the-human.md).
`nonce` belongs here, because it is about the flow rather than about the person.

### `nonce` — OPTIONAL in the request, mandatory in your code

> *"OPTIONAL. String value used to associate a Client session with an ID Token, and to
> mitigate replay attacks. The value is passed through unmodified from the Authentication
> Request to the ID Token."*

"Passed through unmodified" is the whole mechanism: the AS copies your value into the
`nonce` claim of the ID token it mints. §3.1.3.7 rule 11 then makes checking it mandatory
*conditionally* — *"If a `nonce` value was sent in the Authentication Request, a `nonce`
Claim MUST be present and its value checked"*. So the parameter is optional; **checking it
is not, once you have sent it.** Sending one and never comparing it is the single most common
half-implementation in this topic, and it is indistinguishable from a correct one until
somebody attacks it. The full argument is **04 · `nonce`, `state` and the three
bindings** *(not written yet)*.

## What the request looks like assembled

```text
GET /authorize
  ?response_type=code
  &client_id=s6BhdRkqt3
  &redirect_uri=https%3A%2F%2Fapp.example.com%2Flogin%2Foauth2%2Fcode%2Fcorp
  &scope=openid%20profile%20email
  &state={opaque-session-bound-value}
  &nonce={opaque-session-bound-value}
  &code_challenge={base64url-s256-of-verifier}
  &code_challenge_method=S256
  &max_age=300
```

*(Illustrative construction from the parameter definitions in §3.1.2.1 and RFC 6749 §4.1.1 —
not a captured request. Line breaks are for reading; a real URL is one line.)*

Note what is **not** different from a plain OAuth2 request: the endpoint, `response_type`,
`state`, and the PKCE pair. `scope=openid`, `nonce` and `max_age` are the whole delta.

## Gotchas

**★ No `id_token` came back, and the response is otherwise fine.**
Symptom: the token response has `access_token`, `token_type` and `expires_in`, and no
`id_token`; your code NPEs or silently logs the user in from the access token. Cause: the
`openid` scope was not sent, so per §3.1.2.1 the behaviour is "entirely unspecified" and this
provider chose to return a plain OAuth2 response. Fix: assert the scope at construction time
rather than discovering it at runtime.

```java
Assert.isTrue(registration.getScopes().contains("openid"),
        "registration " + registration.getRegistrationId() + " is not an OIDC client");
```

**★ The `nonce` is generated per *page load* rather than per *authorization request*, or
reused across tabs.**
Symptom: intermittent `nonce` mismatches that "go away on retry", concentrated in users who
open several tabs. Cause: one session-scoped `nonce` slot overwritten by the second request
before the first returns. Fix: key the stored `nonce` by `state` so concurrent flows do not
collide.

```java
// One entry per in-flight authorization request, not one per session.
session.setAttribute("oidc:" + state, new PendingAuth(nonce, codeVerifier, Instant.now()));
```

**★ Scopes are copied from a tutorial and include ones the provider does not know.**
Symptom: an `invalid_scope` error at the authorization endpoint, or silently missing claims.
Cause: beyond `openid`, scope support is per-provider. Fix: read `scopes_supported` from the
discovery document rather than guessing — see
**05 · Discovery** *(not written yet)*.

**★ `state` is dropped because "PKCE covers it", and then `nonce` is dropped too.**
Symptom: a callback that accepts any authorization response, and an ID token check that
compares nothing. Cause: the three bindings are conflated. Fix: send and check all three —
they defend different attacks at different endpoints, which is
**04 · `nonce`, `state` and the three bindings** *(not written yet)*.

**★ A hybrid `response_type` is chosen because a blog post used one.**
Symptom: an ID token arriving in the URL fragment, and a front-end that parses it. Cause:
copying a pre-2019 example. Fix: `response_type=code`. RFC 9700 §2.1.2 pushes clients off the
response types that issue tokens in the authorization response, and the code flow gets you an
ID token over the back channel anyway.

## Interview questions

**★ What actually turns an OAuth2 authorization request into an OIDC authentication request?**
The literal `openid` value in the `scope` parameter. §3.1.2.1 marks `scope` REQUIRED and says
OIDC requests MUST contain `openid`; without it, in the specification's own words, "the
behavior is entirely unspecified". Same endpoint, same redirect, same code exchange — the
scope is the switch that makes the authorization server mint and return an `id_token`.

**★ Why is `nonce` marked OPTIONAL if everyone says you must send it?**
Because the specification separates *sending* from *checking*. §3.1.2.1 marks the request
parameter OPTIONAL, and §3.1.3.7 rule 11 makes the check conditional on having sent one: if a
`nonce` was sent, the claim MUST be present and MUST be compared. The practical rule — always
send one — comes from the code flow's threat model, not from the parameter being mandatory.
The specification's obligation is on the client that sends one to actually verify it.

**★ Which parameters in an OIDC authentication request come from OAuth2 and which from OIDC,
and why does the split matter?**
OAuth2 contributes `response_type`, `client_id`, `redirect_uri`, `scope`, `state` and (via
RFC 7636) `code_challenge`/`code_challenge_method` — routing, scoping and flow binding. OIDC
adds `nonce`, `prompt`, `max_age`, `display`, `id_token_hint`, `login_hint` and `acr_values` —
all of which are questions about *the human and the authentication event*. The split matters
because it tells you which layer to debug: a redirect or scope problem is an OAuth2 problem
and will look identical with or without OIDC, while a freshness or assurance problem only
exists once you are asking about an authentication.

**★ Why is `response_type=code` the recommended value rather than a hybrid type?**
Because every other response type puts a credential — an access token, an ID token, or both —
into the authorization *response*, which travels on the front channel through the browser's
address bar, history, `Referer` headers and logs. RFC 9700 §2.1.2 says clients SHOULD NOT use
the implicit grant or other response types issuing access tokens in the authorization
response. The code flow delivers the ID token over the authenticated back channel, where none
of those exposures exist, and costs nothing extra to implement.

---

← [The layer OAuth2 was missing](01-the-layer-oauth2-was-missing.md) · [Topic index](README.md) · Next → [Asking about the human](02b-the-parameters-about-the-human.md)
