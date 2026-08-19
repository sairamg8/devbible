---
title: "Aggregator, parent and the reactor"
sidebar_label: "2 · Aggregator, parent, reactor"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Apache Maven "Guide to Working with
> Multiple Modules" (the four relationships the reactor sorts on), the POM
> reference (`<modules>`, `<parent>`, `<packaging>pom</packaging>`,
> `<dependencyManagement>`), the Maven CLI reference (`-pl`, `-am`, `-amd`,
> `-rf`, `--fail-at-end`, `-T`), "Maven CI Friendly Versions"
> (`${revision}`), and "What's new in Maven 4" (model 4.1.0:
> `<subprojects>`, inferred parent and sibling versions — **still
> release-candidate, 4.0.0-rc-6**; GA line is 3.9.16).

**The `<modules>` element is a membership list, not a build order. Maven's
reactor builds a directed acyclic graph from the dependencies the modules
declare on one another and topologically sorts it — so reordering `<modules>`
changes nothing, adding a dependency can change everything, and a cycle is
not a slow build but a refusal to start. Everything confusing about a
multi-module build follows from that one fact, including why `-pl` without
`-am` will happily build you against a stale artifact from `~/.m2`.**

## Aggregator and parent are two different jobs

They are conflated because one file usually does both. They are not the same
thing.

| | Aggregator | Parent |
|---|---|---|
| Declared by | `<modules>` in the aggregator | `<parent>` in the **child** |
| Does what | Builds a set of projects together | Supplies inherited configuration |
| Direction | Points *down* at its modules | Child points *up* at it |
| Needs `<packaging>pom</packaging>` | Yes | Yes (a parent has no sources) |
| Inherits anything? | No — aggregation is not inheritance | `dependencyManagement`, `pluginManagement`, `properties`, `<build>` config |

A parent may be published standalone and used by projects in other
repositories it never aggregates — `spring-boot-starter-parent` is exactly
that. Conversely an aggregator can list modules that inherit from something
else entirely. The common single-file case is a convenience, not a rule, and
knowing they are separable is what lets you publish a parent for other teams
without dragging your module list along with it.

```xml
<project>
  <groupId>com.example.shop</groupId>
  <artifactId>shop-parent</artifactId>
  <version>1.4.0-SNAPSHOT</version>
  <packaging>pom</packaging>

  <modules>
    <module>shop-domain</module>
    <module>shop-service</module>
    <module>shop-api</module>
  </modules>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>com.example.shop</groupId>
        <artifactId>shop-domain</artifactId>
        <version>${project.version}</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
</project>
```

⚠️ **`dependencyManagement` does not add a dependency.** It pins the version
*if* a child declares one. Children that need `shop-domain` still declare it —
just without a `<version>`. Putting the dependency itself into the parent's
`<dependencies>` is the classic mistake: now every module inherits it,
including the ones whose slimness was the entire reason for the split.

Maven 4's model 4.1.0 renames `<modules>` to `<subprojects>` (the old element
still works) and drops the requirement to repeat the parent's `<version>` in
every child, inferring both parent and sibling versions inside the reactor.
Until that is GA, the `${revision}` CI-friendly-versions pattern with the
flatten plugin is the standard workaround for the same pain.

## The reactor: build order is computed, not written

The reactor collects every project in the build and topologically sorts them.
The relationships it honours are exactly four:

1. a project dependency on another module in the build,
2. a plugin declaration where the plugin **is** another module in the build,
3. a plugin dependency on another module in the build,
4. a build-extension declaration on another module in the build.

The order of `<modules>` is **not** one of them. Two consequences:

- **A cycle is fatal and immediate.** If `service` depends on `api` and `api`
  depends on `service`, the graph is not acyclic, cannot be sorted, and Maven
  refuses the reactor before any module compiles. There is no override flag,
  and that is correct — there is no order that would work.
- **Unrelated modules have no defined relative order.** A build that only
  passes when `A` runs before `B`, with no dependency between them, has an
  undeclared coupling: commonly a shared output path, a fixed port, or a test
  writing into a sibling's `target/`. Declare the dependency or remove the
  coupling. Reordering the list and hoping is not a fix, because the list is
  not consulted.

Parallelism follows from the same graph: `-T 1C` runs one thread per core,
and modules with no path between them run concurrently. Modules on a
dependency edge never can, which is why deepening the graph makes the full
build slower rather than faster.

## Building part of the tree

| Flag | Meaning |
|---|---|
| `-pl <a>,<b>` | `--projects`: build only these (path or `groupId:artifactId`) |
| `-am` | `--also-make`: **and everything they depend on** (upstream) |
| `-amd` | `--also-make-dependents`: **and everything depending on them** (downstream) |
| `-rf <m>` | `--resume-from`: restart the reactor at module `m` |
| `--fail-at-end` / `-fae` | keep going past a failed module where the graph allows |
| `-T 1C` | one build thread per core for modules the graph lets run in parallel |
| `-o` | offline — resolve only from the local repository |

