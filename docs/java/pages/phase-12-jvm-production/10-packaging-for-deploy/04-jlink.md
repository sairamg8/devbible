---
title: "jlink builds a Java runtime that contains only the platform modules you named, which is the honest way to make a Java image small — but it links the JDK, not your application, and the JDK's own man page hands you the maintenance bill in one sentence"
sidebar_label: "04 · jlink"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 tool reference** for
> [`jlink`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jlink.html) — including its
> Plug-ins section and its worked examples — and the **JDK 25 API module summary** for
> [`java.se`](https://docs.oracle.com/en/java/javase/25/docs/api/java.se/module-summary.html);
> **JEP 386 · Alpine Linux Port** ([openjdk.org](https://openjdk.org/jeps/386)) for the
> size motivation; and the **Eclipse Temurin official-image documentation**
> ([docker-library/docs](https://github.com/docker-library/docs/blob/master/eclipse-temurin/content.md)).
> 🔴 **No sandbox** — nothing was linked or built here. The two size figures in this page are
> **quoted from the `jlink` man page's own example output** and are attributed as such; they are
> not measurements of anything you will build. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every previous chunk in this run has shaved the image from the outside: a smaller base
([03b](03b-alpine-and-musl.md)), fewer programs ([03d](03d-distroless.md)), better layer reuse
([02](02-layered-jars.md)). `jlink` is the one that works from the inside — it builds a runtime
image containing only the platform modules you asked for. It is also the one most often described
wrongly, because the sentence "jlink bundles your application into a small runtime" is false: it
links **modules**, and a Spring Boot application on the classpath is not one.**

## What `jlink` does, in its own words

> *"jlink - assemble and optimize a set of modules and their dependencies into a custom runtime
> image"*

> *"The `jlink` tool links a set of modules, along with their transitive dependences, to create a
> custom runtime image."*

The two structural facts that follow from that, and that almost every tutorial elides:

1. **The root set starts empty.** The man page on `--add-modules`: *"Adds the named modules, mod,
   to the default set of root modules. **The default set of root modules is empty.**"* You get
   nothing you did not name, plus the transitive closure of what you did.
2. **The default module path is the JDK's own.** *"If this option is not specified, then the
   default module path is `$JAVA_HOME/jmods`. This directory contains the `java.base` module and
   the other standard and JDK modules."* ⚠️ That directory is present in a **JDK** and is often
   absent from a vendor's **JRE** image — so `jlink` runs in your builder stage, from a JDK, and
   the output goes into the runtime stage. This is why the pattern is always multi-stage.

Eclipse Temurin's official image documentation shows the canonical shape, and note what it links:

```dockerfile
# Example of custom Java runtime using jlink in a multi-stage container build
FROM eclipse-temurin:25 as jre-build

# Create a custom Java runtime
RUN $JAVA_HOME/bin/jlink \
         --add-modules java.base \
         --strip-debug \
         --no-man-pages \
         --no-header-files \
         --compress=2 \
         --output /javaruntime

# Define your base image
FROM debian:buster-slim
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH "${JAVA_HOME}/bin:${PATH}"
COPY --from=jre-build /javaruntime $JAVA_HOME

# Continue with your application deployment
RUN mkdir /opt/app
COPY japp.jar /opt/app
CMD ["java", "-jar", "/opt/app/japp.jar"]
```

🔴 **Read the last three lines carefully.** The jar is copied in *afterwards* and launched with
`-jar`, exactly as on a stock JRE. `jlink` produced the **runtime**; the application arrived
separately, on the classpath, as an ordinary Boot jar. The image is smaller because the *JDK* is
smaller, not because anything was done to your code.

This is also the shape that composes with everything else in this topic: the extracted layered
layout from [02c](02c-a-real-layered-dockerfile.md) sits on a `jlink`ed runtime unchanged, and
`java-base` from [03d](03d-distroless.md) is a purpose-built runtime stage for exactly this.

## The options that matter, and what each buys

| Option | Man page description | Why it is on the list |
|---|---|---|
| `--add-modules` | *"Adds the named modules, mod, to the default set of root modules."* | The whole decision. [04b](04b-jdeps-and-the-module-set.md) is about choosing this list |
| `--strip-debug` | *"Strips debug information from the output image."* | Free size. ⚠️ It strips the *image*, not your classes — line numbers in **your** stack traces come from your jar |
| `--no-header-files` / `--no-man-pages` | *"Excludes header files." / "Excludes man pages."* | Nothing in a container reads either |
| `--compress` | *"Compresses all resources in the output image."* Levels: *"0: No compression / 1: Constant string sharing / 2: ZIP"* | Trades start-up decompression for bytes |
| `--include-locales` | *"Includes the list of locales where langtag is a BCP 47 language tag."* | Locale data is large. Requires `--add-modules jdk.localedata` |
| `--bind-services` | *"Link service provider modules and their dependencies."* | ⚠️ Enormously expanding — see below |
| `--suggest-providers` | *"Suggest providers that implement the given service types from the module path."* | The targeted alternative to `--bind-services` |
| `--generate-cds-archive` | *"Generate CDS archive if the runtime image supports the CDS feature."* | Start-up, at link time — chunk [05](05-class-data-sharing.md) |
| `--limit-modules` | *"Limits the universe of observable modules to those in the transitive closure of the named modules"* | Makes an accidental extra dependency fail at link time |
| `--launcher` | *"Specifies the launcher command name for the module or the command name for the module and main class"* | Only meaningful for a modular application |

⚠️ **The `--compress` values are version-sensitive.** The JDK 25 man page documents `{0|1|2}`. The
authority for the JDK you are actually using is `jlink --list-plugins`, which the man page names
as the way to get *"a complete list of all available plug-ins"*. Do not copy a compression flag
from a blog into a Dockerfile without running that once.

## `--bind-services` is the flag that undoes the exercise

The man page's own example demonstrates this better than any prose could. Linking the module
`com.greetings` without service binding produces an image whose `--list-modules` output is four
lines:

> *"com.greetings / java.base@11 / java.logging@11 / org.astro@1.0"*

Adding `--bind-services` to the identical command produces a listing of **thirty-five** modules,
including `java.desktop`, `jdk.javadoc`, `jdk.compiler`, `jdk.jfr`, `jdk.localedata` and
`jdk.crypto.mscapi`. (Both listings are quoted from the `jlink` man page's examples section; the
`@11` suffixes are the man page's, and they are why you should treat the *shape* of that result as
the lesson rather than the exact module list.)

🔴 **`--bind-services` pulls in every module that provides any service used by anything in your
graph, transitively.** It is the honest, safe answer when you cannot enumerate what your
application loads through `ServiceLoader` — and it very nearly reconstitutes the full JDK, which
is the thing you were trying to avoid.

The targeted alternative is `--suggest-providers`, which asks the question rather than answering
it maximally. The man page's example asks who provides `java.security.Provider` and lists nine
candidate modules with the service each satisfies, so you can add the two you actually need:

```bash
jlink --suggest-providers java.security.Provider
jlink --add-modules java.naming,jdk.crypto.cryptoki --output mybuild
```

This matters for Spring Boot specifically, because `ServiceLoader` is everywhere in the JDK —
charsets, security providers, DNS naming, the file-system providers behind `java.nio.file`. Losing
one silently is the failure mode [04b](04b-jdeps-and-the-module-set.md) is about.

## What the man page's example says about size

The `jlink` man page compares two images it builds itself, one stripped and compressed and one
not, and prints:

> *"du -sh ./compressedrt ./fr_rt*
> *23M ./compressedrt*
> *36M ./fr_rt"*

🔴 **Those are the documentation's numbers for the documentation's example** — a locale-focused
image, on the JDK the man page's examples were written against. They are quoted here to show the
*shape* of the result (stripping and compression are worth a meaningful fraction, not an order of
magnitude) and **not** as a prediction about your image. JEP 386's independent figure for a
`java.base`-only runtime with the server VM is *"38 MB"*. Your own numbers come from measuring your
own build, which is [09](09-image-size-and-startup.md).

## The bill, in one sentence

The `jlink` man page contains a `Note:` that is easy to read past and impossible to un-read:

> *"Developers are responsible for updating their custom runtime images."*

🔴 **That is the real cost of `jlink`, and it is not a size cost.** When you pull
`eclipse-temurin:25` you inherit the publisher's rebuild cadence: a JDK security release appears,
you rebuild, you are patched. When you `jlink` a runtime you have created a **derived artefact**
that no publisher tracks. Nothing rebuilds it for you, no scanner necessarily recognises it as a
JDK of a particular version, and your quarterly-CPU response is now your own CI pipeline's
responsibility.

That is entirely manageable — it is a base-image bump plus a rebuild, and it is automatable — but
it must be **decided** rather than discovered. A team that adopts `jlink` for image size and does
not also adopt an automated rebuild trigger has traded a known quantity of bytes for an unknown
quantity of unpatched runtime.

## When `jlink` actually pays

- **A service with a genuinely small module footprint** — a message consumer, a proxy, a job
  runner — where the difference between `java.base`-plus-a-few and the whole platform is a large
  fraction of the image.
- **In combination with a minimal runtime base**: `java-base` from distroless, or Alpine, where
  JEP 386's arithmetic makes the runtime the dominant term.
- **Where images are pulled constantly** — heavy autoscaling, many nodes, expensive egress — so
  the saving is multiplied by pull count rather than paid once.

And where it does not:

- **A large Spring application with a wide dependency tree**, where the module set converges on
  most of the platform anyway and the residual risk of a missing reflective dependency is real.
- **Anywhere the JDK is not the dominant term.** If your dependencies are 200 MB, trimming the
  runtime is optimising the small number again — the same mistake as choosing Alpine for a
  stock-JDK image.
- **Where nobody owns the rebuild.** See the previous section; this is the disqualifying one.

## Gotchas

**★ `jlink` does not package your application.** It links platform modules into a runtime; a Boot
jar is then copied in and launched with `-jar`, exactly as on a stock JRE. Every sentence that
says otherwise is describing something else — probably native image, which is topic 11.

**★ The default root module set is empty.** *"The default set of root modules is empty."* A
`jlink` invocation without `--add-modules` links nothing useful. There is no implicit `java.se`.

**★ `jlink` needs a JDK with a `jmods` directory.** The default module path is `$JAVA_HOME/jmods`,
which JRE images generally do not ship. This is why the linking step lives in a builder stage —
and why you cannot "just add `jlink`" to a runtime image later.

**★ `--bind-services` can nearly restore the full JDK.** The man page's own example goes from four
modules to thirty-five. Use `--suggest-providers` to find the two or three you need, and add those
by name.

**★ `--strip-debug` strips the *runtime*, not your code.** Your application's line numbers live in
your jar and are unaffected. Do not skip the flag out of a fear of losing your own stack traces —
and do not expect it to shrink your application either.

**★ Locale data is not free and is not obvious.** `--include-locales` requires
`--add-modules jdk.localedata`, and omitting the locales your users need produces formatting and
collation differences rather than an error. Decide the locale list deliberately.

**★ `--compress` values differ across JDK versions.** JDK 25's man page documents `{0|1|2}`. Run
`jlink --list-plugins` against the exact JDK in your builder rather than copying a flag.

**★ You now own JDK patching for this artefact.** *"Developers are responsible for updating their
custom runtime images."* Automate the rebuild on base-image change, or do not do this.

**★ A `jlink`ed runtime may not be recognisable to your scanner as a JDK.** It is a directory tree
you assembled, not a distribution package. Check what your vulnerability tooling reports for the
image *before* the audit, not during it.

**★ Dropping `jdk.jcmd` here is the same decision as [03](03-base-images.md), made again.** If the
runbook needs `jcmd`, `--add-modules` it explicitly. `jlink` makes the trade-off visible, which is
its main advantage over picking a `jre` tag and hoping.

**★ `--generate-cds-archive` is start-up work you can do at link time.** It is a documented plug-in
— *"Generate CDS archive if the runtime image supports the CDS feature"* — and it composes with the
build-time training run from [02d](02d-the-cache-variants-of-the-dockerfile.md) rather than
competing with it.

**★ Cross-architecture linking is not something to assume.** The man page documents `--endian` for
byte order, which is a long way short of a supported cross-linking story. Link on the target
architecture — in a multi-arch build, in the builder stage for that architecture.

## Interview questions

**★ What does `jlink` actually produce?**
A custom runtime image: *"assemble and optimize a set of modules and their dependencies into a
custom runtime image."* It links **platform modules**, not your application. In a Spring Boot
deployment, the output replaces the JRE in the runtime stage and your jar is copied in afterwards
and launched with `-jar`, unchanged.

**★ Why does `jlink` have to run in a separate build stage?**
Because its default module path is `$JAVA_HOME/jmods`, which is part of a JDK and generally absent
from a JRE image. You need a full JDK to link, and you do not want that JDK in the shipped image —
which is precisely the multi-stage pattern Temurin's own documentation shows.

**★ What is `--bind-services` and why is it dangerous?**
It links *"service provider modules and their dependencies"*. It is the safe answer when you cannot
enumerate what your code loads via `ServiceLoader`, and it is dangerous because the closure is
huge: the man page's own example expands a four-module image to thirty-five, dragging in
`java.desktop`, `jdk.compiler` and `jdk.javadoc`. The disciplined alternative is
`--suggest-providers` followed by naming the providers you need.

**★ What is the hidden ongoing cost of a `jlink`ed runtime?**
Patching. The man page states it plainly: *"Developers are responsible for updating their custom
runtime images."* A published base image is rebuilt by its publisher on every JDK security release;
a runtime you linked is a derived artefact nobody tracks. Adopting `jlink` without an automated
rebuild on base-image change trades bytes for unpatched CVEs.

**★ How does `jlink` relate to GraalVM native image?**
They solve overlapping problems by opposite means. `jlink` produces a smaller **JVM** and changes
nothing about how your application runs — same JIT, same GC, same reflection, same tooling.
Native image produces a **binary** under a closed-world assumption and changes all of those, which
is topic 11. `jlink` is the low-risk option and delivers a much smaller share of the benefit.

**★ Does `--strip-debug` cost you stack traces?**
Not yours. It strips debug information from the runtime image it builds; your application's line
numbers come from your own class files in your own jar. The flag is close to free for a
containerised service.

**★ Someone shows you an image built with `jlink --add-modules java.base` running a Spring Boot
application. What is your first question?**
Whether it has ever started. `java.base` alone excludes `java.naming`, `java.sql`, `java.management`
and the security providers that live in other modules, all of which a typical Boot application
touches — often reflectively, which means the failure arrives at runtime rather than at link time.
Determining the real module set is [04b](04b-jdeps-and-the-module-set.md), and "it built" is not
evidence.

**★ Where should `jlink` sit relative to the base-image decision?**
Downstream of it. Choose the runtime base for security and behaviour reasons first
([03d](03d-distroless.md) versus [03b](03b-alpine-and-musl.md)), then use `jlink` to decide how
much JDK goes on top. Distroless `java-base` exists precisely to be that combination: Debian's
glibc and native libraries, with a runtime you linked yourself.

{/* FOOTER */}
