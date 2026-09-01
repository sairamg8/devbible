---
title: "CONSTRUCTOR_CALLS and NON_VOID_METHOD_CALLS are the two optional operators that delete an action rather than corrupt a value, and each carries a warning in its own documentation that decides the question: the first is the textbook unstable operator whose mutants die of NullPointerExceptions, the second fails both design criteria in one sentence and is still the only thing in open-source PIT that can tell you whether anyone checks the save"
sidebar_label: "03d2e · Neutralising calls"
sidebar_position: 18
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Constructor Call Mutator*
> and *Non Void Method Call Mutator* sections, their Java-default-value table and both warning
> paragraphs, quoted verbatim, plus the *Void Method Call Mutator* section's note on constructors —
> the [Maven quick start](https://pitest.org/quickstart/maven/) entries for `mutators`,
> `targetClasses` and `features`, and the `Feature.named("funmodifiablecollection")` declaration in
> pitest 1.30.0's `build/intercept/defensive` package. `CrudRepository.save`'s signature from the
> **Spring Data Commons** javadoc as managed by Spring Boot 4.1.0.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour is quoted from pitest's
> documentation and read from its published source; the Java and XML on this page are illustrative
> source, never a run.

**[03b2](03b2-void-method-calls.md) made the argument that `VOID_METHOD_CALLS` is different in kind
from every other default operator: it deletes an *action* rather than corrupting a value, so its
survivors say "this code could stop doing the thing it exists to do". It also named the gap — the
`void` boundary lands in the wrong place, and the most important side effect in a Spring service is a
non-`void` call. These two optional operators are the only ones that reach past that boundary, and both
of them are off for reasons their own documentation states plainly. This chunk is what each does, why
each is off, and — closing the inventory — the honest ranking across all five optional operators.**

## `CONSTRUCTOR_CALLS` — the textbook unstable operator

> *"Optional mutator that replaces constructor calls with null values."*

```java
public Object foo() {
  Object o = new Object();
  return o;
}
```

becomes

```java
public Object foo() {
  Object o = null;
  return o;
}
```

with the warning that decides the matter:

> *"Please note that this mutation is fairly unstable and likely to cause NullPointerExceptions even
> with weak test suites."*

That is the "fails stable" bucket from [03d2](03d2-the-optional-operator-inventory.md), stated by the
tool about itself. A mutant killed by an NPE two frames down is killed by the JVM, not by your
assertions, and every one of those kills lands in the numerator of the mutation score. On a codebase
that constructs domain objects freely — which is every codebase this phase is about — enabling this
operator raises the score and lowers the meaning of the score in the same run.

It also has a scope people misread. From its own section:

> *"This mutator does not affect non constructor method calls."*

and, from the `VOID_METHOD_CALLS` section, the complement:

> *"Please note that constructor calls are not considered void method calls."*

So `new AuditEvent(...)` written as a bare statement is untouched by the default set and touched by this
one ([03b2](03b2-void-method-calls.md)). If that specific gap is what you are chasing, an in-memory fake
and an assertion on what it recorded is a better instrument than an operator that NPEs its way to a
green score.

## `NON_VOID_METHOD_CALLS` — fails both criteria, and is still the only one that reaches the save

> *"The non void method call mutator removes method calls to non void methods. Their return value is
> replaced by the Java Default Value for that specific type."*

| Type | Default value |
|---|---|
| `boolean` | `false` |
| `int` `byte` `short` `long` | `0` |
| `float` `double` | `0.0` |
| `char` | the null character |
| `Object` | `null` |

```java
public void foo() {
  int i = someNonVoidMethod();
  // do more stuff with i
}
```

becomes

```java
public void foo() {
  int i = 0;
  // do more stuff with i
}
```

Its warning names **both** failure modes in one sentence, which no other operator's does:

> *"Please note that this mutation is fairly unstable for some types (especially Objects where
> NullPointerExceptions are likely) and may also create equivalent mutations if it replaces a method
> that already returns one of the default values without also having a side effect."*

