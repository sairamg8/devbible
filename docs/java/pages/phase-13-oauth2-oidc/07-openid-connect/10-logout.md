---
title: "\"Log out\" names three different operations that OIDC keeps deliberately separate — ending your application's session, ending the session at the identity provider, and telling every other application that the provider's session ended — and shipping only the first is the default nobody chose"
sidebar_label: "10 · Logout"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.2.1 (`id_token_hint` — *"ID Token
> previously issued by the Authorization Server being passed as a hint about the End-User's
> current or past authenticated session with the Client"*) and §2 (the ID Token as an
> assertion about an authentication event), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> OpenID Connect Discovery 1.0 §3 (`end_session_endpoint` is **not** a REQUIRED member), at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> RFC 7009 (OAuth 2.0 Token Revocation)
> ([datatracker.ietf.org/doc/html/rfc7009](https://datatracker.ietf.org/doc/html/rfc7009)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
>
> ⚠️ **Provenance limit.** RP-Initiated Logout, Front-Channel Logout, Back-Channel Logout and
> Session Management are **separate specifications** from Core 1.0, published alongside it at
> openid.net, and they were **not fetched in this pass**. This page therefore describes the
> three *layers* and their consequences — which follow from Core §3.1.2.1, Discovery §3 and
> RFC 7009, all of which were read — and deliberately does **not** quote parameter tables or
> normative clauses from those four documents. Read the specific specification before
> implementing the endpoint. Banked quotes: `research_java_p13_t07_oidc.md`.

**A user clicks "Log out". Three things could happen and only one of them does by default.
Your application can drop its own session — that is the one every framework gives you. The
identity provider's session can end, so the next login actually asks for credentials instead
of silently succeeding. And every *other* application federated to the same provider can be
told that the session is over. Those are three separate mechanisms with three separate
specifications, and the gap between what a user means by "log out" and what your application
does is where the support tickets and the shared-computer incidents live.**

The second thing to internalise is what logout can and cannot reach. **Ending a session does
not invalidate a token that has already been issued.** A self-contained JWT access token
handed to an API keeps validating until `exp`, no matter how thoroughly you logged out — the
API is doing local validation and never asks anyone's permission. That is not a logout bug; it
is the price of stateless validation, and the only levers are short lifetimes, revocation of
the *refresh* token, and introspection for the cases that genuinely need immediacy.

## Layer 1 — your session

Drop it. This is the part you own completely and the part that is never the interesting
question:

```java
@PostMapping("/logout")
ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
    HttpSession session = request.getSession(false);
    if (session != null) {
        session.invalidate();                 // server-side state gone
    }
    SecurityContextHolder.clearContext();
    ResponseCookie cleared = ResponseCookie.from("SESSION", "")
            .path("/").httpOnly(true).secure(true).sameSite("Lax").maxAge(0).build();
    response.addHeader(HttpHeaders.SET_COOKIE, cleared.toString());
    return ResponseEntity.noContent().build();
}
```

🔴 **`POST`, not `GET`.** A logout endpoint reachable by GET can be triggered by any page that
embeds an image pointing at it — logout CSRF, which is a nuisance attack rather than a
dangerous one, but it also means a prefetching browser or a link scanner can log your users
out. Spring Security's default logout is a POST for this reason.

## Layer 2 — the provider's session (RP-initiated logout)

Without this, the user clicks "Log out", your session ends, they click "Log in", and they are
back in *without being asked for anything* — because the provider's own session cookie is
still live. On a personal device that reads as a bug. On a shared computer it is an account
handover.

The mechanism is a redirect to the provider's **`end_session_endpoint`**, carrying the ID
token you were issued as `id_token_hint` so the provider knows *whose* session to end, plus a
URI to return to afterwards. That is why
[02b · Asking about the human](02b-the-parameters-about-the-human.md) insists on the
difference between `id_token_hint` and `login_hint`: the hint here has to be something the
provider signed, or it would be a way for anyone to log anyone out.

Two things follow directly from Discovery §3 and are worth knowing before you plan the work:

- **`end_session_endpoint` is not a REQUIRED metadata member.** Its absence means this
  provider does not offer protocol logout, and your application must degrade to layer 1 rather
  than fail.
- **The post-logout redirect URI is registered**, exactly like the login redirect URI, and for
  exactly the same reason — an unregistered return URI would make the logout endpoint an open
  redirect.

```java
Optional<String> endSession = metadata.getEndSessionEndpoint();
if (endSession.isEmpty()) {
    return localLogoutOnly();                     // degrade, do not throw
}
URI target = UriComponentsBuilder.fromUriString(endSession.get())
        .queryParam("id_token_hint", idTokenValue)              // the signed hint
        .queryParam("post_logout_redirect_uri", registeredReturnUri)
        .build(true).toUri();
// Invalidate the local session FIRST, then redirect — see the gotcha below.
return ResponseEntity.status(HttpStatus.FOUND).location(target).build();
```

⚠️ **Parameter names and their exact requirements belong to the RP-Initiated Logout
specification, which this page did not fetch.** The three above are the ones every
implementation uses; confirm the full set, and whether `id_token_hint` is required or
recommended by your provider, against that document before shipping.

## Layer 3 — the other applications (front-channel and back-channel logout)

The federated case: five applications share one identity provider, and a user logging out of
one expects — or your security policy requires — the others to end too. Two published
approaches:

| | Front-channel logout | Back-channel logout |
|---|---|---|
| Transport | the user's browser loads a hidden iframe per relying party | the provider POSTs a logout token to each relying party, server to server |
| Needs the browser | **yes** | no |
| Works if the browser is closed | no | **yes** |
| Blocked by third-party cookie policies | **frequently** | no |
| Reliability | best-effort | acknowledged, retryable |
| Complexity for you | an endpoint that clears a session | an endpoint that validates a signed logout token and maps it to a session |

🔴 **Front-channel logout is the one that quietly stopped working.** It depends on the
provider's page being able to load your logout URL in an iframe *with your cookies attached*,
which is precisely the cross-site cookie behaviour browsers have spent years restricting.
Implementations that worked when they were written now fail silently — no error, no log line,
just a session that did not end. If single logout is a requirement rather than a nicety, the
back-channel is the one to build.

Back-channel logout costs you a real endpoint: it receives a signed logout token, which must
be validated much like an ID token (issuer, audience, signature) and then mapped from the
provider's session or subject identifier to *your* session — which means you need a lookup
from `(iss, sub)` or a session identifier to your own sessions, and therefore a session store
you can query. That requirement is the hidden cost, and it is why a stateless
JWT-in-the-browser architecture cannot implement single logout at all.

## What logout does not reach

**An already-issued access token.** If your APIs validate JWTs locally — which is what
[08 · Spring Security as resource server](../08-spring-security-resource-server/README.md)
configures — nothing about logout reaches them. The token keeps validating until `exp`.
The levers are:

- **Short access-token lifetimes**, which bound the window. This is the argument in
  [05 · Access-token lifetime](../05-the-three-tokens/07-access-token-lifetime-as-a-design-decision.md).
- **Revoking the refresh token** (RFC 7009), which stops *new* access tokens being minted.
  This is the one that actually matters, because a live refresh token is the long-lived
  credential.
- **Introspection** for the cases where immediacy is genuinely required, at the cost of a call
  to the authorization server per request.

**Sessions the provider does not know about.** If your application also has a local password
login, or a long-lived "remember me" cookie, protocol logout says nothing about them. They are
yours to end.

## Gotchas

**★ Logout ends the application session and the next login is silent.**
Symptom: a user clicks "Log out", clicks "Log in", and is back in with no prompt — reported as
"logout doesn't work". Cause: only layer 1 was implemented; the provider's session cookie is
untouched. Fix: redirect to `end_session_endpoint` with `id_token_hint` after clearing your
own session.

**★ The local session is invalidated *after* the redirect is issued.**
Symptom: intermittently, the user ends up logged out at the provider but still logged in to
your application. Cause: the code path returns a redirect and relies on the browser coming
back to finish the job — and the user closes the tab, or the return leg fails. Fix: invalidate
locally first; the redirect is then a best-effort improvement rather than a prerequisite.

**★ The ID token was discarded at login and there is nothing to put in `id_token_hint`.**
Symptom: logout has to be implemented without the hint, and some providers then show an
"are you sure?" interstitial or refuse. Cause: the ID token was validated and thrown away —
reasonable-looking, since it is not a credential for anything. Fix: keep it with the session
for exactly this purpose, and treat it as personal data when you do.

**★ `end_session_endpoint` is assumed present.**
Symptom: an NPE or a broken logout against a provider that does not implement RP-initiated
logout. Cause: it is not a REQUIRED discovery member. Fix: `Optional`, and degrade to layer 1.

**★ The logout endpoint accepts GET.**
Symptom: users randomly logged out; an `<img src="https://app.example.com/logout">` on any
page does it. Cause: a state-changing operation on a safe method. Fix: POST with CSRF
protection, which is what Spring Security's default logout does.

**★ `post_logout_redirect_uri` is not registered and logout fails at the provider.**
Symptom: an error page at the identity provider after logout, or a return to the provider's
own landing page instead of yours. Cause: the same registration requirement as the login
redirect URI, for the same open-redirect reason. Fix: register it; and never build it from
user-supplied input.

**★ Front-channel single logout is implemented and silently stops working.**
Symptom: other applications stay logged in, with no error anywhere — often noticed months
after a browser update. Cause: it relies on cross-site iframe loads carrying your cookies,
which browsers increasingly block. Fix: if single logout is a requirement, implement
back-channel logout; if it is a nicety, say so explicitly rather than claiming a guarantee you
do not have.

**★ Logout is expected to invalidate access tokens.**
Symptom: a security review asks "what happens to the token that was already issued?" and the
answer is "nothing". Cause: local JWT validation asks nobody's permission. Fix: bound it with
a short lifetime, revoke the refresh token at logout (RFC 7009), and reach for introspection
only where the requirement genuinely justifies a per-request call.

**★ The refresh token is not revoked at logout.**
Symptom: a credential capable of minting new access tokens outlives the session by days or
months. Cause: logout treated as a UI concern. Fix: call the provider's revocation endpoint
for the refresh token as part of logout, and treat a failure there as worth logging rather
than swallowing.

**★ Back-channel logout is designed for a stateless architecture that cannot support it.**
Symptom: the endpoint receives valid logout tokens and has nothing to do with them. Cause:
back-channel logout requires mapping the provider's subject or session identifier to *your*
sessions, which needs a queryable session store — and a pure JWT-in-the-browser design has
none. Fix: recognise it early; it is one of the strongest practical arguments for a
server-side session, which is **13 · Sessions vs tokens, honestly** *(not written yet)*.

**★ Logout clears the cookie but not the server-side session.**
Symptom: a session that can be resurrected by anyone who captured the cookie value before
logout. Cause: `maxAge(0)` on the cookie without `session.invalidate()`. Fix: do both — the
authoritative state is on the server, and clearing the client's copy alone is cosmetic.

## Interview questions

**★ A user says "logout doesn't work — I click log out, click log in, and I'm straight back
in". What is happening?**
Only the application's own session was ended. The identity provider still holds its session
cookie, so the next authorization request is satisfied silently and the user is returned
authenticated without being asked for anything. The fix is RP-initiated logout: after
invalidating the local session, redirect to the provider's `end_session_endpoint` with the ID
token as `id_token_hint` and a registered `post_logout_redirect_uri`.

**★ Why does `id_token_hint` take an ID token rather than a subject identifier?**
Because the provider must be able to verify the hint. An ID token is an artefact the provider
itself signed, so it can confirm both that the token is genuine and which session it refers
to. A bare subject identifier would be an unauthenticated string, which would make the logout
endpoint a way for anyone to end anyone else's session. It is the same distinction as
`id_token_hint` versus `login_hint` in the authentication request: one is evidence, the other
is a convenience.

**★ Does logging out invalidate the access token the user's browser already sent to your API?**
No, not if the API validates the JWT locally — which is the normal configuration. Local
validation checks a signature, an issuer, an audience and an expiry, and consults nobody, so a
token issued before logout keeps working until `exp`. What logout can do is stop *new* tokens
being issued, by revoking the refresh token under RFC 7009. If immediate invalidation is a
hard requirement, the only mechanism is introspection on each request, and that trades the
entire performance argument for local validation away.

**★ What is the difference between front-channel and back-channel logout, and which would you
build?**
Front-channel drives logout through the user's browser, loading each relying party's logout
URL in a hidden iframe; back-channel has the provider POST a signed logout token directly to
each relying party's server. Back-channel, for two reasons: it works when the browser is
closed, and it does not depend on cross-site iframe requests carrying cookies — which modern
browsers restrict, causing front-channel implementations to fail silently. The cost is that
back-channel needs a queryable session store so you can map the provider's identifier to your
sessions.

**★ Why can a fully stateless, JWT-in-the-browser application not implement single logout?**
Because there is nothing to log out. A back-channel logout token tells you a subject's session
at the provider has ended; acting on that means finding and destroying that subject's sessions
in your system, and a stateless design has no such record — the only session state lives in a
token in the user's browser, which the server cannot reach. Recognising that early is one of
the more concrete arguments for keeping a server-side session.

**★ Why must the logout endpoint be a POST?**
Because it changes state, and a state-changing endpoint on GET can be triggered by any page
that embeds a reference to it — an image tag is enough. That is logout CSRF: not dangerous in
the way a login CSRF is, but it lets a third party disrupt your users, and prefetchers and
link scanners can trip it accidentally. Spring Security's default logout is POST with CSRF
protection for exactly this reason.

**★ Your product has a "log out everywhere" button. What does implementing it actually
require?**
Ending every session your application holds for that user, which needs a session store you can
query by user; revoking the user's refresh tokens at the provider so no new access tokens can
be minted; and accepting that any already-issued access token remains valid until it expires,
which is what bounds the honesty of the feature. If other federated applications must also
end, that is back-channel logout at the provider, and it depends on the provider supporting it
and on each relying party implementing an endpoint.

**★ Where in the logout sequence do you invalidate the local session, and why does the order
matter?**
First, before issuing any redirect. The redirect to the provider is a request the user's
browser may never complete — they close the tab, the network fails, the provider errors — and
if your session invalidation was waiting on the return leg, the user is left logged in to your
application while believing they logged out. Local first, provider second, makes the
strongest guarantee unconditional and the weaker one best-effort.

---

← [Response types and modes](09-response-types-and-modes.md) · [Topic index](README.md) · Next topic → [08 · Spring Security as resource server](../08-spring-security-resource-server/README.md)
