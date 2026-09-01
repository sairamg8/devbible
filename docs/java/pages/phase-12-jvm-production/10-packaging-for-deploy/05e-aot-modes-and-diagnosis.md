---
title: "-XX:AOTMode has five values and the JDK tells you which one belongs in production and which one is a debugging aid, because an AOT cache can silently decline to load for a dozen legitimate reasons — and the only honest way to know whether yours loaded is -Xlog:aot"
sidebar_label: "05e · AOT modes and diagnosis"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — the `-XX:AOTMode`,
> `-XX:+AOTClassLinking`, `-XX:AOTCache`, `-XX:AOTConfiguration` entries and the "Application Class
> Data Sharing" section's notes on module options
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and
> **JEP 483 · Ahead-of-Time Class Loading & Linking** ([openjdk.org](https://openjdk.org/jeps/483)).
> 🔴 **No sandbox** — the three log and error lines shown below are **quoted from the `java` tool
> reference's own examples** and are attributed as such; nothing here was executed. JDK 25 · Spring
> Boot 4.1.0 / Spring Framework 7.0.8.

**[05d](05d-the-aot-cache.md) built a cache. This chunk is about the fact that having one is not the
same as using one. An AOT cache is an *optimisation*, and the JVM's default behaviour when it cannot
use the cache is to carry on quietly without it — which is exactly the right production behaviour
and exactly the wrong behaviour for finding out that your build step has been decorative for a
quarter.**

## The five modes

> *"`-XX:AOTMode=mode` — Specifies the AOT Mode for this run. mode must be one of the following:
> `auto`, `off`, `record`, `create`, or `on`."*

**`auto` — the default, and it is a three-way decision made for you:**

> *"This AOT mode is the default, and takes effect if no `-XX:AOTMode` option is present. It
> automatically sets the AOT mode to `record`, `on`, or `off`, as follows:*
> - *If `-XX:AOTCacheOutput=cachefile` is specified, the AOT mode is changed to `record` (a training
>   run, with a subsequent `create` operation).*
> - *Otherwise, if an AOT cache can be loaded, the AOT mode is changed to `on` (a production run).*
> - *Otherwise, the AOT mode is changed to `off` (a production run with no AOT cache)."*

🔴 **That is why the JEP 514 workflow needs no `AOTMode` at all.** `-XX:AOTCacheOutput` implies
`record`; `-XX:AOTCache` implies `on` if the cache loads and `off` if it does not. The ergonomics
are the feature.

**`off`** — *"No AOT cache is used. Other AOT command line options are ignored."*

**`record`** — the training phase. *"At least one of `-XX:AOTConfiguration=configfile` and/or
`-XX:AOTCacheOutput=cachefile` must be specified."* If only `AOTCacheOutput` is given, *"the JVM uses
a temporary file name"*; if `AOTCacheOutput` is given, *"a second JVM process is launched to perform
the Assembly phase"* — the doubled-heap behaviour from [05d](05d-the-aot-cache.md), stated from the
other side.

**`create`** — the assembly phase. *"`-XX:AOTConfiguration=configfile` must be specified. The JVM
reads history and statistics from configfile and writes the optimization artifacts into cachefile.
Note that the application itself is not executed in this phase."*

**`on`** — the production phase, with a fallback you should know about: *"If
`-XX:AOTCache=cachefile` is specified, the JVM tries to load cachefile as the AOT cache. Otherwise,
the JVM tries to load a default CDS archive from the JDK installation directory as the AOT cache."*

## Why a cache declines to load

> *"The loading of an AOT cache can fail for a number of reasons:*
> - *You are trying to use the AOT cache with an incompatible application, JDK release, or OS/CPU.*
> - *The specified cachefile does not exist or is not accessible.*
> - *Incompatible JVM options are used (for example, certain JVMTI options)."*

and the honest disclaimer, which is the sentence to quote when someone insists the cache must work:

> *"Since the AOT cache is an optimization feature, there's no guarantee that it will be compatible
> with all possible JVM options. See JEP 483, section Consistency of training and subsequent runs
> for a representative list of scenarios that may be incompatible with the AOT cache."*

with the reassurance that follows it:

> *"These scenarios usually involve arbitrary modification of classes for diagnostic purposes and
> are typically not relevant for production environments."*

⚠️ **"Arbitrary modification of classes for diagnostic purposes" describes a Java agent.** APM
agents, tracing agents and coverage agents all transform bytecode. If you attach one in production
and the cache stops loading, that is a documented interaction and not a bug — and it is worth
checking deliberately, because the agent is usually added long after the cache was adopted.

## `auto` in production, `on` for debugging — the JDK says so

This is the second time in two chunks that the tool reference has warned against the fail-fast flag,
and the wording is much more explicit than the CDS equivalent:

> *"If AOTMode was originally `auto`, the JVM will continue execution without using the AOT cache.
> This is the recommended mode for production environments, especially when you may not have
> complete control of the command-line (e.g., your application's launch script may allow users to
> inject options to the command-line). This allows your application to function correctly, although
> sometimes it may not benefit from the AOT cache."*

> *"If AOTMode is `on`, the JVM will print an error message and exit immediately. This mode should
> be used only as a "fail-fast" debugging aid to check if your command-line options are compatible
> with the AOT cache. An alternative is to run your application with `-XX:AOTMode=auto -Xlog:aot` to
> see if the AOT cache can be used or not."*

🔴 **That last sentence is the whole verification story, given to you by the JDK.**

```bash
java -XX:AOTMode=auto -XX:AOTCache=app.aot -Xlog:aot -jar application.jar
```

`-Xlog:aot` is safe in production — it is unified logging, not a behaviour change — which makes it
strictly better than the CDS situation, where the recommended check
(`-Xlog:class+load`, [05c](05c-the-training-run.md)) is verbose enough that you would not leave it
on. Consider leaving `-Xlog:aot` on permanently at a low volume; it converts a silent regression
into a line in the log you already collect.

## `-XX:+AOTClassLinking`, and the flag that turns itself on

> *"If this option is enabled, the JVM will perform more advanced optimizations (such as
> ahead-of-time resolution of `invokedynamic` instructions) when creating the AOT cache. As a
> result, the application will see further improvements in start-up and warm-up performance.
> However, an AOT cache created with this option cannot be used when certain command-line
> parameters are specified in the Production phase."*

🔴 **And then the ergonomics, which are the part that surprises people:**

> *"When `-XX:AOTMode` is used in the command-line, `AOTClassLinking` is automatically enabled. To
> disable it, you must explicitly pass the `-XX:-AOTClassLinking` option."*

> *"When `-XX:AOTMode` is not used in the command-line, `AOTClassLinking` is disabled by default to
> provide full compatibility with traditional CDS options such as `-Xshare:dump`."*

So whether you get the advanced optimisations — and their restrictions — depends on whether you
wrote `-XX:AOTMode` at all. Two command lines that a reader would call equivalent are not.

The tool reference also documents the error you get from the CDS side of that boundary:

> *"If the `AOTClassLinking` option was enabled during CDS archive creation, the CDS archive cannot
> be used, and the following error message is printed:*
> *`CDS archive has aot-linked classes. It cannot be used when archived full module graph is not used`"*

## Module options break archives, in two directions

Two rules that are easy to trip over, both from the tool reference's CDS section and both applying
to the AOT cache as its successor.

**Mismatched `--add-modules` between the dump and the run disables the archived module graph.** The
reference's own diagnostic example:

> *"if `--add-modules jdk.jconsole` was specified during archive creation and
> `--add-modules jdk.incubator.vector` is specified during runtime, the following messages will be
> logged:*
> *`Mismatched values for property jdk.module.addmods`*
> *`runtime jdk.incubator.vector dump time jdk.jconsole`*
> *`subgraph jdk.internal.module.ArchivedBootLayer cannot be used because full module graph is disabled`"*

**Three module options disable archives outright:**

> *"If any of the VM options `--upgrade-module-path`, `--patch-module` or `--limit-modules` are
> specified, CDS is disabled. This means that the JVM will execute without loading any CDS archives.
> In addition, if you try to create a CDS archive with any of these 3 options specified, the JVM
> will report an error."*

⚠️ **`--limit-modules` here is the `java` launcher's option, not `jlink`'s.** They share a name and
do different jobs; [04b](04b-jdeps-and-the-module-set.md) recommends `jlink --limit-modules` at
*link* time, which is unaffected. Putting `--limit-modules` on the *runtime* command line silently
turns your archive off.

## `%p` and `%t` in cache filenames

> *"The first occurrence of the special sequence `%p` in configfile and cachefile is replaced with
> the process ID of the JVM process launched in the command-line, and likewise the first occurrence
> of `%t` is replace by the JVM's startup timestamp. (After replacement there must be no further
> occurrences of `%p` or `%t`, to prevent problems with sub-processes.)"*

