---
title: "The subject identifier is the only claim OIDC promises is never reassigned, which makes it the only safe primary key for a federated user — and the reason teams key on email anyway is that sub is ugly, opaque and different at every provider, all of which are the properties that make it correct"
sidebar_label: "08 · `sub` is not an email"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §2 (ID Token) — the `sub` definition
> *"Subject Identifier. A locally unique and never reassigned identifier within the Issuer for
> the End-User"* and *"It MUST NOT exceed 255 ASCII characters in length"* — and §3.1.3.7
> rules 2–3, at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> OpenID Connect Discovery 1.0 §3 (`subject_types_supported`, whose defined values are
> `public` and `pairwise`), at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.
>
> ⚠️ **Provenance limit.** OIDC Core **§8 (Subject Identifier Types)** and **§8.1 (Pairwise
> Identifier Algorithm)** could not be read in this pass — the published HTML truncates before
> §5 and two fetch attempts returned nothing for those sections. What this page says about
> `public` versus `pairwise` is grounded in Discovery §3's `subject_types_supported` member
> and in §2's `sub` definition, both of which *were* read; the mechanics of §8.1's derivation
> algorithm are deliberately **not** described here rather than reconstructed. Banked quotes:
> `research_java_p13_t07_oidc.md` in the memory store.

**Two words in §2 do all the work. `sub` is *"locally unique"* — within the issuer, which
means it is meaningless on its own and your key is `(iss, sub)` — and *"never reassigned"*,
which is a promise no other claim in the token makes. An email address is reassigned all the
time: a corporate mailbox is recycled to a new employee, a personal address is released by a
provider and re-registered, a user changes theirs. A username is changed. A phone number is
recycled by the carrier. `sub` is the only identifier OIDC undertakes will still mean the same
person in five years, and building a `users` table on anything else is a decision to have an
account-takeover incident later.**

The reason this argument has to be made at all is that `sub` is unpleasant to work with. It is
opaque, it is often a UUID or a longer base64-ish string, it is different at every provider
for the same human, and it cannot be typed into a support tool. Every one of those complaints
is a description of the property that makes it safe. Email is convenient precisely because it
is a *global, human-meaningful, mutable* name — and those three adjectives are exactly what
you do not want in a primary key.

## The rule

```java
// The identity key. Both halves, always.
record FederatedIdentity(String issuer, String subject) {
    FederatedIdentity {
        Objects.requireNonNull(issuer);
        Objects.requireNonNull(subject);
        if (subject.length() > 255) {                       // §2's own limit
            throw new IllegalArgumentException("sub exceeds 255 characters");
        }
    }
}
```

```sql
-- One row per (provider, subject). Email is an attribute, never the key.
CREATE TABLE federated_identity (
    issuer       VARCHAR(255)  NOT NULL,
    subject      VARCHAR(255)  NOT NULL,   -- §2: MUST NOT exceed 255 ASCII characters
    user_id      BIGINT        NOT NULL REFERENCES app_user(id),
    email        VARCHAR(320),             -- attribute; may be null, may change
    email_verified BOOLEAN     NOT NULL DEFAULT FALSE,
    linked_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (issuer, subject)
);
```

Three things in that schema are load-bearing:

1. **`PRIMARY KEY (issuer, subject)`** — not `subject` alone. §2 says *locally* unique, so two
   providers may legitimately issue the same `sub` string for two different people.
2. **`VARCHAR(255)`** for `subject`, because §2 sets that as the maximum. A column sized to
   the UUID your first provider emitted is a truncation bug waiting for the second provider.
3. **A separate `app_user`** with the federated identity as a satellite. That indirection is
   what makes account linking possible at all — one human, several identities.

## Why email fails, concretely

**Corporate mailbox recycling.** `alice@corp.example` leaves; eighteen months later a new Alice
joins and IT reissues the address. If your key is email, the new employee inherits the old
one's account, history and permissions — silently, on first login, with every check passing.

**Self-service email change at the provider.** At providers that let a user set an email
address without proving control of it, an attacker sets theirs to a victim's address and logs
into your application as the victim. This is why
[06 · Standard scopes and claims](06-standard-scopes-and-claims.md) insists on
`email_verified`, and why even a verified address is a weaker key than `sub`.

**The same human at two providers.** Alice signs in with the corporate IdP on Monday and with
a consumer provider on Tuesday, both carrying `alice@corp.example`. Keying on email silently
merges two authentication sources of different assurance into one account. Keying on
`(iss, sub)` keeps them distinct until somebody deliberately links them.