Unstable for reference types, equivalent for the primitive ones — a method that already returns `0`, or
`false`, or `null` on the path your fixture takes, produces a mutant no test can distinguish.

### Why you might want it anyway

This is the operator that reaches the asymmetry [03b2](03b2-void-method-calls.md) identified.
`CrudRepository.save` is declared `<S extends T> S save(S entity)` — it returns the saved entity, so it
is not a `void` call, so `VOID_METHOD_CALLS` never deletes it:

```java
public void place(Order order) {
    orderRepository.save(order);        // returns Order — NOT mutated by the default set
    eventPublisher.publish(placed);     // void          — mutated
    auditTrail.record(order.id());      // void          — mutated
}
```

A default-set report on that method tells you whether anyone checks the event was published and is
**silent** on whether anyone checks the entity was saved — not "survived", not "no coverage", but no
entry at all, because no mutant was generated. `NON_VOID_METHOD_CALLS` is the only open-source operator
that closes it.

The same asymmetry runs through the JDK. `list.add(x)` returns `boolean`; `map.put(k, v)` returns the
previous value; `Optional.orElseThrow()` returns the value. None of them is a `void` call, so a class
that accumulates into collections looks well tested to the default set because the JDK happened to give
those methods return types.

How to switch it on without wrecking the report — the narrow scope, the filter that has to go with it,
and the repository test that is usually the better answer — is
[03d2f](03d2f-adopting-an-optional-operator.md), which also closes the inventory with the honest ranking
across all five.

## Where this connects

- **[03d2 · Optional operators](03d2-the-optional-operator-inventory.md)** — the two-bucket rule for
  reading an operator's warning; both operators here are textbook cases of one bucket each.
- **[03b2 · `VOID_METHOD_CALLS`](03b2-void-method-calls.md)** — the default operator that deletes an
  action, the `void` boundary, and the repository-save gap these two reach past.
- **[03d2c · Inline constants](03d2c-inline-constants.md)** and
  **[03d2d · `REMOVE_INCREMENTS`](03d2d-remove-increments.md)** — the optional operators that corrupt a
  value rather than a call.
- **[03d3 · The research operators](03d3-the-research-operators.md)** — what is left in `ALL` once these
  five are accounted for.
- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — `funmodifiablecollection`, and why it
  ships off.
- **[04 · Mockito](../04-mockito/README.md)** — `verify()` and argument captors, the instruments that
  kill a deleted-call mutant when there is no return value to assert on.
- **[07 · Testcontainers](../07-testcontainers/README.md)** — the repository test that constrains the
  save directly, which is the better answer to the gap this operator merely reports.

## Gotchas

**★ `CONSTRUCTOR_CALLS` raises your score by killing mutants with `NullPointerException`s.**
Its own documentation says the mutation is *"fairly unstable and likely to cause NullPointerExceptions
even with weak test suites"*. Every one of those NPEs is a test failure, and a test failure is a kill.
Enabling it on a codebase that constructs objects — all of them — inflates the numerator with kills that
measure the JVM's null handling rather than your assertions.

**★ `NON_VOID_METHOD_CALLS` is the only operator that can tell you whether a save is verified, and it is unstable for exactly the same reason.**
Blanking a reference-returning call to `null` reaches `repository.save(order)`, and it also reaches every
other object-returning call in the method, most of which then NPE. The warning names both failure modes
in one sentence. That is why the answer is a narrow `targetClasses` glob rather than a global switch.

**★ The default set is silent about the save rather than reporting it as a survivor.**
No mutant is generated for `repository.save(order)`, so the report has no entry for it under any status.
That is different in kind from a survivor and much easier to miss: a clean report on a service class is
compatible with nobody ever having checked the save happens. The mutant count per class, read against
what the class does, is the only way to notice.

