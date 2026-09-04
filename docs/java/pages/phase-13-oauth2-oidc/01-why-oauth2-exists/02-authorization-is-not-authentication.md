---
title: "OAuth2 answers 'may this program do this thing', never 'who is this person' — and the decade the industry spent building logins on top of a protocol that deliberately refuses to say who you are is the single most expensive misreading in web security"
sidebar_label: "02 · Authorization ≠ authentication"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 §1 (Introduction), §1.1 (Roles), §1.8
> (Interoperability) and the Abstract
> ([datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749));
> RFC 6750 §1 (Bearer tokens); and OpenID Connect Core 1.0 §2 (ID Token) at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Read RFC 6749 end to end and you will not find a way for a client to learn who the user
is. Not an omission — a deliberate refusal. The specification issues a credential that says
"the bearer of this may do X"; it never issues one that says "the bearer of this is Alice".
Everything that went wrong with OAuth2-as-login in the 2010s, and every "Sign in with…"
vulnerability disclosure from that era, is the same bug: treating a statement about
permission as a statement about identity.**

## Two different questions

| | Authentication | Authorization |
|---|---|---|
| The question | *Who is this?* | *May this operation proceed?* |
| The subject | A person or a workload | An operation on a resource |
| The output | An identity, and evidence for it | A yes/no, or a bounded permission |
| OAuth2's answer | ⛔ **out of scope** | ✅ the entire specification |
| Where it lives here | OpenID Connect, on top | RFC 6749 + RFC 6750 |

RFC 6749's Abstract is precise about which one it does: it "enables a third-party
application to **obtain limited access to an HTTP service**". Access. Not identity. And §1.1
names the four roles — resource owner, client, authorization server, resource server — with
the resource owner defined as *"an entity capable of granting access to a protected
resource"*. It is defined by what it can **grant**, not by who it **is**.

## The thing that made this confusing: the AS logs the user in

Here is the honest source of the confusion, and it is not stupidity. To decide whether to
issue a grant, the authorization server **must** authenticate the resource owner — you
cannot ask "does Alice consent?" without establishing Alice. So an authentication event
absolutely happens, in the middle of an OAuth2 flow, at the authorization server.

🔴 **The event happens; the result is not communicated to the client.** The client receives
an access token. Per RFC 6750 that token is a **bearer** credential: whoever holds it may
use it. It says nothing about who obtained it, and by design the client is not supposed to
be able to read it at all. The authentication happened in a room the client was not in, and
nobody wrote down what was said.

## Three ways teams tried to bolt identity on, and how each fails

### Attempt 1 — "the token came back, so the user logged in"

```java
// 🔴 WRONG. The presence of a token proves nothing about *which* user.
if (tokenResponse.accessToken() != null) {
    login(userWhoStartedTheFlow);          // an assumption, not a fact
}
```

The client started a flow for a user it *believes* is Alice and got a token back. But an
access token is a bearer token; an attacker who obtains one for their own account and
injects it into a victim's session gets the victim's client to conclude "Alice logged in".
This is the **token substitution** class of attack, and it is why the industry needed an
audience-bound, signed, client-verified assertion instead — the ID token.

### Attempt 2 — "call the provider's `/me` endpoint with the token"

```java
// 🟠 Better, and still not authentication in the general case.
var profile = restClient.get().uri("/me")
        .headers(h -> h.setBearerAuth(accessToken))
        .retrieve().body(Profile.class);
login(profile.id());
```

This is the pattern nearly every pre-OIDC "Sign in with X" used, and it is where the
**confused deputy** problem lives. The endpoint answers "whose data does this token reach?"
which is *usually* the same as "who authorised it" — but the token was not issued **for
you**. It carries no audience restriction naming your application, so a token minted for a
completely different client, obtained by any means, produces a perfectly valid `/me`
response and logs an attacker in as its owner. The provider-specific fixes of that era
amounted to reinventing audience validation one vendor at a time, which is precisely what
RFC 6749 §1.8 predicted when it warned that a framework "with many optional components …
is likely to produce a wide range of non-interoperable implementations."

