---
title: "The domains in the previous chunk were pure functions with a definition you could look up, but the same test applies to code that imposes an order or holds state — and there the law is often stronger, because a comparator, a cache, an optimised algorithm and a state machine all make the same kind of claim: that they behave exactly like something simpler, slower or more restrictive"
sidebar_label: "10b · Where it pays: ordering and state"
sidebar_position: 43
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **JDK 25 javadoc** for `java.util.Comparator`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Comparator.html))
> and `java.util.List.sort`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html));
> and the **jqwik 1.10.1 user guide**, sections *Assumptions* and *Stateful Testing*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** No timing, benchmark or run output appears
> on this page; the failure modes described are the documented or well-established ones.

**[10](10-where-it-pays.md) catalogued the pure-function domains — parse, render, round, escape.
This page is the other half, and the properties here tend to be stronger rather than weaker,
because ordering and state come with claims that are easy to state and hard to satisfy: a
comparator claims a total order, a cache claims invisibility, an optimised algorithm claims it
agrees with the naive one, and a state machine claims certain states can never be reached.**

## 5 · Comparators and ordering

`Comparator` is unusual: its contract is written down, formally, in the javadoc, so the
properties are transcription rather than invention.

> *"The implementor must ensure that `signum(compare(x, y)) == -signum(compare(y, x))` for all
> `x` and `y`."*
>
> *"The implementor must also ensure that the relation is transitive:
> `((compare(x, y)>0) && (compare(y, z)>0))` implies `compare(x, z)>0`."*
>
> *"Finally, the implementor must ensure that `compare(x, y)==0` implies that
> `signum(compare(x, z))==signum(compare(y, z))` for all `z`."*

```java
@Property
void comparatorIsAntisymmetric(@ForAll("tickets") Ticket a, @ForAll("tickets") Ticket b) {
    assertThat(Integer.signum(BY_PRIORITY.compare(a, b)))
            .isEqualTo(-Integer.signum(BY_PRIORITY.compare(b, a)));
}

@Property
void comparatorIsTransitive(
        @ForAll("tickets") Ticket a, @ForAll("tickets") Ticket b, @ForAll("tickets") Ticket c) {
    Assume.that(BY_PRIORITY.compare(a, b) > 0 && BY_PRIORITY.compare(b, c) > 0);
    assertThat(BY_PRIORITY.compare(a, c)).isGreaterThan(0);
}
```

Transitivity is the one that breaks, and it breaks on comparators that look obviously fine — a
"sort by priority, but always put pinned items first" rule, or any comparator built by
subtracting fields where one field can be `null` or can overflow. The consequence is documented
and worth quoting because of one word:

> `IllegalArgumentException` — **(optional)** *"if the comparator is found to violate the
> `Comparator` contract"*

**Optional.** `List.sort` is *"a stable, adaptive, iterative mergesort … adapted from Tim
Peters's list sort for Python (TimSort)"*, and TimSort detects some contract violations and
throws — but it is not required to, and it does not on small inputs. So a broken comparator's
usual production behaviour is not an exception; it is a list in the wrong order, on some inputs,
in a report nobody diffs. That combination — a formally specified contract, a violation that is
easy to write, and a failure mode that is silent — is as close to a perfect case for property
testing as Java offers.

⚠️ Note the `Assume.that` in the transitivity property: it discards draws that do not satisfy the
premise, and a naive generator discards most of them. Watch the discard ratio
([05b2](05b2-filtering-assumptions-and-discards.md)) or generate the ordered triple directly.

## 6 · Caches, and anything that claims to be invisible

A cache makes the strongest property claim in ordinary software: **you cannot tell it is there.**
That is a model property ([04d](04d-models-and-oracles.md)) where the model is your own uncached
code path.

```java
@Property
void cachingChangesNothingButSpeed(@ForAll("keySequences") List<CustomerId> lookups) {
    CustomerService uncached = new CustomerService(repository);
    CustomerService cached   = new CustomerService(new CachingRepository(repository));

    for (CustomerId id : lookups) {
        assertThat(cached.find(id)).isEqualTo(uncached.find(id));
    }
}
```

Generating a *sequence* rather than a single key is what makes this work: the interesting cases
are the second lookup of the same key, a lookup after an eviction, a lookup interleaved with a
write. A single generated key exercises a cold cache every time and proves nothing. The bugs it
catches are the classic ones — a cache keyed on something that omits the tenant, a stale entry
after an update, a negative result cached forever, an entry whose key collides because the key
type's `hashCode` ignores a field.

The same shape applies to anything claiming transparency: a memoisation wrapper, a connection
pool, a lazily-initialised holder, a retrying decorator that claims to be invisible for
successful calls.

## 7 · An optimised implementation against the obvious one

