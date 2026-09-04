---
title: "verify() on an existing codebase fails on day one, and the teams that delete the test at that point are the majority — detectViolations() with a filter is the adoption path that gives you a green build today and a failing build on the next new violation"
sidebar_label: "12b · detectViolations and adoption"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Verifying Application Module
> Structure* — "Handling Detected Violations"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)) —
> and *Fundamentals* — "Open Application Modules" and "Excluding Packages"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith **2.1.1**. **No sandbox** — no
> violation counts or messages here come from a run.

**Nobody adopts Spring Modulith on a greenfield project; they adopt it on a codebase with
five years of accumulated references. The first `verify()` fails, comprehensively, and what
happens in the next ten minutes decides whether the tool survives. The answer the
documentation gives is `detectViolations()`, and the property that makes it the right answer
is that a filtered violation list still fails on anything new.**

## The API

> *"`ApplicationModules.verify()` throws an exception in case of any architectural violation
> being detected. You can access the violations for further processing, such as ignoring
> certain violations, by instead calling `ApplicationModules.detectViolations()`."*

> ```java
> ApplicationModules.of(…)
>  .detectViolations()
>  .filter(violation -> …)
>  .throwIfPresent();
> ```

Three calls: detect everything, filter out what you are choosing to tolerate, throw if
anything is left. The shape is deliberately a pipeline so the tolerated set is **code you
can read** rather than configuration you cannot.

## The adoption ladder

### Rung 0 — find out what you actually have

Before any decision, print the model and the violations. The model tells you whether
detection is even producing the modules you think it is
([34 · Module detection](11h-module-detection.md)); the violation list tells you the scale.

```java
package com.acme.commerce;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityReportTests {

    static final ApplicationModules MODULES = ApplicationModules.of(CommerceApplication.class);

    @Test
    void printsTheModel() {
        MODULES.forEach(System.out::println);
    }
}
```

### Rung 1 — enforce acyclicity only

Mark every module open ([33 · Open modules](11g-open-modules.md)). Rules 2 and 3 relax; rule
1 — no cycles — still applies, because it is not affected by openness. You get a green build
that checks the single most important structural property.

If even that fails, you have cycles, and fixing them is the first real work. It is also the
work with the highest return, because a cyclic pair of modules can never be extracted.

### Rung 2 — a filtered violation list

Better than open modules wherever the violations are enumerable, because it fails on new
ones:

```java
package com.acme.commerce;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    static final ApplicationModules MODULES = ApplicationModules.of(CommerceApplication.class);

    /**
     * Known, pre-existing violations. This list may only shrink.
     * Each entry needs a ticket. Adding an entry needs a reviewer's agreement.
     */
    private static final Set<String> ACCEPTED = Set.of(
            "com.acme.commerce.reporting.internal.LegacySalesExporter",
            "com.acme.commerce.ordering.internal.OrderEntity"
    );

    @Test
    void verifiesModularStructure() {
        MODULES.detectViolations()
                .filter(violation -> ACCEPTED.stream().noneMatch(violation.getMessage()::contains))
                .throwIfPresent();
    }
}
```

Note what this buys that an open module does not: a reference into
`reporting.internal.LegacySalesExporter` is tolerated; a *new* reference into
`reporting.internal.SomethingElse` fails. The blast radius of the exemption is one named
type.

⚠️ **Filtering on message content is string matching, and the reference does not specify the
message format as a contract.** It works, it is what the documented `filter(violation -> …)`
shape invites, and it is brittle across upgrades. Treat an unexpected verification failure
after a Spring Modulith upgrade as possibly a message-format change rather than a new
violation, and keep the accepted list short enough that re-deriving it is cheap.

### Rung 3 — the ratchet

The exemption list must only shrink. A test that enforces this is three lines and it is what
prevents rung 2 from becoming permanent:

```java
@Test
void acceptedViolationsOnlyShrink() {
    // The number here is reduced when violations are fixed. It is never increased
    // without a design discussion recorded in the pull request.
    org.assertj.core.api.Assertions.assertThat(ACCEPTED).hasSizeLessThanOrEqualTo(2);
}
```

Crude, and it works, because raising the bound requires editing a number that a reviewer can
see.

### Rung 4 — declared dependencies, then a tightened graph

Only once the violation list is empty does `allowedDependencies` become tractable — see the
adoption order in
[31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md).

## Excluding rather than exempting

Some code should not be in the analysis at all: generated sources, a vendor-provided package,
a legacy area scheduled for deletion.

> ```java
> ApplicationModules.of(Application.class, JavaClass.Predicates.resideInAPackage("com.example.db")).verify();
> ```

Remember the matcher rule from [28 · The package arrangement](11b-the-package-arrangement.md):
`com.example.db` matches that package only; `com.example.db..` matches the subtree. An
exclusion missing the trailing `..` excludes almost nothing and looks correct.

