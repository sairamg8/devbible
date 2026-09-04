---
title: "OpenID Connect adds one artefact to OAuth2 and the artefact is the whole layer — a signed JSON Web Token whose audience is your client id, which is precisely the thing an access token could never be and precisely why every pre-OIDC 'Sign in with' implementation was subtly broken"
sidebar_label: "01 · The layer OAuth2 was missing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against OpenID Connect Core 1.0 §2 (ID Token) — the claim table with
> its REQUIRED/OPTIONAL markings — and §1 (Introduction), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> and RFC 6749 §1.1, RFC 6750 §1, RFC 7519 §4.1.
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**OpenID Connect is often described as "OAuth2 plus identity", which makes it sound like a
large addition. It is not. It is one token, defined in one section, with ten claims — and
the reason it had to exist is that OAuth2's access token is structurally incapable of doing
this job. An access token is a bearer credential describing *permission*, opaque to the
client by contract, with no binding to who requested it. An ID token is a signed assertion
*to a named client* about *a named subject*. Those are different objects with different
security properties, and no amount of care makes the first behave like the second.**

## The one artefact

An **ID token** is a JWT, signed by the issuer, delivered to the client. That is it. Every
other part of OIDC — discovery, UserInfo, the standard scopes, the response modes — is
convenience around that one object.

The relationship to OAuth2 is worth stating exactly: an OIDC flow *is* an OAuth2
authorization code flow, with `openid` included in the `scope` parameter, which causes the
authorization server to return an `id_token` alongside the access token. Same endpoints,
same redirect, same code exchange. **The `openid` scope is the switch.**

## The claims, and which are REQUIRED

OIDC Core §2 defines the ID token's claims. The REQUIRED/OPTIONAL markings matter, because
validation logic must not depend on a claim the specification lets an issuer omit:

| Claim | Status | §2's description |
|---|---|---|
| `iss` | **REQUIRED** | *"Issuer Identifier for the Issuer of the response."* |
| `sub` | **REQUIRED** | *"Subject Identifier. A locally unique and never reassigned identifier within the Issuer for the End-User."* 🔴 *"It MUST NOT exceed 255 ASCII characters in length."* |
| `aud` | **REQUIRED** | *"Audience(s) that this ID Token is intended for. It MUST contain the OAuth 2.0 `client_id` of the Relying Party as an audience value."* |
| `exp` | **REQUIRED** | *"Expiration time on or after which the ID Token MUST NOT be accepted by the RP when performing authentication."* |
| `iat` | **REQUIRED** | *"Time at which the JWT was issued."* |
| `auth_time` | OPTIONAL | *"Time when the End-User authentication occurred."* REQUIRED when `max_age` is requested or when requested as an Essential Claim |
| `nonce` | OPTIONAL | *"String value used to associate a Client session with an ID Token, and to mitigate replay attacks."* |
| `acr` | OPTIONAL | *"Authentication Context Class Reference."* |
| `amr` | OPTIONAL | *"Authentication Methods References."* A JSON array of identifiers for the methods used |
| `azp` | OPTIONAL | *"Authorized party - the party to which the ID Token was issued."* §2 notes it *"only occurs when extensions beyond the scope of this specification are used"* |

## Why each of the five REQUIRED claims exists

This is the part worth being able to reconstruct. Each closes a specific attack that broke
real pre-OIDC implementations:

**`iss` — which issuer said this.** Without it, an assertion from any provider you trust for
any purpose is indistinguishable from one from the provider you meant. In a multi-provider
application this is the difference between "Alice at our corporate IdP" and "Alice at a
consumer provider anyone can register with".

**`sub` — who.** And note the two qualifiers: *locally unique* — within the issuer, so it is
meaningless without `iss` — and *never reassigned*, which is the property that makes it safe
as a key where an email address is not. The 255-ASCII-character limit is a real constraint
when you size a database column.

