---
title: "The stereotype annotations"
sidebar_label: "6 · The stereotypes"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *The IoC
> Container → Classpath Scanning and Managed Components*
> (docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html
> — the stereotype annotations, `@Repository` exception translation,
> meta-annotation composition and `@AliasFor` for custom stereotypes), and the
> Framework 7.0 reference on `PersistenceExceptionTranslationPostProcessor`
> and the `DataAccessException` hierarchy.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`@Service`, `@Repository` and `@Controller` are all meta-annotated with
`@Component`, and to the scanner they are interchangeable — which leads almost
everyone to conclude they are decorative labels you pick by vibe. That is wrong
in one specific and expensive way: `@Repository` changes behaviour. It switches
on persistence exception translation, converting vendor-specific database
exceptions into Spring's `DataAccessException` hierarchy. The others really are
semantic markers — but they are markers that pointcuts, filters and tooling
match on, so choosing them carelessly still costs you later.**

## The family, and what each one really does

| Annotation | Registers a bean | Additional behaviour |
|---|---|---|
| `@Component` | ✅ | none — the generic stereotype |
| `@Service` | ✅ | none functionally; marks the business layer |
| `@Repository` | ✅ | **exception translation** — real behaviour |
| `@Controller` | ✅ | makes the class a handler for `RequestMappingHandlerMapping` |
| `@Configuration` | ✅ | full/lite `@Bean` processing — see [chunk 9](09-configuration-classes.md) |

`@RestController` is `@Controller` + `@ResponseBody`. `@SpringBootApplication`
is `@SpringBootConfiguration` (itself a `@Configuration`) +
`@EnableAutoConfiguration` + `@ComponentScan`.

### `@Repository` is the one that does something

The reference documentation states it directly: among the uses of the
`@Repository` marker is **the automatic translation of exceptions**. A
`PersistenceExceptionTranslationPostProcessor` — a `BeanPostProcessor`, as
[chunk 4](04-instantiation-and-post-processors.md) would predict — proxies
`@Repository` beans and converts what the persistence layer throws into
Spring's `DataAccessException` hierarchy.

Why that matters: a raw JDBC unique-constraint violation is a
`SQLException` with a vendor-specific `SQLState` and error code. Hibernate
throws something else again. Translation gives you one portable hierarchy:

```java
@Repository                                     // ✅ not decoration
class JdbcOrderRepository implements OrderRepository {

    public void save(Order order) {
        try {
            jdbc.update("insert into orders(...) values (...)", ...);
        } catch (DuplicateKeyException e) {      // ✅ portable, not vendor-specific
            throw new OrderAlreadyExists(order.id(), e);
        }
    }
}
```

`DuplicateKeyException` is a `DataAccessException` subtype, and it is unchecked
— which is the deliberate design argued in
[Phase 5 · Custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md).
Mark that class `@Component` instead and you get raw `SQLException`s leaking
into your service layer.

Note that Spring Data repositories get translation regardless, because the
proxy Spring Data generates already applies it — which is why the annotation is
optional on a `JpaRepository` interface and mandatory on a hand-written DAO.

## They are meta-annotations, and that is the useful part

