---
title: "Extension fields are ordered by an algorithm the guide calls deterministic but intentionally nonobvious, the default @Order value is Integer.MAX_VALUE divided by two so that one annotation on one field is enough, and a high value makes your beforeEach run last and your afterEach run first"
sidebar_label: "10f · Registration order"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Registering Extensions"
> ([extensions/registering-extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html))
> javadoc for `@ExtendWith`
> ([ExtendWith](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtendWith.html))
> and `@RegisterExtension`
> ([RegisterExtension](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/RegisterExtension.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Registration order is `before`-callback order and the reverse of `after`-callback order,
because extensions wrap user code. Get it backwards and your cleanup extension runs before
the thing it was meant to clean up after has finished. This chunk is the two rules that
govern it — source order for annotations, `@Order` for fields — and the inheritance rules
that decide what a subclass has already inherited before it declares anything.**

Declarative registration is [10d](10d-registering-extensions.md); programmatic registration
and the `static`/instance rule are [10e](10e-registerextension.md); the third route,
`ServiceLoader` auto-detection, and the assembled global order are
[10g · automatic registration](10g-automatic-registration.md).

## Fields are the exception, and the exception is deliberate

Source order is guaranteed for `@ExtendWith` at class, method and parameter level
([10d](10d-registering-extensions.md)). Fields are governed by something else entirely:

> *"By default, extensions registered programmatically via `@RegisterExtension` or
> declaratively via `@ExtendWith` on fields will be ordered using an algorithm that is
> deterministic but intentionally nonobvious. This ensures that subsequent runs of a test
> suite execute extensions in the same order, thereby allowing for repeatable builds.
> However, there are times when extensions need to be registered in an explicit order. To
> achieve that, annotate `@RegisterExtension` fields or `@ExtendWith` fields with `@Order`."*

**"Deterministic but intentionally nonobvious"** is Jupiter's standing answer to anything it
does not want you to depend on. The same phrase governs default test method order
([11 · execution order](11-execution-order.md)) and `@AutoClose` field order
([09d](09d-autoclose.md)). It does not mean random — a rerun gives the same order, which is
what makes builds repeatable. It means *reproducible, and not the order you would guess, so
that you are forced to say what you mean.*

Why fields at all? Because declaration order in a class file is not a language guarantee the
way annotation order on an element is, and because two `@RegisterExtension` fields may be
inherited from different levels of a hierarchy where "source order" has no single meaning.

## `@Order`, and why the default is `Integer.MAX_VALUE / 2`

> *"Any `@RegisterExtension` field or `@ExtendWith` field not annotated with `@Order` will
> be ordered using the default order which has a value of `Integer.MAX_VALUE / 2`. This
> allows `@Order` annotated extension fields to be explicitly ordered before or after
> non-annotated extension fields. Extensions with an explicit order value less than the
> default order value will be registered before non-annotated extensions. Similarly,
> extensions with an explicit order value greater than the default order value will be
> registered after non-annotated extensions."*

The number is chosen so that **one annotation on one field is enough**. Put `@Order(1)` on a
field and it registers before every unannotated field in the class; put
`@Order(Integer.MAX_VALUE)` on it and it registers after all of them. You never have to
annotate the others, which matters because the others may be inherited from a base class you
do not control.

```java
class OrderedExtensionsTests {

    @Order(1)
    @RegisterExtension
    static DatabaseExtension database = DatabaseExtension.forSchema("orders");

    @RegisterExtension
    static MetricsExtension metrics = MetricsExtension.recordingTo(REPORT_DIR);

    @Order(Integer.MAX_VALUE)
    @RegisterExtension
    static DiagnosticDumpExtension dump = new DiagnosticDumpExtension();

}
```

`database` registers first, `metrics` takes the default, `dump` registers last — and because
extensions wrap user code, `dump` is the innermost wrapper, so its `beforeEach` runs last and
its `afterEach` runs *first*, before anything else has torn down. For a diagnostic dump that
is exactly right: you want to capture state before the database extension rolls it back.

The javadoc adds the cross-annotation guarantee, which is easy to miss:

> *"Note that `@RegisterExtension` fields can also be ordered with `@Order`, relative to
> `@ExtendWith` fields and other `@RegisterExtension` fields."*

So `@Order` sorts one pool containing both kinds of field. It does **not** reach across to
class-level or method-level `@ExtendWith`, which are placed by the `static`/instance rules in
[10e](10e-registerextension.md).

### The direction, stated once and clearly

> *"For example, assigning an extension an explicit order value that is greater than the
> default order value allows before callback extensions to be registered last and after
> callback extensions to be registered first, relative to other programmatically registered
> extensions."*

**A high `@Order` value means your `beforeEach` runs last and your `afterEach` runs first.**
Registration order is `before` order and the reverse of `after` order — the wrapping rule
from [03c](03c-inheritance-and-wrapping.md), applied to extensions. Reading `@Order` as "runs
first" is right for half the callbacks and exactly wrong for the other half.

## Inheritance

> *"Registered extensions are inherited within test class hierarchies with top-down
> semantics. Similarly, extensions registered at the class-level are inherited at the
> method-level. This applies to all extensions, independent of how they are registered
> (declaratively or programmatically)."*

Two separate propagations in one sentence: down the class hierarchy, and down from class
level to method level. The order is stated for both routes:

> *"This means that extensions registered declaratively via `@ExtendWith` on a superclass
> will be registered before extensions registered declaratively via `@ExtendWith` on a
> subclass."*

> *"Similarly, extensions registered programmatically via `@RegisterExtension` or
> `@ExtendWith` on fields in a superclass will be registered before extensions registered
> programmatically via `@RegisterExtension` or `@ExtendWith` on fields in a subclass, unless
> `@Order` is used to alter that behavior."*

Superclass first is consistent with lifecycle methods
([03c](03c-inheritance-and-wrapping.md)): the superclass wraps the subclass, for `@BeforeEach`
and for extension registration alike. Note the escape hatch in the second quote — `@Order`
overrides inheritance order for fields, so a subclass *can* put its extension in front of the
base class's, which is occasionally necessary and always worth a comment.

### Duplicates are ignored

> *"A specific extension implementation can only be registered once for a given extension
> context and its parent contexts. Consequently, any attempt to register a duplicate
> extension implementation will be ignored."*

An abstract base class annotated `@ExtendWith(MockitoExtension.class)` plus a subclass that
also declares `@ExtendWith(MockitoExtension.class)` gives you **one** `MockitoExtension`. The
subclass annotation is redundant, not harmful.

The deduplication key is the extension *implementation class* within a context and its
parents. Two `@RegisterExtension` fields holding two separately configured instances of the
same class are a different situation — the rule exists to stop inheritance and composed
annotations from stacking the same extension, not to stop you deliberately registering two
configured instances. I could not find a sentence in the guide that resolves the two-instance
case explicitly, so if you need two independent instances of one extension class in one
class, verify the behaviour before relying on it.

## Gotchas

**★ Reading `@Order` as "runs first".**
It is *registration* order, which is `before`-callback order and the **reverse** of
`after`-callback order. A high `@Order` value means your `beforeEach` runs last and your
`afterEach` runs first. Half the time that is exactly what you wanted and you got it by
accident; the other half it is the bug.

**★ Expecting source order to govern `@RegisterExtension` fields.**
It governs class-, method- and parameter-level `@ExtendWith` only. Field registration is
*"deterministic but intentionally nonobvious"*. If you need field A before field B, annotate
with `@Order` — do not reorder the declarations and hope, because it will appear to work
until someone inherits from the class.

**★ Using `@Order(1)` when you meant "before the unannotated ones".**
That works today, and so does any value below `Integer.MAX_VALUE / 2`. But if a colleague
later adds `@Order(0)` to another field you get a silent reordering with no failing test.
Leave gaps between the values and write down *why* the order matters, because nothing in the
type system records the dependency.

**★ Assuming `@Order` on a field affects class-level `@ExtendWith`.**
`@Order` sorts the pool of `@RegisterExtension` and `@ExtendWith` **fields**. It does not
promote a field extension ahead of a class-level `@ExtendWith` — that relationship is fixed
by the static/instance rules.

**★ Declaring `@ExtendWith(SomeExtension.class)` on both a base class and a subclass and
expecting two instances.**
Duplicate registration of the same implementation across a context and its parents is
ignored. You get one. If you genuinely need two configured instances, use two
`@RegisterExtension` fields — and confirm the behaviour, because the guide does not spell
that case out.

**★ Putting an ordering dependency between extensions in the first place.**
Two extensions that must run in a particular relative order are coupled, and nothing in the
code says so except an integer. Where you can, make one extension depend on the other's
output through the `Store` ([10h](10h-keeping-state.md)) rather than through registration
order — a missing value fails loudly, a wrong order fails subtly.

## Interview questions

**★ Two `@RegisterExtension` fields, no `@Order`. What order do they register in?**
An order that is deterministic — the same on every run, so builds are repeatable — and
described by the guide as intentionally nonobvious, meaning it is neither source order nor
alphabetical and you must not depend on it. If the order matters, `@Order` is the only
supported answer.

**★ What is the default `@Order` value for extension fields, and why that number?**
`Integer.MAX_VALUE / 2`. It sits in the middle of the range so a single `@Order` annotation
on a single field can place that field either before or after every unannotated field,
without your having to annotate all the others — which matters when some of them are
inherited from a base class you do not own.

**★ If I give an extension `@Order(Integer.MAX_VALUE)`, when do its callbacks run?**
It is registered last, so it is the innermost wrapper: its `beforeEach` runs last, immediately
before the user's setup and the test, and its `afterEach` runs first, before any other
extension has torn anything down. That is the right configuration for capturing diagnostics,
and the wrong one for provisioning something another extension needs.

**★ You put `@ExtendWith(MockitoExtension.class)` on an abstract base test class and also on
one subclass. What happens?**
One registration. A specific extension implementation can only be registered once for a given
extension context and its parent contexts, and duplicates are ignored — so the subclass
annotation is redundant rather than harmful. Extensions are inherited top-down anyway, with
the superclass's registrations coming before the subclass's.

**★ A subclass needs its extension to register before the one it inherits. Is that possible?**
Yes, for field-registered extensions: the guide's inheritance rule for `@RegisterExtension`
and `@ExtendWith` fields ends with *"unless `@Order` is used to alter that behavior"*. Give
the subclass's field a lower `@Order` value than the superclass's. It is legal, it is
documented, and it is worth a comment, because reading the subclass alone will not explain
why the number is there.

{/* FOOTER */}
