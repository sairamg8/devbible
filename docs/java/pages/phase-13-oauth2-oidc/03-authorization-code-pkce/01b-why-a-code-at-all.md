---
title: "The authorization code exists because a redirect URL is a public document, and the flow's entire cleverness is that the thing it publishes is worthless to everyone except the party that can prove it started the exchange"
sidebar_label: "01b · Why a code at all"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1 (Authorization Code Grant), §4.2 (Implicit
> Grant), §10.3 (Access Tokens), §10.5 (Authorization Codes)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700
> §2.1.2 (Implicit Grant), §4.2 (Credential Leakage via Referrer Headers), §4.3 (Credential
> Leakage via Browser History)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Every design decision in this flow follows from one fact: a URL that a browser is
redirected to is not private. It is written to history, sent in `Referer` headers, logged
by proxies and load balancers, pasted into support tickets, captured in screen shares and
handed to whatever local application registered the scheme. So the flow puts in that URL
the only thing it can afford to publish — a short-lived, single-use reference that is
useless without a secret held somewhere else. Understanding *why* the code is worthless on
its own is what makes the rest of the topic follow rather than have to be memorised.**

## What a redirect URL is actually exposed to

RFC 9700 devotes two separate sections to this because the leak paths are genuinely
different:

- **§4.2, `Referer` headers.** If the client's landing page contains a link to, or an image
  from, a third-party origin, the browser may attach the current URL — including the `code`
  — as the `Referer`. RFC 9700: *"An attacker that learns a valid code or access token
  through a Referer header can perform attacks as described in Sections 4.1.1, 4.5 and
  4.6."*
- **§4.3, browser history.** *"Authorization codes and access tokens can end up in the
  browser's history of visited URLs, enabling attacks."* A shared or kiosk machine turns
  history into a credential store.

Add to that: reverse proxies and API gateways that log full request lines by default;
corporate TLS-terminating middleboxes; the browser address bar in a recorded meeting; and,
on mobile, any other installed app that registered the same private-use URI scheme.

None of these are exotic. They are the default behaviour of ordinary infrastructure.

## So the flow publishes a reference, not a credential

The properties RFC 6749 §4.1.2 gives the code are precisely the properties that make it
safe to publish:

> *"The authorization code MUST expire shortly after it is issued to mitigate the risk of
> leaks. A maximum authorization code lifetime of 10 minutes is RECOMMENDED. The client
> MUST NOT use the authorization code more than once. If an authorization code is used more
> than once, the authorization server MUST deny the request and SHOULD revoke (when
> possible) all tokens previously issued based on that authorization code. The authorization
> code is bound to the client identifier and redirection URI."*

Read that as four independent controls:

1. **Short lifetime** — the window in which a leaked code is worth anything is minutes, not
   the hours an access token lives.
2. **Single use** — a code that reaches a log has, in the normal case, already been spent
   by the time anyone reads the log.
3. **Replay detection with blast radius control** — reuse is not merely refused; the AS
   `SHOULD` revoke everything issued from that code. A second use means someone else has
   the code, which means the first use may have been the attacker.
4. **Bound to the client** — a leaked code cannot be redeemed by a different registered
   client.

Compare the corresponding text for access tokens, RFC 6749 §10.3: an access token is a
bearer credential, and anyone holding it can use it for its whole lifetime against every
resource in its scope. There is no single-use property, no reuse detection, no client
binding. Putting *that* in a redirect URL is a different category of mistake.

## The gap the four controls leave, and what fills it

Binding the code to the `client_id` is not binding it to *the instance of the client that
started the flow*. Two situations break it:

- **A public client has no client authentication.** A native app or SPA cannot keep a
  secret, so "bound to the client identifier" means bound to a value the attacker also
  knows. Anybody who intercepts the code can present the same public `client_id` and redeem
  it.
- **Even for a confidential client, the code can be injected into an honest client's own
  session.** The attacker does not need to redeem the code themselves; they get *your*
  client, correctly authenticated, to redeem the attacker's stolen code inside the
  attacker's browser session. RFC 9700 §4.5 walks this attack; the client's own secret does
  not help because the client is the one being used.

PKCE closes both. It adds a per-transaction secret that the client generates, never sends
on the front channel, and must present at the token endpoint. The code is then bound not
just to a client identity but to *this specific authorization request*. That is the
argument of [05 · The interception attack](05-the-interception-attack.md) and
[11 · Authorization code injection](11-authorization-code-injection.md).

## "Why not just use a session cookie for everything?"

Because the parties are different. A session cookie authenticates a user to *one* origin.
OAuth2 exists to let a *third party* act on the user's behalf against a resource server it
does not control, with a scoped, revocable, auditable grant, without ever holding the
user's credentials. If your client, your authorization server and your resource server are
all one application on one origin, a session cookie may genuinely be the right answer —
that argument is **13 · Sessions vs tokens, honestly** *(not written yet)*, and it is a
legitimate conclusion, not a cop-out. What is not legitimate is running the full flow and
then treating the resulting token as a session cookie by storing it where scripts can read
it.

