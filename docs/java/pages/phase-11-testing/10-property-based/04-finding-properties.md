---
title: "The hard part of property-based testing is never the API, it is answering what is true for every input — and there are four relations you can look for mechanically, round-trip, idempotence, preserved invariant and order-independence, which between them cover most of the code in a normal codebase"
sidebar_label: "04 · Finding properties"
sidebar_position: 14
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Creating a
> Property*, *Assumptions*, *Filtering*, *Mapping* and *Uniqueness Constraints*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)) for every API used below; and
> the **AssertJ 3.27.7** API for the assertions.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — read
> [02b · The version collision](02b-the-version-collision.md) before adding it to a Boot 4.1
> build.
> ⚠️ **The four names below — round-trip, idempotence, invariant, commutativity — are the
> community's taxonomy, not jqwik's.** The guide documents the API, not a catalogue of
> relations; nothing on this page claims otherwise, and the code is validated against the API
> docs rather than the naming.
> ⚠️ **No sandbox and no test run on this machine** — Java source only, never its output.

**Everyone who tries property-based testing gets stuck in the same place, and it is not the
annotations. You have a method, you have `@ForAll`, and you cannot think of a single thing
that is true for every input except the thing the method already does. That block is real and
it has a mechanical way out: stop trying to invent a statement about the output, and start
looking for one of four *relations* — between the function and its inverse, between the
function and itself, between the output and something the input already told you, and between
two orderings of the same work. Almost every function in a normal codebase has at least one.**

## Why "what is the expected result" is the wrong question

An example test asks: *for this input, what comes out?* A property cannot ask that, because
it does not know the input. If you try to answer it anyway you end up writing the
implementation twice — `assertThat(slug).isEqualTo(input.toLowerCase().replace(' ', '-'))` —
which passes forever, including when both copies are wrong, and which
[12 · The cost](12-the-cost.md) treats as the central failure mode of the technique.

The question a property answers is a different one: *what relation holds between the inputs
and the outputs, whatever they are?* Relations are weaker than values, and that weakness is
what makes them checkable a thousand times without knowing any of the answers.

## Relation 1 — round-trip: `decode(encode(x))` equals `x`

The strongest and easiest property in existence. If your code has a pair of functions that
are supposed to undo each other, you already have a property and you do not need to invent
anything.

```java
@Property
void jsonRoundTripsThroughTheMapper(@ForAll("orders") Order original) throws Exception {
    String json = mapper.writeValueAsString(original);
    Order restored = mapper.readValue(json, Order.class);
    assertThat(restored).isEqualTo(original);
}

@Property
void base64RoundTrips(@ForAll byte[] payload) {
    String encoded = Base64.getEncoder().encodeToString(payload);
    assertThat(Base64.getDecoder().decode(encoded)).isEqualTo(payload);
}

@Property
void parsingAMoneyStringIsTheInverseOfFormattingIt(@ForAll("money") Money original) {
    assertThat(Money.parse(original.format())).isEqualTo(original);
}
```

Look for these pairs by name; they are almost always adjacent in the codebase:
serialise/deserialise, encode/decode, parse/format, marshal/unmarshal, compress/decompress,
encrypt/decrypt, `toDto`/`fromDto`, `write`/`read`, push/pop, `URLEncoder`/`URLDecoder`.

⚠️ **A round-trip property tests the pair, not either half.** Two functions that agree on a
wrong convention round-trip perfectly: a serialiser that writes dates in the JVM's default
zone and a deserialiser that reads them in the same default zone will round-trip on every
input and still be wrong the moment the data crosses a machine. Round-trip properties are
cheap and they are not sufficient; pair them with one invariant that pins the wire format
(`assertThat(json).contains("\"amount\":\"12.50\"")` as an ordinary example test).

## Relation 2 — idempotence: doing it twice changes nothing

If applying an operation to its own output is supposed to be a no-op, that is a property, and
it catches a specific and common class of bug: operations that are *nearly* idempotent.

