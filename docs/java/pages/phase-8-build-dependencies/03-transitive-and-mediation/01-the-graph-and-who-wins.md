---
title: "The graph, and who wins"
sidebar_label: "1 · The graph and who wins"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven guide *Introduction to the Dependency
> Mechanism* (transitive dependencies, dependency mediation — "nearest
> definition", the equal-depth tiebreak), the Maven POM reference (soft vs hard
> version requirements), and the Gradle 9.7.0 user guide (*Dependency
> Constraints and Conflict Resolution* — "By default, it will select the
> highest one out of these versions" — and *Declaring Versions*: `require`,
> `strictly`, `prefer`, `reject`). JDK 25 target.

**Maven and Gradle solve the same problem — collapse a dependency graph that
offers several versions of one artifact down to the single version a flat
classpath can hold — and they solve it with *opposite* rules. Maven takes the
nearest one to your project; Gradle takes the highest one anywhere in the
graph. It is the single most surprising difference between the two tools, it is
silent in both, and it means "it works when we build with Gradle" is not
evidence about the Maven build.**

## How the graph gets built

You declare ten dependencies. Maven reads each one's published POM, reads
*their* declared dependencies, and recurses. Nothing about this is clever — the
POM is a data file in the repository, and resolution is a graph walk over it.

Three things prune that walk as it goes, and all three come from
[topic 02](../02-dependency-scopes/README.md):

- **Scope rewriting.** `provided` and `test` dependencies of your dependencies
  are dropped entirely; `runtime` ones stay but are demoted.
- **`<optional>true</optional>`** on an edge stops it propagating.
- **`<exclusions>`** on your declaration delete named subtrees.

What comes out is still a *graph*, not a tree: the same
`groupId:artifactId` typically appears on several paths, often at several
versions. The classpath cannot hold two versions of a class
([the classpath is first-match-wins](../../phase-0-platform-jvm/05-packages-classpath/02-the-classpath.md)),
so the graph must be flattened to **one version per `groupId:artifactId`**.
Choosing that version is **dependency mediation**.

## Maven: nearest wins

> *"Maven picks the 'nearest definition'. That is, it uses the version of the
> closest dependency to your project in the tree of dependencies."*

Distance is measured in edges from **your** POM. The guide's own example:

```
A                      ← your project
├── B                  depth 1
│   └── C              depth 2
│       └── D 2.0      depth 3
└── E                  depth 1
    └── D 1.0          depth 2
```

**D 1.0 wins.** It is at depth 2; D 2.0 is at depth 3. The path through `E` is
shorter, so the older version is the one on your classpath — and nothing about
that is announced.

Two corollaries do all the work in practice:

- **Your own POM is depth 1, so a direct declaration always wins.** *"You can
  always guarantee a version by declaring it explicitly in your project's
  POM."* This is the crudest fix and it works, at the cost of a dependency
  entry your code does not actually import.
- **At equal depth, the first declaration wins.** *"Note that if two dependency
  versions are at the same depth in the dependency tree, the first declaration
  wins."* That is textual order in the POM. Reordering two `<dependency>`
  elements can change which jar you ship — one of the very few places in Maven
  where XML order is semantically load-bearing.

### Soft and hard requirements

A plain `<version>1.0</version>` is a **soft requirement**: the POM reference
defines it as *"use 1.0 if no other version appears earlier in the dependency
tree"*. Mediation is free to replace it. Bracketed forms — `[1.0]`, `[1.2,1.3]`
— are **hard requirements**: they override soft ones, and if no version
satisfies every hard requirement in the graph, **the build fails**. That is the
only case where Maven refuses to pick for you, and it is why ranges are far
more disruptive than they look (chunk 2).

## Gradle: highest wins

Gradle's documented default is the exact inverse: given several requested
versions of a module, *"by default, it will select the **highest** one out of
these versions."* Depth is irrelevant. In the graph above, Gradle picks
**D 2.0**.

| | Maven 3.9 | Gradle 9.7 |
|---|---|---|
| Default rule | nearest to the root wins | highest version in the graph wins |
| Tiebreak | first `<dependency>` declared | not needed — versions are totally ordered |
| Can silently **downgrade**? | ✅ yes, and routinely does | ❌ no, by construction |
| Direct declaration always wins? | ✅ yes (depth 1) | ❌ no — a transitive `2.0` beats your declared `1.0` |
| Deterministic override | `<dependencyManagement>` | `constraints { }`, `strictly`, `enforcedPlatform` |
| Fail on conflict | hard requirement (range) that cannot be satisfied | `strictly` that cannot be satisfied |

