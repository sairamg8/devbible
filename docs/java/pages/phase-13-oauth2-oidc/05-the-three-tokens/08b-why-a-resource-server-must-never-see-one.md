---
title: "The specification says refresh tokens are never sent to resource servers in one clause of one sentence, and the reason it is worth a whole page is that the violation always arrives disguised as a convenience feature"
sidebar_label: "08b · Never at a resource server"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.5 (Refresh Token), §6 (Refreshing an Access Token),
> §10.3 (Access Tokens), §10.4 (Refresh Tokens)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700 §4.9.2 (Compromised
> Resource Server), §4.14.1 (Discussion)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt)); RFC 7662 §2.1 (Introspection
> Request) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7662.txt)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**Nobody sets out to send a refresh token to an API. It arrives as "the mobile team keeps
getting logged out, can the backend handle refresh for them?" — a helpful, reasonable-sounding
request that inverts the trust model of the entire system. This chunk is the argument you need
in that meeting, with the specification sentence, the concrete escalation, and the three
designs that give the mobile team what they actually want.**

## The sentence

RFC 6749 §1.5, final clause:

> *"Unlike access tokens, refresh tokens are intended for use only with authorization servers
> and are never sent to resource servers."*

Not "should not". Not "are usually not". *"are never sent"* — the specification is describing
the protocol, and in the protocol there is no arrow that carries a refresh token to a resource
server. §10.4 states the confidentiality boundary as a `MUST`:

> *"Refresh tokens MUST be kept confidential in transit and storage, and shared only among the
> authorization server and the client to whom the refresh tokens were issued."*

**"Shared only among the authorization server and the client."** A resource server is neither.
It is a third party to that relationship, and handing it a refresh token is a disclosure, not a
delegation.

## Why the boundary exists: what the resource server would gain

Work out what a resource server holding a refresh token can actually do. It can call the token
endpoint. That mints access tokens covering *the whole grant* — RFC 9700 §4.14.1: refresh
tokens *"represent the full scope of access granted to a certain client, and they are not
further constrained to a specific resource."*

So a read-only reporting API, whose own access token was audience-restricted to itself and
scoped to `reports:read`, can now mint tokens for `payments:write` at a completely different
service, on behalf of the user, indefinitely. Every control you built — audience restriction,
scope minimisation, short lifetimes — is bypassed in one call, because the refresh token is
upstream of all of them.

That is the escalation. It is not subtle and it is not theoretical: it is the direct
consequence of the fact that the refresh token is the grant.

## Why it makes a resource-server compromise catastrophic

RFC 9700 §4.9.2:

> *"An attacker may compromise a resource server to gain access to the resources of the
> respective deployment. Such a compromise may range from partial access to the system, e.g.,
> its log files, to full control over the respective server, in which case all controls can be
> circumvented and all resources can be accessed. The attacker would also be able to obtain
> other access tokens held on the compromised system that would potentially be valid to access
> other resource servers."*

Now add refresh tokens to that system. The bounded, expiring damage of a leaked access token
becomes unbounded: the attacker does not need to catch tokens in flight, they mint them. And
the compromise survives your incident response, because rotating the resource server's own
credentials does nothing to grants held by an attacker.

The same section's countermeasure — *"The resource server MUST treat access tokens like other
sensitive secrets and not store or transfer them in plaintext"* — applies with far more force to
a token type the resource server has no business holding at all.

## The three ways it actually gets built

**1 · "Let the API refresh for the mobile app."** The app sends its refresh token to a backend
endpoint; the backend calls the AS and returns fresh tokens. This is a proxy for the token
endpoint that lives inside a service with its own attack surface, its own logs, and its own
developers. It also breaks the AS's client binding: RFC 6749 §10.4 requires the AS to *"maintain
the binding between a refresh token and the client to whom it was issued"*, and now the presenter
is a different party.

**2 · "Send both tokens so we can auto-retry on 401."** A well-meaning gateway or SDK attaches
the refresh token as a second header so that a resource server seeing an expired access token can
refresh and retry transparently. The refresh token is now in every request, in every access log,
on every hop.