## The design in one sentence you can defend in a review

*The front channel carries a reference that expires in minutes, is spent once, is bound to a
client, and is cryptographically bound to a secret that never left the client — so leaking
it costs nothing.* If any clause of that sentence is false in your deployment, you have
found the bug.

## Gotchas

**★ A ten-minute code lifetime is a `RECOMMENDED` maximum, not a floor, and many servers are
far shorter.**
RFC 6749 §4.1.2 recommends *at most* 10 minutes. Real authorization servers commonly use 30
or 60 seconds. Code that stashes a code and redeems it later — a retry queue, a "resume the
signup after email verification" step — will fail intermittently and look like a network
problem. Redeem immediately or not at all.

**★ Single use is enforced at the authorization server, so a client-side retry is an
attack signature.**
An HTTP client with automatic retries wrapped around the token exchange will, on a timeout
where the first request actually succeeded, send the code twice. The second attempt gets
`invalid_grant`, and per §4.1.2 a conforming AS `SHOULD` then revoke the tokens the *first*
attempt issued. The user is logged out by your retry policy. Disable retries on the token
endpoint, or make them idempotent by not retrying at all on a response you did not read.

**★ "Bound to the redirection URI" means the token request must repeat it, byte for byte.**
RFC 6749 §4.1.3 requires `redirect_uri` in the token request *"if the `redirect_uri`
parameter was included in the authorization request"*, and *"their values MUST be
identical"*. A client that builds the URI from `X-Forwarded-*` headers can produce two
different strings for the same logical URL and get `invalid_grant` only behind the load
balancer. See [12 · Redirect URI exact matching](12-redirect-uri-exact-matching.md).

**★ Codes in logs are a finding even though they expire.**
"It is single use and expires in a minute" is not a reason to log it. Log aggregation
delays are unpredictable, some servers are lenient, and a code in a log correlates a user to
a client and a timestamp regardless. Strip query strings from access logs on the redirect
endpoint.

**★ The `Referer` leak is fixed at the client, not the authorization server.**
RFC 9700 §4.2.4's mitigation is to *"suppress the Referer header by applying an appropriate
Referrer Policy to the document"*. Nothing the AS does can help, because the leak happens
after the browser has landed on your page. Send `Referrer-Policy: no-referrer` (or at
minimum `same-origin`) on the callback response, and redirect off the callback URL
immediately so it is not the page a user lingers on.

## Interview questions

**★ The code is in the URL, which is logged everywhere. Why is that acceptable?**
Because the code is designed to be worthless on its own. It expires in minutes, can be spent
exactly once — with the authorization server revoking downstream tokens if it is spent
twice — is bound to a specific `client_id` and `redirect_uri`, and with PKCE is bound to a
secret the client never transmitted on the front channel. An access token has none of those
properties, which is why the flow trades one for the other on a channel that does. The
honest caveat is "acceptable", not "harmless": RFC 9700 still asks you to suppress `Referer`
and keep codes out of logs, because defence in depth is the point.

**★ Your client redeems a code, the network times out, your HTTP client retries, and the user
is suddenly signed out of every device. Explain.**
The first request succeeded server-side; the response was lost. The retry presented the same
code, which the authorization server has already marked used. RFC 6749 §4.1.2 says that on
reuse the AS *"MUST deny the request and SHOULD revoke (when possible) all tokens previously
issued based on that authorization code"* — so it revoked the tokens minted by the first,
successful call. From the AS's point of view, a second use of a code is evidence of theft;
it cannot distinguish your retry from an attacker. The fix is to not retry the token
exchange, and to treat a timeout there as a failed login the user repeats.

**★ Someone proposes putting the access token in the fragment instead of the query string,
arguing that fragments are not sent to servers. Is that better?**
It is different, not better, and it is the implicit grant. Fragments do avoid `Referer` and
server-side access logs, but they are still in the address bar, still in browser history,
and still readable by any script running on the page — and RFC 9700 §4.1.2 documents that
*"user agents reattach fragments to the destination URL of a redirect if the location header
does not contain a fragment"*, which turns an open redirector into a token exfiltration
tool. More fundamentally, the token is now a long-lived bearer credential in a place a code
would have been a one-time reference, and there is no standardised way to sender-constrain
it. RFC 9700 §2.1.2 concludes clients `SHOULD NOT` do this.

**★ What actually goes wrong if the authorization code is not bound to the `redirect_uri`?**
An attacker who can get the authorization server to redirect to a URI they control — via a
loose registration pattern, a wildcard, or an open redirector on your domain — receives a
code that is still valid for your `client_id`. If the code carries no binding back to the
URI it was delivered to, the attacker can present your `client_id` at the token endpoint
with their own `redirect_uri` and get tokens. This is RFC 6749 §10.6, and it is why §4.1.3
makes the AS re-check the URI at redemption rather than only at issuance.

---

← [The flow end to end](01-the-flow-end-to-end.md) · [Topic index](README.md) · Next → [The authorization request](02-the-authorization-request.md)