Useful when generating caches in a loop during experimentation. ⚠️ **Never use `%p` or `%t` in a
production `-XX:AOTCache` path** — the name would have to match a file that was written by a
different process at a different time, which it will not.

## Gotchas

**★ The default mode's job is to *not* fail.** `auto` silently degrades to no cache. That is correct
for production and terrible for discovering that your cache never loads. The countermeasure is
`-Xlog:aot`, not a different mode.

**★ `-XX:AOTMode=on` is a debugging aid, in the JDK's own words.** *"This mode should be used only
as a "fail-fast" debugging aid."* Same shape as `-Xshare:on` for CDS
([05](05-class-data-sharing.md)) — use it in CI, never in the deployment.

**★ Writing `-XX:AOTMode` on the command line silently enables `-XX:+AOTClassLinking`.** *"When
`-XX:AOTMode` is used in the command-line, `AOTClassLinking` is automatically enabled."* You get
better optimisation and additional restrictions on the production command line, from a flag you did
not type.

**★ A Java agent can stop the cache loading.** The documented incompatibilities involve *"arbitrary
modification of classes for diagnostic purposes"*. Adding an APM agent six months after adopting the
cache is a realistic way to lose the benefit without anyone noticing.

**★ Mismatched `--add-modules` between training and production disables the archived module graph.**
The reference logs it, but only if you are logging. A `jlink`ed runtime plus `--add-modules` on the
runtime command line is a plausible way to create the mismatch by accident.

