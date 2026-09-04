---
title: "Four roles, two client types and two channels — the vocabulary every later topic in this phase assumes, and the reason most OAuth2 design arguments are really two people who have assigned the same component to different roles"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 (§1.1, §1.2, §2.1, §2.2, §2.3, §2.3.1, §3.1, §3.1.2,
> §3.1.2.2, §3.1.2.3, §3.2, §4.1, §4.4, §10.3, §10.4); RFC 7523 (§2.2, §3); RFC 8705;
> RFC 7591; RFC 8693; RFC 9700 (§2.1, §2.1.1, §2.1.2, §2.2.1); and the Spring Security 7.x
> reference — at [datatracker.ietf.org](https://datatracker.ietf.org/) and
> [docs.spring.io/spring-security/reference](https://docs.spring.io/spring-security/reference/).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
> **No sandbox** — Java source, config and specification-quoted definitions only; no
> fabricated transcripts and no real tokens.

**This is the vocabulary topic, and it is Master tier for one reason: nearly every confused
OAuth2 conversation is two engineers who have silently assigned the same running process to
different roles. "The client" means the browser to one of them and the registered
application to the other, and neither notices for twenty minutes. Four roles, the
confidential/public split, the two channels and the registration record are the whole
vocabulary — and each of them is a security control, not a label.**

Three ideas here do more work than the rest of the phase combined. The
**confidential/public** split turns on whether code can keep a secret *from the person
running it*, and it decides which grants are available, whether PKCE is a MUST or a
RECOMMENDED, and whether a client secret is a credential or a published string. The
**front/back channel** distinction explains why the authorization code takes the exposed
route and the tokens never do. And **registration** — the step everyone treats as
paperwork — is where the redirect URI becomes the only thing standing between an
authorization code and an attacker.

**6 chunks, ~1,500 lines.** Read in order.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The four roles](01-the-four-roles.md)** | <span className="db-tier t-master">Master</span> | Each §1.1 definition read for the word doing the work, and the arrow that does not exist |
| 2 | **[Confidential vs public](02-confidential-and-public-clients.md)** | <span className="db-tier t-master">Master</span> | The adversary in §2.1 is the *user*; seven things change on that one answer |
| 3 | **[Client authentication](03-client-authentication.md)** | <span className="db-tier t-master">Master</span> | Seven methods, and the line between those an AS breach can impersonate you with and those it cannot |
| 4 | **[Front and back channel](04-front-channel-and-back-channel.md)** | <span className="db-tier t-master">Master</span> | Label every arrow and the attack surface of each step becomes derivable |
| 5 | **[Registration and redirect URIs](05-registration-and-redirect-uris.md)** | <span className="db-tier t-master">Master</span> | Exact string matching, and the open redirect that defeats it anyway |
| 6 | **[Mapping onto your stack](06-mapping-onto-your-stack.md)** | <span className="db-tier t-master">Master</span> | Six real architectures, every component labelled, configuration derived from the labels |

## The seven things this topic is really about

**1 · Roles are per-interaction, not per-deployable.** One Spring service is routinely a
resource server for inbound traffic and a client for outbound traffic, and neither
configuration implies the other. When someone says "the service uses OAuth2", the useful
question is *which direction*.

**2 · The authorization server and the resource server never talk during the flow.** Not in
RFC 6749 §1.2's steps (D) or (F). Trust is established out of band — a cached JWKS fetch, or
introspection. That absence is what lets one issuer serve fifty resource servers, and an
arrow drawn there leads to designs that put the AS on every request's critical path.

**3 · Confidential vs public turns on one question, and the adversary is the user.** Not the
network, not a third party — the person running the software. Anyone can open DevTools, unzip
an APK or run `strings`. Ownership, first-party status, code signing and TLS are all
irrelevant to the classification, and getting it wrong makes everything downstream wrong.

**4 · For a public client the authorization server cannot know who is calling.** §2.3 forbids
relying on public client authentication to identify the client, and §2.2 says `client_id`
"is not a secret". So the protection is not identity at all — it is *where the response may
go* (exact redirect matching) and *who may complete the flow* (PKCE). Understanding that
substitution is understanding why both rules are absolute.

**5 · The authorization code exists so that something disposable takes the dangerous
route.** The front channel leaks into history, `Referer` headers and six kinds of access
log. A code is single-use, seconds-lived, and unusable without client authentication or a
PKCE verifier, so it can survive that route. Access and refresh tokens cannot, which is why
they come back only on the back channel — and why returning a token in the redirect is the
implicit grant that RFC 9700 §2.1.2 says clients SHOULD NOT use.

**6 · `state` and PKCE are different defences and neither substitutes for the other.**
`state` binds the callback to the session that started the flow, defeating CSRF on the
callback. PKCE binds redemption of the code to whoever generated the verifier, defeating a
stolen code. An attacker holding the code usually holds the `state` too — they arrived in
the same URL.

**7 · Client authentication has a better answer than a shared secret, and it is unused.**
`client_secret_basic` means the authorization server stores something that could impersonate
your client; `private_key_jwt` (RFC 7523) and mTLS (RFC 8705) mean it stores only a public
key or a certificate. Same protocol, same effort once, and a breach of the AS stops being a
breach of you.

## Where this goes next

[03 · Authorization code flow with PKCE](../03-authorization-code-pkce/README.md) takes the vocabulary here and
walks the flow parameter by parameter, with the attack behind each one — and buries the
implicit and password grants with the reason each died.
[05 · The three tokens](../05-the-three-tokens/README.md) takes the front/back-channel argument further:
which token may legally appear where, and why a resource server must never see a refresh
token.
