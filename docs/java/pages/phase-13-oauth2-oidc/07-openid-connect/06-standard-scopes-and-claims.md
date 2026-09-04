---
title: "The four standard scopes beyond openid are bundles of claims, and the two facts that matter about them are that a scope is a request rather than a guarantee and that where the claims come back — ID token or UserInfo — is the provider's choice, not yours"
sidebar_label: "06 · Standard scopes and claims"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.2.1 (`scope` is REQUIRED and must
> contain `openid`) and §2 (the ID Token claim table), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> OpenID Connect Discovery 1.0 §3 (`scopes_supported`, `claims_supported`), at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> RFC 6749 §3.3 (Access Token Scope)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.
>
> 🔴 **Provenance limit, stated rather than papered over.** OIDC Core **§5.1 (Standard
> Claims)** and **§5.4 (Requesting Claims using Scope Values)** — the sections that define
> which claims each scope requests — **could not be read in this pass**: the published HTML of
> Core 1.0 truncates before §5, and two fetch attempts returned nothing for those sections.
> The scope→claim groupings below are therefore presented as **the widely-implemented
> mapping, to be confirmed against your own provider's `claims_supported`**, not as quoted
> specification text. Everything on this page that *is* quoted comes from §2, §3.1.2.1 and
> Discovery §3, which were read. See `research_java_p13_t07_oidc.md` in the memory store.

**A scope in OIDC does two different jobs and conflating them is the source of most of the
confusion. `openid` is a *switch* — §3.1.2.1 requires it, and it turns an authorization
request into an authentication request. `profile`, `email`, `address` and `phone` are
*bundles* — each is shorthand for a group of claims about the end user. And in both cases the
scope is a **request**: RFC 6749 §3.3 lets the authorization server issue a different scope
than the one asked for, so what you receive is what the response says, never what you sent.**

The second fact is the one that produces support tickets. **Where a claim arrives is the
provider's choice.** The same `email` scope may put `email` and `email_verified` into the ID
token at one provider and leave them exclusively at the UserInfo endpoint at another. A
client that reads them straight out of the ID token works perfectly against the first
provider and returns nulls against the second, with no error anywhere.

## The standard scopes

`openid` is mandatory. The other four are the standard claim bundles:

| Scope | Requests, in practice | Notes |
|---|---|---|
| `openid` | *(none — it is the switch)* | 🔴 REQUIRED. Without it §3.1.2.1 says the behaviour is "entirely unspecified" |
| `profile` | the general profile claims — name, given/family name, preferred username, picture, locale, `updated_at` and similar | The largest bundle; also the one providers most often trim |
| `email` | `email` and `email_verified` | Two claims, and the second is the one that matters |
| `address` | a single structured `address` claim | Rarely populated outside providers built for it |
| `phone` | `phone_number` and `phone_number_verified` | Same shape as `email` |

⚠️ **Treat that middle column as the common implementation rather than as a quotation.** The
authoritative per-provider answer is the `claims_supported` member of the discovery document,
which is exactly the reason it exists — see
[05b · The metadata document](05b-the-metadata-document.md).

```java
// Ask the provider what it will actually give you, instead of assuming.
Set<String> supported = Set.copyOf(metadata.getClaimsSupported());
if (!supported.contains("email_verified")) {
    log.warn("provider {} does not advertise email_verified — treat email as unproven",
            metadata.getIssuer());
}
```

## `email_verified` is the claim, not `email`

The single most consequential claim in this whole group is `email_verified`, and it is
routinely ignored. An `email` claim on its own means *the provider holds this string for this
user*. It does not mean anybody proved they control that mailbox — and at providers that
allow self-service email changes without verification, an attacker can set their own account's
email to a victim's address.

If you match accounts by email — and
**08 · `sub` is not an email** *(not written yet)* argues you should not — then an unverified
email is an account takeover:

```java
Boolean verified = idToken.getClaim("email_verified");
String email = idToken.getClaimAsString("email");

// Never link, provision or match on an unverified address.
if (!Boolean.TRUE.equals(verified)) {
    throw new OAuth2AuthenticationException("email present but not verified");
}
```

🔴 **`Boolean.TRUE.equals(...)` rather than a truthiness test**, because the claim can be
absent (null) or, at some providers, the *string* `"true"` rather than a JSON boolean. Both of
those are falsy in the way you want, and a naive `if (verified)` on a boxed `Boolean` throws
on null.

## Scope is a request, and the response tells you what happened

RFC 6749 §3.3 is explicit that the authorization server may grant a scope other than the one
requested, and that when it does, the token response includes a `scope` parameter describing
what was actually granted. The consequence for OIDC is direct: a user can decline consent for
`email` on the provider's consent screen, the flow still succeeds, and your ID token simply
has no `email` claim.

```java
// What you asked for is not evidence of anything. What came back is.
Set<String> granted = Set.of(tokenResponse.getScope().split(" "));
boolean canShowEmail = granted.contains("email");
```

This is the same rule as [05 · The three tokens](../05-the-three-tokens/README.md)'s "read
scope from the response, not from the token", applied to identity claims rather than to
permissions.

## Claims are a snapshot, and the snapshot is of issue time

Every claim in an ID token was true when the token was minted and is asserted about no later
moment. A user who changes their display name a second afterwards has an ID token that is
simultaneously valid and stale. That is not a defect; it is what a signed assertion is.

The consequences are practical:

- **Do not treat the ID token as a user profile store.** Copy what you need into your own
  record at login, keyed on `(iss, sub)`, and refresh it deliberately.
- **Do not re-read claims from a token you cached an hour ago** and present them as current.
- **If freshness matters, call UserInfo** — that is what
  **07 · The UserInfo endpoint** *(not written yet)* is for.

## Gotchas

**★ `email` is read from the ID token and is null at a new provider.**
Symptom: a login integration that works against one identity provider returns null emails
against another, with no error. Cause: where a claim is delivered — ID token or UserInfo — is
the provider's choice. Fix: read the claim from the ID token *if present*, and fall back to
UserInfo; never assume placement.

**★ `email_verified` is ignored.**
Symptom: account takeover by anyone who can set their email address at a provider you trust.
Cause: `email` was treated as proof of mailbox control. Fix: require
`Boolean.TRUE.equals(emailVerified)` before the address is used for matching, linking or
notification — and prefer `(iss, sub)` for identity entirely.

**★ `email_verified` arrives as the string `"true"`.**
Symptom: a `ClassCastException`, or a check that silently never passes. Cause: a provider
serialising a boolean as a JSON string. Fix: normalise, and log once when you have to:

```java
Object raw = claims.get("email_verified");
boolean verified = raw instanceof Boolean b ? b
        : raw instanceof String str && "true".equalsIgnoreCase(str);
```

**★ Scopes are requested that the provider does not know.**
Symptom: `invalid_scope` at the authorization endpoint, before any user interaction. Cause:
scope vocabulary beyond `openid` and the four standard bundles is per-provider. Fix: check
`scopes_supported` in the discovery document, and remember it describes the provider's
capability rather than your client's grant.

**★ The granted scope is assumed to equal the requested scope.**
Symptom: a UI element that assumes a claim is present, and an NPE for the subset of users who
declined that consent. Cause: RFC 6749 §3.3 lets the AS grant less than was asked for. Fix:
branch on the `scope` value in the token response.

**★ `profile` is requested reflexively and pulls in more personal data than the product uses.**
Symptom: a consent screen listing claims your application never reads, and a data-protection
review that asks why you hold them. Cause: copying a tutorial's scope list. Fix: request the
narrowest bundle that covers what you actually store — for many applications `openid` alone,
with a display name fetched from UserInfo when needed.

