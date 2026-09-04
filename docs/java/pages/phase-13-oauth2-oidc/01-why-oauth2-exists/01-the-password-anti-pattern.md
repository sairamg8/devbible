---
title: "OAuth2 was not invented to log people in — it was invented because the only way to let one program use another program's data on your behalf was to hand it your password, and the specification opens by listing five separate things that go wrong when you do"
sidebar_label: "01 · The password anti-pattern"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 (*The OAuth 2.0 Authorization Framework*) —
> the Abstract, §1 (Introduction) and its five enumerated limitations, §1.1 (Roles) —
> at [datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**Every design decision in OAuth2 — the redirect, the two-legged token exchange, the scopes,
the short-lived access token, the refresh token the API never sees — is an answer to one
specific question that was genuinely hard in 2007: how does a program you do not control
read your data on a service you do control, without you giving it your password? Read the
specification's opening paragraphs and you find it does not start with tokens or flows. It
starts with a list of everything that breaks when the answer is "just give it the password".
If you can recite that list, the rest of OAuth2 stops being arbitrary.**

## The world before: the client impersonates you

The pattern RFC 6749 calls "the traditional client-server authentication model" is simple to
build and it is why it was everywhere. A photo-printing site wants your photos out of a
photo-hosting site. It asks you for your photo-host username and password. It stores them.
It then logs in *as you*, on a schedule, and pulls whatever it wants.

```java
// The anti-pattern, in the shape it actually took.
// The client stores the resource owner's credentials and replays them.
public final class PhotoHostClient {

    private final String userEmail;
    private final String userPassword;   // 🔴 the resource owner's actual password

    public List<Photo> fetchAlbums() {
        // Basic auth: the client is indistinguishable from the user, by design.
        String basic = Base64.getEncoder()
                .encodeToString((userEmail + ":" + userPassword).getBytes(UTF_8));
        return http.get("/albums", Map.of("Authorization", "Basic " + basic));
    }
}
```

The technical shape does not matter — Basic auth, a form POST, a scraped session cookie.
What matters is the property: **the client holds a credential that is indistinguishable
from the user's own.** Every failure below follows from that one property, and none of them
can be fixed without changing it.

## The five failures, verbatim from §1

RFC 6749's introduction enumerates them. They are worth quoting exactly, because each one is
a design constraint that a later part of the specification satisfies:

1. *"Third-party applications are required to store the resource owner's credentials for
   future use, typically a password in clear-text."*
2. *"Servers are required to support password authentication, despite the security
   weaknesses inherent in passwords."*
3. *"Third-party applications gain overly broad access to the resource owner's protected
   resources, leaving resource owners without any ability to restrict duration or access to
   a limited subset of resources."*
4. *"Resource owners cannot revoke access to an individual third party without revoking
   access to all third parties, and must do so by changing the third party's password."*
5. *"Compromise of any third-party application results in compromise of the end-user's
   password and all of the data protected by that password."*

## Reading each one as a requirement

**(1) Clear-text storage.** A password must be replayable to be useful, so it cannot be
hashed at rest the way a server hashes it. Every integrating third party becomes a
plaintext password store — one whose security you cannot audit and did not agree to. The
requirement this creates: *the credential the client holds must not be the user's password*.

**(2) Password authentication as a forced dependency.** If third-party access works by
replaying a password, the service can never turn passwords off. It cannot move to WebAuthn,
to a hardware key, to a passkey, to SSO, without breaking every integration. This is the
failure people forget, and it is the one that bites hardest in 2026: **an organisation that
allowed password-replay integrations cannot adopt phishing-resistant authentication.** The
requirement: *third-party access must not depend on how the user authenticates.*

**(3) No scope, no duration.** A password grants everything, forever. The print shop that
needed read access to one album could delete your account. There is no vocabulary in
"here is my password" for *less than everything*. The requirement: *the grant must be able to
say what and for how long* — this becomes `scope` and `expires_in`.

**(4) Revocation is all-or-nothing.** To cut off one integration you change your password,
which cuts off every integration and every device you own. The requirement: *grants must be
independently revocable* — this becomes per-client tokens and RFC 7009 revocation.

**(5) Blast radius.** A breach at any third party is a breach of the user's password, and
therefore of every *other* service where that password was reused. Your security became the
minimum of everyone you ever integrated with. The requirement: *a compromised client must
leak something limited, short-lived and revocable* — this becomes the access token.

Set the five side by side with what OAuth2 issues and the mapping is exact:

| §1 failure | What OAuth2 introduces to answer it |
|---|---|
| Clear-text password at the client | A token that is not the password and is useless elsewhere |
| Server locked into password auth | The AS owns authentication; the client never sees it |
| Overly broad access | `scope` |
| No duration limit | `expires_in`, short-lived access tokens |
| Cannot revoke one third party | Per-client grants, revocation (RFC 7009) |
| Compromise leaks everything forever | Limited, expiring, revocable credential |

**Nothing in that table is about logging in.** That is the point of the next chunk.

## The abstract flow, in the specification's own six steps

RFC 6749 §1.2 states the whole framework in six lettered steps. Learn them now as a skeleton;
[03 · Authorization code flow with PKCE](../03-authorization-code-pkce/README.md) fills every one of them in
with real parameters.

- **(A)** *"The client requests authorization from the resource owner … or preferably
  indirectly via the authorization server as an intermediary."*
- **(B)** *"The client receives an authorization grant, which is a credential representing
  the resource owner's authorization…"*
- **(C)** *"The client requests an access token by authenticating with the authorization
  server and presenting the authorization grant."*
- **(D)** *"The authorization server authenticates the client and validates the authorization
  grant, and if valid, issues an access token."*
- **(E)** *"The client requests the protected resource from the resource server and
  authenticates by presenting the access token."*
- **(F)** *"The resource server validates the access token, and if valid, serves the request."*

🔴 **Read step (A)'s "preferably indirectly" carefully.** The whole security value is in the
word *indirectly*: the user authenticates at the authorization server, in the authorization
server's own browser context, and the client is never in the room. A client that renders its
own username/password form for the resource owner has re-created the anti-pattern with extra
steps — and that is exactly what the resource-owner-password-credentials grant did, which is
why RFC 9700 §2.4 now says it **MUST NOT** be used.

## Gotchas

**★ "We hash the password, so storing it is fine" is not available to a client.**
A server can store a one-way hash because it only ever needs to *compare*. A client that
must *replay* the password needs the original, so it holds it reversibly — encrypted at
rest at best, which means it also holds the decryption key. Failure (1) is not sloppiness;
it is forced by the pattern.

**★ Failure (2) is the one that blocks passkeys, and it is usually discovered years late.**
Teams remove password login, the third-party integrations break, and the rollback is
attributed to "MFA broke the API". The actual cause is a years-old decision to let
integrations authenticate as the user.

**★ An API key is not a fix for failure (3) or (4) unless it is scoped and per-integration.**
A single account-wide API key with full permissions reproduces every failure except (1) and
(2). "We use API keys, not passwords" is only an improvement if the keys are per-client and
scope-limited — otherwise it is the same design with a different string.

**★ Password rotation as revocation punishes the user, not the attacker.**
Failure (4) means the only revocation lever is the one that logs out every device the user
owns. Users learn not to pull it, so compromised integrations stay live. Any design where
the safe action is expensive for the victim will not be taken.

**★ OAuth2 does not remove the need to trust the client — it bounds what trust costs.**
A malicious client with a valid `photos:read` token still reads your photos. What changed is
that it cannot change your password, cannot read your messages, and stops working when the
grant is revoked or expires. The pitch is *limited* access, which the Abstract says in as
many words, not *safe* access.

**★ Copying a session cookie is the same anti-pattern wearing a different hat.**
Scraping or forwarding the user's session cookie to a third party fails all five points
identically: it is a bearer credential for the user's whole account, unscoped, and
revocable only by ending every session.

**★ The five failures are about *authorization*, and none of them mention identity.**
Every one is about what a program may do with your data. Not one is about proving who you
are. Teams that read OAuth2 as a login protocol are answering a question §1 never asked —
see [02 · Authorization is not authentication](02-authorization-is-not-authentication.md).

## Interview questions

**★ What problem was OAuth2 designed to solve?**
Delegated authorization: letting a third-party application obtain **limited** access to an
HTTP service on a resource owner's behalf, without the resource owner giving that
application their credentials. RFC 6749's Abstract says exactly this — "obtain limited
access to an HTTP service … by orchestrating an approval interaction between the resource
owner and the HTTP service". The word doing the work is *limited*: scoped, time-bounded and
independently revocable, which a password can never be.

**★ Name the concrete failures of having a third party store the user's password.**
Five, per RFC 6749 §1: the client must hold it in clear text; the service is locked into
supporting password authentication forever; access is unavoidably total, with no way to
limit scope or duration; a single third party cannot be revoked without a password change
that revokes everyone; and a breach at any third party compromises the password and every
resource it protects — including other services where it was reused.

**★ Which of those five is the reason a company cannot roll out passkeys?**
The second. If integrations authenticate by replaying a password, removing password
authentication breaks them all. It is the least-quoted item on the list and the one with
the longest tail, because the cost lands years after the decision.

**★ We already have per-integration API keys. Why would we still adopt OAuth2?**
Ask what the key is scoped to and who consented. A per-integration API key genuinely fixes
failures (1), (4) and (5) if it is distinct per client and revocable. It does not, on its
own, give you user-level consent, per-user scoping, or expiry — the key is usually
account-wide and immortal, so any user's data is reachable by any integration the account
enabled. OAuth2's contribution over that baseline is that the **resource owner** authorises
a **specific** client for a **specific** scope for a **bounded** time, at the authorization
server, and can withdraw it alone.

**★ Does OAuth2 make it safe to integrate with an untrusted third party?**
No, and claiming so is the standard over-sell. It bounds the damage rather than preventing
it: a client with `photos:read` can still exfiltrate every photo you granted it. What you
gain is that it cannot touch anything outside the scope, the grant expires, and you can
revoke it alone without disturbing anything else. Trust is still required — it is just
priced.

**★ In one sentence, why is "the client asks the user for their password and forwards it to
the API" wrong even when the client is our own first-party mobile app?**
Because the client then holds a replayable full-account credential, which forces password
authentication to stay enabled forever, defeats per-client revocation and makes the app a
plaintext credential store — and RFC 9700 §2.4 makes it normative, saying the resource owner
password credentials grant "MUST NOT be used" precisely because it "insecurely exposes the
credentials of the resource owner to the client". First-party status changes who you are
trusting; it does not change any of the five mechanical failures.

---

← [Topic index](README.md) · Next → [Authorization ≠ authentication](02-authorization-is-not-authentication.md)
