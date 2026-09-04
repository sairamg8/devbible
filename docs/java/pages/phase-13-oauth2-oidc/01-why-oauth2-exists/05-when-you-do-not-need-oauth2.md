---
title: "The most common OAuth2 mistake is not misconfiguring it — it is adopting it for a system that has no third party, no delegation and no external clients, and then carrying an authorization server's operational cost forever to solve a problem a session cookie already solved"
sidebar_label: "05 · When you don't need it"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against RFC 6749 — the Abstract, §1 (Introduction), §1.1 (Roles),
> §4.4 (Client Credentials Grant) — RFC 9700 §2.4 (password grant), and the Spring Security
> 7.x reference (servlet authentication, session management), at
> [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc6749) and
> [docs.spring.io/spring-security/reference](https://docs.spring.io/spring-security/reference/).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**OAuth2 exists to let a party you do not control act on a resource owner's behalf. Remove
the third party and you have removed the problem, and what is left is a lot of machinery
with nothing to do: an authorization server to run or rent, tokens to mint and expire and
rotate, a redirect dance, discovery documents, JWKS caching, clock-skew tuning — all of it
in service of a delegation that is not happening. This chunk is the counterweight to the
rest of the phase. Knowing when the answer is "a session cookie" is as much a part of
knowing OAuth2 as knowing the flow.**

## The question that decides it

**Is there a third party?** Concretely: is there a piece of software, controlled by someone
other than you, that needs to act on a user's behalf against your API?

- **Yes** → OAuth2 (with OIDC if the third party also needs to know who the user is).
- **No** → almost certainly not, and you should have a specific reason before adopting it.

Everything below is that question, asked about particular architectures.

## Case 1 — the first-party server-rendered application

A Spring MVC or Thymeleaf application, one deployable, users log in with a form, the browser
holds a session cookie. No API consumed by anyone else.

**A session is correct here, and it is not a compromise.** A server-side session is a
reference token with a perfect revocation story: the state lives in your store, so logging
someone out is a delete. That is strictly *better* than a self-contained JWT, which cannot
be un-issued — the honest weakness covered by **06 · JWT anatomy and validation** *(being
written)*.

```java
// A first-party app. No AS, no tokens, no redirect dance.
@Bean
SecurityFilterChain app(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(a -> a
            .requestMatchers("/", "/login", "/css/**").permitAll()
            .anyRequest().authenticated())
        .formLogin(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionFixation().changeSessionId())
        .build();
}
```

The full argument, including the BFF pattern for when a SPA is added later, is
**13 · Sessions vs tokens, honestly** *(not written yet)*.

## Case 2 — two internal services, no user in the picture

Service A calls service B. There is no resource owner. Nobody delegates anything.

The OAuth2-shaped answer is the **client credentials grant** (RFC 6749 §4.4), and it is a
legitimate one: it gives you central credential issuance, rotation, revocation and an audit
trail. But note what it is not — §4.4 involves no resource owner at all, so none of the five
failures from [01 · The password anti-pattern](01-the-password-anti-pattern.md) are what you
are solving. You are solving *credential management*, and there are cheaper answers:

| Option | Good when | Cost |
|---|---|---|
| mTLS | You have a mesh or a CA already | Certificate lifecycle |
| Client credentials (§4.4) | You already run an AS for user-facing flows | AS dependency on every call path |
| A scoped, rotated API key in a secret manager | Small, stable service count | Rotation discipline is manual |

🔴 **The failure to avoid is adopting an authorization server *solely* for
service-to-service calls.** You have introduced a runtime dependency into every call path,
including one at startup if you use `issuer-uri`, to replace a secret you were already
managing. If you run an AS anyway, §4.4 is nearly free and worth taking. If you do not, mTLS
is usually the better buy — **14 · mTLS and workload identity** *(not written yet)*.

## Case 3 — a public API with per-developer keys

Developers register, get a key, call your API as *themselves*. There is no end user whose
data is being reached on their behalf.

**A scoped API key is a fine design**, and OAuth2 adds little: there is no consent to
capture because the developer is the resource owner and the client at once. Adopt OAuth2
here when — and only when — the answer changes to "developers call the API on behalf of *our
users*". That is delegation, and delegation is the trigger.

## Case 4 — a machine-to-machine call inside one trust boundary, behind a mesh

If a service mesh already terminates mTLS and enforces workload identity, per-call OAuth2
tokens may be duplicating an authorization decision at a second layer. Sometimes that is
deliberate defence in depth; often it is two half-configured layers where each team assumes
the other one is enforcing.

## Where OAuth2 genuinely is the answer

Symmetrically, do not talk yourself out of it when the trigger is present:

- **A third-party integration** — the original case, and there is no substitute.
- **A public API where third-party apps act on your users' behalf.**
- **A mobile or SPA client** that must not embed a long-lived secret and must not see the
  user's password. RFC 9700 §2.4's MUST NOT closes the shortcut of collecting it.
- **SSO across several of your own applications.** Even with no external party, one login
  and one session boundary across five applications is exactly what an authorization server
  is for.
- **A regulated audit requirement** for who consented to what, when, and to which client.
- **You already run an authorization server.** The marginal cost of using it is low and the
  consistency is worth having.

## The costs you are signing up for

Name these before adopting, because they are permanent:

1. **An authorization server to run or rent** — upgrades, backups, availability, and its
   own on-call.
2. **A hard availability dependency.** If token issuance is down, nobody logs in. If you use
   `issuer-uri`, resource servers may also need it reachable at startup.
3. **Key rotation and JWKS caching**, with a real failure mode when the cache is cold at the
   wrong moment.
4. **Clock discipline** across every host, or `exp`/`nbf` failures that look random.
5. **Redirect-URI registration** as a release-time chore, per environment, per branch
   deploy, per preview URL.
6. **A token-expiry story in every client**, including the refresh race when several
   requests notice expiry at once.
7. **A logout story that actually works**, which self-contained tokens make genuinely hard.
8. **Debuggability.** A failed request is now failing somewhere across three parties.

None of these is an argument against OAuth2 where delegation is real. All of them are
arguments against adopting it because it is what serious systems are assumed to use.

## Gotchas

**★ "We are microservices, so we need OAuth2" does not follow.**
Service count is not delegation. What internal calls need is workload identity and
authorization, which mTLS or client credentials both provide. The user-facing edge may well
need OAuth2 — that is a different decision about a different boundary.

**★ Adopting OAuth2 to avoid sessions usually recreates sessions, worse.**
Teams replace the session cookie with a JWT, discover they cannot log anyone out, and add a
server-side denylist checked on every request. That is a session store with extra
cryptography and a worse revocation latency.

**★ A first-party mobile app is still a public client.**
"It is our own app" does not let it keep a secret or collect the user's password — RFC 9700
§2.4 is normative and does not carve out first parties. Authorization code with PKCE is the
answer, exactly as for a third party.

**★ Running an authorization server is an operational commitment, not a dependency
addition.** Keycloak is a stateful, upgrade-sensitive service in the critical path of every
login. Budget for it or rent it — **11 · Running vs buying the AS** *(not written yet)*.

**★ Client credentials on the user's call path silently makes the AS a hard dependency of
every request.** Cache the token for its lifetime and handle issuance failure explicitly,
or an AS blip becomes a full outage of a service that has no users involved at all.

**★ "We will add OAuth2 later" is much cheaper if the seam exists now.**
Keep authentication behind an interface and out of business logic, and never key domain
tables on a provider `sub`. Retrofitting is mostly untangling those two.

**★ Two authorization layers with no owner is worse than one.**
If the mesh authorizes and the application also authorizes, write down which one is
authoritative for which decision. Otherwise both get loosened over time by teams who assume
the other is strict.

**★ OAuth2 does not give you authorization *rules*.**
It tells you a caller holds `orders:write`. Whether *this* user may modify *that* order is
your domain logic and always was. Expecting scopes to express row-level permissions ends in
a scope explosion — **10 · Method security** *(not written yet)*.

## Interview questions

**★ When would you deliberately not use OAuth2?**
When there is no third party. A single first-party server-rendered application with form
login and a server-side session has no delegation to model, and a session gives better
revocation than a self-contained token. Internal service-to-service calls with no user
involved are an authorization problem, not a delegation one, and mTLS or a scoped, rotated
credential often serves better than standing up an authorization server. And a developer-key
public API where the developer *is* the resource owner has no consent to capture.

**★ What does adopting OAuth2 actually cost?**
An authorization server to run or rent, with its own availability and upgrade burden; a hard
dependency of login — and possibly of resource-server startup — on that server; key rotation
and JWKS caching; clock discipline across hosts; redirect-URI registration per environment;
token-expiry and refresh handling in every client, including the concurrent-refresh race; a
logout story that self-contained tokens make hard; and debugging that now spans three
parties.

**★ Our internal services call each other with an API key in a header. Is that wrong?**
Not inherently. There is no resource owner and no delegation, so OAuth2's core problem is
absent. Ask instead about rotation, blast radius and audit: is the key per-caller or shared,
can it be rotated without downtime, is it scoped to the endpoints that caller needs, and is
its use attributable. If those answers are weak, the fix might be client credentials (RFC
6749 §4.4) if you already run an AS, or mTLS if you have a mesh — chosen on credential
management, not because "microservices need OAuth2".

**★ A team wants to replace session cookies with JWTs in a first-party monolith to be
"stateless". What is your response?** Ask how logout works, and how a compromised token is
revoked before it expires. A self-contained token cannot be un-issued, so the usual answer
is a server-side denylist checked on every request — which is a session store with extra
steps and worse revocation latency. Statelessness is a real benefit when it removes a shared
store from a horizontally scaled fleet, but a monolith with one session store is not paying
that cost. If the real driver is a coming SPA or mobile client, that is a genuine reason —
and the BFF pattern keeps the cookie at the edge while using tokens inward.

**★ We have five internal applications and want one login. No third parties. OAuth2?**
Yes — this is the case where no external party is involved and OAuth2 is still right. SSO is
delegation between your own applications: each application is a client, the shared login
lives at the authorization server, and OIDC gives each application a signed, audience-bound
assertion of who logged in. The alternative, a shared session cookie across five
applications, ties them to one domain and one session store and gets steadily worse.

**★ What is the single question that decides whether you need OAuth2?**
Whether software you do not control needs to act on a user's behalf against your resources.
If yes, OAuth2, and OIDC too if that software also needs the user's identity. If no, you may
still choose it for SSO, for audit, or because you already run an authorization server — but
you should be able to name which of those it is, because you are taking on the operational
cost either way.

---

← [A framework, not a protocol](04-a-framework-not-a-protocol.md) · [Topic index](README.md) · Next topic → [02 · The four roles](../02-the-four-roles/README.md)
