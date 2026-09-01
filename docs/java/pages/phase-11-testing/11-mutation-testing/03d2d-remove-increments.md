---
title: "REMOVE_INCREMENTS has one sentence of documentation and two behaviours that sentence omits: it is the weaker perturbation than INCREMENTS and therefore the more informative one where it survives, and its infinite-loop mutants are removed by filters that match the shape of the mutated bytecode rather than the name of the operator — which is why enabling it does not produce a wave of timeouts"
sidebar_label: "03d2d · Remove increments"
sidebar_position: 17
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Remove Increments Mutator*
> and *Increments Mutator* sections, quoted verbatim — and pitest 1.30.0 source read at the `1.30.0`
> tag: `build/intercept/timeout/InfiniteLoopFilter.java`,
> `build/intercept/timeout/InfiniteForLoopFilterFactory.java`,
> `build/intercept/timeout/AvoidForLoopCountersFilterFactory.java` and
> `build/intercept/timeout/InfiniteIteratorLoopFilterFactory.java`. `TIMED_OUT`'s detected flag from
> `org.pitest.mutationtest.DetectionStatus`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour is quoted from pitest's
> documentation and read from its published source; the Java on this page is illustrative source,
> never a run.

**Pitest's entire documentation for this operator is one sentence, and the two things you actually need
to know about it are not in that sentence. It is the *weaker* perturbation than the default
`INCREMENTS` operator, which counter-intuitively makes it the more informative of the two. And the
obvious objection to it — that removing a loop counter's increment is the canonical infinite loop — is
answered by a filter mechanism that is worth understanding on its own, because it is shape-based rather
than name-based and therefore protects operators nobody has written yet.**

## The whole of the documentation

> *"Optional mutator that removes local variable increments."*

That is all pitest says. It is the deletion counterpart to `INCREMENTS`, which flips `++` to `--`:

> *"The increments mutator will mutate increments, decrements and assignment increments and decrements
> of local variables (stack variables). It will replace increments with decrements and vice versa."*

and, like `INCREMENTS`, it is restricted to **local** variables:

> *"Please note that the increments mutator will be applied to increments of local variables only.
> Increments and decrements of member variables will be covered by the Math Mutator."*

The restriction is not a design choice. The `iinc` opcode these operators target cannot address a field,
so `this.attempts++` compiles to a field read, an `iadd` and a field write, and belongs to `MATH`
([03b](03b-arithmetic-mutators.md)). Two lines of Java that look identical are two different bytecode
shapes, and the operator that fires on them differs accordingly.

## It is the weaker perturbation, which makes it the more informative one

Flipping `i++` to `i--` on a running counter changes the answer by twice the step; removing the
increment changes it by one step. Against a bare `isEqualTo` both mutants die. Against a loose
assertion — `isPositive()`, `isNotZero()`, a range check, an `isCloseTo` with a tolerance — the deletion
is the one more likely to survive, and a survivor is the finding you wanted.

```java
int attempts = 0;
while (!result.isSuccess() && attempts < MAX_ATTEMPTS) {
    result = call();
    attempts++;
}
return new CallOutcome(result, attempts);
```

```java
// Survives REMOVE_INCREMENTS: any positive attempt count satisfies it.
assertThat(outcome.attempts()).isPositive();

// Survives it too: the range is wide enough to absorb one step.
assertThat(outcome.attempts()).isBetween(1, 5);

// Kills it: the count is the thing a retry policy is actually about.
assertThat(outcome.attempts()).isEqualTo(3);
```

That is the same weak-assertion family that produces `MATH` and `PRIMITIVE_RETURNS` survivors
([03b](03b-arithmetic-mutators.md), [03c2](03c2-reading-a-returns-survivor.md)) arriving through a
third door. The pattern generalises: **an operator that perturbs a value by less is a finer probe of
the assertion**, and the default set deliberately does not include the finest ones, because on general
code the finest probe is also the one most likely to produce an equivalent mutant.

There is a corollary worth stating. If a class shows `INCREMENTS` clean and `REMOVE_INCREMENTS`
survivors, that is not a contradiction and it is not noise — it is a precise statement that the
assertions constrain a *range* rather than a *value*. Retry counts, page indexes, batch sizes and
attempt counters are where this lives, and all four are behaviours a caller depends on.

## Its infinite-loop mutants are filtered, and how is the interesting part

Removing the increment from a `for` counter is pitest's own canonical infinite loop:

> *"A mutation may time out if it causes an infinite loop, such as removing the increment from a
> counter in a for loop."*

