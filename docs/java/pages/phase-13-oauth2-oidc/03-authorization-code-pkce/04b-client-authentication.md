---
title: "Client authentication is the one place a confidential client proves it is itself, and the choice between a shared secret in a header, a shared secret in a body and an asymmetric assertion is a choice about who else could ever have that credential"
sidebar_label: "04b · Client authentication"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §2.1 (Client Types), §2.3 (Client Authentication),
> §2.3.1 (Client Password), §3.2.1 (Client Authentication), §5.2 (Error Response)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700 §2.2.1
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 8252 §8.5 (Client Authentication)
> ([datatracker.ietf.org/doc/html/rfc8252](https://datatracker.ietf.org/doc/html/rfc8252));
> Spring Security reference, "OAuth 2.0 Client · Core Interfaces and Classes" (docs show
> 7.1.1) ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/core.html)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**"Confidential client" is not a description of your intentions; it is a claim that the
credential cannot be extracted by anyone who has the application. A server-side web app
holding a secret in a mounted file is confidential. A single-page application with the same
secret in its bundle is not, no matter what the registration says, because every user of it
has the secret. RFC 8252 makes the same call for native apps. Choosing a client
authentication method is therefore first a decision about client *type*, and only then about
mechanism.**

## The definitions that decide everything

RFC 6749 §2.1:

> *"confidential — Clients capable of maintaining the confidentiality of their credentials
> (e.g., client implemented on a secure server with restricted access to the client
> credentials), or capable of secure client authentication using other means."*
>
> *"public — Clients incapable of maintaining the confidentiality of their credentials (e.g.,
> clients executing on the device used by the resource owner, such as an installed native
> application or a web browser-based application), and incapable of secure client
> authentication via any other means."*

And §2.3:

> *"The client credentials (or assertion) are not sent in the request URI. Instead, they are
> sent in the request-body or as a request header."*

RFC 8252 §8.5 settles native apps: they are public clients and *"MUST be registered with the
authorization server as such"*, because a secret shipped in a binary is extractable by anyone
holding the binary.

## The methods, as Spring names them

Spring Security's `ClientRegistration` documents the supported values of
`clientAuthenticationMethod` verbatim:

> *"The method used to authenticate the Client with the Provider. The supported values are
> **client_secret_basic**, **client_secret_post**, **private_key_jwt**, **client_secret_jwt**
> and **none** (public clients)."*

| Method | Where the credential goes | What can hold it |
|---|---|---|
| `client_secret_basic` | `Authorization: Basic <base64(urlencode(id):urlencode(secret))>` | Anyone with the header — TLS terminator logs, proxies logging headers |
| `client_secret_post` | `client_id` and `client_secret` form fields in the body | Anyone with the body — request-body logging, debug dumps |
| `client_secret_jwt` | A JWT signed with HMAC over the shared secret, sent as `client_assertion` | The secret still exists on both sides, but never crosses the wire |
| `private_key_jwt` | A JWT signed with the client's private key, sent as `client_assertion` | The AS holds only a public key. Nothing shared to leak. |
| `none` | Nothing. Public client. `client_id` in the body only. | — |

RFC 6749 §2.3.1 defines the first as HTTP Basic and adds a detail every implementation gets
wrong at least once:

> *"The client identifier is encoded using the `application/x-www-form-urlencoded` encoding
> algorithm per Appendix B, and the encoded value is used as the username; the client password
> is encoded using the same algorithm and used as the password."*

So the pieces are **form-URL-encoded first, then joined with a colon, then base64-encoded**. A
secret containing `+`, `/`, `=` or a space produces a different header depending on whether
you did that step, and the failure is `invalid_client` against half the providers in the
world. §2.3.1 also says the AS *"MAY support"* `client_secret_post` and that including the
credentials in the body is `NOT RECOMMENDED` — the Basic header is the preferred form.

## The asymmetric methods, and why they are the answer for anything long-lived

