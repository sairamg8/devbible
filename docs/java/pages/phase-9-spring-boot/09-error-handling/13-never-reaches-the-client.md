---
title: "What must never reach the client"
sidebar_label: "13 · Never reaches the client"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference — *Servlet Web
> Applications · Error Handling*
> (docs.spring.io/spring-boot/reference/web/servlet.html — the `/error`
> mapping, the whitelabel view, `ErrorAttributes`) — and the **Spring Boot 4.0
> Configuration Changelog** (GitHub wiki), which records the 4.0 renames
> `server.error.include-stacktrace` → `spring.web.error.include-stacktrace`,
> and likewise for `include-message`, `include-binding-errors`,
> `include-exception`, `include-path`, `server.error.path` and
> `server.error.whitelabel.enabled`. Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**An error response is the one place where a service, under stress, volunteers
information about its own internals to an anonymous caller. Stack traces, SQL,
hostnames and bean names in an error body are not untidiness — they are
reconnaissance, delivered on request.**

## The list, and what each item gives away

| Leaked | What it tells an attacker |
|---|---|
| **Stack trace** | Your framework and library versions, your package structure, your application server — enough to look up published CVEs against your exact stack |
| **SQL or a constraint name** | Table and column names, the schema's shape, and often enough structure to aim an injection attempt at the right columns |
| **Internal hostnames or IPs** | Your topology: service names, ports, whether you sit behind a proxy, which internal host answered |
| **Bean or class names** | Your architecture, and whether a known-vulnerable component is present |
| **File-system paths** | Deployment layout, OS, user, sometimes the build machine's directory structure |
| **The rejected value** | Whatever the client sent — including the password, token or card number they sent by mistake, now in your error body *and* your log aggregator |
| **Upstream error text** | Your dependencies, their versions, and occasionally credentials embedded in a URL |
| **Timing differences** | Whether an account exists, when "not found" returns fast and "wrong password" is slow |

⚠️ **The one people forget is the rejected value.** It feels like the opposite of
a leak — you are only echoing what the client sent. But a `password` field bound
into a DTO and rejected by `@Size` becomes a `rejectedValue` in the error body,
which is then logged by every client that logs failed responses, and shipped
into your own centralised logging. Echo values only for fields you have
explicitly classified as safe.

## The properties, with their Boot 4 names

🔴 **These keys moved in Boot 4.** Every article, book and answer online still
shows the `server.error.*` form; the 4.0 Configuration Changelog records them
all under `spring.web.error.*`.

| Boot 4 key | Values | Safe setting |
|---|---|---|
| `spring.web.error.include-stacktrace` | `never`, `always`, `on-param` | **`never`** — in every environment |
| `spring.web.error.include-message` | `never`, `always`, `on-param` | **`never`** in production |
| `spring.web.error.include-binding-errors` | `never`, `always`, `on-param` | **`never`** — emit your own structured `errors` member instead |
| `spring.web.error.include-exception` | `true` / `false` | **`false`** — this is the exception *class name* |
| `spring.web.error.include-path` | `never`, `always`, `on-param` | `always` is fine; the client already knows the path |
| `spring.web.error.path` | a path | Leave at `/error` unless you have a reason |
| `spring.web.error.whitelabel.enabled` | `true` / `false` | **`false`** for a pure API |

```yaml
spring:
  web:
    error:
      include-stacktrace: never
      include-message: never
      include-binding-errors: never
      include-exception: false
      whitelabel:
        enabled: false
```

🔴 **`on-param` deserves its own warning.** It means "include this when the
request carries the corresponding query parameter" — so anyone appending
`?trace=true` gets a stack trace. It is a debugging convenience that is, from
outside, indistinguishable from a deliberate information-disclosure endpoint,
and it is routinely left switched on after a debugging session.

⚠️ **Put these in the base configuration, not in a production profile.** A
setting that lives only in `application-prod.yml` is a setting that is missing
the day someone runs with a profile nobody thought about. Safe in the base,
loosened deliberately in `application-local.yml` — never the other way round.
Profile precedence is [in the configuration topic](../06-configuration-and-profiles/01-the-environment-and-precedence.md).

## The properties are a seatbelt, not the design

**These settings govern Boot's `/error` fallback body.** Once a
`@RestControllerAdvice` produces every response, they only matter for what falls
through to `/error` at all. A handler that puts `ex.getMessage()` into `detail`
leaks exactly as much with `include-message: never` set.

So the real control is in the handler, and it splits by **ownership**:

```java
// Your exceptions: the message is yours, written for a client audience.
@ExceptionHandler
ProblemDetail handle(DomainException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
}

// Everything else: a fixed string in the body, the real detail only in the log.
@ExceptionHandler
ProblemDetail handle(Exception ex, HttpServletRequest request) {
    String correlationId = (String) request.getAttribute(CorrelationIdFilter.ATTRIBUTE);
    log.error("Unhandled exception [correlationId={}]", correlationId, ex);   // full trace, server side

    ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Quote the correlation id when contacting support.");
    pd.setType(URI.create("https://api.example.com/problems/internal-error"));
    pd.setTitle("Internal server error");
    pd.setProperty("correlationId", correlationId);
    return pd;
}
```

