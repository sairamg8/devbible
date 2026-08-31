---
title: "Every arbitrary you build inherits defaults nobody on your team chose — containers and strings sized 0 to 255 and skewed toward the minimum, integers biased toward the centre of their range, BigDecimal at scale 2, no nulls, no NaN, Optional present nineteen times in twenty — and those defaults, not your assertion, decide what a green property means"
sidebar_label: "05a · The defaults nobody chooses"
sidebar_position: 20
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Static Arbitraries
> methods*, *Numeric Arbitrary Types*, *Special Decimal Values*, *Random Numeric Distribution*,
> *Collections, Streams, Iterators and Arrays*, *Size of Multi-value Containers*, *String
> Size*, *Collecting Values in a List*, *Optional*, *Tuples of same base type*, *Maps*,
> *Functional Types*, *Fluent Configuration Interfaces*, *Generate null values* and
> *Character Sets* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every default below is quoted from the
> guide, never observed from a run here.

**[05](05-generators.md) covered how a generator gets attached to a parameter. This is the
catalogue it is built from and, more importantly, the set of decisions that catalogue makes on
your behalf. Nobody writes "container sizes between 0 and 255, distorted toward the minimum,
integers biased toward the centre of the range, decimals at scale 2, never null, `NaN` never
generated" in a test — and every property in the codebase is running under exactly those terms.
When a property is green and the defect is still in production, this page is usually where the
explanation is.**

## The `Arbitraries` entry points worth memorising

Almost every provider method starts with a static call on `Arbitraries`. The ones that carry
most real work:

| Call | Produces | Worth knowing |
|---|---|---|
| `integers()`, `longs()`, `bytes()`, `shorts()`, `bigIntegers()` | integral numbers | `between(min, max)`, `greaterOrEqual`, `lessOrEqual`, `shrinkTowards(target)` |
| `floats()`, `doubles()`, `bigDecimals()` | decimals | `ofScale(n)` — *"The default scale is 2"*; exclusive bounds via `between(min, minIncluded, max, maxIncluded)` |
| `strings()` | `String` | `alpha()`, `numeric()`, `withChars(...)`, `withCharRange(a, z)`, `ofLength/ofMinLength/ofMaxLength`, `uniqueChars()` |
| `chars()` | `char` | same character-set builders |
| `of(values...)` | a choice | *"Choose randomly from a list of values. Shrink towards the first one."* |
| `of(EnumClass.class)` | an enum constant | *"Shrink towards first enum value."* |
| `just(constant)` | a constant | reuses the *same instance* every try |
| `create(supplier)` | a constant-ish | *"In each try use a new unshrinkable instance"* — the mutable-object form of `just` |
| `ofSuppliers(...)` | a choice | the mutable-object form of `of` |
| `frequency(Tuple.of(w, v), ...)` | a weighted choice | *"Shrinking moves towards the start of the frequency list."* |
| `oneOf(a, b, c)`, `frequencyOf(...)` | a choice between *arbitraries* | see [05c](05c-composing-arbitraries.md) |
| `maps(keys, values)`, `entries(k, v)` | maps | two arbitraries in, one out |
| `shuffle(values...)` | permutations | *"Return unshrinkable permutations of the values handed in."* |
| `randoms()` | `java.util.Random` | *"Random instances will never be shrunk"* |
| `randomValue(fn)` | anything | ⚠️ *"Those values cannot be shrunk, though."* |
| `defaultFor(Class, paramTypes...)` | the built-in arbitrary | useful inside a provider that wraps a default |
| `forType(Class)` | constructor-driven | the programmatic form of `@UseType` |

From any `Arbitrary` you then build containers: `list()`, `set()`, `streamOf()`, `iterator()`,
`array(T[].class)`, `optional()`, `tuple1()` through `tuple5()`, and `collect(predicate)` —
the last of which collects values into a list *"until a certain condition is fulfilled"*, which
is how you generate "a list of integers summing to at least 1000" without a filter.

## The defaults nobody chooses, and what they do to your properties

This is the part that decides whether a green property means anything.

**Strings and containers are 0 to 255.** *"Without any additional configuration, the size of
generated strings is between 0 and 255"*, and the same for lists, sets, arrays and maps. Two
consequences: an unconstrained `List` property is slower than you expect, and the empty case
appears often — which is good, because empty is where the bugs are.

