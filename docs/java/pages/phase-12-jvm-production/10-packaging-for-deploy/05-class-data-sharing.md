---
title: "Class Data Sharing is already switched on in your image — the JVM loads a default archive of about 1300 core classes unless you tell it not to — and everything people call 'enabling CDS' is really about extending that archive to your own classes"
sidebar_label: "05 · Class Data Sharing"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — the "Application Class Data
> Sharing" section and the `-Xshare`, `-XX:SharedArchiveFile`, `-XX:+VerifySharedSpaces`,
> `-XX:SharedClassListFile` and `-XX:SharedArchiveConfigFile` entries
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> **Spring Boot reference**, "Packaging → AOT Cache"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html),
> documented at 4.1.x). 🔴 **No sandbox** — no archive was created, no JVM was started, and no
> start-up time or archive size below is a measurement. JDK 25 · Spring Boot 4.1.1 / Spring
> Framework 7.0.9.

**Almost every article about CDS opens with "how to enable CDS", which is the wrong frame and
causes real confusion when the measurements come in flat. On a stock JDK 25 image the JVM is
already using a CDS archive on every single start. The thing you can change is *which* classes
are in it, and the honest question is therefore not "should we enable CDS" but "is extending the
archive to our own classes worth a build step" — and on JDK 25 the answer is usually "no, use the
AOT cache instead", which the JDK's own documentation says.**

## What CDS is, mechanically

The `java` tool reference states both benefits and they are different in kind:

> *"Application Class Data Sharing (AppCDS) stores classes used by your applications in an archive
> file. Since these classes are stored in a format that can be loaded very quickly (compared to
> classes stored in a JAR file), AppCDS can improve the start-up time of your applications. In
> addition, AppCDS can reduce the runtime memory footprint by sharing parts of these classes
> across multiple processes."*

- **Start-up**: the archive holds classes in a pre-parsed, pre-verified layout, so class loading
  becomes closer to a memory map than a parse. This is the benefit that survives in a container.
- **Footprint**: the archive is mapped, so several JVMs on one host share the same physical pages.
  ⚠️ **In a one-JVM-per-container deployment there is nobody to share with.** The documentation
  describes sharing *"across multiple processes"*; if your topology is one process per container
  and one container per pod, that half of the benefit has no counterparty. This is a deduction from
  the mechanism, not a quoted claim, but it is the reason the footprint argument rarely reproduces
  on Kubernetes.

And the cost, which almost nobody mentions:

> *"Classes in the CDS archive are stored in an optimized format that's about 2 to 5 times larger
> than classes stored in JAR files or the JDK runtime image. Therefore, it's a good idea to archive
> only those classes that are actually used by your application."*

🔴 **The archive is bigger than the classes it accelerates — two to five times bigger.** So an
archive of "everything" is a large file added to every image layer and every pull, which is exactly
the number [02](02-layered-jars.md) spent four chunks reducing. Archiving is a trade, not a free
win, and the trade is image bytes for start-up milliseconds.

## It is already on

This is the sentence that reframes the topic:

> *"By default, in most JDK distributions, unless `-Xshare:off` is specified, the JVM starts up
> with a default CDS archive, which is usually located in `JAVA_HOME/lib/server/classes.jsa` (or
> `JAVA_HOME\bin\server\classes.jsa` on Windows). This archive contains about 1300 core library
> classes that are used by most applications."*

So the baseline you are measuring against **already has CDS**. When someone reports "we enabled CDS
and start-up barely moved", the usual explanation is that they added their application's classes to
an archive that was already covering the 1300 core classes doing most of the early work.

Note the hedge in the JDK's own wording — *"in most JDK distributions"*. Whether the default
archive exists in **your** image is a property of the build, and a `jlink`ed runtime
([04](04-jlink.md)) has one only if `--generate-cds-archive` was used. Check for
`$JAVA_HOME/lib/server/classes.jsa` in your builder stage rather than assuming.

## The three modes, and the one you must not copy

> *"`-Xshare:mode` — Sets the class data sharing (CDS) mode."*
> - *"`auto` — Use shared class data if possible (default)."*
> - *"`on` — Require using shared class data, otherwise fail."*
> - *"`off` — Do not attempt to use shared class data."*

and then, in the man page's own note:

> *"Note: The `-Xshare:on` option is used for testing purposes only. It may cause the VM to
> unexpectedly exit during start-up when the CDS archive cannot be used (for example, when certain
> VM parameters are changed, or when a different JDK is used). This option should not be used in
> production environments."*

