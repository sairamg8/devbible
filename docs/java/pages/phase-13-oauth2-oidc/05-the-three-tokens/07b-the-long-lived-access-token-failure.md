---
title: "The most common real-world OAuth2 failure is not a subtle protocol flaw, it is a one-year access token issued because refresh was inconvenient — and the reason it survives review is that nothing about it looks like a bug"
sidebar_label: "07b · The long-lived token failure"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §5.3 (Summary of Recommendations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 6749 §1.4 (Access
> Token), §1.5 (Refresh Token), §10.3 (Access Tokens)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7009 §3 (Implementation
> Note) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7009.txt)); RFC 9700 §4.9 (Access
> Token Leakage at the Resource Server), §4.14 (Refresh Token Protection)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Every specification in this phase assumes access tokens are short-lived, and a large
fraction of production deployments quietly are not. The failure is not exotic. Somebody had a
deadline, refresh handling was fiddly, and the authorization server had a field where you can
type a bigger number. Nothing broke. That is precisely why it is the most common real-world
failure: it is the only one whose symptom is that everything works.**

## How it happens, in five steps

1. A team integrates a client. Refresh works in the happy path and is fiddly at the edges —
   concurrency, `invalid_grant`, storing the new token.
2. A token expires in staging during a demo. Somebody raises the lifetime to eight hours "so
   we can get through the demo".
3. It works. Nothing is filed, because nothing failed.
4. A month later a mobile app ships. Mobile refresh is fiddlier. The lifetime goes to 30 days
   so the app "doesn't log people out".
5. A year later, the access token is functionally a permanent API key, the refresh token is
   unused, and the identity provider is a login screen bolted onto a static credential.

At no point does anything error. There is no failing test, no red build, no alert. The system
has silently traded every security property OAuth2 was designed to give it, and the diff that
did it was one number in a config file.

## What was actually traded away

| Property | With a short lifetime | With a 30-day token |
|---|---|---|
| Revocation | bounded by `L` — RFC 7009 §3's *"limit on the time revoked"* | **none**, for locally-validated JWTs |
| Effect of a leaked token in a log | expires before most log retention windows | live credential for a month |
| Effect of a compromised resource server | RFC 9700 §4.9.2's *"read-only access to web server logs"* yields short-lived tokens | yields a month of access per token |
| Change of user permissions | takes effect at next refresh | **takes effect never** |
| Offboarding | takes effect within `L` | takes effect when the token expires |
| Client-side storage risk | a short-lived secret | a long-lived secret, stored the way people store long-lived secrets |

The fourth row is the one that surprises people. Claims are baked in at issuance. A user who is
removed from a group, moved to a different tenant, or downgraded keeps the old claims for the
life of the token. With a 30-day token, a permissions change made today takes effect up to a
month from now — and the person who made the change believes it is live.

## Why "we'll just make the token long-lived" is not the same as "an API key"

Teams defend it with: *"Long-lived credentials are normal — an API key lives forever."* Two
differences make the comparison wrong.

**An API key is designed for revocation.** It is a handle: the server looks it up on every
request, and deleting the row stops it instantly. A long-lived JWT access token is the
opposite — it is designed *not* to require a lookup, which is the whole reason it was chosen.
You have taken the API-key use case and implemented it with the one credential type that cannot
be revoked.

**An API key belongs to a machine; an access token often carries a human's authorizations.** A
30-day token minted from a user's session carries that user's identity and scopes for 30 days,
including through their offboarding. An API key is a service identity that nobody's HR system
touches.

If the requirement genuinely is a long-lived machine credential, the answer is the client
credentials grant with short tokens and a securely stored client secret — that is
**04 · Client credentials** *(not written yet)* — or a real API key with real lookup-based
revocation. Not a long-lived user access token.

## The tells, in a codebase and in a config

You will usually find at least three of these together:

- **The refresh token is issued and never used.** Grep the client for `refresh_token`: if it
  appears only in the parsing of the token response and nowhere in a request, refresh is dead
  code.
