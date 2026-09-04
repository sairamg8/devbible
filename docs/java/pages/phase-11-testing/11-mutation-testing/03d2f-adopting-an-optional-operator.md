---
title: "Adopting an optional operator is three decisions and not one: which operator, which classes it is pointed at, and which filter has to be switched on beside it — and because mutators is a property of the whole pitest execution, 'this operator for this package' is always a second execution producing a second score that must never be averaged with the first"
sidebar_label: "03d2f · Adopting one"
sidebar_position: 19
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the pitest
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `mutators`, `targetClasses`,
> `features`, `extraFeatures`, `reportsDirectory` and `skipPitest`, and the
> [Mutation operators](https://pitest.org/quickstart/mutators/) page's per-operator warnings, quoted
> verbatim. Feature name and description from the `Feature.named("funmodifiablecollection")`
> declaration in pitest 1.30.0's `build/intercept/defensive` package;
> `Mutator.fromStrings`'s exclusion handling from `engine/gregor/config/Mutator.java` at the `1.30.0`
> tag.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7, Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** Configuration and documented or source-read behaviour
> only — never console output or a score from a run.

**The five optional operators have now each been taken apart. This chunk closes the inventory with the
part that decides whether any of it helps: how you actually put one into a build. Enabling an operator
is three decisions, not one — the operator, the scope it is pointed at, and the filter that has to go on
beside it — and getting the second one wrong is why most teams switch an optional operator on and off
again inside a fortnight. It ends with the honest ranking across all five.**

## The three decisions

### 1 · The operator

Additively, never as a re-listing. From the FAQ:

> *"Yes. You can specify both individual mutators and groups of them using the same syntax."*

```xml
<mutators>
  <mutator>DEFAULTS</mutator>
  <mutator>NON_VOID_METHOD_CALLS</mutator>
</mutators>
```

Expanding `DEFAULTS` by hand and adding one entry freezes your operator set at the moment you wrote it,
so any operator pitest adds to the defaults in a later release is silently not applied, and your score
stops being comparable with anyone else's for a reason nobody can see in the build file. If you also
need to *remove* something, use the undocumented minus prefix rather than re-listing —
`-INVERT_NEGS` — which `Mutator.fromStrings` resolves and subtracts ([03d](03d-optional-mutators.md)).

### 2 · The scope

An operator that is off is off because it is noisy on **general** code. A package of pricing rules is not
general code. So the operator and the `targetClasses` glob are one decision, written together:

```xml
<targetClasses>
  <param>com.example.orders.application.*</param>
</targetClasses>
```

Be careful with the glob semantics, which the quick start states explicitly:

> *"Globs are pretty simple and will work as expected as long as you match packages (like
> com.your.package.root.want.to.mutate*). But if you match exact class names, inner classes won't be
> included."*

with the remedy of a trailing `*` or a second rule. A glob written as an exact class name silently
excludes that class's inner classes and lambdas, which is a good way to point an expensive operator at
half of what you meant.

### 3 · The filter that goes with it

Some operators create a category of unkillable mutant that pitest already ships a filter for, and ships
it **off** — because without that operator the category does not arise. `NON_VOID_METHOD_CALLS` and
`funmodifiablecollection` are the canonical pair:

```xml
<features>
  <feature>+funmodifiablecollection</feature>
</features>
```

The feature is described in pitest's source as *"Filter mutations to defensive wrappers such as
unmodifiableCollection on return or field write"*. Without it, every
`Collections.unmodifiableList(this.lines)` in your value objects yields a mutant that hands back the
mutable list, and essentially no suite asserts that a getter's result throws
`UnsupportedOperationException`. That is a permanent survivor per value object, and permanent survivors
are the expensive kind: each one runs all its covering tests to completion ([02](02-how-it-works.md)).

⚠️ If you are activating a feature from the command line rather than the POM, use `extraFeatures`, not
`features` — the documentation is explicit that it exists so that

> *"additional features to be activated from the command-line or build scripts without overwriting
> existing configuration."*

`-Dfeatures="+funmodifiablecollection"` replaces the whole list and silently discards every filter
decision your POM had made ([02b3](02b3-the-filter-inventory.md)).

## It is always a second execution

`mutators` is a property of the whole pitest execution. There is no per-package operator configuration
in open-source pitest, so "`NON_VOID_METHOD_CALLS` for the application services and the defaults
everywhere else" cannot be expressed in one run. It is two:

```xml
<plugin>
  <groupId>org.pitest</groupId>
  <artifactId>pitest-maven</artifactId>
  <version>1.30.0</version>
  <executions>
    <execution>
      <id>pit-defaults</id>
      <goals><goal>mutationCoverage</goal></goals>
      <configuration>
        <targetClasses><param>com.example.*</param></targetClasses>
        <reportsDirectory>${project.build.directory}/pit-reports</reportsDirectory>
      </configuration>
    </execution>
    <execution>
      <id>pit-application-services</id>
      <goals><goal>mutationCoverage</goal></goals>
      <configuration>
        <mutators>
          <mutator>DEFAULTS</mutator>
          <mutator>NON_VOID_METHOD_CALLS</mutator>
        </mutators>
        <targetClasses><param>com.example.orders.application.*</param></targetClasses>
        <features><feature>+funmodifiablecollection</feature></features>
        <reportsDirectory>${project.build.directory}/pit-reports-application</reportsDirectory>
      </configuration>
    </execution>
  </executions>
</plugin>
```