`private_key_jwt` (defined by OpenID Connect Core §9 and RFC 7523) has one structural
advantage that no amount of secret-rotation hygiene can match: **the authorization server
never holds a credential that can impersonate you.** It holds a public key. A breach of the
authorization server's client registry — or an accidental dump of it into a support ticket,
a backup, or a log — does not yield anything that lets the attacker authenticate as your
client.

Everything `client_secret_basic` protects has to survive being present, in plaintext, in two
organisations' systems simultaneously.

The client assertion parameters are `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`
and `client_assertion=<the-signed-jwt>`, sent in the token request body alongside
`grant_type` and the rest. The JWT's `iss` and `sub` are both the `client_id`, its `aud` is
the token endpoint (or the issuer, depending on the profile), and it carries a `jti` so the
server can reject replays. The JWT wire format and signature validation are **06 · JWT anatomy
and validation** *(not written yet)*.

## PKCE does not replace client authentication, and vice versa

This is the pairing people collapse:

| | Answers the question |
|---|---|
| Client authentication | *Is the party at the token endpoint the registered client?* |
| PKCE | *Is the party redeeming this code the party that started this specific authorization request?* |

A confidential client with a secret and no PKCE is still vulnerable to code injection (RFC
9700 §4.5): the attacker does not authenticate as your client, they get *your* correctly
authenticated client to redeem *their* code. A public client with PKCE and no secret is not
vulnerable to that, but any application can start a flow with your `client_id`. They are
orthogonal, which is why RFC 9700 §2.1.1 recommends PKCE for confidential clients too rather
than treating the secret as sufficient.

## What Spring Security does

`ClientRegistration.clientAuthenticationMethod` maps to
`spring.security.oauth2.client.registration.<id>.client-authentication-method`. Configuration
in Java:

```java
ClientRegistration.withRegistrationId("example")
    .clientId("s6BhdRkqt3")
    .clientSecret("{client-secret}")
    .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
    .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
    .scope("openid", "profile")
    .authorizationUri("https://server.example.com/authorize")
    .tokenUri("https://server.example.com/token")
    .build();
```

Note `"{client-secret}"` is a placeholder for a property reference, never a literal. In a real
application the value comes from an environment variable, a mounted secret or a vault
integration, and the property is
`spring.security.oauth2.client.registration.example.client-secret`.

Where the secret is *stored* — vault, sealed secret, cloud secret manager, and the rotation
procedure — is out of scope for this topic; **04 · Client credentials** *(not written yet)*
owns the credential-storage argument, and **09 · Spring as OAuth2 client** *(not written yet)*
owns the runtime client API.

## Gotchas

**★ `client_secret_basic` requires form-URL-encoding each half before base64, and almost
nobody does it.**
RFC 6749 §2.3.1 is explicit. A generated secret containing `+` or `/` — which base64-derived
secrets routinely do — will authenticate against a lenient server and fail against a strict
one, so the bug appears only when you change providers. Spring Security's
`RestClientAuthorizationCodeTokenResponseClient` handles the encoding; hand-rolled clients
usually do not.

**★ A "confidential" SPA is a public client with a leaked secret.**
If the credential ships to the browser, every user has it. Registering it as confidential does
not make it so; it just means the authorization server will not enforce PKCE for it by default
and will accept the secret from anyone who read your bundle. Register browser and native
clients as public (`none`) and let PKCE do the work.

**★ Sending credentials both ways is `invalid_request`, not redundancy.**
RFC 6749 §5.2 lists *"utilizes more than one mechanism for authenticating the client"* under
`invalid_request`. A client that sets a Basic header *and* posts `client_secret` is
non-conforming even though it "has the right secret".

**★ `invalid_client` arrives as a 401 with `WWW-Authenticate` when you used the Basic
header.**
§5.2 requires it. Generic HTTP client interceptors that react to 401 by re-authenticating will
retry forever against a wrong secret, and the retry consumes nothing but does hammer the
provider — some of which rate-limit or lock the client registration.

**★ Client secrets expire on some providers, silently.**
Several commercial authorization servers give client secrets an expiry independent of
anything you configured. Nothing in the flow warns you; logins simply start failing with
`invalid_client` at the token endpoint on a date nobody wrote down. Track the expiry as an
operational asset, not a config value.

