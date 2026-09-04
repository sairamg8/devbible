---
title: "A spy is a generated subclass wrapped around a copy, and the subclass is what decides which calls Mockito can see — self-calls inside the real body DO go through the spy and are stubbable, while private, final, native, equals and hashCode never are, and an abstract method silently returns a default instead of the real implementation you asked for"
sidebar_label: "08b · What a spy can intercept"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §13 gotcha 3 and the javadoc of `Mockito.spy(Object)`,
> [`Spy`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Spy.java),
> [`AdditionalAnswers.delegatesTo`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/AdditionalAnswers.java),
> and the bodies of
> [`CallsRealMethods`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/answers/CallsRealMethods.java)
> and `Reporter` under `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**[08 · Spies](08-spies.md) settles the copy: there are two objects and the spy holds a snapshot
of the other one's fields. This chunk settles the second half of a spy's construction — the
generated subclass. Everything the subclass can override, Mockito sees; everything it cannot,
runs the real code invisibly. That single line divides a spy's behaviour into "surprisingly
powerful" and "silently useless", and both halves catch people. Creating a spy when you have
no instance to hand it is [08c · Creating a spy without an instance](08c-creating-a-spy-without-an-instance.md);
the `when` / `doReturn` asymmetry is [08d · Stubbing a spy](08d-stubbing-a-spy.md); the design
argument is [08e · Partial mocks](08e-partial-mocks.md).**

## 🔴 Self-calls DO go through the spy — the opposite of what people expect

This is the most commonly mis-stated fact about spies, and Mockito documents it in an unlikely
place: the javadoc of `AdditionalAnswers.delegatesTo`, which exists to contrast itself with a
spy.

> *"The regular spy (`Mockito#spy(Object)`) contains **all** state from the spied instance and
> the methods are invoked on the spy. The spied instance is only used at mock creation to copy
> the state from. If you call a method on a regular spy and it internally calls other methods
> on this spy, those calls are remembered for verifications, and they can be effectively
> stubbed."*
>
> *"The mock that delegates simply delegates all methods to the delegate. The delegate is used
> all the time as methods are delegated onto it. If you call a method on a mock that delegates
> and it internally calls other methods on this mock, those calls are **not** remembered for
> verifications, stubbing does not have effect on them, too."*

Because the spy *is* a generated subclass and the real method body runs **on the spy instance**,
`this.other()` inside it dispatches virtually to the spy's override. So:

```java
class Report {
    String render() { return header() + body(); }   // self-call
    String header() { return "H"; }
    String body()   { return "B"; }
}

Report spy = spy(new Report());
doReturn("X").when(spy).header();

spy.render();               // returns "XB" — the self-call hit the stub
verify(spy).header();       // passes — the self-call was recorded
```

That is precisely what `mock(Report.class, delegatesTo(new Report()))` would **not** do: there,
`render()` runs on the delegate, `this` is the delegate, and `header()` is a plain call on a
plain object. See [03d · Additional answers](03d-additional-answers.md) for when the delegating
form is the one you want (a `final` class behind an interface, an already-proxied object).

⚠️ The exception is dispatch that was never virtual to begin with: a `private` method, a
`static` method, a `final` method, or a constructor calling another constructor. Those cannot
be overridden by the generated subclass, so a self-call to one of them runs the real code and
is invisible to the spy.

## Final, private, native — and non-public parents

Gotcha 3 of the `spy` javadoc:

> *"Watch out for final methods. Mockito doesn't mock final methods so the bottom line is: when
> you spy on real objects + you try to stub a final method = trouble. Also you won't be able to
> verify those method as well."*

🔴 **Read this against the mock maker you are actually running.** Mockito 5's default is the
inline mock maker, which *can* instrument final classes and final methods
([02b · The inline mock maker](02b-the-inline-mock-maker.md)) — the javadoc sentence above
predates that default and is written for the subclass maker. What is still true at 5.23.0 is
`Reporter`'s own list, and it is longer than the javadoc's. `missingMethodInvocation` — the
message you get when `when(...)` did not see a mock call — spells it out:

```text
when() requires an argument which has to be 'a method call on a mock'.
For example:
    when(mock.getArticles()).thenReturn(articles);

Also, this error might show up because:
1. you stub either of: final/private/native/equals()/hashCode() methods.
   Those methods *cannot* be stubbed/verified.
   Mocking methods declared on non-public parent classes is not supported.
2. inside when() you don't call method on mock but on some other object.
```

