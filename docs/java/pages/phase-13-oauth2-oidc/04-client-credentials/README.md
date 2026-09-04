---
title: "The grant with no resource owner — and therefore no consent, no redirect, no refresh token, and no authority to touch any particular person's data"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 (§1.3.4, §2.3, §3.3, §4.4, §4.4.1, §4.4.2, §4.4.3,
> §5.1, §6, §10.3); RFC 6750 §1; RFC 7009; RFC 7662; RFC 8693; RFC 8705; RFC 9700 (§2.1.2,
> §2.4); and the Spring Security 7.x reference (OAuth2 Client) — at
> [datatracker.ietf.org](https://datatracker.ietf.org/) and
> [docs.spring.io/spring-security/reference](https://docs.spring.io/spring-security/reference/).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
> **No sandbox** — Java source, config and specification-quoted definitions only.

**Client credentials looks like the simplest grant in OAuth2 and it is, but "simple" is not
why it deserves a topic. It deserves one because it is the grant whose *role map is
different*: there is no resource owner anywhere in RFC 6749 §4.4. Every surprising property
follows from that single absence — no consent screen, no browser redirect, and §4.4.3's flat
"the authorization server MUST NOT issue a refresh token" — and so does the one serious
misuse, which is a service token carrying a call that needed a person's authority and had
none.**

**3 chunks, ~640 lines.** Read in order.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The grant with no user](01-the-grant-with-no-user.md)** | <span className="db-tier t-understand">Understand</span> | Why "MUST NOT issue a refresh token" is a consequence, not a rule to memorise |
| 2 | **[Why not just an API key](02-why-not-just-an-api-key.md)** | <span className="db-tier t-understand">Understand</span> | The honest comparison — including the four cases where the key wins |
| 3 | **[When there is a user after all](03-when-there-is-a-user-after-all.md)** | <span className="db-tier t-understand">Understand</span> | The misuse nothing catches, and the three legitimate ways out |

## The five things this topic is really about

**1 · There is no resource owner, and everything follows from that.** No consent to capture,
so no consent screen. No user agent, so no authorization endpoint and no front channel. No
absent owner whose consent needs standing in for, so §4.4.3 forbids a refresh token outright.
None of these are arbitrary rules; each is the absence showing through.

**2 · Renewal means requesting a new token, so caching is not optional.** Without a cache
the authorization server sits on the critical path of every outbound call, and an AS blip
becomes an outage on a path with no users in it. And the cache needs a renewal margin —
Spring's `clockSkew` — or a token with a second left passes your freshness check, gets sent,
and fails the resource server's `exp` check as an unreproducible intermittent 401.

**3 · `sub` is not a person.** It is the client, or a service account, or absent. Code that
logs it as a user, or looks it up in a `users` table, silently mis-attributes every machine
call. Handle machine callers as an explicit case.

**4 · "Why not an API key" has a real answer and a real counter-answer.** The real answer is
that the credential which travels stops being the credential you must protect forever — and,
less discussed, that a callee verifying a JWT holds only a public key while a callee
verifying an API key holds a secret it can leak. The real counter-answer is that if you do
not already run an authorization server, adopting one purely for machine traffic buys a
runtime dependency on every call path to replace a secret you were already managing. mTLS is
often the better middle ground.

**5 · The dangerous misuse is invisible at runtime.** A scheduled job reading one customer's
records with a service token succeeds, validates, and logs a client id. RFC 6749 §1.3.4
permits this grant only where "the authorization scope is limited to the protected resources
under the control of the client", and a specific customer's data is not. The test: would the
operation be improper if that user objected? If yes, it runs on their authority and needs
offline access, relay, or RFC 8693 token exchange. If the user never consented and never
would, there is no mechanism — because there is no authority.

## Where this connects

**02 · The four roles** [maps this grant's altered role
table](../02-the-four-roles/06-mapping-onto-your-stack.md) alongside five other
architectures. [05 · The three tokens](../05-the-three-tokens/README.md) covers refresh tokens where they
*are* permitted — with rotation and reuse detection — which is the mechanism chunk 3 points
at for offline access. **12 · Token relay across microservices** *(not written yet)* takes up
the audience problem that makes plain relay dangerous.
