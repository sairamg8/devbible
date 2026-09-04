---
title: "Designing the exceptions and choosing the status"
sidebar_label: "11 · Mapping domain exceptions"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference *Error Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
> for the mapping mechanics, with status-code semantics taken from **RFC 9110**
> (HTTP Semantics) — 404 §15.5.5, 409 §15.5.10, 422 §15.5.21, 429 per RFC 6585
> and 503 §15.6.4. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**The machinery is settled by this point. What is left is the part no framework
can decide for you: how many exception types your domain should have, and which
status each one deserves. Both answers are design, not configuration — and the
failure mode that actually hurts is not picking a slightly wrong status, it is
two endpoints disagreeing about the same condition.**

## How many exception types? Three shapes

**Shape A — a small hierarchy, one type per HTTP outcome.**

```java
public abstract class DomainException extends RuntimeException { }

public class NotFoundException      extends DomainException { }   // → 404
public class ConflictException      extends DomainException { }   // → 409
public class RuleViolationException extends DomainException { }   // → 422
public class ForbiddenException     extends DomainException { }   // → 403
```

Four handlers and you are done. The mapping is obvious, a new failure means
picking an existing type, and the advice never changes again.

⚠️ **The cost is real and not obvious at first.** The type names were chosen
from HTTP vocabulary, so the domain has been re-described in HTTP terms.
`RuleViolationException` tells a reader nothing about *which* rule, so the domain
now leans on the `detail` string to say anything at all — and a non-HTTP caller
(a job, a consumer, a test) cannot branch on the failure kind, because there is
only one kind.

**Shape B — a domain vocabulary, one type per business failure.**

```java
public class OrderNotFoundException       extends DomainException { }
public class CustomerNotFoundException    extends DomainException { }
public class InsufficientStockException   extends DomainException { }
public class PaymentDeclinedException     extends DomainException { }
public class OrderAlreadyShippedException extends DomainException { }
```

Reads as the domain, is catchable precisely by any caller, and each type maps to
exactly one problem `type` URI — which means the two vocabularies stay in step
instead of drifting. The cost is a handler per type, and that cost is mostly
recoverable: a marker base class plus one handler over it, or the
[`ErrorResponse` route](08-errorresponse.md) if the family is genuinely an HTTP
concern.

**Shape C — one exception carrying a code.**

```java
public class BusinessException extends RuntimeException {
    private final ErrorCode code;         // enum: ORDER_NOT_FOUND, STOCK_LOW, …
}
```

Tempting, and usually a mistake. `catch (BusinessException e)` cannot express
"catch only stock problems" without an `if` on the code, so dispatch has moved
out of the type system and into a switch — the thing
[polymorphism](../../phase-2-classes-objects/04-polymorphism-dispatch/README.md)
exists to remove. It is defensible when the codes are genuinely *data*: loaded
from configuration, or mirrored from an upstream system's error catalogue that
you do not own. It is not defensible when the enum is a fixed list a developer
maintains, because then it is a class hierarchy written in the wrong language
feature.

**Recommendation: shape B with a marker base class.** It is the only shape where
the exception type carries the same information as the problem `type` URI, which
makes the mapping a one-liner and keeps the domain readable.

## The status table, with the reasoning

| Status | Means | Use it when | Do **not** use it when |
|---|---|---|---|
| **400** | Malformed request | The request could not be understood: unparseable JSON, a path variable that is not an integer, a missing required parameter | The syntax was fine and a *rule* failed |
| **401** | Unauthenticated | No credentials, or invalid ones | The caller is known and simply not allowed — that is 403 |
| **403** | Authenticated, not permitted | Identity established, authorisation denied | You would rather not reveal the resource exists — then consider 404 |
| **404** | No such resource | The **addressed** resource does not exist, or exists and must be hidden | Something *inside* the request body referred to a missing thing |
| **405** | Wrong method | Spring raises this itself, with `Allow` | — |
| **409** | Conflict with current state | Valid request, conflicting resource state: already shipped, version mismatch, duplicate unique key | The state is fine and a business rule simply says no |
| **415** | Unsupported media type | Spring raises this itself | — |
| **422** | Well-formed, semantically wrong | Syntax parsed, types right, and a **rule** rejected it: insufficient stock, inverted date range, failing checksum | The body could not be parsed at all — that is 400 |
| **429** | Too many requests | Rate limited. Always with `Retry-After` | — |
| **500** | We broke | An unexpected failure in your own code | The client could have avoided it — then it is a 4xx |
| **502 / 504** | Upstream failed / timed out | A dependency you call returned garbage or did not answer | The dependency correctly rejected *your* bad request — that is your 500 |
| **503** | Temporarily unavailable | A dependency is down, or you are shedding load. With `Retry-After` when known | The failure is permanent |

## The three distinctions that cause the arguments

### 404 vs 422, when the missing thing is in the body

`POST /orders` with `{"customerId": "does-not-exist"}`.

The **resource you addressed** — `/orders` — exists; you are creating on it.
What is missing is referenced *inside* the body. That is a **422**: the request
was well-formed and a semantic rule (the customer must exist) rejected it.

Returning 404 here is actively harmful, not merely imprecise. Client libraries
and gateways treat 404 as "this endpoint is gone" and will do things like drop
it from a service registry, disable a retry, or surface "not found" for the
whole operation. Naming the offending field in an extension member is the useful
part; the status should say "I understood you and refused".

### 400 vs 422, stated once

**400** = *I could not understand the request.*
**422** = *I understood it perfectly and I am refusing it.*

