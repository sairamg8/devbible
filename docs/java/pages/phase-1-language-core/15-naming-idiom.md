---
title: "Naming and idiom: the conventions the ecosystem enforces"
sidebar_label: "15 · Naming and idiom"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §6.1 (naming conventions), §7.6 (one
> public type per compilation unit), the Google Java Style Guide (§5, naming),
> the JavaBeans specification 1.01 (property accessor naming), and the
> `java.lang.Class`/`java.util` Javadoc for platform naming precedent.

**Java's naming rules are not law — the compiler accepts almost anything — but
they are enforced anyway: by the JavaBeans-derived tooling that *parses* names
to find properties, by frameworks that map `getEmail()` to a JSON field, by
Checkstyle gates in CI, and by every reviewer who reads `HTTPSConnection` and
stumbles. Convention here is load-bearing: break it and libraries genuinely
misbehave, not just linters.**

## The core table

| Element | Convention | Example |
|---|---|---|
| package | all lowercase, reverse domain, no underscores | `com.acme.billing` |
| class / interface / enum / record | `UpperCamelCase`, noun | `OrderService`, `Money` |
| method | `lowerCamelCase`, verb phrase | `calculateTotal()` |
| variable / parameter / field | `lowerCamelCase` | `retryCount` |
| constant (`static final` of immutable value) | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| enum constant | `UPPER_SNAKE_CASE` | `Status.PAID` |
| type parameter | single capital: `T`, `E`, `K`, `V`, `R` | `Map<K, V>` |

Two refinements the platform itself models:

- **Acronyms are camel-cased like words**: `HttpClient`, `XmlReader`, `userId`
  — not `HTTPClient` or `userID`. The JDK's own history proves the cost of
  ignoring this (`HttpURLConnection` mixes both styles and everyone mistypes
  it); Google style §5.3 makes the treat-as-word rule explicit.
- **A `static final` field is only a CONSTANT if its value is deeply
  immutable.** `static final Logger log` is camelCase — the logger is a
  mutable object, not a constant. `UPPER_SNAKE` a mutable thing and readers
  will treat it as safely shareable when it isn't.

## Names that tooling parses — the JavaBeans contract

`getX()`/`setX(v)`/`isX()` (boolean) is not a taste choice; it is a wire
format. Jackson, JPA, Spring's binder, JSF and every bean-mapper derive the
*property name* by stripping the prefix and lower-casing the next letter:
`getEmail()` → property `email`. Consequences worth knowing:

- Rename `getEmail()` to `fetchEmail()` and the JSON field silently
  disappears — no error, just an absent key.
- A boolean property may use `isActive()`; `getActive()` also works;
  `hasChildren()` is **not** a JavaBeans accessor and mappers ignore it.
- Records deliberately broke this convention (`email()`, not `getEmail()`) and
  modern libraries special-case them — but *your* reflective code must too.

## Packages

Reverse-domain (`com.acme.billing`) exists to make names globally unique, and
lowercase-only exists because packages map to directories on case-insensitive
file systems. Beyond the mechanics, the idiomatic choice that matters is
**package-by-feature over package-by-layer**: `billing.invoice`,
`billing.payment` — not `controllers`, `services`, `repositories` — because
package-private (Phase 2's
[encapsulation topic](../phase-2-classes-objects/02-encapsulation-access/README.md))
only encapsulates within a package, and a layer package makes everything
public by necessity.

## One public type per file

The JLS (§7.6) permits the compiler to *require* that a public type live in a
file named after it — and `javac` does require it. So `public class
OrderService` must be in `OrderService.java`; a second top-level type in that
file cannot be public. Idiom goes further than the rule: one top-level type
per file, full stop, because two types in one file are invisible to anyone
navigating by file name. (Nested types — Phase 2's
[nested classes](../phase-2-classes-objects/11-nested-classes.md) — are the
sanctioned way to co-locate.)

## Idioms reviewers actually enforce