**Container sizes are not uniform.** *"Usually the distribution of generated container size is
heavily distorted towards the allowed minimum."* So `@ForAll List<Order>` is mostly short
lists. If your property is about pagination at page-size boundaries, say so with
`withSizeDistribution(RandomDistribution.uniform())` or an explicit `@Size`.

**Numbers are biased toward the centre.** `RandomDistribution.biased()` is the default and
*"generates values closer to the center of a numerical range with a higher probability. The
bigger the range the stronger the bias."* An unconstrained `@ForAll int` therefore clusters
near zero, which is usually what you want and is *not* a uniform sample of `int`. The
alternatives are `uniform()` and `gaussian(borderSigma)`, with a documented cost: *"Gaussian
generation is approximately 10 times slower than biased or uniform generation."*

**`BigDecimal` has scale 2 unless you say otherwise**, and *"since the generation of decimal
values is constrained by the significant decimal places, some special values, like
`MIN_NORMAL` and `MIN_VALUE`, will never be generated"* — `withStandardSpecialValues()` adds
`MIN_VALUE`, `MIN_NORMAL`, `NaN`, `POSITIVE_INFINITY` and `NEGATIVE_INFINITY` back for floats
and doubles.

**`null` is never generated.** *"Predefined generators will never create null values."* You opt
in with `injectNull(probability)` or the `@WithNull` annotation. If your production code
receives nulls, your properties do not test that unless you ask.

**`Optional` is present 95% of the time.** `Arbitrary.optional()` *"uses a presenceProbability
of 0.95, i.e. 1 in 20 generates is empty"*, so an empty `Optional` is rare rather than
balanced.

**Functional interfaces are generated.** Any single-abstract-method interface used as a
`@ForAll` parameter produces a function that *"given the input parameters … will produce the
same return values"* and whose shrinking *"will try constant functions"*. This is the tool for
testing higher-order code — a `Comparator`, a `Predicate`, a retry `BackoffPolicy` — and almost
nobody knows it exists.
## Where this connects

- How a generator gets attached to a parameter in the first place is
  [05 · Generators](05-generators.md).
- Overriding every default here with an annotation — `@Size`, `@StringLength`, `@IntRange`,
  `@Scale`, `@WithNull`, `@Chars` — is
  [05b · Constraining generation](05b-constraining-generation.md).
- Building composite values on top of these, and `injectNull`/`injectDuplicates`, is
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- The edge cases each of these arbitraries carries — and the fact that they are mixed in rather
  than run first — are
  [08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md).
- Turning "I think the distribution is fine" into a number, and failing the build when it is
  not, is [09 · Statistics](09-statistics.md).
- Why unshrinkable values cost you so much is [06 · Shrinking](06-shrinking.md).
- What the container sizes do to suite runtime is [12 · The cost](12-the-cost.md).

## Gotchas

**★ `Arbitraries.just(mutableThing)` hands every try the same instance, and a property that mutates it corrupts every subsequent try.**
The guide flags this in the description of the alternatives: `ofSuppliers` is *"useful when
dealing with mutable objects where `Arbitrary.of(..)` would reuse a potentially changed
object"*, and `create(Supplier)` produces *"a new unshrinkable instance"* each try for the same
reason. If the value has any mutable state — a builder, a collection, a JPA entity — use
`create` or `ofSuppliers`, not `just` or `of`.

**★ `Arbitraries.randomValue(...)`, `randoms()` and `shuffle(...)` produce values that cannot be shrunk, and the guide says so for each of them.**
This is a real cost, not a footnote: shrinking is most of what makes a failure readable
([06 · Shrinking](06-shrinking.md)). A property whose interesting parameter came from
`randomValue` reports the original failing value and nothing smaller. Where you can express the
same generation with `filter`, `map` or `flatMap` over a shrinkable arbitrary, do — the guide's
own prime-number example uses `randomValue` for brevity and `integers().filter(this::isPrime)`
is shrinkable.

**★ An unconstrained `@ForAll String` never contains a noncharacter or a private-use character, so "arbitrary string" is narrower than input from a socket.**
Documented: *"When generating chars any unicode character might be generated. When generating
Strings, however, Unicode 'noncharacters' and 'private use characters' will not be generated
unless you explicitly include them using `@Chars` or `@CharRange`."* For a parser hardened
against hostile input this is the wrong alphabet, and the property will be quietly green about
the cases you cared about most.

