---
title: "Reading the tree, and overriding it"
sidebar_label: "2 · Reading and overriding"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the maven-dependency-plugin **3.11.0**
> documentation (`tree` mojo parameters `verbose`, `includes`, `excludes`,
> `scope`, `outputType`; *Filtering the Dependency Tree* for the pattern
> syntax) and the 3.1.2 archived *Resolving conflicts using the dependency
> tree* page for the verbose annotations and the MDEP-494 removal history; the
> Maven POM reference (version ranges, soft vs hard requirements,
> `<exclusions>` semantics); and the Maven guide *Introduction to the
> Dependency Mechanism* (dependency management precedence). Maven 3.9.16.

**Every wrong-version incident has the same first command, and it is not
`rm -rf ~/.m2`. `mvn dependency:tree` prints the graph Maven actually resolved;
`-Dverbose` additionally prints the candidates it *discarded* and why. Once you
can see that, the fix is a choice between three mechanisms with sharply
different blast radii — an exclusion deletes an edge, a direct declaration
exploits depth, and a managed version overrides mediation outright. Only the
last one is deterministic.**

## `dependency:tree` — the first command, always

```bash
# the resolved graph, as shipped
mvn dependency:tree

# plus every candidate mediation discarded, and why
mvn dependency:tree -Dverbose

# narrow to one artifact — the only usable form on a real project
mvn dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core:jackson-databind

# only what the runtime classpath will contain
mvn dependency:tree -Dscope=runtime

# machine-readable, for diffing across a change
mvn dependency:tree -DoutputType=json -DoutputFile=tree.json
```

The filter pattern is `[groupId]:[artifactId]:[type]:[version]`, every segment
optional, with full and partial `*` wildcards — an empty segment is an implicit
wildcard. So `-Dincludes=org.apache.*` catches a whole group and
`-Dexcludes=:::*-SNAPSHOT` drops every snapshot. `-Dincludes` keeps the paths
*to* a matching artifact, which is what makes it the right tool: on a Spring
Boot service the unfiltered tree is hundreds of lines and the ten you need are
the ones leading to the artifact in question.

**Without `-Dverbose` the tree only shows you winners.** Verbose is documented
as *"whether to include omitted nodes in the serialized dependency tree"* — the
losers — and it annotates each with the reason: omitted for being a
**duplicate** of another, for **conflicting** with another's version or scope,
or for introducing a **cycle**. The annotation you are hunting reads like
`(commons-collections:commons-collections:jar:2.1:compile - omitted for
conflict with 2.0)`, and it tells you both which version lost and where it came
from — which together are the whole diagnosis.

⚠️ **A history worth knowing**, because search results still carry it: verbose
support was *removed* in maven-dependency-plugin 3.0 (MDEP-494), and the
documentation of that era told you to invoke the 2.10 plugin by full coordinate
to get it back. It is a normal parameter again in the current 3.11.0 plugin, so
`mvn dependency:tree -Dverbose` is the command — but if you land on an old
answer telling you to run
`org.apache.maven.plugins:maven-dependency-plugin:2.10:tree`, that is why.

Gradle's equivalents are `./gradlew dependencies --configuration runtimeClasspath`
for the graph and `./gradlew dependencyInsight --dependency <name> --configuration
runtimeClasspath` for the "why is this version here" question — the latter has
no direct Maven analogue and explains the selection reason rather than just the
shape.

## Three ways to override, ranked by blast radius

### 1. `<exclusions>` — delete an edge

```xml
<dependency>
  <groupId>com.acme</groupId>
  <artifactId>legacy-client</artifactId>
  <version>4.2.0</version>
  <exclusions>
    <exclusion>
      <groupId>commons-logging</groupId>
      <artifactId>commons-logging</artifactId>
    </exclusion>
  </exclusions>
</dependency>
```

Wildcards are allowed — `<groupId>*</groupId><artifactId>*</artifactId>` strips
every transitive dependency of that one declaration, which is occasionally what
you want and usually a sign you should not be depending on it.

**When exclusions are the right fix:** you want the artifact *gone*, not
re-versioned. Classic cases are the SLF4J bridge pattern (exclude
`commons-logging`, add `jcl-over-slf4j` so calls are redirected rather than
dropped) and a transitive logging implementation fighting your chosen one.

**When exclusions are the wrong fix, which is more often:**

- **They are per-edge, not global.** The POM reference is explicit: an
  exclusion removes paths to an artifact *from that one dependency*, and *"if
  the same artifact appears as a direct or transitive dependency elsewhere, it
  can still be added"*. Five paths reach the artifact, you need five
  `<exclusions>` blocks, and the sixth arrives with next quarter's upgrade.
