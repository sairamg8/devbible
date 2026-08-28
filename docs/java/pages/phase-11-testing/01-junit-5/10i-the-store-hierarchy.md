---
title: "A Store read walks up the context hierarchy and a Store write does not, which gives you per-test isolation for free and one specific bug for free too — and in JUnit 6 the whole compute-if-absent family was renamed out from under every example you will find online"
sidebar_label: "10i · The store hierarchy"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Keeping State in Extensions"
> ([extensions/keeping-state-in-extensions](https://docs.junit.org/6.0.3/extensions/keeping-state-in-extensions.html));
> javadoc for `ExtensionContext.Store`
> ([Store](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.Store.html))
> and `ExtensionContext`
> ([ExtensionContext](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[10h](10h-keeping-state.md) argued that per-test state belongs in the `Store` and showed
how to scope it with a `Namespace`. This chunk is the single fact that makes the `Store`
more than a `Map`: reads inherit up the context tree and writes do not. Every clever thing
an extension does with state, and one persistent bug, follows from that asymmetry.**

## The mechanism

> *"As illustrated by the diagram above, stores are hierarchical in nature. When looking up a
> value, if no value is stored in the current `ExtensionContext` for the supplied key, the
> stores of the context's ancestors will be queried for a value with the same key in the
> `Namespace` used to create this store."*

The javadoc repeats it on every read method, for example on `get(Object)`:

> *"If no value is stored in the current `ExtensionContext` for the supplied `key`, ancestors
> of the context will be queried for a value with the same `key` in the `Namespace` used to
> create this store."*

The tree is the same one the engine executes: the context for a test method is a child of the
context for its class, a `@Nested` class's context is a child of its enclosing class's
([06c](06c-nesting-lifecycle-and-limits.md)), and everything descends from the engine root.

## Three consequences you can build on

**Writes are local.** `put` on a method-level context is invisible to the class-level context
and to every sibling method. That is per-test isolation, obtained for free rather than by
remembering to clean up.

**Reads see ancestors.** Whatever a `BeforeAllCallback` stored in the class-level store is
readable from every test method's store, with the same key and the same namespace, without
your passing anything down.

**A child write shadows a parent value, for that context only.** Store a default at class
level, override it in one test, and that test sees its own value while every other test still
sees the default. Nothing was mutated for anyone else.

That last one is the pattern worth naming: **default at the container, override per test.**
An extension that reads a configuration annotation can put the class-level answer in the
class store and let a method-level annotation shadow it, and the lookup does the precedence
for you.

```java
@Override
public void beforeAll(ExtensionContext context) {
    context.getStore(NAMESPACE).put(TIMEOUT, readTimeoutFrom(context.getRequiredTestClass()));
}

@Override
public void beforeEach(ExtensionContext context) {
    findMethodOverride(context).ifPresent(
        override -> context.getStore(NAMESPACE).put(TIMEOUT, override));
}

// any later callback, at method level:
Duration timeout = context.getStore(NAMESPACE).get(TIMEOUT, Duration.class);
```

The read in the last line finds the method-level value if `beforeEach` wrote one and the
class-level value otherwise. No `if`, no null check, no precedence logic.

## The bug the same mechanism produces

A value you meant to be per-test, written to the **class-level** context by mistake, is now
shared by every test in the class — and it will *work* in a single-test run, work in the
first test of a full run, and fail in the second. It presents as an ordering problem
([11 · execution order](11-execution-order.md)) and you will go looking for shared static
state that is not there.

The tell: `context.getParent()` or a hard-coded `getRoot()` in a method-level callback, or a
`BeforeAllCallback` writing something whose name contains "current".

## Reaching further up on purpose

> *"The root `ExtensionContext` represents the engine level so its `Store` may be used to
> store or cache values that are used by multiple test classes or extension."*

`context.getRoot().getStore(namespace)` is the documented way to cache one thing for the
entire engine run — one container, one server, one loaded dataset. What that does to its
lifetime, and when it gets closed, is [10j · store cleanup](10j-store-cleanup.md).

## The API, and the JUnit 6 rename you will trip over

**Reads** — all three walk the ancestor chain:

| | |
|---|---|
| `get(Object key)` | returns `Object`, potentially `null` |
| `get(Object key, Class<V> requiredType)` | typed, potentially `null` |
| `getOrDefault(Object key, Class<V> requiredType, V defaultValue)` | typed, never `null`; `STABLE` since 5.5 |

**Writes** — `put(Object key, @Nullable Object value)`, `remove(Object key)` and
`remove(Object key, Class<V> requiredType)`. Note `remove` returns the removed value, which
is why the `TimingExtension` in [10b](10b-writing-one.md) can read and clear the start time in
one call.

🔴 **The compute-if-absent family was renamed in JUnit 6.0.** The javadoc is unambiguous:

> *"`@Deprecated(since="6.0")` … `getOrComputeIfAbsent(Class<V> type)` … Deprecated. Please
> use `computeIfAbsent(Class)` instead."*

All three `getOrComputeIfAbsent` overloads are deprecated as of 6.0; the replacements are
`computeIfAbsent`, marked `@API(status = MAINTAINED, since = "6.0")`. Every tutorial, every
answer on Stack Overflow and every extension written against 5.x uses the old name. It still
compiles, with a deprecation warning ([02b · what JUnit 6 changed](02b-what-junit-6-changed.md)).

The three shapes:

```java
// keyed by type, invokes the type's default constructor
MyThing t = store.computeIfAbsent(MyThing.class);

// arbitrary key, untyped result
Object v = store.computeIfAbsent(key, k -> expensive(k));

// arbitrary key, typed result — prefer this one
MyThing t = store.computeIfAbsent(key, k -> new MyThing(k), MyThing.class);
```

⚠️ There is one behavioural difference hiding in the wording. The deprecated
`getOrComputeIfAbsent(K, Function)` computes *"If no value is found for the supplied `key`"*.
The new `computeIfAbsent(K, Function)` computes *"If no value is found for the supplied `key`
**or the value is `null`**"*. A deliberately stored `null` is now recomputed rather than
returned. If `null` in your store meant "already computed, and the answer was nothing", that
meaning is gone.

### Why `computeIfAbsent` is not merely a convenience

`if (store.get(k) == null) store.put(k, expensive());` is check-then-act. Under `CONCURRENT`
execution ([12 · parallel execution](12-parallel-execution.md)) two callbacks on two threads
can both see nothing and both create — and if the thing is a server, a container or a schema,
you now have two of them, one of which nobody will ever close. `computeIfAbsent` is the
supported way to say "once", and the guide's own root-context caching example uses it for
exactly that reason.

## Gotchas

**★ Writing to the class-level context when you meant the method-level one.**
Writes are local to the context you called `getStore` on, but *reads* walk upwards — so the
value appears to work and then leaks into every other test in the class. It presents as an
order-dependent failure, and you will look for shared static state that is not there.

**★ Expecting a write in a child context to be visible to the parent.**
It is not. Only reads inherit. A `BeforeEachCallback` that stashes something in the
method-level store cannot hand it to an `AfterAllCallback` — the `AfterAllCallback` is asking
a context that is an *ancestor*, and ancestors do not see downwards.

**★ Reading from the root when you only meant "somewhere up there".**
`getRoot()` is not "my parent" — it is the engine context, shared by every test class in the
run. A value put there outlives your class and is visible to every other extension using the
same namespace.

**★ Still calling `getOrComputeIfAbsent` on JUnit 6.**
Deprecated since 6.0 in all three overloads; the replacement is `computeIfAbsent`. It compiles
today and will not forever, and every 5.x example you copy uses the old name.

**★ Replacing `getOrComputeIfAbsent` with `computeIfAbsent` while relying on a stored `null`.**
The new method recomputes when the stored value is `null`; the deprecated one returned it. If
a `null` in your store carried meaning, that meaning is gone and you will silently recompute.

**★ Hand-rolling `get`-then-`put` instead of `computeIfAbsent`.**
Check-then-act. Under concurrent execution two callbacks can both see nothing and both create,
so you get two servers, two containers or two schemas — and the surplus one is never closed,
because only the stored one is.

**★ Using the untyped `get(Object)` and casting.**
There is a typed overload on every read method for a reason: a `ClassCastException` thrown
from inside an extension produces a failure that names your extension, not the test's actual
problem, and reviewers will spend the afternoon in the wrong file.

**★ Assuming `getOrDefault` writes the default.**
It does not. It is a read with a fallback; nothing is stored, so the next call computes the
fallback again. `computeIfAbsent` is the one that stores.

**★ Relying on ancestor lookup while using a per-method namespace.**
Ancestors are queried *"in the `Namespace` used to create this store"*. If your namespace
includes the test method, the class-level context has nothing in that namespace and the walk
finds nothing. Per-method namespaces and hierarchy inheritance are mutually exclusive by
construction — pick one deliberately.

## Interview questions

**★ What does the `Store`'s hierarchy actually do?**
Reads inherit and writes do not. A lookup that finds nothing in the current context's store
queries the stores of that context's ancestors, in the same namespace, for the same key.
Writing goes only to the context you asked for the store on. That gives per-test isolation for
writes and free access to container-level values for reads, and it means a child can shadow a
parent's value without mutating it.

**★ You store a value from a `@BeforeAll`-time callback and read it in a test-level callback.
Does that work, and what about the reverse?**
It works: the test-method context is a descendant of the class context, and reads walk up the
ancestor chain in the same namespace. The reverse does not — writes are local, so nothing a
method-level callback stores is visible to a class-level one. A class-level callback that
needs per-test results has to read a container-level key that the per-test callbacks
deliberately update.

**★ How do you create something exactly once for the whole test run?**
`computeIfAbsent` on the store obtained from `context.getRoot()`, which the guide describes as
the engine-level context whose store may be used to cache values used by multiple test
classes. `computeIfAbsent` rather than get-then-put, because the latter is a check-then-act
race under concurrent execution and can leave you with two of an expensive thing.

**★ What changed about the `Store` API in JUnit 6?**
All three `getOrComputeIfAbsent` overloads are deprecated since 6.0 and replaced by
`computeIfAbsent`, which is `MAINTAINED` since 6.0. There is also a semantic difference worth
knowing: the new method recomputes when the stored value is `null`, where the deprecated one
returned the `null`. Every pre-6 example online uses the old name.

**★ An extension needs a class-level default that individual tests can override. How would you
implement the precedence?**
Put the default in the class-level store during a `BeforeAllCallback`, and let a
`BeforeEachCallback` `put` an override into the method-level store when the method asks for
one. A read at method level then returns the override if present and falls through to the
class-level value otherwise. The hierarchy is the precedence rule; you do not write one.

**★ Why does `computeIfAbsent` matter more than it looks?**
Because it is atomic with respect to the "does it exist yet" question, and the alternative is
check-then-act. Under parallel execution the naive form can construct an expensive resource
twice, and the copy that loses the race is never stored — so it is also never closed when the
store is closed, which turns a duplication bug into a leak.

{/* FOOTER */}
