---
title: "An access token's lifetime is not a preference, it is the length of time a stolen credential keeps working — and once you write that sentence down, choosing the number becomes arithmetic instead of taste"
sidebar_label: "07 · Access-token lifetime"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §5.3 (Summary of Recommendations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 6749 §5.1 (Successful
> Response) and §1.5 (Refresh Token)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7009 §3
> (Implementation Note) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7009.txt));
> RFC 9700 §4.14 (Refresh Token Protection)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt));
> `draft-ietf-oauth-browser-based-apps-27` §5.2.2 — an Internet-Draft
> ([ietf.org](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-27.txt)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**For a bearer token, "lifetime" and "blast radius" are the same quantity measured in
different units. [06](06-what-a-bearer-token-cannot-do.md) established that a stolen access
token cannot be detected, cannot be distinguished from a legitimate one, and — in the common
JWT deployment — cannot be revoked. The only remaining control is that it stops working.
`expires_in` is therefore not a tuning parameter; it is the single number that answers "how
long does a leak last?".**

## The one number in the specification

RFC 6750 §5.3:

> *"Issue short-lived bearer tokens: Token servers SHOULD issue short-lived (one hour or less)
> bearer tokens, particularly when issuing tokens to clients that run within a web browser or
> other environments where information leakage may occur. Using short-lived bearer tokens can
> reduce the impact of them being leaked."*

**One hour or less.** That is the only concrete number any of these specifications gives, it
is a `SHOULD`, and it is the ceiling, not the target. Note the qualifier — *"particularly when
issuing tokens to clients that run within a web browser"* — which is the spec saying the
ceiling should come down for the riskiest client types.

RFC 7009 §3 gives the reasoning from the revocation side:

> *"Another design alternative is to issue short-lived access tokens, which can be refreshed at
> any time using the corresponding refresh tokens. This allows the authorization server to
> impose a limit on the time revoked when access tokens are in use."*

Read that as: the access token's lifetime *is* your revocation latency. If you cannot revoke a
JWT access token — and mostly you cannot — then "how fast can we cut someone off?" has exactly
one answer: however long the token has left.

## The arithmetic

Write down the four quantities. They are the whole design.

| Quantity | What it is | Typical |
|---|---|---|
| **L** | access-token lifetime | 5 min – 1 hour |
| **R** | requests per user per L | 1 – thousands |
| **N** | active users | 10³ – 10⁷ |
| **T** | time from "revoke this session" to "the API stops accepting the token" | **= L**, for locally-validated JWTs |

Two consequences fall straight out.

**Refresh load.** Each user performs one refresh per `L`, so the token endpoint sees roughly
`N / L` requests per second in steady state. At 10⁶ active users and `L` = 5 minutes that is
~3,300 refreshes per second, sustained, before you have served any actual product traffic.
Halving `L` doubles it. This is the real constraint that pushes `L` up, and it is an
authorization-server capacity question, not a security one.

**Revocation latency.** For a self-contained token validated locally, `T = L`. There is no
other lever. "We fired someone, how long until their access stops?" has the answer "up to
`L`". If the business needs `T` measured in seconds, you cannot get there by shortening `L` —
you have to change validation strategy, which is **14** *(not written yet)* and
**15** *(not written yet)*.

**Failure amplification.** If the authorization server is down for `D`, then after at most `L`
every user is locked out — because every access token expires and no refresh can succeed. A
short `L` makes the AS a hard dependency for *availability*, not just for login. At `L` = 5
minutes, a 10-minute AS outage is a full outage of your product. At `L` = 1 hour, most users
never notice a 10-minute outage. That is the strongest honest argument for a longer `L`, and
it is an availability argument, not a security one.

## What "short" actually means, by client type

There is no universal number, and picking one is the point of this chunk. Use the three
questions:

1. **How many places does this token land?** A token used by one server-side process behind a
   VPN lands in few places. A token in a browser lands in memory, in whatever storage the SPA
   chose, in the browser's network tab, and — via every third-party script on the page — in
   whatever those scripts can reach.
2. **Can the holder be re-credentialled without a human?** A confidential client with a refresh
   token or client credentials can silently get a new token. A public client mid-flow may not
   be able to.
3. **What is `T` allowed to be?** If the answer is "under a minute", stop optimising `L` and go
   read **15** *(not written yet)*.

That gives a defensible starting table — these are engineering judgements, not specification
values:

| Client type | Suggested `L` | Why |
|---|---|---|
| Browser SPA holding tokens directly | 5–15 min | Widest exposure; the browser-apps BCP §5.2.2 notes *"access token lifetimes can be quite short, ranging from minutes to hours"* |
| BFF / server-side web app | 15–60 min | Token never leaves the server; exposure is one process |
| Native mobile app | 15–60 min | Platform keystore, but the device may be compromised or rooted |
| Service-to-service (client credentials) | 15–60 min | Few holders, controlled network — and the AS becomes a hot dependency if shorter |
| Anything with a compliance-driven revocation SLA | as short as the AS can bear, **plus introspection** | `L` alone cannot meet a seconds-level SLA |

## The lifetime you cannot shorten

A subtlety that catches people: **a request in flight when the token expires is not
interrupted.** If an operation takes 90 seconds and the token had 30 seconds left when it
started, the resource server validated it once, at the start, and the operation completes.
Expiry is checked at authentication, not continuously. So `L` bounds when a *new* request can
be authorized, not when work stops.

That matters in two directions. It means a very short `L` is survivable for long operations —
you do not need `L` to exceed your slowest endpoint. And it means `T` is really `L` plus the
duration of the longest in-flight operation, which for a streaming or long-polling endpoint can
be substantial.

## Do not use `exp` from the token to decide when to refresh

Repeating [02b](02b-what-parsing-an-access-token-costs-you.md) because this is where people
break the rule: the client learns the lifetime from `expires_in` in the token response, not
from an `exp` claim. And it must subtract a skew, because `expires_in` counts from when the
*response was generated*:

```java
// The shape Spring Security uses; the 60-second default is not arbitrary.
private Duration clockSkew = Duration.ofSeconds(60);

private boolean hasTokenExpired(OAuth2Token token) {
    Instant expiresAt = token.getExpiresAt();
    return expiresAt != null && this.clock.instant().isAfter(expiresAt.minus(this.clockSkew));
}
```

A 60-second skew against a 5-minute lifetime means the client refreshes after 4 minutes — it
is using 80% of the token's life. Against a 90-second lifetime it would refresh after 30
seconds, using 33%, and triple your refresh load. **If you shorten `L` below a few minutes,
you must shorten the client's skew too, or the arithmetic above is wrong by a factor of
three.**

## Gotchas

**★ For a locally-validated JWT, revocation latency equals the token lifetime. There is no
other lever.**
Revoking at the AS stops *new* tokens being issued. It does nothing to a token already in an
attacker's hands, because nothing consults the AS. RFC 7009 §3 offers exactly two ways out:
introspection on every request, or *"short-lived access tokens"*. Choose consciously.

**★ Shortening the access-token lifetime makes the authorization server a hard availability
dependency.**
At lifetime `L`, an AS outage becomes a total product outage after at most `L`. Teams shorten
`L` for security and then discover they have coupled their uptime to the identity provider's.
Model this before you change the number, and load-test the token endpoint at `N / L`.

**★ `expires_in` is `RECOMMENDED`, not `REQUIRED` — and an absent value means Spring never
proactively refreshes.**
`RefreshTokenOAuth2AuthorizedClientProvider` treats a null `expiresAt` as "not expired", so the
client will only discover expiry via 401s. If your AS omits `expires_in`, configure a default
explicitly.

**★ The client's clock skew is a fixed number and your lifetime is not.**
A 60-second skew is 2% of an hour and 20% of five minutes. Shorten `L` without shortening the
skew and you multiply refresh traffic. Shorten the skew too far and you get 401s at the
boundary. Set them together.

**★ "One hour or less" is a ceiling that people read as a target.**
RFC 6750 §5.3 says *"short-lived (one hour or less)"* and singles out browser-hosted clients for
shorter still. An hour is the outer bound of conformant, not the recommended value.

**★ Long-running operations are not cut off at expiry, so `T` is longer than `L`.**
Authentication happens once per request. A 20-minute export that started with a valid token
finishes. If your revocation story depends on `T`, add the duration of your longest operation.

**★ A refresh token that outlives the user's employment is the actual risk, not the access
token.**
Teams argue for hours about `L` and leave refresh tokens valid for 90 days with no inactivity
expiry. RFC 9700 §4.14.2: *"Refresh tokens SHOULD expire if the client has been inactive for
some time."* That is **12** *(not written yet)*, and it usually matters
more.

**★ Different clients should not all get the same lifetime.**
The AS can and should issue different lifetimes per client registration. A back-office service
and a public SPA have different exposure and should not share a number just because it is a
realm-level default.

## Interview questions

**★ Your security team asks how quickly you can cut off a compromised user's API access. Your
API validates JWTs locally with a 1-hour lifetime. What is your answer?**
Up to one hour, plus the duration of any operation already in flight. Revoking at the
authorization server stops new tokens being issued and does nothing to the token the attacker
already holds, because the resource server never consults the AS — it validates the signature
and `exp` locally. RFC 7009 §3 lays out the only two ways to change that answer: have the
resource server introspect on every request, which makes revocation near-immediate at the cost
of a network call per request and a hard dependency on the AS; or shorten the access-token
lifetime, which *"allows the authorization server to impose a limit on the time revoked when
access tokens are in use"*. If the requirement is seconds, it is an architecture change, not a
configuration change.

**★ What breaks if you set the access-token lifetime to 60 seconds?**
Three things, in order of how quickly you will notice. Refresh load: every active user hits the
token endpoint once a minute, so at a million active users that is ~17,000 requests per second
of pure refresh traffic against your authorization server. Client skew: Spring's default
60-second clock skew would mark a 60-second token as expired the instant it arrives, so you
must lower the skew, which then puts you at the mercy of clock drift and network latency.
Availability: any authorization-server hiccup longer than a minute becomes a full outage,
because every access token in the system expires and no refresh succeeds. A 60-second lifetime
is defensible only with an authorization server sized for it and a very good reason.

**★ Why does RFC 6750 single out browser-hosted clients for shorter lifetimes?**
Because exposure is a function of how many things can read the token, and a browser page is the
most crowded environment a token lives in: every third-party script on the page runs in the
same origin, browser extensions can observe requests, the network tab shows the token to anyone
with the device, and whatever storage the SPA chose is readable by any injected script. §5.3
says *"particularly when issuing tokens to clients that run within a web browser or other
environments where information leakage may occur"*. A server-side client, by contrast, holds
the token in one process behind one boundary.

**★ Is a five-minute access token more secure than a one-hour one? Argue both sides.**
For: a leaked token is useful for five minutes instead of sixty, revocation latency drops by
the same factor, and a token captured in a log or a trace has usually expired before anyone
finds it. Against: refresh load on the token endpoint goes up twelvefold, the authorization
server becomes a hard availability dependency on a five-minute horizon rather than an hourly
one, and — the subtle one — the client now holds and exercises its refresh token twelve times
as often, which increases the exposure of the *more* powerful credential and, under rotation,
twelve times as many chances for a rotation race
(**11 · The rotation race** *(not written yet)*). The honest answer is that it is more
secure against token theft and less robust operationally, and which matters depends on whether
your threat model is leakage or availability.

**★ A colleague says "we'll just revoke the access token if there's a problem." What do you
need to know before agreeing?**
Whether the resource server validates locally or introspects. If it validates a JWT locally,
revocation at the AS is invisible to it and the statement is false — RFC 7009 §3 spells out
that with self-contained tokens *"some (currently non-standardized) backend interaction between
the authorization server and the resource server may be used when immediate access token
revocation is desired"*, i.e. there is no standard mechanism. If the resource server
introspects, revocation is real but bounded by the introspection cache TTL. And in either case
RFC 7009 §2 only makes access-token revocation a `SHOULD` — *"Implementations MUST support the
revocation of refresh tokens and SHOULD support the revocation of access tokens"* — so the AS
may not even offer it.

---

← [DPoP and choosing a constraint](06b-dpop-and-choosing-a-constraint.md) · [Topic index](README.md) · Next → [The long-lived token failure](07b-the-long-lived-access-token-failure.md)