- **They delete instead of choosing.** If the intent is "everyone should use
  2.16", an exclusion says "not through here" and leaves mediation to pick
  from whatever remains. A managed version says what you meant.
- **They fail loudly later.** Excluding something a library genuinely calls
  produces `NoClassDefFoundError` at the first use of that path — the same
  runtime-only failure shape as the mediation problem you were fixing.
- **They rot silently.** When the upstream restructures, the exclusion targets
  a coordinate nobody produces any more. It does not warn; it just stops doing
  anything.

### 2. A direct declaration — exploit depth

Declaring the artifact in your own POM puts it at depth 1, and nearest-wins
makes depth 1 unbeatable. It works, it is one line, and it is what most people
do first. The cost: you now have a `<dependency>` your code does not import,
which `dependency:analyze` will flag as *unused declared*, and which the next
person will delete during a cleanup because it looks like dead weight.

### 3. `<dependencyManagement>` — override mediation itself

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>2.18.2</version>
    </dependency>
  </dependencies>
</dependencyManagement>
```

This is the deterministic one, and the precedence is documented:
*"Dependency management takes precedence over dependency mediation for
transitive dependencies, and a project's own declaration takes precedence over
its parent's declaration."* Wherever that artifact appears in the graph, at any
depth, by any path, it resolves to 2.18.2.

Two properties people miss:

- **It does not add a dependency.** `<dependencyManagement>` states *if this
  artifact is used, use this version*. Nothing appears on the classpath until
  something actually depends on it. That is exactly why it is safe to manage a
  hundred artifacts you do not use — and it is what makes BOMs possible
  ([chunk 3](03-boms-and-platforms.md)).
- **It does not reach plugins.** The guide notes it *"won't affect the
  (transitive) dependencies of any plugins used in the same effective POM"* —
  plugin dependencies are managed separately under `<pluginManagement>`. A
  managed version that "isn't taking effect" is often a plugin's classpath, not
  the project's.

## Version ranges, and why nobody uses them

The syntax exists and is fully specified:

| Notation | Meaning |
|---|---|
| `1.0` | **soft** — use 1.0 unless mediation finds another first |
| `[1.0]` | hard — exactly 1.0, nothing else |
| `[1.2,1.3]` | any version from 1.2 to 1.3, inclusive |
| `[1.0,2.0)` | 1.0 inclusive to 2.0 exclusive |
| `[1.5,)` | 1.5 or anything above |
| `(,1.0],[1.2,)` | 1.0 or below, or 1.2 or above |
| `(,1.1),(1.1,)` | anything except 1.1 — the documented way to blacklist a bad release |

And essentially nobody uses them in production POMs, for reasons worth stating
rather than repeating as folklore:

- **The build stops being reproducible.** A range resolves against repository
  metadata at build time, so the same commit produces different artifacts on
  different days. Bisecting a regression becomes guesswork.
- **Any upstream release can break you without a commit.** A publisher's bad
  afternoon becomes your red build, and the offending change is not in your
  history.
- **They are hard requirements, and hard requirements can be unsatisfiable.**
  Two ranges in a large graph that do not intersect fail the build outright —
  in code you do not own, with no obvious owner for the fix.
- **They cost network round-trips** for metadata on every affected artifact.

The one legitimate use is the last row of the table: excluding a known-bad
version while remaining open about the rest. Even there, a managed version plus
an Enforcer rule (chunk 3) says the same thing without surrendering
reproducibility. Gradle offers ranges and dynamic versions (`5.+`,
`latest.release`) too, and its documentation gives the same warning —
unreproducible builds — with **dependency locking** as the mitigation Maven has
no built-in equivalent for.

## Gotchas

**Symptom:** `mvn dependency:tree` shows one version and you are certain another one is on the classpath
**Cause:** you read the default output, which prints winners only. The competing version was mediated away and is simply not in that listing
**Fix:** `mvn dependency:tree -Dverbose -Dincludes=<groupId>:<artifactId>` — the omitted node and its "omitted for conflict with" annotation is the answer

**Symptom:** the unfiltered `dependency:tree` output is hundreds of lines and nobody can find anything in it
**Cause:** you are reading the whole graph when you have one artifact in question
**Fix:** always filter — `-Dincludes` keeps only paths leading to matches, and the pattern's segments are optional with wildcards, so `-Dincludes=jackson-databind` alone works

**Symptom:** you add an `<exclusion>` and the unwanted jar is still in the build
**Cause:** exclusions are per-declaration. The POM reference is explicit that an artifact reached through some other dependency can still be added; you closed one of several paths
**Fix:** find every path with `-Dverbose -Dincludes=...` and exclude on each — or stop excluding and set a managed version, which is path-independent

**Symptom:** an exclusion "fixes" the build and the service throws `NoClassDefFoundError` on one endpoint a week later
**Cause:** the excluded artifact was genuinely used by the library you excluded it from. Removing a jar from the classpath is not the same as resolving a version conflict
**Fix:** exclude only when the artifact is truly unwanted (and supply a bridge if the calls must still work, as with `jcl-over-slf4j`); when the intent is a version, use `<dependencyManagement>`

**Symptom:** an exclusion silently stops having any effect after an upstream upgrade
**Cause:** the upstream renamed or relocated the artifact, so the exclusion's coordinates match nothing. Maven does not warn about an exclusion that excludes nothing
**Fix:** re-verify exclusions with `dependency:tree` after any major upgrade, and prefer managed versions, which fail visibly rather than becoming inert

**Symptom:** a `<dependencyManagement>` entry appears to be ignored
**Cause:** usually one of three things — the artifact reaches you under different coordinates (a relocation, a `-jakarta` classifier, a different groupId after a rename); a nearer `<dependencies>` declaration in your own POM is overriding it; or the classpath in question belongs to a *plugin*, which `<dependencyManagement>` does not touch
**Fix:** confirm the exact coordinates in `dependency:tree`, and use `<pluginManagement>` for plugin classpaths

**Symptom:** a range like `[1.5,)` picked up a major upgrade overnight and CI went red on an untouched commit
**Cause:** ranges resolve against live repository metadata at build time, so a new upstream release changes your build with no change of yours
**Fix:** pin a concrete version in `<dependencyManagement>`; if the goal was to avoid one bad release, blacklist it with `(,1.1),(1.1,)` or an Enforcer rule rather than opening the upper bound

**Symptom:** two independent libraries declare overlapping ranges and the build fails with "no version available" before compiling anything
**Cause:** ranges are hard requirements. When their intersection is empty, Maven refuses to choose — this is the one case where mediation gives up instead of picking
**Fix:** override with a managed version, which takes precedence over mediation for transitive dependencies, and raise it upstream so the ranges stop conflicting

## Interview questions

**★ A library is at the wrong version. What is your first command, and what exactly do you look for?**
`mvn dependency:tree -Dverbose -Dincludes=<groupId>:<artifactId>`. `-Dincludes`
narrows a several-hundred-line graph to the paths that reach the artifact, and
`-Dverbose` adds the nodes mediation discarded, annotated with the reason
(duplicate, version/scope conflict, cycle). What you are reading for is the
`omitted for conflict with` line: it names the losing version *and* the path it
arrived on, which together tell you whether to raise a pin, add an exclusion,
or fix an upstream declaration.

**★ Rank exclusions, a direct declaration, and `<dependencyManagement>` as fixes.**
`<dependencyManagement>` first: it takes precedence over mediation for
transitive dependencies, applies at every depth on every path, and states the
intent ("this artifact is version X here"). A direct declaration second: it
works via the depth-1 rule but leaves a dependency your code does not import,
which tooling will flag and someone will later delete. Exclusions last, and
only when the artifact should be *absent* rather than re-versioned — they are
per-edge, need repeating for every path, and go inert without warning when
upstream coordinates change.

**★ Does `<dependencyManagement>` put anything on the classpath?**
No. It only says *if this artifact is used, use this version* — nothing appears
until something actually depends on it. That is what makes it safe to manage
hundreds of artifacts you do not use, and it is the entire basis of the BOM
mechanism. It also does not apply to plugin classpaths, which are managed under
`<pluginManagement>`; a managed version that seems to be ignored is frequently
a plugin dependency.

**★ Why does the community avoid version ranges when Maven fully supports them?**
Because they trade reproducibility for currency. A range resolves against live
repository metadata at build time, so the same commit builds differently on
different days and an upstream release can break CI with no change of yours.
They are also hard requirements, so two non-intersecting ranges anywhere in the
graph fail the build in code you do not own. The one defensible use is
excluding a known-bad version — `(,1.1),(1.1,)` — and even that is better
expressed as a pinned version plus an Enforcer rule.

**★ Someone excluded a transitive jar and the app now throws `NoClassDefFoundError`. What went wrong conceptually?**
They treated a *version* problem as a *presence* problem. An exclusion deletes
an edge; it does not choose a version. The library still calls the classes it
always called, and now none are on the classpath, so the JVM fails at the first
call site that touches them. If the artifact really must go, its calls need
somewhere to land — the `commons-logging` → `jcl-over-slf4j` bridge is the
canonical pattern. If the intent was "everyone use 2.16", the fix was a managed
version all along.

---

← Prev: [The graph, and who wins](01-the-graph-and-who-wins.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [BOMs and platforms](03-boms-and-platforms.md)
