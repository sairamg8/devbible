---
title: "PKCE's greatest design virtue — that it is optional and degrades silently — is also the hole an attacker walks through, because a parameter a server treats as optional is a parameter an attacker can delete"
sidebar_label: "09 · The PKCE downgrade attack"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 9700 §2.1.1 (Authorization Code Grant), §4.8 (PKCE
> Downgrade Attack), §4.8.1 (Attack Description), §4.8.2 (Countermeasures)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 7636 §5 (Compatibility), §7.2 (Protecting against Eavesdroppers)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 8414 §2 (Authorization Server Metadata)
> ([datatracker.ietf.org/doc/html/rfc8414](https://datatracker.ietf.org/doc/html/rfc8414)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Every optional security feature that fails open is a downgrade attack waiting for someone to
notice. PKCE was designed to be deployable into an existing ecosystem, so RFC 7636 §5 lets a
server *"revert to the OAuth 2.0 protocol without PKCE"* when the challenge is absent. An
attacker who can modify the authorization request — and on the front channel, that is a large
set of parties — simply removes `code_challenge` and `code_challenge_method`. The server
issues an unbound code. The attacker redeems it. This is RFC 9700 §4.8, and it is why the BCP
puts a MUST on the server rather than trusting the client to be careful.**

## The attack

RFC 9700 §4.8.1, in outline:

1. The attacker gets between the client and the authorization endpoint — a malicious app on
   the device holding the redirect scheme, a compromised browser extension, a TLS-terminating
   middlebox, an open redirector on the client's own origin, or any position from which the
   outbound URL can be rewritten.
2. The attacker **removes `code_challenge` and `code_challenge_method`** from the authorization
   request and forwards the rest.
3. The authorization server, exercising RFC 7636 §5's compatibility allowance, treats the
   request as a plain OAuth2 request and issues a code with no challenge bound to it.
4. The attacker intercepts the code — by whatever route they were already in a position to.
5. The attacker redeems it at the token endpoint. If they omit the verifier, a §5-compatible
   server accepts it. If the server insists on a verifier, the attacker sends any verifier,
   because there is nothing stored to compare it against.
6. Tokens.

The client, meanwhile, sent a perfect `S256` request. It will fail its own token exchange — or
not even get that far — but the attacker already has what they came for.

## The countermeasures

RFC 9700 §2.1.1:

> *"Authorization servers MUST mitigate PKCE downgrade attacks by ensuring that a token request
> containing a `code_verifier` parameter is accepted only if a `code_challenge` parameter was
> present in the authorization request; see Section 4.8.2 for details."*

and §4.8.2:

> *"Authorization servers MUST ensure that if there was no `code_challenge` in the authorization
> request, a request to the token endpoint containing a `code_verifier` is rejected."*

Read the mechanism carefully, because it is subtler than "require PKCE always". The rule makes
the *presence of a verifier at the token endpoint* an assertion that a challenge was sent. If
the server sees a verifier but has no challenge stored, one of two things happened: the client
is confused, or somebody stripped the challenge in flight. Either way the exchange is refused.

This means an honest client can *detect* a downgrade merely by continuing to send its
`code_verifier`: the failure it gets is the alarm. It cannot recover the login, but it also
does not hand the attacker anything, and the failure is visible in its own logs.

The second countermeasure is discoverability:

> *"Authorization servers MUST provide a way to detect their support for PKCE. It is RECOMMENDED
> for authorization servers to publish the element `code_challenge_methods_supported` in their
> Authorization Server Metadata [RFC8414] containing the supported PKCE challenge methods
> (which can be used by the client to detect PKCE support)."*

A client that reads the metadata before starting the flow knows whether PKCE is even on the
table. If `code_challenge_methods_supported` is absent, RFC 9700 §2.1's conditional permission
to skip `state` does not apply, and the client must send `state`.

## The client-side downgrade RFC 7636 already forbade

There is a second, self-inflicted version. RFC 7636 §7.2:

> *"Clients MUST NOT downgrade to `plain` after trying the `S256` method."*

This exists because a naive client, told by a server that `S256` is unsupported, might retry
with `plain` — which is precisely what an attacker who can forge that server response wants.
It is the same shape as a TLS version-rollback attack: never let a failure select a weaker
mode.

Concretely, this forbids:

```java
// WRONG — a retry that weakens the request is a downgrade the RFC prohibits.
try {
    return authorize(verifier, "S256");
} catch (UnsupportedTransformException e) {
    return authorize(verifier, "plain");   // MUST NOT (RFC 7636 §7.2)
}
```

The correct behaviour on an `S256` rejection is to fail the login and raise an operational
alert. A server that rejects `S256` is either misconfigured or being impersonated, and neither
is something a client should route around.

## What a client can actually do about the server-side downgrade

Honestly: not very much, and being clear about that is more useful than pretending otherwise.

| Client action | What it buys |
|---|---|
| Read `code_challenge_methods_supported` at startup and fail fast if `S256` is missing | Catches a misconfigured or unsupported provider before users hit it. |
| Always send `code_verifier` at the token endpoint | Turns a §4.8.2-conforming server into a downgrade *detector*. Costs nothing. |
| Keep sending `state` and validating it | Independent of PKCE entirely, so a PKCE downgrade does not also remove CSRF protection. |
| Alert on a spike in `invalid_grant` | A downgrade in progress looks like clients failing token exchanges. |
| Pin the provider and use exact issuer matching | Reduces the set of parties that can rewrite the request in the first place. |

The last row is the real defence and it is not a PKCE feature: the attack requires an attacker
positioned to modify the authorization request, so TLS everywhere, no open redirectors on your
origin, no embedded web views, and claimed-`https` redirects on mobile are what actually close
it.

## Why "just make PKCE mandatory" is not the whole answer

An authorization server that requires a `code_challenge` from every client blocks the attack
directly — the stripped request is refused at the authorization endpoint with
`invalid_request` per RFC 7636 §4.4.1. That is strictly better and every new deployment should
do it.

But RFC 9700's requirement is phrased around the *verifier*, not the challenge, because
requiring a challenge from every client breaks every legacy integration at once, and a BCP that
cannot be adopted incrementally is not adopted. §4.8.2's rule is the version a server can turn
on today without breaking anyone: it only rejects requests that are internally inconsistent.

For a client you control end to end, insist on both: server-side mandatory PKCE, and §4.8.2's
consistency check.

## Gotchas

**★ The downgrade is invisible to the client unless the client keeps sending its verifier.**
If a client "helpfully" omits `code_verifier` when it did not get one back — or if a library
skips it because the response looked like a non-PKCE flow — the exchange succeeds and nobody
notices. Always send the verifier you generated.

**★ A server that requires PKCE for public clients but not confidential ones has a downgrade
surface for confidential clients.**
RFC 7636 §4.4.1's mandatory-PKCE error is scoped to *"OAuth public clients"*. Many servers
implement exactly that scope. Since RFC 9700 §2.1.1 only *recommends* PKCE for confidential
clients, a confidential client's stripped request is a valid request. §4.8.2's consistency rule
is what covers it, and that one is not scoped by client type.

**★ Metadata absence is information; treat it as such.**
No `code_challenge_methods_supported` in the discovery document means you have no basis for
relying on PKCE for CSRF. Send `state`. RFC 9700 §2.1's permission to rely on PKCE for CSRF is
conditioned on clients that *"have ensured that the authorization server supports PKCE"*.

**★ Retrying with `plain` after an `S256` failure is explicitly forbidden and is a natural
thing for a resilience layer to do.**
RFC 7636 §7.2's MUST NOT. Any generic "retry with reduced options" wrapper around an OAuth
client is a liability. Keep the OAuth client out of such wrappers.

**★ An open redirector on your own domain is a downgrade enabler.**
It gives the attacker a position from which to observe and rewrite. RFC 9700 §2.1: *"Clients
and authorization servers MUST NOT expose URLs that forward the user's browser to arbitrary
URIs obtained from a query parameter (open redirectors)."* This is the same finding that
enables the redirect-URI attacks in [12](12-redirect-uri-exact-matching.md) — one bug, three
exploits.

**★ "We are on TLS, so nobody can modify the request" is not true on a managed device.**
Corporate MDM profiles install trusted roots and terminate TLS. Browser extensions run inside
the browser, after TLS. A malicious app on the same phone does not need to break TLS at all —
it just claims the scheme. The threat model is not "someone on the wire".

**★ The failure a downgrade produces looks like a client bug.**
The honest client sends a verifier, gets `invalid_grant`, and the on-call engineer starts
debugging the client's PKCE implementation. A sudden `invalid_grant` rate on a client that
changed nothing deserves a look at *whether the outbound authorization request still contains
the challenge* before anything else.

## Interview questions

**★ What is a PKCE downgrade attack?**
An attacker positioned to modify the authorization request removes the `code_challenge` and
`code_challenge_method` parameters. A server that follows RFC 7636 §5's compatibility allowance
— *"servers supporting backwards compatibility revert to the OAuth 2.0 protocol without PKCE"*
— issues a code with no challenge bound to it, which the attacker can then redeem without a
verifier. RFC 9700 §4.8 describes it, and the countermeasure in §4.8.2 is that the server
*"MUST ensure that if there was no `code_challenge` in the authorization request, a request to
the token endpoint containing a `code_verifier` is rejected."*

**★ Why does the countermeasure key on the verifier rather than simply requiring a challenge
from everyone?**
Because requiring a challenge from every client breaks every legacy client immediately, and a
best-current-practice document that cannot be adopted incrementally does not get adopted. The
verifier-consistency rule can be enabled on an existing server today: it rejects only requests
that contradict themselves — a verifier where no challenge was stored — and touches no honest
legacy flow. Making PKCE mandatory is strictly better and is what a new deployment should do; the
BCP's rule is what an existing deployment can do this week.

**★ As a client, how would you notice a downgrade attack in progress?**
By continuing to send the `code_verifier` unconditionally. Against a server that implements RFC
9700 §4.8.2, a stripped request produces a code with no stored challenge, so the client's token
request with a verifier is rejected — the login fails and you see an `invalid_grant` spike from
a client whose code did not change. That is the alarm. You cannot recover the individual login,
but a sudden `invalid_grant` rate with a healthy authorization endpoint is a distinctive
signature, and it is much better than the alternative, which is the attacker's exchange
succeeding silently.

**★ Your OAuth client library retries with `plain` if the server rejects `S256`. Is that
reasonable resilience?**
No, it is a specification violation and a security hole. RFC 7636 §7.2: *"Clients MUST NOT
downgrade to `plain` after trying the `S256` method."* The scenario it guards against is exactly
this: an attacker who can forge an `S256`-unsupported response gets the client to publish its
verifier in the next authorization request. It is the same class as a TLS version-rollback
attack. The correct response to an `S256` rejection is to fail and alert, because a server that
rejects `S256` is either broken — every conforming server must implement it, since RFC 7636 §4.2
calls `S256` *"Mandatory To Implement (MTI) on the server"* — or is not the server you think it
is.

**★ Where does an attacker have to be to strip the `code_challenge`?**
Anywhere that can rewrite the outbound authorization request before it reaches the authorization
server. On mobile, an app that has claimed the redirect scheme and can also influence how the
authorization URL is launched. In a browser, a malicious extension, or a compromised script on
the page that builds the URL. On a managed device, a TLS-terminating proxy with an installed
root. Or, indirectly, an open redirector on the client's own domain that lets the attacker
interpose. Note none of these requires breaking TLS on the network path — which is why "we use
HTTPS" is not an answer to this question.

---

← [Server-side verification](08-server-side-pkce-verification.md) · [Topic index](README.md) · Next → [What state defends](10-what-state-defends.md)