**Exclusion is the strongest form of exemption and the least visible.** Excluded code is
invisible to the whole model — it becomes "code not assigned to any module", freely
referenceable from everywhere. Prefer filtering, which leaves the violation reported and
merely tolerated.

## Choosing between the three escapes

| | Open module | Filtered violation | Package exclusion |
|---|---|---|---|
| Granularity | One module | One violation | One package subtree |
| Fails on new violations in the same area | No | **Yes** | No |
| Visible in review | One annotation | A list in a test | An argument in one call |
| Widens what `allowedDependencies` consumers reach | Yes | No | It leaves the module model |
| Use for | Packaging not yet reorganised | A known, enumerated set | Generated or vendor code |

## Gotchas

**★ The first `verify()` on an existing codebase fails hard, and deleting the test is the
common response.** Plan the adoption before you add the dependency: print the model, choose a
rung, and land the first commit already green. A team whose first experience of the tool is a
wall of red will not come back to it.

**★ Filtering is better than opening because a filter still fails on new violations.**
An open module permits everything against it forever, including code written next week; a
filtered list permits exactly the named references. Wherever you can enumerate the
violations, enumerate them.

**★ Filtering by message substring is string matching against an unspecified format.** The
reference documents `filter(violation -> …)` and does not promise the message shape across
versions. Keep the accepted list short, comment each entry with a ticket, and treat a
surprise failure after an upgrade as a possible format change before assuming new code broke
something.

**★ An exemption list without a ratchet becomes permanent, always.** Add the shrink-only
assertion in the same commit as the list. Raising the bound then requires editing a visible
number in a reviewed change, which is the whole mechanism.

**★ Package exclusion is the most invisible escape and it removes code from the model
entirely.** Excluded types belong to no module, and code not assigned to a module is
referenceable from everywhere without a violation. Use it for genuinely non-domain code —
generated adapters, vendor packages — and never as a way to make a domain violation
disappear.

**★ An exclusion predicate without a trailing `..` matches one package, not a subtree.**
`resideInAPackage("com.acme.generated")` leaves `com.acme.generated.jpa` fully in scope. The
exclusion reads correctly, does almost nothing, and the violations that remain look
inexplicable.

**★ Fix cycles first, whatever rung you are on.** They are the only violations that make
extraction impossible rather than merely awkward, they are unaffected by open modules, and
they are usually few. Everything else can wait behind an exemption; a cycle should not.

**★ Every accepted violation needs an owner and a ticket, or the list is a wishlist.** A
comment saying "legacy, to be fixed" with no name and no date has never been fixed in any
codebase. Put the ticket reference in the entry, so the list is a work queue rather than an
apology.

## Interview questions

**★ You add Spring Modulith to a five-year-old codebase and `verify()` produces a hundred
failures. What now?**
Do not delete the test and do not open every module reflexively. First print the module model,
because a substantial fraction of surprise failures come from detection producing modules you
did not intend. Then decide a rung: either mark modules open temporarily, which still enforces
acyclicity — the rule openness does not disable — or, better, switch to
`detectViolations().filter(…).throwIfPresent()` with an explicit list of accepted
pre-existing violations. The filter approach is preferable because it tolerates exactly the
named references while still failing on any new violation in the same module. Then add a
ratchet asserting the accepted list only shrinks, and fix cycles first.

**★ Why is filtering violations better than declaring modules open?**
Granularity and direction of travel. An open module permanently permits any reference into
its internals, including references written after adoption, so it degrades on its own. A
filtered list permits exactly the enumerated references and continues to fail on anything new
in the same module, so it holds the line while you work through the backlog. Filtering is
also more visible in review — a list in a test file with tickets against each entry, rather
than one annotation on a `package-info.java` that nobody opens.

**★ What is the risk of excluding a package from the analysis?**
The excluded types leave the module model entirely, which means they become code not assigned
to any module — and code not assigned to a module is referenceable from every module with no
violation reported. So an exclusion is strictly stronger than an exemption and much less
visible: it does not merely tolerate a known violation, it makes an entire area of the
codebase permanently invisible to every rule. It is right for generated sources and vendor
packages, and wrong as a way to silence a domain violation. Watch also for the missing
trailing `..`, which makes an exclusion match one package rather than a subtree.

**★ How do you stop an adoption compromise from becoming permanent?**
Make the compromise a number that only moves one way, and make moving it a reviewed action.
Concretely: keep accepted violations in an explicit set, add a test asserting that set's size
is at or below a bound, and reduce the bound as violations are fixed. Increasing it then
requires editing a visible constant in a pull request, which forces a conversation. The same
applies to open modules — assert a maximum count and ratchet it down. Without that, both
mechanisms are indistinguishable from having no verification at all, while producing a green
build that suggests otherwise.

{/* FOOTER */}