🔴 **This is the most-copied wrong flag in the CDS literature.** The reasoning behind
`-Xshare:on` in production is sound — "fail loudly if the archive is not being used, so a silent
regression cannot happen" — and the JDK explicitly rejects it, because the archive can become
unusable for reasons that are not your fault and turning that into a start-up crash is worse than
turning it into a slower start. **Use `-Xshare:on` in a CI check; use `auto` in production.** The
verification technique that belongs in production is logging, which
[05b](05b-creating-a-cds-archive.md) covers.

## Static and dynamic archives

`-XX:SharedArchiveFile` takes up to two archives:

> *"`-XX:SharedArchiveFile=<static_archive>:<dynamic_archive>`"*
> *"The `<static_archive>` overrides the default CDS archive."*
> *"The `<dynamic_archive>` provides additional classes that can be loaded on top of those in the
> `<static_archive>`."*
> *"On Windows, the above path delimiter `:` should be replaced with `;`"*

and a convenience that is easy to miss and explains a lot of otherwise-confusing command lines:

> *"For convenience, the `<dynamic_archive>` records the location of the `<static_archive>`.
> Therefore, you can omit the `<static_archive>` by saying only: `-XX:SharedArchiveFile=<dynamic_archive>`"*

🔴 **That is why Spring Boot's documented CDS command line names only one file.** The dynamic
archive created by the training run remembers the base archive it was built against; you pass the
one file and get both.

The JDK is unusually candid about what those two words mean:

> *"The names "static" and "dynamic" are used for historical reasons. The dynamic archive, while
> still useful, supports fewer optimizations than available for the static CDS archive. If the full
> set of CDS/AOT optimizations are desired, consider using the AOT cache described below."*

🔴 **Note where that sentence points: the AOT cache.** The JDK's own tool reference treats CDS as
the older, less capable mechanism and directs you at
[05d](05d-the-aot-cache.md). Spring Boot says the same thing in the opposite
direction: *"CDS is the predecessor of AOT cache, but works similarly"* and *"we recommend using
the AOT cache whenever possible."*

⚠️ **So on JDK 25 the practical role of CDS is compatibility, not performance.** Spring Boot's
version gate is explicit: *"Spring Boot supports the AOT cache for Java 25 and above. If you're
using an earlier version of Java, you have to use CDS instead."* If your version spine is JDK 25 —
this phase's is — CDS is what you write when you must also support an older runtime, and the AOT
cache is what you write otherwise.

## The archive is a security-relevant input

Two entries in the tool reference belong together and are almost never quoted:

> *"`-XX:+VerifySharedSpaces` — If this option is specified, the JVM will load a CDS archive file
> only if it passes an integrity check based on CRC32 checksums. The purpose of this flag is to
> check for unintentional damage to CDS archive files in transmission or storage."*

> *"To guarantee the security and proper operation of CDS, the user must ensure that the CDS archive
> files used by Java applications cannot be modified without proper authorization."*

🔴 **Read that second sentence as what it is: the archive is an input from which the JVM loads
classes.** CRC32 catches corruption, not tampering — the man page says so by calling it a check for
*"unintentional damage"*. The archive must therefore live somewhere your process cannot write and
nothing untrusted can reach, which is a clean argument for baking it into the image at build time
([02d](02d-the-cache-variants-of-the-dockerfile.md)) and running with the read-only root filesystem
from [03e](03e-non-root-and-filesystem.md). An archive on a shared writable volume is a code-injection
surface.

## Gotchas

**★ CDS is not something you enable; it is already on.** *"By default, in most JDK distributions,
unless `-Xshare:off` is specified, the JVM starts up with a default CDS archive."* Your "before"
measurement already includes about 1300 core classes. Any benchmark that claims a large win from
"enabling CDS" is measuring something else.

**★ `-Xshare:on` is documented as testing-only and explicitly not for production.** *"This option
should not be used in production environments."* It converts an unusable archive — a changed flag, a
different JDK — into a start-up failure. Put it in a CI assertion instead.

**★ The archive is 2 to 5 times larger than the classes it holds.** Archiving indiscriminately adds
that to every layer, every push and every pull. Archive what the application actually loads, which
is what a training run determines.

**★ The cross-process footprint saving usually has no counterparty in a container.** The benefit is
described as *"sharing parts of these classes across multiple processes"*. One JVM per container
means there is no second process to share the mapped pages with, so the footprint half of the
argument mostly does not apply — plan for the start-up benefit only.

