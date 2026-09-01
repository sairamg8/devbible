---
title: "The JDK documents four ways to create a CDS archive and they all rest on the same sentence — you must run the application once to find out which classes it loads — so what actually distinguishes them is which of them survive contact with a container"
sidebar_label: "05b · Creating an archive"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — "Manually Creating CDS
> Archives", "Creating a Static CDS Archive File with `-Xshare:dump`", "Creating a Dynamic CDS
> Archive File with `-XX:ArchiveClassesAtExit`", "Creating CDS Archive Files with `jcmd`" and
> "Creating Dynamic CDS Archive File with `-XX:+AutoCreateSharedArchive`", plus the
> `-XX:SharedClassListFile` and `-XX:DumpLoadedClassList` entries
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> 🔴 **No sandbox** — nothing was dumped or run, and no archive size or dump duration below is a
> measurement. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[05](05-class-data-sharing.md) established what a CDS archive is and that a default one is
already in use on every start. This chunk is the mechanics of making one that covers your own
classes. The tool reference lists four methods; they differ in ergonomics and in almost nothing
else, because they share one requirement that decides the entire design.**

## The sentence all four methods share

> *"One common operation in all these methods is a "trial run", where you run the application once
> to determine the classes that should be stored in the archive."*

🔴 **A CDS archive is a recording of a real execution.** There is no static analysis that
substitutes for it — the same structural reason `jdeps` cannot compute a module set for a reflective
application ([04b](04b-jdeps-and-the-module-set.md)). The information does not exist until the code
runs. Everything below is a variation on *how* you arrange that run, and
[05c](05c-the-training-run.md) is about *where* it should happen.

## Method 1 — a static archive, in two steps

```bash
# 1. record which classes this application loads
java -Xshare:off -XX:DumpLoadedClassList=hello.classlist -cp hello.jar test.Hello

# 2. build the archive from that list
java -Xshare:dump -XX:SharedArchiveFile=hello.jsa \
     -XX:SharedClassListFile=hello.classlist -cp hello.jar

# 3. run against it
java -XX:SharedArchiveFile=hello.jsa -cp hello.jar test.Hello
```

Two constraints from the tool reference that will bite you.

> *"The classpath specified by the `-cp` parameter must contain only JAR files."*

🔴 That rules out pointing this at an exploded directory of classes — one more reason the extracted
layout from [02b](02b-extracting-layers-and-the-image-cache.md) is the shape everything else in this
topic assumes.

> *"By default, when the `-Xshare:dump` option is used, the JVM runs in interpreter-only mode (as if
> the `-Xint` option were specified). This is required for generating deterministic output in the
> shared archive file. I.e., the exact same archive will be generated, bit-for-bit, every time you
> dump it. However, if deterministic output is not needed, and you have a large classlist, you can
> explicitly add `-Xmixed` to the command-line to enable the JIT compiler. This will speed up the
> archive creation."*

⚠️ **That is a real decision for a build pipeline.** Bit-for-bit reproducibility matters if you care
about reproducible images or about proving that two builds of the same commit are identical.
`-Xmixed` matters if the dump step is slowing your builds. You cannot have both, and the default is
the reproducible one.

The intermediate artefact is plain text, which is the underrated advantage of this method:

> *"`-XX:SharedClassListFile=file_name` — Specifies the text file that contains the names of the
> classes to store in the class data sharing (CDS) archive. This file contains the full name of one
> class per line, except slashes (`/`) replace dots (`.`)."*

A class list can be committed, diffed and reviewed. When someone asks "what changed in the archive
between these two releases", the two-step method can answer and the one-step method cannot.

The reference also notes you may add data beyond classes:

> *"`-XX:SharedArchiveConfigFile=shared_config_file` — Specifies additional shared data added to the
> archive file."*

## Method 2 — a dynamic archive, in one step

```bash
java -XX:ArchiveClassesAtExit=hello.jsa -cp hello.jar Hello
java -XX:SharedArchiveFile=hello.jsa -cp hello.jar test.Hello
```

The tool reference states its advantages directly:

> *"They usually use less disk space, since they don't need to store the classes that are already in
> the static archive."*
> *"They are created with one fewer step than the comparable static archive."*

and describes the contents as *"the classes that are used by the `test.Hello` application, excluding
those that are already in the default CDS archive."*

