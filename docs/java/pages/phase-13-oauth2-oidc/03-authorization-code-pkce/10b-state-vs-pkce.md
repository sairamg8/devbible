---
title: "state and PKCE are checked by different parties, at different endpoints, against different stored values, and the only reason people think one replaces the other is that RFC 9700 grants one narrow conditional overlap that almost nobody reads to the end"
sidebar_label: "10b · state vs PKCE"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §10.12 (Cross-Site Request Forgery)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7636 §1
> (Introduction), §4.6 (Server Verifies code_verifier)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 9700 §2.1 (Protecting Redirect-Based Flows), §2.1.1 (Authorization Code Grant), §4.5
> (Authorization Code Injection), §4.7 (Cross-Site Request Forgery)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**This is the chunk people get wrong in interviews and in production. `state` is a check your
*client* performs on its *callback*, comparing a value it stored in the browser session — it
protects the client's own endpoint from being fed a response. PKCE is a check the
*authorization server* performs at the *token endpoint*, comparing a hash it stored against
the code — it protects the code from being redeemed by anyone but the party that started the
request. Different verifier, different endpoint, different stored value, different attack.
They overlap in exactly one place, under exactly one condition, and RFC 9700 spells out the
condition.**

## The table to memorise

| | `state` | PKCE |
|---|---|---|
| Defined in | RFC 6749 §4.1.1, §10.12 | RFC 7636 |
| Who generates the value | The client | The client |
| Who **checks** it | The client | The authorization server |
| Where the check happens | The client's redirection endpoint | The authorization server's token endpoint |
| What it is compared against | A value in the client's session for this browser | A challenge stored against the code |
| The question it answers | Did *this browser* start this flow? | Did *this party* compose the authorization request? |
| Primary attack defended | CSRF on the callback / login-CSRF (RFC 9700 §4.7) | Code interception (RFC 7636 §1) and code injection (RFC 9700 §4.5) |
| Fails as | A client-side rejection; no request reaches the AS | `invalid_grant` from the token endpoint |
| Present in the token request? | No — `state` never goes to the token endpoint | Yes — `code_verifier` |
| Survives the client having no session? | No | No, for the same reason: the verifier is session state |

Two rows carry the whole distinction. **Who checks it** — client versus authorization server.
**What it is compared against** — a browser-session value versus a value bound to the code.

## The attacks, side by side

**Login CSRF, which `state` stops and PKCE also stops.**
The attacker holds a code for *their own* account and gets the victim's browser to deliver it
to your callback. With `state`, your client sees no matching pending request in the victim's
session and refuses. With PKCE, your client does have a pending request (from some earlier or
concurrent flow) but its `code_verifier` will not match the challenge the attacker's code was
issued against — so the token endpoint returns `invalid_grant`. **Both work.** This is the
overlap.

**Code interception, which PKCE stops and `state` does not.**
The attacker steals the code out of the redirect on a mobile device and takes it directly to
the token endpoint. Your client's callback is never involved, so your `state` check never runs.
Only the challenge bound to the code stops the redemption.

**Code injection into an honest client, which PKCE stops and `state` does not.**
RFC 9700 §4.5: the attacker starts a legitimate flow in *their own* browser against *your*
client, then substitutes a stolen code in the authorization response. Your client's `state`
matches — the attacker started that flow, so the state is theirs and it is correct. What fails
is PKCE: *"the client uses its correct verifier, but the code is associated with a
`code_challenge` that does not match this verifier."* This is the case where `state` is
present, valid, and useless.

**Mix-up, which neither stops.**
The client sends the code to the wrong authorization server's token endpoint. `state` matched;
the verifier is the client's own and matches nothing at the attacker's server, but the attacker
does not need it to match — they now hold your code. The countermeasure is the `iss` parameter,
RFC 9207 — [13 · The mix-up attack](13-the-mix-up-attack.md).

