---
title: "The authorization endpoint has two completely different error behaviours depending on whether it trusts the redirect URI, and knowing which one you are looking at is the difference between reading an error page and reading a query string"
sidebar_label: "02b · When a parameter is wrong"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1.2.1 (Error Response), §3.1.2.4 (Invalid
> Endpoint), §3.1.2.5 (Endpoint Content), §4.1.2 (Authorization Response), §5.2 (Token
> Endpoint Error Response)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7636
> §4.4.1 (Error Response)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**An authorization server that has already decided your `redirect_uri` is legitimate will
report errors *to that URI*, as query parameters. An authorization server that has not — or
that has decided the URI itself is the problem — must not redirect at all, because
redirecting to an unvalidated URI is the attack. This split is why the same misconfiguration
produces a friendly `?error=invalid_scope` in one case and a bare error page on the
authorization server's own domain in another, and why the second case is the one people
report as "the authorization server is broken".**

## Two error paths, and the rule that separates them

RFC 6749 §3.1.2.4:

> *"If an authorization request fails validation due to a missing, invalid, or mismatching
> redirection URI, the authorization server SHOULD inform the resource owner of the error and
> MUST NOT automatically redirect the user-agent to the invalid redirection URI."*

So:

| What is wrong | Where the error appears |
|---|---|
| `redirect_uri` missing when required, unregistered, or mismatched | On the authorization server, as a page. **Never** redirected. |
| `client_id` missing or unknown | On the authorization server, as a page — the server cannot know a redirect URI without a client. |
| Anything else — bad `scope`, bad `response_type`, denied consent, server error | Redirected to `redirect_uri` with `error` in the query string. |

The practical consequence: **if you never see the error in your application logs, the
problem is almost certainly `client_id` or `redirect_uri`.** Everything else comes back to
you. That one heuristic resolves a large fraction of "OAuth is broken" tickets.

## The redirected error response

RFC 6749 §4.1.2.1 defines it as a redirect to the client's URI with these query parameters:
`error` (REQUIRED), `error_description` (OPTIONAL), `error_uri` (OPTIONAL), and `state`
(REQUIRED if it was in the request). The `error` values, in the RFC's own words:

| `error` | Definition (RFC 6749 §4.1.2.1) |
|---|---|
| `invalid_request` | *"The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed."* |
| `unauthorized_client` | *"The client is not authorized to request an authorization code using this method."* |
| `access_denied` | *"The resource owner or authorization server denied the request."* |
| `unsupported_response_type` | *"The authorization server does not support obtaining an authorization code using this method."* |
| `invalid_scope` | *"The requested scope is invalid, unknown, or malformed."* |
| `server_error` | *"The authorization server encountered an unexpected condition that prevented it from fulfilling the request. (This error code is needed because a 500 Internal Server Error HTTP status code cannot be returned to the client via an HTTP redirect.)"* |
| `temporarily_unavailable` | *"The authorization server is currently unable to handle the request due to a temporary overloading or maintenance of the server. (This error code is needed because a 503 Service Unavailable HTTP status code cannot be returned to the client via an HTTP redirect.)"* |

The parenthetical notes on the last two are worth reading twice: they exist because an HTTP
status code cannot survive a redirect. The browser's response to the *authorization
endpoint* is a 302; whatever the AS thought about the request is encoded in the query string
of the `Location`, not in the status. **A 200 on your callback endpoint does not mean the
authorization succeeded.**

Illustrative shape of a redirected error — structure from §4.1.2.1, not a captured response:

```http
HTTP/1.1 302 Found
Location: https://client.example.com/login/oauth2/code/example
          ?error=invalid_scope
          &error_description=Unknown%20scope%3A%20orders.wrote
          &state=<the-exact-value-the-client-sent>
```

## What your callback handler must therefore do, in order

1. **Check for `error` before checking for `code`.** They are mutually exclusive. A handler
   that reads `code` first and NPEs on absence turns a clean `access_denied` into a 500.
2. **Validate `state` even on the error path.** §4.1.2.1 makes `state` REQUIRED in the error
   response if it was in the request. An attacker can forge an error callback just as easily
   as a success callback; if your error handler writes `error_description` into a page or a
   log without treating it as untrusted input, you have an injection sink reachable by
   anyone.
3. **Never render `error_description` or `error_uri` as HTML.** They are attacker-influenced
   strings arriving in a query parameter. RFC 6749 constrains them to a character set
   (`%x20-21 / %x23-5B / %x5D-7E`, i.e. no double-quote and no backslash) but does not stop
   them containing markup-adjacent text, and a non-conforming server may not constrain them
   at all.
4. **Map `access_denied` to a normal user outcome, not an error page.** It is the user
   clicking "Deny" or closing the consent screen. Treat it as "login cancelled".

## PKCE's own authorization-endpoint error

RFC 7636 §4.4.1:

> *"If the server requires Proof Key for Code Exchange (PKCE) by OAuth public clients and the
> client does not send the `code_challenge` in the request, the authorization endpoint MUST
> return the authorization error response with the `error` value set to `invalid_request`."*

RFC 7636 also gives the recommended `error_description` for that case — *"code challenge
required"* — and for an unsupported transformation method the server *"MUST"* return
`invalid_request` with a description indicating the transform algorithm is not supported.
This is the one PKCE failure that surfaces at the *authorization* endpoint. Every other PKCE
failure surfaces at the token endpoint as `invalid_grant`, which is covered in
[08 · Server-side PKCE verification](08-server-side-pkce-verification.md).

## The callback page itself is a security surface

RFC 6749 §3.1.2.5:

> *"The client SHOULD NOT include any third-party scripts (e.g., third-party analytics,
> social plug-ins, ad networks) in the redirection endpoint response. Instead, it SHOULD
> extract the credentials from the URI and redirect the user-agent again to another
> endpoint without exposing the credentials (in the URI or elsewhere)."*

Two instructions in one sentence, and most applications follow neither. The credential in
the URI is the authorization code; any script on that page can read `location.search`, and
any link on it can leak the URL through `Referer`. The prescribed shape is: callback handler
does the token exchange, then issues its own redirect to a clean URL, and the page the user
actually lands on never had a code in its address bar.

## Gotchas

**★ "The authorization server shows an error page instead of coming back to my app" is
almost always `redirect_uri` or `client_id`.**
§3.1.2.4 forbids redirecting to an invalid redirection URI, so those two failures cannot be
reported to you. Stop debugging your callback handler and go compare the registered URI to
the one you sent, character by character, including the trailing slash and the scheme.

**★ Your callback endpoint returning HTTP 200 tells you nothing about success.**
The status code belongs to *your* response to the browser. The authorization server's
verdict is in the query string. A monitoring check that alerts on 5xx from the callback path
will show a perfectly healthy login endpoint while every login is failing with
`error=invalid_scope`.

**★ `access_denied` is not an error, it is a user decision.**
It arrives when the user declines consent or cancels. Logging it at ERROR and paging someone
is a self-inflicted wound; showing the user a stack trace is worse. It is also what some
servers return when a policy (not the user) blocks the request, so the message you show
should be neutral.

**★ `error_description` is attacker-controlled data on a public endpoint.**
Anyone can navigate a victim's browser to
`https://yourapp/login/oauth2/code/x?error=…&error_description=…`. If you echo it into a
template, you have XSS; if you log it unescaped into a log viewer that renders HTML, you have
log injection. Treat it as you would any query parameter from the internet.

**★ Validating `state` only on the success path leaves the error path unauthenticated.**
It is a smaller hole than the success path but a real one: a forged error callback can clear
a legitimate pending authorization request out of the session (denial of service on login) or
drive whatever side effects your error handler has. §4.1.2.1 makes `state` REQUIRED in the
error response precisely so you can check it.

**★ `unsupported_response_type` and `unauthorized_client` look the same and are not.**
The first means the server does not implement the response type at all. The second means it
does, but *this client* is not registered to use it. Chasing the first when you have the
second means editing server capability documentation instead of client registration.

**★ A missing `code_challenge` against a server that does not require PKCE produces no error
at all.**
RFC 7636 §5 permits servers to *"accept OAuth 2.0 clients that do not implement this
extension"*. So the flow succeeds, with no PKCE. Silence is not confirmation that PKCE is
working — [09 · The PKCE downgrade attack](09-the-pkce-downgrade-attack.md).

**★ The callback URL sitting in the browser's address bar with a live code in it is the
default outcome of the simplest possible implementation.**
§3.1.2.5 asks you to redirect again immediately. A callback handler that renders "Welcome
back" directly leaves the code in history and exposes it to `Referer` on every link on that
page.

## Interview questions

**★ A login attempt fails and you see nothing in the application logs — not even a callback
request. Where do you look first?**
`redirect_uri` and `client_id`. RFC 6749 §3.1.2.4 says the authorization server *"MUST NOT
automatically redirect the user-agent to the invalid redirection URI"*, so those two classes
of failure are structurally incapable of reaching your application. Everything else — bad
scope, unsupported response type, denied consent, an internal AS failure — comes back to your
callback as `?error=`. The absence of a callback request is itself the diagnostic.

**★ Why do `server_error` and `temporarily_unavailable` exist when HTTP already has 500 and
503?**
Because the authorization endpoint's response to the browser is a redirect, and a redirect
carries a 302. There is no way to deliver a 500 to the client through a redirect — the
client is not the party making the HTTP request; the browser is, and the browser will follow
the redirect. RFC 6749 §4.1.2.1 says this explicitly in parentheses for both codes. It is a
small thing that reveals whether someone has understood that the front channel is not a
request/response conversation between the two servers.

**★ Your callback handler renders the `error_description` from the query string into an error
page. What is wrong with that?**
It is reflected XSS on an endpoint that requires no authentication and that an attacker can
navigate any user's browser to. The authorization server never sees the request; the string
comes straight off the URL. RFC 6749 constrains the character set of `error_description` for
conforming servers, but the value in *your* request did not necessarily come from a
conforming server — it came from whoever built the URL. Escape it, or better, map the `error`
code to a message of your own and log the description rather than displaying it.

**★ What is the correct thing for a callback endpoint to do after a successful token
exchange, and why?**
Issue another redirect to a clean URL. RFC 6749 §3.1.2.5: *"it SHOULD extract the credentials
from the URI and redirect the user-agent again to another endpoint without exposing the
credentials"*. That takes the authorization code out of the address bar and out of the page
that the user's subsequent navigation will generate `Referer` headers from, and it makes the
browser history entry for the landing page code-free. The same section also says not to put
third-party scripts on the callback page, because any of them can read the code out of
`location.search` before you redirect.

**★ Should a failed `state` check produce the same response as a failed token exchange?**
To the user, yes — an undifferentiated "sign-in failed, try again". To your logs, no: a
`state` mismatch is a security event that should be counted and alerted on, because in normal
operation it happens only from stale bookmarks, a session that expired mid-flow, or a user
with multiple tabs. A sustained rate of `state` mismatches from distinct source addresses is
somebody probing your callback. A failed token exchange is far more likely to be a
configuration or connectivity problem.

---

← [The authorization request](02-the-authorization-request.md) · [Topic index](README.md) · Next → [The authorization code](03-the-authorization-code.md)