So the obvious objection to enabling this operator is that it will fill the run with `TIMED_OUT`
results — which matters more than it sounds, because `TIMED_OUT` is classified as **detected**
([02c](02c-timeouts-and-determinism.md)), so a wave of them inflates the score as well as the runtime.

It does not happen, and the reason generalises. The three timeout filters are not lists of operator
names. `InfiniteLoopFilter` materialises each candidate mutant, reads the mutated method back as an
ASM tree and asks a sequence matcher whether the result now looks like an infinite loop:

```java
private boolean isInfiniteLoop(MutationDetails each, Mutater m) {
  final ClassTree mutantClass = ClassTree.fromBytes(m.getMutation(each.getId()).getBytes());
  final Optional<MethodTree> mutantMethod = mutantClass.methods().stream()
      .filter(forLocation(each.getId().getLocation()))
      .findFirst();
  return infiniteLoopMatcher().matches(mutantMethod.get().instructions());
}
```

Two details in the surrounding method matter as much as that one:

**It gives up when the unmutated method already loops forever.** The source comment is
`// give up if our matcher thinks loop is already infinite`, and the guard returns an empty list. A
deliberately unbounded loop — an event pump, a poller — is not blamed on a mutant, and its mutants are
not silently removed either.

**It only pays the cost of the analysis on candidates.** `couldCauseInfiniteLoop(method, each)` is
checked first, with the comment *"avoid cost of static analysis by first checking mutant is on on
instruction that could affect looping"*. Generating a mutant and re-parsing its bytecode is expensive;
pitest does it only for instructions that could plausibly matter.

The three features that use this machinery, with their descriptions verbatim from source:

| Feature | Default | Description |
|---|---|---|
| `FINFINC` | on | *"Filters mutations to increments that may cause infinite loops"* |
| `FFLOOP` | on | *"Filters any mutations to increments in for loops as they may cause timeouts"* |
| `FINFIT` | on | *"Filters mutations that may cause infinite loops by removing calls to iterator.next"* |

None of them names a mutator. So they remove `REMOVE_INCREMENTS` mutants on loop counters exactly as
they remove `INCREMENTS` ones, and they will remove the loop-hanging mutants of an operator a plugin
adds next year without anyone updating a list. What survives the filters is increments in **non-loop
positions** — a retry count, a page index, an accumulator — where a survivor is a real finding about an
unasserted number.

## Where this connects

- **[03d2 · Optional operators](03d2-the-optional-operator-inventory.md)** — the two-bucket rule for
  reading an optional operator's warning; this one's failure mode is neither, which is why its
  documentation is a single sentence.
- **[03d2c · Inline constants](03d2c-inline-constants.md)** — the other optional operator that corrupts
  a value.
- **[03d2e · The call-neutralising operators](03d2e-the-call-neutralising-operators.md)** —
  `CONSTRUCTOR_CALLS` and `NON_VOID_METHOD_CALLS`, and the honest ranking across all five.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — `INCREMENTS` and the `iinc` restriction
  that sends field increments to `MATH`.
- **[02c · Timeouts and determinism](02c-timeouts-and-determinism.md)** — the legitimate infinite loop,
  and why `TIMED_OUT` counting as detected makes these filters load-bearing rather than cosmetic.
- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — `FINFINC`, `FFLOOP` and `FINFIT` in
  the context of every other filter, and the `+`/`-` syntax for switching them.
- **[03c2 · Reading a returns survivor](03c2-reading-a-returns-survivor.md)** — `PRIMITIVE_RETURNS`,
  the other operator whose survivors mean "the number is not pinned".

## Gotchas

**★ `REMOVE_INCREMENTS` only touches locals, so it does nothing for a counter field.**
Like `INCREMENTS`, it targets the `iinc` opcode, which the JVM restricts to stack variables. A
`private int attempts;` incremented with `this.attempts++` compiles to a field read, an add and a field
write, and belongs to `MATH`. Enabling `REMOVE_INCREMENTS` to measure a retry counter held in a field
measures nothing, and the operator that does measure it is one you already have on.

**★ `REMOVE_INCREMENTS` survivors cluster exactly where `INCREMENTS` mutants were killed, and that is the point.**
The deletion moves the value by one step where the flip moves it by two, so an assertion that catches the
flip can miss the deletion. A class showing `INCREMENTS` clean and `REMOVE_INCREMENTS` survivors is not
inconsistent — it is telling you the assertions constrain a range rather than a value.

**★ The timeout filters are shape-based, not operator-based, so they cover operators you have not enabled yet.**
`InfiniteLoopFilter` builds the mutant, re-reads the mutated method and matches an instruction pattern.
Nothing in it names `INCREMENTS`. That is why turning on `REMOVE_INCREMENTS` does not produce a wave of
`TIMED_OUT` results on loop counters, and why an operator supplied by a plugin gets the same protection
for free.

