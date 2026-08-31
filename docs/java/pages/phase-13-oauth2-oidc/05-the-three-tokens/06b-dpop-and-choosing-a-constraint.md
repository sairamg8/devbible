---
title: "DPoP moves proof-of-possession from the transport layer to the application layer so that a browser can do it at all, and the price is a signed JWT on every request plus a private-key story the client must not get wrong"
sidebar_label: "06b · DPoP and choosing a constraint"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 9449 §1 (Introduction), §5 (DPoP Access Token Request),
> §6 (Public Key Confirmation), §7 (Protected Resource Access), §7.1 (The DPoP Authentication
> Scheme) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9449.txt)); RFC 8705 §3.1, §3.2
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc8705.txt)); RFC 9700 §2.2.1, §2.2.2
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt));
> `draft-ietf-oauth-browser-based-apps-27` §5.2.2 — an Internet-Draft, not an RFC
> ([ietf.org](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-27.txt));
> `OAuth2ResourceServerConfigurer` and `DPoPAuthenticationProvider` sources on `main`
> ([github.com/spring-projects](https://github.com/spring-projects/spring-security)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**[06](06-what-a-bearer-token-cannot-do.md) established the impossibility and the transport-
layer fix. This chunk is the application-layer fix — the one that works in a browser, which is
where the tokens actually get stolen. DPoP is more moving parts than mTLS and it is the only
option for the client types that need it most.**

## Option two: DPoP (RFC 9449)

RFC 9449 §1:

> *"Demonstrating Proof of Possession (DPoP) is an application-level mechanism for
> sender-constraining OAuth [RFC6749] access and refresh tokens. It enables a client to prove
> the possession of a public/private key pair by including a DPoP header in an HTTP request.
> The value of the header is a JSON Web Token (JWT) that enables the authorization server to
> bind issued tokens to the public part of a client's key pair."*

And why it exists alongside RFC 8705:

> *"The mechanism specified herein can be used in cases where other methods of
> sender-constraining tokens that utilize elements of the underlying secure transport layer,
> such as [RFC8705] […] are not available or desirable. For example, due to a sub-par user
> experience of TLS client authentication in user agents and a lack of support for HTTP token
> binding, neither mechanism can be used if an OAuth client is an application that is
> dynamically downloaded and executed in a web browser […]"*

The mechanics, compressed:

1. The client generates a key pair and keeps the private key (in a browser: a non-extractable
   `CryptoKey`; on mobile: the platform keystore).
2. On every request — to the token endpoint and to resource servers — it sends a `DPoP` header
   containing a small signed JWT (the *proof*) whose header carries the public JWK and whose
   payload names the HTTP method (`htm`), the URL (`htu`), a timestamp and a unique `jti`.
3. The AS binds the issued token to the key's thumbprint and returns `token_type: DPoP`
   (RFC 9449 §5: *"A `token_type` of DPoP MUST be used"*).
4. The binding is expressed as `cnf.jkt`. §6: *"jkt: JWK SHA-256 Thumbprint confirmation
   method."*
5. On a resource request the client sends both:

> *"Requests to DPoP-protected resources MUST include both a DPoP proof as per Section 4 and
> the access token as described in Section 7.1. The DPoP proof MUST include the `ath` claim
> with a valid hash of the associated access token."*

6. The resource server checks all of it. §7.1:

> *"For such an access token, a resource server MUST check that a DPoP proof was also received
> in the DPoP header field of the HTTP request, check the DPoP proof according to the rules in
> Section 4.3, and check that the public key of the DPoP proof matches the public key to which
> the access token is bound per Section 6. The resource server MUST NOT grant access to the
> resource unless all checks are successful."*

Note the scheme change: `Authorization: DPoP <token>`, not `Bearer`. §7.1's ABNF is
`credentials = "DPoP" 1*SP token68`.

The `ath` claim is the part worth understanding, because it is what stops the obvious attack:

> *"Binding the token value to the proof in this way prevents a proof to be used with multiple
> different access token values across different requests. […] if a client holds tokens bound
> to two different resource owners, AT1 and AT2, and uses the same key when talking to the
> authorization server, it's possible that these tokens could be swapped. Without the `ath`
> field to bind it, a captured signature applied to AT1 could be replayed with AT2 instead,
> changing the rights and access of the intended request."*

### DPoP binds refresh tokens too, and for public clients it is mandatory when used

RFC 9449 §5:

> *"When an authorization server supporting DPoP issues a refresh token to a public client that
> presents a valid DPoP proof at the token endpoint, the refresh token MUST be bound to the
> respective public key. The binding MUST be validated when the refresh token is later
> presented to get new access tokens. As a result, such a client MUST present a DPoP proof for
> the same key that was used to obtain the refresh token each time that refresh token is used
> to obtain a new access token."*

This is the branch that satisfies RFC 9700 §2.2.2's `MUST` without rotation — and it is
strictly stronger than rotation, because a stolen refresh token without the private key is
inert rather than merely detectable-on-second-use.

## Spring Security 7's DPoP support

The resource-server side ships in the framework. `OAuth2ResourceServerConfigurer` has a
`dPoP` entry point (note the capital `P`):

```java
// OAuth2ResourceServerConfigurer (Spring Security 7.x, main)
/**
 * Enables DPoP-bound access token support.
 */
public OAuth2ResourceServerConfigurer<H> dPoP(Customizer<DPoPConfigurer> dPoPCustomizer) { ... }
```

behind `DPoPAuthenticationProvider`, `DPoPAuthenticationConverter`,
`DPoPAuthenticationEntryPoint` and `DPoPProofJwtDecoderFactory`. The configurer is
class-path-conditional — it checks for `org.springframework.security.oauth2.jwt.DPoPProofJwtDecoderFactory`
before activating.

Enabling it alongside bearer tokens:

```java
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests((auth) -> auth.anyRequest().authenticated())
        .oauth2ResourceServer((oauth2) -> oauth2
            .jwt(Customizer.withDefaults())
            .dPoP(Customizer.withDefaults()))
        .build();
}
```

*I could not confirm from the published Spring Security 7.x reference whether there is a
matching client-side `AuthorizedClientProvider` that produces DPoP proofs for outbound calls;
the resource-server components are present in the source, and I did not find a client-side
counterpart at the paths I checked. Verify against the reference for your exact version before
planning a client implementation.*

## Choosing between them

| | mTLS (RFC 8705) | DPoP (RFC 9449) |
|---|---|---|
| Layer | transport | application |
| Confirmation claim | `cnf.x5t#S256` | `cnf.jkt` |
| Auth scheme on the request | `Bearer` | `DPoP` |
| Works in a browser | no, in practice | yes — that is the design goal |
| Works through a TLS-terminating proxy | only with careful cert forwarding | yes, it is above TLS |
| Extra per-request work for the client | none | sign a small JWT |
| Extra per-request work for the RS | compare a thumbprint | verify a signature, check `htm`/`htu`/`ath`/`jti`, replay-window checks |
| Binds refresh tokens | yes | yes, and mandatory for public clients that use it |
| Natural fit | service-to-service, mesh, PKI shops | SPAs, mobile, anything user-agent-hosted |

The honest summary: if you already run mTLS between services, RFC 8705 is nearly free and you
should take it. If your clients are browsers or mobile apps, DPoP is the only option, and it
costs a key-management story on the client.

## The limit of both

Sender-constraining stops *replay of a stolen token*. It does not stop an attacker who has
code execution inside the client, because that attacker can ask for a fresh token with their
own key. The browser-apps BCP §5.2.2 says exactly this:

> *"when the attacker obtains a fresh access token (and optionally refresh token) […] they can
> set up DPoP for these tokens using an attacker-controlled key pair. In that case, the
> attacker is again free to abuse this newly obtained access token without restrictions."*

So DPoP raises the cost of exfiltration attacks — the attacker must run *online*, in the
victim's browser, rather than lifting a token and using it later from anywhere — without
solving XSS. The BCP's structural answer to that is the BFF, which is
**13 · Sessions vs tokens, honestly** *(not written yet)*.

## Gotchas

**★ DPoP changes the `Authorization` scheme, so a bearer-only resource server rejects the
request entirely.**
`Authorization: DPoP <token>` will not match `startsWithIgnoreCase(authorization, "bearer")`,
so Spring's bearer resolver returns `null` and the request is simply unauthenticated. Rolling
out DPoP requires the resource servers to support it *first*, then the clients.

**★ A DPoP proof without `ath` is not sufficient on a resource request.**
RFC 9449 §7: the proof *"MUST include the `ath` claim with a valid hash of the associated
access token"*. Without it a captured proof can be replayed against a different token held by
the same client — the swap attack §7 describes.

**★ Sender-constraining does not stop an attacker with code execution in the client.**
They request their own token with their own key. It stops *exfiltrate-and-replay-later*,
which is a large fraction of real incidents, and it does not stop live abuse from inside a
compromised page.

**★ Private key storage is the whole difficulty of DPoP on a client.**
In a browser the key must be a non-extractable `CryptoKey` — otherwise malicious JavaScript
exports it along with the token and you have gained nothing. On mobile it belongs in the
platform keystore. A DPoP implementation that keeps the key in ordinary JavaScript memory or
in `localStorage` provides no additional security at all.

**★ `token_type` becomes `DPoP`, and client code that hardcodes `"Bearer"` breaks.**
RFC 9449 §5: *"A `token_type` of DPoP MUST be used"*. Any client that builds its
`Authorization` header as the literal string `"Bearer "` plus the token — rather than from
`token_type` — will send a DPoP-bound token under the wrong scheme and be rejected.

**★ Spring's DSL method is `dPoP`, not `dpop`.**
A small thing that costs ten minutes of IDE autocomplete confusion.

**★ A DPoP proof is single-use-ish, and the resource server has to keep state to make that
true.**
The proof carries a `jti` and a timestamp; rejecting replays means remembering recently-seen
`jti`s for the acceptance window. That is per-resource-server state — a bounded cache — which
is a genuine operational cost people do not budget for when they say "DPoP is just a header".

**★ `htu` must match the URL the resource server thinks it is serving.**
The proof binds to the HTTP method and URI. Behind a reverse proxy that rewrites paths or
changes the host, the client's `htu` and the server's view of the request diverge, and every
request fails validation. Getting `X-Forwarded-*` handling right becomes a prerequisite, not a
nicety.

**★ Clock skew on the client breaks DPoP, not just token expiry.**
The proof carries `iat` and servers enforce a short acceptance window. A mobile device with a
badly wrong clock produces proofs that are rejected as too old or too new, and the failure
looks like an auth bug rather than a clock bug.

## Interview questions

**★ Compare mTLS-bound tokens and DPoP. When would you pick each?**
Both bind the token to a key via a `cnf` claim — RFC 8705 uses `cnf.x5t#S256`, the SHA-256
thumbprint of the client's X.509 certificate; RFC 9449 uses `cnf.jkt`, the SHA-256 thumbprint
of a JWK the client generated. mTLS operates at the transport layer, so the client needs no
per-request work but does need a certificate and an unbroken TLS path to the resource server —
which a TLS-terminating load balancer breaks. DPoP operates at the application layer: the
client signs a small proof JWT per request naming the method, URL and a hash of the access
token, so it works through any proxy and in a browser. RFC 9449 §1 names the browser case as
its motivation, citing *"a sub-par user experience of TLS client authentication in user
agents"*. Service-to-service in a mesh: mTLS. SPAs and mobile: DPoP.

**★ What is the `ath` claim in a DPoP proof for?**
It binds the proof to a specific access token by carrying that token's hash. Without it, a
proof is a general-purpose statement that "I hold this key for this method and URL", and RFC
9449 §7 describes the attack that enables: a client holding two tokens bound to the same key —
say for two different resource owners — could have a captured proof for one replayed with the
other, *"changing the rights and access of the intended request"*. With `ath`, a proof only
works with the exact token it was minted for, and a rotated token requires a new proof.

**★ Your SPA implements DPoP but keeps the private key in a JavaScript variable. Is it
protected?**
No. DPoP's security rests entirely on the attacker not being able to use the key. If the key
material is reachable from JavaScript, an XSS payload exports both the key and the token and
can then replay offline, which is exactly the situation DPoP was meant to prevent. The key
must be a non-extractable `CryptoKey` from the Web Crypto API — usable for signing, not
exportable. And even then, the browser-apps BCP §5.2.2 is clear that an attacker with code
execution can obtain a *fresh* token with their own key: *"the attacker is again free to abuse
this newly obtained access token without restrictions."* DPoP forces the attack online; it
does not fix XSS.

**★ Walk through what a DPoP-protected API request contains.**
Two headers. `Authorization: DPoP <access-token>` — note the scheme is `DPoP`, not `Bearer`,
per RFC 9449 §7.1's ABNF `credentials = "DPoP" 1*SP token68`. And `DPoP: <proof-jwt>`, a small
JWT signed by the client's private key whose header carries the public JWK and whose payload
carries `htm` (the HTTP method), `htu` (the request URI), `iat`, a unique `jti`, and `ath` —
the hash of the access token being presented. The resource server verifies the proof's
signature against the embedded JWK, checks `htm`/`htu` against the actual request, checks the
timestamp is inside its acceptance window, checks it has not seen that `jti` recently, hashes
the presented access token and compares to `ath`, and finally checks that the JWK's thumbprint
matches the token's `cnf.jkt`. §7.1: *"The resource server MUST NOT grant access to the
resource unless all checks are successful."*

**★ What operational state does DPoP force onto a resource server that bearer tokens do not?**
Replay tracking. Each proof carries a `jti` and a timestamp, and the server must reject a proof
it has already seen inside its acceptance window — which means a bounded, shared-if-you-are-
horizontally-scaled cache of recent `jti` values. It also forces correct `X-Forwarded-*`
handling, because the proof binds `htu` to a URI and the server has to reconstruct the same
URI the client signed. Neither is exotic, but both are real work, and both are things a
bearer-token deployment never had to think about.

{/* FOOTER */}