- **`expires_in` is measured in days.** Anything over 3,600 in an AS client config deserves a
  comment explaining itself.
- **No `invalid_grant` handling anywhere.** The client has never had to recover from an expired
  grant, so it has no code for it. This is also why raising the lifetime feels safe: the
  recovery path was never tested.
- **The token is stored somewhere durable.** Long-lived tokens get written to disk, to a
  database, to a config map, to a `.env` file — because a credential that lasts a month gets
  treated like a credential that lasts a month.
- **A comment saying "temporary".** Dated at least a year ago.
- **The AS's default was changed at the realm level**, not per client, so every client got it.

## The fix, in the order that actually works

Raising the lifetime is one config change; lowering it is a migration, because you now have
clients that have never refreshed. Do it in this order:

**1 · Make refresh work first, at the current lifetime.** Ship a client that refreshes
correctly and handles `invalid_grant` by re-authenticating. Verify it in production by forcing
a refresh, not by waiting.

```java
// The minimum viable correct client refresh. See 03b for why invalid_grant is terminal.
OAuth2AccessToken current = store.load(principal);
if (current == null || isExpiring(current)) {
    try {
        TokenResponse fresh = tokenClient.refresh(store.loadRefreshToken(principal));
        store.save(principal, fresh);      // save BOTH tokens: rotation may have changed the refresh token
    } catch (OAuth2AuthorizationException ex) {
        if ("invalid_grant".equals(ex.getError().getErrorCode())) {
            store.clear(principal);
            throw new ReauthenticationRequiredException(ex);
        }
        throw ex;                          // transport failures are retryable; this is not
    }
}
```

The `store.save(principal, fresh)` line saving *both* tokens is the one people omit, and it is
what breaks the moment rotation is turned on (**10** *(not written yet)*).

**2 · Instrument before you change anything.** Emit a metric for token age at validation time
on the resource server. You want to know the p99 age of tokens in use before and after, and you
want to see it drop.

**3 · Step the lifetime down, not off a cliff.** 30 days → 7 days → 1 day → 1 hour → target.
Each step exercises refresh for clients that never have, and each step is individually
revertable. A single jump to 15 minutes will find every client that cannot refresh, all at
once, in production.

**4 · Only then talk about `T`.** Once tokens are short, revocation latency is bounded and you
can have an honest conversation about whether you need introspection
(**14** *(not written yet)*).

## The exception worth naming

There is one case where a longer access-token lifetime is a considered choice rather than a
mistake: **a confidential client, on infrastructure you control, calling an API behind the same
trust boundary, where the AS is a hard availability dependency you are trying to loosen.** Even
then "longer" means an hour, not a month, and RFC 6750 §5.3's ceiling still applies. The
distinguishing feature of the considered version is that someone wrote down the reasoning and
the review date. The failure mode has neither.

## Gotchas

**★ Nothing fails when you raise the lifetime, which is exactly why it is the most common
failure.**
There is no error, no failing test, no degraded metric. The only observable change is that a
class of production incidents becomes much worse when it eventually happens. Treat a
lifetime increase as a security change requiring the same review as a permissions change.

**★ Permission changes do not take effect until the token expires.**
Claims are frozen at issuance. Remove a user from an admin group with a 30-day token in the
wild and they keep admin for up to 30 days — and the person who removed them will report the
change as done.

**★ Lowering the lifetime is a migration, not a config change.**
Clients that have never refreshed have untested refresh paths. Step it down and instrument
token age, or you will discover every broken client simultaneously.

**★ A long-lived token gets stored like a long-lived secret.**
Nobody writes a 5-minute token to a database. Everybody writes a 30-day one — to disk, to a
config map, to a `.env` committed by accident. The lifetime changes how humans handle the
value, and that is a second-order risk the arithmetic does not capture.

