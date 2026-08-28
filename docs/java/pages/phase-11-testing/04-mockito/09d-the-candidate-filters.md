---
title: "Three chained filters decide which mock reaches which field, and each one holds a rule the javadoc does not: the type filter compares generic type arguments rather than erasure, the name filter can refuse a single unambiguous candidate so a namesake field gets it, and the type filter throws outright when two mocks match — which is the exact opposite of what constructor injection does with the same ambiguity"
sidebar_label: "09d · The candidate filters"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc and the bodies of `TypeBasedCandidateFilter`, `NameBasedCandidateFilter`,
> `TerminalMockCandidateFilter`, `PropertyAndSetterInjection`, `SpyOnInjectedFieldsHandler` and
> `Reporter` under `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**[09c](09c-property-and-field-injection.md) narrows the problem to a list of eligible fields.
This is the part that picks a mock for each of them, and it is the part people theorise about
instead of reading. Three filters, one `if` that decides "setter" versus "field", one deliberate
throw, and a post-strategy that turns the finished object into a spy.**

## The filter chain — where names finally matter

`TypeBasedCandidateFilter` → `NameBasedCandidateFilter` → `TerminalMockCandidateFilter`.

**Type filter.** Assignability first, and then — this is not in the javadoc — **generic type
arguments**:

```java
if (candidateFieldToBeInjected.getType().isAssignableFrom(mock.getClass())) {
    Type mockType   = MockUtil.getMockSettings(mock).getGenericTypeToMock();
    Type typeToMock = candidateFieldToBeInjected.getGenericType();
    if (typeToMock != null && mockType != null) {
        if (isCompatibleTypes(typeToMock, mockType, injectMocksField)) { mockTypeMatches.add(mock); }
    } else {
        mockTypeMatches.add(mock);           // no generic info: fall back to raw assignability
    }
}
```

So a `@Mock Repository<Order>` is **not** a candidate for a `Repository<Customer>` field, and
`isCompatibleTypes` even resolves type variables through the `@InjectMocks` field's own type
arguments — `@InjectMocks Handler<String> handler` makes a `T` parameter inside `Handler` mean
`String` for matching purposes. Erasure would have said yes; Mockito says no. When the generic
information is absent — a mock created programmatically without it — it falls back to raw
assignability.

**Name filter.** Two rules, and both are easy to get wrong:

```java
if (mocks.size() == 1 && anotherCandidateMatchesMockName(mocks, field, allRemainingFields)) {
    return OngoingInjector.nop;                 // rule 2
}
return next.filterCandidate(
        tooMany(mocks) ? selectMatchingName(mocks, field) : mocks, …);   // rule 1
