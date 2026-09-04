---
title: "Security in the document, and in front of the document"
sidebar_label: "8 · Security and lockdown"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the springdoc-openapi FAQ
> (springdoc.org/faq.html — the JWT bearer `SecurityScheme` bean and
> `@SecurityRequirement`), the springdoc README sections *Adding API Information
> and Security documentation*, *Using a separate management port* and *When
> Spring Security is enabled*, springdoc.org/properties.html for
> `springdoc.api-docs.enabled`, `springdoc.swagger-ui.enabled`,
> `springdoc.use-management-port`, `springdoc.show-actuator` and
> `springdoc.show-login-endpoint`, the `swagger-annotations-jakarta` 2.2.52
> security annotations, and the OpenAPI Specification v3.1.1 Security Scheme
> Object. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Two completely separate problems share a word here, and conflating them is how
services end up with a browsable, executable console of every internal endpoint
on the public internet. The first problem is *describing* authentication, so a
generated client and a UI know to send a bearer token — that is a documentation
task and it is easy. The second is deciding who may read `/v3/api-docs` and who
may load Swagger UI *at all* — that is a security task, it is not solved by any
annotation, and it is the same class of mistake as leaving Actuator's endpoints
exposed.**

## Describing the scheme

An OpenAPI Security Scheme Object names a way of authenticating; a Security
Requirement says which scheme applies where. For the stateless JWT resource
server [topic 11 builds](../11-spring-security/09-jwt-resource-server.md), the
scheme is HTTP bearer:

```java
@Configuration
class OpenApiSecurityConfig {
    @Bean
    OpenAPI api() {
        return new OpenAPI()
            .components(new Components()
                .addSecuritySchemes("bearer-jwt", new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")))
            .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }
}
```

`addSecurityItem` at the document level says *every* operation requires it,
which is the right default for an API where anonymous access is the exception.
Individual operations then opt out or narrow it:

```java
@Operation(summary = "Health of the ordering domain",
           security = {})                      // explicitly anonymous
@GetMapping("/status")
public StatusResponse status() { ... }
```

Or, per operation, opt *in* — if you left the document-level requirement off:

```java
@Operation(security = @SecurityRequirement(name = "bearer-jwt"))
```

The annotation-only equivalent of the bean, which the springdoc README
recommends placing on a Spring-managed bean rather than anywhere reachable only
by scanning:

```java
@Configuration
@SecurityScheme(name = "bearer-jwt", type = SecuritySchemeType.HTTP,
                scheme = "bearer", bearerFormat = "JWT")
class OpenApiSecurityConfig { }
```

For an OAuth2 authorisation-code flow the same object takes
`SecuritySchemeType.OAUTH2` with `@OAuthFlows`/`@OAuthFlow`, and Swagger UI can
then run the flow itself — which is genuinely useful in a development
environment and is one more reason the UI does not belong in production.