Whenever a fast implementation replaced a slow one, the slow one is a test oracle — and it is
usually still in the git history, or is three lines to write.

```java
@Property
void keysetPageMatchesTheNaiveQuery(@ForAll("catalogues") List<Product> all,
                                    @ForAll @IntRange(min = 1, max = 50) int pageSize) {
    List<Product> naive = all.stream()
            .sorted(BY_PRICE_THEN_ID)
            .limit(pageSize)
            .toList();

    assertThat(Pagination.firstKeysetPage(all, pageSize)).isEqualTo(naive);
}
```

This is the highest-confidence property available, because the assertion is not an invariant you
reasoned your way to — it is equality with code that is obviously correct. It applies to more
code than people expect: a hand-rolled binary search against a linear scan, a bit-twiddling
routine against `BigInteger`, an incremental total against a full recomputation, a streaming
aggregation against collecting into a list first, a custom `equals`/`hashCode` against field-wise
comparison.

⚠️ The trap is a "reference" implementation that shares code with the thing under test. If both
call the same comparator, both are wrong together and the property is green. The oracle has to be
independently obvious, which sometimes means writing the naive version *in the test* and
accepting that it is slow.

## 8 · State machines and reachability

Where a domain object has a lifecycle — draft → published → archived, or created → paid →
shipped → refunded — the properties are about what can never happen, and generating a *sequence
of commands* is the technique.

```java
@Property
void anOrderNeverShipsWithoutPayment(@ForAll("commandSequences") List<OrderCommand> commands) {
    Order order = Order.newOrder();
    for (OrderCommand command : commands) {
        try {
            order = command.applyTo(order);
        } catch (IllegalStateTransition rejected) {
            // A rejected command is a legal outcome. The invariant is about what got through.
        }
    }
    if (order.status() == SHIPPED) {
        assertThat(order.paidAt()).isNotNull();
    }
}
```

The generated command sequence reaches interleavings nobody writes by hand — refund before
payment, two payments, cancel after ship, a duplicate of the same command — and the assertion is
a safety property: *this must never be true*. jqwik ships dedicated support for this shape, an
action-sequence type the guide describes as *"a generic collection type especially crafted for
holding and shrinking of a list of actions"*; the plain list-of-commands version above is worth
knowing because it needs no extra API.

⚠️ **Catching the rejection matters.** If illegal transitions throw and you do not catch them, the
property fails on the first generated sequence and tests only that your generator produces legal
sequences. What you want to assert is the invariant over whatever state the object reached.

## Where this connects

- The pure-function domains — parsers, money, dates, escaping — are
  [10 · Where it pays](10-where-it-pays.md).
- Where no law exists and forcing one restates the implementation is
  [11 · Where it does not pay](11-where-it-does-not-pay.md).
- The runtime bill, and why a model property runs the work twice, is
  [12 · The cost](12-the-cost.md).
- The model-and-oracle technique the cache and reference-implementation cases rely on is
  [04d · Models and oracles](04d-models-and-oracles.md).
- Discards and the `maxDiscardRatio` failure the transitivity property runs into are
  [05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).

## Gotchas

**★ The comparator contract is three laws and testing one of them proves little.**
Antisymmetry is the easy one and it is the one that holds in almost every broken comparator.
Transitivity is where "sort by score, but pinned first" collapses, and the third law — equal
elements must order identically against every other element — is the one nobody has heard of and
which sorted sets depend on. Write all three, and note that the javadoc's caution about
comparators *"inconsistent with equals"* is a fourth, separate concern about `SortedSet` and
`SortedMap` behaving *"strangely"*.

**★ A transitivity property with a naive generator spends almost all its tries on discarded draws.**
`Assume.that(compare(a,b) > 0 && compare(b,c) > 0)` throws away every triple that does not
happen to be ordered, which for three independently drawn values is most of them. jqwik fails the
property when the discard ratio is exceeded — the default `maxDiscardRatio` is 5 — so this often
presents as a property that fails for a reason unrelated to the code under test. Generate the
triple as a unit, or sort three drawn values and use the ordering you constructed.

**★ A cache property that generates one key per try tests a cold cache a thousand times.**
The entire value of a cache property is in the second and subsequent access to the same key, and
a generator that draws an independent key per try almost never repeats one — especially if the
key type is a UUID or a long. Generate a *sequence* drawn from a deliberately small key pool, so
repeats, evictions and interleaved writes actually occur. This is the same lesson as
`Arbitraries.of` argument order: what the generator makes likely determines what the property
tests, and the defaults are rarely tuned for the case you care about.

**★ A reference implementation that shares a helper with the code under test proves the two agree, not that either is right.**
If the optimised path and the naive path both call the same comparator, the same normaliser or
the same date parser, a bug in the shared piece produces identical wrong answers and a green
property. The oracle has to be independently obvious — which sometimes means duplicating logic in
the test, deliberately, and resisting the reviewer who asks you to extract it. Write a comment
saying why the duplication is the point.