**★ The filters deliberately do nothing to a method that already loops forever.**
`InfiniteLoopFilter` checks the unmutated method first and returns immediately if it already matches the
pattern — `// give up if our matcher thinks loop is already infinite`. An event pump or a polling loop
therefore keeps all its mutants, and any timeouts they produce are real measurements of your code rather
than artefacts. Do not read a timeout on such a method as a filter failure.

**★ A `TIMED_OUT` result from a loop mutant counts as a kill, so an unfiltered wave of them raises the score.**
`DetectionStatus` declares `TIMED_OUT(true)` with the javadoc *"might indicate an that the mutation
caused an infinite loop but we don't know for sure"*. That is defensible for a genuine hang and terrible
as a bulk phenomenon. The filters exist as much to protect the numerator as to protect the clock.

**★ Nothing in the report tells you a loop mutant was filtered.**
A filtered mutant is never generated, so it appears under no status at all — not survived, not filtered
([02b3](02b3-the-filter-inventory.md)). The mutant count for a loop-heavy class is therefore lower than
the source suggests, and its score correspondingly less informative. That is the right trade and it is
invisible.

**★ Enabling `REMOVE_INCREMENTS` on a codebase written with streams finds almost nothing.**
The operator needs an explicit local counter. Code written as `orders.stream().filter(...).count()` has
no `iinc` instruction anywhere, so neither increments operator applies, and the behaviour is measured —
if at all — by the returns mutators on the method that produces the number. This is a general property
worth internalising: what pitest can measure depends on which bytecode your style produces.

## Interview questions

**★ Why do `INCREMENTS` and `REMOVE_INCREMENTS` both exist, and what does a survivor of the second mean?**
`INCREMENTS` flips `++` to `--`; `REMOVE_INCREMENTS` deletes the increment entirely. Both are limited to
local variables because they target the `iinc` opcode, which the JVM does not allow for fields. The
deletion is the weaker perturbation — one step rather than two — so it survives assertions that
`INCREMENTS` kills, which makes it the more informative of the two where it survives. On loop counters
both are mostly filtered before they run. What is left is increments in non-loop positions — a retry
count, a page index, an accumulator — and a survivor there says the count is never asserted, which on a
retry policy or a pagination routine is exactly the behaviour the class exists for.

**★ A colleague says the timeout filters will not protect them if they enable a new operator. Are they right?**
No, and the reason generalises. The three timeout filters are not lists of operator names.
`InfiniteLoopFilter` takes each candidate mutant, materialises the mutated bytecode, re-reads it as a
method tree and asks a sequence matcher whether the result looks like an infinite loop; it also gives up
immediately if the *unmutated* method already matches, so a genuinely unbounded loop in your own code is
not blamed on a mutant. Because the test is on the shape of the mutated instructions, it protects
`REMOVE_INCREMENTS`, `INCREMENTS`, and any operator a plugin adds later, without anyone updating a list.
That matters more than it sounds, because `TIMED_OUT` counts as detected — an unfiltered wave of loop
mutants would inflate the score as well as the runtime.

**★ Why is a weaker mutant a better probe than a stronger one, and why is the default set not made of weak mutants?**
Because the mutant has to be small enough that a loose assertion cannot notice it. A change of one step
in a counter survives `isPositive()` and a range check; a change of two steps is more likely to fall
outside the range and die for reasons unrelated to whether anyone pinned the value. So the weaker probe
distinguishes a strong assertion from a lazy one more sharply. The reason the default set is not built
from the weakest possible mutants is the second half of pitest's design criterion: the smaller the
perturbation, the higher the chance it makes no observable difference at all for the inputs your fixtures
use, and an equivalent mutant is a permanent survivor that nobody can act on. The default set sits at the
point where mutants are still hard to kill and still killable.

**★ Your retry logic shows a `REMOVE_INCREMENTS` survivor. Walk through fixing it.**
First check that the counter is a local and not a field — if it were a field the operator would not have
generated a mutant at all, and what you are looking at is `MATH`. Then look at the assertion on the
attempt count: the survivor means it is a range or a sign check rather than a value, so a run that made
two attempts satisfies a test written for three. The fix is to assert the exact number of attempts, and
usually also the exact number of calls to the collaborator, because a retry policy's contract is "at most
N times" and both halves of that are numbers. If the count genuinely is not part of the contract — a
best-effort background retry, say — then the honest move is to say so, and the survivor is one you accept
rather than kill.

{/* FOOTER */}
