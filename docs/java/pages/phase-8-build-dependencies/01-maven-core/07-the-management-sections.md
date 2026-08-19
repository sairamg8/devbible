---
title: "The management sections"
sidebar_label: "7 · The management sections"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven POM Reference
> (maven.apache.org/pom.html — `<pluginManagement>`,
> `<dependencyManagement>`, import scope), the Maven guide to the
> dependency mechanism (`<scope>import</scope>` with `<type>pom</type>`),
> the Maven lifecycle guide (default bindings by packaging), and
> "What's new in Maven 4" (the Super POM plugin-version warning, `bom`
> packaging, `-Dmaven.plugin.validation=verbose`,
> `--fail-on-severity`).

**Maven has two sections whose entire job is to say "*if* this is used,
here is how" without using anything. `<pluginManagement>` configures
plugins without enabling them; `<dependencyManagement>` fixes versions
and scopes without adding anything to a classpath. They are what makes a
parent POM a *policy* instead of a pile of shared baggage — and a POM
that puts the wrong thing in the wrong box is the single most common
structural defect in a Java repository, because both mistakes look
harmless in the file where they are written.**

## The four boxes

|  | Declares policy only | Actually applies |
|---|---|---|
| **Build extensions** | `<pluginManagement>` | `<build><plugins>` |
| **Classpath artifacts** | `<dependencyManagement>` | `<dependencies>` |

Read any unfamiliar POM by asking, block by block, which box you are in.
The left column belongs in a parent; the right column belongs in the
module that actually needs the thing. Most confused POMs are one
mis-boxed entry.

## `<pluginManagement>` vs `<plugins>`

```xml
<build>
  <pluginManagement>        <!-- CONFIGURES, does not enable -->
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.4</version>
        <configuration><argLine>-Xmx1g</argLine></configuration>
      </plugin>
    </plugins>
  </pluginManagement>

  <plugins>                 <!-- ENABLES, inheriting the config above -->
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-surefire-plugin</artifactId>
    </plugin>
  </plugins>
</build>
```

`<pluginManagement>` in a parent says "*if* a module uses this plugin,
these are the version and settings". `<plugins>` says "use it here".
The pairing is the whole reason both exist: the parent standardises,
each module opts in, and the opt-in is visible in the module's own POM.

The subtlety that catches people: a plugin bound by *default* for your
packaging — surefire, compiler, jar, install, deploy — runs whether or
not it appears in `<plugins>`, and `<pluginManagement>` still configures
it. The block above changes the heap of the default `surefire:test`
execution even with the `<plugins>` entry deleted.
**`<pluginManagement>` is not inert for lifecycle-bound plugins; it is
inert only for plugins that nothing has bound.** That asymmetry is why
"management does nothing on its own" is a half-truth that leads people
to duplicate entries they did not need.

## 🔴 Pin every plugin version, here

An unpinned plugin takes its version from the Super POM inside the Maven
distribution ([chunk 3](03-effective-pom-and-properties.md)). Upgrade
the Maven binary — or run on a CI agent with a different one — and your
build changes with no commit anywhere. It is the same reproducibility
argument as pinning dependency versions, and it is weaker only in that
the symptom appears later and looks like something else.

Maven 4 now **warns** when a build relies on a Super POM plugin version,
which is as close to an official admission as you will get that the
defaults were a convenience, not a contract. Put every version in the
root POM's `<pluginManagement>`, including the ones you never mention
elsewhere — jar, install, deploy, resources, surefire, compiler — and
the build stops being a function of which Maven ran it.

## `<dependencyManagement>` vs `<dependencies>`

The dependency-side analogue, and the difference is exact:

```xml
<dependencyManagement>      <!-- VERSIONS, adds nothing to any classpath -->
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>2.22.0</version>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>              <!-- ADDS, taking the version from above -->
  <dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
  </dependency>
</dependencies>
```

`<dependencyManagement>` states "*if* this artifact appears anywhere in
this project's graph, this is its version and scope". It has **no
classpath effect at all**, which is precisely why it is the correct home
for a parent's version decisions
([chunk 2](02-inheritance-and-aggregation.md)) and why putting the same
entries in the parent's `<dependencies>` is a different and much worse
thing.

Two consequences worth being exact about:

1. **It also pins transitives.** A managed version wins over one pulled
   in by another library's POM, which makes `<dependencyManagement>` the
   sanctioned way to force a Jackson or Netty version across a whole
   graph without scattering `<exclusions>`. It is a blunt instrument —
   you are overriding what a library said it was tested against — but it
   is the instrument the ecosystem uses, and it is how CVE remediation
   is normally done under time pressure.
2. **A BOM is imported here.** `<scope>import</scope>` with
   `<type>pom</type>` merges another project's entire
   `<dependencyManagement>` into yours:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>2.22.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

That is how Spring Boot pins hundreds of versions consistently without
making you inherit from its parent. Import scope is legal **only** inside
`<dependencyManagement>` and needs both elements. [Transitive
dependencies and mediation](../03-transitive-and-mediation/README.md), topic 03, takes BOMs,
mediation and exclusions to the bottom; Maven 4 adds a dedicated `bom`
packaging so tooling can finally tell a BOM apart from a parent.

## When management is the wrong answer

Two honest limits.

**Managed versions key on `groupId:artifactId` and nothing else.** If an
artifact reaches your graph under a relocated groupId, a different
classifier, or shaded inside someone else's jar, no amount of
`<dependencyManagement>` will touch it — you will pin a version, run
`dependency:tree`, and find the old one still there under a name you did
not expect.

