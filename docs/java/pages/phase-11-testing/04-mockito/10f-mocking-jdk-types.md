---
title: "Mockito 5 can mock LocalDate and List, and that capability is the trap: the standard library is the one category of types nobody owns, the JDK documents the substitution it actually wants for each of them, and a mocked collection can be configured into a state no collection can reach"
sidebar_label: "10f · Mocking JDK types"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests)
> (*"Don't mock value objects"*, *"Don't mock everything, it's an anti-pattern"*), the
> **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) — section 51 (*"Mark classes as
> unmockable"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> [`@DoNotMock`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/DoNotMock.java),
> the `EXCLUDES` set in `InlineBytecodeGenerator` and the `Reporter` message text — and the
> JDK 25 javadoc for
> [`java.time.Clock`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[10b](10b-do-not-mock-types-you-do-not-own.md) is about libraries; the JDK is the library
people forget is one. Nobody owns less of `java.time`, `java.util` or `java.lang` than you do,
and for the two cases that come up most often — the current date, and a collection — the
standard library ships the substitution it wants you to use. Mockito 5's inline mock maker
made mocking them technically possible, which is exactly why the rule now has to be held by
review rather than by a compiler error. The other half of this argument, your own value
objects, is [10g · Mocking value objects](10g-mocking-value-objects.md).**

## `java.time` — inject a `Clock`, do not mock the clock

`LocalDate.now()` is a static call on a final class. Since Mockito 5 you *can* reach it, with
`mockStatic` and the inline mock maker ([11 · Static and final](11-static-and-final.md)). You
should not, and the JDK says so itself — this is one of the rare cases where the standard
library documents the testing pattern it expects:

> *"Best practice for applications is to pass a `Clock` into any method that requires the
> current instant and time-zone. A dependency injection framework is one way to achieve this…
> This approach allows an alternative clock, such as `fixed` or `offset` to be used during
> testing."*

And `Clock.fixed`, in its own words:

> *"Obtains a clock that always returns the same instant. This clock simply returns the
> specified instant. As such, it is not a clock in the conventional sense. The main use case
> for this is in testing, where the fixed clock ensures tests are not dependent on the current
> clock."*

**Before** — untestable without either a static mock or a sleep:

```java
public class SubscriptionService {
    public boolean isExpired(Subscription s) {
        return s.expiresOn().isBefore(LocalDate.now());   // hidden dependency on "today"
    }
}
```

**After** — the dependency is declared, and the test controls it with the JDK's own API:

```java
public class SubscriptionService {
    private final Clock clock;

    public SubscriptionService(Clock clock) { this.clock = clock; }

    public boolean isExpired(Subscription s) {
        return s.expiresOn().isBefore(LocalDate.now(clock));
    }
}
```

```java
class SubscriptionServiceTest {
    private static final Clock FIXED =
            Clock.fixed(Instant.parse("2026-08-28T09:00:00Z"), ZoneOffset.UTC);

    private final SubscriptionService service = new SubscriptionService(FIXED);

    @Test
    void a_subscription_that_ended_yesterday_is_expired() {
        assertThat(service.isExpired(expiring(LocalDate.parse("2026-08-27")))).isTrue();
    }

    @Test
    void tomorrow_is_not_yet_expired() {
        assertThat(service.isExpired(expiring(LocalDate.parse("2026-08-29")))).isFalse();
    }
}
```

No Mockito at all, no `MockedStatic` to close, no thread-local scope, and the test reads as
arithmetic on two dates. `Clock.offset(FIXED, Duration.ofDays(30))` covers *"simulate running
in the future or in the past"* when a single test needs two points in time.

Every `now()` in `java.time` takes a `Clock` overload — `LocalDate.now(clock)`,
`Instant.now(clock)`, `LocalDateTime.now(clock)`, `ZonedDateTime.now(clock)`,
`Year.now(clock)`. If your production code calls the no-arg form anywhere, that is the line
that will eventually make someone reach for a static mock.

## Collections and `Optional`

Mockito's section 51 uses a collection as its example of a type whose contract a mock cannot
honour:

> *"In some cases, mocking a class/interface can lead to unexpected runtime behavior. For
> example, mocking a `java.util.List` is difficult, given the requirements imposed by the
> interface. This means that on runtime, depending on what methods the application calls on
> the list, your mock might behave in such a way that it violates the interface."*

That is precise, and it generalises. A `mock(List.class)` where `size()` returns 3 and
`iterator()` returns an empty iterator is a list that does not exist. Nothing stops you,
because a mock has no invariants — and the code under test, which does assume the invariants,
misbehaves in a way that has nothing to do with the bug you were hunting.

The alternative costs one line: `List.of("a", "b")`, `new ArrayList<>()`, `Map.of(...)`. These
are the fastest, most correct fakes in the JDK and they need no framework.

`Optional` is the same argument with a sharper tell. `when(repository.findById(id)).thenReturn(mockOptional)` and then
`when(mockOptional.isPresent()).thenReturn(true)` is two stubbings where `Optional.of(order)`
is one expression, and the mocked version can be configured into the impossible state
`isPresent() == true` with `get()` returning `null`. Return `Optional.of(...)` or
`Optional.empty()`; there is no third state to model.

## Some JDK types genuinely cannot be mocked

Not a design opinion — the inline mock maker keeps a hard exclusion set. From
`InlineBytecodeGenerator`:

```java
static final Set<Class<?>> EXCLUDES =
        new HashSet<Class<?>>(
                Arrays.asList(
                        Class.class,
                        Boolean.class, Byte.class, Short.class, Character.class,
                        Integer.class, Long.class, Float.class, Double.class,
                        String.class,
                        WeakReference.class));
```

and the reason string it reports is *"Cannot mock primitive wrapper types, String, Class, or
WeakReference"*. Independently of the mock maker, Mockito's own error text names four method
kinds that are never stubbable or verifiable:

> *"Following methods *cannot* be stubbed/verified: final/private/equals()/hashCode()."*

`equals` and `hashCode` are excluded because Mockito uses them to identify mocks — which is
also why a mock of a value type is structurally impossible to get right: a value type *is* its
`equals`. That argument continues in
[10g · Mocking value objects](10g-mocking-value-objects.md).

## Gotchas

**★ Mocking `LocalDate.now()` with `mockStatic` because Mockito 5 lets you.**
It works, it needs the inline mock maker, it holds a thread-local scope you must close, and it
is strictly worse than the `Clock` overload the JDK put there for this purpose. Capability is
not permission.

**★ Injecting a `Clock` but still calling the no-arg `now()` somewhere.**
One `LocalDate.now()` left in a helper makes the whole class time-dependent again, and the
symptom is a test that fails only near midnight or only on the last day of a month. Grep for
`now()` without an argument.

**★ `Clock.systemDefaultZone()` in production, `Clock.fixed(..., UTC)` in the test.**
The test then passes at a zone offset the production code never uses. Fix the zone in both, or
pass the zone explicitly — a fixed clock removes time non-determinism, not zone
non-determinism.

**★ A mocked `List` configured into a state no list can reach.**
`size()` of 3 with an empty `iterator()`. Section 51 describes precisely this: *"your mock
might behave in such a way that it violates the interface"*. Use `List.of(...)`.

**★ Mocking `Optional` instead of returning one.**
Two stubbings replacing `Optional.of(order)`, and the mock can be put into the impossible
`isPresent() == true` / `get() == null` state. There is no case where the real `Optional` is
harder.

**★ Using `@DoNotMock` and expecting it to cover JDK types.**
The annotation is matched on the *mocked type*, so it protects types you can annotate.
Mockito's own example of a hard-to-mock type is `java.util.List`, which you cannot annotate.
Its default `reason` is *"Create a real instance instead."* — good advice you have to apply by
hand for the standard library. See
[02c · Choosing a mock maker](02c-choosing-a-mock-maker.md).

**★ Assuming a wrapper type or `String` can be mocked at all.**
It cannot: `EXCLUDES` names `Class`, `String`, `WeakReference` and all eight primitive
wrappers, and the reported reason is *"Cannot mock primitive wrapper types, String, Class, or
WeakReference"*. A test that seems to need this is a test that should be passing a literal.

## Interview questions

**★ How do you test code that depends on the current date?**
Inject a `java.time.Clock` and use the `now(clock)` overloads. The JDK documents this as the
expected pattern — *"Best practice for applications is to pass a `Clock` into any method that
requires the current instant and time-zone"* — and `Clock.fixed` exists specifically so that
*"the fixed clock ensures tests are not dependent on the current clock"*. No Mockito is
involved, so there is no static mock scope to manage and no inline mock maker requirement.

**★ Mockito 5 can mock `LocalDate`. Why not just do that?**
Because it costs a `MockedStatic` scope that must be closed on the right thread, it requires
the inline mock maker and its Java agent, it affects every call to that static within the
scope rather than only your class's, and it leaves the production code with an undeclared
dependency on "now". The `Clock` version removes the dependency instead of hiding it.

**★ What is wrong with `mock(List.class)`?**
It produces an object that can violate the `List` contract — Mockito's own documentation uses
this exact example: *"mocking a `java.util.List` is difficult, given the requirements imposed
by the interface… your mock might behave in such a way that it violates the interface."*
Real collections are cheap, deterministic and correct; there is no upside to the mock.

**★ Which JDK types can Mockito refuse outright?**
`Class`, `String`, `WeakReference` and the eight primitive wrapper types are in the inline
generator's `EXCLUDES` set, reported as *"Cannot mock primitive wrapper types, String, Class,
or WeakReference"*. And no mock maker can stub `final`, `private`, `equals()` or `hashCode()`
methods on anything.

{/* FOOTER */}