**`aud` — issued to whom.** 🔴 **This is the claim that did not exist before OIDC and is the
entire reason the layer was needed.** §2 requires it to contain your `client_id`. It is what
makes a token minted for a different application useless at yours — closing the cross-client
replay and confused-deputy attacks that
[Authorization is not authentication](../01-why-oauth2-exists/02-authorization-is-not-authentication.md)
walks through.

**`exp` — still current.** With §2's unusually direct wording: on or after this time the ID
token *"MUST NOT be accepted by the RP when performing authentication"*. Not "should be
treated with suspicion" — must not be accepted.

**`iat` — when issued.** Which lets a relying party impose a stricter freshness rule than
`exp` alone, and is what `max_age` and `auth_time` reasoning builds on.

## The two OPTIONAL claims that are not optional in practice

**`nonce`.** §2 marks it OPTIONAL because it is only meaningful in flows that send one. In
the authorization code flow you should always send one, and its absence in a returned ID
token when you sent one is a validation failure. It binds the assertion to *the flow this
application started*, closing injection of an ID token obtained from a different flow. This
is the same idea as `state`, applied to the assertion rather than the callback, and — like
`state` and PKCE — it defends a distinct attack rather than duplicating one.

**`auth_time`.** OPTIONAL in general, but §2 makes it REQUIRED when `max_age` is requested
or when it is asked for as an Essential Claim. It matters the moment you have a step-up
requirement: "re-authenticate for payments" is `max_age`, and checking it is reading
`auth_time`.

## `azp` — the claim that confuses everyone

§2 admits it is unusual: `azp` is the *authorized party*, and the specification notes it
*"only occurs when extensions beyond the scope of this specification are used"*. In practice
providers emit it when the token's audience differs from the party that requested it. **Do
not build authorization on `azp`, and do not require it** — its presence and semantics vary
by provider, and it is a frequent source of tokens rejected by an over-strict validator.

## What an ID token is not

Three negatives worth stating outright, because each is a live production mistake:

1. **It is not an access token.** Never send it to an API. It is an assertion *to your
   client*, addressed to your `client_id`, and an API that accepts it is accepting a token
   whose audience is somebody else — see chunk 3.
2. **It is not a session.** It is a statement that an authentication happened at a moment.
   Your application's session is your own, with its own lifetime; an ID token with a
   five-minute `exp` does not mean the user is logged out in five minutes.
3. **It is not a source of live user data.** The claims are a snapshot at issue time. If the
   user changes their name a second later, your ID token is stale and correct — the current
   value comes from UserInfo or your own store.

## Gotchas

**★ `sub` is only unique *within an issuer* — key on `(iss, sub)`.**
§2 says "locally unique … within the Issuer". Two providers can and do issue the same `sub`
string. A `users` table keyed on `sub` alone breaks the day a second provider is added, and
the failure mode is account collision, not an error.

**★ `sub` MUST NOT exceed 255 ASCII characters — size the column accordingly.**
§2 states the limit. `VARCHAR(64)` because the provider you tested with emits a UUID is a
truncation bug waiting for a provider that emits a longer opaque identifier.

**★ Never key a user account on `email`.**
It is mutable, it can be reassigned by a corporate IdP after someone leaves, and unless
`email_verified` is true it is unproven. `sub` is specified as never reassigned; `email` is
not.

**★ `aud` must contain your `client_id`, and it may be an array.**
§2 requires your `client_id` as *an* audience value, not the only one. A validator doing
`aud.equals(clientId)` fails against a multi-audience token; check membership.

**★ Sending an ID token to an API is a real and common bug.**
It often *works*, because a resource server configured only to check a signature and an
issuer will accept it. That it works is the problem — see chunk 3 on why the API must
require the right audience.

**★ `azp` is provider-specific; do not require it and do not authorise on it.**
§2 itself says it only appears with extensions beyond the specification. Validators that
demand it reject perfectly good tokens from providers that never emit it.

