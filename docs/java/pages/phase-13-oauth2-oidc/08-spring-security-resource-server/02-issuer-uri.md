---
title: "issuer-uri is not a URL you fetch keys from — it is a claim you assert about every token plus a three-way probe for a metadata document, and confusing those two roles is why the same value works in staging and 401s in production"
sidebar_label: "02 · issuer-uri"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Specifying the Authorization Server", §"Startup Expectations",
> §"Supplying Audiences"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — **RFC 8414** §3 (Obtaining Authorization Server Metadata), §3.1 (Metadata Request),
> §3.3 (Metadata Validation)
> ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc8414)) — **RFC 9068**
> §4 (Validating JWT Access Tokens)
> ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc9068)) — and the
> Spring Security sources `JwtIssuerValidator`, `JwtClaimValidator`.
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**One property does two unrelated jobs. `issuer-uri` is the *string* that every incoming
token's `iss` claim is compared against, and it is separately the *base address* Spring
probes to discover where the signing keys live. Those two jobs fail differently — a wrong
key location fails loudly at first request, a wrong issuer string fails silently on every
token from an issuer you actually trust — and almost every "the token decodes fine but I
get 401" incident is the second one.**

## The one-line configuration, and what it commits you to

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com/issuer
```

The reference is precise about what the value means:

> *"Where `https://idp.example.com/issuer` is the value contained in the `iss` claim for
> JWT tokens that the authorization server will issue."*

Not "where the authorization server lives". Not "the base URL of the IdP". **The literal
value of the `iss` claim.** If your tokens carry `"iss": "https://idp.example.com/issuer"`
then that exact string — same scheme, same host, same case, same trailing-slash decision —
is what goes in the property.

## Job one: the discovery probe (RFC 8414 and OIDC Discovery)

The reference lists three candidate endpoints, and it is worth reading closely because the
issuer *path* is spliced into two of them differently:

> *"To use the `issuer-uri` property, it must also be true that one of
> `https://idp.example.com/issuer/.well-known/openid-configuration`,
> `https://idp.example.com/.well-known/openid-configuration/issuer`, or
> `https://idp.example.com/.well-known/oauth-authorization-server/issuer` is a supported
> endpoint for the authorization server."*

The reason for the three shapes is RFC 8414 §3:

> *"Authorization servers supporting metadata MUST make a JSON document containing metadata
> as specified in Section 2 available at a path formed by inserting a well-known URI string
> into the authorization server's issuer identifier **between the host component and the
> path component**, if any."*

That "between the host and the path" is the rule OIDC Discovery does *not* follow — OIDC
appends `/.well-known/openid-configuration` to the end of the issuer. So an issuer with a
path component (`https://idp.example.com/issuer`, or a Keycloak realm URL) has two
legitimate metadata locations depending on which specification the vendor implemented, and
Spring tries both plus the OAuth-flavoured well-known suffix.

RFC 8414 §3.1 spells the splice out with an example:

> *"The client would make the following request when the issuer identifier is
> `https://example.com/issuer1` and the well-known URI suffix is
> `oauth-authorization-server` to obtain the metadata, since the issuer identifier contains
> a path component:*
> *`GET /.well-known/oauth-authorization-server/issuer1 HTTP/1.1`"*

### The check that stops a metadata swap

RFC 8414 §3.3 is one sentence long and it is a security control, not a formality:

> *"The `issuer` value returned MUST be identical to the authorization server's issuer
> identifier value into which the well-known URI string was inserted to create the URL used
> to retrieve the metadata. If these values are not identical, the data contained in the
> response MUST NOT be used."*

Spring's `JwtDecoders.fromIssuerLocation(...)` / `NimbusJwtDecoder.withIssuerLocation(...)`
perform this comparison; a metadata document whose `issuer` field disagrees with the
address it was fetched from is rejected rather than used. Without that check, anyone who
can influence which metadata document you fetch can name their own `jwks_uri` and mint
tokens you would accept.

## Job two: the `iss` claim assertion

Configure `issuer-uri` and Boot adds a `JwtIssuerValidator` to the decoder's validator
(see `JwtDecoderConfiguration#getValidator` in the Boot sources). That validator is a thin
wrapper over `JwtClaimValidator`, and its predicate is exact string equality:

