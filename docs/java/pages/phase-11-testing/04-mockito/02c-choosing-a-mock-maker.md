---
title: "Mockito ships three mock makers and lets you choose per project or per mock, which is the documented escape hatch from the inline maker's agent requirement — and @DoNotMock is the opposite lever, a way to declare that a type must not be mocked at all because a mock of it would violate its own contract"
sidebar_label: "02c · Choosing a mock maker"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> sections 39 (*"Mocking final types, enums and final methods"*), 50 (*"Avoiding code generation
> when only interfaces are mocked"*), 51 (*"Mark classes as unmockable"*), 53 (*"Specifying mock
> maker for individual mocks"*) and 54 (*"Mocking/spying without specifying class"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> and the `MockSettings#mockMaker(String)` / `Mock#mockMaker()` declarations.
> JDK 25 · Spring Boot 4.1.1 → Mockito 5.23.0, JUnit Jupiter 6.0.3. **No sandbox** — this page
> carries Java and build configuration, never a fabricated test run.

**[02b · The inline mock maker](02b-the-inline-mock-maker.md) is the default and the reason
final classes are mockable — and the reason JDK 21+ prints an agent warning. This chunk is the
lever underneath that default: Mockito's mock maker is a plugin, there are three of them, and you
can select one for a whole module or for a single mock. It is also where the opposite question
lives — how to declare that a type should never be mocked at all.**

## Choosing a different mock maker

Three are shipped, and you can pick per-project or per-mock.

| Mock maker | Constant | What it does |
|---|---|---|
| inline | `MockMakers.INLINE` | instrumentation + subclassing; **the default since 5.0.0**; can mock final |
| subclass | `MockMakers.SUBCLASS` | classic code generation; cannot mock final types or methods |
| proxy | — (`mock-maker-proxy`) | `java.lang.reflect.Proxy`; **interfaces only** |

**Per project**, via the extension file:

> *"This mock maker can be activated explicitly by the mockito extension mechanism, just create in
> the classpath a file `/mockito-extensions/org.mockito.plugins.MockMaker` containing the value
> `mock-maker-proxy`."*

The same file with `mock-maker-inline` was how you opted *in* before 5.0.0. It is now redundant.

**Per mock**, since 4.8.0:

> *"You may encounter situations where you want to use a different mock maker for a specific test
> only. In such case, you can (temporarily) use `MockSettings#mockMaker(String)` and
> `Mock#mockMaker()` to specify the mock maker for a specific mock which is causing the problem."*

```java
// using annotation
@Mock(mockMaker = MockMakers.SUBCLASS)
Foo mock;
// using MockSettings.withSettings()
Foo mock = Mockito.mock(Foo.class, withSettings().mockMaker(MockMakers.SUBCLASS));
```

The proxy maker's pitch is cost, not capability:

> *"To create such mocks, Mockito requires to setup diverse JVM facilities and must apply code
> generation. If only interfaces are supposed to be mocked, one can however choose to use a …
> ProxyMockMaker that is based on the `java.lang.reflect.Proxy` API which avoids diverse overhead
> of the other mock makers but also limits mocking to interfaces."*

A codebase that mocks only interfaces — which is the codebase this topic keeps arguing for — can
take that trade. It also sidesteps the agent question entirely, because `java.lang.reflect.Proxy`
needs no instrumentation.

## `@DoNotMock` — marking a type unmockable

```java
@DoNotMock("Use a real ExpiryPolicy; a mock cannot satisfy its invariants")
public interface ExpiryPolicy { ... }
```

> *"In some cases, mocking a class/interface can lead to unexpected runtime behavior. For example,
> mocking a `java.util.List` is difficult, given the requirements imposed by the interface. This
> means that on runtime, depending on what methods the application calls on the list, your mock
> might behave in such a way that it violates the interface."*
>
> *"For any class/interface you own that is problematic to mock, you can now mark the class with
> `@DoNotMock`."*

That `List` example is the same point Mockito makes in section 1 — *"In reality, please don't mock
the List class. Use a real instance instead."* A mocked `List` returns `false` from `contains`,
`0` from `size` and an empty list from `subList`, in whatever combination the stubbings happen to
produce; nothing enforces the interface's own contract between those methods.

⚠️ The annotation is on the *mocked type*, so it only helps for types you own. The javadoc notes
you can *"ship your own (to avoid a compile time dependency on a test artifact)"* — Mockito
recognises any annotation with the right name, so a production module can declare its own
`@DoNotMock` without depending on Mockito.

## `mock()` without a class, since 4.10.0

```java
Foo foo = Mockito.mock();
Bar bar = Mockito.spy();
```

> *"Mockito will automatically detect the needed class."*
>
> *"It works only if you assign result of `mock()` or `spy()` to a variable or field with an
> explicit type. With an implicit type, the Java compiler is unable to automatically determine the
> type of a mock and you need to pass in the `Class` explicitly."*

🔴 So `var foo = mock();` cannot work — there is no target type to infer from. Neither can
`someMethod(mock())` where the parameter is generic. The inference is target-typing, nothing
cleverer.

## What choosing a maker does not change

None of the three can mock `equals()`, `hashCode()` or a `private` method — Mockito's own error
text says those *"cannot be stubbed/verified"* regardless, because it uses the first two to
identify mocks and the third is never dispatched through a proxy. And no maker changes the
`java.*` package-visible and `native` restrictions from
[02b](02b-the-inline-mock-maker.md).

So the decision tree is short:

1. **Default (inline)** unless something forces you off it. Configure the agent —
   [02b](02b-the-inline-mock-maker.md) — and it just works.
2. **Proxy**, if the module genuinely mocks only interfaces. No instrumentation, no code
   generation, no agent question, and the constraint it imposes is one good design already
   satisfies.
3. **Subclass**, per mock, as a documented *temporary* workaround for a specific mock the inline
   maker mishandles. Leave a comment saying which mock and why.

## Gotchas

**★ A `/mockito-extensions/org.mockito.plugins.MockMaker` file left over from Mockito 4.**
Containing `mock-maker-inline`, it now selects the default and does nothing. Containing anything
else, it silently changes the mock maker for the entire module — including tests that were written
against the default's capabilities.

**★ Mocking `java.util.List` or another JDK collection.**
Mockito says both *"please don't mock the List class"* and, in the `@DoNotMock` section, that a
mocked `List` *"might behave in such a way that it violates the interface"*. Use a real
collection; it is faster to write and cannot be internally inconsistent.

**★ `var x = mock();` with the no-argument form.**
Target-type inference has no target. The javadoc requires *"a variable or field with an explicit
type"*. The same applies to passing `mock()` straight into a generic parameter.

**★ Switching one mock to `MockMakers.SUBCLASS` and forgetting why.**
It is documented as a *temporary* workaround — *"you can (temporarily) use"* — for a specific mock
causing a specific problem. Without a comment, the next reader cannot tell whether the constraint
still exists.

**★ Choosing the proxy mock maker in a codebase that mocks classes.**
It *"limits mocking to interfaces"*. Everything else fails, and the failure is at mock creation
time in whatever test happens to run first, not at the line that introduced the class mock.

**★ Treating a per-mock `mockMaker` as a permanent setting.**
The javadoc's wording is *"you can (temporarily) use"* — it is a workaround for a specific mock
that is *"causing the problem"*. Without a comment naming the problem, nobody can tell whether it
still exists.

**★ Assuming a different mock maker widens what can be stubbed.**
It does not touch `equals`, `hashCode`, `private`, `native` or package-visible `java.*` methods.
Switching makers changes *how* the proxy is built, not which methods are interceptable in
principle.

**★ `@DoNotMock` expected to work on a third-party type.**
The annotation goes on the type being mocked, so it only helps for types you own. For a library
type you cannot annotate, the discipline has to come from review — see
[10b · Do not mock types you do not own](10b-do-not-mock-types-you-do-not-own.md).

## Interview questions

**★ Is there a mock maker that avoids the agent problem entirely?**
The proxy mock maker, selected with a `mock-maker-proxy` extension file. It uses
`java.lang.reflect.Proxy`, so it needs no instrumentation and no code generation — at the cost of
being *"limits mocking to interfaces"*. For a codebase that only mocks interfaces, which is the
codebase good design produces anyway, that is a reasonable trade.

**★ What is `@DoNotMock` for?**
Marking a type whose contract a mock cannot honour, so that mocking it fails loudly instead of
producing an object that violates its own interface. Mockito's example is `java.util.List`. The
annotation is matched by name, so a production module can ship its own and avoid a compile-time
dependency on a test artifact.

**★ Why does `var foo = mock();` not compile?**
Because the no-argument `mock()` infers the type from the assignment target, and `var` has no
target type of its own — the javadoc requires *"a variable or field with an explicit type"*. The
same limitation applies to passing `mock()` directly into a method parameter whose type is
generic.

{/* FOOTER */}

**★ How many mock makers does Mockito ship and how do you pick one?**
Three: inline (the default since 5.0.0, instrumentation plus subclassing, mocks final types),
subclass (classic code generation, cannot touch final), and proxy (`java.lang.reflect.Proxy`,
interfaces only). Project-wide selection is a `/mockito-extensions/org.mockito.plugins.MockMaker`
file on the classpath containing the maker name; per-mock selection is
`@Mock(mockMaker = MockMakers.SUBCLASS)` or `withSettings().mockMaker(...)`, added in 4.8.0 and
documented as a temporary workaround.

**★ You inherit a project with a `mockito-extensions/org.mockito.plugins.MockMaker` file. What do
you check?**
Its contents. `mock-maker-inline` is now the default, so the file does nothing and should go.
Anything else silently changes the mock maker for the whole module, which can mean tests written
against the inline maker's capabilities — mocking a final class, say — fail in ways that look
unrelated to a configuration file nobody remembers adding.

{/* FOOTER */}
