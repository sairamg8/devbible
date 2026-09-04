---
title: "A Shared Kernel is an explicit, co-owned subset of domain code and schema shared between bounded contexts — the most expensive relationship in DDD, survivable only with strict admission criteria and automated CI gates"
sidebar_label: "33 · Shared kernel"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015), *Shared Kernel*,
> reproduced verbatim in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)); Eric Evans,
> *Domain-Driven Design* (Addison-Wesley, 2003), Chapter 14 *Maintaining Model Integrity*.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**A Shared Kernel is a deliberately shared subset of the domain model, code, or database schema that two bounded contexts agree to maintain jointly. Unlike an accidental `common-utils` grab bag, a Shared Kernel represents an explicit mutual dependency: neither team can alter any class, method, or database table inside the kernel without consulting the other team and verifying both test suites. Because any change requires dual consultation, synchronized testing, and coordinated deployments, a Shared Kernel is the most expensive relationship pattern in Domain-Driven Design. It is justifiable only when the cost of translating between two closely related subdomains exceeds the high coordination overhead of co-ownership, and it survives only when protected by strict size constraints and automated CI gates.**

## Shared Kernel vs the shared model jar

In [16 · The shared model jar](16-the-shared-model-jar.md), we examined the catastrophic anti-pattern of putting all enterprise entities into a shared library. A Shared Kernel is fundamentally different in intent, scope, and governance:

| Characteristic | The Shared Model Jar (Anti-pattern) | The Shared Kernel (DDD Pattern) |
|---|---|---|
| **Scope** | Enterprise-wide; dozens of services depend on it | Localized strictly between **two** collaborating teams |
| **Contents** | Mutable entities, database schemas, business workflows | Pure immutable value objects, universal identifiers |
| **Governance** | Unowned or owned by a detached platform team | Explicitly co-owned with mutual veto power |
| **Dependencies** | Heavy dependencies (Spring, Hibernate, Jackson) | Zero external dependencies (pure JDK only) |
| **Trajectory** | Expands uncontrollably over time | Kept aggressively minimal, with intent to shrink |

Evans defines it as a deliberately **small** designation, not a convenience:

> *"Designate with an explicit boundary some subset of the domain model that the teams agree to share. Keep this kernel small."*

and constrains it in the same entry: the shared subset — model, code and the associated part of
the database design — has **special status, and shouldn't be changed without consultation with
the other team.** That consultation clause is the entire cost of the pattern. A Shared Kernel is
therefore not changeable as freely as the rest of the design, and both teams' builds have to
prove it still works; the four rules below are what turn that obligation into something a CI
pipeline enforces rather than something two teams remember to do.

## The four rules that make a Shared Kernel survivable

To prevent a Shared Kernel from paralyzing both teams, four hard rules must be enforced:

1. **Strict admission criteria:** Only pure value objects, domain identifiers, and stateless mathematical formulas may enter. Zero mutable aggregates, zero Spring `@Service` beans, and zero database entities.
2. **Mandatory dual ownership:** Code repository access rules (e.g. `CODEOWNERS`) must mandate that any pull request touching the kernel path requires explicit approval from designated reviewers on *both* teams.
3. **Joint continuous integration:** The CI pipeline for the shared kernel must automatically check out and run the test suites of *both* consuming services before permitting a merge.
4. **Zero framework dependencies:** The kernel must contain pure Java records and interfaces with zero dependencies on Spring, JPA, or web frameworks, preventing transitive dependency conflicts.

## Runnable Java implementation: A pure value kernel

