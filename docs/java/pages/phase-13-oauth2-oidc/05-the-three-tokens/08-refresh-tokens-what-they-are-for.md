---
title: "A refresh token exists so that the access token can be short, which means it is a deliberate trade of one long-lived credential you can supervise for many short-lived ones you cannot"
sidebar_label: "08 · What refresh tokens are for"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §1.5 (Refresh Token), §5.1 (Successful Response),
> §6 (Refreshing an Access Token), §10.4 (Refresh Tokens), §4.4.3 (Access Token Response)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt));
> RFC 9700 §4.14 (Refresh Token Protection), §4.14.1 (Discussion), §4.14.2 (Recommendations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt));
> `draft-ietf-oauth-browser-based-apps-27` §5.2.1 (Exploiting Stolen Refresh Tokens) — an
> Internet-Draft ([ietf.org](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-27.txt)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**The refresh token is the only long-lived credential in the system, and it is the most
powerful one. It exists for exactly one reason: so the access token does not have to be. Every
rule about refresh tokens — where they may appear, who may hold them, rotation, reuse
detection, inactivity expiry — is downstream of the fact that you concentrated all the
long-lived risk into one place in order to get it out of everywhere else.**

## The definition, and the argument inside it

RFC 6749 §1.5, in full:

> *"Refresh tokens are credentials used to obtain access tokens. Refresh tokens are issued to
> the client by the authorization server and are used to obtain a new access token when the
> current access token becomes invalid or expires, or to obtain additional access tokens with
> identical or narrower scope (access tokens may have a shorter lifetime and fewer permissions
> than authorized by the resource owner). Issuing a refresh token is optional at the discretion
> of the authorization server."*

> *"A refresh token is a string representing the authorization granted to the client by the
> resource owner. The string is usually opaque to the client. The token denotes an identifier
> used to retrieve the authorization information. Unlike access tokens, refresh tokens are
> intended for use only with authorization servers and are never sent to resource servers."*

Four things in there are load-bearing:

1. **"or to obtain additional access tokens with identical or narrower scope"** — a refresh
   token can be exchanged for a *less* privileged token, never a more privileged one. This is
   the mechanism behind "the refresh token is a superset" and it is enforced in §6.
2. **"Issuing a refresh token is optional at the discretion of the authorization server."**
   You are not entitled to one. RFC 9700 §4.14.2 turns this into a requirement to think:
   *"Authorization servers MUST determine, based on a risk assessment, whether to issue refresh
   tokens to a certain client."*
3. **"The token denotes an identifier used to retrieve the authorization information."** Note
   what is missing — the "or may self-contain" alternative that §1.4 offers for access tokens.
   §1.5 describes only the reference form, because the AS is both issuer and validator and
   gains nothing from self-containment.
4. **"never sent to resource servers"** — the sentence that owns
   [08b](08b-why-a-resource-server-must-never-see-one.md).

## Why RFC 9700 says refresh tokens improve security

This is the sentence to quote when somebody proposes removing refresh tokens "to reduce risk".
§4.14:

> *"Refresh tokens are a convenient and user-friendly way to obtain new access tokens. They
> also add to the security of OAuth, since they allow the authorization server to issue access
> tokens with a short lifetime and reduced scope, thus reducing the potential impact of access
> token leakage."*

The refresh token is not a security *cost* that convenience forced on you. It is a security
*mechanism*: without it, the choices are long-lived access tokens (see
[07b](07b-the-long-lived-access-token-failure.md)) or sending the user back through the
authorization endpoint every few minutes.

## And why it is the highest-value target in the system

§4.14.1 is equally blunt in the other direction:

> *"Refresh tokens are an attractive target for attackers because they represent the full scope
> of access granted to a certain client, and they are not further constrained to a specific
> resource. If an attacker is able to exfiltrate and successfully replay a refresh token, the
> attacker will be able to mint access tokens and use them to access resource servers on behalf
> of the resource owner."*

**"Not further constrained to a specific resource."** That is the asymmetry that makes it worse
than an access token. An access token is (or should be) audience-restricted to one resource
server. The refresh token, by construction, covers the entire grant — every audience, every
scope the user consented to. Audience restriction, the cheapest control you have for access
tokens ([04b](04b-safeguarding-a-bearer-token.md)), does not apply to it.

The browser-apps BCP §5.2.1 draws the consequence in operational terms:

> *"In essence, abusing a stolen refresh token enables long-term impersonation of the legitimate
> client application to resource servers. The attack is only stopped when the authorization
> server refuses a refresh token because it has expired or rotated, or when the refresh token is
> revoked."*

Three stopping conditions: expiry, rotation, revocation. Those are exactly the three topics
that follow (**12** *(not written yet)*,
**10** *(not written yet)*, **13** *(not written yet)*) — the BCP is telling you
what the syllabus has to be.

## What RFC 6749 already required, before the BCP

§10.4 is a short section that people skip because it predates the interesting parts. It is the
baseline, and RFC 9700 §4.14.1 lists it as *"robust baseline protection"*:

> *"Refresh tokens MUST be kept confidential in transit and storage, and shared only among the
> authorization server and the client to whom the refresh tokens were issued. The authorization
> server MUST maintain the binding between a refresh token and the client to whom it was issued.
> Refresh tokens MUST only be transmitted using TLS […]"*

> *"The authorization server MUST verify the binding between the refresh token and client
> identity whenever the client identity can be authenticated. When client authentication is not
> possible, the authorization server SHOULD deploy other means to detect refresh token abuse."*

> *"The authorization server MUST ensure that refresh tokens cannot be generated, modified, or
> guessed to produce valid refresh tokens by unauthorized parties."*

The middle one is where public clients come in. A confidential client authenticates on every
refresh, so the AS can prove the presenter is the right client. A public client cannot — there
is no secret — so §10.4's fallback is *"other means to detect refresh token abuse"*, which is
the sentence rotation was invented to satisfy. RFC 9700 §2.2.2 then hardens it into a `MUST`:
*"Refresh tokens for public clients MUST be sender-constrained or use refresh token rotation."*

## The AS must decide whether to issue one at all

§4.14.2:

> *"Authorization servers MUST determine, based on a risk assessment, whether to issue refresh
> tokens to a certain client. If the authorization server decides not to issue refresh tokens,
> the client MAY obtain a new access token by utilizing other grant types, such as the
> authorization code grant type. In such a case, the authorization server may utilize cookies
> and persistent grants to optimize the user experience."*

That last sentence describes the pattern people call "silent renewal": the client re-runs the
authorization code flow in a hidden iframe or via a redirect, and the AS's own session cookie
makes it invisible to the user. It was the standard SPA approach before third-party cookie
blocking broke it — which is exactly why the browser-apps BCP §6.3.2.3 now says *"in light of
the impact of third-party cookie-blocking mechanisms, the use of refresh tokens has become
significantly more attractive."* The industry moved *back* to refresh tokens for SPAs because
the alternative stopped working.

## And it must bind the scope

> *"If refresh tokens are issued, those refresh tokens MUST be bound to the scope and resource
> servers as consented by the resource owner. This is to prevent privilege escalation by the
> legitimate client and reduce the impact of refresh token leakage."*

Note the threat named first: *"privilege escalation by the legitimate client"*. The AS is
defending against your own client asking for more than the user agreed to, not only against
attackers. That is why RFC 6749 §6 makes the `scope` parameter on a refresh request
narrowing-only.

## Which grants produce one

| Grant | Refresh token? |
|---|---|
| Authorization code (+ PKCE) | yes, at the AS's discretion |
| Refresh token grant | yes, if the AS rotates; RFC 6749 §6 makes it a `MAY` |
| Client credentials | **no** — RFC 6749 §4.4.3: *"A refresh token SHOULD NOT be included."* The client can ask again with its own credentials |
| Device authorization (RFC 8628) | yes |
| Implicit | no — and the grant itself carries a `SHOULD NOT` in RFC 9700 §2.1.2 |
| Resource owner password credentials | irrelevant — RFC 9700 §2.4: *"MUST NOT be used"* |

The client-credentials row is the one that catches people building service-to-service clients:
if the service already holds credentials that mint tokens on demand, a refresh token adds a
second long-lived secret for no benefit. That is **04 · Client credentials** *(not written
yet)*.

## Gotchas

**★ The refresh token is not "the token that lets you keep working" — it is the whole grant in
one string.**
RFC 9700 §4.14.1: it represents *"the full scope of access granted to a certain client"* and is
*"not further constrained to a specific resource"*. Everything the user consented to, for every
API, in one value. Treat it accordingly.

**★ Audience restriction — your best access-token control — does not apply to refresh tokens.**
An audience-restricted access token is useless at the wrong API. A refresh token covers every
audience in the grant by construction, which is why the controls for it are rotation, expiry
and revocation rather than scoping.

**★ You are not entitled to a refresh token.**
RFC 6749 §1.5: *"Issuing a refresh token is optional at the discretion of the authorization
server"*, and RFC 9700 §4.14.2 makes it a `MUST`-do-a-risk-assessment. A client that assumes
one will be present and has no re-authorization path will simply break against a conformant AS
that declines.

**★ Client credentials responses should not carry a refresh token, and if yours does, question
it.**
The client can obtain a new access token any time using its own credentials, so a refresh token
is a second long-lived secret with no additional capability — and one more thing to store,
rotate and leak.

**★ A refresh token's scope can only narrow, never widen.**
RFC 6749 §6: *"The requested scope MUST NOT include any scope not originally granted by the
resource owner."* A client that needs more scope must go back through the authorization
endpoint and get fresh consent, not ask the refresh grant nicely.

**★ "Refresh tokens are a security risk, let's not use them" gets the argument backwards.**
RFC 9700 §4.14 says they *"add to the security of OAuth, since they allow the authorization
server to issue access tokens with a short lifetime and reduced scope"*. Removing them without
replacing them with something leaves you choosing between long-lived access tokens and
constant re-authentication.

**★ Silent renewal via a hidden iframe is not the modern alternative it used to be.**
Third-party cookie blocking broke it, which the browser-apps BCP §6.3.2.3 names directly as the
reason refresh tokens became *"significantly more attractive"* for browser clients. If a design
document proposes iframe renewal as the way to avoid refresh tokens, it is working from
pre-2020 assumptions.

**★ A public client cannot prove it is the right client, and that is the entire reason rotation
exists.**
RFC 6749 §10.4 requires the AS to verify the client binding *"whenever the client identity can
be authenticated"* and, when it cannot, to *"deploy other means to detect refresh token
abuse"*. Rotation is that other means, and RFC 9700 §2.2.2 turned it into a requirement.

## Interview questions

**★ What is a refresh token for, and why is having one *more* secure than not having one?**
It is a credential used only against the authorization server's token endpoint to obtain new
access tokens without involving the user — RFC 6749 §1.5: *"Refresh tokens are credentials used
to obtain access tokens."* It makes the system more secure, not less, because it is what allows
access tokens to be short-lived and narrowly scoped. RFC 9700 §4.14 states it directly: refresh
tokens *"add to the security of OAuth, since they allow the authorization server to issue access
tokens with a short lifetime and reduced scope, thus reducing the potential impact of access
token leakage."* Without one, your options are a long-lived access token — the failure in
[07b](07b-the-long-lived-access-token-failure.md) — or sending the user through the
authorization endpoint every few minutes.

**★ Why is a stolen refresh token worse than a stolen access token?**
Three reasons, all in RFC 9700 §4.14.1. It *"represent[s] the full scope of access granted to a
certain client"*, so it is not limited to one API or one scope. It is *"not further constrained
to a specific resource"*, so audience restriction — the cheapest and most widely deployed
control for access tokens — does not apply to it. And it is long-lived, so the attacker can
*"mint access tokens and use them to access resource servers on behalf of the resource owner"*
for as long as the grant survives. The browser-apps BCP §5.2.1 calls it *"long-term
impersonation"*, and lists only three things that stop it: expiry, rotation, or revocation.

**★ Why do public clients need rotation when confidential clients do not?**
Because RFC 6749 §10.4 requires the AS to *"verify the binding between the refresh token and
client identity whenever the client identity can be authenticated"* — and a confidential client
authenticates on every refresh, so a stolen refresh token is useless without also stealing the
client secret. A public client has no secret to authenticate with, so the AS cannot tell the
legitimate client from a thief presenting the same token. §10.4's answer is that the AS
*"SHOULD deploy other means to detect refresh token abuse"*, and RFC 9700 §2.2.2 hardens it:
*"Refresh tokens for public clients MUST be sender-constrained or use refresh token rotation."*
Rotation is a detection mechanism substituting for an authentication mechanism the client type
cannot provide.

**★ Can a client use a refresh token to get a token with more scope than it currently has?**
No. RFC 6749 §1.5 says a refresh token is used to obtain access tokens *"with identical or
narrower scope"*, and §6 makes it explicit for the request: *"The requested scope MUST NOT
include any scope not originally granted by the resource owner, and if omitted is treated as
equal to the scope originally granted."* RFC 9700 §4.14.2 gives the reason — refresh tokens
must be bound to the consented scope *"to prevent privilege escalation by the legitimate
client"*. To get more scope, the client must go back through the authorization endpoint and
obtain fresh consent.

**★ Your service-to-service client receives a refresh token from a client credentials response.
What do you do?**
Question it, and do not use it. In the client credentials grant there is no resource owner and
no user session — the client authenticates with its own credentials and can obtain a new access
token whenever it wants, so a refresh token grants no capability the client does not already
have. What it does add is a second long-lived secret to store, rotate, audit and eventually
leak. RFC 6749 §4.4.3 is explicit: *"A refresh token SHOULD NOT be included."* If your AS
does, ignore it, and do not persist it.

{/* FOOTER */}