Two consequences that people trip over.

**Two runs mean two scores, and the two are not comparable.** Different operator sets mean different
denominators; different scopes mean different code. Neither number is "the project's mutation score",
and averaging them, or reporting the higher one as an improvement, is the arithmetic that makes people
stop trusting the metric.

**The second run costs a second full coverage pass.** Pitest computes per-test line coverage before it
generates anything ([02](02-how-it-works.md)), and that work is not shared between executions. A narrow
`targetClasses` makes the *mutation* phase cheap and does nothing for the coverage phase unless
`excludedTestClasses` narrows the tests as well. Budget for it before you put the second execution in
CI ([06 · The cost](06-the-cost.md)).

## The operator is the diagnosis, not the fix

This is the point most easily lost in an operator inventory. `NON_VOID_METHOD_CALLS` surviving on
`orderRepository.save(order)` tells you that **no assertion in your suite distinguishes "the save
happened" from "the save did not happen"** — a fact about your tests. It does not tell you the save
works, and no mutation operator can, because none of them models a wrong column mapping, a missing
flush, or a transaction that rolls back after the method returns.

The fix for that finding is a repository test against a real PostgreSQL that writes through the service
and reads the row back ([07 · Testcontainers](../07-testcontainers/README.md)). It constrains the
behaviour whether or not pitest generates a mutant for it, it moves no denominator, and it catches the
defect class the operator cannot see. If you only have budget for one of the two, do the test.

The same reading applies to every operator in this inventory. A survivor is a sentence about your
assertions. What you do about it is a test, a filter, or a written-down decision that the behaviour does
not matter — never a change to the production code, and never a change to the operator set made in order
to make the entry disappear.

## The honest ranking across all five

If you are going to enable exactly one optional operator, in this order:

1. **`REMOVE_CONDITIONALS`** ([03d2](03d2-the-optional-operator-inventory.md)), over a package of
   business rules. Pitest recommends it, the survivor diagnostic is precise —
   [03d2b](03d2b-reading-a-remove-conditionals-pair.md) — and its mutants are mostly killed by assertions
   you should have anyway.
2. **`NON_VOID_METHOD_CALLS`** ([03d2e](03d2e-the-call-neutralising-operators.md)), over an
   application-service package only, with `+funmodifiablecollection`. The only way to measure the side
   effect that matters most in a Spring service — and pair it with the repository test rather than
   treating it as a substitute.
3. **`INLINE_CONSTS`** ([03d2c](03d2c-inline-constants.md)), over a package of calculations with literals
   in them. Accept that it says nothing about your `static final` constants.
4. **`REMOVE_INCREMENTS`** ([03d2d](03d2d-remove-increments.md)), if you have counters that are not loop
   counters.
5. **`CONSTRUCTOR_CALLS`**, essentially never. Its own documentation says its mutants die to weak
   suites.

And before any of them: **run the implicit default set and fix every survivor first.** Almost nobody
exhausts the information in eleven operators before reaching for a twelfth.

## Where this connects

- **[03d · Optional mutators](03d-optional-mutators.md)** — the group machinery, the minus-prefix syntax,
  and why the build file underdetermines which operators ran.
- **[03d2 · Optional operators](03d2-the-optional-operator-inventory.md)** through
  **[03d2e · Neutralising calls](03d2e-the-call-neutralising-operators.md)** — the five operators this chunk is about.
- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — `funmodifiablecollection`, `extraFeatures`, and the whole feature-string mechanism.
- **[05 · Wiring it up](05-wiring-it-up.md)** — the Maven plugin, executions, and where a second execution belongs in a build.
- **[05c · Scoping and incremental analysis](05c-scoping-and-incremental.md)** — narrowing the coverage phase, which is what makes a second execution affordable.
- **[06 · The cost](06-the-cost.md)** — the runtime arithmetic behind "budget for it before CI".
- **[07 · Testcontainers](../07-testcontainers/README.md)** — the repository test that is the fix for the finding this operator produces.

## Gotchas

**★ Enabling an optional operator is a whole-execution change, not a per-package one.**
`mutators` applies to the entire pitest run. "Add `NON_VOID_METHOD_CALLS` for the application services"
means a second execution with its own `targetClasses`, `features` and `reportsDirectory`, or it means
enabling it everywhere. Teams that do not realise this enable it globally, watch the runtime and the
survivor count climb across code they never intended to measure, and turn it off again a week later.

**★ A second pitest execution means a second score, and the two must not be added.**
Different operator sets mean different denominators, and different `targetClasses` means different code.
Reporting "our mutation score went up" because the narrow run scored higher on five classes is the
arithmetic that makes people stop trusting the number. Name each run and quote each score with its
operator set.

