---
title: "An architecture rule that cannot go green on the day it is written gets deleted within a week — the two mechanisms that make boundary enforcement adoptable are a baseline that can only shrink and a default that refuses to pass a rule matching nothing"
sidebar_label: "26b · Making the rules stick"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the ArchUnit user guide
> ([archunit.org](https://www.archunit.org/userguide/html/000_Index.html)) — `FreezingArchRule`, the
> `archunit.properties` freeze keys, and the empty-`should` rule and its two switches.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · ArchUnit 1.4.2 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**[26 · ArchUnit rules](26-archunit-rules.md) shows what to assert. This chunk is about the two ways an assertion stops meaning anything, both of which leave the build green. A rule introduced to a five-year-old monolith fails in hundreds of places on the first run, and a rule that fails on the first run is deleted rather than fixed — so enforcement has to start from a baseline that can only shrink. And a rule whose package pattern matches nothing at all passes forever while protecting nothing, which is why ArchUnit refuses by default to evaluate a `should` against an empty set, and why the property that switches that off is a defect rather than a setting.**

## 🔴 The rule that passes because it matched nothing

This is the ArchUnit failure that costs the most, because a green build is exactly the wrong signal.
Rename `com.retailer.order` to `com.retailer.orders` and this rule keeps passing forever:

```java
noClasses().that().resideInAPackage("com.retailer.order..")   // now matches zero classes
    .should().dependOnClassesThat().resideInAPackage("com.retailer.billing..");
```

ArchUnit's default protects you, and it is worth knowing exactly what the default is:

> *"By default, ArchUnit will forbid the should-part of rules to be evaluated against an empty set of
> classes."*

So an empty match **fails** rather than passing — unless someone has switched it off. Two switches
exist: the global property `archRule.failOnEmptyShould=false` in `archunit.properties`, and the
per-rule escape hatch `ArchRule.allowEmptyShould(..)`.

⚠️ **Treat `archRule.failOnEmptyShould=false` as a defect in a properties file.** It is usually added
to silence one legitimately-empty rule and it disables the protection for every rule in the build.
If one rule genuinely has no classes yet — a module you have declared but not written — use
`allowEmptyShould(true)` on that rule alone, where the exception is visible next to the thing it
excuses.

## Adopting ArchUnit on a codebase that already fails

`FreezingArchRule` records today's violations and fails only on new ones, which is what makes the
rule adoptable on day one instead of after a cleanup nobody has scheduled:

```java
@ArchTest
public static final ArchRule no_cycles_between_domain_slices =
    FreezingArchRule.freeze(
        slices().matching("com.retailer.(*)..").should().beFreeOfCycles());
```

The store is configured in `archunit.properties`, and the keys matter because they decide who is
allowed to move the baseline:

```properties
freeze.store.default.path=archunit_store
freeze.store.default.allowStoreCreation=true
freeze.store.default.allowStoreUpdate=true
```

The guide also documents `freeze.refreeze`, plus `freeze.store` and `freeze.lineMatcher` for custom
implementations.

🔴 **The store belongs in version control, and `allowStoreUpdate` belongs off in CI.** The whole
value of a freeze is that the baseline can only shrink; a CI job permitted to update the store will
quietly re-baseline every violation a bad commit introduces, and the rule becomes a formality that
always passes. Create and update locally, commit the diff so a reviewer sees the baseline move, and
run CI with updates disabled.

⚠️ **Modulith's equivalent is `detectViolations().filter(...)`** — see
[25 · Verifying the boundary](25-verifying-the-boundary.md). The freeze is finer-grained and needs a
committed store; the filter is coarser and needs nothing. Do not run both on the same rule.

## Gotchas

**★ Symptom: a boundary rule has been green for months and the boundary it names no longer exists.**
Cause: the package was renamed, or the rule's regex never matched what the author thought it matched,
so the `should` clause is being evaluated against zero classes.
Fix: rely on the default — ArchUnit *"will forbid the should-part of rules to be evaluated against an
empty set of classes"* — and go and check whether somebody disabled it:
```bash
grep -rn 'failOnEmptyShould\|allowEmptyShould' src/test/resources src/test/java
```
Any global `archRule.failOnEmptyShould=false` should become a per-rule `allowEmptyShould(true)` on
the one rule that needs it.

**★ Symptom: Complex rule failure produces a massive, unreadable error message with 50 violations.**
Cause: Introducing ArchUnit to an existing brownfield codebase all at once.
Fix: Use ArchUnit's `FreezingArchRule` to baseline existing violations, preventing *new* boundary violations while teams refactor the existing backlog:
```java
FreezingArchRule.freeze(no_cycles_between_domain_slices);
```

**★ Symptom: CI is green, the freeze store keeps growing, and violations are being added freely.**
Cause: `freeze.store.default.allowStoreUpdate=true` on the CI runner. Every new violation is
absorbed into the baseline instead of failing the build.
Fix: allow store updates locally, commit the store so the baseline move appears in review, and
disable updates in CI:
```properties
# archunit.properties used by CI
freeze.store.default.path=archunit_store
freeze.store.default.allowStoreCreation=false
freeze.store.default.allowStoreUpdate=false
```

## Interview questions

**★ An ArchUnit rule has been passing for six months. What are the three ways it could be lying?**
It matched nothing — a renamed package or a wrong regex, which ArchUnit fails on by default unless
someone set `archRule.failOnEmptyShould=false`. It is frozen, and CI has `allowStoreUpdate` on, so
every new violation was silently baselined. Or the violation is real and invisible to bytecode
analysis: `context.getBean(...)`, reflection, a shared database table, or a string in a `@Query`.
The first two are checkable in a minute with `grep`; the third is why an architecture test is a floor
and not a ceiling.

**★ You are adding boundary enforcement to a monolith that fails hundreds of rules. What do you turn on, in what order?**
Cycles first, frozen — `FreezingArchRule.freeze(slices()…beFreeOfCycles())` — because cycles are the
violations that make extraction impossible rather than merely untidy, and freezing makes the build
green today while forbidding new ones. Then one internals rule per module, unfrozen, added the day
that module reaches zero violations, so each rule arrives already true. Keep the freeze store in
version control with updates disabled in CI, so the baseline can only shrink and every attempt to
move it shows up in a diff a person reads.

---

← [ArchUnit rules](26-archunit-rules.md) · [Topic index](README.md) · Next → [Build modules and JPMS](27-build-modules-and-jpms.md)
