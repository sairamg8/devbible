---
title: "The fastest test in your suite is the one that calls a constructor — and whether your code permits that is a design decision you made months earlier, in the injection style you chose"
sidebar_label: "02 · A unit test needs no Spring"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.1 reference *Testing → Test Scope
> Dependencies* and *Testing Spring Boot Applications*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)),
> and the Spring Framework 7.0.x reference *Core → Dependency Injection →
> Constructor-based or setter-based DI?*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> **No sandbox** — Java source only.

**A Spring bean is an ordinary Java object. `@Service`, `@Component` and `@Repository` are
instructions to the container about how to *build* the object; they change nothing about
the class once it exists. So a test can construct it with `new` and call it — no context,
no cache key, no auto-configuration, no startup cost — provided the class was written so
that `new` is possible. That proviso is the whole content of this chunk, and it is why
"can this be a unit test?" is really a question about your production code, not your test
code.**

## The mechanism: there is no Spring at runtime inside your bean

```java
@Service
public class PricingService {

    private final DiscountPolicy discounts;
    private final TaxTable taxes;

    public PricingService(DiscountPolicy discounts, TaxTable taxes) {   // constructor injection
        this.discounts = discounts;
        this.taxes = taxes;
    }

    public Money priceOf(Order order) { ... }
}
```

Once the container has called that constructor, the resulting object holds two references
and nothing else. There is no proxy involved unless something asked for one (`@Transactional`,
`@Cacheable`, `@Async` — see
[Phase 10 · The proxy](../../phase-10-data-access/04-spring-transactional/02-the-proxy.md)),
no `ApplicationContext` reference, no lifecycle callback pending. Which means:

```java
class PricingServiceTest {

    private final PricingService pricing =
            new PricingService(new FlatDiscount(percent(10)), TaxTable.uk());

    @Test
    void appliesDiscountBeforeTax() {
        assertThat(pricing.priceOf(orderOf("SKU-1", 2, "10.00")))
                .isEqualTo(Money.of("21.60"));
    }
}
```

That is a complete, honest test of a `@Service`. It loads no context. It does not appear in
the context cache. It cannot slow anybody else's tests down. Spring's own reference
recommends constructor injection partly for exactly this reason:

> *"The Spring team generally advocates constructor injection, as it lets you implement
> application components as immutable objects and ensures that required dependencies are
> not `null`."*

The testability consequence is stated in the same section:

> *"a constructor with a large number of arguments is a bad code smell, implying that the
> class likely has too many responsibilities and should be refactored to better address
> proper separation of concerns."*

which is a design smell detector you get for free — you feel it when you write the `new`.

## What field injection costs you, precisely

```java
@Service
public class PricingService {

    @Autowired private DiscountPolicy discounts;   // no constructor takes this
    @Autowired private TaxTable taxes;

    public Money priceOf(Order order) { ... }
}
```

There is now no way to build a usable `PricingService` from a test without either a
container or reflection. Your options are:

1. Load a Spring context — turning a free test into a level-1 or level-2 test.
2. Use `ReflectionTestUtils.setField(...)` — which compiles, works, and encodes your field
   names into your test, so a rename breaks the test at runtime rather than at compile time.
3. Refactor to constructor injection.

Only (3) is a real answer. The relevant point for this topic is that **field injection
converts a level-0 test into a level-2 test**, and a level-2 test into a context in the
cache. The cost of `@Autowired` on a field is not paid at the field; it is paid in the
build's wall-clock time, months later.

## What qualifies for level 0

Everything whose correctness is a function of its inputs:

| Kind of code | Example | Why level 0 |
|---|---|---|
| Domain calculation | totals, proration, interest, VAT | pure function of inputs |
| Policy / strategy objects | `DiscountPolicy`, `RetryPolicy` | small, branchy, high defect density |
| Validators and invariants | "an order line quantity is ≥ 1" | boundaries are exactly what unit tests are good at |
| State machines | order status transitions | the interesting part is the transition table, not the store |
| Mappers between representations | domain ↔ DTO | one input, one output, no I/O |
| `Comparator`s and sorting rules | ranking search results | trivially exhaustive at level 0 |
| Parsing and formatting | reference numbers, IBANs | boundaries again |

If you can express the test as "given these values, the answer is that value", it belongs
at level 0. If the *interesting* part of the assertion is "and Spring wired it up
correctly", it does not — see [03 · The slices](03-the-slices.md).

## What does *not* belong at level 0, no matter how much you want it to

- **A derived Spring Data query method.** `findByStatusAndCreatedAtBefore` is generated from
  its name by the repository infrastructure. A level-0 test of it tests your mock, not the
  query. That is a `@DataJpaTest`, and the SQL it produces is only real against a real
  database — **07 · Testcontainers** *(not written yet)*.
- **A `@RequestMapping` path.** Whether `/orders/{id}` is bound at all is a question about
  the framework's handler mapping. That is `@WebMvcTest` — **06 · MockMvc**
  *(not written yet)*.
- **JSON serialisation of a DTO.** Field names, `@JsonProperty`, date formats and null
  handling are decided by the configured `ObjectMapper`, not by your class. That is
  `@JsonTest`.
- **Bean validation annotations firing.** `@NotNull` on a DTO field does nothing until a
  `Validator` runs. Testing it at level 0 requires you to build a `Validator` yourself,
  which is legitimate, but it is a test of the constraint, not of the wiring that invokes it.
- **`@Transactional` behaviour.** Constructing the class with `new` produces an object with
  no proxy, so no transaction ever starts. A level-0 test therefore *cannot* observe
  rollback semantics — see
  [Phase 10 · Annotations that do nothing](../../phase-10-data-access/04-spring-transactional/05-annotations-that-do-nothing.md).