```

- **Rule 1: the name is consulted only when more than one candidate survived the type filter.** A
  single type match is injected *regardless of the name*. The javadoc says the same — *"mocks will
  first be resolved by type (if a single type match injection will happen regardless of the
  name)"* — and it is why renaming a mock usually changes nothing.
- **Rule 2 is the one nobody expects.** Even with exactly one candidate, if some **other** field of
  the same type has a name equal to that mock's name, this field is skipped, so the mock is left
  for its namesake. It is a correctness rule, and it means one badly-named `@Mock` can cause a
  *different* field to stay `null`.

The name being matched is `MockUtil.getMockName(mock)` — the `@Mock(name = "…")` attribute, else
the field name, and for an unannotated field that already held a mock, the name Mockito assigned
from the field ([09](09-injectmocks.md)).

**Terminal filter.** With exactly one candidate left:

```java
if (!new BeanPropertySetter(injectee, candidateFieldToBeInjected).set(matchingMock)) {
    accessor.set(candidateFieldToBeInjected, injectee, matchingMock);
}
```

A JavaBean setter is tried first; direct field access is the fallback. That is the whole of the
javadoc's "property setter injection" versus "field injection" distinction — one `if`. Either way
visibility is irrelevant: *"they can be declared with private visibility, Mockito will see them
through reflection."* If both routes fail, `cannotInjectDependency` is thrown, naming the mock and
the field.

## 🔴 Two matching mocks throw here — they do not in constructor injection

This is the single most important difference between the two strategies, and it is the opposite of
what most people assume:

```java
boolean wasMultipleMatches = mockTypeMatches.size() > 1;
OngoingInjector result = next.filterCandidate(mockTypeMatches, …);
if (wasMultipleMatches && result == OngoingInjector.nop) {
    throw moreThanOneMockCandidate(candidateFieldToBeInjected, mocks);
}
```

If two mocks match by type and the name filter cannot reduce them to one, Mockito **fails the
test**:

```text
Mockito couldn't inject mock dependency on field '<the field>' that is annotated with @InjectMocks in your test,
because there were multiple matching mocks (i.e. fields annotated with @Mock and having matching type): primary, secondary.
If you have multiple fields of same type in your class under test then consider naming the @Mock fields identically to the respective class under test's fields, so Mockito can match them by name.
```

Constructor injection, for the same ambiguity, silently takes the first element of an unordered
`HashSet` ([09b](09b-constructor-injection.md)). Same test, same mocks, opposite behaviour,
decided by whether your SUT has a parameterised constructor.

## Two passes, and why

```java
injectionOccurred  = injectMockCandidatesOnFields(mocks, …, orderedCandidateInjecteeFields);  // pass 1
injectionOccurred |= injectMockCandidatesOnFields(mocks, …, orderedCandidateInjecteeFields);  // pass 2
```

Pass 1 removes each injected mock from the copy **and** removes the field from the list. Pass 2 then
retries whatever is left against a smaller candidate set — so a field that was ambiguous the first
time can become unambiguous once its competitors have been claimed. It is a small fixed-point
iteration, and it is why adding one more `@Mock` can fix an injection that was failing.

## `@Spy @InjectMocks`, the post-strategy

`handleSpyAnnotation()` registers `SpyOnInjectedFieldsHandler`, which runs **after** injection:

```java
if (!fieldReader.isNull() && field.isAnnotationPresent(Spy.class)) {
    Object instance = fieldReader.read();
    if (MockUtil.isMock(instance)) {
        Mockito.reset(instance);                       // already spied, or openMocks called twice
    } else {
        Object mock = Mockito.mock(instance.getClass(), withSettings()
                .spiedInstance(instance)
                .defaultAnswer(Mockito.CALLS_REAL_METHODS)
                .name(field.getName()));
        accessor.set(field, fieldOwner, mock);
    }
}
```

Read the order: **the object is fully injected first, and then wrapped in a spy** — so the mocks
land in the original and are then copied into the spy by `spiedInstance` ([08](08-spies.md)). Its
own javadoc adds the quiet failure mode: *"The handler assumes that field initialization AND
injection already happened. So if the field is still null, then nothing will happen there."* An
`@Spy @InjectMocks` field that failed to inject is therefore both `null` and not a spy, with no
message. §21 attaches the design warning and
[10](10-never-mock-the-class-under-test.md) is the argument.
## Gotchas

**★ Assuming two same-typed mocks behave the same way in both strategies.**
Field injection throws `moreThanOneMockCandidate`. Constructor injection takes the first assignable
element of a `HashSet` and says nothing. Which one you get depends on whether the SUT has a
parameterised constructor.


**★ Renaming a `@Mock` to fix an injection and nothing changing.**
The name is consulted only when more than one candidate survives the type filter. With a single
match, injection happens *"regardless of the name"*.


**★ A correctly-typed, correctly-named mock that still is not injected.**
`anotherCandidateMatchesMockName`: if another field of the same type is named after that mock, this
field is deliberately skipped so the mock can go to its namesake. Check the other fields of the
same type before assuming a Mockito bug.


**★ A `@Mock Repository<Order>` refusing to inject into a `Repository<Customer>` field.**
That is the type filter working. It compares generic type arguments, not just erasure. The fix is
a mock of the right parameterisation, not `@SuppressWarnings`.


**★ An `@Spy @InjectMocks` field that is `null`.**
`SpyOnInjectedFieldsHandler` does nothing when the field is null — *"if the field is still null,
then nothing will happen there"* — so you get neither the injection failure nor the spy, and the
NPE arrives later with no hint of either.


**★ Expecting private setters or private fields to stop injection.**
They do not: *"they can be declared with private visibility, Mockito will see them through
reflection."* A `private void setClock(Clock)` will be found and called before the field is
written directly, so a setter with validation or side effects runs during test setup.

**★ A setter that does more than assign.**
`BeanPropertySetter` is tried first, so a setter that normalises, registers a listener or fires an
event executes at injection time — before your `@BeforeEach` body and before any stubbing. If that
matters, the field-only route is to remove the setter, not to configure Mockito.

**★ Assuming `moreThanOneMockCandidate` means your test is wrong.**
It usually means the SUT has two fields of the same type, which is worth a second look on its own.
The message's own suggestion — name the `@Mock` fields after the SUT's fields — makes the test
depend on the SUT's private field names, which is a coupling worth avoiding by using constructor
injection instead.

**★ Adding a `@Mock` to fix an unrelated injection failure and it working.**
Pass 2 re-runs the remaining fields against a reduced candidate set, so claiming one mock can
disambiguate another field. It is real behaviour, not luck, and it makes injection failures
sensitive to changes elsewhere in the test class.

## Interview questions

**★ What is the difference between "property setter injection" and "field injection"?**
One `if` in `TerminalMockCandidateFilter`. It tries `BeanPropertySetter` first, and if there is no
usable setter it writes the field directly through the `MemberAccessor`. They are two branches of
one strategy object, not two strategies, which is why the javadoc's list of three and the code's
list of two disagree.


**★ When does the mock's name affect injection?**
Only when more than one mock survives the type filter for a given field: then
`selectMatchingName` keeps those whose mock name equals the field name. There is a second, less
known rule — if exactly one candidate matches by type but *another* field of the same type is named
after that mock, this field is skipped so the mock can go to its namesake.


**★ Two `@Mock` fields of the same type and one field in the SUT. What happens?**
It depends on the strategy. Under field injection, `TypeBasedCandidateFilter` sees multiple matches,
the name filter fails to reduce them, and Mockito throws `moreThanOneMockCandidate` telling you to
*"consider naming the @Mock fields identically to the respective class under test's fields"*. Under
constructor injection the same situation is resolved silently by taking the first assignable
element of an unordered set.


**★ Why does field injection run two passes over the same field list?**
Because pass 1 removes each injected mock from the working set and each injected field from the
list, so a field that had two candidates in pass 1 may have exactly one left in pass 2. It is a
cheap fixed-point iteration, and it is why an injection failure can disappear when you add an
unrelated mock.


**★ In what order does `@Spy @InjectMocks` do its work?**
Injection first, spy second. `SpyOnInjectedFieldsHandler` is registered as a post-injection
strategy and re-creates the field as `mock(instance.getClass(), withSettings().spiedInstance(instance)
.defaultAnswer(CALLS_REAL_METHODS).name(field.getName()))`, so the already-injected mocks are copied
into the spy. If injection left the field `null`, the handler does nothing at all and you get
neither an error nor a spy.


**★ Does `@InjectMocks` respect generics?**
Yes, and more than you would guess. `TypeBasedCandidateFilter` first checks raw assignability, then
compares `MockUtil.getMockSettings(mock).getGenericTypeToMock()` against the field's generic type,
recursing through type arguments and resolving type variables through the `@InjectMocks` field's
own parameterisation. A `@Mock Repository<Order>` will not be injected into a `Repository<Customer>`
field. If a mock carries no generic metadata, it falls back to raw assignability.

**★ Which is tried first, the setter or the field?**
The setter. `TerminalMockCandidateFilter` calls `new BeanPropertySetter(injectee, field).set(mock)`
and only writes the field directly if that returns `false`. It matters because a setter with logic
in it runs during injection, before the test body.

{/* FOOTER */}
