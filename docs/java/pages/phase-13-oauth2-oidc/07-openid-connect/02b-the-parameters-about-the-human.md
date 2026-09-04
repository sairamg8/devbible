---
title: "Four of OIDC's request parameters ask a question about the human rather than about the protocol — how recently they authenticated, how strongly, whether you may skip the screen and who you think they already are — and every one of them is a request the authorization server is free to ignore"
sidebar_label: "02b · Asking about the human"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.2.1 (Authentication Request) —
> the definitions of `max_age`, `acr_values`, `prompt`, `display`, `id_token_hint` and
> `login_hint` — §2 (ID Token, on `auth_time` being REQUIRED when `max_age` is requested) and
> §3.1.3.7 rules 12 and 13, at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.
> **No sandbox** — parameter definitions quoted from the specification; the Java below is
> illustrative client code, not a captured run.

**Every parameter on this page is a question, and the authorization server answers it in the
ID token rather than in the response you were expecting. That asymmetry is the whole reason
they get implemented wrong: sending `acr_values` feels like enforcing MFA, sending `max_age`
feels like enforcing freshness, and neither does anything at all until you write the
comparison on the way back. §3.1.3.7 puts the obligation on the client twice, in rules 12 and
13, precisely because the request half is the easy half and the check half is the one people
skip.**

The second thing these parameters share is that they are the *only* place in OAuth2 or OIDC
where a client can express a policy about the human. Everything else in the request is about
routing and binding. If your product has a "re-enter your password before transferring money"
requirement, or a "corporate users must use a hardware key" requirement, this page is where
it is expressed — and the enforcement lives in your callback handler, not in the URL.

### `max_age` and `acr_values` — the two step-up levers

> `max_age`: *"OPTIONAL. Maximum Authentication Age. Specifies the allowable elapsed time in
> seconds since the last time the End-User was actively authenticated by the OP."*

Sending `max_age` has a second effect that is easy to miss: §2 makes `auth_time` REQUIRED in
the ID token *"when `max_age` is requested"*. So `max_age` is not only a request, it is also
how you guarantee the claim you need to verify it comes back at all.

> `acr_values`: *"OPTIONAL. Requested Authentication Context Class Reference values.
> Space-separated string that specifies the `acr` values that the Authorization Server is
> being requested to use."*

🔴 **Both are requests, not commands.** §3.1.3.7 rule 12 says the client *SHOULD* check the
asserted `acr` — because the AS may authenticate the user however it likes and tell you what
it did. A client that sends `acr_values=urn:example:mfa` and then assumes MFA happened has
implemented nothing. The check is the implementation.

```java
// Step-up: ask for a fresh, strong authentication, then verify you got one.
String authorizeUrl = UriComponentsBuilder.fromUriString(authorizationEndpoint)
        .queryParam("response_type", "code")
        .queryParam("client_id", clientId)
        .queryParam("redirect_uri", redirectUri)
        .queryParam("scope", "openid profile")
        .queryParam("state", state)
        .queryParam("code_challenge", codeChallenge)
        .queryParam("code_challenge_method", "S256")
        .queryParam("nonce", nonce)
        .queryParam("max_age", 300)                       // authenticated within 5 minutes
        .queryParam("acr_values", "urn:example:loa:mfa")  // ...and at this strength
        .build(true)
        .toUriString();

// ...and on the way back, both must be verified, not assumed:
Instant authTime = Instant.ofEpochSecond(idToken.getClaim("auth_time"));
if (authTime.isBefore(Instant.now().minusSeconds(300))) {
    throw new StepUpRequiredException("auth_time older than the max_age we asked for");
}
if (!"urn:example:loa:mfa".equals(idToken.getClaimAsString("acr"))) {
    throw new StepUpRequiredException("provider did not assert the requested acr");
}
```

### `prompt` — the parameter with two opposite uses

> *"OPTIONAL. Space-delimited, case-sensitive list of ASCII string values that specifies
> whether the Authorization Server prompts the End-User for reauthentication and consent."*

The defined values are `none`, `login`, `consent` and `select_account`.

- **`prompt=none`** is a *silent* request: do not show anything to the user. If the AS cannot
  satisfy the request without interaction, it returns an error rather than a screen. This is
  how a single-page application renews a session in a hidden iframe without a visible
  redirect — and why an error response from a `prompt=none` request is a normal outcome, not
  an incident.
- **`prompt=login`** is the opposite: force re-authentication even if a session exists. It is
  the crude sibling of `max_age=0`.

🔴 **`none` combines badly with the others.** The values are a space-delimited *list*, and
`none` is exclusive by nature — asking for "show nothing" and "show consent" in one request
is contradictory. Providers reject the combination, and the error surfaces long after the
code that built the string.

### `id_token_hint` and `login_hint` — two hints that are not the same kind of thing

