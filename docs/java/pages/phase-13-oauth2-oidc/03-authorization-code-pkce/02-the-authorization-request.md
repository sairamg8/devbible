---
title: "Seven parameters go up on the front channel and each one is either a routing decision, a scoping decision or a binding — and knowing which is which tells you immediately what an authorization server can and cannot verify about the request"
sidebar_label: "02 · The authorization request"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1.1 (Authorization Request), §3.1 (Authorization
> Endpoint), §3.1.2 (Redirection Endpoint), §3.3 (Access Token Scope), §10.12 (Cross-Site
> Request Forgery) ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt));
> RFC 7636 §4.3 (Client Sends the Code Challenge with the Authorization Request)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 9700 §2.1, §2.1.1
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**The authorization request is a GET the browser performs against the authorization
server's authorization endpoint. It is unauthenticated — the authorization server has no
idea who built the URL, only which `client_id` it names — and that single fact determines
what each parameter can be used for. `client_id` and `redirect_uri` are routing and are
checked against registration. `scope` is a request, not a grant. `state` and
`code_challenge` are bindings the client will check later, and the server merely stores
them. Nothing here is a secret, and treating any of it as one is a bug.**

## The parameters, with the RFC's own words

RFC 6749 §4.1.1 defines five; RFC 7636 §4.3 adds two.

| Parameter | Status | RFC's definition |
|---|---|---|
| `response_type` | REQUIRED | *"Value MUST be set to `code`."* |
| `client_id` | REQUIRED | *"The client identifier as described in Section 2.2."* |
| `redirect_uri` | OPTIONAL | *"As described in Section 3.1.2."* |
| `scope` | OPTIONAL | *"The scope of the access request as described by Section 3.3."* |
| `state` | RECOMMENDED | *"An opaque value used by the client to maintain state between the request and callback. The authorization server includes this value when redirecting the user-agent back to the client. The parameter SHOULD be used for preventing cross-site request forgery as described in Section 10.12."* |
| `code_challenge` | REQUIRED (RFC 7636 §4.3) | *"Code challenge."* |
| `code_challenge_method` | OPTIONAL (RFC 7636 §4.3) | *"Defaults to `plain` if not present in the request. Code verifier transformation method is `S256` or `plain`."* |

Two of those status words are traps and both are covered below: `redirect_uri` is
"OPTIONAL" only in the sense that a fully-registered single URI need not be repeated, and
`code_challenge_method` defaulting to `plain` is the reason [07 · S256 vs
plain](07-s256-vs-plain.md) exists.

An illustrative request with all seven — illustrative structure, not a captured request;
`s6BhdRkqt3` is RFC 6749's example client identifier and the challenge string is RFC 7636
Appendix B's worked example:

```http
GET /authorize
    ?response_type=code
    &client_id=s6BhdRkqt3
    &redirect_uri=https%3A%2F%2Fclient.example.com%2Flogin%2Foauth2%2Fcode%2Fexample
    &scope=openid%20profile%20orders.read
    &state=<opaque-per-request-value>
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    &code_challenge_method=S256 HTTP/1.1
Host: server.example.com
```

## `response_type` — the parameter that selects the flow

`code` selects the authorization code grant. `token` selects the implicit grant. `id_token`
and the hybrid combinations (`code id_token`, `code token`, `id_token token`) are defined by
OpenID Connect Core, not by RFC 6749.

The value is what makes this the flow it is, and it is the parameter to check first when
reading someone else's integration. A `response_type` containing `token` means an access
token is coming back on the front channel — see **16 · The implicit
grant** *(not written yet)* and RFC 9700 §2.1.2's *"Clients SHOULD NOT use the implicit
grant (response type `token`) or other response types issuing access tokens in the
authorization response"*.

RFC 6749 §3.1.1 on multi-valued types: *"Extension response types MAY contain a
space-delimited (%x20) list of values, where the order of values does not matter (e.g.,
response type `a b` is the same as `b a`)."* So `code id_token` and `id_token code` are the
same response type — a server that string-compares them is non-conforming, and a client that
relies on one ordering will break against a different server.

## `client_id` — public by definition

RFC 6749 §2.2 makes the client identifier *"not a secret; it is exposed to the resource
owner and MUST NOT be used alone for client authentication."* It appears in a URL the user
can read. Anyone can construct an authorization request naming your `client_id`; that is not
an attack, it is the protocol working. The consequences are:

- You cannot use `client_id` as any kind of access control.
- An attacker starting a flow with your `client_id` gets a code that only your client (or,
  without PKCE, anyone who can reach the token endpoint with a public `client_id`) can
  redeem. That is the setup for code injection — [11 · Authorization code
  injection](11-authorization-code-injection.md).
- Rotating a leaked `client_id` accomplishes nothing security-wise.

## `redirect_uri` — the parameter that is not really optional

§4.1.1 marks it OPTIONAL, but §3.1.2.3 immediately qualifies:

> *"If multiple redirection URIs have been registered, if only part of the redirection URI
> has been registered, or if no redirection URI has been registered, the client MUST include
> a redirection URI with the authorization request"*

and RFC 9700 §2.1 removes the partial-registration case entirely by requiring exact
matching. In practice: register the full URI and send it anyway. Sending it makes the token
request's `redirect_uri` requirement (§4.1.3) unambiguous and makes the AS's comparison
explicit rather than implicit. Everything about the matching rules is
[12 · Redirect URI exact matching](12-redirect-uri-exact-matching.md).

Two constraints from §3.1.2 that catch people:

> *"The redirection endpoint URI MUST be an absolute URI as defined by [RFC3986] Section
> 4.3. The endpoint URI MAY include an `application/x-www-form-urlencoded` formatted (per
> Appendix B) query component ... The endpoint URI MUST NOT include a fragment component."*

A relative URI is invalid. A fragment is invalid. A query component is permitted but the AS
must preserve it and append its own parameters, which is a common source of servers
producing malformed callback URLs.

## `scope` — a request, and the response may differ

RFC 6749 §3.3: *"The authorization and token endpoints allow the client to specify the scope
of the access request using the `scope` request parameter. In turn, the authorization server
uses the `scope` response parameter to inform the client of the scope of the access token
issued."* The value is a space-delimited, case-sensitive list of strings defined by the
authorization server.

The rule everyone skips:

> *"If the issued access token scope is different from the one requested by the client, the
> authorization server MUST include the `scope` response parameter to inform the client of
> the actual scope granted."*

So the token response can legitimately come back with **fewer** scopes than you asked for —
the user declined some on the consent screen, or policy trimmed them. A client that assumes
it got what it asked for will fail later at the resource server with a 403 that looks
unrelated. Read the `scope` in the token response.

What a scope *means* — and the argument that a scope is not a role and neither is a
permission — belongs to **10 · Method security** *(not written yet)*. Here it is a request
parameter.

## `state` — opaque to the server, meaningful to you

The authorization server does not interpret `state`. §4.1.2 says the response carries *"the
exact value received from the client"*. That gives it two jobs that are frequently
conflated:

1. **CSRF protection on the callback** — §10.12, and the whole of
   [10 · What `state` defends](10-what-state-defends.md).
2. **Carrying application state** — "which page were they trying to reach", "which tenant",
   "which of my three login buttons did they press".

Doing both in one parameter is where implementations go wrong: if the value has to be
unguessable for job 1, it cannot also be a readable serialisation of job 2 unless it is
signed or, better, used as a lookup key into server-side state. Spring Security takes the
second approach — the `state` is a random value and the rest of the
`OAuth2AuthorizationRequest` lives in the session under it.

## `code_challenge` and `code_challenge_method`

RFC 7636 §4.3 adds them to the same request. The client has already generated a
`code_verifier`; the challenge is the transform of it. What the server does with them is
one line of §4.4:

> *"The server MUST associate the `code_challenge` and `code_challenge_method` values with
> the authorization code so it can be verified later."*

That is all that happens at this step. No validation of the challenge is possible — it is
an opaque string until the verifier shows up. Generation and entropy are
[06 · The code_verifier](06-the-code-verifier.md); the method choice is
[07 · S256 vs plain](07-s256-vs-plain.md).

## Parameters this topic hands off

- **`nonce`** — OpenID Connect Core §3.1.2.1. It is an authentication-layer parameter that
  binds an ID token to the request, and RFC 9700 §4.5.3.2 names it as an alternative
  code-injection countermeasure for confidential OIDC clients. **07 · OpenID Connect**
  *(not written yet)* owns it.
- **`prompt`, `max_age`, `login_hint`, `ui_locales`, `acr_values`** — all OIDC Core, all
  topic 07.
- **`resource`** (RFC 8707) and audience selection — **12 · Token relay** *(not written
  yet)*.
- **`request` / `request_uri`** (JAR, RFC 9101) and PAR (RFC 9126) move these parameters off
  the front channel entirely. Neither is in this phase's scope; know the names.

## Gotchas

**★ `redirect_uri` being marked OPTIONAL has caused more incidents than any other word in
§4.1.1.**
It is optional only when exactly one fully-formed URI is registered. Omit it against a
server with two registered URIs and behaviour is server-specific — some pick the first, some
error. Always send it, always register it in full.

**★ Parameters must not be repeated.**
§3.1: *"Request and response parameters MUST NOT be included more than once."* A duplicated
`redirect_uri` — for example from a framework that appends one to a URL that already had one
— is `invalid_request`, and on some servers is the setup for a parameter-pollution attack
where the AS validates one copy and redirects to the other.

**★ `scope` is space-delimited and URL-encoded, so the separator is `%20` (or `+`), never a
comma.**
Spring Boot's `spring.security.oauth2.client.registration.<id>.scope` property is a
comma-separated *YAML list*, which Spring joins with spaces on the wire. Copying a
comma-separated string into a hand-built URL sends one scope named
`openid,profile,orders.read`, and the AS rejects it as `invalid_scope` — or worse, silently
grants nothing.

