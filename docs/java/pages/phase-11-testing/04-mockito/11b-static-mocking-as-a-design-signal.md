---
title: "A static call you need to mock is a dependency the constructor never declared, and mockStatic does not remove that coupling — it rents a thread-local exemption from it, once per test, forever, where a two-line adapter interface would have removed it once"
sidebar_label: "11b · Static mocking as a signal"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 48 (*"Mocking static methods"*) and section 16 (*"Real partial mocks"*, for the
> escape clause) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> and the `Mockito.mockStatic(Class)` javadoc's recommendation against mocking standard-library
> statics. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[11](11-static-and-final.md) is the mechanism: `mockStatic`, the thread-local scope, and what
a leaked controller does to the rest of the suite. This is the review question that sits on top
of it. The feature works; the interesting fact is that a codebase which needs it in twenty
places is telling you something specific about itself, and the fix is smaller than the
workaround.**

## 🔴 What a static call actually is

**A static call is a dependency that was never declared.** `LegacyIdGenerator.newId()` inside
`OrderService.confirm` is as much a collaborator as `gateway.charge(...)` — it is just one the
constructor does not mention, the type signature does not admit, and no caller can substitute.
`mockStatic` does not remove that coupling; it buys a scoped, thread-local exemption from it,
per test, forever.

The alternative is the same move as [10c · The refactor that removes the
need](10c-the-refactor-that-removes-the-need.md), pointed at a static:

```java
// Before — the dependency is invisible in the signature and unmockable without mockStatic
public class OrderService {
    public Receipt confirm(OrderId id) {
        String reference = LegacyIdGenerator.newId();     // static, hidden, global
        …
    }
}
```

```java
// After — declare it. One interface, one adapter over the legacy static, one line in the test.
public interface IdGenerator {
    String newId();
}

public class LegacyIdGeneratorAdapter implements IdGenerator {
    @Override public String newId() { return LegacyIdGenerator.newId(); }
}

public class OrderService {
    private final IdGenerator ids;

    public OrderService(IdGenerator ids, …) { this.ids = ids; … }

    public Receipt confirm(OrderId id) {
        String reference = ids.newId();
        …
    }
}
```

```java
// The test: no scope, no thread-locals, no inline mock maker requirement.
@Mock IdGenerator ids;
@InjectMocks OrderService service;

when(ids.newId()).thenReturn("ID-1");
```

The adapter is two lines and needs no test of its own worth writing — it has no logic. What it
buys is that the dependency is now in the constructor, visible to every reader, substitutable
by anything, and testable with the plainest possible mock. The static utility can stay exactly
where it is; you never had to change *it*, only to stop calling it from code you want to test.

**When `mockStatic` is nonetheless the right call:** the static is in a library you cannot wrap
without touching code you do not own *and* the call site is not yours either — the case Mockito
reserves partial mocks for, in [10d · The honest exceptions](10d-the-honest-exceptions.md).
Everything else is an undeclared dependency with a workaround attached.


## The four kinds of static, and what each deserves

Not every `static` is a design problem. Sort them before reaching for anything.

| Kind | Example | Does it need mocking? |
|---|---|---|
| **Pure function** | `Math.max`, `Objects.requireNonNull`, `String.join` | No. Deterministic, no I/O — call it. |
| **Factory / value constructor** | `Money.of`, `List.of`, `Optional.of` | No. It is data construction. |
| **Ambient state read** | `LocalDate.now()`, `System.getenv`, `System.currentTimeMillis` | No — inject the state. `Clock`, a config object. |
| **Hidden collaborator** | `LegacyIdGenerator.newId()`, `AuditLog.record(...)`, an SDK's `Client.create()` | This is the real case: declare it. |

The first two categories cover most `static` in a healthy codebase, and mocking them would be
mocking a value or a pure function — the argument of
[10f](10f-mocking-jdk-types.md) and [10g](10g-mocking-value-objects.md). The third has a
documented answer in the JDK itself. Only the fourth is a genuine dependency, and only the
fourth is worth an adapter.

That is why "we need `mockStatic` everywhere" is a finding rather than a preference: it means
category four is large, which means substantial parts of the application cannot be substituted
by any caller, in production or in a test.

## The cost, per test versus once

Set the two costs side by side.

**`mockStatic`, per test that touches the static:** one scoped resource to open and close; a
try-with-resources block or a `@Mock MockedStatic<T>` field; a dependency on the inline mock
maker and therefore on the Java agent story in
[02b](02b-the-inline-mock-maker.md); the thread-local caveat, which means the test cannot
exercise anything asynchronous through that path; and an ambient rewrite that affects every
caller on the thread for the duration, not just the class under test.

**The adapter, once:** an interface with the methods you actually use; an implementation whose
body is `return TheStatic.method(args);`; a constructor parameter. After that every test is
`@Mock TheThing` — the same thing every other collaborator gets.