**★ `--upgrade-module-path`, `--patch-module` and `--limit-modules` disable archives entirely.** And
attempting to *create* an archive with any of them is an error. If your platform team injects any of
these through `JAVA_TOOL_OPTIONS`, your cache is off and nothing says so.

**★ `-XX:AOTMode=on` falls back to the default CDS archive when no `-XX:AOTCache` is given.** *"the
JVM tries to load a default CDS archive from the JDK installation directory as the AOT cache."* So
"AOT is on" can be true while your application-specific cache is nowhere in sight.

**★ `-Xlog:aot` is cheap and belongs in your deployment.** Unlike `-Xshare:on` and
`-XX:AOTMode=on`, it changes no behaviour. It is the one countermeasure to a silent optimisation
that costs nothing.

**★ Do not put `%p` or `%t` in a production cache path.** They expand to the current process ID and
start timestamp, which cannot match a file written earlier by a different process. They exist for
generating caches, not for consuming them.

**★ `record` mode with `AOTCacheOutput` launches a second JVM.** That is the doubled-heap behaviour
from [05d](05d-the-aot-cache.md), visible here as an explicit statement that *"a second JVM process
is launched to perform the Assembly phase"*.

**★ There is no guarantee of compatibility with all JVM options, and the JDK says so.** *"Since the
AOT cache is an optimization feature, there's no guarantee that it will be compatible with all
possible JVM options."* Design your deployment so losing the cache is a performance regression, never
a failure — which is precisely what `auto` gives you.

## Interview questions

**★ What does `-XX:AOTMode=auto` actually do?**
It picks one of three modes for you: `record` if `-XX:AOTCacheOutput` is present, `on` if an AOT
cache can be loaded, and `off` otherwise. It is the default and the reason the JDK 25 workflow needs
only `-XX:AOTCacheOutput` for training and `-XX:AOTCache` for production.

**★ How do you know, in production, whether the AOT cache is actually being used?**
`-Xlog:aot`. The tool reference recommends exactly this: *"An alternative is to run your application
with `-XX:AOTMode=auto -Xlog:aot` to see if the AOT cache can be used or not."* It is unified
logging, so it changes no behaviour, and it is the countermeasure to a mechanism whose default
failure is silence.

**★ Why not use `-XX:AOTMode=on` to make a missing cache fail loudly?**
Because the JDK says it is *"a "fail-fast" debugging aid"* and recommends `auto` for production,
*"especially when you may not have complete control of the command-line"*. An AOT cache is an
optimisation; turning its absence into a start-up crash converts a performance regression into an
outage. Put `on` in CI if you want a hard gate.

**★ What is `-XX:+AOTClassLinking` and why might you have it without asking?**
It enables more advanced optimisations when creating the cache, *"such as ahead-of-time resolution
of `invokedynamic` instructions"*, at the cost of restrictions on the production command line. You
get it automatically whenever `-XX:AOTMode` appears on the command line, and not otherwise — so two
command lines that look equivalent can produce differently capable caches.

**★ Name three ways a valid AOT cache can end up not being used.**
A mismatch in application, JDK release or OS/CPU. An incompatible JVM option — the reference names
*"certain JVMTI options"*, which is to say Java agents. And module options: mismatched
`--add-modules` between training and production disables the archived module graph, while
`--upgrade-module-path`, `--patch-module` or `--limit-modules` on the runtime command line disable
archives entirely.

**★ Your platform team injects `--limit-modules` through `JAVA_TOOL_OPTIONS`. What breaks?**
Archives. The tool reference lists `--limit-modules` among three options that disable CDS
completely, and creating an archive while one is set is an error. Note the name collision with
`jlink --limit-modules`, which is a link-time option and is fine. This is a good argument for
`-Xlog:aot` in the deployment: the effect is invisible otherwise.

**★ Why is it acceptable for the JVM to ignore a cache it cannot use?**
Because the cache is an optimisation with no semantic content. The JDK states that there is *"no
guarantee that it will be compatible with all possible JVM options"* and chooses correctness over
speed by default. Your deployment should share that stance: the cache should make the service start
faster, and its absence should never make the service fail.

{/* FOOTER */}
