---
title: "PKCE exists because on a mobile device the redirect URI is not a network address but a claim on a name that any installed application can also make, and the operating system will hand your authorization code to whoever asked for that name"
sidebar_label: "05 · The interception attack"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7636 §1 (Introduction) and Figure 1, §1.1 (Protocol Flow),
> §7.1 (Entropy of the code_verifier)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 8252 §4 (Using Inter-App URI Communication for OAuth), §6 (Use PKCE), §7 (Redirect URI
> Options), §8.5 (Client Authentication)
> ([datatracker.ietf.org/doc/html/rfc8252](https://datatracker.ietf.org/doc/html/rfc8252));
> RFC 9700 §2.1.1 (Authorization Code Grant)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**On the web, a redirect URI is a hostname the attacker would have to control DNS and a
certificate for. On a phone, the equivalent redirect is `com.example.app:/oauth2redirect` —
a private-use URI scheme, registered with the operating system by whoever declares it first,
or by everyone, depending on the OS version. There is no certificate, no registry, no
authority. A malicious app that declares the same scheme receives the redirect, and with it
the authorization code. Client authentication cannot help, because a native app is a public
client with no secret to authenticate with. That is the gap RFC 7636 was written to close,
and understanding it is why PKCE's design looks the way it does.**

## The attack, from RFC 7636 §1

The specification opens with it:

> *"OAuth 2.0 public clients utilizing the Authorization Code Grant are susceptible to the
> authorization code interception attack."*

> *"In this attack, the attacker intercepts the authorization code returned from the
> authorization endpoint within a communication path not protected by Transport Layer
> Security (TLS)."*

And on the specific mobile mechanism:

> *"Note that it is possible for a malicious app to register itself as a handler for the
> custom scheme in addition to the legitimate OAuth 2.0 app."*
>
> *"Once it does so, the malicious app is now able to intercept the authorization code in
> step (4). This allows the attacker to request and obtain an access token."*

Step by step, with the trust assumption each step breaks:

1. The legitimate native app builds an authorization request and opens it in the system
   browser. **This is correct behaviour** — RFC 8252 §4: *"For authorizing users in native
   apps, the best current practice is to perform the OAuth authorization request in an
   external user-agent (typically the browser) rather than an embedded user-agent"*, precisely
   so the user can see the authorization server's real URL and TLS state.
2. The user authenticates at the authorization server and approves.
3. The authorization server redirects to `com.example.app:/oauth2redirect?code=…`.
4. **The operating system resolves that scheme.** On a device where a malicious app has also
   declared it, the malicious app receives the invocation — either instead of, or as a choice
   presented alongside, the real app.
5. The malicious app now holds a valid code for a `client_id` that is public and readable in
   the legitimate app's own binary.
6. It calls the token endpoint with that `client_id` and the code. The client is public, so
   there is no secret to fail. The code was issued to that `client_id`, so the §4.1.3 check
   passes. The `redirect_uri` matches, because it is the one the attacker received on.
7. It gets an access token, and probably a refresh token, for the victim's account.

Every check RFC 6749 specifies passes. Nothing was broken; the protocol simply had no way to
tell the two applications apart.

## What PKCE adds, in one sentence

The client generates a secret *per authorization request*, sends only a one-way transform of
it on the front channel, and must present the original at the token endpoint. Step 6 above now
fails: the malicious app has the code and the challenge (both were on the front channel, both
visible) but not the verifier, and it cannot derive the verifier from the challenge because
`S256` is a hash.

RFC 7636 §1.1's protocol flow, in the terms of this topic:

- Authorization request carries `code_challenge` (+ `code_challenge_method`).
- The AS stores them against the code (§4.4).
- Token request carries `code_verifier` (§4.5).
- The AS recomputes and compares (§4.6); mismatch is `invalid_grant`.

The mechanism is deliberately minimal: no new endpoints, no new round trips, no key
management, and it degrades to plain OAuth against a server that ignores it — which is both
its greatest strength and the reason the downgrade attack exists
([09](09-the-pkce-downgrade-attack.md)).

## Why this is not only a mobile problem

Three generalisations of the same shape:

- **A browser-based application** has no secret either. Anything that can read the redirect —
  a malicious browser extension, a compromised script on the callback page, an open redirector
  on the same origin — can redeem the code without PKCE.
- **A loopback redirect on a desktop app** (`http://127.0.0.1:PORT/…`) is reachable by any
  other process on that machine that can guess or scan the port.
- **A confidential web client** is not exposed to *interception* in this way — but it is
  exposed to *injection*, where the attacker does not need to redeem the code themselves.
  That is [11 · Authorization code injection](11-authorization-code-injection.md), and it is
  why RFC 9700 §2.1.1 recommends PKCE for confidential clients as well:
  *"For confidential clients, the use of PKCE [RFC7636] is RECOMMENDED"*.

Note the normative words carefully, because getting them wrong is a review finding in itself.
RFC 9700 §2.1.1: *"Public clients MUST use PKCE [RFC7636] to this end"*; *"For confidential
clients, the use of PKCE [RFC7636] is RECOMMENDED"*; and on the server side *"Authorization
servers MUST support PKCE [RFC7636]."* It is a MUST for public clients, a RECOMMENDED for
confidential clients, and a MUST on every authorization server. It is not a blanket MUST for
clients, and saying so overstates the specification.

RFC 8252 §6 is the stricter, native-app-specific rule: *"Public native app clients MUST
implement the Proof Key for Code Exchange (PKCE [RFC7636]) extension to OAuth, and
authorization servers MUST support PKCE for such clients."*

## The redirect URI options for native apps, and their exposure

RFC 8252 §7 gives three, in decreasing order of how much the operating system will protect
you. [12b · Native apps and loopback](12b-native-apps-and-loopback.md) covers the matching
rules; here the point is only the interception surface:

| Option | Interception surface |
|---|---|
| Claimed `https` URI (§7.2) — app-linked to a domain you control | Lowest. The OS verifies the association against a file served from your domain. |
| Loopback interface (§7.3) — `http://127.0.0.1:port/` | Any local process that can bind or reach the port. |
| Private-use URI scheme (§7.1) — `com.example.app:/…` | Highest. Any app can declare the scheme. This is the attack above. |

RFC 8252 recommends the reverse-domain-name form for private-use schemes precisely to reduce
accidental collisions — it does not prevent deliberate ones. For loopback, §7.3 requires the
flexibility that makes an ephemeral port practical: *"The authorization server MUST allow any
port to be specified at the time of the request for loopback IP redirect URIs, to accommodate
clients that obtain an available ephemeral port from the operating system at the time of the
request."*

## The one thing PKCE is not

PKCE does not authenticate the client. Anyone can generate a verifier and challenge; the
authorization server has no idea who created them. What it proves is *continuity*: the party
at the token endpoint is the party that composed the authorization request. That is a
different property from identity, and it is exactly the property the interception attack
breaks. Keeping the two apart is the substance of
[10b · `state` vs PKCE](10b-state-vs-pkce.md) and of the client-authentication comparison in
[04b](04b-client-authentication.md).

## Gotchas

**★ "We are a server-side app, so we do not need PKCE" is the most common wrong conclusion
from this chunk.**
The interception attack is a public-client attack, but PKCE also defends code injection, which
hits confidential clients. RFC 9700 §2.1.1 recommends it for them. The correct statement is
"we are not exposed to *interception*", and that is not the same as "we do not need PKCE".

**★ Registering a private-use URI scheme does not reserve it.**
There is no registry and no enforcement. Two apps declaring `com.example.app` is a
first-come, ambiguous-resolution, or user-prompt situation depending on the platform and
version — and none of those outcomes is "the right app always wins".

**★ Using an embedded web view instead of the system browser makes this worse, not better.**
RFC 8252 §4 makes an external user-agent the best current practice, and §8.1 explains why: an
embedded user-agent is
controlled by the host application, which can read the credentials the user types, and the user
cannot see the address bar to verify they are at the real authorization server. An app that
embeds a web view has recreated the password anti-pattern OAuth2 exists to remove.

**★ The `code_challenge` is public. Protecting it is not the goal.**
It travels in a URL in a browser. The design assumes the attacker reads it. Security comes
from the one-wayness of `S256`, which is why `plain` — where challenge equals verifier —
provides nothing against an attacker who can read the authorization request. See
[07 · S256 vs plain](07-s256-vs-plain.md).

**★ A per-installation or per-user verifier is not a verifier.**
The verifier must be fresh per authorization request. RFC 9700 §2.1.1: *"the PKCE challenge or
OpenID Connect `nonce` MUST be transaction-specific and securely bound to the client and the
user agent in which the transaction was started."* A verifier cached in app storage and reused
is a long-lived secret that the attacker only has to steal once.

**★ Desktop loopback redirects should not use a fixed port.**
A fixed, published port is a fixed target for a local attacker to bind first. RFC 8252 §7.3
has the client request a dynamically allocated port and the authorization server ignore the
port when matching. Combined with PKCE, a race for the port yields a code the racer cannot
redeem.

## Interview questions

**★ What attack is PKCE designed to prevent, and why does client authentication not prevent
it?**
The authorization code interception attack, RFC 7636 §1: on a mobile device, the redirect goes
to a private-use URI scheme that any installed application can declare, so a malicious app can
receive the authorization code. Client authentication does not help because the victim is a
public client — a native app cannot hold a secret, since anyone with the binary can extract it,
and RFC 8252 §8.5 says *"Except when using a mechanism like Dynamic Client Registration
[RFC7591] to provision per-instance secrets, native apps are classified as public clients ...
they MUST be registered with the authorization server as such."* Every
check in RFC 6749 §4.1.3 passes for the attacker: the code was issued to that `client_id`, the
`redirect_uri` matches, and there is no client secret to get wrong. PKCE adds a per-request
secret that never appears on the front channel, so possession of the code alone stops being
sufficient.

**★ The attacker can read the `code_challenge` off the authorization request. Why does PKCE
still work?**
Because with `S256` the challenge is `BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`, and
reversing it requires reversing SHA-256 or guessing a value with at least 256 bits of entropy —
RFC 7636 §7.1 recommends a 32-octet random sequence for exactly this reason. The design assumes
the challenge is public. With `plain`, where the challenge *is* the verifier, the assumption
fails completely, which is why RFC 7636 §7.2 says *"`plain` SHOULD NOT be used and exists only
for compatibility with deployed implementations."*

**★ Is PKCE a form of client authentication?**
No. Anyone can generate a verifier and a challenge; the authorization server has no basis for
believing the party that produced them is any particular registered client. What PKCE proves is
continuity between the authorization request and the token request — the same party composed
both. Client authentication proves identity. They are orthogonal, which is why RFC 9700 §2.1.1
asks confidential clients — which already authenticate — to use PKCE anyway.

**★ Your team is building a native mobile app. What do you require of the OAuth integration?**
The system browser or an in-app browser tab, never an embedded web view (RFC 8252 §4 and §8.1).
Registration as a public client with no secret (§8.5) — unless you are provisioning per-instance
secrets via Dynamic Client Registration, which §8.5 names as the one exception and which almost
nobody does. PKCE with `S256`, mandatory (§6 and RFC
9700 §2.1.1). A claimed `https` redirect URI if the platform supports app links, otherwise a
reverse-domain private-use scheme, and a dynamically-allocated loopback port for desktop (§7).
And a `state` value or reliance on PKCE's CSRF property, chosen deliberately rather than by
accident.

**★ Why does RFC 8252 forbid embedded web views for the authorization request?**
Because the host application controls the web view completely: it can read what the user types,
inject scripts, and read cookies for the authorization server's origin. The user also cannot
see an address bar or a TLS indicator, so they have no way to tell the real authorization
server from a rendered imitation. That destroys the central property OAuth2 provides — that the
client never sees the user's credentials — and it also means the user's existing session with
the authorization server is not available, so they must retype credentials, which trains
exactly the behaviour the protocol was meant to eliminate.

---

← [Client authentication](04b-client-authentication.md) · [Topic index](README.md) · Next → [The code_verifier](06-the-code-verifier.md)