**★ The `void`/non-`void` boundary is the JDK's type system, not a risk assessment.**
`list.add(x)` returns `boolean`, `map.put(k, v)` returns the previous value, and neither is mutated by
the default set even though every caller ignores the result. A class whose job is accumulating into
collections therefore scores well against the default operators without anyone having asserted on what
it accumulated.

**★ Constructor calls are exempt from `VOID_METHOD_CALLS`, and the operator that covers them is the worst one.**
`new AuditEvent(...)` as a bare statement is not a `void` method call — pitest says so explicitly — so
the default set does not delete it, and `CONSTRUCTOR_CALLS` is the operator that would. Between an
operator whose mutants die to weak suites and no measurement at all, the honest third option is an
in-memory fake plus an assertion, which measures the behaviour without any operator.

**★ An unstable operator makes the score go up and the information go down, which is the hardest thing to explain to a dashboard.**
Both operators here can raise a mutation score while adding nothing a reader can act on. If the number is
on a dashboard and the report is not read by a person, enabling either of them is strictly harmful — you
have made the metric better and the measurement worse. That is the strongest practical argument for
treating mutation testing as a report to read rather than a gate to pass ([06 · The cost](06-the-cost.md)).

## Interview questions

**★ Your service has a clean mutation score, and nobody has ever asserted that orders are saved. How is that possible, and what would you change?**
Because `CrudRepository.save` returns the saved entity, so it is not a `void` method call, and
`VOID_METHOD_CALLS` — the only default operator that deletes a call — only removes calls with no return
value. No mutant is ever generated for the save, so the report is silent about it rather than reporting a
survivor. The operator that reaches it is `NON_VOID_METHOD_CALLS`, which replaces a non-`void` call's
result with the type's default, and it is off by default with a documented warning that it is *"fairly
unstable for some types (especially Objects where NullPointerExceptions are likely)"* and can produce
equivalent mutants. I would enable it against one application-service package with `targetClasses`,
together with `+funmodifiablecollection`, and I would also write the repository test that reads the row
back — the operator tells you the assertion is missing, but a real database is what tells you the save
works.

**★ A team enables `CONSTRUCTOR_CALLS` and their mutation score goes up four points. Did their tests improve?**
No, and the score went up for a reason that makes it less meaningful. The operator replaces
`new Foo(...)` with `null`, and pitest's own documentation says the mutation is *"fairly unstable and
likely to cause NullPointerExceptions even with weak test suites"*. Those NPEs propagate to a test
failure, pitest records the mutant as killed, and the numerator rises without any assertion having
distinguished anything. It is the clearest illustration of what pitest means by *stable*: an operator
whose mutants are too easy to detect measures the JVM rather than the suite, which is why the design
criterion is that a default operator should be hard to detect.

**★ Why is `NON_VOID_METHOD_CALLS` the only operator whose warning names both of pitest's failure modes?**
Because blanking a call's return value fails differently depending on the type. For reference types the
substituted value is `null`, which propagates and produces a `NullPointerException` — an unstable mutant
killed by the JVM. For primitives the substituted value is `0`, `0.0` or `false`, which is very often
what the method already returned on the path a test exercises — an equivalent mutant that no test can
kill. One operator, both buckets, and the documentation says so in a single sentence: *"fairly unstable
for some types ... and may also create equivalent mutations if it replaces a method that already returns
one of the default values without also having a side effect."*

**★ Why does the default operator set measure the event publish and not the repository save, when the save is the riskier of the two?**
Because the boundary the default set draws is the JVM's, not risk's. `VOID_METHOD_CALLS` deletes calls
whose declared return type is `void`; `eventPublisher.publish(event)` qualifies and
`orderRepository.save(order)` does not, because `save` returns the saved entity. The same accident runs
through the JDK — `list.add`, `map.put`, `Optional.orElseThrow` are all non-`void` and therefore
untouched. It is worth knowing because it changes how you read a clean report on a service class: the
absence of findings there is partly a fact about your tests and partly a fact about which methods happen
to return something.

{/* FOOTER */}