**★ A `jlink`ed runtime has no default archive unless you asked for one.** `--generate-cds-archive`
is a `jlink` plug-in ([04](04-jlink.md)). Trim the runtime without it and you have quietly removed
the default CDS archive as well as the modules — a start-up regression introduced by a size
optimisation.

**★ On Windows the archive separator is `;`, not `:`.** Stated in the tool reference. Relevant if
your build runs on a developer's Windows machine and production is Linux.

**★ A dynamic archive remembers its base archive.** *"the `<dynamic_archive>` records the location
of the `<static_archive>`."* This is why one path works — and it also means a dynamic archive is
tied to the static archive it was built against. Move or replace the base and the pairing breaks.

**★ "Static" and "dynamic" do not mean what they sound like.** *"The names "static" and "dynamic"
are used for historical reasons."* The operative difference is that the dynamic archive *"supports
fewer optimizations"*.

**★ CRC32 verification is anti-corruption, not anti-tampering.** The tool reference calls it a check
for *"unintentional damage"* and separately requires that archives *"cannot be modified without
proper authorization"*. Bake the archive into the image; do not mount it from anywhere writable.

**★ On JDK 25, reaching for CDS at all deserves justification.** The `java` tool reference itself
says to *"consider using the AOT cache"* for the full set of optimizations, and Spring Boot
recommends *"using the AOT cache whenever possible"*. CDS on JDK 25 is a compatibility choice.

**★ Neither CDS nor the AOT cache does anything for peak throughput.** They change how classes get
loaded. The JIT still has to warm up, which is [05f](05f-when-the-cache-helps.md) and topic 14's
benchmarking problem.

## Interview questions

**★ Is CDS on by default?**
Yes, effectively. The `java` tool reference says that *"in most JDK distributions, unless
`-Xshare:off` is specified, the JVM starts up with a default CDS archive"* containing *"about 1300
core library classes"*. So the decision in front of you is not on-or-off; it is whether to build an
application-specific archive on top of that baseline.

**★ Why is `-Xshare:on` a bad idea in production even though it seems safer?**
Because the JDK says so: *"The `-Xshare:on` option is used for testing purposes only… This option
should not be used in production environments."* It makes the JVM fail to start when the archive
cannot be used, and the archive can become unusable for benign reasons — a changed VM flag, a
different JDK build. The safe pattern is `auto` in production and an explicit check in CI.

**★ What is the difference between a static and a dynamic CDS archive?**
The names are historical. Practically: a static archive replaces the default archive and supports
the full optimisation set; a dynamic archive layers additional classes on top of a base archive,
takes one fewer step to create, is smaller because it excludes what is already in the base, and
*"supports fewer optimizations"*. A dynamic archive also records where its base archive is, which
is why command lines that use one name still work.

**★ Where does the memory-footprint benefit of CDS come from and when does it not apply?**
From mapping the archive so *"parts of these classes"* are shared *"across multiple processes"*. It
applies on a host running many JVMs from the same runtime. It does not meaningfully apply when the
deployment is one JVM per container, because there is no second process mapping the same file.

**★ On JDK 25, when would you still choose CDS over the AOT cache?**
When the same build must also run on an older JDK. Spring Boot's rule is a version gate: *"Spring
Boot supports the AOT cache for Java 25 and above. If you're using an earlier version of Java, you
have to use CDS instead."* On a JDK 25-only spine, both the JDK's tool reference and Spring Boot
point at the AOT cache.

**★ Is a CDS archive a security concern?**
Yes, and the tool reference treats it as one: *"the user must ensure that the CDS archive files used
by Java applications cannot be modified without proper authorization."* It is an input the JVM loads
classes from. `-XX:+VerifySharedSpaces` only checks CRC32 for *"unintentional damage"*, so it is not
a defence against tampering. Bake the archive into the image and run with a read-only root
filesystem.

**★ Your team adds an AppCDS archive and start-up improves by less than expected. What are the
likely reasons?**
Three, in order of frequency. The baseline already used the default archive, so you measured the
delta on top of 1300 already-optimised classes. The archive may not be in use at all — for a Spring
Boot application it has to be used with the *extracted* form, and a mismatch is a silent no-op
([05d](05d-the-aot-cache.md)). And class loading may simply not be your dominant start-up cost;
connection pools, schema validation and remote configuration fetches are unaffected by any archive.

{/* FOOTER */}
