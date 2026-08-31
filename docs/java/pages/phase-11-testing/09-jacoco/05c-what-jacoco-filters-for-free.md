---
title: "What JaCoCo filters for free: twenty-odd constructs the compiler emits that would otherwise sit uncoverable in your denominator, the version each filter arrived in, and why that version history is a hidden cause of coverage numbers moving on their own"
sidebar_label: "05c · Filtered for free"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/changes.html`, which is where the filter
> list and its per-version history live — ⚠️ **there is no `doc/filtering.html`**; both
> `jacoco.org` and `eclemma.org` return 404 for that path. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — documented behaviour only.

**A great many hand-written coverage exclusions exist to hide code JaCoCo already hides. The
filters were added over a decade of releases, mostly in response to exactly the complaint that
some compiler-generated construct was uncoverable, and each one shipped in a specific version —
which means the correct exclusion list for your project depends on which JaCoCo you are running.
Checking this list before adding a pattern is the cheapest thing in this topic.**

## Why filters exist at all

JaCoCo measures bytecode ([chunk 01b](01b-how-jacoco-works.md)), and the compiler emits a
substantial amount of bytecode you did not write and cannot reach. A `finally` block is duplicated
into every exit path; a `switch` on a `String` becomes a hash comparison plus a second switch; a
synchronized block gains an exception handler that unlocks on the way out. None of that is
testable in any meaningful sense, and all of it would otherwise be permanently missed instructions
and branches in your report.

A filter tells the analyser to skip those constructs entirely — they leave both the numerator and
the denominator, so they cannot drag your number down and cannot inflate it either.

## The list, with the version each arrived in

**Java language constructs**

| Filtered | Since |
|---|---|
| `synchronized` blocks (the compiler's implicit exception handler) | 0.8.0 |
| try-with-resources (the generated close/suppress machinery) | 0.8.0 |
| `finally` blocks (the duplication into each exit path) | 0.8.0 |
| `switch` on `String` (the hash-then-switch expansion) | 0.8.0 |
| `assert` statements (the `$assertionsDisabled` check) | 0.8.8 |
| Exhaustive `switch` expressions and record patterns | 0.8.11 |

**Compiler-generated members**

| Filtered | Since |
|---|---|
| Enum `values()` and `valueOf(String)` | 0.8.0 |
| Private empty constructors (the utility-class idiom) | 0.8.0 |
| Empty enum constructors | 0.8.1 |
| Record accessors and generated `toString`, `hashCode`, `equals` | 0.8.6 |
| Bridge methods | 0.8.6 |

**Annotation-driven**

| Filtered | Since |
|---|---|
| `@lombok.Generated` | 0.8.0 |
| `@groovy.transform.Generated` | 0.8.0 |
| Any annotation with simple name `Generated`, retention `RUNTIME` or `CLASS` | 0.8.3 |

**Kotlin** (listed because a mixed-language module is common, not because this topic teaches
Kotlin)

| Filtered | Since |
|---|---|
| Default-argument handling bytecode | 0.8.12 |
| Safe-call operator chains | 0.8.14 |
| `suspend` function and lambda support code | 0.8.14 |
| Compose plugin pausable-composition bytecode | 0.8.14 |
| Serialization plugin generated methods | 0.8.14 |

## What this means for your exclusion list

Four exclusions that show up constantly and are, on a current JaCoCo, **dead configuration**:

- Excluding utility classes to hide their private constructor — filtered since 0.8.0. The
  reflection test in [chunk 04b](04b-the-eighty-percent-ritual.md) is closing the same
  non-existent gap.
- Excluding enums for `values`/`valueOf` — filtered since 0.8.0.
- Excluding record types wholesale — accessors, `toString`, `hashCode` and `equals` have been
  filtered since 0.8.6, so what remains in a record's report is the code you actually wrote:
  compact constructor validation, and any explicit method. That code is worth covering, and
  excluding the type hides it.
- Excluding classes for their `finally` or try-with-resources blocks — filtered since 0.8.0.

⚠️ **Records deserve a specific note**, because they are the most common wrong exclusion on a
modern codebase. A record with a compact constructor that validates its arguments has real,
branchy, worth-testing logic, and excluding the type to get rid of the generated accessors takes
the validation with it. The filters already do the right thing here; leave records in.

## 🔴 The version history is a real cause of moving numbers

Because filters arrive in releases, **upgrading JaCoCo changes your coverage without any code
changing**. The direction is usually up — uncoverable constructs leave the denominator — but it is
not always small:

- Adopting `assert` in a codebase and upgrading across 0.8.8 are indistinguishable in the number.
- A Kotlin-heavy module upgrading across 0.8.14 can move noticeably, because four separate Kotlin
  filters landed there.
- A codebase that adopted records before 0.8.6 would have seen a jump on upgrading past it.

Two consequences worth acting on:

1. **Pin the JaCoCo version.** An unpinned plugin version means the filter set can change between
   builds, so a threshold can fail on a day nobody committed anything.
   [Chunk 02](02-wiring-it-up-maven.md).
2. **Expect a step change when you upgrade, and do not attribute it to the team.** A coverage
   jump in the same pull request that bumps JaCoCo is the filters, not new tests — and equally, it
   is not [chunk 04b](04b-the-eighty-percent-ritual.md)'s pattern 5. Say so in the commit message
   so nobody has to guess later.

## What is *not* filtered

Worth stating, since the list above can leave the impression that everything generated is handled:

- **`jakarta.annotation.Generated`** — source-retained, so invisible. See
  [chunk 05b](05b-the-generated-annotation-rule.md); this is the big one.
- **Lombok without the config flag** — the `@lombok.Generated` filter exists, but Lombok does not
  apply the annotation unless you enable it. Also [05b](05b-the-generated-annotation-rule.md).
- **Generated sources from most other generators** — MapStruct implementations, OpenAPI stubs,
  protobuf classes. Unless they carry a class-retained `Generated`, they count.
- **Implicit default constructors that are not empty-and-private** — a public no-arg constructor
  on a normal class is a real, callable method and is counted.
- **Static initialisers** — `<clinit>` is a method for counting purposes, and a static block with
  logic in it is genuinely worth covering.
- **Lambdas and their synthetic methods** — a lambda body is your code, and it is counted, which
  is correct.

## Where this connects

- **[05 · Exclusions](05-exclusions.md)** — the three places to exclude, and what deserves it.
- **[05b · The `@Generated` rule](05b-the-generated-annotation-rule.md)** — the annotation filter
  in detail, and the two traps in it.
- **[03 · The six counters](03-the-six-counters.md)** — what "leaves the denominator" means for
  each counter.
- **[02 · Wiring it up (Maven)](02-wiring-it-up-maven.md)** — pinning the version, which this
  chunk gives the real reason for.

## Gotchas

**★ Upgrading JaCoCo can raise your coverage with no code change, and it looks like gaming.**
Filters arrive in releases. A jump in the same pull request that bumps the version is the filter
set, not new tests. Without a note in the commit message this is indistinguishable in the history
from someone adding a large exclusion, and it will be misread later.

**★ An unpinned plugin version makes the filter set — and therefore your denominator — non-deterministic.**
A threshold can fail on a day nobody committed anything, because the resolved JaCoCo changed and a
construct that was filtered yesterday is not today, or the reverse. This is the concrete reason to
pin, beyond general reproducibility hygiene.

**★ Excluding record types is the most common wrong exclusion on a modern codebase.**
Accessors, `toString`, `hashCode` and `equals` have been filtered since 0.8.6. What is left in a
record's report is the compact constructor's validation and any explicit method — real, branchy
logic that is exactly what you want covered. Excluding the type hides it.

**★ A hand-written exclusion for an already-filtered construct is silent dead configuration.**
It does no harm and it never expires, so it accumulates and makes the list unreadable. When a
reviewer eventually asks what each entry is for, nobody can say, and the whole list becomes
untouchable.

**★ `finally` filtering is why "my finally block shows as partially covered" is usually an old-version symptom.**
The duplication of a `finally` body into every exit path has been filtered since 0.8.0. If you are
seeing odd partial coverage on one, check the version before restructuring the code.

**★ The filter removes constructs from BOTH numerator and denominator.**
It does not mark them covered — it removes them from the accounting entirely. So filtering cannot
inflate a percentage the way marking-as-covered would, which is why the mechanism is trustworthy
in a way that a blanket exclusion is not.

**★ Static initialisers and lambdas are counted, and correctly so.**
`<clinit>` counts as a method, and a lambda body is your code in a synthetic method. Neither is
"generated" in the sense the filters mean. A static block that builds a lookup table has logic that
can be wrong, and it will show in the report — which is right.

**★ Kotlin filters landed late and in a cluster, so a mixed-module upgrade across 0.8.14 can move a lot.**
Four separate Kotlin filters arrived in that one release. A Kotlin-heavy module's coverage change
on that upgrade is likely to be the largest single filter-driven move anyone on the team has seen,
and it needs explaining before someone reads it as a metric win.

**★ The list is in the release notes, not on a filtering page.**
Both `jacoco.org/jacoco/trunk/doc/filtering.html` and the eclemma equivalent return 404. The
authoritative, versioned list is in `doc/changes.html`. Anyone citing a filtering page is citing
something not at that path.

## Interview questions

**★ Name some things JaCoCo excludes from coverage automatically.**
Compiler-generated constructs it would be meaningless to test: the implicit exception handler
around a `synchronized` block, try-with-resources close machinery, the duplication of `finally`
bodies into each exit path, the hash-then-switch expansion of a `switch` on `String`, and
`assert`'s disabled check. Also generated members: enum `values`/`valueOf`, private empty
constructors, bridge methods, and a record's accessors and generated `toString`/`hashCode`/`equals`.
Plus anything annotated with a class- or runtime-retained annotation named `Generated`.

**★ Your coverage went up 3% after a dependency bump and nobody wrote a test. Explain.**
Almost certainly a JaCoCo upgrade adding filters. Each release has tended to add some, and the
filtered constructs leave both the numerator and the denominator, so previously-uncoverable
compiler-generated code stops counting against you. Check the release notes between the two
versions — record filtering arrived in 0.8.6, `assert` in 0.8.8, exhaustive switch and record
patterns in 0.8.11, and a cluster of Kotlin filters in 0.8.14. It is also an argument for pinning
the version.

**★ Should you exclude records from coverage?**
No. Their generated members — accessors, `toString`, `hashCode`, `equals` — have been filtered
since 0.8.6, so they are already out of the accounting. What remains is code you wrote: compact
constructor validation, and any explicit methods. That is branchy, worth-testing logic, and
excluding the type to remove generated members that are already gone hides it. This is one of the
most common wrong exclusions on a modern Java codebase.

**★ Does a filter mark code as covered?**
No — it removes the construct from the accounting entirely, from both the covered and the missed
counts. That distinction matters: marking as covered would let filtering inflate a percentage,
whereas removal only stops uncoverable code from deflating it. It is also why a filter cannot be
used to game a number in the way a blanket path exclusion can.

**★ How would you decide whether a new coverage exclusion is actually needed?**
Check the built-in filter list for the running version first, since a large share of proposed
exclusions — utility-class private constructors, enum `values`/`valueOf`, records, `finally` blocks
— are already handled and the exclusion would be dead configuration. Then check whether annotation
filtering applies, which removes members rather than whole types and is the better mechanism. Only
if neither applies is a path-based exclusion the right answer, and then it should carry a comment
saying which of those two were ruled out.

{/* FOOTER */}