**★ An ID token's `exp` is not your session length.**
Conflating them produces either a user logged out every five minutes or a session that
outlives its own evidence. Decide your session lifetime deliberately.

**★ Claims are a snapshot, not a subscription.**
Nothing pushes an update when a user's name, email or group membership changes. If freshness
matters, re-read from UserInfo or your own store rather than from a token minted an hour ago.

**★ `nonce` is only a defence if you actually check it.**
Generating one, sending it and never comparing it on return is a common half-implementation.
It must be stored against the session and compared, exactly like `state`.

**★ The `openid` scope is what makes it an OIDC flow.**
Omit it and you get an OAuth2 flow with no ID token, and applications then "log the user in"
from the access token — which is the whole bug OIDC exists to remove. If no `id_token` comes
back, check the scope before anything else.

## Interview questions

**★ What does OpenID Connect add to OAuth2?**
One artefact: the ID token, a JWT signed by the issuer and delivered to the client, defined
in OIDC Core §2 with five REQUIRED claims — `iss`, `sub`, `aud`, `exp`, `iat` — plus optional
ones including `nonce`, `auth_time`, `acr`, `amr` and `azp`. Everything else in OIDC is
convenience around it. Mechanically an OIDC flow is an OAuth2 authorization code flow with
`openid` in the scope, which switches on the `id_token` in the response.

**★ Why can't the access token do the ID token's job?**
Because it is a different kind of object. An access token is a bearer credential describing
permission, defined as opaque to the client, with no claim binding it to the client that
requested it — so a token minted for another application is indistinguishable from yours,
which is exactly the cross-client replay and confused-deputy problem. The ID token is a
signed assertion whose `aud` must contain your `client_id`, so it is verifiably *for you*,
and OIDC Core specifies it as something the client reads.

**★ Which ID token claims are REQUIRED, and why each?**
`iss`, so you know which issuer asserted it and can distinguish providers; `sub`, the
locally-unique and never-reassigned subject identifier; `aud`, which must contain your
`client_id` and is what makes cross-client replay fail; `exp`, after which §2 says the token
MUST NOT be accepted for authentication; and `iat`, which lets you impose freshness stricter
than `exp` and underpins `max_age`/`auth_time` reasoning.

**★ Is `sub` a safe primary key?**
Only together with `iss`. §2 defines it as locally unique *within the issuer*, so two
providers can emit the same value for different people. It is safe in the sense that matters
most — it is specified as never reassigned, which `email` is not — but the key must be
`(iss, sub)`, and the column must hold 255 ASCII characters because §2 sets that as the
limit.

**★ What does `nonce` protect against, and how is it different from `state`?**
`nonce` binds the *ID token* to the authentication request your application initiated: you
generate it, store it against the session, send it in the authorization request, and check
that the returned ID token carries the same value. That stops an attacker injecting an ID
token obtained from a different flow. `state` binds the *callback* to the session, stopping
CSRF on the redirect endpoint. Different artefacts, different attacks — and both are only
defences if the returned value is actually compared against a server-side stored value.

**★ Can we send the ID token to our API instead of the access token?**
No. Its audience is your `client_id`, not the API, so the API would be accepting a token
addressed to someone else — and it carries no scopes, so there is nothing to authorise
against. It frequently appears to work, because a resource server that checks only signature
and issuer will accept it; that is a misconfiguration, and the fix is to require the correct
audience at the API.

**★ What is `azp` and should we validate it?**
The authorized party — the party to which the ID token was issued. OIDC Core §2 marks it
OPTIONAL and notes it only occurs when extensions beyond the specification are in use, so its
presence and meaning vary by provider. Do not require it and do not make authorization
decisions on it; validators that insist on it reject valid tokens from providers that never
emit it.

---

← [Topic index](README.md) · Next → [The authentication request](02-the-authentication-request.md)
