---
title: "OAuth 2.0 and OIDC — the flows you can implement"
sidebar_label: "06 · OAuth 2.0 / OIDC"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:crypto` for the PKCE primitives.

**OAuth 2.0 is delegated authorization; OIDC is authentication layered on top.**
"Sign in with Google" is OIDC. "Let this app post to your calendar" is OAuth. Conflating
them is the source of most of the confusion, and of at least one real vulnerability class.

## The distinction that matters

OAuth 2.0 answers *may this application act on the user's behalf?* It issues an **access
token** for an API. It says nothing reliable about who the user is.

OIDC adds an **ID token** — a JWT with `sub`, `iss`, `aud`, `exp` — that is specifically
about identity, and specifically for you.

**Using an access token as proof of identity is the bug.** An access token is bearer
credential for an API; it is not addressed to you, and a token obtained by a different
application for a different purpose may still be accepted if you only call
`/userinfo` with it. That is the classic *confused deputy*. If you want to know who the
user is, validate an **ID token** whose `aud` is your client id.

## Authorization Code with PKCE — the only flow to use

Everything else is either deprecated or for a narrow machine case.

```
1. App  → browser redirect to the provider's /authorize
             ?response_type=code
             &client_id=...
             &redirect_uri=https://app.example.com/callback
             &scope=openid email profile
             &state=<random, tied to session>
             &code_challenge=<S256 of verifier>
             &code_challenge_method=S256

2. User authenticates at the provider

3. Provider → redirect back with ?code=...&state=...

4. App (server side) → POST /token with code + code_verifier + client_secret

5. Provider → { access_token, id_token, refresh_token }
```

The two random values do different jobs, and both are mandatory:

```js
import {randomBytes, createHash} from 'node:crypto';