> `id_token_hint`: *"OPTIONAL. ID Token previously issued by the Authorization Server being
> passed as a hint about the End-User's current or past authenticated session with the
> Client."*
>
> `login_hint`: *"OPTIONAL. Hint to the Authorization Server about the login identifier the
> End-User might use to log in (if necessary)."*

`id_token_hint` is a *signed* artefact the AS itself issued, so the AS can trust it — which
is why RP-initiated logout is built on it. `login_hint` is a bare string the client made up,
usually an email address typed into your own form. It is a convenience for pre-filling a
username box and **carries no authentication weight whatsoever**. Treating a `login_hint`
echo as evidence of identity is the same category of error as reading identity out of an
access token.

## `display` — the parameter you will probably never send

> *"OPTIONAL. ASCII string value that specifies how the Authorization Server displays the
> authentication and consent user interface pages to the End-User."*

The defined values are `page`, `popup`, `touch` and `wap`. It is a rendering hint, providers
are free to ignore it entirely, and `wap` dates the specification more precisely than any
other line in it. Send `popup` if you genuinely open the authorization endpoint in a popup
window and the provider documents support for it; otherwise leave it out. **Nothing about
security depends on it**, which is why it is worth naming once and then forgetting.

## Where the enforcement actually lives

The pattern is identical for all four policy parameters, and writing it once is worth more
than remembering each one:

```java
/** Everything asked for in the request, so the callback can verify it was answered. */
record AuthPolicy(Duration maxAge, String requiredAcr, Instant requestedAt) {}

void verify(AuthPolicy policy, Jwt idToken) {
    if (policy.maxAge() != null) {
        Long authTime = idToken.getClaim("auth_time");            // §2: REQUIRED when max_age sent
        if (authTime == null) {
            throw new StepUpRequiredException("auth_time absent though max_age was requested");
        }
        Instant authenticatedAt = Instant.ofEpochSecond(authTime);
        if (authenticatedAt.isBefore(policy.requestedAt().minus(policy.maxAge()))) {
            throw new StepUpRequiredException("authentication older than max_age");
        }
    }
    if (policy.requiredAcr() != null
            && !policy.requiredAcr().equals(idToken.getClaimAsString("acr"))) {  // §3.1.3.7 r12
        throw new StepUpRequiredException("provider did not assert the requested acr");
    }
}
```

🔴 **`AuthPolicy` is stored server-side against the `state` value, not encoded into the
request.** A policy the client can read back out of its own redirect URL is a policy an
attacker can rewrite before the browser follows it.

## Gotchas

**★ `acr_values` was sent and the user was not challenged.**
Symptom: step-up "works" in testing because the provider happened to prompt. Cause: the
parameter is a *request*; §3.1.3.7 rule 12 puts the obligation to check the result on the
client. Fix: compare the returned `acr` claim and fail closed — see the `StepUpRequiredException`
code above. Never branch on having *sent* the parameter.

**★ `max_age` was sent but `auth_time` is absent.**
Symptom: a `NullPointerException` or a silently-skipped freshness check. Cause: §2 makes
`auth_time` REQUIRED only when `max_age` is requested or it is asked for as an Essential
Claim — so a provider that ignores your `max_age` will also omit `auth_time`, and a client
that treats absence as "fine" has disabled its own check. Fix: absence is a failure.

```java
Long authTime = idToken.getClaim("auth_time");
if (authTime == null) {
    throw new StepUpRequiredException("auth_time absent though max_age was requested");
}
```

**★ `prompt=none` errors are logged as incidents.**
Symptom: a wall of `login_required` / `interaction_required` errors in the client's logs.
Cause: `prompt=none` asks the AS to do nothing visible; when it cannot comply without
interaction, an error *is* the specified answer. Fix: treat those two error codes as a normal
control-flow branch that triggers a visible redirect, and exclude them from error alerting.

**★ `login_hint` is trusted as identity.**
Symptom: an account is provisioned or matched from the hint value. Cause: it is a
client-supplied string with no signature and no verification anywhere in the flow. Fix: use
it only to pre-fill a form field; identity comes from `(iss, sub)` in the ID token and
nowhere else.

**★ `max_age=0` is sent to force re-authentication and the provider treats it as "no limit".**
Symptom: the user sails through without re-entering anything. Cause: `0` is a legitimate
integer and some implementations read a falsy value as "unset". Fix: use `prompt=login` when
the intent is *force a fresh authentication*, and reserve `max_age` for *this authentication
must be no older than N seconds*. They are different requests and only one of them means
"prompt".

**★ The `acr` comparison is written as `contains` rather than equality.**
Symptom: a weaker assurance level satisfies a check for a stronger one, because the provider
returns a list-like string and `"loa2".contains("loa")` is true. Cause: `acr` values are
opaque identifiers, not an ordered scale you may substring-match. Fix: compare against an
explicit allow-list of acceptable values.

```java
private static final Set<String> ACCEPTABLE_MFA_ACR =
        Set.of("urn:example:loa:mfa", "urn:example:loa:hardware-key");

if (!ACCEPTABLE_MFA_ACR.contains(idToken.getClaimAsString("acr"))) {
    throw new StepUpRequiredException("acr not in the accepted set");
}
```

