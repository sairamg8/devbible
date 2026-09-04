---
title: "The most damaging misuse of this grant is a background job that reads one customer's data with a service token, because it is not a bug that anything catches — the call succeeds, the audit log is silent about who authorised it, and the answer is that nobody did"
sidebar_label: "03 · When there is a user after all"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 §1.3.4, §4.4, §4.4.3, §3.3 (Access Token Scope) and
> §6 (Refreshing an Access Token); RFC 8693 (*OAuth 2.0 Token Exchange*); RFC 9700 §2.1.2 and
> §2.4; and the Spring Security 7.x reference (OAuth2 Client) — at
> [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc8693) and
> [docs.spring.io/spring-security/reference](https://docs.spring.io/spring-security/reference/).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**A service token is easy to get and works everywhere, which is exactly why it ends up
carrying calls it has no authority for. Nothing fails. The resource server sees a valid
token with a sufficient scope and serves the data; the audit log records a client id; and the
question "who authorised reading this person's records" has no answer anywhere in the
system. This chunk is about recognising that shape and the three legitimate ways out of it.**

## The shape of the misuse

```java
// 🔴 The call succeeds. Nothing logs a warning. Nobody consented.
@Scheduled(cron = "0 0 2 * * *")
void nightlyExport() {
    for (String customerId : customerRepository.allIds()) {
        // Service token: scope orders:read, sub = orders-service, no user anywhere.
        var orders = inventoryClient.get()
                .uri("/customers/{id}/orders", customerId)
                .retrieve().body(OrderList.class);
        export(orders);
    }
}
```

Everything here is technically conformant OAuth2 and it violates RFC 6749 §1.3.4, which
permits this grant *"when the authorization scope is limited to the protected resources
under the control of the client"*. A specific customer's orders are not under the control of
`orders-service`. The token asserts an authority nobody granted.

The practical consequences, in the order they usually surface:

1. **No consent record.** If a customer asks what accessed their data and under what
   authority, the answer is a scheduled job and a client id.
2. **No per-user scoping.** The token that reads one customer can read every customer, so a
   loop bug or an injected id is a full data export.
3. **A useless audit trail.** Every row says `orders-service`. Which user's data, on whose
   authority, at whose request — none of it is recorded because none of it was checked.
4. **A resource server that must trust the caller completely.** It cannot check whether this
   customer authorised this, so it either serves everything or grows a bespoke allow-list.

## Is it always wrong? No — and the distinction is worth stating precisely

The question is **whose authority the operation runs under**, not whether a user's data is
touched.

| Situation | Authority | Correct mechanism |
|---|---|---|
| Nightly aggregate over all customers, for the business | The organisation's | ✅ Client credentials, scoped to an organisation-level resource |
| Fraud scan across all accounts, mandated by policy | The organisation's | ✅ Client credentials, and say so in the scope name |
| Retry a payment a user initiated an hour ago | 🔴 **The user's** | Token obtained on their behalf |
| Sync a user's calendar while they are offline | 🔴 **The user's** | Offline access — a refresh token from a user flow |
| Service B doing work for a request Service A received from a user | 🔴 **The user's** | Relay, or exchange (RFC 8693) |

🔴 **The tell is whether the operation would be wrong if the user objected.** If a customer
could reasonably say "I did not authorise that", the operation runs on their authority and
needs a credential that records it. If it is something the business does regardless — billing
runs, fraud checks, regulatory reporting — it is organisational, and a service token with an
honestly-named scope is right.

Name those scopes accordingly. `orders:read` is ambiguous; `orders:read:all-tenants` is a
sentence that makes a reviewer stop.

## Way out 1 — offline access from a real user flow

If the job genuinely acts for a user who is not present, the authority must have been granted
by that user at some point. That is what a refresh token is for: the user completes an
authorization-code flow once, consents to offline access, and the client stores the refresh
token and uses it later.

Note the difference from client credentials — here the refresh token is not only permitted
but is the entire mechanism, precisely because there *is* an absent resource owner whose
consent it stands in for. The details of rotation, reuse detection and storage are
[05 · The three tokens](../05-the-three-tokens/README.md).

The cost is honest: you are storing a long-lived, per-user credential, which is a meaningful
security responsibility. Encrypt it, scope it narrowly, and handle revocation — the user can
withdraw consent at the authorization server and your job must cope with that rather than
alerting every night.

## Way out 2 — relay the user's token

When the user *is* present, further down a call chain, the simplest correct answer is to
carry their token onward: service A receives a user token and presents it to service B.

The catch is `aud`. A token minted for service A is not automatically valid at service B,
and a system where one token is accepted everywhere is the **internal god-token**
anti-pattern — one leak is total access, and no resource server can meaningfully restrict
anything. **12 · Token relay across microservices** *(not written yet)* is the full
treatment.

## Way out 3 — token exchange, RFC 8693

The rigorous answer. Service A presents the user's token to the authorization server and
receives a **new** token: same user, narrower scope, audience restricted to service B. The
user's authority is preserved and recorded; the blast radius is not.

```java
// RFC 8693 in shape: A exchanges the user's token for one audience-scoped to B.
// grant_type       = urn:ietf:params:oauth:grant-type:token-exchange
// subject_token    = <the user's access token that arrived at A>
// audience         = https://service-b.internal
// scope            = orders:read
// The result carries the USER as sub, with an audience B will actually accept.
```

This preserves the property that matters: the resulting token still says *which user*, so
the audit trail at service B names a person, and its `aud` means a leak at B does not open
service C. The cost is an authorization-server round trip per exchange, which is why it is
worth caching per (user, target) and why teams reach for relay first.

## Choosing

1. **Is the authority the organisation's?** → client credentials, honestly-scoped.
2. **Is the user present in the call chain?** → exchange (RFC 8693) if you can, relay with a
   correct `aud` if you cannot.
3. **Is the user absent but did consent earlier?** → offline access with a stored refresh
   token.
4. **Is the user absent and never consented?** → 🔴 **stop.** There is no mechanism for this
   because there is no authority for it. That is a product question, not an engineering one.

## Gotchas

**★ Nothing in the system flags this misuse.**
The call succeeds, the token is valid, the scope is sufficient. It is found in a security
review or a data-protection audit, not by a test. Look for it deliberately.

**★ A scope name that hides the blast radius is part of the problem.**
`orders:read` on a service token reads *everyone's* orders. Name it so a reviewer sees it —
`orders:read:all-tenants` — and the design conversation happens before production.

**★ "The user is not around, so we used the service account" is the exact sentence to
challenge.** The user's absence does not remove the need for their authority; it changes how
that authority must have been recorded. Either they consented earlier, or the operation is
not theirs.

**★ Relaying a token to a service it was not issued for usually fails audience
validation — and where it succeeds, that is worse.** A system where every token works
everywhere has no audience separation at all, so one leaked token opens everything.

**★ Token exchange costs a round trip per exchange.**
Cache the exchanged token per (subject, target audience) for its lifetime, or a chatty call
graph multiplies authorization-server load by the fan-out.

**★ A stored refresh token is a long-lived per-user credential in your database.**
Encrypt it, keep the scope minimal, and handle the day a user revokes consent — a job that
alerts every night because one user withdrew is a job that will be muted.

**★ Client credentials cannot impersonate a user, and providers that let it are dangerous.**
Some allow a service account to request tokens "as" a user. If yours does, treat it as a
privileged administrative capability with its own audit trail, not as a convenience.

**★ Mixing both in one client registration muddles the audit trail.**
If the same client does user-authorised work and organisational work, tokens for both look
similar at the resource server. Separate registrations, separate scopes.

## Interview questions

**★ A nightly job reads every customer's orders with a client-credentials token. Is that
wrong?** It depends on whose authority the job runs under, and the test is whether the
operation would be improper if the customer objected. If it is business processing the
organisation performs regardless — billing, fraud screening, regulatory reporting — a service
token is correct, and the scope should be named so that its reach is obvious. If it is work
being done *for* a particular customer, the token asserts an authority nobody granted: RFC
6749 §1.3.4 limits this grant to resources under the client's own control, there is no
consent record, and the audit trail names a service instead of a person.

**★ How do you carry a user's authority into a background job?**
The user must have granted it at some point. The mechanism is offline access: they complete
an authorization-code flow, consent explicitly, and the client stores the resulting refresh
token and redeems it later. Unlike client credentials — where §4.4.3 forbids a refresh token
because no resource owner was ever present — here the refresh token is the whole point,
standing in for the absent resource owner's earlier consent. The obligation you accept is a
long-lived per-user credential in your store: encrypt it, scope it narrowly, and handle
revocation gracefully.

**★ What is token exchange and when do you reach for it?**
RFC 8693. A service presents a token it received to the authorization server and receives a
new one — same subject, narrower scope, audience restricted to the next service. You reach
for it when a user's request fans out across services and you want each downstream token to
be usable only where it is going. It preserves the user in `sub`, so audit trails downstream
name a person, while keeping the blast radius of any single leak to one service. The cost is
an AS round trip, so cache per subject and target audience.

**★ Why not just forward the user's original token to every service?**
Because then one token is valid everywhere, which is the internal god-token anti-pattern: a
leak anywhere is total access, and no resource server can restrict anything meaningfully
since it must accept a token minted for someone else. Correctly, `aud` should stop a token
for service A being accepted at service B — and if forwarding works across your whole estate,
that tells you audience validation is not configured anywhere.

**★ The user is absent and never consented, but the business wants the feature. What do you
do?** Say that there is no OAuth2 mechanism for it, because there is no authority to
represent. The choices are to obtain consent — add an offline-access step to the user flow —
or to establish that the operation is organisational and can be justified on that basis, in
which case it should be scoped and named as such. Reaching for a service token because it
happens to work is manufacturing an authority that does not exist, and it is a data-protection
problem before it is a security one.

**★ How would you spot this misuse in a code review?**
Look for a client-credentials-authenticated call whose path or body names a specific user or
tenant. A service token calling `/customers/{id}/…` is the signature. Then ask which scope
authorises it and whether that scope's name reveals that it spans every customer — a
scheduled job plus a per-customer path plus a machine token is the shape, and it is invisible
at runtime because everything succeeds.

---

← [Why not just an API key](02-why-not-just-an-api-key.md) · [Topic index](README.md) · Next topic → [05 · The three tokens](../05-the-three-tokens/README.md)