```java
package com.retailer.kernel.financial;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Objects;

// Pure immutable value object shared between Order and Billing contexts
public record Money(BigDecimal amount, Currency currency) implements Comparable<Money> {

    public Money {
        Objects.requireNonNull(amount, "Amount cannot be null");
        Objects.requireNonNull(currency, "Currency cannot be null");
        amount = amount.setScale(currency.getDefaultFractionDigits(), RoundingMode.HALF_UP);
    }

    public static Money of(String amountStr, String currencyCode) {
        return new Money(new BigDecimal(amountStr), Currency.getInstance(currencyCode));
    }

    public Money add(Money other) {
        ensureSameCurrency(other);
        return new Money(this.amount.add(other.amount), this.currency);
    }

    public Money multiply(BigDecimal factor) {
        Objects.requireNonNull(factor, "Factor cannot be null");
        return new Money(this.amount.multiply(factor), this.currency);
    }

    private void ensureSameCurrency(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Currency mismatch: " + this.currency + " vs " + other.currency);
        }
    }

    @Override
    public int compareTo(Money other) {
        ensureSameCurrency(other);
        return this.amount.compareTo(other.amount);
    }
}
```

```java
package com.retailer.kernel.identity;

import java.util.Objects;
import java.util.UUID;

// Universal identifier shared across Order, Billing, and Warehouse
public record CustomerId(UUID value) {
    public CustomerId {
        Objects.requireNonNull(value, "Customer ID value cannot be null");
    }

    public static CustomerId generate() {
        return new CustomerId(UUID.randomUUID());
    }
}
```

## The kernel's real cost is a release calendar, not a jar

The four rules above are about *contents*. The reason Shared Kernel is the highest-risk pattern on the
map is about *time*, and it is worth stating separately because a kernel can satisfy every content
rule and still paralyse two teams.

**A shared kernel makes two independent release trains into one coupled one.** The consultation clause
in the definition — the shared subset *"shouldn't be changed without consultation with the other
team"* — has an operational shape:

1. Team A needs a field on `Money`. It cannot ship it alone.
2. Team B must review, and B's reviewers are busy with B's roadmap, not A's.
3. When it merges, both services need the new kernel version to stay consistent.
4. Which means A and B now deploy in a coordinated order, for a change that belonged to A.

🔴 **That is the whole cost, and it recurs on every kernel change.** Everything else — the naming, the
package layout, the semantic versioning — is machinery for reducing how often step 1 happens. If your
kernel changes monthly, you have two services with one release calendar and should ask whether they
are two services. If it changes yearly, the pattern is working, and the reason it is working is that
the kernel is small.

**The measurement that tells you which one you have:**

```bash
# How often has the coupled release train actually fired?
git log --oneline --since="12 months ago" -- shared-kernel/src/main/java | wc -l
```

A number in single digits is a kernel. A number in the dozens is a
[16 · shared model jar](16-the-shared-model-jar.md) that has been given rules and a nicer name.

## When and how to dismantle a Shared Kernel

As organizations scale, the coordination tax of a Shared Kernel inevitably exceeds its benefits. When the two teams grow from six engineers to thirty, scheduling joint reviews for small kernel changes creates release gridlock.

### The exit strategy

1. **Duplicate the types:** Copy the classes from the shared kernel directly into each bounded context's package.
2. **Sever the dependency:** Remove the shared kernel JAR dependency from both services' build files.
3. **Allow divergent evolution:** Let each context evolve its own representation of the concepts according to its specific ubiquitous language.
4. **Introduce an Open Host Service or ACL:** If the two services still need to communicate, integrate via explicit API contracts (DTO records) over HTTP or messaging.

Duplication of a few immutable records is vastly cheaper than the ongoing organizational friction of a Shared Kernel.

## Gotchas

**★ Symptom: Pull requests touching the shared kernel sit unmerged for two weeks waiting for reviews.**
Cause: High coordination friction. Neither team prioritizes reviewing code for the other team's feature deadlines.
Fix: Dissolve the shared kernel. Copy the types into both codebases and let them evolve independently.

**★ Symptom: A developer adds a database `@Entity` annotation to a shared kernel class, forcing both services to use the same ORM mapping.**
Cause: Breaching the admission criteria.
Fix: Strictly enforce that the shared kernel contains only immutable records and pure Java types. Reject any PR adding persistence or framework annotations.

**★ Symptom: One team releases a shared kernel version bump that passes its own tests but breaks the other team's production build.**
Cause: Lack of joint CI verification.
Fix: Configure CI to run both teams' test suites against the shared kernel branch before permitting a release.