### Attempt 3 — "the access token is a JWT, so decode it and read `sub`"

```java
// 🔴 WRONG on two counts at once.
var claims = decodeWithoutVerifying(accessToken);   // no signature check
login(claims.get("sub"));                            // parsing a token not meant for you
```

Two independent errors. The signature check is missing, which is its own catastrophe. And
even with a perfect signature check the client has **no contract** entitling it to parse an
access token at all: that the token happens to be a JWT is an implementation choice of the
authorization server, which may switch to opaque tokens or change the claim set at any time
without a breaking-change announcement, because to the client the token is defined as
opaque. That argument gets its full treatment in **05 · The three tokens** *(being
written)*.

## The fix: a token that is *about* the user and *for* you

OpenID Connect adds exactly one thing to OAuth2 and it is the thing that was missing — an
**ID token**: a JWT, signed by the provider, whose `aud` claim names *your* client, whose
`sub` identifies the user, whose `iss` names the issuer, and whose `nonce` binds it to the
request your application started. Each of those four claims kills one of the attacks above:

| Claim | The attack it closes |
|---|---|
| Signature | Forged or altered assertion |
| `aud` = your `client_id` | Token minted for another client, replayed at yours |
| `iss` | Assertion from an unexpected issuer |
| `nonce` | Token from a different, attacker-initiated flow |
| `exp` / `iat` | An old assertion replayed later |

That is the whole of "OIDC is an authentication layer on top of OAuth2" — the layer is a
signed, audience-bound assertion and the rules for checking it. The mechanics belong to
**07 · OpenID Connect** *(not written yet)*; what matters in this chunk is *why the layer
had to exist at all*.

## The two-sentence version worth memorising

**OAuth2 gives a client a credential that lets it act on resources. OIDC gives a client a
credential that tells it who authorised that.** If your requirement contains the word
"login", "session", "who is the user" or "sign in", the answer includes OIDC. If it contains
"may this call proceed", plain OAuth2 is enough.

## Gotchas

**★ "We use OAuth2 for login" is, read literally, a description of a vulnerability.**
It is usually shorthand for "we use OIDC", and that is fine — but ask which token the
application makes its login decision on. If the answer is the access token, or a `/me` call,
the shorthand is hiding the real design and you have found a finding.

**★ The presence of an access token proves an authorization happened, not whose.**
Bearer semantics (RFC 6750 §1) are the whole point: possession is sufficient to use it. A
credential whose security model is "whoever holds it may use it" cannot double as proof of
who obtained it.

**★ `/userinfo` is not a substitute for validating an ID token.**
It tells you whose data the token reaches. It does not tell you the token was issued **to
your client**, which is the property that stops cross-client replay. Audience binding is a
property of the assertion, and it cannot be recovered by asking a question afterwards.

**★ Never make an authentication decision on an unvalidated `sub`.**
`sub` is only meaningful after signature, `iss`, `aud` and `exp` all check out. An
unvalidated `sub` is a string an attacker chose.

**★ `sub` is unique per issuer, and per client when the provider uses pairwise subjects.**
It is not an email address, not a username, and not stable across identity providers. A
`users` table keyed on `sub` alone breaks the day you add a second provider; key on
`(iss, sub)`. The `email` claim is worse — it is mutable and, unless `email_verified` is
true, unproven.

**★ The authorization server authenticating the user is not the client authenticating the
user.** Both statements are true simultaneously and people collapse them. The AS knows who
it is talking to; the client only knows what the AS chose to assert to it.

**★ Scopes are not identity and not roles.**
A scope records what the client was authorised to request. It is not a claim about who the
user is, and it is not the user's permissions inside your application. Two-thirds of
authorization bugs in Spring services start by conflating these — **10 · Method security**
*(not written yet)* takes the argument apart.

**★ An access token that reaches your login code is a design smell even when it works.**
If deleting the access token from the login path breaks the login, identity is being derived
from a permission credential. That is the whole bug class, restated.

