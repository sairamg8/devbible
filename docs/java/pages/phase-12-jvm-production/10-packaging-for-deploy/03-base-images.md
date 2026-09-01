---
title: "The JRE stopped existing as a platform artifact in Java 9, so picking a jre base image is not picking a smaller Java — it is deciding to delete jcmd, jstack, jmap and JFR from the one machine where you will ever need them"
sidebar_label: "03 · Base images"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 220 · Modular Run-Time Images**
> ([openjdk.org](https://openjdk.org/jeps/220)); the **JDK 25 API module summaries** for
> [`java.se`](https://docs.oracle.com/en/java/javase/25/docs/api/java.se/module-summary.html),
> [`jdk.jcmd`](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.jcmd/module-summary.html),
> `jdk.jfr`, `jdk.attach`, `jdk.management.agent`, `jdk.hotspot.agent`, `jdk.jdi` and
> `jdk.compiler` (docs.oracle.com); the **JDK 25 tool references** for
> [`jcmd`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html) and
> [`jps`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jps.html); the **Eclipse
> Temurin official-image documentation**
> ([docker-library/docs](https://github.com/docker-library/docs/blob/master/eclipse-temurin/content.md));
> the **distroless** repository sources `java/java.bzl` and `common/variables.bzl`
> ([github.com](https://github.com/GoogleContainerTools/distroless)); and the Kubernetes
> **"Debug Running Pods"** task page
> ([kubernetes.io](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/)).
> 🔴 **No sandbox** — nothing here was built or run, and no image size, layer count or tool
> output below is a measurement. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[02d](02d-the-cache-variants-of-the-dockerfile.md) finished the question of *what you copy
into the image*. This chunk is the question underneath it — *what the image already was*. The
`FROM` line is the only line in a Dockerfile that decides what you can do at 03:00 when the
service is alive, wedged, and you have one shell. Almost everyone picks it on the size number
and discovers the rest during the incident.**

## The JRE is not something the JDK builds any more

Before Java 9, "the JRE" was a real, separately built artifact — the JDK image literally
contained a copy of it in a `jre/` subdirectory. JEP 220 deleted that arrangement and said so
in unusually plain language:

> *"The present distinction between JRE and JDK images is purely historical, a consequence of
> an implementation decision made late in the development of the JDK 1.2 release and never
> revisited. The new image structure eliminates this distinction: A JDK image is simply a
> run-time image that happens to contain the full set of development tools and other items
> historically found in the JDK."*

🔴 **Read that as a consumer of base images and it says: there is no specification of what a
`jre` tag contains.** After JEP 220 a runtime image is *whatever set of modules someone linked
together*. "JRE" survives as a **vendor packaging label**, and two vendors' `:25-jre` tags are
under no obligation to contain the same modules. The vendor decides; the tag does not tell you.

Eclipse Temurin's own image documentation is refreshingly direct about this, and its advice is
not "use our JRE":

> *"JRE images are available for all versions of Eclipse Temurin but it is recommended that you
> produce a custom JRE-like runtime using `jlink`"*

The word doing the work there is **"JRE-like"**. Even the vendor that ships a JRE image treats
it as a convenience and points you at building the module set yourself — which is
[04](04-jlink.md).

## What a "JRE" actually removes, module by module

`java.se` is the aggregator module whose summary reads, verbatim, *"Defines the API of the Java
SE Platform."* Its `requires transitive` list is twenty modules long and **every single one of
them is `java.*`**. Not one `jdk.*` module is in it.

🔴 **That is the whole argument in one fact: a runtime can be a complete, conforming
implementation of the Java SE Platform and contain zero diagnostic tools.** Nothing you are
entitled to as a Java developer includes `jstack`. The tools live in JDK-specific modules that
a runtime image is free to omit.

Here is what each omission costs, with each module's own summary quoted:

| Module | Summary (verbatim) | What you lose |
|---|---|---|
| `jdk.jcmd` | *"Defines tools for diagnostics and troubleshooting a JVM such as the `jcmd`, `jps`, `jstat` tools."* | `jcmd`, `jinfo`, `jmap`, `jps`, `jstack`, `jstat` — the whole of topics 05 and 06's tooling |
| `jdk.attach` | *"Defines the attach API."* | The transport those tools ride on to reach a live JVM |
| `jdk.jfr` | *"Defines the API for JDK Flight Recorder."* | The JFR API itself |
| `jdk.management.agent` | *"Defines the JMX management agent. This module allows a Java Virtual Machine to be monitored and managed via JMX API."* | Remote JMX; anything that connects a console over the wire |
| `jdk.hotspot.agent` | *"Defines the implementation of the HotSpot Serviceability Agent. This module includes the `jhsdb` tool to attach to a running Java Virtual Machine (JVM) or launch a postmortem debugger to analyze the content of a core-dump from a crashed JVM."* | Core-dump forensics |
| `jdk.jdi` | *"Defines the Java Debug Interface."* | Attaching a debugger |
| `jdk.compiler` | *"Defines the implementation of the system Java compiler and its command line equivalent, `javac`."* | Anything that compiles Java at run time |

The `jdk.jcmd` row is the one that matters operationally, because those six tools are how every
other topic in this phase tells you to look at a running JVM. **A JRE image quietly repeals
chapters 05 and 06 of your own runbook.**

## Verify what is in the image — do not infer it from the tag

Three commands, run against the base image in a throwaway container or in your builder stage.
No output is shown here on purpose; the point is that **you** run them against **your** tag:

```bash
# 1. Which JDK modules survived the vendor's linking decision?
java --list-modules | grep -E '^jdk\.(jcmd|jfr|attach|management|hotspot|jdi|compiler)'

# 2. What launchers actually exist? This is the ground truth, not the tag name.
ls "$JAVA_HOME/bin"

# 3. What does jdk.jcmd itself depend on, in this image?
java --describe-module jdk.jcmd
```

A worked demonstration that tags lie: the distroless project's own build file,
`java/java.bzl`, installs the Adoptium Debian package **`temurin-<version>-jre`** for
`gcr.io/distroless/javaNN-debianNN`, and the package **`temurin-<version>-jdk`** for the
`:debug` variant of the same image. So `:debug` is not "the same image plus a shell" — it is a
**different Java runtime**. That is a genuinely useful escape hatch and it is invisible from
the tag; it is visible in ninety lines of Bazel in a public repository.

## What the deletion costs you at 03:00

Suppose you accept the JRE image and plan to attach from a sidecar or a debug container
instead. The `jcmd` tool reference states the constraints in one sentence:

> *"The `jcmd` utility is used to send diagnostic command requests to the JVM. It must be used
> on the same machine on which the JVM is running, and have the same effective user and group
> identifiers that were used to launch the JVM."*

🔴 **That is two independent requirements and containers break both by default.**

1. **"the same machine."** Two containers in a pod are the same machine only if they share a
   **process namespace**. By default they do not.
2. **"the same effective user and group identifiers."** Your app container probably runs as a
   non-root UID (that is [03e](03e-non-root-and-filesystem.md)). Your debug
   container must run as *that* UID, not root, and not merely as some other non-root user.

Kubernetes' escape hatch for exactly this is the ephemeral container, and its documentation
names the distroless case explicitly:

> *"Ephemeral containers are useful for interactive troubleshooting when `kubectl exec` is
> insufficient because a container has crashed or a container image doesn't include debugging
> utilities, such as with distroless images."*

and, on the flag that gets you past requirement 1:

> *"The `--target` parameter targets the process namespace of another container."*

with a warning that is worth committing to memory, because the failure is silent:

> *"The `--target` parameter must be supported by the Container Runtime. When not supported,
> the Ephemeral Container may not be started, or it may be started with an isolated process
> namespace so that `ps` does not reveal processes in other containers."*

So the plan "JRE image plus `kubectl debug`" is viable — but it depends on the container
runtime, on UID alignment, and on you having rehearsed it **before** the incident. If you have
not rehearsed it, you did not choose a smaller image; you chose a longer outage.

## The honest case for a JRE image

It is a real case and this page is not arguing against it. Two things genuinely improve:

- **Vulnerability surface and scanner noise.** The distroless project's framing generalises to
  any minimisation: *"Restricting what's in your runtime container to precisely what's
  necessary for your app… improves the signal to noise of scanners (e.g. CVE) and reduces the
  burden of establishing provenance to just what you need."* Every tool you did not ship is a
  CVE you do not have to triage, argue about, or patch on someone else's schedule.
- **Size**, which this page deliberately does not quantify — see
  [09](09-image-size-and-startup.md) for what actually moves that number
  and how to measure it in your own registry rather than in a blog post.

The decision that survives contact with production is usually one of:

1. **JDK base image** in a private, low-blast-radius service where debugging speed beats scan
   hygiene.
2. **JRE (or `jlink`ed) image plus a rehearsed ephemeral-container procedure** — the common
   answer, and only correct if the second half genuinely exists.
3. **JRE image plus an out-of-process diagnostic path that never needs a shell**: JFR to a
   volume, heap dump on OOM to a mounted path, metrics and traces (topics 08 and 09). If the
   JVM can emit everything you need without anyone attaching, the missing tools stop mattering.

Option 3 is the one that scales, and it is a design decision made at build time, not a shell
command found during an incident.

## Gotchas

**★ A `jre` tag is a vendor label with no specification behind it.** JEP 220 eliminated the
JRE as a distinct image type; what remains is one vendor's module subset. Never carry an
assumption about `bin/` contents from one registry to another — run `ls "$JAVA_HOME/bin"`
against the exact tag you are pinning.

**★ `-XX:+HeapDumpOnOutOfMemoryError` still works in a JRE image; `jcmd GC.heap_dump` does
not.** The flag is a *VM* feature handled by the launcher, so it survives the removal of
`jdk.jcmd`. The on-demand dump is a *tool*, so it does not. The practical consequence: in a JRE
image you can get a dump when the JVM dies of heap exhaustion, and you cannot get one from a
JVM that is merely sick. And per the man page the flag *"applies only to `OutOfMemoryError`
exceptions caused by Java Heap exhaustion"* — topic 04 owns the other six messages.

**★ JFR is a module, not just a flag.** The API is defined by `jdk.jfr`. If a runtime image was
linked without it, an always-on-JFR strategy (topic 06) is not available in that image no
matter what you put on the command line. Check `java --list-modules` before you design around
JFR, not after.

**★ `jps` is documented as experimental and unsupported.** The man page's first line under the
synopsis is *"Note: This command is experimental and unsupported."* Never build a health check,
sidecar or start-up script on it; use a known PID, or `pgrep`, and remember that in a container
the JVM is usually PID 1 anyway.

**★ The distroless `:debug` tag swaps the JRE for a JDK.** Verified in `java/java.bzl`: the
standard image installs `temurin-NN-jre`, the debug image installs `temurin-NN-jdk`. People
reach for `:debug` for the busybox shell and get the diagnostic tools as an unadvertised bonus
— which also means the `:debug` image is materially larger and materially more exposed. It is
a debugging image, not a production image with a shell.

**★ A JDK in the builder stage tells you nothing about the runtime stage.** Multi-stage
Dockerfiles make this trap easy: `javac`, `jcmd` and `jlink` all exist while you are building
and none of them exist in the shipped layer. Every command you plan to run in production must
be checked against the **final** `FROM`, and the fastest way to be sure is to put the check in
the Dockerfile itself so a bad base image fails the build rather than the incident.

**★ Dropping `jdk.compiler` breaks anything that compiles Java at run time.** JSP containers,
some templating and scripting integrations, and some code-generating libraries invoke a
compiler through `ToolProvider` or the `JavaCompiler` SPI. Whether *your* stack does is a
question about your dependencies, not about Java; the check is cheap and the failure mode is a
runtime exception on a code path nobody exercises in tests.

**★ Minimising the base image and then installing `curl` for a health check undoes the whole
exercise.** A shell plus `curl` is a package manager's worth of attack surface reintroduced for
one HTTP GET. Use the container runtime's own probe (`httpGet` in Kubernetes) rather than
`exec`-ing a binary you had to add.

**★ "Same machine" and "same UID" are separate gates and failing either looks identical.**
`jcmd` will simply not find or not be permitted to reach the target. If a debug container can
see the process in `ps` but `jcmd` still cannot talk to it, you passed gate 1 and failed
gate 2 — check the UIDs before you touch anything else.

**★ You cannot add the tools back at runtime in a distroless or minimal image.** There is no
package manager and, in the non-debug tags, no shell. The decision is made at build time and
the only remedies are a rebuild or an ephemeral container. Plan accordingly instead of
discovering it while a queue backs up.

## Interview questions

**★ Why is it wrong to say "we deploy on the JRE"?**
Because since Java 9 there is no such artifact. JEP 220 eliminated the JRE/JDK image
distinction — *"A JDK image is simply a run-time image that happens to contain the full set of
development tools"* — so anything labelled JRE today is one vendor's choice of module subset.
The useful version of the sentence names what is actually in the image: which modules were
linked, and therefore which tools exist.

**★ Is a runtime that lacks `jcmd` still a conforming Java SE implementation?**
Yes, and this is the crux. `java.se` — *"Defines the API of the Java SE Platform"* — requires
twenty modules and all of them are `java.*`. Every diagnostic tool lives in a `jdk.*` module
outside that aggregation. Conformance says nothing about your ability to take a thread dump.

**★ You are on-call, a pod is wedged, and the image is `:25-jre`. What can you still do?**
Anything the JVM can be told to do without a tool attaching: it will still honour
`-XX:+HeapDumpOnOutOfMemoryError` if it dies of heap exhaustion, it is still emitting whatever
metrics and traces you wired up, and its logs are still flowing. What you cannot do is take a
thread dump on demand — which is the single most useful action for a wedged process. The
recovery path is an ephemeral container with `--target`, run as the app's UID, and the honest
answer in an interview is that you should have rehearsed it.

**★ What two conditions must `jcmd` satisfy, and how does a container break each?**
Verbatim: *"It must be used on the same machine on which the JVM is running, and have the same
effective user and group identifiers that were used to launch the JVM."* A separate container
is not "the same machine" unless the process namespace is shared — `kubectl debug --target`, or
`shareProcessNamespace` on the pod. And a debug container defaults to a different user than an
app container running under a `runAsUser`, so the second condition fails even after the first
passes.

**★ Why does `kubectl exec` not help with a distroless image?**
There is no shell to exec. The Kubernetes documentation names this case for ephemeral
containers: they are for when *"a container image doesn't include debugging utilities, such as
with distroless images."* `kubectl debug` injects a container that has the utilities into the
existing pod, rather than expecting the application image to carry them.

**★ How would you find out what a base image contains without deploying anything?**
Run the image with an overridden entrypoint and use `java --list-modules`,
`ls "$JAVA_HOME/bin"` and `java --describe-module jdk.jcmd`. If the image has no shell, read
the publisher's build definition — the distroless project's `java/java.bzl` states outright
which Debian package each tag installs, and that is stronger evidence than any tag name or
README.

**★ Eclipse Temurin ships JRE images and then recommends you not use them. Why?**
Their documentation says *"it is recommended that you produce a custom JRE-like runtime using
`jlink`."* A vendor JRE is one fixed compromise chosen for everyone; `jlink` lets you keep
exactly the modules your application and your runbook need — including `jdk.jcmd` if you decide
diagnosability is worth the bytes. That is a per-service decision and only you can make it.

**★ What is the difference between `gcr.io/distroless/java25-debian13` and its `:debug` tag?**
The debug tag adds a busybox shell — and, per the project's own build file, installs the
Temurin **JDK** package where the standard tag installs the **JRE** package. It is a different
runtime, not an annotated one, and it should not be what production runs.

**★ Someone proposes shipping the JDK image "because debugging matters more than size". How do
you evaluate that?**
On its own terms it is defensible; the failure is treating it as free. The cost is scanner
noise and provenance burden — distroless' phrasing is that minimisation *"improves the signal
to noise of scanners (e.g. CVE)"* — and every JDK tool you ship is one more component someone
must triage on a CVE announcement. The better trade is usually to keep the small image and
build an out-of-process diagnostic path: JFR to a volume, dumps to a mounted directory,
metrics and traces. Then the tools are not needed at 03:00 in the first place.

{/* FOOTER */}