**★ `@ForAll List<Order>` where `Order` has its own generated collections nests the 0-to-255 default, and the runtime multiplies.**
A list of up to 255 orders, each with up to 255 line items, each with a generated string of up
to 255 characters, a thousand times, is a property you will kill before it finishes. Nothing
warns you; the defaults were designed for scalar parameters. Constrain sizes at every level of
a nested structure, deliberately, and treat an unconstrained nested container as a bug in the
test.

**★ The biased default distribution means an unconstrained `int` property barely tests large magnitudes, which is the opposite of most people's mental model of "random".**
*"The bigger the range the stronger the bias"* — so over the full `int` range, values near zero
dominate and `Integer.MAX_VALUE / 2` is rare. Edge cases put the extremes back in occasionally,
but if your property is about overflow, do not rely on the distribution: constrain to a range
near the boundary, or use `uniform()`, and check the result with `Statistics`.

**★ `Optional.empty()` arrives one try in twenty by default, which is not enough to test an empty branch you care about.**
`presenceProbability` defaults to 0.95. Fifty empties in a thousand tries sounds adequate until
the empty case only matters in combination with another rare condition, at which point the
product of the two probabilities is the real coverage. Either raise the emptiness rate with
`optional(0.5)` or split the property in two — one for the present case, one for the empty one —
which is usually clearer anyway.

**★ Generated functional types are a documented feature and, because shrinking tries constant functions, a failure often reduces to "any function that always returns the same thing breaks this".**
That is enormously informative and it looks like a nonsense counter-example the first time you
see it. If your `retry(BackoffPolicy)` property shrinks to a policy that always returns zero,
the report is telling you the code does not handle a zero backoff, not that the generator
produced garbage.
**★ `NaN`, the infinities, `MIN_VALUE` and `MIN_NORMAL` are never generated for `float` and `double` by default, so a property over a `double` does not test the values that break arithmetic.**
The guide states the reason: *"since the generation of decimal values is constrained by the
significant decimal places, some special values, like `MIN_NORMAL` and `MIN_VALUE`, will never
be generated, although they are attractors of bugs in some cases."* The documented remedy is
`withStandardSpecialValues()`, which adds `MIN_VALUE`, `MIN_NORMAL`, `NaN`, `POSITIVE_INFINITY`
and `NEGATIVE_INFINITY` — and note what that does to your assertions, because `NaN != NaN` and
any property asserting equality on a `double` will start failing correctly.

**★ `BigDecimal` generated at the default scale of 2 will never falsify a property about rounding at scale 4.**
The default is documented — *"The default scale is 2"* — and it silently matches the scale most
money code uses, which is why nobody notices. If the code under test rounds, converts currencies
or multiplies by a rate, generate at a higher scale than the code produces, or the property only
ever sees values that are already rounded and the rounding logic is untested by construction.

**★ Container size distribution is skewed toward the minimum, so a property about "many elements" mostly tests "few elements".**
*"Usually the distribution of generated container size is heavily distorted towards the allowed
minimum."* A property about batching, pagination or an `n log n` algorithm therefore spends most
of its tries on lists of two or three. `withSizeDistribution(RandomDistribution.uniform())` or
an explicit `@Size(min = ...)` fixes it, and `Statistics.collect(list.size())` tells you whether
it needed fixing.

**★ `Arbitraries.strings()` with no character configuration is not the same alphabet as `Arbitraries.chars()`, and the property you moved from one to the other silently changed domain.**
Chars can be any Unicode character; strings exclude noncharacters and private-use characters
unless you opt in. Refactoring a property from `@ForAll char` to `@ForAll String` — or building
a string from generated chars with `map` — changes what gets tested, in a direction nobody
documents in the commit message.

**★ `Arbitrary.collect(predicate)` builds a list until a condition holds, and a condition that can never hold does not fail cleanly.**
`integers().between(1, 100).collect(list -> sum(list) >= 1000)` is the documented way to
generate "a list summing to at least 1000" without filtering — but the same call with
`between(-100, -1)` and the same predicate never terminates its intent, and you have written an
unbounded generator inside a thousand-try property. Whenever the predicate depends on
accumulating toward a target, check that every generated element moves toward it.