```java
@Property
void slugifyingASlugChangesNothing(@ForAll String input) {
    String once  = Slug.of(input).value();
    String twice = Slug.of(once).value();
    assertThat(twice).isEqualTo(once);
}

@Property
void trimmingIsIdempotent(@ForAll String input) {
    assertThat(input.trim().trim()).isEqualTo(input.trim());
}

@Property
void normalisingAnAddressTwiceIsTheSameAsOnce(@ForAll("addresses") Address a) {
    Address once = normaliser.normalise(a);
    assertThat(normaliser.normalise(once)).isEqualTo(once);
}
```

The pattern applies far past string handling. `PUT` handlers, upserts, "ensure the directory
exists", retry-safe message consumers, cache warmers, database migrations and de-duplicators
are all *claimed* to be idempotent in design documents, and an idempotence property is the
only cheap way to hold them to it. A truncating slug function that appends a hash suffix is
the classic failure: `slug(slug(x))` truncates again and appends a second suffix, so the
second call is not a no-op and the URL you generated is not the URL you stored.

## The other two relations, and what to do when none of them fits

Round-trip and idempotence are the two that are *findable by grep* — you look for a pair of
inverse method names, or for an operation the design document calls "safe to retry". The
remaining two are findable by reading a signature rather than a name, and they cover far more
code: a preserved invariant (the output has a size, a sum or a shape the input determines) and
order-independence (two things that could have been supplied in either order). Both are
[04b · Invariants and order-independence](04b-invariants-and-order-independence.md).

When none of the four fits — no inverse, not idempotent, nothing obviously preserved, one
argument — there are still four weaker moves that work, and a checklist you can run over a
class in five minutes: [04c · When no law is obvious](04c-when-no-law-is-obvious.md).

## Where this connects

- The mechanics of writing the method these relations go inside are
  [03 · Writing a property](03-a-property.md).
- The other two mechanical relations are
  [04b · Invariants and order-independence](04b-invariants-and-order-independence.md).
- Totality, generalising a postcondition, cross-method consistency and the five-minute
  checklist are [04c · When no law is obvious](04c-when-no-law-is-obvious.md).
- Comparing against a simple model, metamorphic relations and jqwik's documented contract-test
  mechanism are
  [04d · Models, oracles and metamorphic relations](04d-models-oracles-and-metamorphic-relations.md).
- Generating the `Order`, `Money` and `Address` values these examples assume is
  [05 · Generators](05-generators.md).
- Where these relations are worth the effort is [10 · Where it pays](10-where-it-pays.md);
  where they are not is [11 · Where it does not pay](11-where-it-does-not-pay.md).
- The property that merely restates the implementation, which every one of these patterns can
  degenerate into, is [12 · The cost](12-the-cost.md).

## Gotchas

**★ A round-trip property passes when both halves share the same wrong assumption, and that is exactly how timezone bugs survive test suites.**
`parse(format(x)) == x` holds if both sides use `ZoneId.systemDefault()`, both sides truncate
to milliseconds, or both sides silently drop a field the DTO does not have. The property is
still worth having — it catches asymmetry, which is the commonest serialisation defect — but
it cannot see a symmetric error. Pin the format itself with at least one example test that
asserts on the actual bytes or the actual string.

**★ An idempotence property on a function that appends a disambiguating suffix passes on almost every input and fails on exactly the ones that matter.**
`Slug.of` with a length cap that appends a hash on truncation is idempotent for every short
string — which is most randomly generated strings — and not idempotent at the boundary. This is
the case for reading `edge-cases#tried` in the report and for constraining the generator toward
the limit rather than leaving it at the default, which is
[05b · Constraining generation](05b-constraining-generation.md) and
[08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md).

**★ A round-trip property over a type with a hand-written `equals` is testing your `equals` as much as your mapper, and when it fails you will not know which.**
`assertThat(restored).isEqualTo(original)` routes the entire assertion through
`Order.equals`. If that method compares six of the class's seven fields, the property is green
for a mapper that loses the seventh. If it compares a `BigDecimal` with `equals` rather than
`compareTo`, the property is red for a mapper that is correct. Before trusting a round-trip
property over a domain object, write the `equals`/`hashCode` contract properties for that
object — they are four lines and they are in
[04d](04d-models-oracles-and-metamorphic-relations.md).