- **No `IFoo`/`FooImpl` reflex.** Java (unlike C#) names the interface for the
  concept — `List`, not `IList` — and names the implementation for *how* it
  implements: `ArrayList`, not `ListImpl`. If the only possible name is
  `FooImpl`, that is a signal the interface may not deserve to exist yet.
- **Booleans read as assertions**: `isEmpty`, `hasNext`, `canRetry` — never
  negated names (`notReady`) which produce `!notReady` double-negatives.
- **Methods returning a new value use verbs that say so**: `plus`, `withName`,
  `toList` (returns transformed copy) vs `setName`, `add` (mutates). `Money.plus`
  vs `StringBuilder.append` model the two families; mixing the vocabularies is
  how callers mutate what they thought was a copy.
- **Test names state behaviour**, not method-under-test:
  `rejectsExpiredCard`, not `testProcess2`.
- **`serialVersionUID`, `args`, `main`** — some names are fixed by contract or
  overwhelming tradition; inventing alternatives costs more than it says.

## What actually enforces all this

Nothing in `javac` (beyond §7.6). In practice enforcement is: **Checkstyle /
SonarQube gates** in CI (most rulesets encode Google or Sun conventions),
**IDE inspections** on by default in IntelliJ, and **framework behaviour** —
the JavaBeans parsing above, JUnit discovering `@Test` methods regardless of
name but reporting them *by* name, JPMS module names following package rules.
Adopt a published style wholesale rather than negotiating a house dialect;
the value is uniformity, not any individual rule.

## Gotchas

**Symptom:** a field renamed in Java disappears from the API's JSON without any error
**Cause:** the mapper derives field names from getter names via the JavaBeans convention; the rename changed the derived property
**Fix:** treat accessor names as wire contract — pin the external name with `@JsonProperty` (or equivalent) before renaming, and test serialized shape, not just behaviour

**Symptom:** `Status.valueOf("paid")` throws `IllegalArgumentException` in production for input that "obviously" matches
**Cause:** enum constants are `UPPER_SNAKE_CASE` and `valueOf` is exact-match, case-sensitive
**Fix:** normalize at the boundary (`valueOf(input.trim().toUpperCase(Locale.ROOT))`) or keep an explicit lookup map — and know `valueOf` throws rather than returning null

**Symptom:** two files compile locally on macOS, clash on the Linux CI machine
**Cause:** packages/types differing only by case map to paths that collide on case-insensitive file systems but not case-sensitive ones (or vice versa)
**Fix:** lowercase packages always; never create two types whose names differ only in case

**Symptom:** a `static final List<String> CODES` is mutated by a caller who assumed it was a constant
**Cause:** UPPER_SNAKE naming promised immutability the object doesn't have — `final` fixes the reference only ([topic 12](12-final.md))
**Fix:** make it actually constant (`List.of(...)`) or rename to camelCase so the name stops lying

**Symptom:** "class OrderService is public, should be declared in a file named OrderService.java"
**Cause:** JLS §7.6 — public top-level type must match its file name
**Fix:** rename the file or the class; while there, split any co-tenant top-level types into their own files

**Symptom:** a boolean getter isn't picked up by a form binder / mapper
**Cause:** the accessor is named `hasX()` or `wasX()` — real words, but outside the `isX`/`getX` patterns the JavaBeans introspector recognizes
**Fix:** conform (`isEnabled`) or annotate the property name explicitly; don't fight the introspector

## Interview questions

**★ Why is `getX`/`setX` more than a style preference in Java?**
Because the JavaBeans specification made accessor names machine-readable:
frameworks derive property names by parsing them. Serialization, ORM mapping
and data binding all key off the convention, so a nonconforming name changes
observable behaviour, not just aesthetics.

**★ When is a `static final` field *not* named in UPPER_SNAKE_CASE?**
When its value is mutable — a logger, a cache, a collection that changes.
UPPER_SNAKE is reserved for true constants (primitives, strings, immutable
objects); a mutable `static final` is camelCase because only the reference is
fixed, not the state.

**★ Why does Java name interfaces `List` and implementations `ArrayList`, rather than `IList`/`List`?**
The interface is the concept callers program against, so it gets the clean
conceptual name; implementations are named for their strategy (array-backed,
linked). The `I` prefix optimizes for the implementer's file tree; Java's
convention optimizes for the reader of call sites, who mostly never sees the
implementation type.

**★ What does the "one public type per file" rule actually buy?**
Navigability (file name = type name, guaranteed by §7.6 for public types) and
honest diffs — a change to `OrderService.java` is a change to `OrderService`.
It also keeps compilation-unit granularity aligned with type granularity for
incremental builds.

**Why package-by-feature rather than package-by-layer?**
Package-private is Java's only sub-public encapsulation boundary and it works
per package. Feature packages let a feature's internals be package-private
with a tiny public surface; layer packages force everything public because
collaborators live in other packages.

**What's wrong with the name `notFound` for a boolean?**
Every negative use becomes a double negative (`!notFound`), which reviewers
demonstrably misread. Name the positive (`found`, `isMissing` — one negation
maximum, in the name *or* the operator, never both).

**Why lowercase package names?**
Packages map to directories; case-only distinctions break on
case-insensitive file systems, and lowercase keeps package names visually
distinct from class names in imports and qualified references.

---

← Prev: [Casting and `instanceof` patterns](14-casting-instanceof/README.md) · Next → [Precedence and evaluation order](16-precedence-evaluation.md)