`@Service` is itself annotated `@Component`. Spring's annotation machinery
resolves meta-annotations transitively, so anything meta-annotated with
`@Component` — however deep the chain — is a scan candidate. That is what makes
composed annotations possible, and composing your own is a genuinely good idea
once a codebase has a recurring shape:

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component
@Transactional(readOnly = true)                 // ✅ one decision, applied consistently
public @interface QueryService {
    @AliasFor(annotation = Component.class, attribute = "value")
    String name() default "";
}
```

Now `@QueryService` registers a bean *and* makes it read-only transactional,
and a reviewer can see at the class declaration what kind of thing it is.

⚠️ **Declare the `@AliasFor` explicitly.** Convention-based attribute naming in
custom stereotypes — where an attribute called `value` was silently treated as
an alias — has been **deprecated since Framework 6.1** and is scheduled for
removal. Annotating the alias is the supported form.

The same mechanism is why `@RestController` works: it is `@Controller` plus
`@ResponseBody`, and `@Controller` is `@Component`. And it is why
`@SpringBootApplication` is a single annotation standing in for
`@SpringBootConfiguration`, `@EnableAutoConfiguration` and `@ComponentScan`.

## Choosing one, in practice

The decision procedure is short:

- Data access — anything that talks to a database, an ORM or a document store —
  is **`@Repository`**, because you want the translation.
- A web handler is **`@RestController`** (or `@Controller` for server-rendered
  views), because the handler mapping looks for it.
- Business logic is **`@Service`**.
- Infrastructure that is none of the above — a `Clock` wrapper, a filter, a
  listener, a post-processor — is **`@Component`**.
- A class you do not own cannot carry any of them, so it gets a `@Bean` method
  instead. That is [chunk 9](09-configuration-classes.md).

Where a class does not obviously fit, that is usually information: a "service"
that mostly builds SQL is a repository wearing the wrong label.

## Gotchas

### Using `@Component` on a DAO

**Symptom.** Vendor-specific `SQLException`s or Hibernate exceptions reach the
service layer, and error handling has to switch on `SQLState` strings.

**Cause.** Exception translation is applied to `@Repository` beans by
`PersistenceExceptionTranslationPostProcessor`. `@Component` does not trigger
it.

**Fix.** Annotate data-access classes `@Repository`. It is the one stereotype
choice that is not stylistic.


### Putting `@Repository` on a Spring Data interface and expecting it to matter

**Symptom.** A reviewer insists `@Repository` is required on every
`interface OrderRepository extends JpaRepository<Order, Long>`, and removing it
changes nothing.

**Cause.** Spring Data generates a proxy for the interface that already applies
exception translation. The annotation is redundant there — it is required for
*hand-written* DAO classes, where nothing else would trigger the
post-processor.

**Fix.** Keep it on hand-written DAOs, treat it as optional on Spring Data
interfaces, and be consistent within a codebase rather than arguing about it.

### A scanned class with no usable constructor

**Symptom.** `BeanInstantiationException` mentioning "No default constructor
found", on a class that is correctly annotated.

**Cause.** The class has several constructors and none is marked, so Spring
cannot choose. A single constructor is used automatically; two or more are
ambiguous.

**Fix.** Mark the one Spring should use, or — better — collapse to one:

```java
@Service
public class Reporting {
    private final Clock clock;

    @Autowired                                   // ✅ only needed when >1 constructor
    Reporting(Clock clock) { this.clock = clock; }

    Reporting() { this(Clock.systemUTC()); }     // convenience for tests
}
```

## Interview questions

**★ Is there any functional difference between `@Component`, `@Service` and `@Repository`?**
Yes, for one of them. All three are meta-annotated with `@Component` and are
equivalent to the scanner, so all three register a bean identically.
`@Repository` additionally activates persistence exception translation: a
`PersistenceExceptionTranslationPostProcessor` proxies the bean and converts
vendor-specific `SQLException`s and JPA provider exceptions into Spring's
portable, unchecked `DataAccessException` hierarchy. `@Service` and
`@Component` differ only semantically — but the semantics are load-bearing for
AspectJ pointcuts, component-scan filters and tooling, so consistency still
pays. `@Controller` is also functionally distinct in that
`RequestMappingHandlerMapping` looks for it when discovering handlers.


**★ How do composed stereotype annotations work, and why would you write one?**
Spring resolves meta-annotations transitively, so any annotation that is itself
meta-annotated with `@Component` — at any depth — makes a class a scan
candidate. That is how `@Service`, `@Repository`, `@Controller` and
`@RestController` are built, and it lets you compose your own: a
`@QueryService` that combines `@Component` with `@Transactional(readOnly =
true)`, for example, encodes a recurring decision once instead of relying on
everyone remembering both annotations. Attributes you want to forward to the
meta-annotation must be declared with `@AliasFor`, because the older
convention-based naming has been deprecated since Framework 6.1.

**★ What is the `DataAccessException` hierarchy for, and why is it unchecked?**
It is a persistence-technology-neutral exception hierarchy — `DuplicateKeyException`,
`DataIntegrityViolationException`, `OptimisticLockingFailureException` and so on
— that `@Repository` translation maps vendor-specific `SQLException`s and JPA
provider exceptions onto. The point is that service-layer code can catch a
meaningful, portable type instead of switching on a vendor's `SQLState` string,
and swapping the persistence technology does not rewrite the callers. It is
unchecked because the overwhelming majority of data-access failures are not
recoverable at the call site: forcing every caller to declare or catch them
produces the empty-catch-block noise that Phase 5 argues against.

**★ When can a class not carry a stereotype annotation at all, and what do you do instead?**
When you do not own the source — a `DataSource`, an `ObjectMapper`, an SDK
client from a third-party jar. You cannot add an annotation to a compiled class,
so the only way to register it is a `@Bean` method in a `@Configuration` class,
which also gives you somewhere to put the construction logic those types
usually need. The same applies when you need two beans of one type configured
differently, since a class can only be annotated once.

---

← Prev: [Proxies and self-invocation](05-proxies-and-self-invocation.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Component scanning](07-component-scanning.md)
