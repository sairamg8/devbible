# Phase 13 · OAuth2 & OIDC — notes every fork in this phase must read

Target stack: **OAuth 2.0 (RFC 6749) + the RFC 9700 Best Current Practice · OIDC 1.0 ·
Spring Security 7.x on Spring Boot 4.1.0 / Spring Framework 7.0.8 · JDK 25.**

## 🔴 THE VERSION SPINE — verified, do not re-derive

| | Pinned for this phase |
|---|---|
| JDK | **25** |
| Spring Boot | **4.1.0** |
| Spring Framework | **7.0.8** |
| **Spring Security** | 🔴 **7.x** — Boot 4.x manages Security 7, *not* 6 |
| Nimbus JOSE + JWT | the `NimbusJwtDecoder` / `NimbusJwtEncoder` backing library |

🔴 **The phase README (written 2026-08-17) says "Spring Security 6.x". That is stale.**
The rest of the Java corpus already pins **7.x** — `phase-9-spring-boot/11-spring-security/`
says "Spring Boot 4.1.0, Spring Security 7.x, JDK 25" on its `> Verified:` lines. Write
**7.x**. The coordinator fixes the README banner; a fork does not edit the phase README.

⚠️ **Security 7 removed configuration API that every tutorial still uses.** Before you write
a `SecurityFilterChain`, check the *Spring Security 7.0 configuration-migration* notes for
what was deleted — the lambda DSL is now the only DSL, `and()` is gone, and several
`http.xxx()` overloads that blogs still show do not exist. Verify each config snippet
against the 7.x reference, and say so on your `> Verified:` line.

## 🔴 The four facts that make most online material wrong on this phase

1. 🔴 **The implicit flow and the resource-owner-password-credentials flow are dead.**
   RFC 9700 (*OAuth 2.0 Security Best Current Practice*, published as a BCP) says clients
   **MUST NOT** use the implicit grant and **MUST NOT** use the password grant. Any page
   that presents either as a live option is wrong. Present them **as history plus the
   attack that killed each** — that is the teaching, not a footnote.
2. 🔴 **PKCE is not "the mobile/SPA extension" any more.** RFC 9700 requires PKCE for
   **all** authorization-code clients, confidential ones included. RFC 7636 is where the
   mechanism is defined; RFC 9700 is where it became universal. Both get cited.
3. 🔴 **An access token is opaque to the client, by contract.** That it is *often* a JWT is
   an implementation choice of the authorization server, not part of OAuth2. A client that
   parses an access token has coupled itself to a format the AS may change. The **ID token**
   is the one that is a JWT by specification. Topics 05 and 06 must not blur this.
4. 🔴 **`scope` is not `role` and neither is a permission.** A scope is what the *client*
   was authorized to ask for; an authority/role is what the *user* is. Spring's
   `SCOPE_` prefix versus `ROLE_` prefix is exactly this distinction leaking into code, and
   it is the single most common review finding. Topic 10 owns the argument; 08 owns the
   mapping mechanics.

## 🔴 NO SANDBOX — what a page may and may not contain

There is **no browser, no Keycloak, no network** on this machine. Pages carry **Java source,
YAML/properties config, RFC-quoted field definitions and specification-derived message
shapes**. They must **never** contain a fabricated HTTP transcript presented as real, a real
token, a real JWKS, or a decoded token claimed to have been observed. Illustrative token
*structure* is fine **and must be labeled as illustrative** — e.g. "the shape of a token,
not a token". Signatures in examples are written as `<base64url-signature>`, never as
plausible-looking base64.

⛔ **Never write a private key, a client secret, or a `kid` that looks real** — use obvious
placeholders (`{client-secret}`, `s6BhdRkqt3` is RFC 6749's own example client id and is
safe to reuse *because the RFC uses it*).

## Boundaries inside the phase (fixed — a fork that crosses one duplicates another's work)

- **01 Why OAuth2 exists** owns the problem statement: the password anti-pattern, delegated
  authorization, the "share your Gmail password with the address-book importer" era, and
  why *authorization* not *authentication* is what OAuth2 is for. It names OIDC and hands
  off to 07. No flow diagrams beyond a one-paragraph sketch.