**Two handlers, two policies.** For your own exceptions `getMessage()` is fine —
that is precisely the argument for domain exceptions carrying good messages. For
anything else the message was written by a library and can contain a SQL
statement, a JDBC URL with credentials, a file path or a hostname.

That correlation id is what makes the silence tolerable, and it is
[chunk 14](14-correlation-ids-and-logging.md).

## Where the leak usually gets in

Four routes, in rough order of frequency:

1. **`ex.getMessage()` in a catch-all handler.** The single most common one, and
   it looks helpful in review.
2. **A `detail` built by string-concatenating a framework message** —
   `"Could not save: " + ex.getMessage()` is the same leak with a prefix.
3. **`rejectedValue` in a validation body.**
4. **A `500` that is not really yours** — an upstream client exception whose
   message carries the upstream URL, headers or credentials.

None of them is caught by configuration. All four are caught by a review rule:
**no framework-authored string is ever assigned to a client-visible field.**

## The trade-off

Every measure here removes information that was genuinely useful to somebody —
your own frontend team, an integrator debugging at 2am. Hiding detail without
providing a joinable identifier makes a service *undebuggable*, which is its own
failure mode and produces support tickets nobody can close. The correlation id
is what converts "we tell you nothing" into "we tell you nothing here, and
everything to whoever you ask", and it is not optional if you take this chunk
seriously.

## Gotchas

**Symptom** — a stack trace appears in production error bodies.
**Cause** — `include-stacktrace: on-param` plus a client appending `?trace=true`,
or an `always` that shipped in a profile.
**Fix** — `never` in the base configuration, so no profile can be missing the
override.

**Symptom** — the property has no effect at all.
**Cause** — 🔴 it was written as `server.error.include-stacktrace`, the Boot 3
name. An unrecognised configuration property is not an error.
**Fix** — use `spring.web.error.*`, and keep
`spring-boot-configuration-processor` in the build so your IDE flags unknown
keys.

**Symptom** — errors look clean and the logs contain card numbers.
**Cause** — the request body, or a `rejectedValue`, is being logged.
**Fix** — log field *names* and constraint messages, never values; mask
known-sensitive fields on the way in.

**Symptom** — a constraint name like `uk_orders_customer_ref` appears in a 409's
`detail`.
**Cause** — `ex.getMessage()` from a driver exception was used as the detail.
**Fix** — a fixed detail string for exceptions you do not own.

**Symptom** — a 415's `detail` lists every media type the server supports.
**Cause** — that is Spring's own default detail for
`HttpMediaTypeNotSupportedException`, and it is genuinely useful.
**Fix** — usually none needed; this is a case where the disclosure is
intentional and helpful. Worth naming so that a blanket "no framework messages"
rule does not get applied where it costs you nothing to be helpful.

**Symptom** — one endpoint's 404 is measurably slower than another's, and it
reveals which accounts exist.
**Cause** — "not found" short-circuits while "wrong credentials" runs a password
hash.
**Fix** — a timing concern, not a body concern, and the reason authentication
failures should take a uniform code path. Not solvable in an advice.

**Symptom** — the whitelabel HTML page is served to an API client.
**Cause** — content negotiation on `/error`; `BasicErrorController` handles
`text/html` specially.
**Fix** — `spring.web.error.whitelabel.enabled: false` for a pure API.

## Interview questions

**★ Why is a stack trace in an error response a security problem rather than
just untidy?**
It names your framework and library versions, your package structure and often
the application server, which turns "find a vulnerability here" into "look up
published CVEs for these exact versions". It also exposes internal class and
method names that make further probing much cheaper.

**★ Which Boot properties control this, and what changed in Boot 4?**
`include-stacktrace`, `include-message`, `include-binding-errors`,
`include-exception`, `include-path`, `path` and `whitelabel.enabled` — all moved
from `server.error.*` to **`spring.web.error.*`** in Boot 4. Because an
unrecognised property is silently ignored, configuration copied from a Boot 3
source has no effect whatsoever, and nothing warns you.

**★ What is `on-param` and why is it dangerous?**
It includes the item when the request carries the matching query parameter, so
`?trace=true` returns a stack trace. From outside it is indistinguishable from a
deliberate disclosure endpoint, and it survives debugging sessions.

**★ Do those properties protect you once you have a `@ControllerAdvice`?**
Barely. They govern Boot's `/error` fallback. A handler assigning
`ex.getMessage()` to `detail` leaks just as much with `include-message: never`.
The properties are the seatbelt for what falls through; the decision lives in
the handler.

**★ Is `ex.getMessage()` ever safe in a response body?**
For your own exceptions, yes — you wrote those messages, and writing them for a
client audience is part of designing the exception. For framework, driver and
third-party exceptions, no: the text is written by someone else and can carry
SQL, a JDBC URL with credentials, a path or an internal hostname.

**★ Why should the safe settings live in the base configuration rather than the
production profile?**
Because a setting that exists only under `prod` is missing the moment something
runs under a profile nobody planned — a migration job, a smoke-test environment,
a developer's `docker compose`. Safe by default, loosened explicitly and
locally, is the only arrangement that fails closed.

---

← Prev: [Validation and foreign exceptions](12-validation-and-foreign-exceptions.md) · Index: [Error handling](README.md) · Next → [Correlation ids and logging](14-correlation-ids-and-logging.md)