## `spring-boot-starter-test` at level 0

You do not have to give up the libraries to give up the context.
`spring-boot-starter-test` puts JUnit Jupiter, AssertJ, Mockito, Hamcrest, JSONassert,
XMLUnit and Awaitility on the test classpath. None of those needs a Spring context.
[02 · AssertJ](../02-assertj/README.md) and [04 · Mockito](../04-mockito/README.md) are
entirely usable in a class with no Spring annotation on it at all:

```java
@ExtendWith(MockitoExtension.class)      // Mockito's extension — NOT SpringExtension
class OrderSubmissionTest {

    @Mock  PaymentGateway gateway;
    @Mock  OrderRepository orders;

    @InjectMocks OrderSubmission submission;

    @Test
    void rejectsWhenTheGatewayDeclines() { ... }
}
```

`MockitoExtension` starts no context. Swapping it for `SpringExtension` — or adding
`@SpringBootTest` "so `@MockitoBean` works" — is precisely the one-line change that moves
the class from level 0 to level 2, and hands the class a context cache key it did not have
before ([05 · The context cache](05-the-context-cache.md)).

## Gotchas

**★ `@Autowired` on a field is the single most common reason a test has to load a context.**
It is not a style preference in a testing topic — it is the mechanism by which a class
becomes impossible to construct. Constructor injection is what makes level 0 available at
all, and Spring does not even require the `@Autowired` annotation on a single-constructor
class.

**★ `ReflectionTestUtils.setField` makes the test compile and the design rot.**
It works, so nobody refactors. The test now depends on a private field name, which no
compiler checks, and the class remains impossible to build correctly anywhere else —
including in the next test somebody writes.

**★ `new PricingService(...)` gives you an object with none of its AOP advice.**
No `@Transactional`, no `@Cacheable`, no `@Retryable`, no method security. This is correct
and usually what you want at level 0 — but it means a level-0 test can never confirm that
those annotations are wired, and a green level-0 suite is compatible with a `@Transactional`
that does nothing in production. Notice the same rule reappears in
[06 · Bean overriding](06-bean-overriding.md), for the same reason: an override registered
as a manual singleton is a bare object with no advice on it either.

**★ A level-0 test of a class whose collaborators are all mocks may assert nothing real.**
If every dependency is stubbed and the method under test only delegates, the test verifies
the wiring you just wrote in the test. That is the failure mode
[04 · Never mock the class under test](../04-mockito/10-never-mock-the-class-under-test.md)
is about. Level 0 is cheap, not automatically valuable.

**★ `Instant.now()`, `LocalDate.now()` and `UUID.randomUUID()` inside the class silently
break level 0.**
The test either becomes non-deterministic or has to sleep. The fix is to inject the seam
rather than call the static — take a `java.time.Clock` and a `Supplier<UUID>` as
constructor arguments, call `clock.instant()` and `ids.get()` in the method, and pass
`Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC)` and a counter from
the test. The production wiring supplies `Clock.systemUTC()` and `UUID::randomUUID` as a
`@Bean` each, so nothing about the runtime behaviour changes and the class stays
constructible with `new`.

**★ Static state, including a static logger's side effects and static caches, leaks between
level-0 tests.**
There is no container to reinitialise, which is the point — but it also means nothing
resets your `static Map` between tests. JUnit gives you a new test *instance* per method by
default, not a new class loader.

**★ Adding `@ExtendWith(SpringExtension.class)` "just for `@Value`" loads a context.**
`SpringExtension` is the TestContext framework's JUnit integration. The moment it is
present with any context configuration, you are in the cache and paying for it. If you only
need a value, pass it into the constructor.

## Interview questions

**★ Why does constructor injection matter for testing, specifically?**
Because it is the difference between a class you can instantiate and a class only the
container can instantiate. With constructor injection, the test does exactly what the
container does — call the constructor with collaborators — so the test needs no container.
With field injection there is no public way to supply the collaborators, so the test must
either start a context or reach into private state by reflection. Everything else people
say about constructor injection (immutability, non-null guarantees, the too-many-arguments
smell) is true and secondary; the testability consequence is the one that shows up in the
build time.

**★ Is a test that uses `@ExtendWith(MockitoExtension.class)` a Spring test?**
No. `MockitoExtension` is part of `mockito-junit-jupiter` and initialises `@Mock` and
`@InjectMocks` fields. It has no knowledge of an `ApplicationContext`, contributes nothing
to the context cache and starts nothing. The Spring equivalent is `SpringExtension`, which
`@SpringBootTest` and every `@…Test` slice annotation already include.

**★ Your `@Service` has nine constructor arguments and you cannot face writing the `new`.
What is that telling you?**
That the class has too many responsibilities — the reference calls a large constructor
argument list *"a bad code smell"*. The pain in the test is a faithful measurement of the
pain of the design, and reaching for a context to avoid writing the constructor call
suppresses the signal without fixing anything. Split the class; the tests get shorter as a
side effect.

**★ Can you test `@Transactional` behaviour at level 0?**
No. `@Transactional` is implemented by a proxy the container creates around your bean.
Construct the class yourself and there is no proxy, so no transaction is ever started and
nothing rolls back. To observe transactional behaviour you need at least a context that
creates the proxy, and to observe *rollback* you need a real transaction manager and
usually a real database.

**★ Where is the line between "this belongs at level 0" and "this needs a slice"?**
Ask what the assertion is really about. If it is about a value your code computes, level 0.
If it is about a decision the framework makes — which handler is invoked for a URL, what
SQL a derived query name produces, how an `ObjectMapper` renders a field — then no amount of
level-0 testing can observe it, because your code is not the thing making the decision.

{/* FOOTER */}