**3 · Introspecting the wrong token.** RFC 7662 §2.1 permits introspecting a refresh token —
*"For refresh tokens, this is the `refresh_token` value returned from the token endpoint"* — and
somebody wires the resource server's introspector to accept whatever arrives. The token was never
supposed to arrive at all; permitting introspection of one does not authorise sending one.

All three share a shape: **a resource server being handed a credential in order to do a
client's job.** That is the review heuristic.

## What the mobile team actually wants, and three ways to give it to them

The underlying complaint is real: refresh is fiddly, and users get logged out. Three designs
solve it without moving the refresh token.

**A · Fix the client's refresh, properly.** Most of the pain is three specific bugs — no
single-flight guard so concurrent requests race (**11** *(not written yet)*), not saving the
*new* refresh token when the AS rotates, and retrying on `invalid_grant` instead of
re-authenticating ([03b](03b-the-token-error-response.md)). Every mature OAuth client library
has these solved; the fix is usually to stop hand-rolling.

**B · Move the client into a backend (BFF).** If the team wants the server to hold the tokens,
that is a legitimate architecture — but the server becomes the *client*, not a resource server.
It holds the refresh token because it is the party the AS issued it to, it authenticates as a
confidential client on every refresh, and the mobile app holds a session cookie instead of
tokens. The distinction is not cosmetic: in the BFF the AS knows who is refreshing; in the
"API refreshes for the app" version it does not. The BFF pattern in depth is
**13 · Sessions vs tokens, honestly** *(not written yet)*.

**C · Give the app a longer-lived, rotating refresh token with inactivity expiry.** If the real
complaint is "users get logged out after a day", the lever is refresh-token lifetime policy at
the AS — which is **12** *(not written yet)* — not moving the credential.

## How to spot it in review

```java
// ❌ A resource-server endpoint that accepts a refresh token. Nothing about this
//    compiles differently from a correct endpoint; the type system will not help.
@PostMapping("/api/session/refresh")
public TokenResponse refresh(@RequestBody RefreshRequest body) {
    return authorizationServerClient.refresh(body.refreshToken());   // ← the violation
}
```

The tells, in order of how quickly you can grep for them:

- The string `refresh_token` appearing anywhere in a **resource server** module — in a DTO, a
  request mapping, a header name, a log statement, or a test fixture.
- A `@RequestHeader` or request body field named `refresh`, `refreshToken`, or `rt`.
- A resource server that has a `ClientRegistration` for the token endpoint but is not acting as
  an outbound client for anything.
- An `OAuth2RefreshToken` type imported in a module whose role is resource server.
- A gateway route that forwards more than the `Authorization` header to upstreams.

## Gotchas

**★ The violation always arrives as a helpfulness request, never as a design proposal.**
"Can the backend handle refresh so the app doesn't have to?" sounds like reducing client
complexity. It is a request to move the system's most powerful long-lived credential into a
service with a wider attack surface. Name it that way in the meeting.

**★ A resource server holding a refresh token can mint tokens for *other* resource servers.**
The refresh token covers the whole grant — RFC 9700 §4.14.1: *"not further constrained to a
specific resource"*. Your read-only service can now act as the user at the payments service.
Audience restriction on access tokens does nothing about this, because the escalation happens
upstream of token issuance.

**★ A BFF holding a refresh token is not a violation — because a BFF is a client.**
The rule is about roles, not about which side of the network something is on. The question to
ask is: did the AS issue this token *to this party*? For a BFF, yes: it is the registered
confidential client, it authenticates on every refresh, and the AS's client binding holds. For
an API being handed someone else's refresh token, no.

**★ RFC 7662 permitting introspection of refresh tokens does not permit sending them to APIs.**
§2.1 defines `token_type_hint` values including `refresh_token`, because the *authorization
server's own* components and highly-trusted protected resources may need it. It is not a
sanction for the resource server to receive one in the first place.

**★ Rotating the resource server's credentials after a breach does not revoke grants an attacker
holds.**
Standard incident response — rotate secrets, redeploy — has no effect on a refresh token the
attacker exfiltrated. You have to revoke the grants at the AS, per user, which requires knowing
which ones leaked. This is why the blast radius of "the API held refresh tokens" is measured in
users, not in services.