```java
// org.springframework.security.oauth2.jwt.JwtIssuerValidator, abridged
Predicate<Object> testClaimValue =
        (claimValue) -> (claimValue != null) && issuer.equals(claimValue.toString());
this.validator = new JwtClaimValidator<>(JwtClaimNames.ISS, testClaimValue);
```

Two properties of that code decide the behaviour you will debug:

1. **`equals`, not "normalise then compare".** `https://idp.example.com/issuer` and
   `https://idp.example.com/issuer/` are different issuers. So are `http` and `https`
   versions of the same host, and so are an internal service name and the public hostname.
2. **A missing claim fails.** `JwtClaimValidator.validate` returns failure when
   `token.getClaim(claim)` is `null`, so a token with no `iss` at all is rejected. That
   asymmetry — absent `iss` rejected, absent `exp` accepted — is
   **06e · Clock skew and the missing `exp`** *(not written yet)*.

RFC 9068 §4 requires exactly this behaviour of any RFC 9068 resource server:

> *"The issuer identifier for the authorization server (which is typically obtained during
> discovery) MUST exactly match the value of the `iss` claim."*

## The failure that looks like a signature problem and is not

The symptom is uniform: every request 401s, the `WWW-Authenticate` header says
`invalid_token`, and pasting the token into a decoder shows a perfectly well-formed token
with a signature that verifies. The cause is that the signature *did* verify — key
discovery worked — and then `JwtIssuerValidator` rejected the `iss` string.

The list of ways the string differs, in rough order of how often each shows up:

- **A trailing slash on one side.** Keycloak realm URLs are frequently written
  `https://sso.example.com/realms/prod/` in configuration and issued as
  `.../realms/prod`.
- **`http` in the property, `https` in the token**, because the value was copied from a
  local Docker compose file.
- **An internal DNS name** (`http://keycloak:8080/realms/prod`) configured in the resource
  server while the IdP is configured with its public hostname, so the tokens carry the
  public one. This is the classic Kubernetes version and it is genuinely confusing because
  discovery succeeds against the internal name.
- **A tenant or realm rename** that changed the issuer while the old tokens are still in
  flight.
- **A load balancer rewriting `Host`**, so the IdP computes its own issuer from the
  request and emits different `iss` values depending on the path in.

The diagnosis is always the same and takes ten seconds: decode a rejected token, read
`iss`, and compare it byte for byte with the property. If they differ, the property is
wrong — never the token.

## `issuer-uri` alone versus `issuer-uri` plus `jwk-set-uri`

Giving *both* is legal, common and changes the startup behaviour completely:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          jwk-set-uri: https://idp.example.com/.well-known/jwks.json
```

> *"Consequently, Resource Server will not ping the authorization server at startup. We
> still specify the `issuer-uri` so that Resource Server still validates the `iss` claim on
> incoming JWTs."*

That sentence is the whole design: **the two properties are separable because they do
separable jobs.** Naming the JWK set directly turns off discovery; keeping `issuer-uri`
keeps the `iss` assertion. Dropping `issuer-uri` and keeping only `jwk-set-uri` turns off
the `iss` assertion — Boot's `getValidator()` only adds a `JwtIssuerValidator` when
`getIssuerUri() != null` — and you are then accepting any token signed by a key in that
JWK set regardless of who it was issued for. On a multi-tenant IdP that is a real hole.

The trade-off between the two forms is
[02b · jwk-set-uri and static keys](02b-jwk-set-uri-and-static-keys.md); the startup-time
consequences are [03 · Startup coupling](03-startup-coupling.md).

## Gotchas

**★ A trailing slash is a different issuer.**
`JwtIssuerValidator` uses `String.equals`. There is no normalisation step, no URI
canonicalisation and no warning. Copy the `iss` claim out of a real token and paste it into
the property; do not retype it.

**★ `jwk-set-uri` without `issuer-uri` silently disables issuer validation.**
Boot only registers a `JwtIssuerValidator` when the issuer property is present. The
resource server then accepts every token signed by any key in that JWK set — including
tokens minted for a completely different tenant of the same IdP. Always configure both.

**★ Discovery succeeding proves nothing about the `iss` value.**
The probe uses the *configured* issuer as a base address and the metadata document's
`issuer` field is compared against it. Both can agree while your tokens carry something
else entirely, because the tokens are minted by a differently-configured front end of the
same IdP.

**★ `https://idp.example.com/issuer` has two legal metadata locations, and vendors pick
different ones.**
OIDC Discovery appends the well-known suffix; RFC 8414 inserts it before the path. Spring
probes both, so this normally just works — but a reverse proxy that only forwards one of
the three paths will make discovery fail in a way that looks like the IdP is down.

