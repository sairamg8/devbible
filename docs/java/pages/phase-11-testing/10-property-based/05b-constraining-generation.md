---
title: "Two dozen annotations narrow default generation without wasting a single generated value, they compose, they can be wrapped into a domain annotation of your own — and the two facts that catch everyone are that every numeric range annotation defaults its minimum to zero, and that since 1.6.2 an annotation on an array no longer reaches the elements"
sidebar_label: "05b · Constraining generation"
sidebar_position: 21
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Constraining Default
> Generation* (all sub-sections: *Allow Null Values*, *String Length*, *String not Blank*,
> *Character Sets*, *List, Set, Stream, Iterator, Map and Array Size*, *Unique Elements*,
> *Integer Constraints*, *Decimal Constraints*), *Constraining parameterized types*,
> *Constraining array types*, *Self-Made Annotations* and *Uniqueness Constraints*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Annotation defaults, thresholds and error
> shapes below are quoted from the guide, never observed here.

**Sooner or later every property needs a narrower input than the type gives you: positive
amounts, non-empty lists, strings that look like postcodes, a page size that is at least one.
There are four mechanisms — an annotation, a mapping, a filter and an assumption — and they are
in that order of quality, because the first two build only valid values while the last two
generate and throw away. This page is the first one: the full annotation set, how it reaches
inside a generic type, the incompatible change to array parameters in 1.6.2, and how to wrap a
domain constraint into an annotation of your own. Mapping, filtering, assumptions and the two
documented thresholds that fail a property outright are
[05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).**

## The constraint annotations, in full

Every one of these narrows *default* generation for a `@ForAll` parameter. They compose, and
they are the first thing to reach for.

| Annotation | Applies to | Notes from the guide |
|---|---|---|
| `@WithNull(double value = 0.1)` | anything | *"Inject null into generated values with a probability of value. Works for all generated types."* |
| `@StringLength(int value, int min, int max)` | `String` | fixed length via `value`, or a range |
| `@NotEmpty` | `String`, containers | sets minimum length or size to 1 |
| `@NotBlank` | `String` | *"Strings must not be empty or only contain whitespace."* |
| `@Chars({...})` | `String`, `Character` | a set of allowed chars; *"This annotation can be repeated which will add up all allowed chars."* |
| `@CharRange(from, to)` | `String`, `Character` | also repeatable and additive |
| `@NumericChars`, `@LowerChars`, `@UpperChars`, `@AlphaChars`, `@Whitespace` | `String`, `Character` | digits, `a-z`, `A-Z`, both cases, whitespace |
| `@Size(int value, int min, int max)` | `List`, `Set`, `Stream`, `Iterator`, `Map`, arrays | fixed size or a range |
| `@UniqueElements(by = …)` | containers | elements unique, optionally by an extracted feature |
| `@UniqueChars` | `String` | no repeated characters |
| `@ByteRange`, `@ShortRange`, `@IntRange`, `@LongRange` | the matching type only | ⚠️ **`min` defaults to 0** |
| `@BigRange(String min, String max)` | `BigInteger`, `BigDecimal` | bounds as strings; inclusivity flags for decimals |
| `@FloatRange`, `@DoubleRange` | the matching type only | `minIncluded` / `maxIncluded` flags; ⚠️ **`min` defaults to 0.0** |
| `@Scale(int value)` | all decimal types | maximum number of decimal places |
| `@Positive`, `@Negative` | all numeric types | strictly greater / less than zero |

```java
@Property
void aPostcodeAlwaysParses(
        @ForAll @UpperChars @NumericChars @StringLength(min = 5, max = 8) String postcode,
        @ForAll @IntRange(min = 1, max = 500) int pageSize,
        @ForAll @Size(min = 1, max = 50) @UniqueElements List<@NotBlank String> tags,
        @ForAll @BigRange(min = "0.00", max = "10000.00") @Scale(2) BigDecimal amount) {
    // ...
}
```

Note the annotation on the *type argument* in `List<@NotBlank String>`. That is the documented
way to reach an element type:

> *"When you want to constrain the generation of contained parameter types you can annotate the
> parameter type directly"* — the guide's example being
> `@ForAll @Size(min = 1) List<@StringLength(max = 10) String> listOfStrings`, which *"will
> generate lists with a minimum size of 1 filled with Strings that have 10 characters max"*.

⚠️ **Arrays changed incompatibly in 1.6.2** and the guide flags it as such. Before 1.6.2,
annotations on an array or vararg parameter were handed down to the component type; since
1.6.2, *"annotations are only applied to the array itself"*. So `@ForAll @WithNull String[] a`
no longer injects nulls into the elements, only into the array reference. The guide's own
rewrite is a provider method:

```java
@Provide
Arbitrary<String[]> stringArrays() {
    return Arbitraries.strings().injectNull(0.05).array(String[].class).injectNull(0.05);
}
```