Parse errors, type errors and missing required fields are 400. Cross-field
rules, business invariants and referential checks are 422. The test that settles
most cases: **could a schema validator alone have caught this?** If yes, 400. If
it needed to consult your database or a domain rule, 422.

⚠️ Some teams use 400 for everything client-caused, on the grounds that 422
originated in WebDAV and older clients handle it inconsistently. That is a
legitimate position, and it is only legitimate if you **decide it once for the
whole API and write it down**. The damage is never "wrong status"; it is two
endpoints disagreeing.

### 409 vs 422

Both mean "understood and refused". The split:

- **409 is about the state of the addressed resource** — you cannot cancel an
  order that has shipped; you sent a stale `If-Match`.
- **422 is about the content of the request** — the quantity you asked for
  exceeds available stock.

The rule of thumb that resolves nearly every case: **if the client could succeed
by retrying later without changing anything, it is 409; if it must change the
request, it is 422.** Optimistic-locking failures are the cleanest 409 there is,
because a retry with a fresh version is exactly the remedy.

### 403 vs 404, the deliberate lie

Returning 404 for a resource that exists but the caller may not see is a
recognised pattern: a 403 confirms existence, which is itself information. It is
right for anything where enumeration is an attack (user accounts, private
repositories, tenant data) and wrong where it merely confuses a legitimate user
who has the wrong role. The
[404-versus-403 argument](../07-rest-controllers/07-the-response.md) is made in
full alongside the other status choices in topic 07; the point to carry here is
that it must be a **decision**, applied consistently, not an accident of which
exception got thrown first.

## The trade-off

A precise status table lets clients react correctly without parsing prose, and
it costs a decision per exception plus the discipline to keep those decisions
consistent as the API grows. The realistic failure is drift: six months in,
"referenced entity missing" is 404 in the orders module and 422 in the
subscriptions module, because two people each made a reasonable call. The
mitigation is cheap — one test per exception type pinning the status makes drift
a build failure instead of a support ticket.

## Gotchas

**Symptom** — a `POST` referencing a nonexistent id returns 404 and the client
reports "endpoint not found".
**Cause** — 404 used for an entity referenced inside the body.
**Fix** — 422, with the offending field named in an extension member. Reserve
404 for the addressed resource.

**Symptom** — the same "not found" condition is 404 on one endpoint and 422 on
another.
**Cause** — no written table; two developers each made a defensible call.
**Fix** — write the table down and assert it. A test per exception type that
pins the status turns drift into a failing build.

**Symptom** — a business rule failure comes back as 500.
**Cause** — the exception has no handler and fell through to the catch-all.
**Fix** — give the domain family a base class and one handler over it, so a new
subtype gets a sensible status by default:
```java
@ExceptionHandler
ProblemDetail handle(DomainException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
}
```
Specific subtypes then override it individually.

**Symptom** — a 429 is returned and clients hammer the service harder.
**Cause** — no `Retry-After` header, so every client retries on its own schedule,
usually immediately.
**Fix** — always send `Retry-After` with a 429 or a 503; it is the only part of
the response a well-behaved client can act on mechanically.

**Symptom** — an exception hierarchy named after statuses makes the service code
read like HTTP.
**Cause** — shape A.
**Fix** — rename to the domain (`OrderAlreadyShippedException`) and keep the
status in the advice. The advice is allowed to know HTTP; the domain is not.

**Symptom** — adding a new business failure requires editing the advice, and
somebody forgets.
**Cause** — shape B with no base class, so an unmapped subtype falls to the
catch-all and becomes a 500.
**Fix** — the marker base class above. A new subtype inherits a sensible status
until someone gives it a specific one.

## Interview questions

**★ How many exception types should a domain have?**
Enough that the type *names the failure* — `InsufficientStockException`, not
`ConflictException`. Naming exceptions after HTTP statuses re-describes the
domain in HTTP terms and leaves non-web callers with nothing to branch on. A
shared marker base class keeps the advice small without collapsing the
vocabulary.

**★ 400 or 422?**
400 means the request could not be understood: parse failures, type errors,
missing required fields — anything a schema validator alone would catch. 422
means it was understood and refused by a rule that needed domain knowledge.
Either convention survives; inconsistency between endpoints does not.

**★ 409 or 422?**
409 is a conflict with the current state of the addressed resource; 422 is a
problem with the content of the request. The deciding test: if retrying later
unchanged could succeed, 409; if the client must change the request, 422.

**★ A POST body references a customer id that does not exist. What status, and
why not 404?**
422. The addressed resource `/orders` exists and a semantic rule about the body
failed. 404 tells the client the *endpoint* is gone, and generic client and
gateway behaviour acts on that — dropping retries, marking the route dead.

**★ When is returning 404 instead of 403 the right call?**
When confirming existence is itself a disclosure — user accounts, private
repositories, other tenants' data. It has to be a deliberate, consistent policy,
because applying it in one place and 403 in another leaks exactly the
information the 404 was meant to hide.

**★ Why is one exception type with an error-code enum usually a bad shape?**
Because it moves dispatch from the type system into a conditional: no caller can
`catch` a specific failure without inspecting the code. It is reasonable only
when the codes are genuinely data — configuration-driven or mirrored from an
upstream catalogue — rather than a fixed list you maintain, which is a class
hierarchy expressed in the wrong construct.

---

← Prev: [ResponseEntityExceptionHandler](10-responseentityexceptionhandler.md) · Index: [Error handling](README.md) · Next → [Validation and foreign exceptions](12-validation-and-foreign-exceptions.md)