The adapter also does something `mockStatic` structurally cannot: it makes the dependency
substitutable **in production**. A feature flag, a second implementation, a decorator that adds
metrics — all become possible because the call goes through a reference instead of a class name.

## When `mockStatic` is genuinely the answer

Three cases, and they are narrow:

1. **The static is in a library you cannot wrap, called from a call site you do not own.** The
   same shape Mockito reserves partial mocks for — *"code you cannot change easily"*, per
   [10d · The honest exceptions](10d-the-honest-exceptions.md).
2. **You are characterising legacy code before extracting the adapter**, and the static mock is
   the scaffolding that makes the extraction safe. With a ticket number, as in 10d.
3. **The static is the thing under test**, and the mock is of a *different* static it calls —
   not of the one whose behaviour you are asserting. Mocking the SUT's own static is
   [10](10-never-mock-the-class-under-test.md) with a class-level target.

And one non-case that comes up constantly: *"the adapter is boilerplate"*. Two lines of
delegation with no branches is not boilerplate that can rot; it has nothing to get wrong. The
`mockStatic` scope, by contrast, is boilerplate that can rot — a missing `close()` is a real
defect in a way that a delegating method never is.

## Gotchas

**★ Reaching for `mockStatic` on a static in code you own.**
That is the case where the two-line adapter costs less than the scope management, and it removes
the problem permanently instead of per test. `mockStatic` on your own static utility is a
decision to keep an undeclared dependency.

**★ Wrapping a pure function or a factory in an adapter "for consistency".**
`Math.max` and `Money.of` need neither an adapter nor a mock. Extracting them produces an
interface nobody benefits from and a mock that can return a value the real function never
would. Sort the static into one of the four kinds before doing anything.

**★ Introducing the adapter but leaving the static call in a second place.**
The class now has both a declared dependency and a hidden one, and the test's mock covers only
the first. Grep for the static's class name after the refactor; a single remaining call site
keeps the whole class untestable in the same way it was.

**★ An adapter with a method per static, mirroring the utility class.**
The adapter's surface should be what your application uses, not what the utility offers.
A fourteen-method `LegacyUtilsAdapter` is the utility class with an interface bolted on, and
every test that mocks it is back to guessing at fourteen behaviours.

**★ Treating `mockStatic` as equivalent to injection because "both let me control it".**
They do not have the same reach. Injection is substitutable in production, applies on every
thread, and needs no mock maker; `mockStatic` is test-only, one thread, and scoped. The two are
not alternatives with different syntax — they solve different amounts of the problem.

**★ A `mockStatic` count that grows without anyone noticing.**
It is a greppable metric. `grep -rc 'mockStatic' src/test` climbing over releases is a direct
measurement of how much of the codebase cannot be substituted by a caller, and it is worth
watching for exactly that reason.

## Interview questions

**★ You need `mockStatic` in a new test. What does that tell you about the design?**
That the class under test has a dependency its constructor never declared. A static call cannot
be substituted by a caller, so the class is welded to one implementation and the test has to buy
a thread-local exemption to get around it. If the static is yours, or the call site is, the fix
is a two-line adapter interface injected through the constructor — after which the test is a
plain `@Mock` with no scope to manage.

**★ Is it wrong to use `mockStatic` at all?**
No, but the acceptable cases are narrow: a static in a library you cannot wrap, called from code
you cannot change, or scaffolding during a characterisation-then-extract refactor. That is the
same escape clause Mockito states for partial mocks. Everywhere else it is a per-test workaround
for a design problem that a constructor parameter fixes once.

**★ Should every static call be wrapped in an adapter?**
No, and doing so is its own mistake. Pure functions and value factories — `Math.max`,
`Objects.requireNonNull`, `Money.of`, `List.of` — should be called directly; wrapping them
produces an interface with no purpose and a mock that can return impossible values. Ambient
state reads like `LocalDate.now()` have their own documented answer, a `Clock`. Only a genuine
hidden collaborator earns an adapter.

**★ What does the adapter buy that `mockStatic` does not?**
Substitutability in production, not just in tests: a second implementation, a feature flag, a
decorator that adds retries or metrics. It also removes the inline-mock-maker dependency, works
across threads, and eliminates a scoped resource that a test can leak into the rest of the
suite.

**★ Someone objects that the adapter is boilerplate. What is the counter-argument?**
That the boilerplate has no branches and therefore nothing to get wrong, while the thing it
replaces — a scoped, thread-local mock that must be closed — is boilerplate that can fail. One
of the two forms of ceremony can produce a defect; it is not the adapter.

**★ How would you measure how much of a codebase has this problem?**
Count `mockStatic` occurrences in the test tree, and count the distinct classes they target. The
first number is how often tests pay the workaround; the second is how many hidden collaborators
the application actually has. A rising first number with a static second is worse than the
reverse — it means the same undeclared dependency is being worked around again and again.

{/* FOOTER */}
