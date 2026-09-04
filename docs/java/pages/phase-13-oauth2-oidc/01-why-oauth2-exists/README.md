---
title: "OAuth2 makes sense in exactly one direction — from the problem backwards — and every part of it that looks arbitrary is an answer to one of the five failures RFC 6749 lists in its first page"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 (Abstract, §1, §1.1, §1.2, §1.3, §1.8, §3.3, §4.4,
> §5.2, §7.1), RFC 5849 (§2.2, §3.1, §3.3, §3.4 and subsections), RFC 6750 §1, RFC 9700
> (§2.1, §2.1.1, §2.1.2, §2.2.1, §2.4), RFC 8414, RFC 9068 and OpenID Connect Core 1.0 §2 —
> at [datatracker.ietf.org](https://datatracker.ietf.org/) and
> [openid.net/specs](https://openid.net/specs/openid-connect-core-1_0.html).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
> **No sandbox** — these pages carry Java source, config and specification-quoted
> definitions, never a fabricated HTTP transcript or a real token.

**Almost everyone learns OAuth2 forwards: here are four roles, here is a redirect, here are
some tokens, memorise the diagram. It does not stick, because nothing in the diagram
explains why any of it is shaped that way. This topic goes backwards. RFC 6749 opens by
listing five specific things that break when a program has to hold your password, and every
later mechanism — scopes, expiry, the redirect, the code exchange, the token the API never
sees — is a direct answer to one of them. Learn the five and the flow becomes derivable
instead of memorised.**

The second thing this topic does is draw the line the industry spent a decade getting wrong.
OAuth2 answers *may this program do this thing*. It never answers *who is this person* — and
every "Sign in with…" vulnerability of the 2010s is the same bug, which is why OpenID
Connect had to exist at all.

**5 chunks, ~1,130 lines.** Read in order.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The password anti-pattern](01-the-password-anti-pattern.md)** | <span className="db-tier t-understand">Understand</span> | RFC 6749 §1's five failures, each read as the design requirement it creates |
| 2 | **[Authorization is not authentication](02-authorization-is-not-authentication.md)** | <span className="db-tier t-understand">Understand</span> | Three ways teams bolted identity onto OAuth2, and the attack each one lets through |
| 3 | **[What came before](03-what-came-before.md)** | <span className="db-tier t-understand">Understand</span> | OAuth 1.0 signed every request; 2.0 deleted that and bought the guarantee from TLS |
| 4 | **[A framework, not a protocol](04-a-framework-not-a-protocol.md)** | <span className="db-tier t-understand">Understand</span> | The eight things RFC 6749 deliberately does not decide, and what each one breaks |
| 5 | **[When you don't need it](05-when-you-do-not-need-oauth2.md)** | <span className="db-tier t-understand">Understand</span> | No third party, no delegation, no OAuth2 — and the eight costs of adopting it anyway |

## The five things this topic is really about

**1 · The five failures are the whole specification in miniature.** A client holding the
user's password must store it in clear text; forces the service to support passwords
forever; gets unlimited, unbounded access; cannot be revoked without revoking everyone; and
turns its own breach into a breach of the user's password everywhere it was reused. Scope,
`expires_in`, per-client grants and RFC 7009 revocation exist because of items three, four
and five — one for one.

**2 · The second failure is the one that ages worst.** Password-replay integrations mean
password authentication can never be switched off. Teams meet this years later, when passkeys
or phishing-resistant MFA are blocked by an integration decision nobody remembers making.

**3 · Authorization is not authentication, and the confusion has a specific source.** An
authentication event genuinely happens inside an OAuth2 flow — at the authorization server,
which must know whose consent it is recording. What comes back to the client is a *bearer*
token, which by RFC 6750's semantics says only that its holder may do something. The event
happened; the result was never communicated. OIDC's ID token is that missing communication,
and its `iss`, `aud`, `nonce` and signature each close one concrete attack.

**4 · OAuth 2.0 is a deliberate downgrade in one dimension, and knowing which one is the
point.** OAuth 1.0's per-request signature meant a stolen token was unusable without the
secret. Bearer tokens abandoned that for implementability, and every "keep lifetimes short,
never put a token in a URL, TLS everywhere" rule is compensation. RFC 9700 §2.2.1's push
toward mTLS and DPoP is the industry buying the property back now that infrastructure can
provide it instead of application code.

**5 · "We support OAuth2" is not an interoperability claim, and §1.8 says so.** The
specification predicts "a wide range of non-interoperable implementations" and expects
profiles to fix it. Token format, validation method, scope vocabulary, consent behaviour,
error mapping, discovery and registration are all undefined — which is why every integration
starts with the same eight provider-specific questions, and why this phase teaches a set of
RFCs rather than one.

## Where this goes next

[02 · The four roles](../02-the-four-roles/README.md) turns the vocabulary into a map of your own stack —
including the confidential/public client split that OAuth 1.0's model could not express.
[03 · Authorization code flow with PKCE](../03-authorization-code-pkce/README.md) fills in every one of §1.2's six
lettered steps with real parameters, and buries the implicit and password grants with the
attack that killed each.
