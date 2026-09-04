---
title: "You can extract the whole transaction map from a Spring codebase mechanically, and then keep it from regressing with an ArchUnit rule — a boundary you discovered once and never enforced will be gone within two quarters"
sidebar_label: "09b · Finding it in the code"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the ArchUnit user guide
> ([archunit.org](https://www.archunit.org/userguide/html/000_Index.html)); the Spring
> Framework 7.0.x reference on declarative transaction management and the Spring Data
> `Repository` marker interface, cited by concept; Vaughn Vernon, *Effective Aggregate
> Design, Part I* (2011) ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/),
> CC BY-ND 3.0). Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring
> Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**[09 · The transaction boundary](09-the-transaction-boundary.md) says the transaction map is
the most useful artefact in a decomposition exercise. This chunk is how to produce it from a
codebase you did not write, in an afternoon, and how to turn each decision it produces into
a test that fails the build when someone quietly undoes it. The second half matters more
than the first: teams routinely do the analysis, agree the boundaries, and then lose them,
because nothing in the build objected.**

## Step 1 — the crude pass

Start with grep, because it costs nothing and tells you the order of magnitude.

```bash
# Every transactional method in the codebase.
grep -rn '@Transactional' src/main/java | wc -l

# Every repository interface — one per aggregate root, if the codebase is disciplined.
grep -rln 'extends \(Crud\|JpaRepository\|ListCrud\|Repository\)' src/main/java

# Classes that inject more than one repository: candidates for multi-aggregate writes.
grep -rlZ 'Repository ' src/main/java \
  | xargs -0 grep -c 'Repository [a-z]' \
  | awk -F: '$2 > 1'
```

The third command over-reports: a class may inject three repositories and read from two of
them. Reads across aggregates are ordinary and Vernon says so explicitly —
*"referencing multiple aggregates in one request does not give license to cause modification
on two or more of them"*. It is the **writes** that constrain a boundary. So the crude pass
produces a candidate list, not a finding.

## Step 2 — the accurate pass, as a test

ArchUnit can answer the question properly, because it sees the call graph rather than the
text. The rule below is the one worth having in every service:

```java
package com.retailer.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionMapTest {

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.retailer");

    /// Not a pass/fail rule on its own — this produces the map. Print it, read it,
    /// then turn each accepted case into an explicit allow-list entry below.
    @Test
    void everyTransactionalMethodWritesOneAggregateRoot() {

        var offenders = CLASSES.stream()
                .flatMap(clazz -> clazz.getMethods().stream())
                .filter(method -> method.isAnnotatedWith(Transactional.class))
                .map(method -> {
                    Set<String> repositories = method.getMethodCallsFromSelf().stream()
                            .map(call -> call.getTargetOwner())
                            .filter(owner -> owner.isAssignableTo(Repository.class))
                            .map(owner -> owner.getSimpleName())
                            .collect(Collectors.toSet());
                    return new TransactionalMethod(method.getFullName(), repositories);
                })
                .filter(entry -> entry.repositories().size() > 1)
                .toList();

        assertThat(offenders)
                .describedAs("transactional methods touching more than one repository")
                .isEmpty();
    }

    private record TransactionalMethod(String method, Set<String> repositories) { }
}
```

Two honest limitations, because a rule you trust wrongly is worse than none:

**It sees direct calls only.** A `@Transactional` method that calls a helper which calls a
second repository will not be caught by `getMethodCallsFromSelf()`. ArchUnit offers
transitive call analysis (`getCallsFromSelf` walked recursively, or a
`MethodCallTarget`-based traversal), and you should use it once the direct version is green
— otherwise the first refactor that extracts a private method silently defeats the rule.

**It does not distinguish reads from writes.** A repository call may be a `findById`. To be
precise you must filter by target method name or, better, adopt a convention that read-only
paths are annotated `@Transactional(readOnly = true)` and exclude those. That convention is
worth adopting anyway.

## Step 3 — turn each accepted case into an allow-list

Some multi-aggregate writes are legitimate — Vernon's four reasons, in
[11 · Reasons to break the rule](11-reasons-to-break-the-rule.md). Legitimate does not mean
invisible:

```java
/// Every entry here is a decision someone made, with a reason, that a reviewer can
/// challenge. An empty allow-list is suspicious in a real system; an allow-list that
/// grows without review is how a boundary dissolves.
private static final Set<String> ACCEPTED_MULTI_AGGREGATE_WRITES = Set.of(
        // Batch creation of independent aggregates: semantically identical to creating
        // them one at a time. Vernon, Reason One (user interface convenience).
        "com.retailer.sales.internal.BasketImportService.importLines(...)",

        // Legacy: promotion redemption still writes the customer's counter. Tracked
        // as ARCH-214; the counter is a false invariant and is being removed.
        "com.retailer.promotions.internal.RedemptionService.redeem(...)"
);
```

The comment naming a ticket is the part that matters. An allow-list without reasons becomes
a list of everything, within a year.

## Step 4 — enforce the module boundary too, not just the transaction

The transaction rule stops state from being written together. A second rule stops one
module's internals from being reachable at all, which is what keeps the *next* violation
from being written:

```java
package com.retailer.architecture;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

@AnalyzeClasses(packages = "com.retailer")
class ModuleBoundaryTest {

    /// Nothing outside a module may reach into its internals. This is the same rule
    /// Spring Modulith's verify() enforces; ArchUnit is the version for codebases that
    /// do not use Modulith, or that need it expressed by hand.
    @ArchTest
    static final ArchRule internals_are_internal = layeredArchitecture()
            .consideringOnlyDependenciesInLayers()
            .layer("SalesApi").definedBy("com.retailer.sales")
            .layer("SalesInternal").definedBy("com.retailer.sales.internal..")
            .layer("InventoryApi").definedBy("com.retailer.inventory")
            .layer("InventoryInternal").definedBy("com.retailer.inventory.internal..")
            .whereLayer("SalesInternal").mayOnlyBeAccessedByLayers("SalesApi")
            .whereLayer("InventoryInternal").mayOnlyBeAccessedByLayers("InventoryApi");
}
```

