---
title: "The confidential/public split is the one classification in OAuth2 that changes what you are allowed to do, and it turns on a single question that has nothing to do with how important or first-party your application is — can the code keep a secret from the person running it"
sidebar_label: "02 · Confidential vs public"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §2.1 (Client Types) and its three client profiles,
> §2.2 (Client Identifier), §2.3 (Client Authentication), §2.3.1 (Client Password); and
> RFC 9700 §2.1.1 (PKCE), at
> [datatracker.ietf.org/doc/html/rfc6749](https://datatracker.ietf.org/doc/html/rfc6749).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**RFC 6749 §2.1 splits every client in the world into two categories on one criterion, and
it is not sensitivity, ownership, platform or importance. It is whether the client can
maintain the confidentiality of its credentials *from the resource owner running it*. Get
this classification wrong and everything downstream is wrong: which grant you may use,
whether you may hold a client secret, whether you get a refresh token, and whether PKCE is a
MUST or a RECOMMENDED. It is the highest-consequence sentence in the whole specification and
it is one sentence long.**

## The two definitions

RFC 6749 §2.1:

- **Confidential** — clients *"capable of maintaining the confidentiality of their
  credentials"*, e.g. by running on a secure server with restricted access, or by using
  other secure client authentication methods.
- **Public** — clients *"incapable of maintaining the confidentiality of their
  credentials"*, such as clients executing on the device used by the resource owner.

🔴 **The adversary in that sentence is the resource owner.** Not a network attacker, not a
malicious third party — *the user of the application*. If the user can extract the
credential, the client is public, and no amount of obfuscation changes it. Anybody can open
DevTools; anybody can unzip an APK; anybody can `strings` a binary.

## The three profiles, verbatim in substance

§2.1 goes on to give three profiles, and they map onto everything you will build:

| Profile | Type | §2.1's reasoning |
|---|---|---|
| **Web application** | **Confidential** | Runs on a web server; credentials stay on the server and are not exposed to the resource owner |
| **User-agent-based application** | **Public** | Executes in the browser, where *"protocol data and credentials are easily accessible"* to the resource owner |
| **Native application** | **Public** | Installed on the device, where *"protocol data and credentials are accessible to the resource owner"* — though dynamically issued credentials get better protection than statically embedded ones |

Note the concession in the native row: §2.1 acknowledges that a token *issued at runtime* is
better protected than a secret *shipped in the binary*, which is precisely why the
authorization code flow with PKCE works for mobile even though the client is public.

## The decision, as a question you can actually answer

> **Does the credential live somewhere the user cannot reach?**

- On a server you operate, in a config file or secret manager → **confidential**.
- In JavaScript delivered to a browser → **public**. Always. Including a server-rendered
  page that inlines it.
- In an installed binary, mobile or desktop → **public**. Including code-signed apps.
- In a mobile app's backend that the app calls → the **backend** is confidential; the app is
  still public. These are two clients, and it is fine to have both.
- In a CI job's environment variables → **confidential**, if the CI system's secret store is
  sound and logs are not.
- In a Kubernetes `Secret` mounted into a pod → **confidential**, with the caveat that a
  base64-encoded `Secret` readable by anyone with namespace access is only as confidential
  as your RBAC.

## What actually changes

This is the payoff table. Everything in it follows from the one sentence:

| | Confidential | Public |
|---|---|---|
| May hold a `client_secret` | ✅ | ⛔ never — shipping one is publishing it |
| Authenticates at the token endpoint | ✅ required | ⛔ cannot meaningfully |
| Client credentials grant (RFC 6749 §4.4) | ✅ | ⛔ — it *is* client authentication |
| PKCE | **RECOMMENDED** (RFC 9700 §2.1.1) | **MUST** (§2.1.1) |
| Refresh tokens | ✅ typical | ⚠️ only with rotation and reuse detection |
| Redirect URI registration | SHOULD | **MUST** (§3.1.2.2) |
| AS may rely on its identity | ✅ | ⛔ §2.3: servers "MUST NOT rely on public client authentication for the purpose of identifying the client" |

🔴 **That last row is the deepest consequence and the least discussed.** For a public client
the authorization server *cannot know* which application is really talking to it. Anyone can
send a request with your `client_id` — it is not a secret (§2.2) and it is in every
authorization URL. This is why the redirect URI must be pre-registered and exact-matched,
and why PKCE is mandatory: with no client identity to rely on, the AS falls back to
constraining *where the response may go* and *proving the same party finished the flow*.

## Reading §2.3 carefully

§2.3 says a public client **MAY** establish a client authentication method — and then that
authorization servers *"MUST NOT rely on public client authentication for the purpose of
identifying the client"*. Both at once, and it is not a contradiction: a public client may
present something, and it may even be useful for rate limiting, telemetry or blocking a
known-bad build. It is simply not a **security** claim. Any design sentence beginning "only
our app can, because it has the secret" is false for a public client.

§2.3.1 adds the concrete mechanism for confidential clients with a password: HTTP Basic, and
authorization servers *"MUST support the HTTP Basic authentication scheme"* for clients
issued a password. That is `client_secret_basic` — the default in most Spring
configurations. The stronger alternatives are in
[03 · Client authentication](03-client-authentication.md).

## The mistakes this classification catches

**"It's our own first-party mobile app, so it's confidential."** Ownership is not the
criterion. The user still holds the binary. It is public.

**"We obfuscate the secret in the app."** Obfuscation raises effort, not capability. Public.

**"The secret is in the SPA's environment variables at build time."** Build-time environment
variables are inlined into the bundle by every bundler. It ships to the browser. Public.

**"It's a desktop app behind our VPN."** Where it runs does not change who can read its
disk. Public.

**"We fetch the secret from our server at startup so it isn't in the binary."** Now the
secret is in memory on a device the user controls, fetched by an unauthenticated call
anyone can replay. Public — and you have added a secret-distribution endpoint to attack.

**"It's a confidential client because it uses HTTPS."** Transport security protects the
channel, not the endpoint. The user is the adversary here, and TLS does not defend against
someone reading their own device.

## The BFF: turning a public client into a confidential one

The one legitimate way to *become* confidential is to move the client. A Backend-for-Frontend
puts a server you control between the browser and the authorization server: the browser
holds a cookie to your BFF, the BFF is a confidential client holding the secret and the
tokens, and no token ever reaches JavaScript.

```java
// The BFF is the client. The browser gets a session cookie, never a token.
@Bean
SecurityFilterChain bff(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(a -> a
            .requestMatchers("/assets/**").permitAll()
            .anyRequest().authenticated())
        .oauth2Login(Customizer.withDefaults())   // this server is a confidential client
        .build();
}
```

This is a real architectural change, not a relabelling — the trade-offs (an extra hop, a
session store, CSRF back in scope) belong to **13 · Sessions vs tokens, honestly**
*(not written yet)*. What matters here is that it is the *only* honest route from public to
confidential.

## Gotchas

**★ The adversary in §2.1 is the user, not the network.**
Every wrong classification comes from imagining a remote attacker. Ask instead: can the
person running this software read the credential? DevTools, an unzipped APK and `strings`
all say yes for anything on their device.

**★ First-party does not mean confidential.**
Ownership, code signing, app-store distribution and internal-only deployment change nothing
about who holds the binary.

**★ A `client_secret` in a public client is a published secret from day one.**
It is in every installation of the app. Rotating it means shipping a release, which means
the old one stays valid for months while users update.

**★ `client_id` is public by design and is not authentication.**
§2.2 says it "is not a secret" and "MUST NOT be used alone for client authentication". It
appears in the authorization URL of every flow.

**★ For a public client the AS genuinely cannot tell who is calling.**
§2.3 forbids relying on public client authentication to identify the client. Anyone can
claim your `client_id`. The compensating controls are exact redirect-URI matching and PKCE,
not the identifier.

**★ Public clients may be given a secret anyway, and it means less than it looks.**
Some providers issue one and some libraries send it. It can be legitimate for rate limiting
or blocking a bad build. It is never a security boundary — do not write a control that
depends on it.

**★ PKCE is a MUST for public and RECOMMENDED for confidential — quote the right one.**
RFC 9700 §2.1.1: "Public clients MUST use PKCE"; "For confidential clients, the use of PKCE
is RECOMMENDED". Also "Authorization servers MUST support PKCE". Saying "the RFC requires
PKCE for everyone" overstates it, and an interviewer will notice.

**★ Refresh tokens for public clients need rotation and reuse detection.**
A long-lived refresh token on a user's device is a long-lived full-access credential with no
client authentication protecting its redemption. If the provider does not rotate and detect
reuse, prefer short sessions or a BFF.

**★ Build-time environment variables do not hide anything in a browser bundle.**
`process.env.CLIENT_SECRET` is textually substituted into the bundle. The word "environment"
misleads people into thinking it is server-side.

**★ A mobile app plus its backend is two clients, not one.**
The app is public and does the authorization code + PKCE flow; the backend may be a separate
confidential client for its own calls. Registering them as one is how a secret ends up
where it must not be.

**★ Kubernetes `Secret` is base64, not encryption.**
It is confidential to the extent RBAC, etcd encryption at rest and audit logging make it so.
Treat "confidential" as a claim you can defend, not a checkbox.

## Interview questions

**★ What distinguishes a confidential client from a public client?**
Whether it can maintain the confidentiality of its credentials — RFC 6749 §2.1 — where the
party it must keep them from is the resource owner running it. A web application on a server
you control is confidential; anything executing on the user's device, browser or native, is
public, because the user can read it. Ownership, platform, code signing and TLS are all
irrelevant to the classification.

**★ Why can't a mobile app be a confidential client, even one we wrote ourselves?**
Because the binary is on the user's device and anything embedded in it can be extracted —
§2.1 says exactly this of native applications, that protocol data and credentials are
accessible to the resource owner. Obfuscation raises effort without changing capability, and
a secret shipped in an app is published to every installation with a rotation cycle measured
in app-store releases. §2.1 does note that *dynamically issued* credentials are better
protected than static ones, which is why runtime tokens plus PKCE is the sanctioned answer.

**★ What concretely changes when a client is public?**
No client secret, so no meaningful authentication at the token endpoint; no client
credentials grant; PKCE becomes a MUST rather than a RECOMMENDED; redirect URIs must be
registered and exact-matched; refresh tokens are only safe with rotation and reuse
detection; and the authorization server must not rely on client authentication to identify
the client at all (§2.3), so it cannot tell your app from an impostor using the same
`client_id`.

**★ If the AS cannot identify a public client, what stops an attacker using our
`client_id`?** Nothing stops them *sending* it — it is not a secret. What protects the flow
is where the response may go and who may complete it: the redirect URI is pre-registered and
matched exactly, so the authorization code is delivered only to your registered URI; and
PKCE binds redemption of that code to the party that generated the `code_verifier`, so a
code intercepted en route cannot be exchanged. The defence moved from "who are you" to
"where may this go and who started it".

**★ A team wants to keep the client secret server-side and have the SPA ask their backend
for a token. Is the SPA now confidential?** No — the SPA is still public, but the
architecture may still be right. What they have described is either a BFF, in which case the
backend is the confidential client and should hold the tokens and give the browser a session
cookie, or a token-vending endpoint, which is worse than PKCE because it is an
unauthenticated way to mint tokens. The distinguishing question: does an access token ever
reach JavaScript? If yes, the secret moved but the risk did not.

**★ Our provider issued a client secret for our SPA. Should we use it?**
You can send it; you must not depend on it. RFC 6749 §2.3 forbids the authorization server
from relying on public client authentication to identify the client, so it grants no
security property. It ships in your bundle, so treat it as public information, never write a
control that assumes only your app has it, and make sure PKCE is doing the actual work.

**★ Is a server-side rendered application that puts the client secret in the HTML a
confidential client?** No — it is a confidential client that has been misconfigured into a
public one. The classification follows the credential, not the runtime. The moment the
secret is in the response body it is in the user's browser, and it must be rotated and moved
server-side.

{/* FOOTER */}