const state = randomBytes(32).toString('base64url');          // CSRF defence
const verifier = randomBytes(32).toString('base64url');       // PKCE secret
const challenge = createHash('sha256').update(verifier).digest('base64url');
```

**`state`** is CSRF protection for the callback. Store it against the user's session and
compare on return. Without it, an attacker can feed you *their* authorization code and
link their provider account to the victim's session
([page 11](./11-csrf.md) is the same mechanism in general form).

**PKCE** binds the code to whoever started the flow. An intercepted `code` is useless
without the `verifier`, which never left your server. Originally for mobile apps;
now recommended for **all** clients, confidential ones included.

Validate on return, in this order:

```js
if (!timingSafeEqualStr(returnedState, session.oauthState)) throw new Error('bad state');
// exchange code + verifier server-side, never in the browser
const {id_token} = await exchange(code, session.pkceVerifier);
const claims = await verifyIdToken(id_token, {
  algorithms: ['RS256'],                        // pinned — page 02
  issuer: 'https://accounts.google.com',
  audience: process.env.OAUTH_CLIENT_ID,        // must be YOUR client id
  nonce: session.nonce,
});
```

Then — and this is the step people skip — **mint your own session**
([page 05](./05-session-management.md)). The provider's tokens authenticate the user
*to the provider*. Your application should issue its own session and stop depending on
the provider for every request.

## Flows not to use

| Flow | Status |
|---|---|
| **Authorization Code + PKCE** | The answer, for web apps, SPAs and mobile |
| Client Credentials | Correct — but for machine-to-machine only, no user involved |
| Implicit (`response_type=token`) | **Deprecated.** Tokens in the URL fragment land in history and referrers |
| Resource Owner Password Credentials | **Deprecated.** The app handles the user's password, defeating the point |
| Device Code | For input-constrained devices — TVs, CLIs |

If a tutorial hands you an access token in a URL fragment, it predates current guidance.

## Redirect URI validation is the provider's job — and yours

Register **exact** redirect URIs. Wildcards and prefix matches are how codes get
delivered to attacker-controlled paths:

```
https://app.example.com/callback              ← exact, correct
https://app.example.com/*                     ← an open redirect away from disaster
```

Any open redirect on your domain becomes a token-stealing bug in the presence of a loose
redirect URI ([page 15](./15-deserialization-redirects-mass-assignment.md)).

## Scopes, refresh tokens, and what to store

**Request the narrowest scopes that do the job**, and request them when they are needed
rather than all at signup — a consent screen asking for everything is both a security
smell and a conversion problem.

**Refresh tokens are long-lived credentials.** Encrypt them at rest, never send them to
the browser, and support rotation — a provider that reissues on each use lets you detect
replay when an old one is presented.

Store the provider's `sub` as the account link, **not the email**. Emails change and can
be reassigned; `sub` is stable per provider. Store `iss` alongside it — `sub` is only
unique within an issuer, so `(iss, sub)` is the real key.

## When to use a provider at all

**Take OIDC when** users expect "sign in with…", when you would rather not store
passwords at all ([page 01](./01-password-storage.md)), or when an enterprise customer
requires SSO.

**The cost:** an availability dependency on someone else's login page, a consent screen
between your user and your product, and account-recovery paths you do not control. Most
products end up supporting both, which means you own password storage *and* the OIDC
integration.

**Do not implement the provider side** unless being an identity provider is your
product. Use a maintained library for the client side too — the flow is easy to describe
and full of details (clock skew, `nonce`, key rotation via JWKS, `at_hash`) that a
library already handles.

## Gotchas

**Symptom:** Users can link their provider account to someone else's login
**Cause:** `state` not generated, stored, or compared.
**Fix:** Random `state` bound to the session, verified on callback.

**Symptom:** An intercepted authorization code is redeemed by an attacker
**Cause:** No PKCE.
**Fix:** `code_challenge` / `code_verifier` with `S256`, on every client type.

**Symptom:** Anyone with any Google token can log in as anyone
**Cause:** An access token used as proof of identity, `aud` unchecked.
**Fix:** Validate the **ID token**, with `audience` set to your client id and a pinned
algorithm.

**Symptom:** Accounts collide or get hijacked after a user changes email
**Cause:** Linking on email rather than `(iss, sub)`.
**Fix:** Key on issuer plus subject; treat email as mutable profile data.

**Symptom:** Tokens appear in browser history and referrer headers
**Cause:** Implicit flow.
**Fix:** Authorization Code with PKCE; exchange server-side.

**Symptom:** Login breaks intermittently with signature errors
**Cause:** The provider rotated signing keys and the JWKS cache is stale.
**Fix:** Refetch JWKS on unknown `kid`, with caching and a rate limit.

**Symptom:** Everything works until the user's provider session ends
**Cause:** Depending on provider tokens per request instead of your own session.
**Fix:** Mint your own session after the first successful authentication.

## Interview questions

**★ What is the difference between OAuth 2.0 and OIDC?**
OAuth 2.0 is delegated authorization — it issues an access token so an application can
act on a user's behalf against an API. OIDC layers authentication on top, adding an ID
token that makes verifiable claims about who the user is, addressed to your client via
`aud`. OAuth alone does not tell you who someone is.

**★ Why can't you use an access token to identify a user?**
It is a bearer credential for an API, not an assertion addressed to you. A token issued
to a different application can still be presented to `/userinfo`, so accepting it as
proof of identity is a confused-deputy bug. Validate an ID token with `aud` equal to your
client id.

**★ What does PKCE protect against, and why is `state` still needed?**
PKCE binds the authorization code to the client that started the flow, so an intercepted
code cannot be redeemed without the verifier. `state` is CSRF protection for the callback
itself — it stops an attacker feeding you their code to link accounts. Different attacks;
you need both.

**★ Why is the implicit flow deprecated?**
It returns tokens in the URL fragment, so they land in browser history, referrer headers
and any logging in between, with no client authentication at the exchange. Authorization
Code with PKCE gives the same capability without exposing the token to the browser's URL.

**What should you store to link a provider account?**
`(iss, sub)` — subject is only unique within an issuer, and email is mutable and can be
reassigned. Treat email as profile data, not identity.

**After OIDC login, do you keep using the provider's tokens?**
No. Mint your own session so your application controls expiry, rotation and revocation
([page 05](./05-session-management.md)) rather than depending on the provider on every
request.

---

← Prev: [Session management](./05-session-management.md) · Next → [MFA and TOTP](./07-mfa-totp.md)