**★ `gaussian()` generation is documented as roughly ten times slower than the default, and it is easy to reach for it decoratively.**
*"Gaussian generation is approximately 10 times slower than biased or uniform generation."* It
is the right tool when the distribution genuinely matters — modelling realistic loads,
clustering values around an operational centre — and a pure cost when it was chosen because it
sounded more rigorous than `biased()`. The default is already centre-weighted; `uniform()` is
the choice that changes the shape at no cost.

## Interview questions

**★ Your property over `@ForAll List<Integer>` is green and takes eleven seconds. What is going on and what do you change?**
The default container size is 0 to 255, so at a thousand tries the property is processing on
the order of a hundred thousand elements, and if the code under test is superlinear that is the
whole eleven seconds. The change is not to lower `tries` first — that weakens the property —
it is to say what size actually matters. If the law is about ordering, lists of up to twenty
elements test it as well as lists of two hundred and fifty, so `@Size(max = 20)`. If the law is
about a batching boundary at 100, generate around the boundary explicitly. And if the size
genuinely matters, keep it and move the property to a slower suite. The general point is that
the defaults were chosen for scalar parameters and inherited by container parameters, and a
container property should always have a deliberate size.

**★ A colleague says "the property passes for a thousand random inputs, so the code is fine." What do you add to that sentence?**
That it passes for a thousand inputs *from this generator*, which is a much smaller claim. The
generator has a documented distribution that nobody on the team chose: numbers biased toward the
centre of the range, container sizes distorted toward the minimum, strings excluding
noncharacters, no nulls at all, `Optional` empty one time in twenty. So "a thousand random
inputs" may be a thousand short lists of small positive numbers. The way to turn the sentence
into something defensible is `Statistics.collect`, which reports the actual distribution of
whatever classification you care about and can fail the build when coverage of a case drops
below a threshold — that is [09 · Statistics](09-statistics.md), and it takes one line to add.

{/* FOOTER */}
**★ How would you write a property for code that must handle `NaN` and infinity correctly?**
I would start by knowing that jqwik will not generate them for me. The guide is explicit that
special decimal values are excluded because generation is constrained by significant decimal
places, and it gives `DoubleArbitrary.withStandardSpecialValues()` as the way to add
`MIN_VALUE`, `MIN_NORMAL`, `NaN` and the two infinities back. So the generator becomes a
`@Provide` method rather than a bare `@ForAll double`. Then I would fix the assertions, because
this is where such properties usually go wrong: `NaN != NaN`, so any round-trip or equality
property is now correctly red, and the honest fix is to state the intended semantics — either
`assertThat(Double.isNaN(result)).isTrue()` for the `NaN` branch, or an assumption that excludes
it if the contract says the input is never `NaN`. The guide also notes that special values are
treated as edge cases and used in exhaustive generation, so once they are in the arbitrary they
will actually turn up rather than being lost in a thousand random draws.

**★ Why does jqwik bias numeric generation toward the centre of the range rather than sampling uniformly, and when would you turn that off?**
Because the goal is finding bugs, not sampling a distribution. The documented default,
`RandomDistribution.biased()`, *"generates values closer to the center of a numerical range with
a higher probability"*, and the bigger the range the stronger the bias — combined with edge-case
injection, which supplies the extremes deliberately, that gives you many small values, a few
large ones, and the boundaries guaranteed. Uniform sampling of the `int` range would spend
almost every try on nine- and ten-digit numbers, which is not where defects live. I turn it off
when the property is *about* the distribution rather than about a law — a histogram check, a
load model, a hash function's spread — or when I have deliberately narrowed the range to a
boundary region and want to cover it evenly rather than clustering at its centre.

**★ You inherit a property suite where nothing is constrained: bare `@ForAll String`, bare `@ForAll List<Integer>`, bare `@ForAll int`. Is that good or bad?**
Both, and the split is worth being precise about. The good half is that unconstrained generation
is the widest domain available, so those properties test more input classes than any constrained
version would, and if they are green they are green over a large space — that is the strongest
form of the technique and I would not narrow them without a reason. The bad half is that the
distribution over that space is not uniform and nobody chose it: mostly short lists, mostly
small integers, no nulls, a narrowed string alphabet. So the suite is strong on breadth and
possibly blind on exactly the region the code has a threshold in. What I would do is not rewrite
the generators but measure them — add `Statistics.collect` classifying inputs by whatever the
code branches on, look at the numbers once, and constrain only the properties where the
interesting class turns out to be under-represented. That converts an argument about defaults
into two or three targeted changes.

{/* FOOTER */}
