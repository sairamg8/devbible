---
name: research-java-p13-t07-oidc
description: Banked verbatim OIDC Core 1.0 and Discovery 1.0 quotes for devbible Java phase 13 topic 07 (OpenID Connect) — the §3.1.3.7 ID-token validation rules, the §3.1.2.1 request parameters, the Discovery well-known path and the §4.3 issuer-match rule. Do not re-derive; write chunks from here.
metadata:
  type: project
---

# 🔴 Banked research — Java p13 topic 07 · OpenID Connect

**Fetched 2026-09-04 by session `e7ea206c`, two fetches total. DO NOT RE-DERIVE.**
Sources: OpenID Connect Core 1.0 and OpenID Connect Discovery 1.0 at
[openid.net/specs](https://openid.net/specs/openid-connect-core-1_0.html) and
[openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html).

⚠️ **The published HTML of Core 1.0 truncates before §5.** §5.1 (Standard Claims), §5.3.2
(Successful UserInfo Response), §5.4 (Requesting Claims using Scope Values) and §8 (Subject
Identifier Types) could **not** be re-read in this pass — two attempts, both returned NOT
FOUND for those sections. Anything sourced from them must be written as explicitly
attributed-but-not-re-read, or replaced with the per-provider answer
(`claims_supported` / `subject_types_supported` in the discovery document). **Do not quote
those sections verbatim from memory.**

## OIDC Core §3.1.3.7 — ID Token Validation (verbatim, the load-bearing set)

Preamble: *"Clients MUST validate the ID Token in the Token Response in the following
manner:"*

1. *"If the ID Token is encrypted, decrypt it using the keys and algorithms that the Client
   specified during Registration that the OP was to use to encrypt the ID Token."*
2. *"The Issuer Identifier for the OpenID Provider (which is typically obtained during
   Discovery) MUST exactly match the value of the `iss` (issuer) Claim."*
3. *"The Client MUST validate that the `aud` (audience) Claim contains its `client_id` value
   registered at the Issuer identified by the `iss` (issuer) Claim as an audience."*
4. *"If the implementation is using extensions (which are beyond the scope of this
   specification) that result in the `azp` (authorized party) Claim being present, it SHOULD
   validate the `azp` value."*
5. *"If the ID Token is received via direct communication between the Client and the Token
   Endpoint (which it is in this flow), the TLS server validation MAY be used to validate the
   issuer in place of checking the token signature."*
6. *"The Client MUST validate the signature of all other ID Tokens according to [JWS] using
   the algorithm specified in the JWT `alg` Header Parameter."*
7. *"The `alg` value SHOULD be the default of RS256 or the algorithm sent by the Client in
   the `id_token_signed_response_alg` parameter during Registration."*
8. *"If the JWT `alg` Header Parameter uses a MAC based algorithm such as HS256, HS384, or
   HS512, the octets of the UTF-8 representation of the `client_secret` corresponding to the
   `client_id` contained in the `aud` (audience) Claim are used as the key to validate the
   signature."*
9. *"The current time MUST be before the time represented by the `exp` Claim."*
10. *"The `iat` Claim can be used to reject tokens that were issued too far away from the
    current time, limiting the amount of time that nonces need to be stored to prevent
    attacks."*
11. *"If a `nonce` value was sent in the Authentication Request, a `nonce` Claim MUST be
    present and its value checked to verify that it is the same value as the one that was
    sent."*
12. *"If the `acr` Claim was requested, the Client SHOULD check that the asserted Claim Value
    is appropriate."*
13. *"If the `auth_time` Claim was requested, either through a specific request for this Claim
    or by using the `max_age` parameter, the Client SHOULD check the `auth_time` Claim value
    and request re-authentication if it determines too much time has elapsed."*

## OIDC Core §3.1.2.1 — Authentication Request parameters (verbatim)

- **`scope`** — *"REQUIRED. OpenID Connect requests MUST contain the `openid` scope value. If
  the `openid` scope value is not present, the behavior is entirely unspecified."*
- **`response_type`** — *"REQUIRED. OAuth 2.0 Response Type value that determines the
  authorization processing flow to be used, including what parameters are returned from the
  endpoints used. When using the Authorization Code Flow, this value is `code`."*
- **`nonce`** — *"OPTIONAL. String value used to associate a Client session with an ID Token,
  and to mitigate replay attacks. The value is passed through unmodified from the
  Authentication Request to the ID Token."*
- **`prompt`** — *"OPTIONAL. Space-delimited, case-sensitive list of ASCII string values that
  specifies whether the Authorization Server prompts the End-User for reauthentication and
  consent."* Defined values: `none`, `login`, `consent`, `select_account`.
- **`max_age`** — *"OPTIONAL. Maximum Authentication Age. Specifies the allowable elapsed time
  in seconds since the last time the End-User was actively authenticated by the OP."*
- **`display`** — *"OPTIONAL. ASCII string value that specifies how the Authorization Server
  displays the authentication and consent user interface pages to the End-User."* Values:
  `page`, `popup`, `touch`, `wap`.
- **`id_token_hint`** — *"OPTIONAL. ID Token previously issued by the Authorization Server
  being passed as a hint about the End-User's current or past authenticated session with the
  Client."*
- **`login_hint`** — *"OPTIONAL. Hint to the Authorization Server about the login identifier
  the End-User might use to log in (if necessary)."*
- **`acr_values`** — *"OPTIONAL. Requested Authentication Context Class Reference values.
  Space-separated string that specifies the `acr` values that the Authorization Server is
  being requested to use."*

## OIDC Core §2 — ID Token claims (already quoted on chunk 01, kept here for reuse)

REQUIRED: `iss`, `sub`, `aud`, `exp`, `iat`. OPTIONAL: `auth_time` (REQUIRED when `max_age`
is requested or when requested as an Essential Claim), `nonce`, `acr`, `amr`, `azp`.
`sub` — *"Subject Identifier. A locally unique and never reassigned identifier within the
Issuer for the End-User."* … *"It MUST NOT exceed 255 ASCII characters in length."*
`azp` — *"only occurs when extensions beyond the scope of this specification are used"*.

## OIDC Discovery 1.0 (verbatim)

- **§4** — *"OpenID Providers supporting Discovery MUST make a JSON document available at the
  path formed by concatenating the string `/.well-known/openid-configuration` to the
  Issuer."* For an Issuer **with** a path component, the terminating `/` is removed before
  appending, giving e.g. `GET /issuer1/.well-known/openid-configuration`.
- **§4.3 (Configuration Validation)** — 🔴 the load-bearing one:
  *"The issuer value returned MUST be identical to the Issuer URL that was used as the prefix
  to `/.well-known/openid-configuration` to retrieve the configuration information. This MUST
  also be identical to the `iss` Claim value in ID Tokens issued from this Issuer."*
- **§2 (Issuer Discovery, WebFinger)** — *"The Issuer location MUST be returned in the
  WebFinger response as the value of the `href` member of a links array element with `rel`
  member value `http://openid.net/specs/connect/1.0/issuer`."*
- **§3 REQUIRED metadata members** — `issuer`, `authorization_endpoint`, `token_endpoint`
  (REQUIRED unless only the Implicit Flow is used), `jwks_uri`, `response_types_supported`,
  `subject_types_supported`, `id_token_signing_alg_values_supported` (**RS256 MUST be
  included**).

## Version spine for this topic

JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · **Spring Security 7.x**. No sandbox:
no HTTP transcripts, no real tokens, no real JWKS. See [[java-board]] for position and
`docs/java/pages/phase-13-oauth2-oidc/_PHASE-NOTES.md` for the phase's binding rules.