## The one place RFC 9700 lets PKCE substitute

RFC 9700 §2.1, in full enough to see the condition:

> *"Clients MUST prevent Cross-Site Request Forgery (CSRF) ... clients that have ensured that
> the authorization server supports PKCE MAY rely on the CSRF protection provided by PKCE. In
> OpenID Connect flows, the `nonce` parameter provides CSRF protection. Otherwise, one-time use
> CSRF tokens carried in the `state` parameter ... MUST be used."*

The load-bearing phrase is **"have ensured that the authorization server supports PKCE"**. Not
"believe", not "the docs say". The mechanism RFC 9700 §2.1.1 gives you for ensuring it is the
metadata element `code_challenge_methods_supported`, and behind that the server-side MUSTs from
[08 · Server-side verification](08-server-side-pkce-verification.md). If the server does not
enforce the verifier, PKCE provides no CSRF protection either, because the token exchange that
was supposed to fail succeeds.

And §4.7's own summary of why PKCE is *stronger* than `state` when it does apply:

> *"PKCE provides robust protection against CSRF attacks even in the presence of an attacker
> that can read the authorization response."*

An attacker who can read your callback URL sees the `state` and can replay it. They cannot
derive the verifier from the challenge. So PKCE is not merely an alternative CSRF defence — it
is a better one, against a stronger attacker.

## So should you send `state` at all?

Send it. The reasons are practical rather than normative:

- **`state` fails earlier and more cheaply.** A `state` mismatch is rejected at your callback
  before any network call. A PKCE mismatch costs a round trip to the token endpoint and burns
  the code.
- **The failure is legible.** "State mismatch at the callback" points at CSRF. `invalid_grant`
  points at five things at once.
- **It does not depend on the authorization server behaving.** Your check runs in your process
  against your session.
- **It is free.** Spring Security sends and validates it by default; you would have to work to
  turn it off.
- **You need somewhere to hang per-request context anyway**, and a random `state` used as a
  session key is the standard place.

The correct framing is not "PKCE replaces `state`" but "PKCE means a missing `state` is not
automatically a vulnerability, provided you verified the server". Belt and braces here costs
nothing.

## Gotchas

**★ "PKCE gives you CSRF protection so `state` is obsolete" is a half-truth that fails review.**
RFC 9700 §2.1's permission is conditional on the client having *ensured* the authorization
server supports PKCE. Dropping `state` without doing that verification — and without a way to
notice if the provider changes — leaves you with no CSRF defence at all if PKCE stops being
enforced.

**★ A valid `state` does not mean the code is yours.**
In the code injection attack of RFC 9700 §4.5, the attacker started the flow, so `state` is
legitimately theirs and legitimately matches. The `state` check passes on an injected code by
design. Only PKCE or the OIDC `nonce` catches it.

**★ A valid `code_verifier` does not mean the response came to the right browser.**
Symmetrically: if two flows are in progress and your storage is not keyed per-request, you can
match a verifier while the response belongs to a different user agent. RFC 9700 §2.1.1's
*"securely bound to the client and the user agent in which the transaction was started"* is the
requirement that closes this, and it applies to both values.

**★ Neither one is checked at the resource server.**
`state` and `code_verifier` exist only within the authorization flow. By the time an access
token reaches an API, both are long gone. An API that "validates state" has misunderstood
something fundamental — the resource server's checks are `iss`, `aud`, `exp` and signature,
which is topic 08's material.

**★ `state` never appears in the token request, and `code_verifier` never appears in the
authorization request.**
If you see either in the wrong place, something has gone badly wrong — a `code_verifier` in the
authorization request is a `plain` challenge with extra steps, and a `state` in the token
request is meaningless noise that some servers will reject as an unexpected parameter.

**★ Both live in the same session, so they fail together.**
Session expiry, a lost sticky route, an instance restart with in-memory sessions — all three
destroy the pending authorization request, taking `state` and `code_verifier` with it. That is
why the symptom of a session-affinity problem is "PKCE errors", and why the diagnosis is not
about PKCE at all.