**★ A narrow `targetClasses` does not make the run cheap on its own.**
Pitest runs a full per-test coverage pass before generating any mutants, and that pass is scoped by the
tests, not by `targetClasses`. A second execution over five classes still pays for the whole coverage
run unless `excludedTestClasses` cuts the slow tests too. The mutation phase gets cheap; the prologue
does not.

**★ A `targetClasses` glob written as an exact class name excludes that class's inner classes.**
The quick start says so directly: *"if you match exact class names, inner classes won't be included"*,
with the remedy of a trailing `*` or a second rule. Lambdas and anonymous classes compile to synthetic
members, so pointing an expensive operator at `com.example.PricingService` rather than
`com.example.PricingService*` can silently skip most of what the class does.

**★ `-Dfeatures=` on the command line discards every feature your POM set.**
`features` is a list and setting it replaces the list. That is exactly why `extraFeatures` exists —
the documentation says it allows features *"to be activated from the command-line or build scripts
without overwriting existing configuration"*. A one-off investigation that turns on
`+funmodifiablecollection` with `-Dfeatures=` also turns off `FRECORD`, `lombok`, `FLOGCALL` and the
timeout filters, and nothing warns you.

**★ Enabling an operator without its paired filter creates the permanent survivors the filter exists for.**
`NON_VOID_METHOD_CALLS` and `funmodifiablecollection` ship in opposite states — the operator off, the
filter off — because the filter is only needed when the operator is on. Turning one on without the other
is the single most common way to make an optional-operator experiment look like a failure.

**★ The survivor is a statement about the tests, and the response is never a change to the production code.**
A mutation report is not a code-quality report. The three legitimate responses to a survivor are: write
or strengthen an assertion, decide the behaviour does not matter and record that decision in the build
file as a filter or an exclusion, or accept it as equivalent ([04b](04b-equivalent-mutants.md)). Editing
the production class to make a mutant go away is the one response that is always wrong.

**★ Reaching for an optional operator before the defaults are clean buys precision you cannot use.**
The default set's survivors are the cheapest information pitest produces, and almost no team exhausts
them. An optional operator adds mutants to a report that already has unread findings in it, makes the
run slower, and moves the denominator so the before-and-after comparison stops working. Fix the eleven
operators' findings first.

## Interview questions

**★ How would you enable an optional operator for one package only?**
By running pitest twice. `mutators` is a property of the whole execution and there is no per-package
operator configuration in the open-source tool, so a second execution — its own `mutators`, its own
`targetClasses` glob, its own `features`, its own `reportsDirectory` — is the only way to say "this
operator here and the defaults everywhere else". Doing it in one run applies the extra operator to the
whole codebase, and the usual outcome is that somebody turns it off again and the information is lost.
It also keeps the two mutation scores separate, which they have to be: different operator sets mean
different denominators, and neither number is the project's score.

**★ Would you rather enable `NON_VOID_METHOD_CALLS` or write a Testcontainers repository test?**
The test, and then the operator if there is budget. They answer different questions. The operator tells
you that no assertion in the suite distinguishes "the save happened" from "the save did not happen" — a
fact about your tests. The repository test tells you the row is actually written with the right values
through a real PostgreSQL, which is a fact about your code and catches a class of defect no mutation
operator models: a wrong column mapping, a missing flush, a transaction that rolls back. The operator is
diagnostic, the test is the fix, and if you only do one thing you should do the fix.

**★ How would you use these operators without corrupting the number you report?**
By not reporting a number from them. The pattern that works is a separate pitest execution with a narrow
`targetClasses` glob, its own `reportsDirectory`, and the extra operator enabled — read by a person,
once, for its list of survivors. The main run keeps the default operator set so that its score stays
comparable over time. Mixing the two gives you one number whose denominator changed for configuration
reasons, and the first time somebody asks why the score moved and the answer is "we added an operator",
the metric has stopped being useful.

**★ Why does pitest ship `funmodifiablecollection` switched off?**
Because the mutants it filters are mostly produced by an operator that is also switched off. A defensive
`Collections.unmodifiableList(...)` wrapper is neutralised by `NON_VOID_METHOD_CALLS`, which is not in
the default set, so on a default run the filter would have very little to do. The pairing is the general
shape worth remembering: several of pitest's off-by-default filters exist to make a specific
off-by-default operator usable, and switching the operator on without the filter produces exactly the
category of permanent survivor that made someone write the filter. `funmodifiablecollection` is the one
that matters on a domain codebase, because value objects that return defensive copies are good practice
and essentially nobody writes a test asserting that a returned collection rejects modification.

**★ A team wants to gate their build on a mutation score from a run with `STRONGER` plus two extra operators. What is your advice?**
That the gate and the operator set are in tension. A gate needs a number that is stable over time, which
means the operator set must not change; but the reason to add operators is to find things, which is a
reading activity, not a gating one. My advice is two runs with two purposes: a gated run on the default
set, with a `maxSurviving` limit rather than a percentage so that the threshold counts things instead of
dividing them, and a separate, unbounded, narrowly-scoped run with the extra operators that a person
reads and nobody gates on. Adding operators to the gated run means the number moves for configuration
reasons and every future comparison has to be qualified, which is how a metric stops being used.

{/* FOOTER */}
