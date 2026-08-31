---
title: "Line coverage needs debug information and does not add up: two documented properties that explain a missing line report on an optimised build and an aggregate that refuses to reconcile with the per-class numbers you summed by hand"
sidebar_label: "03c · Lines, debug info, addition"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/counters.html`, with the line-counter
> definition and its two caveats quoted directly. `javac` flag behaviour from the **JDK 25**
> tool documentation. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25,
> Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — documented behaviour and configuration
> only, never build output.

**Line coverage is the number everyone quotes, and it has two documented properties that almost
nobody knows. It depends on debug information that a build can legitimately strip, in which case
the line report silently disappears while every other counter carries on. And line totals do not
add up — JaCoCo says so explicitly — so an afternoon spent reconciling a package total against
the classes inside it is an afternoon spent proving the documentation right.**

## Property 1 · Lines require debug information

JaCoCo's definition:

> *"A source line is considered executed when at least one instruction that is assigned to this
> line has been executed."*

The load-bearing phrase is **"assigned to this line"**. That assignment is not something JaCoCo
derives; it is the `LineNumberTable` attribute the compiler writes into the class file. Without
it there is no mapping from instruction to line, and therefore no line coverage at all.

Contrast with instructions, which are counted from the bytecode itself and are — per the same
documentation — available without debug information. This is the practical difference between
the two counters, and it is the reason instruction coverage is the more robust default even
though it is the less useful measure.

### When debug info goes missing

`javac` emits line numbers by default, so this is not something you hit by accident on a plain
build. It is something a *deliberate* build setting causes:

| Setting | Effect on line coverage |
|---|---|
| `-g` (all) | Lines, source file, local variable names — everything. Fine. |
| `-g:lines,source` | Lines present. Fine, and a common "small but debuggable" choice. |
| `-g:none` | 🔴 **No `LineNumberTable` — line coverage is gone.** |
| `-g:vars` only | No lines. Same outcome. |
| Maven compiler plugin `<debug>false</debug>` | Equivalent to `-g:none`. |
| Gradle `options.debug = false` | Same. |

The symptom is specific and easy to misread: **instruction, branch, method and class coverage
all report normally, and the line column is empty or zero.** It looks like a JaCoCo bug, or like
a partial report, and the actual cause is a compiler flag set months earlier by someone
optimising artifact size.

The same thing happens to stack traces — they lose line numbers — so if your production
exceptions have no line numbers, that is the same cause and a much better reason to fix it.

⚠️ A related but distinct trap: **obfuscators and some shrinkers strip or rewrite line tables**.
If they run before the report, you get the same missing-line symptom, plus the class id mismatch
covered in [chunk 06c](06c-the-zero-percent-class.md), because the class bytes changed.

## Property 2 · Line counts are not additive

Quoted:

> Line counts are not additive across methods and classes, because *"a single line of a source
> code may refer to multiple methods or multiple classes."*

This is not an edge case in modern Java — it is the normal state of affairs. Three constructs put
code from more than one class on a single source line:

```java
// One line. Two classes: the enclosing class, and the lambda's synthetic method.
orders.forEach(order -> auditLog.record(order.id()));

// One line. Two classes: the enclosing class, and an anonymous inner class.
executor.submit(new Runnable() { public void run() { process(); } });

