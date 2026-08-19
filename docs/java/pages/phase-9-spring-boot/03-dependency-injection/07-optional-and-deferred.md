---
title: "Optional, plural and deferred: `ObjectProvider`"
sidebar_label: "7 · Optional and deferred"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Using
> `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — `required = false` and the fact that a non-required *method* is not called,
> `Optional<T>` injection, `@Nullable` from any package including
> `org.jspecify.annotations.Nullable`, and the list of always-resolvable
> dependencies such as `BeanFactory`, `ApplicationContext`, `Environment`) and
> *Bean Scopes* (docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html
> — `ObjectFactory`/`ObjectProvider` as the documented way to retrieve a current
> instance on demand, and `getIfAvailable`/`getIfUnique`). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Everything so far assumed the dependency exists, is unique, and should be
resolved at construction time. `ObjectProvider<T>` is the injection point that
drops all three assumptions at once — zero candidates, several candidates, or a
candidate you want to look up later rather than now — and it does so without
you touching the `ApplicationContext`. It is the reason `getBean()` should not
appear in your code: every legitimate use of a lookup has a typed injection
point that expresses it better.**

## The four ways to say "this might not be there"

```java
// 1. the setter is simply not called if no candidate exists
@Autowired(required = false)
public void setSmsSender(SmsSender sms) { this.sms = sms; }

// 2. Optional — you get an empty Optional, and the constructor still runs
InvoiceService(Optional<AuditLog> audit) { ... }

// 3. @Nullable — you get null. Framework 7 prefers JSpecify's annotation
InvoiceService(@Nullable AuditLog audit) { ... }

// 4. ObjectProvider — you get a handle and decide when and whether to resolve
InvoiceService(ObjectProvider<AuditLog> audit) { ... }
```

They differ in more than taste:

| | Zero candidates | Several candidates | Resolved when |
|---|---|---|---|
| `@Autowired(required=false)` on a **method** | method never called | still ambiguous | at startup |
| `Optional<T>` | empty `Optional` | still ambiguous | at startup |
| `@Nullable T` | `null` | still ambiguous | at startup |
| `ObjectProvider<T>` | your choice | your choice | when **you** ask |

The right-hand column is the one people miss. The first three still resolve
during context startup; only `ObjectProvider` defers.

⚠️ Note the asymmetry in row one, because it catches people: `required = false`
on a *method* means the method is not invoked at all. The docs put it plainly —
*"a non-required method will not be called if its dependency is not
available."* It does not pass you null. So if the field has no default assigned
at its declaration, you have a null that only appears in the environment where
the bean is absent. On a *field*, by contrast, the field is simply left as-is.

## `@Nullable` and JSpecify

Framework 7 moved the portfolio's null-safety to JSpecify, and the reference is
relaxed about which annotation you use at an injection point: *"You can use
`@Nullable` from any package (e.g., `org.jspecify.annotations.Nullable` from
JSpecify)."*

```java
import org.jspecify.annotations.Nullable;

InvoiceService(@Nullable AuditLog audit) {
    this.audit = audit == null ? AuditLog.noop() : audit;
}
```

Prefer JSpecify's in new code, because that is the one the framework's own
declarations use and the one static analysis will interpret consistently. Note
what the constructor does with it: converts the null into a no-op immediately.
A nullable *injection point* is fine; a nullable *field* propagates the check to
every call site.

## `ObjectProvider<T>` — the useful one

`ObjectProvider` extends `ObjectFactory` and is the documented answer to
"retrieve the current instance on demand every time it is needed — without
holding on to the instance or storing it separately."

```java
@Service
public class ReportService {

    private final ObjectProvider<ReportRenderer> renderers;

    ReportService(ObjectProvider<ReportRenderer> renderers) {
        this.renderers = renderers;
    }

