---
title: "PIT ships far more operators than it enables, and the machinery that decides which ones run does not behave the way the documentation implies: the group literally named DEFAULTS is not the set you get when you configure nothing, OLD_DEFAULTS is documented but not registered, and there is an undocumented minus-prefix syntax that is almost always the right way to change an operator set"
sidebar_label: "03d · Optional mutators"
sidebar_position: 13
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page (the group table and the
> *Inline Constant*, *Remove Conditionals*, *Remove Increments*, *Constructor Call*, *Non Void
> Method Call*, *Experimental Member Variable*, *Experimental Switch*, *Experimental Argument
> Propagation*, *Experimental Naked Receiver* and *Experimental Big Integer* sections), the
> [FAQ](https://pitest.org/faq/) entry *"Can I activate more mutators without relisting all the
> default ones?"*, and the [Maven quick start](https://pitest.org/quickstart/maven/) `mutators`
> parameter. Group membership and resolution read from pitest 1.30.0 source at the `1.30.0` tag:
> `engine/gregor/config/StandardMutatorGroups.java`, `engine/gregor/config/Mutator.java`,
> `engine/gregor/config/GregorEngineFactory.java`, `mutators/RemoveConditionalMutatorGroup.java`,
> `mutators/returns/ReturnsMutatorGroup.java`,
> `mutators/experimental/RemoveSwitchMutatorGroup.java` and
> `META-INF/services/org.pitest.mutationtest.engine.gregor.config.MutatorGroup`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter
> 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Operator descriptions are quoted from pitest's
> documentation; group membership is read from published source. No mutant count or score on this
> page came from a run.

**Most of PIT's operators are switched off, and pitest states the criterion plainly: default
operators must be *stable* — hard enough to detect that killing one means something — and must
generate few equivalent mutants. Everything that fails either test sits in `STRONGER`, in `ALL`, or
nowhere at all. That is the easy half. The hard half, and this chunk's subject, is that the group
machinery does not behave the way its documentation implies, and three of its surprises change what
your build actually runs: the implicit default set and the group named `DEFAULTS` are different
sets, `OLD_DEFAULTS` is documented but not registered in 1.30.0, and there is an undocumented
exclusion syntax that makes almost every real-world operator change a one-line edit instead of a
full re-listing. The operators themselves — what each optional one does and whether to switch it on
— are [03d2](03d2-the-optional-operator-inventory.md) and
[03d3](03d3-the-research-operators.md).**

## 🔴 The default set and the `DEFAULTS` group are not the same set

This is read from source, not from documentation, and I could not find any pitest document that
states it. `GregorEngineFactory` decides what to run:

```java
private static Collection<? extends MethodMutatorFactory> createMutatorListFromArrayOrUseDefaults(
    final Collection<String> mutators) {
  if ((mutators != null) && !mutators.isEmpty()) {
    return Mutator.fromStrings(mutators);
  } else {
    return Mutator.newDefaults();
  }
}
```

Two different paths.

**Configure nothing** and you get `Mutator.newDefaults()`, whose javadoc reads *"Proposed new
defaults - replaced the RETURN_VALS mutator with the new more stable set"* and whose contents are
`INVERT_NEGS`, `MATH`, `VOID_METHOD_CALLS`, **`NEGATE_CONDITIONALS`**, `CONDITIONALS_BOUNDARY`,
`INCREMENTS`, plus the five returns mutators. Eleven operators — the set
[chunk 03](03-mutators.md) documents.

**Write `<mutator>DEFAULTS</mutator>`** and you get the group registered by
`StandardMutatorGroups`:

```java
mutators.put("DEFAULTS", gather(mutators,"INVERT_NEGS",
        "MATH",
        "VOID_METHOD_CALLS",
        "REMOVE_CONDITIONALS_ORDER_ELSE",
        "REMOVE_CONDITIONALS_EQUAL_ELSE",
        "CONDITIONALS_BOUNDARY",
        "INCREMENTS", "RETURNS"));
```

`NEGATE_CONDITIONALS` is **not** in it. In its place are two of the four remove-conditionals
variants, and `RETURNS` expands to the same five returns operators. Twelve operators, one of them
different in kind from anything in the implicit set.

⚠️ **This contradicts the mutators page's group table**, which marks *Negate Conditionals* as `yes`
under `DEFAULTS` and does not list the remove-conditionals operators in the table at all. I could
not find documentation reconciling the two, so state it as what it is: **the docs describe the
implicit default set, and the string `DEFAULTS` resolves to something else in 1.30.0.** If you care
which operators ran — and for a score you are going to compare over time, you do — do not trust
either the table or the group name. Run with `verbose` logging on, which prints the active
operators, and read the *Active mutators* list at the bottom of every HTML source page
([04a](04a-the-html-report.md)).

## `OLD_DEFAULTS` is documented and not registered

The mutators page's table has an `OLD_DEFAULTS` column with entries in it. The 1.30.0 engine
registers exactly five group names — `DEFAULTS` and `STRONGER` from `StandardMutatorGroups`,
`RETURNS`, `REMOVE_CONDITIONALS` and `REMOVE_SWITCH` from the three other `MutatorGroup` services
listed in `META-INF/services` — plus `ALL`, which `Mutator.fromStrings` special-cases. There is no
`OLD_DEFAULTS` among them, and an unrecognised name is not ignored:

```java
final List<MethodMutatorFactory> i = mutators.get(a);
if (i == null) {
  throw new PitHelpError(Help.UNKNOWN_MUTATOR, a);
}
```

So `<mutator>OLD_DEFAULTS</mutator>` should fail the build with pitest's unknown-mutator error
rather than quietly select the old set. To reproduce the pre-returns behaviour you list the
operators yourself, including `RETURN_VALS`.

## `STRONGER`, and what it adds

```java
mutators.put("STRONGER", gather(mutators,"DEFAULTS",
        "EXPERIMENTAL_SWITCH",
        "REMOVE_CONDITIONALS_ORDER_IF",
        "REMOVE_CONDITIONALS_EQUAL_IF"));
```

`STRONGER` is `DEFAULTS` plus the switch mutator and the two *if*-side remove-conditionals variants —
so `STRONGER` contains all four remove-conditionals operators, and still not `NEGATE_CONDITIONALS`.
It is a small, deliberate step up, and it is the only group worth reaching for. `ALL` is the one
pitest tells you not to use:

> *"Using the ALL option is strongly discouraged."*

## 🔴 The minus-prefix syntax nobody documents

`Mutator.fromStrings` supports exclusions:

```java
List<String> exclusions = names.stream()
        .filter(s -> s.startsWith("-"))
        .map(s -> s.substring(1))
        .collect(Collectors.toList());
...
unique.removeAll(excluded);
```

Any entry beginning with `-` is resolved like any other name — individual mutator or group — and
then subtracted from the set. That means the shape almost everyone actually wants is one line:

```xml
<mutators>
  <mutator>DEFAULTS</mutator>
  <mutator>-INVERT_NEGS</mutator>
</mutators>
```

rather than re-listing eleven operators minus one, which is what teams do instead and which then
silently drifts out of date on the next pitest upgrade. The FAQ documents the *additive* half of
this —

> *"Yes. You can specify both individual mutators and groups of them using the same syntax."*

— and says nothing about the subtractive half, which is in the source and is the more useful of the
two. Because the set is a `TreeSet` keyed on each factory's globally unique id, listing an operator
twice, or listing it inside two groups, is harmless.

## The honest advice

1. **Change nothing first.** Run the implicit default set, read the survivors on one package, and
   fix the assertions. Almost nobody exhausts the information in the default set before reaching for
   more operators.
2. **If you change anything, use the minus syntax** rather than re-listing, so upgrades keep working.
3. **`STRONGER` is the only group upgrade worth making**, and only after the defaults are clean.
4. **Add individual operators to a narrow `targetClasses` scope**, never globally — the operators
   that are off are off because they are noisy on general code, and a package of value objects is not
   general code.
5. **Never `ALL`.** Pitest says not to; [03d3](03d3-the-research-operators.md) shows what it contains.
6. **Record which operators produced any score you intend to compare**, because every item above
   changes the denominator.

## Where this connects

- **[03 · Mutators](03-mutators.md)** — the default set and the design criterion.
- **[03d2 · The optional operator inventory](03d2-the-optional-operator-inventory.md)** —
  `REMOVE_CONDITIONALS` and the rule for reading any optional operator's warning, continuing through
  [03d2b](03d2b-reading-a-remove-conditionals-pair.md) (reading the pair),
  [03d2c](03d2c-inline-constants.md) (`INLINE_CONSTS`), [03d2d](03d2d-remove-increments.md)
  (`REMOVE_INCREMENTS`) and [03d2e](03d2e-the-call-neutralising-operators.md)
  (`CONSTRUCTOR_CALLS`, `NON_VOID_METHOD_CALLS`), with
  [03d2f](03d2f-adopting-an-optional-operator.md) on how to put one into a build.
- **[03d3 · The research operators](03d3-the-research-operators.md)** — AOR, AOD, ABS, CRCR, OBBN,
  ROR and UOI, which is most of what `ALL` adds.
- **[03b2 · `VOID_METHOD_CALLS`](03b2-void-method-calls.md)** — the case for and against
  `NON_VOID_METHOD_CALLS` in one narrow scope.
- **[02b · What it cannot mutate](02b-what-it-cannot-mutate.md)** — the constant-folding gap that
  `INLINE_CONSTS` partly closes.
- **[04a · The HTML report](04a-the-html-report.md)** — the *Active mutators* list, which is how you
  find out what actually ran.

## Gotchas

**★ Writing `<mutator>DEFAULTS</mutator>` does not give you the default set.**
Configuring nothing runs `Mutator.newDefaults()` — eleven operators including `NEGATE_CONDITIONALS`.
Naming the group `DEFAULTS` runs the registration in `StandardMutatorGroups` — twelve operators, with
`NEGATE_CONDITIONALS` absent and two remove-conditionals variants present. Adding one extra operator
to "the defaults" therefore changes two things, not one, and moves your score for reasons that have
nothing to do with the operator you added.

**★ `OLD_DEFAULTS` is in the documentation table and not in the engine.**
1.30.0 registers `DEFAULTS`, `STRONGER`, `RETURNS`, `REMOVE_CONDITIONALS` and `REMOVE_SWITCH`, plus
the special-cased `ALL`. An unknown name throws `PitHelpError(Help.UNKNOWN_MUTATOR, …)` rather than
being ignored, so a configuration copied from the docs table fails loudly rather than silently
selecting the wrong set. To reproduce the old behaviour, list the operators including `RETURN_VALS`
yourself.

**★ The minus-prefix exclusion syntax is in the source and not in the docs.**
`-INVERT_NEGS` next to `DEFAULTS` subtracts one operator from the group. Without it, teams re-list
the whole default set minus one, which then silently fails to pick up any operator pitest adds in a
later release. Use the subtraction; it survives upgrades.

**★ Duplicate operator names are harmless, and so are overlapping groups.**
`Mutator.fromStrings` collects into a `TreeSet` ordered by each factory's globally unique id, so
listing `RETURNS` alongside `DEFAULTS`, or naming the same operator twice, deduplicates silently.
Pitest's own `REMOVE_CONDITIONALS` group lists `REMOVE_CONDITIONALS_EQUAL_IF` twice for this reason
without consequence. What is *not* harmless is listing `RETURN_VALS` alongside `DEFAULTS`, because
those are different operators covering the same returns and you get both.

**★ Exclusions are resolved before subtraction, so `-RETURNS` removes all five returns operators at once.**
The minus prefix takes a group name as happily as an individual one. That is convenient and it is
also a foot-gun: `-RETURNS` looks like it removes one thing and removes five. If you meant one, name
one.

**★ `ALL` means every registered operator id, including ones a plugin added.**
`Mutator.all()` is `fromStrings(MUTATORS.keySet())`, and `MUTATORS` is populated by every
`MethodMutatorFactory` and `MutatorGroup` found on pitest's classpath via `ServiceLoader`. Installing
a plugin therefore changes what `ALL` means without any change to your build file — one more reason
the documentation says not to use it.

**★ You cannot tell from the build file which operators ran.**
Between the group/implicit-default divergence, the filters that suppress whole categories, and any
plugin-supplied operators, the configuration is not the answer. The two authoritative places are the
verbose console log of active operators and the *Active mutators* list printed at the bottom of every
HTML source page. Read one of them before you quote a score.

## Interview questions

**★ Which operators does PIT enable by default, and what is the criterion?**
Eleven when you configure nothing: `CONDITIONALS_BOUNDARY`, `NEGATE_CONDITIONALS`, `MATH`,
`INCREMENTS`, `INVERT_NEGS`, `VOID_METHOD_CALLS` and the five returns operators. Pitest's stated
criterion is that a default operator should be *stable* — meaning hard enough to detect that a kill
is evidence — and should generate few equivalent mutants. Operators that fail the first are killed by
accident and inflate the score; operators that fail the second leave permanent survivors and make
people stop reading the report. Everything in `STRONGER` and `ALL` fails one of the two.

**★ Why is `ALL` "strongly discouraged" if more mutants means more information?**
Because the extra operators fail one of the two criteria. Some are unstable — the constructor-call
mutator's own documentation says it is *"fairly unstable and likely to cause NullPointerExceptions
even with weak test suites"*, so its mutants die from the JVM rather than from an assertion. Others
generate equivalent mutants that can never be killed and sit in the report forever. Both make the
score less meaningful. And there is a cost dimension: a survivor is the expensive case, because every
covering test runs to completion, so an operator that produces mostly survivors is also the one that
makes the run slowest.

**★ How would you add one operator to the default set without breaking future upgrades?**
List the group and the addition, not the expansion: `DEFAULTS` plus the operator name. And if you
need to *remove* one, use the undocumented minus prefix — `-INVERT_NEGS` — rather than re-listing the
group's members minus that one. The re-listing approach freezes your operator set at the moment you
wrote it, so any operator pitest adds to the defaults in a later release is silently not applied,
and your score stops being comparable with anyone else's for a reason nobody can see in the build
file. Be aware, though, that on 1.30.0 the string `DEFAULTS` and the implicit default set are not
the same set — so switching from "configure nothing" to "configure `DEFAULTS` plus one" changes
three operators, not one.

**★ How do you find out, after the fact, which mutation operators a report was produced with?**
Two places, both authoritative and neither of them the build file. Pitest prints the active operators
to the console when verbose logging is on, and every HTML source page ends with an *Active mutators*
list. You need one of them because the build file underdetermines the answer: the string `DEFAULTS`
and the implicit default set differ, filters remove whole categories of mutant before any of them
run, and any pitest plugin on the classpath can register additional operators and change what `ALL`
resolves to. A mutation score quoted without the operator set behind it is not a number anyone can
reproduce.

**★ Someone hands you a build with `<mutator>OLD_DEFAULTS</mutator>` and asks why the build fails. What happened?**
`OLD_DEFAULTS` appears as a column in pitest's mutator documentation table but is not a group the
1.30.0 engine registers. `Mutator.fromStrings` looks each name up in the map of registered groups and
individual operators and throws `PitHelpError(Help.UNKNOWN_MUTATOR, name)` when it misses — it does
not fall back to the defaults. The fix is to list the operators explicitly, which for the old
behaviour means the six non-returns defaults plus `RETURN_VALS` rather than the five returns
mutators. It is worth checking whether reproducing an old score is actually the goal, because scores
across two operator sets are not comparable in either direction.

{/* FOOTER */}