// One line. Two methods at least: the enclosing method and the method reference target.
names.stream().map(String::trim).forEach(this::handle);
```

For the first, the lambda body compiles to a synthetic method — arguably in the same class, but
counted separately in the method breakdown, and the line appears in both accountings. For the
second, the anonymous class is a genuinely separate class file, and that source line legitimately
belongs to two classes' reports.

So when you open a package report showing 1,200 lines and sum the classes to 1,247, nothing is
broken. The aggregate de-duplicates; your addition did not.

### What this means in practice

- **Never reconcile line totals by hand.** It will not work and the failure is designed in.
- **Be sceptical of a tool that sums line coverage across modules.** A CI plugin computing a
  weighted average of per-module line percentages is producing an approximation, not the number
  `report-aggregate` would produce. [Chunk 07](07-multi-module.md) covers the right way.
- **Instruction and branch counts do add up**, because an instruction belongs to exactly one
  method. If you must do arithmetic across scopes, do it on those.

## The weakness the definition admits

Setting aside both caveats, the definition itself is the reason line coverage overstates:
**at least one instruction**. Any line containing more than one thing to execute is green as
soon as any part of it runs.

```java
int result = compute(a) + compute(b);            // green if compute(a) throws
String s = x != null ? x.trim() : "";            // green after one of two outcomes
if (isEnabled() && hasQuota() && !isBlocked()) { // green after one happy-path test
```

Every one of those is fully line-covered by a test that exercises a fraction of it. This is the
same argument [chunk 03b](03b-branch-coverage-is-the-useful-one.md) makes for branch coverage,
seen from the line counter's side: line coverage is not lying, it is answering a question about
lines, and lines are a unit of *text* rather than a unit of *behaviour*.

There is a corollary worth knowing: **a code formatter can change your line coverage percentage.**
Splitting a long compound condition across four lines turns one covered line into four lines of
which some are covered, and the percentage moves. No behaviour changed, no test changed. Instruction
coverage, being formatting-independent by definition, does not move — another reason it is the
robust default even though branch coverage is the better gate.

## So should you report lines at all?

Yes, for two reasons, neither of which is that the number is good:

1. **The line view is how humans read the report.** The HTML report highlights source lines in
   red, yellow and green, and that view is the actual product — the number at the top is a
   by-product. A person hunting an untested path reads the colours.
2. **The gap between line and branch coverage is diagnostic.** A large gap means dense conditional
   logic covered shallowly, which is a real finding about where to spend effort.

Report lines; gate on branches; and know that the reported line number is contingent on a compiler
flag and on how the code is formatted.

## Where this connects

- **[03 · The six counters](03-the-six-counters.md)** — the definitions, all six.
- **[03b · Branch coverage](03b-branch-coverage-is-the-useful-one.md)** — the counter to gate on,
  and why the "at least one instruction" rule is what makes lines the weaker one.
- **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** — the other family of
  problems caused by class files differing between run and report.
- **[Phase 8 · javac flags](../../phase-8-build-dependencies/11-javac-flags/)** owns `-g` and
  the rest of the compiler's options; this chunk only names the consequence for coverage.

## Gotchas

**★ A build with `-g:none` reports every counter except lines, and it looks like a broken report.**
Instruction, branch, method and class coverage are all fine; the line column is empty. Nothing in
the output says "debug information is missing", so the natural conclusion is that JaCoCo is
malfunctioning. Check the compiler configuration before anything else, and check whether your
production stack traces have line numbers — same cause.

**★ `<debug>false</debug>` in a Maven parent POM disables line coverage for every child module.**
It is usually set to shrink artifacts or to satisfy a policy about shipping debug data, and the
coverage consequence is invisible to whoever set it. This is a good candidate for a comment in the
POM explaining the trade-off, because the next person will otherwise "fix" one side or the other.

**★ Summing per-class line counts to check a package total does not work, by design.**
JaCoCo documents the reason: a source line may refer to multiple methods or classes. Lambdas,
anonymous classes and method references all put two accountings on one line. The aggregate
de-duplicates. Your addition is the thing that is wrong.

**★ Instruction and branch counts DO add up — use those if you must do arithmetic.**
An instruction belongs to exactly one method, so instruction totals are additive across classes,
packages and modules. Any script or dashboard that needs to combine scopes should work in
instructions or branches and never in lines.

**★ A CI plugin averaging per-module line percentages is not computing your coverage.**
Beyond the non-additivity, a plain average ignores module size and a weighted average still
inherits the de-duplication problem. If the aggregate number matters, produce it with
`report-aggregate` from the merged execution data rather than by arithmetic on percentages.

**★ Running a code formatter can move your line coverage and fail a threshold.**
Splitting a long condition across several lines changes the denominator and the distribution of
covered lines. A formatting-only pull request can therefore break a line-coverage gate, which is
both baffling to the author and a genuine argument for gating on instructions or branches instead.

**★ One-line control flow inflates line coverage more than anything else.**
`if (x) return;` on a single line is line-covered the moment the `if` is evaluated, whether or not
the return was taken. A codebase with a house style of single-line guards has a systematically
optimistic line-coverage number, and the branch number is the honest one.

**★ An obfuscator or shrinker between compile and report breaks lines and class ids at once.**
Rewriting bytecode changes both the line table and the class bytes, so you get a missing line
report *and* classes at 0% from a class id mismatch. Two symptoms, one cause, and they are easy to
diagnose as two separate problems.

**★ Kotlin, Groovy and generated sources have their own line-mapping behaviour.**
The line table for a non-`javac` compiler maps to that language's source, and generated sources
map to the generated file, not to the annotation or template that produced it. A report showing
uncovered lines in a file nobody wrote is normal, and is an argument for excluding generated
sources at the report ([chunk 05](05-exclusions.md)).

## Interview questions

**★ Why might a JaCoCo report show branch and instruction coverage but no line coverage?**
Because the class files lack debug information. Line coverage depends on the compiler's
`LineNumberTable` to map instructions to source lines — JaCoCo's definition is that a line is
executed when at least one instruction *assigned to that line* has run, and without debug info
nothing is assigned. Instruction coverage is computed from the bytecode directly and is
documented as available without debug information, which is why it survives. Look for `-g:none`,
`<debug>false</debug>`, or a post-compile step that strips the tables.

**★ Why don't JaCoCo's per-class line counts sum to the package total?**
Because line coverage is not additive. JaCoCo documents that a single source line may refer to
multiple methods or multiple classes — a lambda, an anonymous inner class or a method reference
declared inline puts code belonging to more than one class on one line. The aggregate counts that
line once; adding the per-class figures counts it more than once. Instruction and branch counts
are additive and can be summed safely.

**★ Can reformatting code change your coverage percentage?**
Line coverage, yes. Splitting a compound condition across several lines changes both the number of
lines and how the covered ones are distributed, so a formatting-only change can move the percentage
and even fail a line-coverage gate. Instruction coverage cannot move this way — it is defined on
bytecode and JaCoCo documents it as independent of source formatting — which is one of the better
arguments against gating on lines.

**★ Your production stack traces have no line numbers and your coverage report has no line column. Related?**
Almost certainly the same cause: the class files were compiled without line-number debug
information, so neither the JVM's stack trace machinery nor JaCoCo has a mapping from instruction
to source line. Fixing the compiler setting fixes both, and the stack-trace argument is usually the
one that persuades people, since losing line numbers in production incidents costs far more than
losing a coverage column.

**★ Should you gate on line coverage at all?**
Report it, do not gate on it. It is the view humans actually read — the red/green source
highlighting is the useful part of the HTML report — and the gap between line and branch coverage
is a genuine diagnostic for shallowly-tested conditional code. But as a gate it is contingent on a
compiler flag, movable by a code formatter, and satisfied by one instruction on a line that may
contain several decisions. Gate on branches and keep lines on the dashboard.

{/* FOOTER */}
