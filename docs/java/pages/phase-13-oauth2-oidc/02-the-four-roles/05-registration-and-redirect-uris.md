---
title: "Registration is the step everyone treats as paperwork, and it is where the two values that carry the entire security of a public client's flow are decided — a client id that is not a secret and a redirect URI that is the only thing standing between an authorization code and an attacker"
sidebar_label: "05 · Registration and redirect URIs"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §2.2 (Client Identifier), §3.1.2 (Redirection
> Endpoint), §3.1.2.2 (Registration Requirements), §3.1.2.3 (Dynamic Configuration);
> RFC 9700 §2.1 (exact string matching); and RFC 7591 (*OAuth 2.0 Dynamic Client
> Registration Protocol*) — at
> [datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**For a public client the authorization server cannot tell who is calling — §2.3 forbids it
from relying on client authentication to identify one. So what actually protects the
authorization code? Two things decided at registration and nothing else: the code is
delivered only to a pre-registered redirect URI, and it can only be redeemed by whoever
produced the PKCE verifier. That makes the redirect URI a security control, not a
configuration detail, and it is why RFC 9700 §2.1 spends normative language on string
comparison.**

## `client_id`: public by specification

RFC 6749 §2.2: the client identifier *"is not a secret; it is exposed to the resource owner
and MUST NOT be used alone for client authentication."*

Both halves are consequential. It is *exposed* because it travels in the authorization URL
in the user's browser on every single flow — there is nowhere else to put it. And it MUST NOT
authenticate, because anyone who has ever seen an authorization URL for your application has
it. Any control phrased as "only requests carrying our `client_id`" is not a control.

What a `client_id` *does* do is select a registration record: which redirect URIs are
allowed, which grant types are permitted, which scopes may be requested, which authentication
method applies, and which token lifetimes are configured. It is a lookup key for policy.

## The redirect URI is where the code is delivered

RFC 6749 §3.1.2 constrains the endpoint itself:

- It **MUST be an absolute URI** as defined by RFC 3986.
- It **MAY include an `application/x-www-form-urlencoded` query component**, which must be
  retained when the authorization server appends its own parameters.
- It **MUST NOT include a fragment component.**

§3.1.2.2 then requires registration: public clients and confidential clients using the
implicit grant MUST register their redirection endpoints, and authorization servers
*"SHOULD require all clients to register their redirection endpoint prior to utilizing the
authorization endpoint."*

§3.1.2.3 requires the comparison: when a `redirect_uri` is included in an authorization
request, the server *"MUST compare and match the value received against at least one of the
registered redirection URIs."*

🔴 **RFC 9700 §2.1 tightens "compare and match" into something unambiguous**, because the
2012 wording left room for the matching to be sloppy: *"When comparing client redirection
URIs against pre-registered URIs, authorization servers MUST utilize exact string matching
except for port numbers in `localhost` redirection URIs of native apps."* Exact string
matching. Not prefix, not wildcard subdomain, not "same origin", not a regex. The single
carve-out is `localhost` ports for native applications, which need an ephemeral loopback
port they cannot know in advance.

## Why loose matching is a full account takeover

If the authorization server accepts anything other than an exact match, an attacker steers
the code to a URI they control and the flow completes at their endpoint. Each of these is a
real pattern that has been exploited:

| Loose rule | The attack |
|---|---|
| Prefix match on `https://app.example.com/cb` | `…/cb/../../attacker` or `…/cb.attacker.com` depending on the implementation |
| Wildcard subdomain `*.example.com` | Any XSS, subdomain takeover or forgotten staging host in the whole domain becomes a code exfiltration point |
| Query parameters ignored in the comparison | `…/cb?next=https://attacker.example` where the callback obeys `next` |
| Open redirect anywhere on the registered origin | The code arrives at the legitimate URI and is bounced onward with the code in the URL or the `Referer` |
| A registered `http://` URI "for testing" | Interception on the network path, and it is invariably still registered in production |

🔴 **The open-redirect case is the one teams miss**, because the registered URI is entirely
correct. Any endpoint on your registered origin that forwards to a user-supplied destination
turns exact matching into a formality. Audit for open redirects on the same origin as your
callback, not just on the callback itself.

## Registering the same client several times

Environments must be separate registrations, not extra redirect URIs on one:

```yaml
# One registration per environment. Not one client with five redirect URIs.
prod:  { client_id: orders-web,          redirect_uris: [ "https://app.example.com/login/oauth2/code/idp" ] }
stage: { client_id: orders-web-stage,    redirect_uris: [ "https://stage.example.com/login/oauth2/code/idp" ] }
local: { client_id: orders-web-local,    redirect_uris: [ "http://localhost:8080/login/oauth2/code/idp" ] }
```

The reason is blast radius: a single client registration whose allowed list includes a
staging host means a compromise of staging yields production authorization codes. And
`http://localhost` is acceptable only on a client that exists nowhere but a developer
machine.

⚠️ **Spring's default redirect URI is
`{baseUrl}/login/oauth2/code/{registrationId}`** for `oauth2Login`. Registering something
else and not overriding `redirect-uri` in the registration is the most common cause of
`redirect_uri_mismatch` in a Spring project, and the error is reported by the authorization
server with no detail about which value it expected.

## Preview deployments, the genuinely hard case

Per-branch preview URLs and exact matching are in real tension. The options, in order of
preference:

1. **One stable redirect URI on a preview gateway**, which routes onward to the branch
   deployment using state you control — the branch is your parameter, not the AS's.
2. **A wildcard registration confined to a dedicated preview domain** that hosts nothing
   else and shares no cookies with production. A weaker control, contained by isolation.
3. ⛔ **A wildcard on your production domain.** Never — it re-creates the subdomain-takeover
   attack against the environment that matters.

## Dynamic registration — RFC 7591

RFC 7591 defines a registration endpoint a client can call to obtain a `client_id` (and
credentials) programmatically. It is genuinely useful for provisioning many clients or for
an ecosystem of unknown clients, and most enterprise providers leave it disabled — because
an open registration endpoint lets anyone create a client on your authorization server. If
you enable it, gate it behind an initial access token and treat registration as a
privileged operation.

## Everything registration actually decides

Worth reading as a checklist during a security review, because each of these is a control:

- **Allowed redirect URIs** — the delivery address for authorization codes.
- **Allowed grant types** — a client permitted to use the password grant can be steered into
  it; permit only what the client needs.
- **Allowed scopes** — the ceiling on what this client may ever request.
- **Client authentication method** — `none`, `client_secret_basic`, `private_key_jwt`, mTLS.
- **Whether PKCE is required** — enforce it server-side rather than trusting clients to send
  it, or a downgrade is available to any attacker.
- **Token lifetimes and whether refresh tokens are issued**, and whether they rotate.
- **Post-logout redirect URIs**, which need the same exact-matching discipline and are
  routinely registered loosely because they feel harmless.
- **Consent behaviour** — whether consent is remembered for this client, and whether it may
  be skipped for first-party clients.

## Gotchas

**★ `client_id` is not a secret and cannot be one.**
§2.2 says so, and it is in every authorization URL. Any control that depends on knowing a
`client_id` is not a control.

**★ Exact string matching means exact.**
RFC 9700 §2.1. A trailing slash, `http` vs `https`, a differing port, a case difference in
the path, or an extra query parameter all make it a different URI — which is the point.
Debugging a `redirect_uri_mismatch` means diffing the two strings character by character.

**★ The one carve-out is `localhost` ports for native apps.**
Native applications bind an ephemeral loopback port they cannot register in advance, so
§2.1's exception permits varying the port on `localhost` — and only that.

**★ An open redirect on the registered origin defeats exact matching entirely.**
The code arrives at the correct URI and is forwarded onward, in the URL or in `Referer`.
Audit the whole origin, not just the callback path.

**★ Fragments are forbidden in a registered redirect URI.**
§3.1.2. A fragment never reaches the server anyway, so a redirect URI with one is broken as
well as non-conformant.

**★ A registered query component must be preserved, and it complicates matching.**
§3.1.2 says a query component is allowed and must be retained when parameters are appended.
Providers differ on whether the query participates in the match — assume it does, and keep
callbacks free of query strings.

**★ One registration per environment, always.**
A shared registration that also allows a staging redirect means staging's compromise is
production's compromise.

**★ `http://` redirect URIs left registered from development are a live vulnerability.**
They are trivially intercepted, and nobody removes them because nothing breaks when they
stay. Audit registrations, not just code.

**★ Enforce PKCE at the authorization server, not in the client.**
If the AS accepts a request without `code_challenge`, an attacker simply omits it and the
protection is gone. Client-side enforcement protects nobody.

**★ Spring's default redirect URI is `{baseUrl}/login/oauth2/code/{registrationId}`.**
Mismatches here are the commonest Spring OAuth2 startup problem, and `{baseUrl}` behind a
reverse proxy resolves to the internal URL unless forwarded headers are handled — so the
value the AS sees may not be the value you expect.

**★ Post-logout redirect URIs need the same discipline.**
They are registered loosely far more often than login callbacks, and they are an open
redirect on your own domain if left permissive.

**★ Dynamic registration left open lets anyone create a client on your AS.**
RFC 7591 is a feature, not a default. Gate it behind an initial access token.

## Interview questions

**★ Is `client_id` a secret?**
No. RFC 6749 §2.2 states it "is not a secret; it is exposed to the resource owner and MUST
NOT be used alone for client authentication". It travels in the authorization URL through
the user's browser on every flow. It is a lookup key for a registration record — allowed
redirect URIs, grants, scopes, authentication method, lifetimes — not a credential.

**★ Why must redirect URIs be matched exactly?**
Because the redirect URI is the delivery address for the authorization code, and for a
public client it is one of only two things protecting that code — the other being PKCE. Any
looseness lets an attacker steer the code somewhere they control: prefix matching admits
path tricks, wildcard subdomains turn any takeover or XSS anywhere in the domain into code
exfiltration, and ignoring the query component admits a `next` parameter the callback
obeys. RFC 9700 §2.1 requires exact string matching, with the single exception of port
numbers in `localhost` URIs for native applications.

**★ We match exactly and still leaked authorization codes. How?**
Almost certainly an open redirect on the same origin as the callback. The code is delivered
to the correct registered URI, and then that page forwards the browser to an
attacker-supplied destination, carrying the code in the URL or leaking it in the `Referer`
header. Exact matching constrains where the AS delivers, not where your own application
sends the browser next. The other candidates are a callback page loading off-origin assets
before redirecting, and a `redirect_uri` registered as `http://`.

**★ How do you handle per-branch preview deployments given exact matching?**
Prefer a single stable redirect URI on a preview gateway that routes onward using state you
control, so the branch is your parameter rather than the authorization server's. If that is
not possible, confine a wildcard to a dedicated preview domain that hosts nothing else and
shares no cookies with production, and accept that it is a weaker control contained by
isolation. Never put a wildcard on the production domain.

**★ What does client registration actually decide?**
Allowed redirect URIs and post-logout redirect URIs; permitted grant types; the ceiling on
requestable scopes; the client authentication method; whether PKCE is required; token
lifetimes and whether refresh tokens are issued and rotated; and consent behaviour. Every
one is a security control, which is why registration belongs in a security review rather
than in onboarding paperwork.

**★ Why should PKCE be enforced at the authorization server rather than by the client?**
Because an attacker crafting a request simply omits `code_challenge`. If the AS accepts
requests without it for a client that is supposed to use it, the protection can be
downgraded away by anyone, and the client's correct behaviour is irrelevant. Enforcement has
to live where the request is evaluated.

**★ A team registered one client with redirect URIs for production, staging and localhost.
What is wrong?** The blast radius. Anyone who compromises staging — usually the least
guarded environment — or anyone who can reach the developer's machine can obtain production
authorization codes, because the authorization server considers all three legitimate
destinations for the same client. Separate registrations per environment keep a staging
compromise inside staging. The `http://localhost` entry is additionally a plaintext delivery
address that nobody ever removes.

**★ What is RFC 7591 and when would you enable it?**
Dynamic client registration: an endpoint where a client can programmatically obtain a
`client_id` and credentials. It is worth enabling when you must provision many clients
automatically, or when you are running an ecosystem where the set of clients is not known in
advance. It should be gated behind an initial access token, because an open registration
endpoint lets anyone create a client on your authorization server — which is why most
enterprise deployments leave it off.

{/* FOOTER */}