**★ An issuer with no path component collapses the three probes into effectively two.**
For `https://idp.example.com` (no path), `/issuer/.well-known/openid-configuration` and
`/.well-known/openid-configuration/issuer` both degenerate. That is why the
"works with a bare host, fails with a realm path" pattern exists at all.

**★ Changing the issuer is a breaking change for every token already in flight.**
Tokens minted before the change carry the old `iss` and will be rejected. Either accept
both issuers for one token lifetime — which is
**09 · Multi-tenancy** *(not written yet)*'s `fromTrustedIssuers(...)` — or accept a window
of 401s.

**★ The `iss` value is not necessarily the URL you can reach.**
Nothing requires the issuer identifier to be resolvable from inside your network. It is an
identifier that happens to look like a URL. When the two differ, configure `jwk-set-uri`
with the reachable address and keep `issuer-uri` as the identifier.

## Interview questions

**★ What are the two distinct jobs `issuer-uri` performs?**
It is the base address for the RFC 8414 / OIDC Discovery probe that finds `jwks_uri`, and
it is the expected value of the `iss` claim on every incoming token. They fail
independently: the first fails at the first request with a decode error, the second fails
with `invalid_token` on tokens that verify perfectly.

**★ Why does Spring probe three well-known URLs?**
Because OIDC Discovery and RFC 8414 disagree about where the well-known suffix goes when
the issuer identifier contains a path. RFC 8414 §3 requires it to be inserted between the
host and the path; OIDC appends it. Spring tries the OIDC form, the RFC 8414 form with the
`openid-configuration` suffix, and the RFC 8414 form with the `oauth-authorization-server`
suffix.

**★ What check does RFC 8414 §3.3 require on the metadata document, and what attack does it
stop?**
The `issuer` value inside the returned document must be identical to the issuer identifier
used to build the fetch URL, and if not, the document MUST NOT be used. Without it, an
attacker who can influence which metadata document you retrieve — a DNS answer, a
misconfigured proxy, a rogue tenant path — can point `jwks_uri` at keys they control and
mint tokens you would accept as genuine.

**★ Every request returns 401 `invalid_token` but the token verifies in a decoder. Where do
you look first?**
The `iss` claim against the configured `issuer-uri`, compared character by character.
Signature verification succeeded, so key discovery worked; the next validator in the chain
is the issuer check and it uses exact string equality. Trailing slashes, `http` versus
`https`, and internal versus public hostnames account for nearly all of these.

**★ Is it safe to configure only `jwk-set-uri`?**
No, not without a compensating control. Boot only adds `JwtIssuerValidator` when
`issuer-uri` is set, so a JWK-set-only configuration verifies that the token was signed by
that key set and nothing else. On a shared or multi-tenant authorization server, every
tenant's tokens are signed by keys in the same set, so you have removed the only thing
distinguishing them. Configure both, and add an audience check on top —
**06c · Audience** *(not written yet)*.

**★ Your IdP is reachable internally as `http://keycloak:8080/realms/prod` but issues
tokens with `iss: https://sso.example.com/realms/prod`. How do you configure this?**
`issuer-uri: https://sso.example.com/realms/prod` — because that is the claim value you
must assert — and `jwk-set-uri: http://keycloak:8080/realms/prod/protocol/openid-connect/certs`
for the reachable key endpoint. Setting `issuer-uri` to the internal address makes
discovery work and every real token fail.

---

← [What the starter gives you](01-what-the-starter-gives-you.md) · [Topic index](README.md) · Next → [jwk-set-uri and static keys](02b-jwk-set-uri-and-static-keys.md)
