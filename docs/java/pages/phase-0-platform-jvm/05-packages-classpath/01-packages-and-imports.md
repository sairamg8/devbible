---
title: "Packages and imports"
sidebar_label: "1 · Packages and imports"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §7 (packages and compilation units)
> and §6.5 (meaning of names), and the `javac` reference in the JDK 25
> documentation.

**A class's real name is its fully qualified name — `com.acme.billing.Invoice`
— and everything else is convenience. The package declaration assigns that
name, the directory layout mirrors it because the tools resolve names through
the filesystem, and `import` is nothing but a compile-time abbreviation: it
loads nothing, costs nothing at run time, and appears nowhere in the
bytecode.**

## Packages assign the real name

```java
// src/com/acme/billing/Invoice.java
package com.acme.billing;

public class Invoice { ... }
```

The class *is* `com.acme.billing.Invoice`. The JVM, the classpath, stack
traces, logs and reflection all speak this full name; the short `Invoice`
exists only inside source files that import it.

Conventions with teeth:

- **Reverse-DNS naming** (`com.acme.billing`) exists to make names globally
  unique — two vendors' `Invoice` classes never collide because their
  packages differ. It matters most at the seam this bible cares about:
  your dependencies' packages must not overlap yours.
- **Package name ≠ Maven coordinates.** `groupId:artifactId` names a *jar*;
  packages name *classes inside it*. They usually align
  (`com.fasterxml.jackson.core` the group, `com.fasterxml.jackson.core` the
  package) but nothing enforces it — you find a class's jar with your IDE or
  `mvn dependency:tree`, not by reading the package name.
- **Lowercase, no underscores** — the ecosystem-wide idiom.

## The directory contract