**★ A state-machine property that does not catch rejected commands tests your generator, not your aggregate.**
If illegal transitions throw and the property lets the exception escape, the first generated
sequence containing an illegal command fails the property — so people "fix" it by generating only
legal sequences, at which point the property can no longer discover that an illegal sequence is
*accepted*. Catch the rejection, let the sequence continue from the unchanged state, and assert
the invariant on wherever the object ended up. The rejections are data, not failures.

**★ "The cache is invisible" is false for anything that observes call counts, and a property that asserts both is asserting the cache does not work.**
A caching layer genuinely is invisible for value and deliberately not for effects. Adding
`verify(repository, times(lookups.size()))` to the equivalence property asserts every lookup
reached the repository — which is the negation of what a cache does. Decide which claim you are
testing: value-equivalence is the property, and call-count assertions belong in a separate,
deliberately cache-aware test.

**★ A generated command sequence with uniform command weights spends most of its length being rejected.**
If `Cancel`, `Refund` and `Ship` are as likely as `Pay` from the initial state, most generated
sequences are a long run of rejections that never reach an interesting state, and the property
passes trivially because the object stayed in `NEW`. Weight the commands toward the happy path
with `Arbitraries.frequency` so sequences actually progress, and keep enough of the illegal ones
to probe the guards — and remember that frequency ordering is also shrink ordering
([06 · Shrinking](06-shrinking.md)).

## Interview questions

**★ Why are comparators a particularly good target?**
Three reasons that rarely coincide. The contract is formally specified in the `Comparator`
javadoc — antisymmetry, transitivity, and consistency of equal elements against all others — so I
am transcribing laws rather than inventing them. Violations are easy to write accidentally: any
"sort by X but always put Y first" rule, or a comparator built by subtracting fields, tends to
break transitivity while looking correct. And the failure mode is silent. `List.sort` documents
`IllegalArgumentException` as **optional** — TimSort detects some violations and is not required
to, and it does not on short lists — so the usual production symptom is not a crash but a list in
the wrong order on some inputs. Specified contract, easy to break, silent when broken: that is
exactly the gap between what unit tests check and what is true, and it is where generated inputs
earn their cost.

**★ How would you property-test a cache?**
By asserting the thing a cache actually claims: that it is invisible. I run the same sequence of
operations against the cached component and against an uncached one built over the same
repository, and assert the results are equal at every step — a model property where the model is
my own slow path, so I am not inventing an invariant, I am asserting equivalence with obviously
correct code. The critical detail is generating a *sequence* of keys drawn from a small pool
rather than one key per try: a cache's interesting behaviour is entirely in repeat access,
eviction and read-after-write, and independently drawn keys give a cold cache a thousand times
over. What I would deliberately keep out of that property is any assertion about call counts or
timing, because those assert the cache *is* working, which is a different claim and makes the
property fail for a correct-but-differently-tuned cache. The bugs this finds in practice are keys
that omit a dimension such as tenant or locale, stale entries after a write, and negative results
cached forever.

**★ You have replaced a slow implementation with a fast one. How do you convince yourself the fast one is right?**
Keep the slow one as a test oracle and assert they agree on generated input. It is the strongest
property available, because I am not reasoning my way to an invariant that might itself be wrong
— I am asserting equality against code whose correctness is obvious by inspection. The generator
matters more than usual here: the fast implementation is fast because it exploits structure, so
the inputs that break it are the ones without that structure — the empty collection, the
already-sorted input, the all-equal input, the single element, duplicate keys, a size exactly at
a block boundary. Two cautions. The oracle must not share code with the subject, or a bug in the
shared piece makes both wrong and the property green. And the property is slow by construction,
since it does the work twice and the naive side is the slow side — so this is a case where I
would lower `tries` deliberately and say why in the annotation rather than let it dominate the
suite.

**★ How do you property-test something with a lifecycle, like an order or a document that moves between states?**
By generating a sequence of commands rather than a single input, applying them in order, and
asserting a safety property about wherever the object ended up — "if it shipped, it was paid",
"an archived document is never editable", "the total never goes negative". The value is in the
interleavings: generated sequences produce refund-before-payment, two payments, cancel-after-ship
and duplicate commands, which is exactly the set of orderings nobody enumerates by hand and
exactly where lifecycle bugs live. Two details decide whether the property works. Rejected
commands have to be caught and treated as a legal outcome, otherwise the property is only testing
that the generator produces valid sequences — and people usually "fix" it in that direction,
which removes its ability to catch an illegal transition being wrongly *accepted*. And the
command distribution has to be weighted toward progress, or sequences never leave the initial
state and the property passes without ever reaching the guard it was written for.

{/* FOOTER */}
