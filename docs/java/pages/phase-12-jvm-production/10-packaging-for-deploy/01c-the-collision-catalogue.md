---
title: "Fifteen resource transformers exist because fifteen ecosystems' configuration files silently half-disappeared inside somebody's uber jar first — the catalogue is an incident log, and reading it that way tells you what shading actually costs"
sidebar_label: "01c · The collision catalogue"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Apache Maven Shade Plugin** documentation — "Resource
> Transformers"
> ([maven.apache.org](https://maven.apache.org/plugins/maven-shade-plugin/examples/resource-transformers.html))
> and the `shade:shade` mojo parameter reference
> ([maven.apache.org](https://maven.apache.org/plugins/maven-shade-plugin/shade-mojo.html));
> and the **Spring Boot specification**, "Executable Jar Format → Nested JARs"
> ([docs.spring.io](https://docs.spring.io/spring-boot/specification/executable-jar/nested-jars.html)).
> 🔴 **No sandbox** — no build was run. Every transformer description below is quoted from the
> plugin's own documentation; nothing is inferred from an observed run.

**[01b](01b-why-not-shading.md) covered the two collisions that have a specification behind them:
`META-INF/services`, where the `ServiceLoader` javadoc says the platform expects many files at one
path, and jar signatures, where the JAR specification says verification fails when a digest does not
match. This page is the third category, which has no specification at all — every other file two
dependencies happen to ship at the same path. There is no rule for those, only a catalogue of merge
strategies written after each one caused an outage.**


## The catalogue itself

The transformer catalogue is the argument. **These are the collisions the plugin found worth
shipping a dedicated merge strategy for**, and the length of the list is the point — each row is a
real-world file that two dependencies both ship:

| Transformer | Documented as |
|---|---|
| `ServicesResourceTransformer` | *"Relocated class names in `META-INF/services` resources and merges them."* |
| `AppendingTransformer` | *"Adds content to a resource"* |
| `XmlAppendingTransformer` | *"Adds XML content to an XML resource"* |
| `ManifestResourceTransformer` | *"Sets entries in the `MANIFEST`"* |
| `ApacheLicenseResourceTransformer` | *"Prevents license duplication"* |
| `ApacheNoticeResourceTransformer` | *"Prepares merged NOTICE"* |
| `ComponentsXmlResourceTransformer` | *"Aggregates Plexus `components.xml`"* |
| `PluginXmlResourceTransformer` | *"Aggregates Mavens `plugin.xml`"* |
| `GroovyResourceTransformer` | *"Merges Apache Groovy extends modules"* |
| `ResourceBundleAppendingTransformer` | *"Merges ResourceBundles"* |
| `PropertiesTransformer` | *"Merges properties files owning an ordinal to solve conflicts"* |
| `OpenWebBeansPropertiesTransformer` | *"Merges Apache OpenWebBeans configuration files"* |
| `MicroprofileConfigTransformer` | *"Merges conflicting Microprofile Config properties based on an ordinal"* |
| `IncludeResourceTransformer` | *"Adds files from the project"* |
| `DontIncludeResourceTransformer` | *"Prevents inclusion of matching resources"* |

🔴 **Read that table as a list of things that were each discovered the hard way.** Nobody wrote
`MicroprofileConfigTransformer` speculatively. Each entry is a framework whose configuration
silently half-disappeared in somebody's uber jar until a merge strategy was written for it.

⚠️ **And the catalogue is necessarily incomplete.** It covers the ecosystems whose users complained.
A resource format invented after the transformer that would have merged it needs a custom
transformer you write yourself — and you will not know that until the behaviour is already wrong.

**`AppendingTransformer` is the escape hatch, and it is a per-file opt-in.** You must know, in
advance, which resource paths in your dependency graph collide and want concatenation rather than
replacement. That knowledge is not derivable from the build; it comes from having been burned.

🔴 **The asymmetry with Boot's format is total.** Two jars in `BOOT-INF/lib/` can both contain the
same resource path and neither loses, because the launcher's class loader resolves resources across
the nested jars the same way the platform class loader resolves them across a class path. **There is
no merge decision, so there is no merge decision to get wrong.**

## Reading the catalogue as an incident log

**Group the fifteen by what they tell you, rather than by what they do**, and the shape of the
problem becomes visible:

- **Three merge a format the platform or a build tool defined** — `ServicesResourceTransformer`,
  `ComponentsXmlResourceTransformer` (*"Aggregates Plexus `components.xml`"*) and
  `PluginXmlResourceTransformer` (*"Aggregates Mavens `plugin.xml`"*). These are the cases where
  losing a file provably changes behaviour.
- **Three merge a *framework's* configuration** — `GroovyResourceTransformer`
  (*"Merges Apache Groovy extends modules"*), `OpenWebBeansPropertiesTransformer` and
  `MicroprofileConfigTransformer`. 🔴 **Each of these is a named ecosystem that had to be rescued
  individually**, which is the strongest available evidence that the general problem has no general
  solution.
- **Two exist purely for legal compliance** — `ApacheLicenseResourceTransformer`
  (*"Prevents license duplication"*) and `ApacheNoticeResourceTransformer`
  (*"Prepares merged NOTICE"*). ⚠️ **A shaded jar that drops one dependency's `NOTICE` file is a
  licence violation, not a bug**, and nothing in the build will mention it.
- **Two are generic escape hatches** — `AppendingTransformer` and `XmlAppendingTransformer`. They
  are the admission that the list above can never be finished.
- **`ResourceBundleAppendingTransformer` and `PropertiesTransformer`** handle the two file formats
  most likely to collide by sheer frequency: localisation bundles and `.properties` files.
- **The remaining three do not merge anything at all** — `ManifestResourceTransformer`
  (*"Sets entries in the `MANIFEST`"*), `IncludeResourceTransformer` (*"Adds files from the
  project"*) and `DontIncludeResourceTransformer` (*"Prevents inclusion of matching resources"*).
  They exist because rebuilding one archive out of many means you now own the manifest and the file
  list, jobs nobody asked for.

🔴 **`PropertiesTransformer`'s wording is the tell for the whole design**: *"Merges properties files
owning an ordinal to solve conflicts."* **An ordinal is a priority number the format itself must
define.** Where a format has no such concept — which is nearly all of them — the transformer cannot
be written generically, and you are back to appending and hoping the consumer tolerates duplicates.

## Why a licence file is the most under-rated case

**It is the only failure here that a passing test suite cannot possibly catch**, because nothing in
the application reads it.

⚠️ **`META-INF/LICENSE` and `META-INF/NOTICE` collide almost by definition** — every Apache-licensed
dependency ships them at the same two paths. In a flat archive, one wins. The Apache License
requires that a `NOTICE` file's attributions be carried into derivative distributions, and a shaded
jar is a distribution.

**Both transformers are opt-in.** A build that does not configure them produces an artefact that is
silently non-compliant, ships, and stays that way until somebody audits it.

🔴 **In a Boot jar the question is moot.** Each dependency's `LICENSE` and `NOTICE` remain inside its
own jar in `BOOT-INF/lib/`, exactly as its publisher shipped them, and any auditing tool that walks
the nested jars finds all of them.

## The general rule the catalogue implies

**When two jars ship the same path, exactly one of four things is true**, and only the first is
safe to leave alone:

1. **The content is identical.** Either copy is fine — this is most `LICENSE` files and a lot of
   trivia. Shading is harmless.
2. **The platform reads them all.** `META-INF/services` is the archetype. **Dropping one changes
   behaviour**, and a merge is not just acceptable but strictly correct.
3. **The content is genuinely alternative.** Two `application.properties`, two `logback.xml`, two
   `reference.conf` — one *is* meant to win, and on a class path the order decides. ⚠️ **Shading
   also picks a winner, but by archive-processing order rather than by class-path order**, so the
   answer can differ from what the same dependencies would do unshaded.
4. **Merging is required by something outside the JVM.** `NOTICE` is the case, and the requirement
   is legal rather than technical.

🔴 **Only case 2 is detectable by tooling, and only if you already know the format.** Cases 3 and 4
require a human who knows what the file means. That is the real cost of shading an application: not
the transformers you configure, but the audit you must repeat every time the dependency graph moves.

**That is the case against shading an application. The case *for* it — the one capability nesting
cannot replicate — plus the size optimisation that will page you at 3am, is
[01d](01d-minimizing-relocating-and-choosing.md).**

## Gotchas

**★ The transformer catalogue is a list of past incidents, not a feature matrix.**
Fifteen documented transformers exist because fifteen ecosystems' configuration files silently
half-vanished in somebody's uber jar first. Nobody wrote `MicroprofileConfigTransformer`
speculatively.

**★ 🔴 The catalogue is necessarily incomplete, and cannot be otherwise.**
It covers the ecosystems whose users complained. A resource format newer than the transformer that
would have merged it needs one you write yourself, and nothing tells you that until the behaviour is
already wrong.

**★ `AppendingTransformer` is a per-file opt-in that requires knowing the collision in advance.**
You must already know which resource paths in your dependency graph collide *and* want concatenation
rather than replacement. That knowledge is not derivable from the build.

**★ Three transformers do not merge anything — they exist because you now own the archive.**
`ManifestResourceTransformer`, `IncludeResourceTransformer` and `DontIncludeResourceTransformer`
manage the manifest and the file list, jobs that only exist because shading rebuilt one jar out of
many.

**★ 🔴 A dropped `NOTICE` file is a licence violation, and no test can catch it.**
Nothing in the application reads it. `ApacheNoticeResourceTransformer` is opt-in, so a build that
never configured it ships a non-compliant artefact indefinitely.

**★ `LICENSE` and `NOTICE` collide by construction.**
Every Apache-licensed dependency ships both at the same two paths, so any non-trivial dependency
graph has this collision whether or not anyone noticed.

**★ "Ordinal" in `PropertiesTransformer` is a property of the format, not of the plugin.**
*"Merges properties files owning an ordinal to solve conflicts."* Formats without an ordinal concept
cannot be merged by priority at all, which is why the generic answer is appending.

**★ Shading picks a winner by archive-processing order, not class-path order.**
For genuinely alternative content — two `logback.xml`, two `reference.conf` — the same dependency
set can resolve differently shaded than unshaded. The behaviour changes without anything failing.

**★ Only one of the four collision cases is machine-detectable.**
"The platform reads them all" can be recognised if you know the format. "These are alternatives" and
"merging is legally required" need a human who knows what the file means.

**★ 🔴 The asymmetry with the nested format is total, not partial.**
Two jars in `BOOT-INF/lib/` can both hold the same resource path and neither loses, because the
launcher's class loader resolves resources across nested jars the way the platform resolves them
across a class path. There is no merge decision, so there is none to get wrong.

**★ The audit is per dependency-graph-change, not per project.**
A shaded build that is correct today is correct because of today's dependency list. A version bump
can introduce a collision, and it arrives through a channel nobody reviews as a packaging change.

## Interview questions

**★ What does the Shade plugin's transformer list tell you about shading, beyond how to configure
it?**
That the general problem is unsolvable. Each transformer is a named ecosystem — Groovy, Plexus,
Maven, OpenWebBeans, MicroProfile — that had to be rescued individually after its configuration
silently half-disappeared inside someone's uber jar. If a general merge strategy existed, the list
would have one entry instead of fifteen, and it would not need two generic appending transformers as
escape hatches.

**★ Beyond correctness, what legal exposure does shading create?**
Every Apache-licensed dependency ships `META-INF/LICENSE` and `META-INF/NOTICE` at the same paths,
so in a flat archive one wins and the rest are dropped. The Apache License requires `NOTICE`
attributions to be carried into derivative distributions, and a shaded jar is a distribution. The
transformers that fix this are opt-in, and no test can detect the problem because nothing in the
application reads those files.

**★ Two dependencies ship the same resource path. How do you decide whether it matters?**
Ask which of four cases it is. If the content is identical, it does not matter. If the platform
reads all of them — `META-INF/services` is the archetype — dropping one changes behaviour and
merging is strictly correct. If they are genuinely alternative, like two `logback.xml`, one was
always going to win, but shading picks by archive order rather than class-path order, so the answer
can differ from unshaded. And if merging is required by a licence rather than by the JVM, no
technical check will ever flag it.

**★ Why can a shaded application behave differently from the same dependencies on a class path, even
when nothing errors?**
Because for alternative-content resources the class path resolves by order and shading resolves by
archive-processing order. Both pick exactly one file, but not necessarily the same one. The
application starts, nothing fails, and some configuration is simply the other dependency's.

**★ What is the maintenance cost of a correctly-configured shaded build?**
An audit of the dependency graph for new collisions, repeated on every upgrade. The configuration is
correct with respect to a dependency list, not with respect to the project, and there is no
build-time signal when a version bump introduces a path that now collides. That recurring, silent,
easily-skipped audit is the actual cost — not the transformers themselves.

**★ Someone proposes writing a custom transformer for a framework the catalogue does not cover. What
do you want to know first?**
Whether the format has any notion of precedence — an ordinal, an order key, anything the format
itself defines. `PropertiesTransformer` can resolve conflicts only because some properties formats
carry an ordinal. Without one, the transformer can concatenate but cannot resolve, so the real
question is whether the consuming framework tolerates duplicate entries.

{/* FOOTER */}