- **02 The four roles** owns resource owner / client / authorization server / resource
  server, **confidential vs public clients**, the front-channel/back-channel distinction,
  and mapping all of it onto a real Spring stack. It is the vocabulary every later topic
  uses. It does **not** walk a flow end to end — 03 does.
- **03 Authorization code + PKCE** owns the one flow: every redirect, every parameter
  (`response_type`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`,
  `code_challenge_method`), the token exchange, `state` vs PKCE (they defend different
  attacks), redirect-URI exact matching, code interception, mix-up and CSRF. **Implicit and
  password grants are buried here**, with the attack that killed each.
- **04 Client credentials** owns machine-to-machine: no user, no refresh token, credential
  storage, caching and the "why not just an API key" argument.
- **05 The three tokens** owns access / refresh / ID as *roles in the protocol*: lifetime,
  where each may legally appear, refresh-token rotation and reuse detection, revocation
  (RFC 7009), introspection (RFC 7662) and **opaque vs JWT as an AS choice**. It stops at
  the JWT wire format — that is 06.
- **06 JWT anatomy and validation** owns the wire format and the validation algorithm:
  header/payload/signature, RS256 vs HS256 vs EdDSA, the registered claims, JWKS and `kid`
  rotation, clock skew, and the classic attacks (`alg: none`, HS/RS confusion, `kid`
  injection, unvalidated `iss`/`aud`). Spring's `NimbusJwtDecoder` appears as the concrete
  implementation; **wiring it into a filter chain is 08.**
- **07 OpenID Connect** owns authentication on top of OAuth2: the ID token, `nonce`,
  discovery (`/.well-known/openid-configuration`), UserInfo, standard scopes and claims,
  and the `sub` is-not-an-email argument.
- **08 Spring Security as resource server** owns server-side config: `issuer-uri` vs
  `jwk-set-uri`, the default validators, custom `OAuth2TokenValidator`, authorities mapping
  (`JwtAuthenticationConverter`, the Keycloak `realm_access.roles` converter), opaque-token
  introspection, and multi-tenancy.
- **09 Spring as OAuth2 client** owns outbound: `oauth2Login`, `ClientRegistration`,
  `OAuth2AuthorizedClientManager`, `RestClient`/`WebClient` interceptors, token refresh.
- **10 Method security** owns `@PreAuthorize`/`@PostAuthorize`, `hasAuthority` vs
  `hasRole` vs `hasAuthority('SCOPE_x')`, and the "one layer, not three" argument.
- **11 Running vs buying the AS** owns Keycloak / Spring Authorization Server vs
  Auth0 / Cognito / Entra ID — cost, operational burden, lock-in, migration.
- **12 Token relay** owns audience-per-service, the internal god-token anti-pattern,
  token exchange (RFC 8693), and where the gateway sits.
- **13 Sessions vs tokens, honestly** owns the BFF pattern, why "JWT in `localStorage`"
  fails review, cookie flags, and when a plain session is the right answer.
- **14 mTLS and workload identity** owns SPIFFE/SVID, certificate rotation, sender-
  constrained tokens (RFC 8705), and where a service mesh does it for you.

## 🔴 Every page cites a specification, not a blog

Acceptable primary sources, in order of preference:

1. **The RFC itself** — 6749 (core), 6750 (bearer), 7009 (revocation), 7515/7517/7518/7519
   (JWS/JWK/JWA/JWT), 7636 (PKCE), 7662 (introspection), 8414 (AS metadata), 8628 (device),
   8693 (token exchange), 8705 (mTLS), 9068 (JWT access-token profile), **9700 (BCP)**.
2. **openid.net** — OpenID Connect Core 1.0, Discovery 1.0.
3. **The Spring Security 7.x reference and javadocs.**

A `> Verified:` line names the section, not just the document. "RFC 6749" is not a citation;
"RFC 6749 §4.1.3 (Access Token Request)" is.

## Phase gate (from the README — the phase must actually deliver this)

The reader can whiteboard the authorization code + PKCE flow with every redirect and
back-channel call labeled, say which token appears where, and explain why the API validates
`iss`, `aud` and `exp` but never sees a refresh token.