**★ `client_secret_jwt` still involves a shared secret; only `private_key_jwt` removes it.**
The names are similar and the difference is the whole point: `client_secret_jwt` signs the
assertion with HMAC over the shared secret, so the authorization server must still hold
something that can impersonate you. `private_key_jwt` signs with a private key the server never
sees.

**★ A public client sending `client_id` in the body is asserting, not proving, its identity.**
That is by design and it is why the code binding in §4.1.3 for public clients is only *"ensure
that the code was issued to `client_id` in the request"*. Without PKCE, any application that
knows your `client_id` and can obtain one of your codes can redeem it. This is precisely the
attack RFC 7636 was written for — [05 · The interception
attack](05-the-interception-attack.md).

**★ Do not authenticate the client by IP allowlist and call it done.**
It is a useful additional control and it is not client authentication: it authenticates a
network location, and in a shared cluster or behind a NAT gateway that location is shared with
everything else deployed there.

## Interview questions

**★ What makes a client confidential, and who decides?**
Whether it can keep a credential secret from its own users — RFC 6749 §2.1 defines confidential
clients as those *"capable of maintaining the confidentiality of their credentials"* and public
clients as those *"incapable"*, giving native apps and browser applications as the examples of
the latter. The deployment decides, not the registration. Registering a browser app as
confidential does not create a secret the browser can keep; it creates a secret that every user
of the app possesses. RFC 8252 §8.5 makes the corresponding ruling for native apps: they are
public clients and must be registered as such.

**★ Compare `client_secret_basic` and `private_key_jwt`. When would you insist on the latter?**
`client_secret_basic` sends a shared secret on every token request; both parties hold a
credential that can impersonate the client, so a breach or a leak at *either* end is a full
compromise, and rotation requires coordinated change on both sides. `private_key_jwt` sends a
short-lived JWT signed by a private key that never leaves the client; the authorization server
holds only a public key, so its compromise yields nothing, and rotation is publishing a new key
alongside the old. I would insist on it for anything with a long-lived registration, anything
crossing an organisational boundary, and anything where the authorization server is operated by
a third party — which is most external identity providers.

**★ If a client authenticates with a secret, is PKCE still worth it?**
Yes, and RFC 9700 §2.1.1 says so: *"For confidential clients, the use of PKCE [RFC7636] is
RECOMMENDED"* — note RECOMMENDED, not MUST; the MUST applies to public clients. The reason is
that client authentication and PKCE defend different things. Client authentication stops
someone else redeeming your code. PKCE stops an attacker injecting *their* code into *your*
correctly-authenticated client's session — RFC 9700 §4.5 — which your secret cannot prevent
because your client is the one being used. For a confidential OIDC client, the specification
also allows `nonce` as the alternative countermeasure.

**★ Why does RFC 6749 say the credentials must not be in the request URI?**
§2.3: *"The client credentials (or assertion) are not sent in the request URI. Instead, they
are sent in the request-body or as a request header."* URIs are logged by every intermediary
by default, land in browser history and `Referer` headers when they touch a browser, and are
frequently included verbatim in error reports and traces. A credential in a URI is a credential
in a log. The same reasoning is why RFC 6749 §3.2 requires `POST` for the token request.

**★ A team registers their SPA as a confidential client so they can "use the secure flow". What
do you say?**
That the secret is in the JavaScript bundle, so it is not a secret and the client is public by
RFC 6749 §2.1's definition regardless of what the registration record says. The practical harm
is specific: the authorization server may not enforce PKCE for a client it believes is
confidential, and it will accept the "secret" from anyone who opened dev tools. The correct
configuration is `client-authentication-method: none` with PKCE — which Spring Security enables
automatically for that combination — or, better, moving the token exchange to a backend so the
client genuinely is confidential. That second option is the BFF pattern, which **13 · Sessions
vs tokens, honestly** *(not written yet)* owns.

{/* FOOTER */}
