---
title: "InOrder verification is greedy and its cursor only moves forward, which is why calls(n) exists, why atLeast(n) inside an InOrder quietly consumes every remaining match, and why inOrder.verifyNoMoreInteractions() can pass on the same mock where the static one fails"
sidebar_label: "05b · InOrder"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 6 (*"Verification in order"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> the `inOrder` and `calls` method javadocs on the same class, and the
> interface javadoc of
> [`InOrder`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InOrder.java)
> including `InOrder#verifyNoMoreInteractions()`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Ordering is the strongest claim interaction testing can make and the one most likely to break
on a refactor that changed nothing observable. Mockito supports it well, across multiple mocks,
but the implementation has a documented property — it is *greedy* — that changes what a
subsequent verification sees. This chunk continues [05 · Verification](05-verification.md);
async verification with `timeout` and `after` is
[05c · Async verification](05c-async-verification.md).**

## `InOrder`, single mock and several

```java
// A. Single mock whose methods must be invoked in a particular order
List singleMock = mock(List.class);

//using a single mock
singleMock.add("was added first");
singleMock.add("was added second");

//create an inOrder verifier for a single mock
InOrder inOrder = inOrder(singleMock);

//following will make sure that add is first called with "was added first", then with "was added second"
inOrder.verify(singleMock).add("was added first");
inOrder.verify(singleMock).add("was added second");

// B. Multiple mocks that must be used in a particular order
List firstMock = mock(List.class);
List secondMock = mock(List.class);

//using mocks
firstMock.add("was called first");
secondMock.add("was called second");

//create inOrder object passing any mocks that need to be verified in order
InOrder inOrder = inOrder(firstMock, secondMock);

//following will make sure that firstMock was called before secondMock
inOrder.verify(firstMock).add("was called first");
inOrder.verify(secondMock).add("was called second");

// Oh, and A + B can be mixed together at will
```

Two properties that make it usable:

> *"Verification in order is flexible - **you don't have to verify all interactions**
> one-by-one but only those that you are interested in testing in order."*
>
> *"Also, you can create an InOrder object passing only the mocks that are relevant for in-order
> verification."*

So an `InOrder` is a claim about the *relative* order of the interactions you name, on the mocks
you name — not a transcript. Interactions in between are ignored, and mocks not passed to
`inOrder(...)` are invisible to it.

### 🔴 It is greedy, and the javadoc says so in one line

> *"`InOrder` verification is 'greedy', but you will hardly ever notice it. If you want to find
> out more, read
> [this wiki page](https://github.com/mockito/mockito/wiki/Greedy-algorithm-of-verification-InOrder)."*

"Greedy" means a verification consumes as many matching invocations as its mode allows, moving
the cursor past all of them. You notice it in exactly one place — when the mode is unbounded:

- `inOrder.verify(mock, atLeast(2)).foo()` against five `foo()` calls marks **all five** as
  verified and leaves the cursor at the end.
- `inOrder.verify(mock, calls(2)).foo()` consumes **two** and leaves three for the next
  verification.

That is precisely the distinction `calls(n)` was added for.

## `calls(n)` — the in-order counter

```java
inOrder.verify(mock, calls(2)).someMethod("some arg");
```

> - *"will not fail if the method is called 3 times, unlike times( 2 )"*
> - *"will not mark the third invocation as verified, unlike atLeast( 2 )"*
> - *"This verification mode can only be used with in order verification."*

| Mode inside `InOrder` | Fails on extra calls? | Consumes |
|---|---|---|
| `times(2)` | yes | the matching set, and demands it be exactly 2 |
| `atLeast(2)` | no | **all** remaining matches — greedy |
| `calls(2)` | no | exactly 2, cursor advances by 2 |

`calls` is the right mode when a repeated interaction sits *in the middle* of a sequence you are
still verifying: three retries, then a commit. `atLeast(3)` would swallow the commit's position
in the ordering; `calls(3)` leaves the cursor exactly where the commit is.

⚠️ `calls` outside an `InOrder` is an error — *"This verification mode can only be used with in
order verification."*

## `inOrder.verifyNoMoreInteractions()` is not `Mockito.verifyNoMoreInteractions()`

> *"Verifies that no more interactions happened **in order**. Different from
> `Mockito#verifyNoMoreInteractions(Object...)` because the order of verification matters."*

```java
mock.foo(); //1st
mock.bar(); //2nd
mock.baz(); //3rd

InOrder inOrder = inOrder(mock);

inOrder.verify(mock).bar(); //2n
inOrder.verify(mock).baz(); //3rd (last method)

//passes because there are no more interactions after last method:
inOrder.verifyNoMoreInteractions();

//however this fails because 1st method was not verified:
Mockito.verifyNoMoreInteractions(mock);
```

The in-order form asks *"is there anything after my cursor?"*; the static form asks *"is there
anything unverified anywhere?"* `foo()` happened before the cursor, so the first passes and the
second does not. Two methods one word apart with genuinely different meanings.

## Static mocks participate in ordering

```java
First firstMock = mock(First.class);
MockedStatic<StaticSecond> staticSecondMock = mockStatic(StaticSecond.class);
InOrder inOrder = inOrder(firstMock, StaticSecond.class);

firstMock.add("was called first");
StaticSecond.doSomething("foobar");

inOrder.verify(firstMock).add("was called first");
inOrder.verify(staticSecondMock, () -> StaticSecond.doSomething("foobar"));
inOrder.verifyNoMoreInteractions();
```

Note you pass the **class** to `inOrder(...)` and the `MockedStatic` handle to `verify`. Static
mocking, and why needing it is a design signal, is
[11 · Static and final](11-static-and-final.md).

## When ordering is worth asserting, and when it is not

**Worth it** — the order is the behaviour:

- Begin transaction, write, commit. Committing before writing is a bug.
- Acquire lock, mutate, release. Any other order is a bug.
- Validate, then charge. Charging first is a bug that costs money.
- Publish the event *after* the write, so a consumer never reads a row that is not there.

**Not worth it** — the order is an implementation detail:

- Two independent lookups on two repositories.
- Logging relative to anything.
- Field-by-field population of a request object.
- Anything where reordering the two statements would leave every observable outcome identical.

The test for whether to use `InOrder` is simple: **could you swap the two calls and still be
correct?** If yes, asserting the order is asserting the shape of your code. See
[05d · Verifying too much](05d-verifying-too-much.md).
## Gotchas

**★ `times(2)` inside an `InOrder` where `calls(2)` was meant.**
`times(2)` demands that exactly two matching invocations exist; `calls(2)` consumes two and leaves
the rest available for later in-order verifications. Using the wrong one produces a failure about a
count when the real subject is ordering.

**★ `atLeast(2)` inside an `InOrder` before a `verifyNoMoreInteractions`.**
`atLeast` marks *all* the matching invocations as verified — that is the documented greedy
behaviour — so the later `verifyNoMoreInteractions` sees nothing left and passes vacuously.
`calls(2)` marks exactly two.

**★ `calls(n)` outside an `InOrder`.**
It is documented as in-order only and fails as a misuse, not as a verification failure. The error
does not obviously say "you needed an InOrder".

**★ Confusing `inOrder.verifyNoMoreInteractions()` with `Mockito.verifyNoMoreInteractions(mock)`.**
The first checks only for interactions *after the cursor*; the second checks for any unverified
interaction at all. The javadoc's own example has one passing and the other failing on the same
mock in the same test.

**★ Asserting order on interactions whose order does not matter.**
Two independent repository reads verified in order is a test of statement order in your method
body. Any reordering, even one a compiler could justify, breaks it. Ask whether swapping the two
calls would be a bug.

**★ Forgetting to include a mock in `inOrder(...)`.**
Only the mocks you pass participate. A verification against a mock that was not registered fails
in a confusing way, and — worse — interactions on unregistered mocks are invisible to the ordering
even when they are the ones that happened out of order.

## Interview questions

**★ What is `calls(n)` and where can you use it?**
An in-order-only counting mode. Unlike `times(n)` it does not fail when there are more matching
calls, and unlike `atLeast(n)` it does not mark the extra ones as verified — it consumes exactly
*n* and moves the in-order cursor past them. That matters when a repeated call sits in the middle
of an ordered sequence you are still verifying.

**★ What does it mean that `InOrder` verification is "greedy"?**
A verification consumes as many matching invocations as its mode permits and moves the cursor past
all of them. With `times(n)` the mode is bounded so you never notice; with `atLeast(n)` it swallows
every remaining match, which changes what a later `inOrder.verifyNoMoreInteractions()` sees. The
javadoc flags it — *"'greedy', but you will hardly ever notice it"* — and `calls(n)` is the escape
hatch.

**★ Can you verify order across two different mocks?**
Yes — `inOrder(firstMock, secondMock)` and then `inOrder.verify(...)` on each. Only the mocks
passed to `inOrder(...)` participate, and you do not have to verify every interaction: the claim
is about the relative order of the ones you name.

**★ How does `inOrder.verifyNoMoreInteractions()` differ from the static one?**
It is order-sensitive: it asserts nothing happened *after* the last verified invocation, whereas
`Mockito.verifyNoMoreInteractions(mock)` asserts nothing at all was left unverified. An
interaction that happened before your first in-order verification satisfies the first and fails
the second.

**★ When is asserting order justified?**
When reordering would be a bug — write before commit, lock before mutate, validate before charge,
write before publishing the event. When two calls could be swapped with no observable difference,
asserting their order asserts the shape of your implementation and will break on a harmless
refactor.

{/* FOOTER */}