⚠️ **`bearerFormat` is documentation, not enforcement.** The specification
describes it as a hint about the bearer token's format; nothing validates it.
The scheme description exists so a client knows *which header to send* — the
verification is entirely
[topic 11's resource-server configuration](../11-spring-security/09-jwt-resource-server.md).

## Making the docs reachable when Spring Security is on

Add a security filter chain and `/v3/api-docs` becomes a `401` — including for
the Swagger UI page, which fetches it over XHR and shows an empty console. The
springdoc README's own answer is to permit the doc paths explicitly:

```java
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/v3/api-docs/**", "/v3/api-docs.yaml",
                             "/swagger-ui/**", "/swagger-ui.html").permitAll()
            .anyRequest().authenticated());
    return http.build();
}
```

🔴 **Read that snippet as what it is: a development convenience that permits
anonymous access to a complete description of your API.** It is the right
starting point on a laptop and the wrong thing to promote unchanged. Four paths
are listed because the UI needs all four — the HTML entry point, the webjar
resources under `/swagger-ui/`, the JSON, and the YAML. Permitting only
`/swagger-ui.html` produces a page that loads and then displays nothing, which
is a confusing failure worth recognising.

The matcher mechanics — ordering, multiple chains, and why a separate chain is
often cleaner than one `permitAll` in the main one — are
[topic 11's subject](../11-spring-security/06-matchers-and-multiple-chains.md).

## `@Hidden` — the honest omission, and the false control

An operation can be kept out of the document altogether. That is a legitimate
thing to want — an internal maintenance endpoint has no business in a published
contract — and it is the point at which people reach for the wrong tool.

```java
@Hidden
@PostMapping("/internal/reindex")
public void reindex() { ... }
```

`@Hidden` works on a method, a class, a parameter and a field. It removes the
element from the document.

🔴 **It is a documentation decision, never a security control.** A hidden
endpoint is still routed, still reachable and still needs authorisation. Treating
`@Hidden` as protection is the same category error as relying on an unlinked
URL. The real control is an authorisation rule, and this chunk's remaining
sections are about making that decision rather than labelling around it —
[topic 11 owns the mechanism](../11-spring-security/README.md).

## Production: the actual decision

There is no universally right answer, but there is a wrong one, which is
"whatever the starter does by default". Both `springdoc.api-docs.enabled` and
`springdoc.swagger-ui.enabled` default to `true`, so a service that has thought
about nothing publishes an executable console of every endpoint it has.

The options, roughly in increasing order of how much you trust your network:

| Option | How | When it is right |
|---|---|---|
| **Do not ship it at all** | use `springdoc-openapi-starter-webmvc-api`, or scope the whole dependency to a non-production profile | a public-facing service whose consumers get the document from a registry or a package, not from the running app |
| **Document yes, UI no** | `springdoc.swagger-ui.enabled=false` | the document is fetched by tooling; humans read it elsewhere |
| **Neither, in production** | `springdoc.api-docs.enabled=false` and `springdoc.swagger-ui.enabled=false` under the production profile | the document is published from CI (chunk 9), so the running app never needs to serve it |
| **Behind authentication** | require an authority on the doc paths instead of `permitAll` | internal platform where engineers use the console against real environments |
| **On the management port** | `springdoc.use-management-port=true` | the management port is already on a private network — the same reasoning Actuator uses |

Profile-scoped, which is the shape most services want:

```yaml
# application-prod.yaml
springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false
```

🔴 **A property is a weaker control than a missing dependency.** Any property can
be overridden by an environment variable, and the precedence rules that make
that convenient — [topic 06's subject](../06-configuration-and-profiles/01-the-environment-and-precedence.md)
— are exactly what makes it a risk. If the console must not exist in production,
the strongest expression of that is `springdoc-openapi-starter-webmvc-api` with
no UI webjar on the classpath, or the dependency absent from the production
build entirely.

**[Topic 13 — Actuator](../13-actuator/README.md)** makes the identical argument about
management endpoints, and the two decisions should be made together and written
down together: they are the same question — *what does this service expose about
itself, to whom* — asked twice.

## Two smaller exposure switches

- **`springdoc.show-actuator`** defaults to `false`, so Actuator endpoints are
  not in the document. Turning it on merges your operational surface into your
  public contract. There is a legitimate use — an internal platform document —
  and it should be a deliberate choice, never left on.
- **`springdoc.show-login-endpoint`** defaults to `false`, and exists to make
  Spring Security's login endpoint visible. Same reasoning.

## Gotchas

**⚠️ Swagger UI loads but the console is empty**
**Symptom:** the page renders, the operation list does not.
**Cause:** the HTML was permitted but `/v3/api-docs` was not, so the XHR that
fetches the document returns `401`.
**Fix:** permit all four paths, as in the snippet above — or, better, put them
in their own filter chain so the intent is visible.

**⚠️ Shipping the `permitAll` snippet to production**
**Symptom:** an anonymous, complete description of the API — including internal
endpoints — is publicly readable.
**Cause:** a development convenience promoted without review.
**Fix:** decide per environment. Disable it, require an authority, or move it to
the management port.

**⚠️ `@Hidden` used to hide something sensitive**
**Symptom:** an "internal" endpoint is called by someone who read the access log.
**Cause:** confusing absence from the document with absence from the routing
table.
**Fix:** secure it. `@Hidden` may still be right *as well* — but it is never the
control.

**⚠️ Treating the security scheme as a security control**
**Symptom:** an endpoint documented with `@SecurityRequirement` that is in fact
reachable anonymously.
**Cause:** `@SecurityRequirement` describes; it does not authorise.
**Fix:** the authorisation rule, in the filter chain or via method security —
[topic 11 covers the choice between them](../11-spring-security/08-method-vs-url-security.md).
The annotation is then a true statement rather than an aspiration.

**⚠️ "Try it out" against production**
**Symptom:** somebody cancels a real order from the docs page.
**Cause:** the console executes requests; it is not a viewer.
**Fix:** do not serve the UI in production. `springdoc.swagger-ui.tryItOutEnabled`
defaults to `false`, which controls whether the section is *expanded* by
default — it is a convenience, not a guard.

**⚠️ The UI hosted on a different origin than the API**
**Symptom:** the console loads, every request fails in the browser with a CORS
error.
**Cause:** a centrally-hosted Swagger UI pointed at your service is a
cross-origin caller like any other.
**Fix:** the same CORS configuration an SPA needs —
[topic 11's CORS chunk](../11-spring-security/12-cors-for-an-spa.md). Serving the
bundled UI from the same origin avoids the problem entirely, which is the usual
reason to prefer it.

**⚠️ Documenting a scheme the service does not implement**
**Symptom:** the document advertises OAuth2 flows; the service validates a
static API key.
**Cause:** the `OpenAPI` bean was copied from an example.
**Fix:** describe what the resource server actually accepts. A wrong security
description is worse than none — it sends every consumer down a working-looking
path that fails at the first request.

## Interview questions

**★ How do you document that your API needs a JWT?**
Register an HTTP bearer security scheme — `SecurityScheme.Type.HTTP`, scheme
`bearer`, `bearerFormat("JWT")` — in `components.securitySchemes`, and apply it
either document-wide with `addSecurityItem` or per operation with
`@SecurityRequirement`. That tells clients and the UI to send an
`Authorization: Bearer …` header. It tells the server nothing; verification is
the resource-server configuration, entirely separate.

**★ Should Swagger UI be available in production?**
Usually no. It is an executable console over every documented endpoint, and if
it is anonymous it is also a complete map of your API for anyone scanning. The
defensible positions are: disable it in the production profile; put it behind
authentication; or move it to the management port on a private network. The
strongest is to not put the UI on the classpath at all in the production build —
a missing dependency cannot be re-enabled by an environment variable.

**★ Adding Spring Security broke the docs page. Why, and what is the fix?**
Because `/v3/api-docs` is an ordinary application endpoint and `anyRequest().authenticated()`
covers it. The UI fetches the document over XHR, so the page renders and the
console stays empty — which looks like a springdoc bug and is not. The fix is to
permit the four doc paths, ideally in their own filter chain, and then to decide
separately what that permission should be outside development.

**★ Is `@Hidden` or a security scheme enough to protect an internal endpoint?**
Neither is any protection at all. `@Hidden` removes an operation from the
document while leaving it routed and reachable; a security scheme describes how
a caller should authenticate without causing anything to check that they did.
Both are honest labels on top of a control that has to exist independently in
the filter chain or in method security.

**★ How is this the same problem as Actuator exposure?**
Both are "what does this service reveal about itself, and to whom". Actuator
exposes operational internals; springdoc exposes the shape of the API and,
with the UI, the ability to call it. Both default to something convenient, both
are configured by properties an environment variable can flip, and both should
be decided once per environment and written down. Deciding them separately is
how one gets locked down and the other does not.

**★ Your document is published from CI. Does the running service still need `/v3/api-docs`?**
Usually not, and that is the cleanest position: the consumers' source of truth
is the published artifact, versioned alongside the release, and the running
service serves no document at all. It also removes the temptation to treat
"whatever production is currently returning" as the contract, which is exactly
the thing a contract is supposed to be independent of.

---

← Prev: [Documenting the failures](07-documenting-the-failures.md) · Index: [OpenAPI with springdoc](README.md) · Next → [Capturing the document](09-capturing-the-document.md)