Five categories, not one: **final, private, native, `equals()`, `hashCode()`** — plus anything
declared on a **non-public parent class**. `unfinishedVerificationException` carries the same
list for the verification side.

`private` and `native` are not virtual at the bytecode level, so no subclass and no
instrumentation strategy Mockito uses can intercept them. `equals` and `hashCode` are reserved
because Mockito needs them for its own identity bookkeeping. On a spy the consequence is the
one that costs time: a call to a private method **silently runs the real body** — very often
exactly the method you were trying to neutralise, since "it does I/O and it is private" is the
usual reason someone reached for a spy at all. [11 · Static and final](11-static-and-final.md)
and [11d](11d-final-enums-and-the-unmockable.md) are the full account.

⚠️ **What the documentation does not settle:** which `equals`/`hashCode` implementation actually
executes on a spy — the real class's, or Mockito's identity-based one. The libraries' messages
only state that those two methods cannot be *stubbed or verified*. I could not confirm the
runtime behaviour from a primary source, so do not build a test on it: if a spy's identity
matters — putting it in a `HashSet`, using it as a `Map` key, comparing it to the original —
assert on something else.

## 🔴 An abstract method on a spy returns a default, silently

A spy's default answer is `CALLS_REAL_METHODS`, and its implementation has a branch most people
never read:

```java
public Object answer(InvocationOnMock invocation) throws Throwable {
    if (Modifier.isAbstract(invocation.getMethod().getModifiers())) {
        return RETURNS_DEFAULTS.answer(invocation);      // <- not the real method
    }
    return invocation.callRealMethod();
}
```

There is no real method to call, so the abstract method quietly returns `null`, `0` or `false`
like an ordinary unstubbed mock. That is fine and intended for
`spy(SomeAbstractClass.class)` — you stub the abstract methods and let the concrete ones run —
but it means a template-method class spied for its concrete logic will happily execute that
logic against `null`s handed to it by its own abstract hooks, and nothing warns you.

The **explicit** form is loud where the default answer is quiet. `CallsRealMethods.validateFor`
rejects it, and `Reporter.cannotCallAbstractRealMethod` assembles:

```text
Cannot call abstract real method on java object!
Calling real methods is only possible when mocking non abstract method.
  //correct example:
  when(mockOfConcreteClass.nonAbstractMethod()).thenCallRealMethod();
```

So `doCallRealMethod().when(spy).someAbstractMethod()` throws, while relying on the default
answer for the same method returns `null`. Same situation, two completely different outcomes,
and the quiet one is the default.

## Verification on a spy counts the self-calls too

This follows directly from the first section but bites separately, because the count is
invisible in the test source:

```java
Report spy = spy(new Report());

spy.render();                       // render() internally calls header()

verify(spy, times(1)).header();     // FAILS if the test also called header() itself
verify(spy).render();               // fine
```

`verify(spy, times(1))` counts every recorded invocation, and the self-call from inside
`render()` is recorded. A test that calls `spy.header()` for its arrangement and then verifies
`times(1)` is counting two. On a plain mock this never happens, because the real `render()`
body never runs. The habit that avoids it is
[05d · Verifying too much](05d-verifying-too-much.md)'s: verify the outward-facing call, not
the internal one.

## Gotchas

**★ Believing self-calls bypass the spy.**
They do not. The real body executes *on the spy*, so `this.other()` dispatches to the spy's
override and is both stubbable and verifiable. This is the single most common wrong answer in
interviews, and it is the delegating mock — `delegatesTo` — that has the opposite behaviour.

**★ Trying to stub a `private` method on a spy.**
It runs the real body. `Reporter` lists final, private, `equals` and `hashCode` as never
stubbable. The documented route is widening the method's visibility or extracting the
responsibility — [10c · The refactor](10c-the-refactor-that-removes-the-need.md).

**★ Expecting the spy to carry the annotations of the spied type.**
The javadoc: *"Note that the spy won't have any annotations of the spied type, because CGLIB
won't rewrite them. It may troublesome for code that rely on the spy to have these
annotations."* Anything that reads annotations reflectively — a validator, a serialiser, a
framework scanner — will see a bare class.