**★ Symptom: the kernel obeys every content rule and the two teams still cannot ship independently.**
Cause: the rules govern what is *in* the kernel, not how often it *changes*. A pure, tiny, dependency-
free kernel that changes every sprint still couples two release trains every sprint.
Fix: measure the change rate before defending the contents, and treat a high rate as a boundary
finding rather than a governance problem:
```bash
git log --oneline --since="12 months ago" -- shared-kernel/src/main/java | wc -l
```
Dozens of changes a year means the two contexts share a model that is still moving, which is evidence
they are one context — merge them ([38 · Merging two services](38-merging-two-services.md)) — or that
the kernel is carrying something that belongs to only one of them.

**★ Symptom: a value type in the kernel gained a method that encodes one team's business rule.**
Cause: the admission criteria were applied at creation and never re-applied. `Money.applyLoyaltyDiscount()`
is a billing rule living in shared code, and shipping means shipping *shipping*'s deployment too.
Fix: the kernel holds representation, never policy. The rule moves back to the team that owns it,
operating on the shared type from outside:
```java
// in the kernel: representation only
public record Money(BigDecimal amount, Currency currency) { public Money plus(Money other) { … } }

// in billing, not the kernel: the rule
Money discounted = loyaltyPolicy.apply(order.total());
```

**★ Symptom: The shared kernel depends on Spring Boot 4.1, preventing one team from upgrading their service independently.**
Cause: Adding framework dependencies to the kernel.
Fix: Strip all framework libraries from the kernel. It must compile against standard Java SE with zero third-party dependencies.

## Interview questions

**★ What is a Shared Kernel in Domain-Driven Design, and why is it considered high-risk?**
A Shared Kernel is a subset of the domain model and code explicitly co-owned by two or more bounded contexts. It is high-risk because it introduces direct compile-time and design-time coupling: neither team can modify the shared code without joint agreement, and changes require synchronized testing and coordinated deployments. If not rigorously restricted, it degenerates into a monolithic shared library that throttles team velocity.

**★ What types of classes are acceptable within a Shared Kernel?**
Only pure, immutable value objects (e.g. `Money`, `Address`), universal domain identifiers (e.g. `CustomerId`), and stateless calculation rules with zero side effects. Mutable entities, aggregate roots, Spring services, repositories, and persistence-annotated classes must never enter a Shared Kernel.

**★ How should a team govern code changes in a Shared Kernel?**
Through mandatory dual-ownership: any pull request modifying the kernel must require automated approval from designated code owners representing each collaborating team. Furthermore, CI pipelines must automatically run the full regression test suites of all consuming services against the proposed kernel changes before merging.

**★ A shared kernel passes every content rule — pure value types, no framework dependencies, dual ownership. Why might it still be the wrong pattern?**
Because the content rules govern what is in it and the cost is about how often it changes. The
consultation clause — the shared subset *"shouldn't be changed without consultation with the other
team"* — means every kernel change requires the other team's review, on their schedule, followed by
a coordinated deployment. A kernel that changes yearly makes that a rounding error; a kernel that
changes monthly has merged two release calendars into one, and the teams are independent on paper
only. The measurement is a `git log` over the kernel path: single digits a year is a kernel, dozens
is a shared model jar with rules. And a kernel that keeps changing is usually telling you the two
contexts share a model that is still moving, which is an argument for merging them rather than for
governing the jar harder.

**★ Why is code duplication often preferable to a Shared Kernel?**
In a distributed microservice architecture, team autonomy is paramount. Maintaining a Shared Kernel forces continuous cross-team coordination, meetings, and synchronized releases. Duplicating a 30-line `Money` record into two separate services costs a few minutes of typing, but removes the cross-team coordination overhead entirely, allowing both teams to ship independently.

---

← [Conformist](32-conformist.md) · [Topic index](README.md) · Next → [Open host and published language](34-open-host-and-published-language.md)
