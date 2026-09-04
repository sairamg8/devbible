---
title: "OpenID Connect is one token, one scope value and one validation procedure — everything else in the specification is convenience around the fact that OAuth2's access token structurally cannot say who somebody is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §1 (Introduction), §2 (ID Token),
> §3.1.2.1 (Authentication Request), §3.1.3.7 (ID Token Validation), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> OpenID Connect Discovery 1.0 §2, §3, §4, §4.3, at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> RFC 6749 §1.1, RFC 6750 §1, RFC 7519 §4.1
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700 §2.1.2
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> Target: **JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x**.
> **No sandbox** — Java source, config and specification-quoted definitions; token structure
> where shown is illustrative and labelled as such, never a real token.
>
> ⚠️ **A provenance note for whoever extends this topic.** The published HTML of Core 1.0
> truncates before §5 in the form this corpus can read. §5.1 (Standard Claims), §5.3.2
> (Successful UserInfo Response), §5.4 (Requesting Claims using Scope Values) and §8 (Subject
> Identifier Types) were **not** re-read in this pass — two attempts, both returning nothing
> for those sections. Any page here that touches them says so on its own line rather than
> quoting them from memory. The banked verbatim quotes are in the memory store as
> `research_java_p13_t07_oidc.md`.

**OpenID Connect is usually taught as a large addition to OAuth2 and it is not. It is one
artefact — a JWT called the ID token, defined in one section with ten claims — plus one
scope value that switches it on, plus one numbered procedure for validating it. The reason
it had to exist at all is structural rather than historical: an OAuth2 access token is a
bearer credential describing *permission*, opaque to the client by contract, with nothing in
it that binds it to the application that requested it. An ID token is a signed assertion, by
a named issuer, to a named client, about a named subject, at a named time. No amount of care
makes the first behave like the second, which is why every pre-OIDC "Sign in with…"
implementation was subtly broken in the same way.**

The second thing this topic is for is the boundary. OIDC answers *who is this person*; OAuth2
answers *may this program do this thing*. That boundary has a concrete consequence you will
meet in code within a week: the ID token goes to your client and never to an API, the access
token goes to the API and is never parsed by your client, and an application that gets those
two backwards will appear to work for a long time before it fails in a way nobody can debug.

**14 chunks, ~3,270 lines.** Read 01 first; 04 and 04b then 08 are the ones to know cold.