Given the size warning from [05](05-class-data-sharing.md) — an archive is two to five times larger
than the class files it holds — "excludes what is already in the default archive" is a real saving
on image bytes, and it is why this is the method Spring Boot documents.

You can also build a dynamic archive on top of a **non-default** base:

```bash
java -XX:SharedArchiveFile=base.jsa -XX:ArchiveClassesAtExit=hello.jsa -cp hello.jar Hello
java -XX:SharedArchiveFile=base.jsa:hello.jsa -cp hello.jar Hello
```

— and, because a dynamic archive records the location of its base, the last command can be shortened
to name only `hello.jsa` ([05](05-class-data-sharing.md)).

## Method 3 — `jcmd VM.cds`, for a process you cannot restart

> *"The previous two sections require you to modify the application's start-up script in order to
> create a CDS archive. Sometimes this could be difficult, for example, if the application's class
> path is set up by complex routines. The `jcmd VM.cds` command provides a less intrusive way for
> creating a CDS archive by connecting to a running JVM process."*

```bash
jcmd <pid> VM.cds static_dump my_static_archive.jsa
jcmd <pid> VM.cds dynamic_dump my_dynamic_archive.jsa
```

> *"Note: to use `jcmd <pid> VM.cds dynamic_dump`, the JVM process identified by `<pid>` must be
> started with `-XX:+RecordDynamicDumpInfo`"*

and the reference's own way of applying a flag without touching a start script:

```bash
env JAVA_TOOL_OPTIONS=-XX:SharedArchiveFile=my_static_archive.jsa bash app_start.sh
```

⚠️ **Two container-specific caveats make this less useful than it sounds.** `jcmd` lives in the
`jdk.jcmd` module, which a JRE base image does not ship ([03](03-base-images.md)) — so the method
that demands the least of your start-up script demands the most of your image. And `dynamic_dump`
requires a flag that had to be present *at start*, so it is not genuinely retrospective. Treat this
as an exploration tool for a running system, not as a build pipeline.

## Method 4 — `-XX:+AutoCreateSharedArchive`

```bash
java -XX:+AutoCreateSharedArchive -XX:SharedArchiveFile=hello.jsa -cp hello.jar Hello
```

> *"`-XX:+AutoCreateSharedArchive` is a more convenient way of creating/using CDS archives. Unlike
> the methods of manual CDS archive creation described in the previous section, with
> `-XX:+AutoCreateSharedArchive`, it's no longer necessary to have a separate trial run. Instead,
> you can always run the application with the same command-line and enjoy the benefits of CDS
> automatically."*

The version rules are precise and worth having in full, because they explain behaviour that
otherwise looks random:

> *"If the specified archive file exists and was created by the same version of the JDK, then it
> will be loaded as a dynamic archive; otherwise it is ignored at VM startup."*

> *"At VM exit, if the specified archive file does not exist, it will be created. If it exists but
> was created with a different (but post JDK 19) version of the JDK, then it will be replaced. In
> both cases the archive will be ready to be loaded the next time the JVM is launched with the same
> command line."*

> *"If the specified archive file exists but was created by a JDK version prior to JDK 19, then it
> will be ignored"*

🔴 **It is excellent on a laptop and wrong inside a hardened image**, for two independent reasons.
It needs a **writable** archive path, which [03e](03e-non-root-and-filesystem.md) has just taken
away. And it writes at **exit** — in a container whose lifecycle is "start, serve, receive SIGTERM,
die", the first run pays the full un-archived cost and the container filesystem does not survive to
benefit the next pod. Its whole benefit accrues to repeated runs against a persistent filesystem,
which describes a developer's machine and not a deployment.

## Which to use

| Method | Use it when |
|---|---|
| Static, two-step | You want a reviewable, diffable class list, or reproducible archives |
| **Dynamic, `-XX:ArchiveClassesAtExit`** | **The default choice — one step, smaller archive, and what Spring Boot documents** |
| `jcmd VM.cds` | Investigating a running system whose start-up you do not control, on an image that has `jcmd` |
| `-XX:+AutoCreateSharedArchive` | Local development. Not in a container |

## Gotchas

**★ The archive is a recording, so it is only as good as the run you recorded.** A trial run that
never exercises a subsystem archives none of its classes. This is not a bug to fix, it is the nature
of the mechanism, and it shapes what your training run must do — [05c](05c-the-training-run.md).