**★ OAuth2's extensibility is why "we implemented OAuth2" says almost nothing.**
RFC 6749 §1.8 admits the framework "on its own … is likely to produce a wide range of
non-interoperable implementations" and expects profiles to fix it. So ask which profile:
OIDC? RFC 9068 JWT access tokens? RFC 9700's BCP? "OAuth2" alone is not a compatibility or
a security claim.

## Interview questions

**★ What is the difference between authentication and authorization, and which one is
OAuth2?** Authentication establishes who a party is; authorization decides whether a
specific operation may proceed. OAuth2 is an **authorization** framework — RFC 6749's
Abstract says its purpose is to let a third-party application "obtain limited access to an
HTTP service". It defines no way to convey the user's identity to the client. That gap is
what OpenID Connect fills, with the ID token.

**★ An authentication event clearly happens during an authorization code flow. Why do we
still say OAuth2 is not authentication?** Because of *where* it happens and *to whom* it is
reported. The authorization server must authenticate the resource owner to know whose
consent it is recording, but the artefact handed back to the client is an access token — a
bearer credential describing permitted access, with no assertion about the subject and no
binding to the requesting client. The event occurs; the result is never communicated. OIDC
adds the missing communication.

**★ A colleague logs users in by calling the provider's `/me` endpoint with the access token
and trusting the returned id. What is wrong, concretely?** The access token carries no
audience restriction naming this application, so any valid token for that provider produces
a valid `/me` response — including one minted for a different client, or obtained from a
malicious app the victim also used. The application then logs the attacker in as the token's
owner. It is the confused-deputy problem: the app treats "this token reaches Bob's data" as
"Bob is at my door". The fix is an ID token whose `aud` is this client's `client_id`,
signature-verified, with `iss`, `exp` and `nonce` checked.

**★ Why should a client not parse the access token even when it is a JWT and the signature
verifies?** Because the client has no contract entitling it to. In OAuth2 the access token's
format is a private matter between the authorization server and the resource server; a
client that parses it has coupled itself to a format the AS may change without notice — and
several providers have. The ID token is the one the client is *specified* to read.

**★ Which specific claims in an ID token make it usable for authentication when an access
token is not?** The signature (it is an assertion by a named issuer, not an opaque
permission), `iss` (which issuer said it), `aud` (it was issued **to this client**, closing
cross-client replay), `sub` (the identifier, meaningful only within that issuer), `nonce`
(binds it to the flow this application started, closing injection of a token from another
flow), and `exp`/`iat` (it is current, closing replay of an old assertion).

**★ Is `sub` a good primary key for your `users` table?** Only in combination with `iss`.
`sub` is unique within an issuer and may be pairwise — different per client for the same
human — so it is not portable across providers and can differ between two of your own
applications at the same provider. Key on `(iss, sub)`, and keep your own internal user id
as the thing your domain refers to, so a provider migration is a mapping change rather than
a rewrite.

**★ When is plain OAuth2, without OIDC, the correct and complete answer?** When no human
identity is involved or needed by the caller: service-to-service calls under the client
credentials grant, background jobs, and any API where the decision is purely "does this
caller hold the required scope". The moment a requirement mentions logging a person in,
establishing a session, or displaying whose account this is, you need an authentication
layer, and OIDC is the standard one.

**★ Your reviewer says "OAuth2 is not authentication" about a service that only validates
JWT access tokens and never logs anyone in. Are they right?** Not usefully. The slogan is
about clients deriving *user identity* from authorization artefacts. A resource server that
checks a token's signature, issuer, audience and scopes to authorise a call is doing exactly
what OAuth2 is for. The distinction to hold onto is that the resource server is establishing
*permission*, and if it also needs to attribute the action to a user it should say so
explicitly — reading `sub` from a validated token for audit is fine, treating that as a
login session is not.

---

← [The password anti-pattern](01-the-password-anti-pattern.md) · [Topic index](README.md) · Next → [What came before](03-what-came-before.md)