**★ The type system will not catch this.**
A refresh token is a `String`. There is no compile error, no framework warning, and no runtime
failure — the code works, which is why it ships. It is a review rule enforced by grep, or it is
not enforced.

**★ Test fixtures leak the pattern into production code.**
A resource-server integration test that constructs a full token response, refresh token
included, teaches the next developer that a refresh token belongs in that module. Fixtures are
documentation.

**★ "It's all inside our VPC" is not the argument you think it is.**
RFC 6749 §10.4's `MUST` is about *who holds the credential*, not about network topology. A
service inside your VPC with a refresh token can still mint tokens for every other service in
your VPC, on behalf of every user whose token it holds.

## Interview questions

**★ Why must a resource server never see a refresh token?**
Because RFC 6749 §1.5 says so in the protocol's own terms — *"refresh tokens are intended for
use only with authorization servers and are never sent to resource servers"* — and §10.4 makes
the confidentiality boundary a `MUST`: they are to be *"shared only among the authorization
server and the client to whom the refresh tokens were issued"*. The substantive reason is
privilege escalation. RFC 9700 §4.14.1 notes that a refresh token *"represent[s] the full scope
of access granted to a certain client"* and is *"not further constrained to a specific
resource"*, so any resource server holding one can mint access tokens for every other resource
server in the grant, indefinitely, on behalf of the user — bypassing audience restriction, scope
minimisation and short access-token lifetimes in a single call.

**★ The mobile team asks your API to handle token refresh so their app stops logging users out.
How do you respond?**
Take the complaint seriously and refuse the mechanism. The complaint usually resolves to three
specific client bugs: concurrent requests each triggering their own refresh with no single-flight
guard, not persisting the *new* refresh token when the AS rotates, and retrying on
`invalid_grant` instead of re-authenticating. Fix those, ideally by adopting a mature client
library instead of hand-rolling. If they genuinely want a server to hold the tokens, the correct
shape is a backend-for-frontend where that server *is* the OAuth client — registered,
confidential, authenticating on every refresh, with the app holding a session cookie. The
difference is not where the code runs; it is whether the authorization server's binding between
the refresh token and the client it was issued to still holds.

**★ Is a BFF that stores refresh tokens violating the rule?**
No, because a BFF is a client, not a resource server. The rule is about protocol roles. The AS
issued the refresh token to the BFF, the BFF authenticates as a confidential client on every
refresh, and RFC 6749 §10.4's requirement that the AS *"maintain the binding between a refresh
token and the client to whom it was issued"* is satisfied. Contrast the anti-pattern, where the
app was issued the refresh token and hands it to an API: the presenter is now a different party
from the one the AS bound the token to, and the AS has no way to notice.

**★ What is the concrete escalation if a compromised reporting API held refresh tokens?**
The attacker exfiltrates them and calls the token endpoint. Each refresh token yields access
tokens for the entire grant — every audience and every scope the user consented to — so a
read-only reporting service becomes a source of write access at every other API in the
deployment, for every user whose token it held. And because the attacker holds the grant rather
than a captured token, the damage does not expire: rotating the reporting service's own
credentials and redeploying it changes nothing. Recovery requires revoking grants at the
authorization server, per affected user, which requires knowing which users were affected. RFC
9700 §4.9.2 describes the base case without refresh tokens as bad enough — *"The attacker would
also be able to obtain other access tokens held on the compromised system"* — and refresh tokens
turn a bounded, expiring incident into an unbounded one.

**★ How would you enforce this rule, given that nothing in the type system prevents it?**
By making it greppable and by making it visible in review. A refresh token is a `String`, so
there is no compile error and no runtime failure — the violating code works, which is exactly
why it ships. In practice: a CI check that fails if `refresh_token`, `refreshToken` or
`OAuth2RefreshToken` appears in any module tagged as a resource server; a review checklist item
asking, for any endpoint that takes a credential, "did the authorization server issue this token
to this party?"; and cleaning up test fixtures, because a resource-server test that builds a full
token response including a refresh token is teaching the next developer that it belongs there.

---

← [What refresh tokens are for](08-refresh-tokens-what-they-are-for.md) · [Topic index](README.md) · Next topic → [06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md)