**★ `-cp` for `-Xshare:dump` must contain only JAR files.** Stated outright in the tool reference. An
exploded classes directory is not accepted, which quietly rules out several homegrown layouts and
makes the extracted-jar shape the path of least resistance.

**★ `-Xshare:dump` runs interpreted, on purpose.** It is *"required for generating deterministic
output"* so that *"the exact same archive will be generated, bit-for-bit"*. Adding `-Xmixed` speeds
the dump up and gives that away. Decide which property you want before someone else decides for you
to make the build faster.

**★ `-XX:+AutoCreateSharedArchive` needs a writable path and writes at exit.** Both are wrong for a
read-only root filesystem and an ephemeral container. It is a development convenience.

**★ An `AutoCreateSharedArchive` file from a pre-JDK-19 JDK is silently ignored.** *"it will be
ignored: neither loaded at startup"* — and one written by a different post-19 JDK is silently
*replaced*. Both behaviours are correct and both look like "the flag does nothing" if you do not know
the rules.

**★ `jcmd VM.cds dynamic_dump` needs `-XX:+RecordDynamicDumpInfo` set at start.** So the method
advertised as not requiring changes to the start-up script requires a change to the start-up
script, unless you were lucky.

**★ `jcmd` is missing from JRE images.** The `jdk.jcmd` module is not part of `java.se`. If your
production base image is a JRE, method 3 is not available there at all.

**★ The dynamic archive is meaningless without its base.** It stores only what is not already in the
base archive. It records where that base is, which makes the command line short — and makes the
pairing a thing you can break by replacing the JDK underneath it.

**★ The two-step method is the auditable one.** A class list is text. If your organisation needs to
answer "what is in this artefact and what changed", `-XX:DumpLoadedClassList` plus
`-XX:SharedClassListFile` is the method that can answer.

**★ `-XX:SharedArchiveConfigFile` exists and is almost never used.** *"Specifies additional shared
data added to the archive file."* Worth knowing it exists so you recognise it in someone else's
command line rather than assuming it is a typo.

## Interview questions

**★ Why does every CDS creation method need a trial run?**
Because an archive stores the classes an execution actually loaded, in a pre-parsed form. The tool
reference calls it a *"trial run"* and lists it as the one operation common to all four methods.
Static analysis cannot substitute for it, for the same reason `jdeps` cannot compute a module set
for a reflective application: the information does not exist until the program runs.

**★ Static or dynamic archive — which and why?**
Dynamic by default: one fewer step, and it *"[doesn't] need to store the classes that are already in
the static archive"*, so the file is smaller — which matters because an archive is two to five times
larger than the class files it holds. Choose the static two-step method when you want the class list
as a reviewable artefact, or when you need reproducible, bit-for-bit identical archives.

**★ When is `-XX:+AutoCreateSharedArchive` the right tool?**
On a developer machine, or anywhere the same command line runs repeatedly against a persistent
filesystem — it removes the separate trial run entirely. It is wrong in a container because it needs
a writable archive path and writes the archive at exit, and a container filesystem does not outlive
the container, so every new pod pays the un-archived first run.

**★ Why does `-Xshare:dump` run in interpreter-only mode?**
For determinism: the reference says interpreted execution is *"required for generating deterministic
output in the shared archive file"* so the same archive is produced bit-for-bit every time.
`-Xmixed` enables the JIT and speeds the dump up at the cost of that guarantee — a reasonable trade
for a slow build, a bad one if you are trying to produce reproducible images.

**★ You inherit a service whose Dockerfile has `-XX:+AutoCreateSharedArchive` and a read-only root
filesystem. What is happening?**
Nothing useful. The archive cannot be written, so every start behaves as though the flag were
absent. Worse, it *looks* configured, so nobody investigates start-up time. The fix is a training
run in the image build with `-XX:ArchiveClassesAtExit`, producing an archive that is read-only at
runtime — which the read-only filesystem then protects rather than breaks.

**★ What would make you choose the `jcmd VM.cds` route?**
Investigating a running system whose start-up you cannot easily change — the reference's own
motivation is an application *"[whose] class path is set up by complex routines"*. In practice it is
rarely available in production, because `jcmd` is not in a JRE image and `dynamic_dump` needs a flag
set at start. It is a good tool for a staging box with a JDK image.

{/* FOOTER */}