**Users without an email at all.** Phone-first providers, machine users, and any provider
where the user declined the `email` consent. A schema that requires email to identify a user
cannot represent them.

## Account linking: the deliberate version

The legitimate need behind "key on email" is real — one human, several logins, one account.
The safe pattern is to make linking an **authenticated action by the user**, never an
inference by your code:

```java
// WRONG: an inference. Any provider that asserts an address takes over the account.
// var user = users.findByEmail(idToken.getClaimAsString("email"));

// RIGHT: look up the identity; if unknown, this is a new identity, not a known user.
Optional<User> existing = identities.find(new FederatedIdentity(iss, sub));
if (existing.isPresent()) {
    return existing.get();
}
// A new identity. Either provision a new account, or ask the already-signed-in user
// whether they want to attach this login to the account they are currently using.
return pendingLinks.offerLink(new FederatedIdentity(iss, sub), currentSessionUser());
```

The one narrow case where automatic linking is defensible is **a single trusted issuer you
operate, with `email_verified` true**, and even then it is a policy decision worth writing
down rather than a default. Automatic linking across issuers you do not control is an
account-takeover primitive.

## `public` versus `pairwise` subject identifiers

Discovery's `subject_types_supported` member advertises which kinds of `sub` a provider can
issue, and its defined values are `public` and `pairwise`.

- **`public`** — every client that authenticates the same user sees the same `sub`. Simple, and
  it means two colluding relying parties can determine that they are looking at the same
  person.
- **`pairwise`** — the provider derives a *different* `sub` per client (or per group of
  clients), specifically so that relying parties cannot correlate users across applications.

🔴 **The consequence you must design for: under `pairwise`, `sub` is not portable.** If your
application is registered twice — say a web client and a mobile client with separate
`client_id` values — a pairwise provider may hand each a different `sub` for the same human,
and your two front ends will create two accounts. The remedies are provider-side (registering
the clients under a shared sector so they receive the same identifier) and they must be set up
before launch, because migrating identities afterwards means asking users to re-link.

Check the provider's advertised value rather than assuming:

```java
List<String> subjectTypes = metadata.getSubjectTypes();     // e.g. ["public"] or ["pairwise"]
if (subjectTypes.contains("pairwise")) {
    log.info("issuer {} may issue per-client subs — confirm the sector configuration "
            + "before registering a second client", metadata.getIssuer());
}
```

⚠️ The precise derivation algorithm is OIDC Core §8.1, which this page does not describe
because it could not be read in this pass. What matters at the client is the *property* —
per-client identifiers — not the derivation, which is entirely the provider's concern.

## Gotchas

**★ The `users` table is keyed on `sub` alone.**
Symptom: nothing, until a second identity provider is added and two different people collide
on one row. Cause: §2 defines `sub` as unique *within the issuer*. Fix: the key is
`(iss, sub)`; add the issuer column before you add the second provider, not after.

**★ `sub` is stored in a column too small for it.**
Symptom: a truncated identifier, and a user who cannot log in again — or worse, two users
whose identifiers truncate to the same value. Cause: sizing the column from the first
provider's UUID. Fix: `VARCHAR(255)`, which is §2's stated maximum.

**★ Accounts are matched on `email` because "it is the same person".**
Symptom: account takeover after a corporate mailbox is recycled, or via a provider that
allows unverified email changes. Cause: email is mutable and reassignable; `sub` is
specified not to be. Fix: key on `(iss, sub)` and make linking an explicit, authenticated
user action.

**★ Automatic linking is enabled "just for our own IdP" and later extended to a social
provider.**
Symptom: a takeover path introduced by a configuration change nobody reviewed as a security
change. Cause: an auto-link policy expressed as a global switch rather than per issuer. Fix:
make it explicitly per-issuer, and require `email_verified` even there.

**★ `sub` is displayed to users or used in URLs.**
Symptom: an opaque provider identifier leaking into support tickets, analytics and shared
links — and, under a public subject type, a cross-application correlation handle you did not
mean to publish. Fix: keep `sub` internal; mint your own surrogate id for anything a human or
another system sees.

**★ Two client registrations against a pairwise provider produce two accounts for one person.**
Symptom: web and mobile users of the same product cannot see each other's data. Cause:
pairwise subject identifiers are per-client by design. Fix: register the clients so the
provider treats them as one sector, and do it before launch — retrofitting means asking every
affected user to re-link.