    public byte[] render(Report r) {
        ReportRenderer renderer = renderers.getIfAvailable(PlainTextRenderer::new);
        return renderer.render(r);
    }
}
```

The methods that matter:

- **`getObject()`** — resolve now, throw if absent or ambiguous. Same semantics
  as a plain injection point, just deferred.
- **`getIfAvailable()`** — the instance, or `null` if there is none. The overload
  taking a `Supplier<T>` gives a default without a null check, as above.
- **`getIfUnique()`** — the instance, or `null` if there is none **or more than
  one**. This is the "only if it is unambiguous" case, and it is exactly what
  auto-configuration wants: back off silently if the application has defined two.
- **`stream()`** — every candidate, in no promised order. Zero candidates is an
  empty stream, not an error.
- **`orderedStream()`** — every candidate, honouring `Ordered`/`@Order`. This is
  the ordered-plural form, and it is the clean answer to the `Map`-has-no-order
  trap from [the previous chunk](06-collections-and-ordering.md).

### Why deferral matters

Three real reasons, and none of them is style:

1. **A prototype-scoped collaborator.** A singleton that constructor-injects a
   prototype gets exactly one instance, forever — the container resolves once.
   `ObjectProvider.getObject()` resolves per call, which is the point.
   **Topic 04 — Bean scopes and lifecycle** *(not written yet)* works this
   through, since it is a scope problem more than an injection problem.
2. **Breaking a cycle honestly.** If A needs B only occasionally,
   `ObjectProvider<B>` removes the construction-time edge, so the cycle in the
   *object graph* disappears rather than being tolerated. This is a real fix,
   unlike `@Lazy` — [next chunk](08-circular-dependencies.md).
3. **Optional infrastructure.** A library that works better when a
   `MeterRegistry` is present, and correctly when it is not, wants
   `getIfAvailable()` and not two configuration classes.

## What you should never inject instead

The docs list the dependencies always resolvable without setup — `BeanFactory`,
`ApplicationContext`, `Environment`, `ResourceLoader`,
`ApplicationEventPublisher`, `MessageSource`. They are injectable, and it is
almost always the wrong thing to do:

```java
// don't
@Autowired private ApplicationContext ctx;
var renderer = ctx.getBean(ReportRenderer.class);