**★ An empty parameter value is not an empty value — it is an absent parameter.**
§3.1: *"Parameters sent without a value MUST be treated as if they were omitted."* So
`&code_challenge=` disables PKCE rather than failing, `&state=` disables your CSRF check
rather than failing, and `&scope=` requests the client's default scope rather than none.
A template that renders an empty string for a null field produces a silently weaker request.
Build the query string by omitting nulls, not by interpolating them.

**★ Unknown parameters are ignored, so a typo is silent.**
`code_challange`, `redirectUri`, `client-id` — the AS treats unrecognised parameters as
absent. A typo in `code_challenge` does not error; it produces a flow with PKCE quietly
disabled, which is exactly the [downgrade
condition](09-the-pkce-downgrade-attack.md) RFC 9700 §4.8 asks servers to detect.

**★ The authorization endpoint MUST support GET and MAY support POST.**
§3.1: *"The authorization server MUST support the use of the HTTP `GET` method [RFC2616] for
the authorization endpoint and MAY support the use of the `POST` method as well."* Do not
build an integration that depends on POST to the authorization endpoint; many servers do not
accept it. If you need parameters off the URL, the standardised answer is Pushed
Authorization Requests (RFC 9126), not POST.

**★ A `scope` you did not get is not an error at the authorization server — it is a 403 much
later.**
Because §3.3 permits the AS to issue a narrower scope and only requires it to *tell* you,
the failure surfaces when the resource server rejects the call. Assert on the `scope` in the
token response at login time if a scope is functionally required.

**★ The client must not put a fragment on `redirect_uri`.**
§3.1.2: *"MUST NOT include a fragment component."* Frameworks that build the URI from
`window.location` will happily carry a `#` into it.

**★ Everything in this URL is attacker-readable and attacker-writable.**
That is not a gotcha about one parameter; it is the frame. Never put a tenant secret, an
internal ID you rely on, or a signed-but-not-verified blob in `state` and trust it on the way
back without re-validating it server-side.

## Interview questions

**★ Which parameters of the authorization request can the authorization server actually
verify, and which can it only store?**
It can verify `response_type` (against what it supports and what the client is registered
for), `client_id` (does this client exist), `redirect_uri` (exact string match against
registration) and `scope` (are these scopes known and permitted for this client). It can
only *store* `state`, `code_challenge` and `code_challenge_method` — those are bindings that
mean nothing to the server until the corresponding value shows up later. That split is worth
being able to state, because it explains why a bad `code_challenge` produces no error at the
authorization endpoint and a very confusing `invalid_grant` at the token endpoint.

**★ `state` is marked RECOMMENDED, not REQUIRED. Can you skip it?**
Only under a condition you have to verify. RFC 6749 §10.12 says *"The client MUST implement
CSRF protection for its redirection endpoint"* — the MUST is on the protection, not on the
parameter. RFC 9700 §2.1 then says clients *"that have ensured that the authorization server
supports PKCE MAY rely on the CSRF protection provided by PKCE"*, and in OIDC flows the
`nonce` provides it; *"Otherwise, one-time use CSRF tokens carried in the `state` parameter
... MUST be used."* So: PKCE-with-a-verified-server, or OIDC `nonce`, or `state`. Pick one
deliberately. Frameworks, including Spring Security, send `state` regardless, which is the
right default.

**★ You requested `scope=orders.read orders.write` and everything works in test but writes
fail in production with 403. Where do you look?**
At the `scope` field of the token response, not at the resource server. RFC 6749 §3.3 lets
the authorization server issue a narrower scope than requested and only obliges it to report
the actual scope back. A consent screen where the user unchecked one item, or a policy that
restricts `orders.write` to certain client or user groups, produces exactly this: a
successful login, a valid token, and a token that does not carry the scope you assumed.

**★ Why is `client_id` not a secret, and what would change if it were?**
Because it travels in a URL the resource owner's browser fetches — it is visible in the
address bar by construction. If it were treated as a secret, every user of the application
would know it, which is the definition of not-a-secret. RFC 6749 §2.2 states it *"MUST NOT be
used alone for client authentication."* Nothing would improve if it were confidential,
because the protocol never relies on its secrecy: authentication is the client secret or a
private key at the token endpoint, and per-transaction binding is PKCE.

**★ A colleague wants to put the user's originally requested URL into `state` so they can
redirect there after login. What do you tell them?**
That `state` has to be unguessable to do its CSRF job, and a URL is guessable, so the two
uses collide. The options are: sign or encrypt the payload and include a random nonce
alongside it, or — much simpler — make `state` a random key and keep the return URL in the
session next to the stored authorization request. The second is what Spring Security does
with `OAuth2AuthorizationRequest.getAdditionalParameters()` and the session-backed
`AuthorizationRequestRepository`. The third trap: whatever you store, validate the return URL
against an allowlist before redirecting to it, or you have just built the open redirector
RFC 9700 §2.1 forbids.

{/* FOOTER */}
