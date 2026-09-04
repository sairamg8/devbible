---
title: "Relocation is the one thing shading does that a nested jar cannot, `minimizeJar` is the one thing it does that will page you at 3am, and between them they decide whether your artefact should be shaded or nested"
sidebar_label: "01d · Minimize, relocate, choose"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Apache Maven Shade Plugin** `shade:shade` mojo parameter
> reference ([maven.apache.org](https://maven.apache.org/plugins/maven-shade-plugin/shade-mojo.html))
> and its FAQ ([maven.apache.org](https://maven.apache.org/plugins/maven-shade-plugin/faq.html));
> and the **Spring Boot reference documentation**, "Packaging → Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)) and the
> **Spring Boot specification**, "Executable Jar Format → Nested JARs"
> ([docs.spring.io](https://docs.spring.io/spring-boot/specification/executable-jar/nested-jars.html)).
> 🔴 **No sandbox** — no build was run, and no image size or startup timing below is a measurement.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[01b](01b-why-not-shading.md) and [01c](01c-the-collision-catalogue.md) made the case against
shading an application. This page finishes it honestly: the size optimisation people reach for
alongside shading and why it is the most production-dangerous setting in the plugin, the one
capability shading has that nesting genuinely cannot replicate, two Shade defaults that surprise
everybody, and the decision rule that follows from all of it.**

## `minimizeJar` — the second silent failure

Shading is often paired with size reduction, which introduces its own class of runtime-only
breakage:

> *"When true, dependencies will be stripped down on the class level to only the transitive hull
> required for the artifact."*

The documentation attaches an honest caveat, in the plugin's own words:

> *"This feature uses jdependency. Its accuracy therefore depends on jdependency's limitations."*

🔴 **The governing limitation is that "required" is computed by static analysis, and reflection is
not static.** A class named only in a `META-INF/services` file, in a Spring configuration, in an
annotation processed at runtime, or in a `Class.forName` string is unreachable to a byte-code
reachability walk. It gets stripped, and the failure surfaces as `ClassNotFoundException` on some
code path that the smoke test did not exercise.

⚠️ **This is the packaging bug most likely to reach production**, because it is load-bearing on
*which* code path runs. The startup path is exercised in CI; the error-handling path, the
alternative codec, the second database dialect are not.

## Being fair: what shading is genuinely better at

**Relocation is a real capability that Boot's format simply does not have**, and it is the honest
reason to reach for shading:

> *"Packages to be relocated. For example: `org.apache` → `hidden.org.apache`"*

🔴 **This is the answer to the diamond dependency problem**, and there is no other answer at
packaging time. If your library needs Guava 33 and your consumer needs Guava 21, relocating your
copy into a private package means both exist without either overriding the other. **A nested jar
cannot do this** — nesting preserves the archives, but the class *names* inside them are unchanged,
so two versions of the same package still collide on the class path.

**The rule of thumb that follows:**

- 🔴 **Writing a library that others put on their class path** → shading, with relocation, is
  correct. You are protecting your consumers from your own dependency choices.
- 🔴 **Writing an application that you deploy** → nesting is correct. You own the whole class path,
  nothing downstream can conflict with you, and relocation buys nothing while the collision risks
  above cost real incidents.

⚠️ **A CLI tool sits in between.** It is deployed like an application but distributed like a
library, and if it will run alongside somebody else's classes, relocation may still earn its keep.

## Two Shade behaviours that surprise people

**`createDependencyReducedPom` defaults to `true`:**

> *"Flag whether to generate a simplified POM for the shaded artifact. If set to `true`,
> dependencies that have been included into the uber JAR will be removed from the `<dependencies>`
> section of the generated POM. The reduced POM will be named `dependency-reduced-pom.xml` and is
> stored into the same directory as the shaded artifact."*

⚠️ **It also writes a temporary `dependency-reduced-pom.xml` into the project basedir**, which
appears in `git status` and gets committed by an unwary `git add -A`. It is a build output living
next to source.

**Shading twice compounds:**

> *"By default, shade replaces with original jar with the result of shading. So, when a `pom.xml`
> includes two shades, the second shade execution will (by default) start from the result of the
> first shade execution."*

🔴 **The second execution shades the already-shaded jar**, not the original. Two independent uber
jars require giving the first a different output name — the default is chaining, not branching.

## Where this leaves the Boot jar

**The launcher in [01](01-the-fat-jar.md) is the price of admission for avoiding every failure in
[01b](01b-why-not-shading.md), [01c](01c-the-collision-catalogue.md) and this page.** It is a real cost — a nested-jar class loader, a small startup penalty, a format that
needs `-Djarmode=tools ... extract` to undo — and it buys the removal of an entire category of
build-time decisions that fail at runtime.

🔴 **The trade is: pay a known, bounded, measurable cost at startup, instead of an unknown,
unbounded, silent cost at some later point in the application's life.** Every argument across these
three pages reduces to that sentence.

**Layering, which is what turns the nested format from a merely-safe choice into a fast one, is
next: `layers.idx`, the Docker cache and the extract step are `02-layered-jars.md`** *(not written
yet)*.

## Gotchas

**★ 🔴 `minimizeJar` cannot see reflection, and the docs concede it obliquely.**
*"This feature uses jdependency. Its accuracy therefore depends on jdependency's limitations."* A
class reached only through `Class.forName`, a service file, a Spring bean definition or an
annotation processed at runtime is invisible to static reachability and gets stripped.

**★ `minimizeJar` breakage hides on cold code paths.**
Startup is exercised in CI; the fallback codec, the second dialect and the error-handling branch are
not. It is the packaging bug most likely to reach production, and it surfaces during an incident.

**★ `entryPoints` exists because the default roots are not enough.**
The documentation points at it *"if you wish to further optimize JAR minimization"* — which is also
the admission that you may have to tell the analysis where to start. If you are naming entry points
by hand, you are doing the reachability analysis the tool could not.

**★ 🔴 Relocation is shading's real superpower and nesting has no equivalent.**
Nesting preserves archives but not class *names*, so two versions of one package still collide on
the class path. Only rewriting the names solves the diamond problem at packaging time.

**★ Relocation and `META-INF/services` must be configured together.**
`ServicesResourceTransformer` rewrites relocated names inside service files. Relocating without it
leaves service files naming classes that no longer exist — see [01b](01b-why-not-shading.md).

**★ Relocation `includes` are newer than the parameter itself.**
*"Support for includes exists only since version 1.4."* A relocation config copied from an old
answer may silently relocate more than intended on an old plugin version.

**★ The library/application split is the actual decision rule.**
Publishing onto someone else's class path → shade and relocate, because you are protecting consumers
from your dependency choices. Deploying something you own end to end → nest, because relocation buys
nothing and the silent failures are pure cost.

**★ A CLI tool is the genuinely ambiguous case.**
Deployed like an application, distributed like a library. If it will ever run alongside classes you
do not control, relocation may still earn its keep.

**★ `createDependencyReducedPom` is on by default and writes into your source tree.**
`dependency-reduced-pom.xml` lands in the project basedir, appears in `git status`, and gets
committed by an unwary `git add -A`. It is a build output living next to source.

**★ The reduced POM changes what consumers resolve, which is the point and the trap.**
*"Dependencies that have been included into the uber JAR will be removed from the `<dependencies>`
section."* Correct for a shaded artefact; wrong the moment someone consumes the *unshaded*
classifier and finds the dependency list gone.

**★ 🔴 A second `shade` execution starts from the first one's output.**
*"The second shade execution will (by default) start from the result of the first shade
execution."* Chaining, not branching — two independent uber jars need the first to write a different
output name.

**★ `shadedArtifactAttached` decides whether the uber jar replaces your artefact.**
*"If false, the shaded jar will be the main artifact of the project."* The default replacement is
why the second-execution chaining happens at all, and why a consumer of your `groupId:artifactId`
may be getting the uber jar without knowing.

**★ Boot's `repackage` goal is not shading and shares none of this.**
It rewrites your jar into the nested layout with a launcher. No dependency is unpacked, so no
transformer, filter, relocation or minimisation setting exists to get wrong.

## Interview questions

**★ Is there anything shading does that a Boot jar cannot?**
Yes — relocation. Rewriting `org.apache` to `hidden.org.apache` lets your copy of a dependency
coexist with a different version of the same dependency, which is the only packaging-time answer to
the diamond problem. Nesting preserves the archives but not the class names, so two versions of one
package still collide. That is precisely why libraries shade and applications nest.

**★ When would you choose shading over Boot's format?**
When the artefact goes onto somebody else's class path — a library, or a CLI that runs alongside
code you do not control. There, relocation protects your consumers from your dependency choices and
is worth the collision risk you take on. For an application you deploy, you own the whole class
path, relocation buys nothing, and the silent failure modes are pure cost.

**★ What is wrong with `minimizeJar`?**
It computes "required" by static reachability analysis, and the plugin documents that its accuracy
is bounded by jdependency's limitations. Anything reached reflectively — `Class.forName`, a service
file, a Spring bean definition, an annotation processed at runtime — is invisible to that analysis
and gets stripped. The result is a `ClassNotFoundException` on whichever code path was not exercised
in CI, which is exactly the set of paths that matter during an incident.

**★ If you must use `minimizeJar`, how do you reduce the risk?**
Declare the reflective roots explicitly through `entryPoints`, which the documentation offers for
exactly this, and treat every framework that instantiates by name — service loaders, DI containers,
serialisation libraries — as an entry point rather than assuming the walk will find it. Then
exercise the cold paths in a test, because the ones CI never runs are the ones minimisation
silently removed. The honest answer is that you are compensating for an analysis that cannot see
what your application actually does.

**★ Someone shows you a `pom.xml` with two `shade` executions producing two uber jars. What do you
check?**
Whether the second one is shading the original jar or the first one's output. The plugin's default
is that shading replaces the original artefact, so a second execution starts from the first
execution's result — it chains rather than branches. Producing two independent uber jars requires
giving the first a different output name.

**★ Why does `dependency-reduced-pom.xml` exist, and when is it wrong?**
Because a consumer of a shaded artefact must not also resolve the dependencies already inside it,
so the plugin publishes a POM with those entries removed. It is wrong the moment the same
coordinates can be consumed unshaded — the dependency list a consumer needs is now missing, and the
file itself lands in the project basedir where it looks like source.

**★ Summarise the whole shading-versus-nesting argument in one sentence.**
Shading trades a set of silent, runtime, dependency-graph-dependent failures for the ability to
rename packages; nesting trades a small, known, measurable startup cost for the elimination of that
entire failure class — so you shade when you need renaming and nest when you do not.

{/* FOOTER */}