**★ "It's fine, we can revoke it" is usually false and always worth checking.**
RFC 7009 §2 makes access-token revocation only a `SHOULD` — *"Implementations MUST support the
revocation of refresh tokens and SHOULD support the revocation of access tokens"* — and even
where the AS supports it, a resource server validating a JWT locally never asks. Confirm the
mechanism exists end to end before relying on it.

**★ The refresh token being unused is the strongest single tell.**
If refresh is dead code, the access token has become the durable credential. Grep for it;
it takes thirty seconds and it is diagnostic.

**★ A long access-token lifetime does not make the AS less of a dependency, it just delays the
outage.**
Teams raise the lifetime to reduce coupling to the identity provider. It converts a fast, loud
failure into a slow one, and the slow one arrives during an incident when nobody remembers why
tokens are long.

**★ Realm-level defaults apply to clients nobody reviewed.**
Changing the default lifetime on the authorization server, rather than on one client
registration, silently applies to every client — including the internal admin tool with the
widest scopes. Change it per client.

## Interview questions

**★ Why is a long-lived access token the most common real-world OAuth2 failure?**
Because it has no symptom. Every other failure mode in this phase produces an error somebody
has to fix; raising `expires_in` produces a system that works better in the short term —
fewer refreshes, fewer edge cases, no expiry during demos. The costs are all counterfactual:
worse blast radius when a token leaks, permission changes that do not take effect, offboarding
that does not take effect, and, for a locally-validated JWT, revocation that does not exist at
all. Nothing in a build, a test suite or a dashboard measures any of those, so the change
survives review and compounds.

**★ Someone says "our access tokens last 90 days but that's fine, it's the same as an API
key". Respond.**
It is not the same, in two ways that matter. An API key is a *reference* credential: the server
looks it up on every request, so deleting it revokes it instantly — revocability is the design.
A long-lived JWT access token is a *self-contained* credential chosen specifically so no lookup
is needed, so it is the one credential type that cannot be revoked. And an API key is a machine
identity, whereas an access token minted from a user session carries that user's identity and
scopes — including through a permissions change or an offboarding — for 90 days. If the
requirement really is a durable machine credential, use the client credentials grant with short
tokens, or a real API key with real revocation.

**★ How would you migrate a system from 30-day access tokens to 15-minute ones?**
Not in one step. First make refresh work at the current lifetime and ship it — including
correct `invalid_grant` handling that re-authenticates rather than retries, and saving *both*
tokens from the refresh response so rotation will not break it later. Then instrument: emit
token age at validation on the resource server so you can see the distribution move. Then step
the lifetime down — 30 days, 7 days, 1 day, 1 hour, 15 minutes — each step revertable, each
step exercising refresh for a new cohort of clients that never had to. Mobile clients set the
pace, because you cannot roll them forward. Only after tokens are genuinely short is it worth
discussing whether the remaining revocation latency needs introspection.

**★ What is the connection between access-token lifetime and how quickly a permissions change
takes effect?**
They are the same number. Scopes and authority claims are evaluated and frozen when the token
is issued; a resource server validating that token locally applies what is in it. So removing a
role, changing a tenant, or downgrading a plan does not affect any token already issued — it
affects the next one, which arrives at the next refresh, which is at most one lifetime away.
This is the consequence people miss when they argue about lifetimes purely in terms of theft:
a long lifetime is also a long staleness window for authorization data, and it makes the
admin UI lie about when a change took effect.

**★ Is there a legitimate reason to run access tokens longer than an hour?**
RFC 6750 §5.3's *"one hour or less"* is a `SHOULD`, so it can be departed from with reasoning.
The defensible case is a confidential client on infrastructure you control, calling an API
inside the same trust boundary, where you are deliberately loosening an availability dependency
on the authorization server — because at lifetime `L`, an AS outage becomes a total outage after
`L`. Even there the honest version has a written rationale, a review date, audience-restricted
tokens, and a revocation story that does not depend on expiry. What makes the common case a
failure is not the number; it is that nobody chose it.

{/* FOOTER */}