**★ Claims are cached with the session and shown as current a week later.**
Symptom: a stale display name or avatar that only updates when the user logs out and back in.
Cause: an ID token treated as a profile source. Fix: persist what you need at login against
`(iss, sub)` and refresh on a schedule or on demand — the token is an assertion about issue
time, not a subscription.

**★ A missing claim is treated as an authentication failure.**
Symptom: users who declined an optional consent cannot log in at all. Cause: a validator that
requires `email` or `name`. Fix: the five REQUIRED claims from §2 — `iss`, `sub`, `aud`,
`exp`, `iat` — are the only ones you may demand; everything else is optional by construction
and your application must degrade rather than refuse.

**★ `claims_supported` is treated as a promise for every user.**
Symptom: a claim advertised by the provider is absent for some individuals. Cause: the member
describes what the provider *may* supply; whether a particular user has a value, and whether
they consented to share it, are separate questions. Fix: null-tolerant reads for every claim
outside §2's REQUIRED five.

**★ Scope values are joined with a comma.**
Symptom: the whole scope string treated as one unknown scope, and an `invalid_scope` error.
Cause: `scope` is **space-delimited**, like `prompt` and `acr_values`. Fix: join with a space.
Spring's YAML `scope: openid,profile,email` is a *list* in YAML syntax and is converted to a
space-delimited string for you — which is why that one comma-looking form is correct and a
hand-built URL with commas is not.

## Interview questions

**★ What does the `openid` scope do that the other scopes do not?**
It is not a claim bundle at all — it is the switch that makes the request an OIDC
authentication request. §3.1.2.1 marks `scope` REQUIRED and says OIDC requests MUST contain
`openid`, and without it "the behavior is entirely unspecified". `profile`, `email`, `address`
and `phone` are shorthand for groups of claims about the user; `openid` is what causes an
`id_token` to exist at all.

**★ You request `email` and the ID token has no `email` claim. Name three explanations.**
The provider delivers that claim only from the UserInfo endpoint rather than in the ID token;
the user declined that consent, so the granted scope in the token response is narrower than
what you requested; or the user has no email value at that provider. All three are normal, and
none of them is an error condition — which is why the correct client behaviour is to read the
`scope` from the token response, fall back to UserInfo, and degrade rather than refuse.

**★ Why is `email_verified` more important than `email`?**
Because `email` only asserts that the provider holds that string for the user, not that
anyone proved control of the mailbox. At providers that allow an email address to be changed
without verification, an attacker can point their own account at a victim's address; if your
application matches accounts by email, that is a takeover. `email_verified` is the claim that
distinguishes a proven address from a typed one, and the safest position is to key identity on
`(iss, sub)` and treat email as a display and contact attribute.

**★ How do you find out which claims a provider will actually give you?**
Read `claims_supported` from its discovery document, and treat it as a possibility list rather
than a guarantee — a claim being advertised does not mean every user has a value for it or has
consented to release it. The specification's scope definitions tell you what a scope *means*;
the provider's metadata tells you what this provider implements; the token response tells you
what was actually granted for this login.

**★ A product manager asks for the user's phone number to appear in the profile page. What is
the sequence of checks before you promise it?**
Confirm `phone` is in the provider's `scopes_supported` and `phone_number` in its
`claims_supported`; confirm your client registration is permitted to request that scope;
confirm whether the claim is delivered in the ID token or only from UserInfo; and confirm the
data-protection position on storing it. Then implement it as optional, because the granted
scope may still come back without `phone` for any individual user who declines.

**★ Why should a client not treat the ID token as a user profile?**
Because it is a signed assertion about a moment, not a view of current state. Nothing updates
it when the user changes their name, email or group membership, and its claims are frozen at
issue time. The correct pattern is to copy what you need into your own record keyed on
`(iss, sub)` at login, and to refresh from UserInfo or your own source when freshness matters
— which also stops the ID token from becoming a long-lived store of personal data.

---

← [The metadata document](05b-the-metadata-document.md) · [Topic index](README.md) · Next → **The UserInfo endpoint** *(not written yet)*