Gradle's rich version constraints make the intent explicit rather than
positional:

```kotlin
dependencies {
    implementation("com.google.guava:guava") {
        version {
            strictly("33.3.1-jre")   // excludes any other version; CAN downgrade
        }
    }
    implementation("org.apache.commons:commons-lang3:3.17.0")  // = require
}
```

- **`require`** (what a bare version means) — the selected version cannot be
  *lower*, but conflict resolution may raise it.
- **`strictly`** — the strongest form. It excludes every non-matching version
  and **can downgrade**; if no acceptable version exists, resolution **fails**.
  Gradle's docs warn against it in published libraries, because it can break
  downstream consumers' builds.
- **`prefer`** — the weakest; applies only when nothing stronger is stated.
- **`reject`** — outside the hierarchy; naming a version that must never be
  selected, which is the clean way to blacklist a known-bad release.

**Which rule is safer?** Highest-wins matches how the ecosystem actually
behaves — libraries are usually backward compatible, so the newest version
generally satisfies everyone. Nearest-wins is the one that produces silent
downgrades, which is exactly the failure below. That is why Maven users bolt
`requireUpperBoundDeps` onto their builds (chunk 3): it is Enforcer
retrofitting Gradle's rule as a *check* rather than a policy.

## Why a compile-clean build ships a `NoSuchMethodError`

Here is the mechanism, and it is worth being precise about because "dependency
hell" is usually just this:

1. Your service depends on **library X**, which was compiled and tested against
   **Guava 33**. X calls a method that only exists in Guava 33.
2. Something else in your graph — an older internal library, at a shallower
   depth — brings **Guava 21**.
3. Nearest-wins picks **Guava 21**. Your classpath now has Guava 21 and X's
   bytecode expecting Guava 33.
4. **Your build is green.** `javac` only type-checks *your* source against the
   classpath, and your code never touches the missing method. X was compiled
   long ago, elsewhere, against a classpath that no longer exists.
5. The JVM resolves each call site lazily, the first time it is executed. When
   a request finally reaches X's code path, that resolution fails:
   **`NoSuchMethodError`** — the class loaded, the method is not in it.

Every property of this failure follows from step 5. It is not at startup, it is
at first use. It is not in your code, it is inside a library. It appears after
a dependency bump that touched neither library directly. And it is invisible to
tests unless a test exercises that exact path with the real classpath.

`AbstractMethodError` and `NoSuchFieldError` are the same story with different
members; `LinkageError` is the family name. Compile-time compatibility and
runtime binary compatibility are **different guarantees**, and the build only
checks the first —
[Classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)
separates the three cases.

## Gotchas

**Symptom:** adding one unrelated dependency changes the version of a jar nowhere near it, and something breaks
**Cause:** the new dependency introduced a shorter path to a shared artifact, so nearest-wins re-mediated it to a different version. The graph is global; there are no local changes
**Fix:** diff `mvn dependency:tree` before and after the change — the version delta is the whole diagnosis — and pin the artifact in `<dependencyManagement>` so future graph changes cannot move it

**Symptom:** reordering two `<dependency>` blocks in the POM, with no other edit, changes which jar ships
**Cause:** the two competing versions are at equal depth, and Maven's documented tiebreak is that the first declaration wins. XML order is semantic here
**Fix:** never rely on it. Put the version in `<dependencyManagement>`, which takes precedence over mediation entirely and does not care about ordering

**Symptom:** a library that "definitely works" throws `NoSuchMethodError` deep inside itself, on a code path that used to be fine
**Cause:** mediation silently downgraded one of *that library's* dependencies below what it was compiled against — the classic nearest-wins downgrade
**Fix:** find the two versions with `mvn dependency:tree -Dverbose -Dincludes=<groupId>`, raise the pin to at least what the library needs, and add Enforcer's `requireUpperBoundDeps` so the next downgrade fails the build instead

**Symptom:** the Gradle build of the same module produces a different classpath from the Maven build
**Cause:** they use opposite mediation rules — Maven takes the nearest, Gradle takes the highest. Identical POMs, different answers, both correct by their own documentation
**Fix:** never treat one tool's green build as evidence about the other's. If both are real build paths, pin the contested versions explicitly in both (a BOM plus `platform()`), so mediation has nothing left to decide