**★ Spying a class whose behaviour depends on `getClass()`.**
The spy's class is a generated subclass, so `getClass()`, `getClass().getName()` and
`getClass().getSimpleName()` all return the synthetic type, not yours. Code that switches on
its own class name, or uses it as a map key, changes behaviour under a spy.

**★ Expecting an abstract method on a spy to run something.**
It cannot — `CallsRealMethods` checks `Modifier.isAbstract` first and delegates to
`RETURNS_DEFAULTS`. You get `null`, and the concrete methods that call it get `null` too.

**★ `doCallRealMethod()` on an abstract method.**
That one *does* throw: *"Cannot call abstract real method on java object! Calling real methods
is only possible when mocking non abstract method."* The inconsistency is the point — the
implicit path is silent, the explicit path is loud.

**★ Verifying `times(n)` on a method the spy also calls internally.**
The self-call is recorded, so the count includes it. This failure mode does not exist on a
plain mock and it is invisible in the test source, because the extra call is inside production
code.

**★ Spying a method inherited from a non-public parent class.**
`Reporter` states it in the same breath as final and private: *"Mocking methods declared on
non-public parent classes is not supported."* The call runs the real implementation, is not
recorded, and no exception is raised at spy-creation time.

**★ Trying to neutralise a `native` method.**
`native` is on the never-stubbable list alongside final and private. Anything JNI-backed runs
for real on a spy.

**★ Relying on a spy's identity — `equals`, `hashCode`, `HashSet` membership.**
Those two methods are explicitly excluded from stubbing and verification, and the documentation
does not state which implementation runs. Assert on a field or an outcome instead.

## Interview questions

**★ If a real method on a spy calls another method on the same object, is that call recorded?**
Yes — as long as it is virtually dispatched. The real body runs *on the spy instance*, which is
a generated subclass, so `this.other()` hits the spy's override: it is recorded for
verification and it can be stubbed. `AdditionalAnswers.delegatesTo` is the construct with the
opposite behaviour, and its javadoc is where Mockito documents the contrast.

**★ What is the difference between `spy(obj)` and `mock(Type.class, delegatesTo(obj))`?**
The spy copies state into a new object and runs methods on the spy, so self-calls are recorded
and stubbable. The delegating mock forwards each call to the original object, which runs its
own internals normally — those self-calls are *"not remembered for verifications, stubbing does
not have effect on them, too."* The javadoc calls the delegating form *"less powerful than the
regular spy but … useful when the regular spy cannot be created"*, naming final classes behind
an interface and already-proxied objects.

**★ Can you stub a private method on a spy?**
No. `Reporter` states it flatly: *"Following methods \*cannot\* be stubbed/verified:
final/private/equals()/hashCode()."* Private methods are not virtual, so the generated subclass
cannot intercept them; the real body runs. Widening the visibility or extracting the
responsibility into a collaborator are the honest options.

**★ You spy an abstract class and a concrete method returns nonsense. Why?**
Because the concrete method called an abstract one, and `CallsRealMethods` returns the type
default for abstract methods rather than calling anything — its first line is
`if (Modifier.isAbstract(invocation.getMethod().getModifiers())) return RETURNS_DEFAULTS.answer(invocation);`.
The concrete logic therefore ran against `null`. Stub the abstract hooks explicitly.

**★ Why does `doCallRealMethod()` on an abstract method throw when the spy's default answer
does not?**
Different code paths. The default answer is `CallsRealMethods.answer`, which silently
substitutes `RETURNS_DEFAULTS` for abstract methods. The explicit stubbing goes through
`CallsRealMethods.validateFor`, which calls `Reporter.cannotCallAbstractRealMethod()` and fails
the test. One is a fallback, the other is a stated intention Mockito can reject.

**★ Your `verify(spy, times(1)).parse(...)` fails saying it was called twice, and the test
calls it once. What is going on?**
The spy's real code called it as well. On a spy, self-calls are recorded, so the invocation
count spans both the test's call and production code's. Verify the entry point instead, or
accept the real count once you have read the implementation — which is itself a sign the test
is coupled to internals.

**★ Which method kinds can a spy never intercept, and why does that list matter more for a spy
than for a mock?**
Final (under the subclass maker), private, native, `equals`, `hashCode`, and anything declared
on a non-public parent class. It matters more on a spy because a mock's uninterceptable method
would just not exist as behaviour, whereas a spy's runs the real implementation — the exact
side effect, I/O or exception you created the spy to suppress — with no error and no
recording.

{/* FOOTER */}