**★ Step-up is implemented by sending the user through the flow again and keeping the old
session.**
Symptom: the second authentication succeeds but the privileged action still runs under
whatever the first one asserted. Cause: the new ID token's `auth_time` and `acr` were never
written back onto the session. Fix: treat the step-up callback as an update to the session's
assurance state, and read that state — not a boolean flag set before the redirect — at the
point of the privileged action.

**★ `prompt` values are joined with a comma.**
Symptom: `invalid_request` from the authorization endpoint, or the whole parameter silently
ignored. Cause: §3.1.2.1 defines `prompt` as a **space-delimited** list, like `scope`. Fix:
join with a space. The same mistake produces the same failure on `acr_values`, which is also
space-separated.

**★ A policy parameter is added to the request but the callback code is shared with a
non-policy login.**
Symptom: half the logins enforce the policy and half do not, apparently at random. Cause: one
callback handler, two kinds of request, and no record of which one this response answers.
Fix: store the `AuthPolicy` against the `state` value as above — the callback then knows what
it must verify because the request told it, not because a flag in a config file did.

## Interview questions

**★ You send `acr_values` requesting MFA and the ID token comes back. Have you enforced MFA?**
No. `acr_values` is a request; the authorization server authenticates the user however it
chooses and reports what it did in the `acr` claim. §3.1.3.7 rule 12 says the client SHOULD
check the asserted value is appropriate. Enforcement is the comparison you write after the
token arrives, and a client that only sends the parameter has enforced nothing.

**★ What is the relationship between `max_age` and `auth_time`?**
`max_age` is the request — the maximum allowable elapsed seconds since the user was actively
authenticated. `auth_time` is the answer — when that authentication happened. §2 makes
`auth_time` REQUIRED in the ID token when `max_age` is requested, so asking the question is
also how you guarantee the data needed to check it. §3.1.3.7 rule 13 puts the checking
obligation on the client.

**★ When would you use `prompt=none`, and what should the client do when it fails?**
For silent renewal — refreshing an authenticated session without a visible redirect, typically
in a hidden iframe for a browser application. When the authorization server cannot satisfy it
without interaction it returns an error such as `login_required` or `interaction_required`,
and that is the *specified* answer rather than a fault. The client's correct response is to
fall back to a visible, interactive authorization request.

**★ What is the difference between `id_token_hint` and `login_hint`?**
`id_token_hint` is an ID token the authorization server itself previously issued, so the
server can verify its own signature and treat it as trustworthy information about a session —
which is why RP-initiated logout is built on it. `login_hint` is an unsigned string the client
supplies to pre-fill a username field. One is evidence; the other is a UX convenience, and
treating the second as the first is an authentication bypass.

**★ Why does the specification put the checking obligation on the client rather than making
the authorization server refuse?**
Because the authorization server has no way to know what the client's policy actually is. The
request parameters are hints in a protocol that must work across every kind of relying party
and every kind of authentication method, so the AS reports what it did — in `acr`, `amr` and
`auth_time` — and the client decides whether that satisfies its own rules. §3.1.3.7 rules 12
and 13 encode that division: the client SHOULD check that the asserted value is appropriate,
because only the client knows what "appropriate" means.

**★ Your product needs "re-enter authentication before a payment". Which parameter, and what
does the callback do?**
Send `max_age` with a small value — the maximum acceptable age of the authentication in
seconds — optionally together with `acr_values` if the payment also requires a stronger
method. Because `max_age` is present, §2 makes `auth_time` REQUIRED in the returned ID token.
The callback reads `auth_time`, rejects anything older than the value it asked for, rejects
its absence outright, compares `acr` against an allow-list if one was requested, and writes
the resulting assurance state onto the session so that the payment endpoint reads it rather
than a flag set before the redirect.

**★ What is `amr`, and why is it weaker evidence than `acr`?**
`amr` is the Authentication Methods References claim — an array of identifiers for the methods
used, such as a password or a one-time password. It is descriptive rather than contractual:
the identifiers are not standardised across providers in the way an agreed `acr` value is, so
building policy on `amr` couples you to one provider's vocabulary. `acr` is meant to be the
level you and the provider agreed on in advance, which is why it is the one `acr_values`
requests and §3.1.3.7 rule 12 tells you to check.

**★ A provider ignores every policy parameter you send. What can you actually do?**
Detect it and fail closed rather than degrade silently. If `auth_time` does not come back
when you asked for `max_age`, or `acr` does not match anything in your accepted set, the
correct behaviour is to refuse the privileged operation and say why — not to proceed on the
assumption that the provider "probably" did the right thing. Beyond that the fix is
contractual rather than technical: the assurance you can enforce is bounded by what the
identity provider is willing to assert.

---

← [The authentication request](02-the-authentication-request.md) · [Topic index](README.md) · Next → **Validating an ID token** *(not written yet)*