// do
ReportService(ObjectProvider<ReportRenderer> renderers) { ... }
```

The `getBean` version hides the dependency from the constructor, so the class is
no longer honest about what it needs, and the test has to build a context to
supply it. `ObjectProvider` keeps the dependency in the signature — a test
passes a trivially stubbed provider — while giving you the same deferred lookup.
The legitimate uses of `ApplicationContext` are framework-facing:
publishing events (for which `ApplicationEventPublisher` is the narrower and
better injection), and infrastructure code that genuinely operates on the
container.

## Gotchas

**Symptom:** `@Autowired(required = false)` on a setter, and the field is null in one
environment with no error anywhere
**Cause:** documented behaviour — a non-required method is *not called* when the
dependency is unavailable, so the field keeps its declared value
**Fix:** assign a real default at the declaration (`private AuditLog audit =
AuditLog.noop();`) so there is no null state, or inject `ObjectProvider` and decide
explicitly

**Symptom:** `Optional<PaymentGateway>` still fails startup with an ambiguity error
**Cause:** `Optional` addresses *absence*, not *plurality* — with two candidates the
injection point is as ambiguous as it ever was
**Fix:** use `ObjectProvider.getIfUnique()` if "only when unambiguous" is the intent,
or narrow with a qualifier if one of them is meant

**Symptom:** a singleton constructor-injects a prototype bean and every call gets the
same instance
**Cause:** dependencies are resolved once, at the singleton's instantiation; the
prototype is created once and handed over
**Fix:** inject `ObjectProvider<T>` and call `getObject()` per use, which resolves each
time — the mechanism and its alternatives belong to **Topic 04 — Bean scopes and
lifecycle** *(not written yet)*

**Symptom:** an auto-configuration's default bean fights with the application's, or
backs off when it should not
**Cause:** `getIfAvailable()` was used where `getIfUnique()` was meant, or vice versa —
the two differ exactly on the several-candidates case
**Fix:** `getIfUnique()` for "use it only if there is precisely one"; `getIfAvailable()`
for "use any one if any exists"

**Symptom:** `ApplicationContext` is injected and `getBean(...)` appears in a service
**Cause:** a deferred or conditional lookup was needed and the container was the
first tool to hand
**Fix:** replace it with a typed `ObjectProvider<T>` at the same injection point; the
capability is identical and the dependency becomes visible in the constructor again

**Symptom:** `stream()` returns candidates in an order that changes between runs and a
chain misbehaves
**Cause:** `stream()` makes no ordering promise; only `orderedStream()` honours
`Ordered`/`@Order`
**Fix:** call `orderedStream()` and annotate the beans

## Interview questions

**★ Four ways to express an optional dependency. What actually distinguishes them?**
`@Autowired(required=false)`, `Optional<T>`, `@Nullable T` and
`ObjectProvider<T>`. The first three handle *absence* and all resolve at
startup; only `ObjectProvider` defers resolution to the moment you ask. They
also differ on absence semantics: on a method, `required=false` means the method
is not invoked at all, whereas `Optional` hands you an empty `Optional` and
`@Nullable` hands you null. None of the first three helps with *plurality* —
two candidates is still an ambiguity error for all of them.

**★ `getIfAvailable()` versus `getIfUnique()` — when does the difference bite?**
They agree when there are zero or one candidates and disagree when there are
several: `getIfAvailable()` will resolve one, `getIfUnique()` returns null.
`getIfUnique()` is the auto-configuration idiom — "supply a default only if the
application has not created any ambiguity here" — so a library that uses
`getIfAvailable()` where it meant `getIfUnique()` will happily pick a bean in an
application that defined two, which is precisely the situation it should have
stayed out of.

**★ Why is injecting `ApplicationContext` and calling `getBean` worse than `ObjectProvider`?**
Because it hides the dependency. The constructor no longer states what the class
needs, so a reader cannot tell and a test must build a context to satisfy an
invisible requirement. `ObjectProvider<T>` gives the identical deferred,
conditional lookup while keeping the need in the signature, where the compiler
and the test can both see it. `ApplicationContext` injection is for
infrastructure that genuinely operates on the container.

**★ How do you get a fresh instance of a prototype-scoped bean from a singleton?**
Not by injecting it directly — dependencies resolve once at the singleton's
instantiation, so you receive one prototype instance and keep it forever. The
documented approaches are an `ObjectFactory`/`ObjectProvider` injection point
whose `getObject()` you call per use, the JSR-330 `Provider<T>` equivalent with
`get()`, or method injection with `@Lookup`. `ObjectProvider` is the one to
reach for by default because it is a plain typed field with no subclassing
involved.

**★ Which `@Nullable` should you use in Framework 7, and what should the constructor do with it?**
The reference accepts `@Nullable` from any package and names JSpecify's
`org.jspecify.annotations.Nullable` explicitly; prefer that one, since Framework
7 moved the whole portfolio to JSpecify and static analysis will interpret it
consistently with the framework's own declarations. The constructor should
normalise it immediately — convert null to a no-op implementation and store a
non-null field — so that nullability stays at the boundary instead of spreading
to every call site.

**★ You need every implementation, in order, but only if any exist. What is the injection point?**
`ObjectProvider<T>` with `orderedStream()`. A plain `List<T>` would fail startup
when there are no candidates, `stream()` gives no ordering promise, and a
`Map<String,T>` has documented keys but no documented order. `orderedStream()`
is the one form that is simultaneously plural, ordered by `Ordered`/`@Order`, and
empty-tolerant.

---

← Prev: [Collections, ordering and self-injection](06-collections-and-ordering.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Circular dependencies](08-circular-dependencies.md)