Tools resolve `com.acme.billing.Invoice` to
`com/acme/billing/Invoice.class` relative to a classpath root. Source trees
mirror the same layout (`src/main/java/com/acme/billing/Invoice.java` under
Maven's convention). Two consequences:

- `javac -d out` *creates* the package directories for the `.class` output —
  the compiled layout always matches the declaration.
- A source file whose `package` line disagrees with its directory breaks the
  build in tool-specific ways (javac accepts some layouts a build tool
  won't). Keep them aligned; IDEs refactor both together for exactly this
  reason.

## `import` does nothing at run time

An import is a *name abbreviation for the compiler*:

```java
import java.util.List;           // "List means java.util.List in this file"
import java.util.*;              // "try java.util for unknown simple names"
import static java.util.Objects.requireNonNull;  // member, not type
```

Facts that settle recurring arguments:

- **Imports never load classes**, never affect startup, never appear in
  bytecode — the class file stores fully qualified names. "Too many imports
  slow the app down" is not a thing.
- **Wildcard imports have zero runtime or class-file difference** from
  explicit ones. The case against them is readability and *collision risk*:
  with `java.util.*` and `java.awt.*` both imported, the simple name `List`
  is ambiguous and the file stops compiling. Team style settles it; the
  machine does not care.
- `java.lang.*` is imported implicitly — why `String` and `System` never
  need imports.
- A class in the **same package** needs no import; a class in the *default
  (unnamed) package* — one with no `package` line — **cannot be imported at
  all**, which is one of several reasons the default package is only for
  scratch files.

## Subpackages are strangers

`com.acme.billing` and `com.acme.billing.pdf` are **unrelated packages** that
happen to share a name prefix. `import com.acme.billing.*` does not see
`pdf`'s classes; package-private members of one are invisible to the other.
The hierarchy exists in the filesystem and in your mental model — not in the
access rules.

This bites when using **package-private** (no modifier) as an encapsulation
tool — the underrated default Phase 2 recommends: it scopes access to
*exactly one* package, so a "helper visible to the whole feature" must live
in the same single package as the feature, not in a subpackage.

## Split packages: one name, two jars

The same package spanning two classpath entries is a **split package**. On
the classpath it mostly works (both halves resolve) but is a latent hazard:
sealing, JPMS migration (topic 11 — modules flatly forbid split packages)
and shading all trip on it. It usually appears when a library renames its
artifact but keeps packages, and both old and new artifacts end up on the
classpath — the `dependency:tree` + exclusion dance of Phase 8.

## Gotchas

**Symptom:** "wrong package" / "class not in expected location" build errors after moving a file
**Cause:** the `package` declaration and the directory path disagree — tools resolve names through the layout contract
**Fix:** move files with the IDE's refactoring (it rewrites the declaration and every import) rather than the filesystem

**Symptom:** adding `import java.awt.*;` to a file broke `List` references that compiled fine yesterday
**Cause:** wildcard collision — both `java.util.List` and `java.awt.List` now match the simple name, and the compiler refuses to guess
**Fix:** explicit `import java.util.List;` wins over a wildcard; or fully qualify the rare one. This is the concrete argument behind "no wildcard imports" style rules

**Symptom:** two classes in `com.acme.util` can't see each other's package-private members
**Cause:** they're in `com.acme.util` and `com.acme.util.text` — subpackages are unrelated packages; the prefix means nothing to access control
**Fix:** package-private sharing requires the *same* package, exactly. Restructure, or widen access deliberately

**Symptom:** a quick scratch class with no `package` line can't be used from real code
**Cause:** the default (unnamed) package cannot be imported — by specification
**Fix:** give everything a package; the default package is for `jshell`-grade experiments only

**Symptom:** searched a jar for a class because its package "matched" the artifact name, and it wasn't there
**Cause:** package names and Maven coordinates are independent namespaces that merely tend to align
**Fix:** locate classes with the IDE (Go to Class shows the jar) or `mvn dependency:tree`; never assume from the name

**Symptom:** JPMS migration or a shading step fails with a split-package error nobody knowingly created
**Cause:** the same package exists in two jars — usually an artifact rename with both old and new on the classpath
**Fix:** `mvn dependency:tree`, find the doubled artifact lineage, exclude the stale one (Phase 8's mediation topic)

**Symptom:** review comment says imports are "slowing startup" and demands trimming
**Cause:** folklore — imports are compile-time only and absent from bytecode
**Fix:** trim for readability if the team likes; the runtime argument is false and measurable as such (`javap` shows only qualified names)

## Interview questions

**★ What does `import` actually do?**
It tells the *compiler* what a simple name abbreviates in that source file.
Nothing is loaded, nothing changes at run time, nothing appears in the class
file — bytecode uses fully qualified names throughout. Class *loading*
happens lazily at first use, driven by execution, not by imports.

**★ Are `com.acme.billing` and `com.acme.billing.pdf` related?**
Only in the filesystem and in human convention. For the language they are
unrelated: no access relationship (package-private stops at the exact
package), and wildcard imports of the parent don't include the child.

**★ Why reverse-DNS package names?**
Global uniqueness without coordination: your domain scopes your names, so
your `Invoice` and a vendor's `Invoice` are different fully qualified names
and coexist on one classpath. The convention is what makes "just add the
dependency" safe at scale.

**★ Is there any difference between wildcard and explicit imports at run time?**
None — identical bytecode. The debate is purely about source readability and
compile-time ambiguity (two wildcards providing the same simple name). Teams
that ban wildcards are optimizing review clarity, not performance.

**What is a split package and why does it matter?**
One package's classes spread across two classpath entries. Tolerated (mostly)
by the classpath, forbidden by the module system, and hazardous with shading
— it usually signals a stale duplicate artifact that Phase 8's dependency
tools should remove.

**Why can't you import from the default package?**
The JLS provides no syntax to name it — a type without a package can only be
referenced from the default package itself. It exists for throwaway code;
anything real gets a package.

**Where must a package-private helper live to be shared by a feature?**
In exactly the same package as its users — not a subpackage. This is the
design constraint that makes package-private a *deliberate* module boundary
(Phase 2) rather than an accident.

---

← Index: [Packages and the classpath](README.md) · Next → [The classpath](02-the-classpath.md)
