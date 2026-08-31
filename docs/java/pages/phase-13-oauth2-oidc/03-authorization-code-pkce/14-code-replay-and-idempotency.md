---
title: "The specification requires the code to be used exactly once, which makes your callback handler a non-idempotent endpoint on the public internet, and almost every piece of infrastructure you own is built on the assumption that a GET can be repeated"
sidebar_label: "14 · Replay and idempotency"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1.2 (Authorization Response), §10.5 (Authorization
> Codes), §5.2 (Error Response)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9110 §9.2.2
> (Idempotent Methods) ([rfc-editor.org/rfc/rfc9110](https://www.rfc-editor.org/rfc/rfc9110.html));
> RFC 9700 §4.5 (Authorization Code Injection)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**A callback URL is a `GET` that must be executed exactly once, and HTTP `GET` is defined as
safe and idempotent. Every layer between the browser and your handler — the browser's own
prefetch, a link scanner, a load balancer's retry, an HTTP client library's retry policy, a
service worker, a user's double-click, a monitoring probe — is entitled to assume otherwise. The
specification's own reuse rule then converts that mismatch into something worse than a failed
login: a conforming authorization server `SHOULD` revoke the tokens the *first*, successful
exchange produced.**

## The rule that makes this expensive

RFC 6749 §4.1.2 and §10.5, identically:

> *"The client MUST NOT use the authorization code more than once. If an authorization code is
> used more than once, the authorization server MUST deny the request and SHOULD revoke (when
> possible) all tokens previously issued based on that authorization code."*

Two clauses, two very different costs:

- **`MUST deny`** — the second exchange fails with `invalid_grant`. Annoying.
- **`SHOULD revoke`** — the first exchange's access token and refresh token are killed. The user
  is logged out, possibly from a session they were already using.

Whether you experience the second depends on your authorization server's choices, and both are
conforming. So "we double-submit and nothing bad happens" means only that your current provider
picked the lenient option.

The rationale is sound: from the server's side, two presentations of a single-use credential is
evidence that two parties hold it. The safe interpretation is that the first one may have been
the attacker — see [11 · Code injection](11-authorization-code-injection.md) — so everything
derived from that code is suspect.

## What makes a callback fire twice

Ordered roughly by how often they actually happen:

1. **An HTTP client retry on the token endpoint.** A read timeout after the authorization server
   processed the request. The retry is a second use. This one is entirely inside your control
   and is the most common.
2. **A user double-clicking, or hitting refresh on the callback URL.** The address bar contains
   a URL with a live code; reloading resubmits it.
3. **Browser back-navigation to the callback URL.** Same mechanism.
4. **Link scanners.** Enterprise mail and chat security products GET every URL they see. If a
   callback URL can end up in a message, it will be fetched by a robot before the human.
5. **Browser prefetch / speculative navigation.** The browser fetches a link it believes the user
   is about to click.
6. **A load balancer or service mesh retry** on an idle-timeout or a 5xx from your instance,
   forwarding the same `GET` to a second replica.
7. **Two application replicas both processing the request**, because of the above.
8. **A monitoring synthetic** configured against the callback path — rarer, and spectacular when
   it happens.
9. **A service worker** replaying a navigation request from cache or on reconnect.

Note that items 4–6 are outside your application entirely, and that items 2, 3 and 5 are
eliminated by following RFC 6749 §3.1.2.5's instruction to redirect off the callback URL
immediately.

## Building a callback that survives being called twice

You cannot make the token exchange idempotent — the authorization server owns that. What you can
do is make the *second* call not attempt the exchange.

```java
// Conceptual shape. Spring Security's OAuth2LoginAuthenticationFilter already
// consumes the stored authorization request; this is what a hand-rolled
// handler has to reproduce.

public String callback(HttpServletRequest request, HttpSession session) {

    String state = request.getParameter("state");
    String code  = request.getParameter("code");

    // 1. Remove-on-read. The stored request is the permission to exchange.
    PendingAuthorization pending = authorizationRequests.removeByState(session, state);

    if (pending == null) {
        // Second delivery, expired session, or a forged callback.
        // All three are "start again", and none of them touches the token endpoint.
        return "redirect:/login?error=expired";
    }

    // 2. Constant-time state comparison happens inside removeByState.
    // 3. Exchange exactly once. No retries configured on this call.
    OAuth2Tokens tokens = tokenClient.exchange(code, pending.codeVerifier(),
                                              pending.redirectUri());

    session.setAttribute("tokens", tokens);

    // 4. Redirect off the callback URL so the code leaves the address bar.
    return "redirect:" + pending.safeReturnTarget();
}
```

The load-bearing line is the first one. **Remove-on-read of the pending authorization request is
what makes the handler safe to call twice**: the second call finds nothing and returns without
contacting the authorization server. It also happens to be the `state` check and the one-time-use
requirement RFC 9700 §2.1 asks for, which is why the three collapse into a single operation.

The four properties this gives you:

| Property | How |
|---|---|
| Exactly one token exchange per authorization request | `removeByState` is the mutex |
| CSRF protection | The lookup fails if this session did not start the flow |
| One-time `state` | Removal |
| Code out of the address bar | The final redirect (RFC 6749 §3.1.2.5) |

## Retries: turn them off on this call specifically

```java
// The token exchange must not be retried. A connection reset after the server
// processed the request is indistinguishable from one before.
RestClient tokenClient = RestClient.builder()
        .requestFactory(new JdkClientHttpRequestFactory())   // no retry behaviour
        .build();
```

The trap is not usually an explicit `@Retryable`. It is a shared, centrally-configured HTTP
client bean with a resilience policy attached, reused for the token endpoint because it was
there. Give the OAuth token exchange its own client with no retry, no circuit-breaker fallback
that re-issues the request, and a timeout longer than the authorization server's worst case
rather than shorter.

If you must have a resilience story, it is at the *user* level: a failed login is retried by the
user starting a new authorization request, which produces a new code. That is the only correct
retry of this operation.

## Distributed callers

If the token exchange happens somewhere other than the process that received the callback — a
queue consumer, a separate service — the exactly-once requirement becomes a distributed one:

- **Exactly one consumer must attempt the exchange.** An at-least-once delivery guarantee on the
  transport is the wrong guarantee here. Deduplicate before the exchange, not after.
- **The `code_verifier` must travel with the code**, on a channel at least as protected as the
  code itself.
- **The code's lifetime is your latency budget.** A queue with a backlog will deliver expired
  codes.

The honest recommendation is not to do this. Exchange the code in the request that received it.

## Gotchas

**★ `SHOULD revoke` means a double-submit can log the user out of a session that was working.**
This is the surprising cost. The symptom is "users are logged in for half a second", and the
cause is always a second GET of the callback, never the authorization server.

**★ Reloading the callback page is a code replay, and users reload things.**
Redirect off the callback URL immediately, as RFC 6749 §3.1.2.5 instructs. Then the page in the
address bar has no code and reloading it is harmless.

**★ A retry policy on the token exchange is the most common self-inflicted version.**
And it is invisible in code review, because the retry lives in the HTTP client bean's
configuration, three files away from the OAuth code.

**★ Checking `state` without consuming it does not prevent replay.**
A comparison that leaves the stored value in place lets both deliveries pass. The check has to be
a removal.

**★ "It only happens in production" is the signature.**
Link scanners, load balancer retries and multi-replica routing do not exist on a laptop. A
callback that has never been called twice in development will be called twice in production
within a day.

**★ Do not "fix" replay by caching the token response keyed on the code.**
That makes your client return tokens for a replayed code, which is precisely the property the
one-time rule exists to remove — and it means a leaked code, replayed against your callback,
yields tokens from *your* cache without the authorization server ever seeing it.

**★ An idempotency key does not help.**
The non-idempotent operation is at the authorization server, which does not accept one. The only
lever you have is not making the second call.

**★ Long work in the callback handler before the exchange burns the code's lifetime.**
Creating the local user, calling three internal services, sending a welcome email — all of that
belongs after the exchange. Codes can live for well under a minute.

## Interview questions

**★ Why is an OAuth callback endpoint a hazard in a system that assumes GETs are repeatable?**
Because the authorization code is single-use by specification, so the handler is a
non-idempotent `GET` — which contradicts what RFC 9110 says a `GET` means, and therefore what
every intermediary is entitled to assume. Browsers prefetch, users reload, link scanners fetch,
load balancers retry, service workers replay. RFC 6749 §4.1.2 then makes the consequence
expensive: on reuse the authorization server *"MUST deny the request and SHOULD revoke (when
possible) all tokens previously issued based on that authorization code"*, so the second call can
destroy the session the first one created.

**★ How do you make a callback handler safe against being called twice?**
Make the lookup of the pending authorization request a *removal*. The stored request — holding
the `state`, the `code_verifier` and the return target — is the permission to perform the
exchange; take it out of the session atomically, and if it is not there, do not call the token
endpoint at all, just send the user back to start again. That single operation gives you the
`state` check, the one-time-use property RFC 9700 §2.1 requires, and replay safety. Then redirect
off the callback URL so the code is not in the address bar to be reloaded, which is what RFC 6749
§3.1.2.5 asks for anyway.

**★ Should the token exchange be retried on a timeout?**
No. It is not idempotent, and a timeout does not tell you whether the server processed the
request — a connection reset after processing looks identical to one before. Retrying presents
the code a second time, which fails and may revoke the tokens the first attempt issued. Give the
token endpoint its own HTTP client with no retry policy and a generous timeout, and treat a
failure as a failed login that the *user* retries by starting a new authorization request. The
practical danger is a shared, centrally-configured HTTP client bean with a resilience policy on
it, reused for this call because it was convenient.

**★ You see a burst of `invalid_grant` errors and a burst of unexpected logouts at the same
time. What is your hypothesis?**
Something is delivering the callback twice. The first delivery succeeds and issues tokens; the
second fails with `invalid_grant` and, on a server that implements the `SHOULD`, revokes the
first delivery's tokens — producing exactly that correlated pair of symptoms. Look at retry
policies on the token client, at load-balancer retry configuration, at whether the callback URL
is reachable from anything that scans links, and at whether the callback handler redirects away
from the code-bearing URL.

**★ Is it safe to exchange the code in a background job?**
It is possible and it is a bad idea. The code's lifetime is measured in seconds to a couple of
minutes, so any queueing delay eats the budget; the `code_verifier` has to travel with the code
on an equally protected channel; and the transport must guarantee exactly-once delivery to the
exchanging step, because at-least-once — the normal guarantee — is precisely the double-redemption
scenario. Exchange the code in the request that received it and do the slow work afterwards, with
the tokens in hand.

{/* FOOTER */}