## Chunks

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The layer OAuth2 was missing](01-the-layer-oauth2-was-missing.md)** | <span className="db-tier t-understand">Understand</span> | One artefact, ten claims, five of them REQUIRED — and why each REQUIRED one closes a specific pre-OIDC attack |
| 2 | **[The authentication request](02-the-authentication-request.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The `openid` scope is the whole switch; without it §3.1.2.1 says the behaviour is "entirely unspecified" |
| 3 | **[Asking about the human](02b-the-parameters-about-the-human.md)** | <span className="db-tier t-understand">Understand</span> | `max_age`, `acr_values`, `prompt` and the two hints — four requests the AS may ignore, and where enforcement actually lives |
| 4 | **[Validating an ID token](03-validating-an-id-token.md)** | <span className="db-tier t-master">Master</span> | 🔴 §3.1.3.7's thirteen rules; rules 3 and 6 are the two whose omission is a full bypass |
| 5 | **[Signature, time and the rest](03b-signature-time-and-the-conditional-checks.md)** | <span className="db-tier t-master">Master</span> | Rule 5's narrow permission to skip the signature, rule 8's `client_secret`-as-HMAC-key trap, and the three checks conditional on your own request |
| 6 | **[The three bindings](04-nonce-state-and-the-three-bindings.md)** | <span className="db-tier t-master">Master</span> | 🔴 `state`, PKCE and `nonce` — three checkers, three endpoints, three stored values; and the one you cannot verify yourself |
| 7 | **[Generating and storing them](04b-generating-and-storing-them.md)** | <span className="db-tier t-master">Master</span> | Entropy and lifecycle — why a session-scoped slot breaks on the second tab, and where the pending record lives when you scale out |
| 8 | **[Discovery](05-discovery-and-the-well-known-document.md)** | <span className="db-tier t-understand">Understand</span> | Nine configuration values become one — and §4.3's rule that the issuer, the document's `issuer` and every `iss` are one string |
| 9 | **[The metadata document](05b-the-metadata-document.md)** | <span className="db-tier t-understand">Understand</span> | The seven REQUIRED members, the RS256 guarantee, and why an absent optional member proves nothing |
| 10 | **[Standard scopes and claims](06-standard-scopes-and-claims.md)** | <span className="db-tier t-understand">Understand</span> | `openid` is a switch, the other four are bundles — and `email_verified` is the claim that matters, not `email` |
| 11 | **[The UserInfo endpoint](07-the-userinfo-endpoint.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The one call your client makes with the *access* token — unsigned, unaddressed, bound to your login only by the `sub` cross-check |
| 12 | **[`sub` is not an email](08-sub-is-not-an-email.md)** | <span className="db-tier t-master">Master</span> | 🔴 The only claim promised never to be reassigned — key on `(iss, sub)`, and why pairwise identifiers break a second client registration |
| 13 | **[Response types and modes](09-response-types-and-modes.md)** | <span className="db-tier t-understand">Understand</span> | Seven response types, one answer — and `response_mode=form_post`, which is separate and genuinely useful |
| 14 | **[Logout](10-logout.md)** | <span className="db-tier t-understand">Understand</span> | Three operations wearing one word, and the one thing logout cannot reach: an access token already issued |

## The five things this topic is really about

**1 · One scope value is the entire switch.** §3.1.2.1 marks `scope` REQUIRED and says OIDC
requests MUST contain `openid`; without it *"the behavior is entirely unspecified"*. Same
authorization endpoint, same redirect, same code exchange, same token endpoint — the only
difference is that the token response now carries an `id_token`. If no ID token arrives,
check the scope before anything else.

**2 · `aud` is the claim the whole layer was built for.** An access token has no field
saying which application it was issued to, which is why a token minted for one client is
indistinguishable from one minted for another. §2 requires the ID token's `aud` to contain
your `client_id`, and §3.1.3.7 rule 3 makes checking it a MUST. Skip that one check and an
attacker who registers their own client at the same provider can log in as anyone who has
ever used it.

**3 · Validation is a numbered procedure, not a vibe.** Thirteen rules, of which two —
signature and audience — are the difference between a lock and no lock, and three more are
conditional on what your own request asked for. Those three are the ones that quietly go
missing, because nothing in the response tells you a check was owed.

**4 · `state`, PKCE and `nonce` are three defences, not three names for one.** Different
parties check them, at different endpoints, against different stored values, and each is the
only thing standing between you and its own attack. RFC 9700 §2.1.1's overlap between PKCE
and `state` is real, narrow and conditional on somebody else's server configuration.

**5 · The ID token is not a session, not an access token and not a live view of the user.**
It is a statement that an authentication happened at a moment. Your session is your own object
with its own lifetime; the API's credential is the access token; the current value of a
user's name comes from UserInfo or your own store, not from a token minted an hour ago.

## What this topic does not cover, and why

Every row of the boundary this phase set for topic 07 is now written. Two deliberate
omissions, both provenance rather than scope:

- **OIDC Core §5.1, §5.3, §5.3.2, §5.4 and §8** could not be read — the published HTML of
  Core 1.0 truncates before §5, and two fetch attempts returned nothing for those sections.
  Chunks 10, 11 and 12 say so on their own `> Verified:` lines and present the scope→claim
  mapping, the UserInfo `sub` cross-check and the public/pairwise distinction as
  well-established practice grounded in the sections that *were* read, rather than as
  quotations. **A later pass with a readable copy of §5 and §8 should upgrade those three
  pages to verbatim citation.**
- **RP-Initiated Logout, Front-Channel Logout, Back-Channel Logout and Session Management**
  are separate specifications and were not fetched. Chunk 14 describes the three layers and
  their consequences without quoting parameter tables from those documents.

The natural extension, if this topic is reopened: **`prompt=none` and silent renewal in
depth**, and **the `claims` request parameter** for per-claim requests rather than
scope-shaped bundles.

## Phase gate

You are done with this topic when you can say what OIDC adds to OAuth2 in one sentence, name
the five REQUIRED ID token claims and the attack each closes, state which two of §3.1.3.7's
thirteen rules are a complete bypass when skipped, and explain — without looking it up — why
an ID token must never be sent to an API.

## Where this connects

- [01 · Why OAuth2 exists](../01-why-oauth2-exists/README.md) — chunk 02 there is the
  "authorization is not authentication" argument this topic is the answer to.
- [03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md) — the flow an
  OIDC authentication request *is*, with one scope value added.
- [05 · The three tokens](../05-the-three-tokens/README.md) — the ID token as the third role,
  alongside access and refresh.
- [06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md) — the wire
  format and the signature rules §3.1.3.7 rules 6–8 depend on.
- [08 · Spring Security as resource server](../08-spring-security-resource-server/README.md) —
  the other side of the boundary: why the API validates the access token and never the ID
  token.

---

Start → [The layer OAuth2 was missing](01-the-layer-oauth2-was-missing.md)