**★ A provider changes its issuer URL and every account becomes unreachable.**
Symptom: every user appears new after a provider migration or a hostname change. Cause: the
issuer is half the key, and it changed. Fix: treat an issuer change as a migration with a
mapping step, and prefer a stable issuer identifier that survives infrastructure moves — which
is also what Discovery §4.3 is asking of the provider.

**★ `sub` is compared case-insensitively, or trimmed, or normalised.**
Symptom: two identifiers that differ only by case are treated as one user. Cause: applying
email habits to an opaque string. Fix: `sub` is an opaque token; compare it byte for byte and
store it exactly as received.

**★ The application "upgrades" a user by matching a legacy password account to a federated
login on email.**
Symptom: a migration script that silently attaches federated logins to legacy accounts,
including ones an attacker can claim. Cause: a bulk version of the email-matching mistake.
Fix: migrate by having each user sign in with their existing credential and *then* link the
federated identity, so the link is proven rather than inferred.

**★ `sub` is trusted from an ID token that was never audience-checked.**
Symptom: the identity key is correct and the account is still wrong. Cause: `(iss, sub)` is
only meaningful if the token asserting it was actually for you — §3.1.3.7 rule 3. Fix: the
audience check is a precondition of this whole page; see
[03 · Validating an ID token](03-validating-an-id-token.md).

## Interview questions

**★ Why is `sub` the right primary key for a federated user and `email` the wrong one?**
Because §2 defines `sub` as *never reassigned* within the issuer, and no other claim carries
that promise. Email addresses are recycled by corporate IT, released and re-registered by
consumer providers, and changed by users; each of those is an account-takeover path if email
is the key. `sub` is opaque, ugly and provider-specific, which are complaints about
ergonomics rather than about correctness — and they are the same properties that make it safe.

**★ Why is `sub` alone not enough?**
Because §2 says it is *locally* unique — within the issuer. Two providers can legitimately
issue the same `sub` string for two different people, so the key must be `(iss, sub)`. This is
the same reason §3.1.3.7 rule 2 requires an exact issuer match: the issuer is not decoration
around the identity, it is half of it.

**★ How would you implement "sign in with Google or with our corporate IdP, same account"?**
With an `app_user` table and a separate `federated_identity` table keyed on `(issuer, subject)`
pointing at it, so one user can own several identities. Linking is an explicit action taken by
an already-authenticated user — sign in with one, then choose to attach the other — never an
inference from a matching email. The only case where automatic linking is defensible is a
single issuer you operate with `email_verified` true, and even that should be a written policy
rather than a default.

**★ What is a pairwise subject identifier and what does it break?**
A `sub` the provider derives per client, so that two relying parties cannot correlate the same
user across applications. It breaks the assumption that one human has one `sub` at one
provider: if your product has two client registrations — a web client and a mobile client, say
— a pairwise provider may hand each a different identifier and your system will create two
accounts. The fix is provider-side configuration that puts both clients in the same sector, and
it has to happen before users exist.

**★ A user changes their email address at the identity provider. What should change in your
database?**
The `email` attribute on their federated identity row, and nothing else. The key is
`(iss, sub)`, which did not change, so the account, its history and its permissions are
untouched — that is the entire benefit of not keying on email. If your application also uses
the address for notifications or login hints, update those; if it uses it to *find* the user,
that is the bug this page exists to prevent.

**★ Is `sub` sensitive data?**
It is a pseudonymous identifier, so treat it as personal data even though it is not directly
identifying. Under a public subject type it is a stable cross-application correlation handle,
which is exactly what pairwise identifiers exist to prevent — so leaking it into URLs, logs
shared with third parties, or analytics payloads gives away more than it appears to. Keep it
internal and expose your own surrogate identifier instead.

**★ Your provider migrates from `https://old-idp.example.com` to `https://idp.example.com`.
What happens to your users?**
Every one of them appears to be a new user, because the issuer is half the key and it changed.
This is a planned migration, not something to absorb silently: build a mapping from old issuer
to new for the same `sub` values, apply it in a controlled step, and verify that the `sub`
values themselves survived the migration at the provider — which they may not have, in which
case the only honest path is a user-driven re-link.

---

← [The UserInfo endpoint](07-the-userinfo-endpoint.md) · [Topic index](README.md) · Next → **Response types and response modes** *(not written yet)*
