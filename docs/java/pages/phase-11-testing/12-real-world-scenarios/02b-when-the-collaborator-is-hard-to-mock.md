---
title: "A static call, a new inside the method, a final class and a fat SDK client are four different reasons a mock will not fit — Mockito has a trick for each of them, every trick is a loan against the design, and the interest rate went up in JDK 21"
sidebar_label: "02b · When it's hard to mock"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc — §0.2 configuration-free
> inline mock making, §0.3 *"Explicitly setting up instrumentation for inline mocking
> (Java 21+)"*, §39 *"Mocking final types, enums and final methods"*, §48 *"Mocking static
> methods (since 3.4.0)"*, §49 *"Mocking object construction (since 3.5.0)"*, §56
> `mockSingleton` — read from `mockito-core-5.23.0-javadoc.jar` on Maven Central; and
> **JEP 451** ([openjdk.org/jeps/451](https://openjdk.org/jeps/451)) for the dynamic-agent
> warning text.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**Sooner or later the collaborator is not a constructor parameter. It is a static method,
or a `new` three lines into the method body, or a final class from a jar, or a
forty-method SDK client that cannot be constructed without credentials, or a private
method somebody wants to stub. Mockito has a trick for every one of them. These four
chunks show each trick, because sometimes the trick is genuinely the right answer — and
then show the refactor that removes the need for it, because most of the time it is not.
The framing that makes the choice easy: a mocking trick is a loan taken against the
design, and every payment is made by whoever touches that class next. This chunk states
the rule and does the first and commonest shape, the static call.**

## The rule that decides it

> **Use the trick when you cannot change the code. Use the refactor when you can.**

That sounds trite until you notice how often "cannot change the code" is false. You can
change the code when it is in your repository, in your language, and covered by a build
you control. You genuinely cannot change it when it is in a jar you consume, in a module
another team owns and releases on its own schedule, or in a generated source tree.

Two facts sharpen the trade further, and both are recent:

- **The tricks all work by default now.** Mockito's javadoc, §39: *"Since 5.0.0, this
  feature is enabled by default."* You no longer add `mockito-inline`; the inline mock
  maker is what `mockito-core` gives you.
- **The tricks all cost more than they used to.** They work by attaching a Java agent to
  the running JVM, and the JDK has started objecting. See
  [the agent tax](02e-the-agent-tax-and-the-decision-table.md).

## Shape 1 · A static method

```java
public class InvoiceService {

    public Invoice issue(Order order) {
        String id = IdGenerator.next();                 // static, in your codebase
        Instant now = Instant.now();                    // static, in the JDK
        AuditLog.record("invoice.issued", id);          // static, and it writes a file
        return new Invoice(id, order.total(), now);
    }
}
```

Three static calls, three different problems: the id is unpredictable, the timestamp is
unpredictable, and the audit call touches the filesystem. Nothing in the constructor lets
a test intervene, because there is no constructor.

### The trick

`mockStatic` has been available since Mockito 3.4.0 and is documented precisely:

> *"When using the inline mock maker, it is possible to mock static method invocations
> within the current thread and a user-defined scope. This way, Mockito assures that
> concurrently and sequentially running tests do not interfere. To make sure a static mock
> remains temporary, it is recommended to define the scope within a try-with-resources
> construct."*

```java
@Test
void issuesAnInvoiceWithAGeneratedId() {
    try (MockedStatic<IdGenerator> ids = mockStatic(IdGenerator.class)) {
        ids.when(IdGenerator::next).thenReturn("inv-1");

        Invoice invoice = new InvoiceService().issue(anOrder().totalling("90.00").build());

        assertThat(invoice.id()).isEqualTo("inv-1");
        ids.verify(IdGenerator::next);
    }
}
```

Two properties are worth holding on to, because they are what make this survivable at all:
the mock is **thread-local**, and it **ends with the scope**. Outside the
try-with-resources, `IdGenerator.next()` is itself again. Forget the
try-with-resources — assign the `MockedStatic` to a field and never close it — and you
have poisoned the static for every subsequent test on that thread, which produces failures
in test classes that never mentioned `IdGenerator`.

### The refactor

The static becomes an interface parameter, and a **method reference supplies the
production implementation for free**:

```java
public interface IdSource {
    String next();
}
```

```java
public class InvoiceService {

    private final IdSource ids;
    private final Clock clock;
    private final AuditLog audit;

    public InvoiceService(IdSource ids, Clock clock, AuditLog audit) {
        this.ids = ids;
        this.clock = clock;
        this.audit = audit;
    }

    public Invoice issue(Order order) {
        String id = ids.next();
        Instant now = clock.instant();
        audit.record("invoice.issued", id);
        return new Invoice(id, order.total(), now);
    }
}
```

```java
@Configuration
class InvoiceConfig {
    @Bean IdSource idSource() { return IdGenerator::next; }   // the static, unchanged
    @Bean Clock clock()       { return Clock.systemUTC(); }
}
```

The static utility class does not have to change, be deprecated, or be found by everyone
who uses it. `IdGenerator::next` is a valid `IdSource`, so the adapter is nine characters
long. And the test loses the try-with-resources entirely:

```java
@Test
void issuesAnInvoiceWithAGeneratedId() {
    InvoiceService service = new InvoiceService(
            () -> "inv-1",
            Clock.fixed(Instant.parse("2026-03-01T10:15:30Z"), ZoneOffset.UTC),
            audit);

    Invoice invoice = service.issue(anOrder().totalling("90.00").build());

    assertThat(invoice.id()).isEqualTo("inv-1");
    assertThat(invoice.issuedAt()).isEqualTo(Instant.parse("2026-03-01T10:15:30Z"));
}
```

Note that the *lambda* replaced the mock. A one-method interface almost never needs
Mockito at all.

### The two JDK statics deserve separate treatment

`Instant.now()` and `UUID.randomUUID()` are the statics people reach for `mockStatic` on
most often, and both have a first-class answer that is not a mock:

| The static | The seam | Not this |
|---|---|---|
| `Instant.now()`, `LocalDate.now()` | inject `java.time.Clock`; production `Clock.systemUTC()`, test `Clock.fixed(...)` | `mockStatic(Instant.class)` |
| `UUID.randomUUID()` | inject `Supplier<UUID>` or a named `IdSource` | `mockStatic(UUID.class)` |
| `System.currentTimeMillis()` | same `Clock` — `clock.millis()` | `mockStatic(System.class)` |
| `System.getenv`/`getProperty` | inject a bound `@ConfigurationProperties` type | `mockStatic(System.class)` |
| `Files.readAllBytes(path)` | inject the directory as a parameter and use JUnit's `@TempDir` | `mockStatic(Files.class)` |

Mocking `Instant.now()` statically is worse than injecting a `Clock` in three concrete
ways: it is thread-local so it silently fails to affect a worker thread, it affects
*every* call site in the transitive call tree including inside library code, and it leaves
production with no way to run under a different clock — which you will want the first time
you need to reproduce a bug from a specific date.

## Where this connects

- The collaborator that is `new`-ed inside the method, and the final class:
  [02c · Construction and final classes](02c-construction-and-final-classes.md).
- The forty-method vendor client, and the private method people always ask about:
  [02d · Vendor clients and private methods](02d-vendor-clients-and-private-methods.md).
- Why every trick in these four chunks costs more on JDK 21 and later, what to put in your
  build so it keeps working, and the table that decides trick-versus-refactor per shape:
  [02e · The agent tax and the decision table](02e-the-agent-tax-and-the-decision-table.md).
- The ownership rule that says a mockable type is still not necessarily a type you should
  mock: [01](01-what-to-mock-and-what-to-let-run.md).
- The ordinary case where the constructor already takes the collaborator:
  [02](02-mocking-a-class-you-own.md) and [02a](02a-building-the-test-class.md).
- The legacy class with no seams at all, where you write characterization tests first, is
  [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md) in this topic.
- `mockStatic`, `MockedStatic` and the mock-maker plumbing belong to **topic 04 ·
  Mockito**; this chunk uses them, it does not own them.

## Gotchas

**★ A `MockedStatic` that is not closed poisons the static for every later test on that thread.**
The scoping is what makes static mocking safe, and it is opt-in: `mockStatic` returns an `AutoCloseable` and you have to use it as one. Assign it to a field, or open it in `@BeforeEach` without a matching `@AfterEach` close, and `IdGenerator.next()` keeps returning `"inv-1"` in test classes that never heard of it. The failures land far from the cause and look like flakiness, because they depend on execution order.

**★ Static mocking is thread-local, so it does not affect the worker thread your code actually runs on.**
The javadoc says the mock applies *"within the current thread and a user-defined scope"*. If the method under test submits work to an executor, a `@Async` proxy, or a parallel stream, that work runs on another thread and sees the real static. The test then fails with the unmocked value while the arrangement looks correct — and the natural next move, adding sleeps, makes it flaky rather than fixed. An injected collaborator has no such restriction, which is one more reason the refactor wins.

**★ `mockStatic(Instant.class)` affects every caller in the transitive tree, including library code.**
Freezing `Instant.now()` globally means Jackson's date handling, a connection pool's idle calculation, a logging appender's timestamp and a retry backoff all see the frozen instant for the duration of the scope. Most of the time nothing visible happens; occasionally something inside a library divides by an elapsed time of zero, or a cache decides every entry is fresh. An injected `Clock` affects exactly the class you gave it to.

**★ A static initializer runs once when the class is loaded, and no mock can undo it.**
`mockStatic` intercepts *method* invocations. If the utility class reads a system property, opens a file or builds a connection pool in a `static {}` block or a static field initializer, that work has already happened by the time your test starts — and it happened with whatever configuration the JVM had at class-load time. The tell is a test that behaves differently depending on which test class ran first. There is no mocking answer; the refactor is to move the work out of `<clinit>` into an instance you can construct, which is the same refactor as everything else on this page.

**★ You verify a static mock through the `MockedStatic` handle, not through `Mockito.verify`.**
`ids.verify(IdGenerator::next)` is the call. Reaching for the familiar `verify(...)` static import does not do what you expect on a static mock, and the mistake reads as correct in review because the shape is so close. The same applies to stubbing: `ids.when(IdGenerator::next)`, not the bare `when(...)`.

**★ Injecting a `Clock` only helps if *every* time read goes through it, and one stray `Instant.now()` is enough to restore the nondeterminism.**
The refactor is not "add a `Clock` parameter", it is "route all time through the `Clock`". A single `Instant.now()` left in a helper method, or in a domain object's constructor, gives you a test that is deterministic in the assertion you wrote and nondeterministic in the field you did not check. Grep for `now()` after doing the refactor; it takes a minute and it is the difference between a fixed clock and a fixed-looking clock.

## Interview questions

**★ A class calls a static utility method that hits the filesystem. How do you test it?**
Two answers, and which one applies depends on whether I can change the class. If I can — the normal case — I turn the static call into a one-method interface taken in the constructor, and wire the production implementation as a method reference, so the utility class itself never changes and the adapter is nine characters. The test then passes a lambda and does not need Mockito at all. If I genuinely cannot change the class — it is generated, or it is in a jar — Mockito's `mockStatic` works, scoped in a try-with-resources so the mock is thread-local and ends with the block. I would treat that as a loan: it works, but the test now depends on bytecode instrumentation, it will not affect any work the method hands to another thread, and the design that made it necessary is still there.

**★ What is wrong with `mockStatic(Instant.class)` as a way to control time?**
Three things, in increasing order of how much they will cost you. It is thread-local, so any work the code hands to an executor or a `@Async` proxy sees the real clock and the test fails in a way that looks like the arrangement is wrong. It is global within its scope, so it also freezes time for Jackson, the connection pool, the logging appender and anything else called during the block, occasionally producing a genuinely strange failure inside a library. And it leaves production with no seam at all, so the first time you need to reproduce a date-dependent bug by running the service at a fixed time, you cannot. An injected `java.time.Clock` costs one constructor parameter and one `@Bean`, and it has none of those properties.

**★ You inherit a class whose behaviour depends on a static configuration holder that reads a file in a static initializer. Where do you start?**
Not with `mockStatic`, because the damage is already done before the test runs — a static initializer executes once at class load, so by the time the first test method starts, the file has been read with whatever the JVM's state was then. That also explains the symptom people usually report, which is that the test passes alone and fails in the suite, or vice versa, depending on which class touched the holder first. The starting move is to make the work lazy and instance-based: an object that reads configuration when asked rather than when loaded, taken as a constructor parameter. If I cannot change the holder, I would at least stop depending on it from the class under test by introducing my own interface and adapting to it, so the untestable class-loading behaviour stays in one place rather than being a property of every test in the module.

{/* FOOTER */}