If you are on Spring Modulith 2.1.1 the equivalent is one line — see
[25 · Verifying the boundary](25-verifying-the-boundary.md). Use that instead where you can;
this version exists for the many codebases that cannot adopt it.

## Step 5 — the other signals worth grepping for once

Each of these is a one-line command and each finds a different kind of boundary evidence:

```bash
# Distributed locks: a rule spanning things that are not one aggregate.
grep -rn 'RedisLockRegistry\|ShedLock\|LockRegistry\|acquireLock' src/main/java

# Remote calls inside transactions: a defect now, a much worse one after a split.
grep -rn -B5 'restClient\|webClient\|feignClient' src/main/java | grep -n '@Transactional'

# Cross-module repository injection: the boundary already leaked.
grep -rn 'import com\.retailer\.[a-z]*\.internal\.' src/main/java

# Reconciliation: an invariant already surrendered.
grep -rniE 'reconcil|repair|fixup|sweeper|orphan' src/main/java --include='*.java' -l
```

The last one is the highest-yield single command in this chunk. Every reconciliation job is
an invariant somebody stopped enforcing, and its existence tells you both that a boundary is
already effectively there and roughly what it costs.

## Gotchas

**★ Symptom: the ArchUnit rule passes and the violations are still there.** Cause: the rule
only inspects direct calls, so an extracted private helper hides the second repository. Fix:
walk the call graph transitively. Check the rule by deliberately introducing a violation
behind a helper method and confirming it fails — a rule nobody has seen fail is a rule that
does not work.

**★ Counting repository *reads* as violations.** Reading several aggregates in one
transaction is normal and explicitly permitted; only writes constrain the boundary. Adopt
`@Transactional(readOnly = true)` on query paths so the distinction is visible to tooling
rather than to a human reading method names.

**★ A repository per entity rather than per aggregate root.** If every JPA entity has a
repository, the transaction map is meaningless — a "second repository" may be a child of the
same aggregate. Fix the repositories first: repositories exist for aggregate roots only, and
that single convention makes every subsequent analysis in this topic work.

**★ Symptom: the allow-list has fifteen entries after a year.** Cause: entries were added
under deadline and never revisited. Fix: require a ticket reference in each entry and review
the list in the same meeting that reviews the architecture. An allow-list is a debt
register, not an exemption mechanism.

**★ Running the analysis and never writing the test.** This is the failure this chunk exists
to prevent. The map is a snapshot; the test is the boundary. A team that produces a
beautiful analysis and no build-time enforcement will have the same violations back within
two quarters, and will not know when they returned.

**★ Putting the ArchUnit rules in a module that only some builds run.** Boundary tests must
run in the same pipeline stage as unit tests, on every commit. A nightly architecture job
tells you which of yesterday's twenty merges broke it, which is not useful.

## Interview questions

**★ How would you produce a transaction map of a codebase you have never seen?**
Extract every `@Transactional` method and the aggregate roots it writes. Grep gets you a
candidate list in minutes; ArchUnit gets you an accurate one by inspecting the call graph,
filtering method calls whose owner is a Spring Data `Repository`. Then split the results:
methods writing one root are cheap boundaries, methods writing several are either false
invariants or real constraints. The output is a ranked list of candidate cuts by cost, built
from what the code does rather than what anyone remembers.

**★ What are the limits of the ArchUnit approach, and how do you avoid trusting it too
much?**
Two limits. It sees direct calls by default, so a private helper hides a second repository
unless you walk the call graph transitively. And it cannot distinguish reads from writes
without a convention, so it over-reports until you mark query paths
`@Transactional(readOnly = true)`. The general defence is to test the test: introduce a
deliberate violation, behind a helper method, and confirm the build fails. A rule that has
never been seen to fail is indistinguishable from no rule.

**★ Why is a repository per aggregate root, rather than per entity, load-bearing for this
analysis?**
Because the whole method treats "wrote through a second repository" as a proxy for "wrote a
second aggregate". If every entity has a repository, that proxy breaks — a second repository
may be a child inside the same consistency boundary — and worse, the extra repository is
itself the mechanism by which invariants get bypassed, since it offers a way to write the
child without loading the root. Evans' original rule is that repositories exist for
aggregate roots; the practical payoff is that it makes the boundary analysis mechanical.

**★ You find a distributed lock in the codebase. What have you learned?**
That some rule spans two things that are not in one aggregate, and that somebody hit the
consequence in production and patched it rather than remodelling. It is a strong signal
either that an aggregate boundary is wrong — the two things belong together — or that a
service boundary was drawn through an invariant and the lock is the cheapest available
substitute for a transaction. Either way it is a specific, dated, evidenced finding, which is
worth more than a page of design discussion.

**★ Why insist on enforcing the boundary in the build rather than in review?**
Because review is a sampling process and the build is not. Boundary violations arrive one
convenient shortcut at a time, usually under deadline, usually in a large pull request where
the reviewer is looking at the feature. Nobody notices the extra repository injection. Two
quarters later the map has changed and nobody can say when. A failing build is the only
mechanism that costs the person introducing the violation something at the moment they
introduce it, which is the only moment it is cheap to reconsider.

---

← [The transaction boundary](09-the-transaction-boundary.md) · [Topic index](README.md) · Next → [Who owns the data](10-who-owns-the-data.md)