**★ For an OIDC client, `nonce` is a third mechanism and is not interchangeable with either.**
RFC 9700 §2.1 says the `nonce` provides CSRF protection in OIDC flows, and §4.5.3.2 says it also
detects code injection because *"the nonce value in the client session and the `nonce` value in
the ID Token received from the token endpoint will not match"*. It defends the same two attacks
by a different route — through the ID token rather than through the code — and it is topic 07's
to explain.

## Interview questions

**★ `state` and PKCE — what does each protect against?**
`state` protects the client's redirection endpoint against CSRF: it proves the browser
delivering this authorization response is the browser that started the flow. The check is done
by the client, at the callback, against a value in that browser's session. PKCE protects the
authorization code against being redeemed by anyone other than the party that composed the
authorization request. The check is done by the authorization server, at the token endpoint,
against a challenge stored with the code. Different checker, different endpoint, different
stored value.

**★ Give me an attack `state` stops that PKCE does not, and one PKCE stops that `state` does
not.**
PKCE-only: authorization code interception (RFC 7636 §1). A malicious app on the device receives
the redirect and goes straight to the token endpoint; your callback is never involved, so your
`state` check never runs. `state`-only: strictly, there is not a clean one, and that is the
honest answer — RFC 9700 §4.7 says PKCE provides CSRF protection too, and stronger, because it
holds *"even in the presence of an attacker that can read the authorization response"*. What
`state` gives you that PKCE does not is a check that runs entirely inside your own process,
before any network call, and does not depend on the authorization server enforcing anything.

**★ Can I drop `state` if I use PKCE?**
Only under RFC 9700 §2.1's condition: clients *"that have ensured that the authorization server
supports PKCE MAY rely on the CSRF protection provided by PKCE"*. "Ensured" means checking
`code_challenge_methods_supported` in the server's metadata and, ideally, testing that the
server actually rejects a token request with a missing or wrong verifier. Even then I would keep
`state`: it fails earlier, produces a clearer error, costs nothing, and gives you a session key
for per-request context. The interesting part of this question is whether the candidate knows
the permission is conditional at all.

**★ Your client validates `state` correctly and still gets its user's session bound to an
attacker's account. How?**
Authorization code injection, RFC 9700 §4.5. The attacker started the flow themselves at your
client, so the `state` in the response is genuinely theirs and genuinely matches. They swap in a
code they stole for a different account before your callback runs. Your client then exchanges a
code that does not belong to the session it thinks it does. RFC 9700's countermeasure is PKCE —
*"the client uses its correct verifier, but the code is associated with a `code_challenge` that
does not match this verifier"* — or, for OIDC clients, comparing the `nonce` in the returned ID
token to the one stored in the session.

**★ Where are `state` and `code_verifier` at the moment the API validates a JWT?**
Nowhere. Both belong to the authorization flow and are discarded once tokens are issued. The
resource server sees only a bearer token and validates its signature, `iss`, `aud` and `exp`.
This matters because it draws the line between the two halves of this phase: everything in this
topic is about *getting* a token safely, and nothing in it is available to the code that
*uses* one.

**★ Why does the specification put the CSRF MUST on the client rather than on the parameter?**
Because more than one mechanism can satisfy it. RFC 6749 §10.12 says *"The client MUST implement
CSRF protection for its redirection endpoint"* and then only *SHOULD*s `state` as the delivery
mechanism; RFC 9700 §2.1 later enumerates three acceptable mechanisms. Writing the MUST on the
property rather than the implementation is what let the BCP add PKCE and `nonce` as alternatives
years later without contradicting the original document.

---

← [What state defends](10-what-state-defends.md) · [Topic index](README.md) · Next → [Code injection](11-authorization-code-injection.md)
