---
title: "Mockito 5 mocks final classes, final methods and most enums by default, which leaves a much shorter list of genuinely impossible things — and every item on that shorter list has a precise reason in the source, worth knowing because the error message names the symptom rather than the cause"
sidebar_label: "11d · The unmockable"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> sections 39 (*"Mocking final types, enums and final methods"*), 47 (*"New API for clearing
> mock state in inline mocking"*) and 56 (*"Mocking singletons (like Java enums)"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> the `Mockito.mockSingleton(Object)` javadoc, and the class javadoc, `prettifyFailure` and
> `isTypeMockable` of
> [`InlineDelegateByteBuddyMockMaker`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/creation/bytebuddy/InlineDelegateByteBuddyMockMaker.java)
> plus the `EXCLUDES` set in `InlineBytecodeGenerator` and the `Reporter` message text.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source and
> error text quoted from that source, never a fabricated test run.

**[02b](02b-the-inline-mock-maker.md) covers why final types became mockable and what that
costs on JDK 21+. This page is the residue: the things that still cannot be mocked in Mockito
5.23.0, why each one is impossible rather than merely discouraged, and the two features —
`mockSingleton` and `clearInlineMocks` — that exist because of how the inline maker works.
Read it as a reference for the moment a mock creation fails and the message explains what
happened but not why.**

## What the inline maker changed, precisely

Section 39:

> *"Mockito now offers support for mocking final classes and methods by default. … Since 5.0.0,
> this feature is enabled by default."*

and the mechanism, from the mock maker's own class javadoc, which also names the three cases
where it silently falls back to subclassing:

> *"…unless any of the following conditions is met, in such case the mock maker **falls back**
> to the creation of a subclass: the type to mock is an abstract class; the mock is set to
> require additional interfaces; the mock is explicitly set to support serialization."*

That fallback is why section 39's incompatibility list exists: mocking a final type or enum is
incompatible with `withSettings().serializable()` and `withSettings().extraInterfaces()`,
because those settings force the subclass path and a final type cannot be subclassed. The error
text says so directly:

> *"Mockito cannot mock this class: … Can not mock final classes with the following settings :
> - explicit serialization (e.g. withSettings().serializable())
> - extra interfaces (e.g. withSettings().extraInterfaces(...))"*

Two more behavioural changes the same javadoc lists, both of which surprise people:

> *"Mockito is capable of mocking package-private methods even if they are defined in different
> packages than the mocked type. Mockito voluntarily never mocks package-visible methods within
> `java.*` packages."*

> *"Mockito can no longer mock `native` methods. Inline mocks require byte code manipulation of
> a method where native methods do not offer any byte code to manipulate."*

> *"Mockito can no longer strip `synchronized` modifiers from mocked instances."*

## The hard list

Grouped by why, because the reasons are different.

**Excluded types — the mock maker refuses them by identity.** From `InlineBytecodeGenerator`:

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

reported by `isTypeMockable` as *"Cannot mock primitive wrapper types, String, Class, or
WeakReference"*, with primitives reported separately as *"primitive type"* and anything the JVM
will not retransform as *"VM does not support modification of given type"*.

**Arrays.** *"Arrays cannot be mocked: …"*.

**Sealed abstract types.** Two distinct messages, both from `prettifyFailure`:

> *"Sealed interfaces or abstract classes can't be mocked. Interfaces cannot be instantiated and
> cannot be subclassed for mocking purposes. Instead of mocking a sealed interface or an
> abstract class, a non-abstract class can be mocked and used to represent the interface."*

> *"Sealed abstract enums can't be mocked. Since Java 15 abstract enums are declared sealed,
> which prevents mocking. You can still return an existing enum literal from a stubbed method
> call."*

🔴 That second one is the one that catches people, because it is invisible in the source. **An
enum with a constant-specific class body is an abstract enum**, and since Java 15 abstract enums
are sealed. So `enum Tier { GOLD, SILVER }` is mockable and
`enum Tier { GOLD { … } , SILVER { … } }` is not — a difference of two braces. The message
itself gives the answer: return an existing literal.

**Private types.** *"Most likely it is a private class that is not visible by Mockito"*.

**Methods that are never interceptable, whatever the mock maker.** From Mockito's own error
text:

> *"Following methods *cannot* be stubbed/verified: final/private/equals()/hashCode()."*

`equals` and `hashCode` are structural — Mockito uses them to identify mocks. `private` methods
are never dispatched through the proxy, and the project's position on that is a design one:
*"from the standpoint of testing, private methods don't exist."* (`final` appears in this
message because the message predates the inline maker's default; on Mockito 5 a final *method*
of a mockable type is interceptable, while a final method on a **spy** remains the documented
trouble spot — section 13, gotcha 3.)

**`native` methods**, per the quote above, and **package-visible methods within `java.*`**,
which Mockito *"voluntarily never mocks"*.

**JVM intrinsics**, for static mocking. ⚠️ The `mockStatic` javadoc says *"if a static method is
a JVM-intrinsic, it cannot typically be mocked even if not explicitly forbidden"* and does not
enumerate them — see [11 · Static and final](11-static-and-final.md), where I could not confirm
the set from any Mockito document.

## Enums, and `mockSingleton`

`mockSingleton` is new in **5.22.0** and it exists for a category the rest of the API cannot
reach: an object you did not create and cannot inject.

> *"Creates a thread-local mock controller for the given singleton instance. The returned
> object's `MockedSingleton#close()` method must be called upon completing the test or the mock
> will remain active on the current thread. This is useful for mocking instances of objects for
> which you don't control initialization, assignment, or access to the object, e.g. Java enum
> values."*

Section 56's example:

```java
try (MockedSingleton<MyEnum> mocked = mockSingleton(MyEnum.A)) {
    when(MyEnum.A.method()).thenReturn("bar");
    assertEquals("bar", MyEnum.A.method());
}
```

Everything about the shape is familiar by now: a `ScopedMock`, thread-local, must be closed,
*"the mocking only applies to the given instance and that instance only behaves as a mock on the
current thread"*. And the design reading is the same as
[11b](11b-static-mocking-as-a-design-signal.md)'s — an enum whose behaviour a test needs to vary
is behaviour that belongs in a collaborator taking the enum as input.
[10g · Mocking value objects](10g-mocking-value-objects.md) has the argument.

## `clearInlineMocks` and the memory question

Section 47 documents a real, narrow problem:

> *"In certain specific, rare scenarios (issue #1619) inline mocking causes memory leaks. There
> is no clean way to mitigate this problem completely. Hence, we introduced a new API to
> explicitly clear mock state (only make sense in inline mocking!). See example usage in
> `MockitoFramework#clearInlineMocks()`. If you have feedback or a better idea how to solve the
> problem please reach out."*

Two things to take from it. It is the inline maker's issue specifically — the maker holds
references to instrumented classes — and Mockito's own wording is *"specific, rare"* with *"no
clean way to mitigate this problem completely"*. So `Mockito.framework().clearInlineMocks()` in
an `@AfterAll` is a legitimate response to an observed leak in a very large suite, and is not
something to add pre-emptively.

## Gotchas

**★ Mocking a final type with `withSettings().serializable()` or `.extraInterfaces(...)`.**
Both force the subclass path, and a final type cannot be subclassed. The error names both
settings explicitly. Choose one: mock the final type, or have those settings.

**★ An enum that suddenly cannot be mocked after someone adds a constant body.**
Adding `{ … }` to a single constant makes the enum abstract, and abstract enums have been sealed
since Java 15: *"Sealed abstract enums can't be mocked."* The change looks unrelated to testing
and breaks a mock in another file. Return the literal instead, as the message suggests.

**★ Expecting `final` in the "cannot be stubbed/verified" message to still mean final classes.**
That text predates Mockito 5's default. On the inline maker, final methods of a mockable type
are interceptable. The place `final` still bites is a **spy** — section 13: *"when you spy on
real objects + you try to stub a final method = trouble. Also you won't be able to verify those
method as well."*

**★ Trying to mock `String`, a wrapper type or `Class` to control a boundary.**
They are in `EXCLUDES` and will never be mockable. A test that appears to need this is a test
that should be passing a literal value.

**★ Mocking a `native` method.**
*"Inline mocks require byte code manipulation of a method where native methods do not offer any
byte code to manipulate."* No mock maker will change this. Wrap the call.

**★ Assuming a package-private method of a `java.*` class can be mocked.**
The inline maker mocks package-private methods across packages generally, but *"voluntarily
never mocks package-visible methods within `java.*` packages"*. The exclusion is deliberate and
type-independent.

**★ A sealed interface in your own domain, mocked out of habit.**
*"Sealed interfaces or abstract classes can't be mocked."* The message's own advice is that
*"a non-abstract class can be mocked and used to represent the interface"* — but for a sealed
hierarchy the permitted subclasses are usually the better answer, because a sealed type exists
precisely to enumerate its cases.

**★ Adding `clearInlineMocks()` to every test class as a precaution.**
The javadoc scopes it to *"certain specific, rare scenarios"* and admits *"no clean way to
mitigate this problem completely"*. Adding it everywhere costs teardown time on every test and
signals a problem that is probably not present. Add it when a suite actually exhausts heap.

**★ Reading "Mockito cannot mock this class" as a single cause.**
`prettifyFailure` produces at least six distinct messages — arrays, final-with-settings, sealed
abstract enum, sealed abstract type, private type, and a generic fallback that asks you to open
a GitHub issue. Read the second line, not the first.

**★ Treating `mockSingleton` as the way to test enum-dependent logic.**
It exists for objects *"for which you don't control initialization, assignment, or access"*. An
enum in your own domain is not that; behaviour that varies by constant belongs in a collaborator
that takes the enum as a parameter.

## Interview questions

**★ What can Mockito 5 still not mock?**
`Class`, `String`, `WeakReference` and the primitive wrappers (an explicit exclusion set);
primitives themselves; arrays; sealed abstract classes and interfaces, including abstract enums,
which have been sealed since Java 15; private types; and `native` methods. Independently of the
type, `equals()`, `hashCode()` and `private` methods can never be stubbed or verified, and
package-visible methods inside `java.*` are excluded by choice.

**★ Why can't a final class be mocked with `serializable()` or `extraInterfaces()`?**
Because both settings make the mock maker fall back to generating a subclass, and a final class
cannot be subclassed. The inline maker's own javadoc lists the three fallback conditions —
abstract type, extra interfaces, explicit serialization — and Mockito's error message names the
two settings directly.

**★ An enum mock stopped working after a code change that looks unrelated. What happened?**
Someone gave one of the constants a class body, which makes the enum abstract, and abstract
enums are sealed as of Java 15. Mockito's message is *"Sealed abstract enums can't be mocked…
You can still return an existing enum literal from a stubbed method call."* — which is also the
fix.

**★ What is `mockSingleton` for?**
Mocking a specific instance whose creation and access you do not control — Java enum constants
are the documented example. It arrived in 5.22.0, returns a `ScopedMock` that is thread-local
and must be closed, and affects only that one instance on that one thread. It is a legacy
affordance, not the general way to test enum-dependent behaviour.

**★ Does the inline mock maker leak memory?**
In *"certain specific, rare scenarios"*, yes — Mockito documents it under section 47 and says
there is *"no clean way to mitigate this problem completely"*. The mitigation is
`Mockito.framework().clearInlineMocks()`, which only makes sense with inline mocking, and it is
a response to an observed problem rather than a default to add.

**★ `final` appears in the "cannot be stubbed/verified" message. Is that still accurate?**
Partly. On Mockito 5's default inline maker, final methods of a mockable type are interceptable,
so the message is a survival from before 5.0.0. Where `final` genuinely still causes trouble is
on a spy: the javadoc's spy gotcha says stubbing a final method on a real object is *"trouble"*
and that you *"won't be able to verify those method as well"*.

**★ Why can't Mockito mock `native` methods, and what do you do about it?**
There is no bytecode to instrument — the javadoc says exactly that. The only route is to wrap
the native call in a method or type of your own and substitute that, which is the same adapter
argument as [10e](10e-the-anti-corruption-adapter.md).

{/* FOOTER */}