## Your own annotation, and its documented limit

Constraint annotations are meta-annotatable, which lets a domain constraint be named once:

```java
@Target({ ElementType.ANNOTATION_TYPE, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@UpperChars @NumericChars
@StringLength(min = 5, max = 8)
public @interface UkPostcode { }

@Property
void deliveryZoneIsAlwaysResolvable(@ForAll @UkPostcode String postcode) { ... }
```

The guide notes that `@Example` itself is nothing but a plain annotation using `@Property` as a
meta-annotation — and it states the limitation plainly: *"The drawback of self-made annotations
is that they do not forward their parameters to meta-annotations, which constrains their
applicability to simple cases."* So `@UkPostcode(min = 6)` cannot pass `min` through to
`@StringLength`. Self-made annotations are for fixed constraints; anything parameterised wants
a provider method or an `ArbitrarySupplier`.

## When an annotation cannot express it

Three restrictions do not fit an annotation: ones that need a *computation* ("even numbers",
"a multiple of the page size"), ones where one parameter depends on another ("an index inside
this list"), and ones only the domain object can judge ("a valid `LocalDate`"). Those are a
`map`, a `flatMap` and an exception-ignoring combination respectively — and the tempting fourth
answer, a `filter`, has a documented cliff at ten thousand rejected trials. All of that is
[05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).

## Where this connects

- The defaults these annotations override are
  [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md).
- Filtering, mapping, `Assume.that`, `maxDiscardRatio` and the order of preference are
  [05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).
- `map`, `flatMap`, `Combinators`, `ignoreException` and the constructive alternatives to
  filtering are [05c · Composing arbitraries](05c-composing-arbitraries.md).
- Attaching a generator to a parameter at all is [05 · Generators](05-generators.md).
- Proving the constrained generator actually produces the cases you narrowed toward is
  [09 · Statistics](09-statistics.md).
- Narrowing a generator until the property is green by construction is one of the failure modes
  in [12 · The cost](12-the-cost.md).

## Gotchas

**★ `@IntRange(max = 10)` generates 0 to 10, not `Integer.MIN_VALUE` to 10, because `min` defaults to 0.**
The documented signature is `@IntRange(int min = 0, int max = Integer.MAX_VALUE)`, and the same
is true of `@ByteRange`, `@ShortRange`, `@LongRange`, `@FloatRange` and `@DoubleRange`. So a
property that meant "any int up to ten" silently tests only non-negative values, and the
negative branch of the code under test is never entered. Always write both bounds, even when
one of them looks redundant.

**★ Since 1.6.2, an annotation on an array parameter no longer reaches the elements, and code written before 1.6.2 changed meaning silently.**
The guide calls this an incompatible change: *"Annotations are only applied to the array
itself."* A property carrying `@ForAll @WithNull String[] names` used to see null elements and
now sees only a possibly-null array. Nothing fails; the property just tests less than it did.
Anything upgraded across 1.6.2 with array parameters deserves a look.

**★ `@UniqueElements` on a container whose element domain is smaller than the requested size cannot be satisfied.**
The guide's own example makes the arithmetic explicit — a `@Size(5) @UniqueElements List` of
`@IntRange(min = 0, max = 10) Integer` is fine, and *"trying to generate a list with more than
11 elements would not work here"*. Uniqueness plus a fixed size plus a narrow element range is
three constraints that can silently contradict each other, and the failure arrives during
generation, not during review.

**★ A self-made annotation cannot forward parameters to the annotations it wraps, so `@Postcode(country = "FR")` does not do what it looks like it does.**
Documented: *"they do not forward their parameters to meta-annotations, which constrains their
applicability to simple cases."* The annotation's own attributes are simply ignored by the
meta-annotations underneath. If the constraint needs a parameter, you need a provider method
that takes a `TypeUsage` and reads the annotation itself — which is documented, and is
considerably more code than people expect when they start down this road.

**★ Character-set annotations are additive and repeatable, which means adding one to an existing parameter widens the alphabet rather than replacing it.**
`@AlphaChars @NumericChars` allows both, and the guide says `@Chars` and `@CharRange` *"can be
repeated which will add up all allowed chars"*. So a parameter that was `@AlphaChars` and gains
`@NumericChars` in review now generates digits *as well*, not instead — usually what you wanted,
occasionally not, and never what the reader assumes if they are thinking in terms of overriding.

**★ `@NotEmpty` on a `String` and `@NotEmpty` on a `List` are the same annotation doing two different jobs, and it does not mean `@NotBlank`.**
The guide lists `@NotEmpty` under both *String Length* (minimum length 1) and *container size*
(minimum size 1). A one-character string of whitespace satisfies `@NotEmpty` and fails almost
every real "must be provided" rule; `@NotBlank` is the one that excludes whitespace-only
strings. Properties about required fields want `@NotBlank`.

**★ Constraining a generator to make a property green is indistinguishable, in a diff, from constraining it to make a property meaningful.**
`@IntRange(min = 1, max = 5)` added to a failing property is either "the code only ever gets
1 to 5 here, and the earlier generator was unrealistic" or "I narrowed the input until the bug
was out of range". Both are one line. The reviewable difference is a justification in the commit
message tied to the production constraint that enforces the range — a validation annotation, a
database check, a protocol limit. Without that, a narrowed generator is a suppressed failure.
**★ `@WithNull` defaults to a probability of 0.1, so one generated value in ten is null and nine in ten are not — which is a *test design decision* made by an annotation default.**
The documented signature is `@WithNull(double value = 0.1)`. A hundred nulls in a thousand tries
is plenty for "does this NPE"; it is thin for "does the null branch combine correctly with the
other rare case in this property". And in the other direction, a property that is really about
null handling should say `@WithNull(0.5)` rather than relying on a tenth. The annotation looks
binary and is probabilistic.

**★ Annotations on a `@Provide`-supplied parameter do nothing, and nothing tells you.**
`@ForAll("orders") @Size(max = 5) List<Order>` looks like it constrains the provider's output.
It does not: the constraint annotations configure *default* generation, and once a provider
method supplies the arbitrary, the arbitrary is what it is. The size has to be applied inside
the provider — `.list().ofMaxSize(5)`. The annotation is silently ignored, which is the worst
possible outcome, because the signature reads as though the constraint is in force.

## Interview questions

**★ How do you tell, in review, whether a constraint on a generator is legitimate or is hiding a bug?**
I ask what enforces the same constraint in production, and I expect a specific answer. If the
parameter is a page size and the controller validates `1..500`, then `@IntRange(min = 1, max =
500)` mirrors a real invariant and the property is testing the domain the code actually has. If
nothing enforces it, the constraint is a statement that the code is only correct on part of its
declared input type — which may be true and needs to be said out loud, because the caller can
pass anything the type allows. The tell that worries me most is a constraint added in the same
commit that turned a property from red to green, with no corresponding production change: that
is a narrowed generator hiding a falsification, and it is worth asking what the shrunk sample
was before the narrowing. Property-based testing is unusually easy to defeat this way, because
the defeat looks like tuning.

{/* FOOTER */}
**★ Why does jqwik prefer annotations over a fluent API for constraining a `@ForAll` parameter, given that it has both?**
Because the annotation form keeps the constraint where the reader is: in the property's
signature. `void aProperty(@ForAll @IntRange(min = 1, max = 500) int pageSize)` states the
domain of the test on the line you are already reading, and it needs no second method to jump
to. The fluent form via `@Provide` is strictly more powerful — anything you can express with
annotations you can express with `Arbitraries.integers().between(1, 500)`, and much that you
cannot — but it moves the information out of the signature and into a method somewhere else in
the class. My rule is that if the constraint fits in annotations, it belongs in annotations; the
moment I need a computation, a dependency between parameters, or the same generator in two
places, I move to a provider or an `ArbitrarySupplier` and accept the indirection.

**★ Someone wraps `@NumericChars @StringLength(min = 5, max = 8)` into a custom `@Postcode` annotation and then asks to add a `country` attribute to it. What do you tell them?**
That the attribute will compile and be ignored, because the guide states that self-made
annotations *"do not forward their parameters to meta-annotations"*. `@Postcode(country = "FR")`
sets a value that no meta-annotation can read, and the generated strings will be the same as
before — a silent no-op, which is worse than a compile error. The two real options are a
separate annotation per country, which is fine for two or three and awful for twenty, or a
provider method that takes a `TypeUsage` parameter, reads the annotation off the target with
`targetType.findAnnotation(Postcode.class)`, and returns a different arbitrary per country. The
guide documents exactly that pattern for a "large primes" annotation. It is more code than a
meta-annotation, and it is the only one of the two that actually does anything.

**★ You see `@ForAll @Size(max = 5) List<@IntRange(min = 0, max = 3) Integer> values` in review. What does it generate, and is anything suspicious?**
It generates lists of at most five elements, each an integer from 0 to 3 inclusive — the outer
annotation configures the list, the inner one configures the element type, which is the
documented way to reach a type argument. Nothing is wrong syntactically. What I would ask about
is the domain: four possible element values and a maximum size of five means the whole input
space is small enough that jqwik will very likely switch to exhaustive generation, since
`AUTO` mode enumerates when the number of possible values is at or below `tries`. That is often
excellent — the property becomes a proof over its domain rather than a sample — but it means the
property is only as good as the claim that production values really are in `0..3`. If that range
came from the current test data rather than from a validated constraint, the property is proving
something about a domain the code does not actually have.

{/* FOOTER */}