**★ `@ForAll byte[]` and `@ForAll String` do not generate the same alphabet, and a Base64 round-trip that passes on strings can fail on bytes.**
jqwik's guide states that when generating characters *"any unicode character might be
generated"*, but that for strings *"Unicode 'noncharacters' and 'private use characters' will
not be generated unless you explicitly include them"*. A codec property over `String` therefore
runs on a deliberately-narrowed alphabet; the same codec over `byte[]` sees everything. If your
production input is bytes off a socket, generate bytes.

**★ An idempotence property is only meaningful if the operation's output type is its input type, and people force it with a conversion that hides the defect.**
`normalise(parse(format(normalise(x))))` is not an idempotence property; it is a round-trip
wrapped around one, and if it fails you cannot tell which of the four calls is at fault. Where
the types do not line up, the honest property is the round-trip alone. Forcing the shape is how
a property stops being able to localise a failure — which, with shrinking, is most of what you
were buying.

## Interview questions

**★ You have a `PricingService.quote(Basket, Customer)` and you cannot think of a single property. Talk me through how you would find one.**
I would stop looking for a statement about the price and start looking for relations. Bounds
first: the quote is never negative, and never more than the undiscounted total — two lines,
and they hold for every basket. Monotonicity next: adding a line item never decreases the
total, which is a metamorphic relation between two calls rather than a claim about either one.
Conservation: the sum of the per-line amounts equals the header total, which catches every
rounding-distribution bug there is. Consistency: `quote(basket, customer).currency()` equals
the customer's currency for every input. Order-independence: two discounts of the same kind
applied in either order give the same result — and if that turns out to be false, I have
learned something about the domain that the example tests never asked. None of those needs me
to know what the right price is, which is the thing I was stuck on.

**★ What is the difference between a round-trip property and an idempotence property, and which finds more bugs?**
A round-trip involves two functions that are inverses — `parse(format(x)) == x` — and it tests
their *agreement*, so it fails when the pair drifts apart. Idempotence involves one function
applied to its own output — `f(f(x)) == f(x)` — and it tests *stability*, so it fails when an
operation that claims to be safe to repeat is not. Round-trips find more bugs on the day you
write them, because serialisation code is full of asymmetries. Idempotence finds more expensive
bugs later, because an operation that is nearly idempotent breaks under retry, and retries only
happen in production. If I had one to write on a message consumer, it would be idempotence; on
a DTO mapper, round-trip.

**★ A round-trip property over your JSON mapper has been green for a year. What does it actually guarantee about your API's compatibility with its consumers?**
Almost nothing, and this is worth being precise about because teams treat it as a contract
test. It guarantees that your serialiser and your deserialiser agree with each other, in this
version of the code, in this JVM. It says nothing about the wire format: rename a field and the
property stays green, because both halves renamed together. It says nothing about consumers,
who parse your JSON with their own code. And it says nothing about older payloads, because the
generator only ever produces objects of the current shape. What it *does* catch is a mapper
configuration change that breaks symmetry — a custom serialiser added without its matching
deserialiser — which is a real class of defect. For compatibility you want a golden-file test
against recorded payloads, which is an example test, and this is one of the places where the
two techniques are complements rather than alternatives.

**★ Your team's message consumer is documented as idempotent. Write the property and say what it would take for it to be a real test rather than a decorative one.**
The property is: process the same message twice, and the observable state after the second
call equals the state after the first — `consumer.handle(msg); State after1 = snapshot();
consumer.handle(msg); assertThat(snapshot()).isEqualTo(after1);` over a generated message. What
makes it real rather than decorative is what `snapshot()` covers. If it reads one aggregate,
the property misses the duplicated audit row, the second outbound event and the twice-decremented
counter — which are exactly the failures duplicate delivery causes. So the property is only as
strong as the state it observes, and writing it usually forces the useful conversation about
what "the state" of that consumer even is. The second thing it needs is a generator that
produces messages which *collide* — same idempotency key, different payload — because random
generation will essentially never produce a duplicate key by chance; jqwik's documented tool
for that is `injectDuplicates`, in [05c](05c-composing-arbitraries.md).

{/* FOOTER */}
