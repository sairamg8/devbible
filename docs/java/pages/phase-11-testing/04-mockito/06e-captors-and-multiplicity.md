---
title: "A captor's value list is an append-only field on a matcher that nothing ever clears, which is why getValue returns the last value silently and why getAllValues on a varargs method flattens every invocation into one list with no way to recover the grouping"
sidebar_label: "06e · Captors and multiplicity"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the `getValue` / `getAllValues` javadoc in
> [`ArgumentCaptor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentCaptor.java),
> the body of
> [`CapturingMatcher`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/matchers/CapturingMatcher.java)
> (`getLastValue`, `getAllValues`, `captureFrom`), the
> [`Reporter.noArgumentValueWasCaptured`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/exceptions/Reporter.java)
> message, and
> [`ArgumentCaptorDontCapturePreviouslyVerifiedTest`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/test/java/org/mockitousage/bugs/ArgumentCaptorDontCapturePreviouslyVerifiedTest.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Every surprising thing a captor does under repeated calls falls out of one field. The matcher
holds an `ArrayList` that `captureFrom` appends to and nothing ever clears — not a new
verification, not a new `times(n)`, not the end of a `verify` block. Once you hold that picture,
`getValue()` returning the last value and varargs merging into one flat list stop being surprises
and become arithmetic. The consequences for a captor's *lifetime* — the empty captor's exception,
a captor reused across two verifications, and the reference-not-snapshot problem — are
[06f · The captor's lifetime](06f-the-captors-lifetime.md).**

## The field

```java
public class CapturingMatcher<T> implements ArgumentMatcher<T>, CapturesArguments, Serializable {

    private final Class<? extends T> clazz;
    private final List<T> arguments = new ArrayList<>();

    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    @Override
    public void captureFrom(Object argument) {
        writeLock.lock();
        try {
            this.arguments.add((T) argument);
        } finally {
            writeLock.unlock();
        }
    }

    public T getLastValue() {
        readLock.lock();
        try {
            if (arguments.isEmpty()) {
                throw noArgumentValueWasCaptured();
            }
            return arguments.get(arguments.size() - 1);
        } finally {
            readLock.unlock();
        }
    }

    public List<T> getAllValues() {
        readLock.lock();
        try {
            return new ArrayList<>(arguments);
        } finally {
            readLock.unlock();
        }
    }
}
```

Three facts to carry:

1. **`captureFrom` only appends.** There is no `clear()` anywhere in the class.
2. **`getAllValues()` returns a defensive copy**, so mutating the returned list is safe and does
   not affect a later call.
3. **The list is guarded by a `ReadWriteLock`**, which is what makes a captor usable from a
   `verify(mock, timeout(…))` against a mock exercised on another thread — see
   [05c · Async verification](05c-async-verification.md).

## `verify(mock, times(n))` and one entry per matched argument

```java
service.notifyAll(List.of("a", "b", "c"));   // calls channel.send(...) three times

@Captor ArgumentCaptor<String> recipient;

verify(channel, times(3)).send(recipient.capture());

assertThat(recipient.getAllValues()).containsExactly("a", "b", "c");
```

The verification mode drives how many invocations Mockito walks; the captor records one entry for
each argument in each **matched** invocation, in invocation order. The two numbers are related but
not the same thing, and that is where varargs breaks the intuition (below).

🔴 A `times(3)` verification whose assertion only reads `getValue()` examines exactly one of the
three calls. The other two are asserted to *exist* and never inspected. If they can differ, the
honest form is `getAllValues()` plus a whole-list assertion:

```java
// asserts about the third call only, but reads as if it asserts about "the" call
verify(channel, times(3)).send(recipient.capture());
assertThat(recipient.getValue()).isEqualTo("c");

// asserts about all three, and fails with all three printed
verify(channel, times(3)).send(recipient.capture());
assertThat(recipient.getAllValues()).containsExactly("a", "b", "c");
```

The javadoc for `getValue()` says it plainly:

> *"Returns the captured value of the argument. When capturing varargs use `getAllValues()`. If
> verified method was called multiple times then this method returns the latest captured value."*

**The latest, silently.** No warning, no exception, no hint in the test that two other values
existed.

## 🔴 Varargs: one flat merged list

> *"Returns all captured values. Use it when capturing varargs or when the verified method was
> called multiple times. When varargs method was called multiple times, this method returns
> **merged list of all values from all invocations**."*

For a method declared `void countPeople(Person... people)`:

```java
mock.countPeople(john, jane);      // one invocation, two arguments
mock.countPeople(bob);             // one invocation, one argument

ArgumentCaptor<Person> people = ArgumentCaptor.forClass(Person.class);
verify(mock, times(2)).countPeople(people.capture());

people.getAllValues();             // three elements: john, jane, bob
```

Two invocations, three entries, **no grouping**. There is no API that returns
`List<List<Person>>`, because the captor is per-argument-position and a varargs position spreads
into as many arguments as were passed.

If the grouping is what you are asserting about, capture the **array**:

```java
ArgumentCaptor<Person[]> calls = ArgumentCaptor.forClass(Person[].class);
verify(mock, times(2)).countPeople(calls.capture());

assertThat(calls.getAllValues())
        .satisfiesExactly(
                first  -> assertThat(first).containsExactly(john, jane),
                second -> assertThat(second).containsExactly(bob));
```

⚠️ Whether Mockito hands the captor the whole array or the spread elements depends on how the
matcher is bound to the varargs position, and mixing the two forms in one test is a reliable way
to get a confusing result. Pick one shape per test. The alternative that is always unambiguous is
a `doAnswer` that records `invocation.getRawArguments()` itself —
[03c · Answers](03c-answers.md).

## Gotchas

**★ `getValue()` after a method was called several times returns the *last* value, silently.**
`getLastValue()` is `arguments.get(arguments.size() - 1)`. The test reads like an assertion about
"the" argument and is actually about the final one, and the other invocations are never inspected
at all. Use `getAllValues()` with a whole-list assertion.

**★ `getAllValues()` on a varargs method called more than once returns one flat merged list.**
Documented: *"When varargs method was called multiple times, this method returns merged list of
all values from all invocations."* Two invocations of two arguments give four entries with no
grouping and no API to recover it. Capture the array type — `ArgumentCaptor<Person[]>` — or record
`invocation.getRawArguments()` in a `doAnswer`.

**★ A `times(n)` verification with a `getValue()` assertion inspects one call out of n.**
The verification proves n calls happened; the assertion proves something about the last one. If
the other n−1 could carry a wrong value, the test passes anyway. `getAllValues()` plus
`containsExactly` closes it and prints the whole list on failure.

**★ Mutating the list returned by `getAllValues()` does nothing.**
It is a defensive copy: `return new ArrayList<>(arguments);`. Sorting it, clearing it or removing
from it has no effect on the captor and no effect on a subsequent call. Harmless, but a source of
confusion when someone "resets" a captor that way and finds it still full.

## Interview questions

**★ Your method was called three times and `getValue()` returns something you did not expect. Why?**
`getValue()` delegates to `getLastValue()`, which returns the final element of an append-only
list — the latest captured value. It is documented: *"If verified method was called multiple times
then this method returns the latest captured value."* With multiple invocations you want
`getAllValues()`, which returns them in invocation order, plus an assertion on the whole list —
which also fails more informatively than an assertion on one element.

**★ What does `getAllValues()` return for a varargs method called twice?**
One flat, merged list of every argument from both invocations. The javadoc says *"merged list of
all values from all invocations"*, and it does not group by call, because a captor occupies one
argument *position* and a varargs position spreads into as many arguments as were passed. If the
grouping matters, capture the array type (`ArgumentCaptor<Person[]>`) or record
`invocation.getRawArguments()` in a `doAnswer`.

{/* FOOTER */}