```bash
# build shop-api and whatever it needs, nothing else
mvn -pl shop-api -am install

# I changed shop-domain — build it and every module that could be affected
mvn -pl shop-domain -amd test

# the reactor died at shop-service; pick up there after fixing
mvn -rf shop-service install
```

**`-am` answers "what do I need"; `-amd` answers "what did I break".** The
second is the CI affected-modules query after a diff, and it is the flag most
engineers have never used.

⚠️ `-pl X` *without* `-am` resolves X's sibling dependencies from the local
repository, not from the reactor. If `~/.m2` holds a stale
`1.4.0-SNAPSHOT` of `shop-domain` from last week's `mvn install`, you just
compiled and tested against it. This is the most common source of "it passes
for me, it fails in CI" in multi-module Maven, and it is invisible: the build
succeeds, it just built against the wrong bytes.

`--fail-at-end` is the CI counterpart. By default the reactor stops at the
first failure, so one broken module hides every other failure in the tree;
`-fae` continues into every module that does not depend on the failed one, so
a single CI run reports everything it can. Modules downstream of the failure
are skipped either way — the graph has no way to build them.

## Gotchas

**Symptom:** reordering `<modules>` to "fix the build order" changes nothing
**Cause:** the reactor sorts by declared inter-module relationships, not by the order of the `<modules>` list
**Fix:** declare the missing dependency; if order matters and no dependency exists, the coupling is real, undeclared, and usually a shared file, port or output directory

**Symptom:** `mvn -pl shop-api test` passes locally, the full build fails on the same commit
**Cause:** `-pl` without `-am` resolved `shop-domain` from `~/.m2` — a stale locally-installed snapshot — instead of building it in the reactor
**Fix:** default to `-pl X -am`; treat `mvn install`-ed snapshots in `~/.m2` as a source of ghosts, and clear the relevant directory when debugging a "works for me"

**Symptom:** Maven refuses to start the build with a cyclic-reference complaint and nothing has compiled
**Cause:** two modules depend on each other, so the graph is not acyclic and cannot be topologically sorted
**Fix:** invert one direction — declare the interface in the lower module, implement it in the higher — or extract the shared type into a module below both

**Symptom:** you split out `shop-domain` to keep it framework-free, and the framework is on its classpath anyway
**Cause:** the dependency was declared in the parent's `<dependencies>` rather than `<dependencyManagement>`, so every module inherits it
**Fix:** parents *manage* versions; modules *declare* what they use. A parent's `<dependencies>` block should be near-empty, and anything genuinely universal there (a test framework, a nullability annotation) should be a deliberate decision

**Symptom:** every release is a mechanical edit to `<parent><version>` in a dozen POMs, and one always gets missed
**Cause:** Maven 3 requires the parent version in each child
**Fix:** use `${revision}` CI-friendly versions with the flatten plugin, or let the versions/release plugin perform the edits; Maven 4's model 4.1.0 removes the requirement outright, once it is GA

## Interview questions

**★ What decides the build order in a multi-module Maven project?**
The reactor. It builds a directed acyclic graph from four declared
relationships — a dependency on another module in the build, a plugin that is
another module in the build, a plugin dependency on one, a build extension on
one — then topologically sorts it. `<modules>` is only the membership list and
its order has no effect. A cycle is unsortable, so Maven refuses the entire
build before compiling anything.

**★ Aggregator POM and parent POM — the same thing?**
No, though one file usually plays both roles. Aggregation is `<modules>` in
the aggregator pointing down: "build these together." Inheritance is
`<parent>` in the child pointing up: "take your `dependencyManagement`,
`pluginManagement`, properties and plugin config from here." A published
parent like `spring-boot-starter-parent` aggregates nothing; an aggregator can
list modules that inherit from elsewhere. Both need
`<packaging>pom</packaging>`.

**★ `-pl`, `-am`, `-amd` — when do you reach for each?**
`-pl` selects modules. `-am` adds their upstream dependencies, answering
"build what I need" — the one you want locally, because without it siblings
resolve from `~/.m2` and you can silently test against a stale snapshot.
`-amd` adds downstream dependents, answering "what did I break", which is the
CI affected-modules query after a diff. `-rf` resumes the reactor at a module
after a failure instead of restarting the whole tree.

**★ Why does putting a dependency in the parent POM defeat the point of splitting?**
Because `<dependencies>` in a parent is inherited by every child, while
`<dependencyManagement>` only pins a version for children that declare the
dependency themselves. If the reason you extracted `shop-domain` was to keep
the web framework off its compile classpath, and the framework sits in the
parent's `<dependencies>`, the boundary you built the split for does not
exist. Parents manage; modules declare.

**★ Why can adding a dependency make the whole build slower, beyond the extra jar?**
Because it adds an edge to the reactor's graph, and `-T` parallelism cannot
cross an edge. Two modules that previously built concurrently now build in
sequence, and every module downstream of the new edge is pulled into the
`-amd` blast radius of any change to the new upstream. The jar download is
the trivial part of the cost; the serialisation of the build is not.

---

← Prev: [The standard layout and resources](01-the-standard-layout.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Splitting a tree: api, service, domain](03-splitting-a-tree.md)