**Symptom:** you declare `1.0` of an artifact directly in Gradle and get `2.0` on the classpath
**Cause:** a bare version in Gradle means `require`, not "use this" — conflict resolution can raise it. Maven's depth-1 guarantee has no Gradle equivalent
**Fix:** use `strictly("1.0")` if you truly mean only that version, and accept that resolution will now fail rather than compromise. In a published library, prefer a constraint over `strictly`

**Symptom:** an integration test passes in CI and the same code fails in production with `NoSuchMethodError`
**Cause:** the test ran on the test classpath, which includes `test`-scoped and `runtime`-scoped artifacts the production classpath does not — different graph, different mediation outcome
**Fix:** compare `mvn dependency:tree -Dscope=runtime` against what tests see, and smoke-test the built artifact itself (`java -jar`) rather than the module's test classpath

## Interview questions

**★ State Maven's mediation rule precisely, including the tiebreak.**
Nearest wins: for each `groupId:artifactId`, Maven selects the version whose
declaration is fewest edges from your project's POM. Your own POM is depth 1,
so a direct declaration always wins. If two candidates sit at equal depth, the
**first one declared** wins — textual order in the POM. Note what the rule does
*not* consider: it is not the highest version, not the newest release, and not
the one the library was compiled against.

**★ Gradle and Maven, same dependency graph — why different classpaths?**
Because the mediation rules are opposites. Maven picks the nearest declaration
to the root; Gradle's documented default picks the **highest** version present
anywhere in the graph, ignoring depth. So Maven can silently downgrade a
transitive dependency below what a library needs, while Gradle cannot; and
Gradle can override a version you declared directly, while Maven cannot. Both
are documented defaults, and neither warns.

**★ Why can a build be completely clean and still ship a `NoSuchMethodError`?**
Because `javac` only type-checks *your* source against the classpath. A library
in your graph was compiled elsewhere against a different version of a shared
dependency; if mediation puts an older version on the classpath, that library's
bytecode still references a method that is no longer there. The JVM resolves
call sites lazily at first execution, so the failure surfaces at runtime, on
first use of that path, inside code you did not write. Compile-time
compatibility and runtime binary compatibility are different guarantees.

**★ What is the difference between a soft and a hard version requirement in Maven?**
A plain `<version>1.0</version>` is soft — the POM reference defines it as "use
1.0 if no other version appears earlier in the dependency tree", so mediation
may replace it. A bracketed form (`[1.0]`, `[1.2,1.3]`, `[1.5,)`) is hard: it
overrides soft requirements, and if no single version satisfies every hard
requirement in the graph, the build fails outright. Almost all real POMs use
soft requirements, which is why mediation matters at all.

**★ Explain `require`, `strictly`, `prefer` and `reject` in Gradle.**
`require` is what a bare version string means: the selection cannot go *below*
it, but conflict resolution may raise it. `strictly` excludes every
non-matching version and is the only one that can force a **downgrade** — if
nothing acceptable exists, resolution fails. `prefer` is the weakest and
applies only when no stronger constraint is present. `reject` sits outside that
hierarchy and names versions that must never be selected, which is the clean
way to blacklist a known-bad release. Gradle's own docs caution against
`strictly` in published libraries because it propagates and can break
consumers.

**★ Is highest-wins or nearest-wins the safer default? Argue it.**
Highest-wins, in practice. The ecosystem's norm is backward compatibility, so
the newest version in the graph usually satisfies every consumer of it, and the
rule cannot produce the silent-downgrade failure at all. Nearest-wins has one
real advantage — a direct declaration is an absolute override, which makes
fixes predictable — but the price is that graph shape, not intent, decides your
version. The strongest evidence is that Maven users routinely add Enforcer's
`requireUpperBoundDeps`, which is precisely Gradle's rule reimposed as a check.

**★ Someone fixes a wrong-version incident by deleting `~/.m2/repository`. What is wrong with that?**
Everything except that it sometimes appears to work. Mediation is a pure
function of the graph and the POMs; the local repository is only a cache, so
wiping it re-downloads the same artifacts and reaches the same decision. It
"fixes" exactly one class of problem — a genuinely corrupt or half-written
cached artifact — and hides the diagnosis for everything else. The correct
first move is `mvn dependency:tree -Dverbose`, which shows which versions were
considered and which were omitted for conflict.

---

← Prev: [Transitive dependencies and mediation](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Reading the tree, and overriding it](02-reading-and-overriding.md)