**A parent that manages everything becomes a bottleneck.** Every version
bump is a change to a shared file, every module waits for it, and the
POM grows into a several-hundred-line ledger nobody reviews properly. At
that size, a BOM you publish separately — versioned, released, imported
by choice — is the better shape, because a module can import version
`3.2` while another still imports `3.1` during a migration. Inheritance
cannot express that; import can.

## Gotchas

**Symptom:** a plugin declared in the parent's `<pluginManagement>` never runs in the children
**Cause:** `<pluginManagement>` configures, it does not enable — and nothing bound that goal
**Fix:** add the plugin (version-less) to the child's `<plugins>`; for lifecycle-bound plugins like surefire no entry is needed and the management block already applies

**Symptom:** the build behaves differently after upgrading the Maven binary, with no commit
**Cause:** an unpinned plugin resolving its version from the Super POM in the distribution
**Fix:** pin every plugin version in the root POM's `<pluginManagement>`; on Maven 4, heed the new warning and consider `--fail-on-severity WARN`

**Symptom:** `<dependencyManagement>` in the parent appears to have no effect
**Cause:** it never adds anything — a module must still declare the dependency, version-less, to receive it
**Fix:** that is the design. If you meant "every module gets this", you meant `<dependencies>`, and you should reconsider ([chunk 2](02-inheritance-and-aggregation.md))

**Symptom:** a BOM import is ignored
**Cause:** missing `<type>pom</type>` or `<scope>import</scope>`, or the entry was placed in `<dependencies>` rather than `<dependencyManagement>`
**Fix:** import scope is only legal inside `<dependencyManagement>` and requires both elements

**Symptom:** a version forced in `<dependencyManagement>` still loses to a transitive one
**Cause:** the artifact reaches the graph under different coordinates — a relocated groupId, a different classifier, or a shaded copy inside another jar
**Fix:** `dependency:tree` to see what actually resolved; managed versions cannot reach across a rename, and a shaded copy is invisible to the resolver entirely

**Symptom:** two BOMs are imported and one of them silently loses
**Cause:** managed entries are merged in declaration order and the first declaration of a given GA wins
**Fix:** order imports deliberately, put your own overrides *before* the BOMs you import, and verify with `dependency:tree` rather than assuming

**Symptom:** a child module cannot override a version the parent manages
**Cause:** it can — a `<version>` on the module's own `<dependency>` beats the managed one — but a *transitively* pulled version still does not
**Fix:** declare the dependency directly with the version you want; direct declarations beat managed values, and managed values beat transitives

**Symptom:** the root POM has grown to 400 lines of managed versions and every bump blocks on review
**Cause:** management by inheritance forces a single shared file and a single shared cadence
**Fix:** extract a published BOM that modules import by version, so a migration can proceed module by module

## Interview questions

**★ `<pluginManagement>` vs `<plugins>`?**
`<pluginManagement>` declares versions and configuration *without*
enabling anything; `<plugins>` enables. The pairing lets a parent
standardise while each module opts in visibly. The exception worth
knowing: plugins bound by default for your packaging run regardless, and
`<pluginManagement>` configures those too.

**★ `<dependencyManagement>` vs `<dependencies>`?**
`<dependencyManagement>` fixes version and scope for anything appearing
in the graph and adds nothing to any classpath; `<dependencies>` adds.
That is why a parent should manage and modules should declare — and why
a managed version also pins transitives, which is how you force a
library version across a graph without scattering exclusions.

**★ Why must every plugin version be pinned?**
An unpinned plugin takes its version from the Super POM inside the Maven
distribution, so upgrading Maven — or running on a CI agent with a
different one — silently changes the build. Maven 4 warns about it now.
Pin them all in the root `<pluginManagement>`, including the ones you
never configure.

**★ Someone says "management sections do nothing on their own". Is that true?**
For dependencies, yes. For plugins it is a half-truth: plugins bound by
default for your packaging run whether or not they appear in
`<plugins>`, so `<pluginManagement>` changes the behaviour of the
default `compile`, `test` and `package` executions with no `<plugins>`
entry anywhere.

**★ What is a BOM, mechanically, and where must the import go?**
A `pom`-packaged artifact whose `<dependencyManagement>` lists versions.
You import it with `<type>pom</type><scope>import</scope>` **inside your
own `<dependencyManagement>`** — import scope is legal nowhere else. It
merges that project's managed versions into yours, which is how Spring
Boot pins hundreds of libraries without you inheriting its parent.

**★ Parent inheritance or a published BOM — when do you choose which?**
Inheritance when you own every module and want one cadence: it is
simpler and gives you plugin configuration as well. A published BOM when
consumers should choose *when* to adopt a version set — including your
own modules during a staged migration, where one imports `3.2` while
another still imports `3.1`. Inheritance cannot express that.

**★ You pin a version in `<dependencyManagement>` and `dependency:tree` still shows the old one. What are the possibilities?**
The artifact arrives under different coordinates — a relocated groupId
or a different classifier, neither of which a managed entry matches — or
it is shaded inside another jar, where the resolver cannot see it at
all. A third possibility is a competing managed entry from an imported
BOM declared earlier.

**★ Why is putting shared dependencies in the parent's `<dependencies>` worse than managing them?**
Because it is unconditional: every module gets them on its classpath
whether it needs them or not, and the module's own POM gives no hint.
Management keeps the version decision central and the *usage* decision
local, which is the only arrangement that survives a repository growing
past a handful of modules.

---

← Prev: [Plugins vs dependencies](06-plugins-vs-dependencies.md) · Index: [Maven core](README.md) · Next → [The plugins every build has](08-the-plugins-every-build-has.md)
