---
title: "An -Xmx baked into a container image is a constant that has to be right for every memory limit the image will ever run at, and it silently disables the one mechanism that would have got it right automatically"
sidebar_label: "03c · Why not -Xmx"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — `-Xmx`, `-Xms`, and
> "Using the JDK_JAVA_OPTIONS Launcher Environment Variable"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); the
> **JVM Tool Interface specification, version 25**, section `JAVA_TOOL_OPTIONS`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/jvmti.html)); the
> **JDK 25 `jcmd` tool reference** for `VM.command_line` and `VM.flags`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)); and
> `Arguments::set_heap_size` in
> [`runtime/arguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/arguments.cpp)
> at tag `jdk-25+36`.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`-Xmx` is not wrong. `-Xmx` decided at *image build time* is wrong, because an image is
deployed at many memory limits and a constant can only be correct at one of them. Worse, it fails
in opposite directions on either side of that one point — wasted memory above it, an OOMKill loop
below it — and it does so while suppressing the percentage-based ergonomics that would have
adapted, with no warning and no log line. This page is about where the constant comes from, why
nobody notices it, and what to do when you genuinely do want an absolute number.**

## The line that causes it

```dockerfile
FROM eclipse-temurin:25-jre
COPY target/app.jar /app.jar
ENV JAVA_OPTS="-Xmx512m"
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app.jar"]
```

Written by somebody who tested at a 1 GiB limit, where 512 MiB of heap was about right. Then:

- deployed at **4 GiB**, it uses 512 MiB of heap and leaves roughly 3 GiB idle. GC runs
  constantly, latency is poor, and the team concludes they need more replicas.
- deployed at **256 MiB**, the heap ceiling alone exceeds the limit. The JVM will start —
  `-Xmx` is a ceiling, not a reservation — and then die the first time the live set grows.
  [01 · The OOMKilled loop](01-the-oomkilled-loop.md).
- deployed anywhere, it **disables `MaxRAMPercentage` entirely**, because
  `Arguments::set_heap_size()` guards the whole percentage path with
  `if (FLAG_IS_DEFAULT(MaxHeapSize))`. Someone can add `-XX:MaxRAMPercentage=70` to the Helm
  chart, observe no change, and have no diagnostic to explain it.

The fix is one character shorter:

```dockerfile
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70"
```

## Where the flag you did not write comes from

By the time a JVM starts in Kubernetes there are typically five sources of options, and they do
not all behave the same way.

| Source | Behaviour | Documented in |
|---|---|---|
| `JDK_JAVA_OPTIONS` | *"prepends its content to the options parsed from the command line"* | `java` man page |
| `JAVA_TOOL_OPTIONS` | *"JNI_CreateJavaVM … will prepend these options to the options supplied in its `JavaVMInitArgs` argument"* | JVM TI spec |
| `_JAVA_OPTIONS` | legacy, also prepended | **not in the JDK 25 man page** — do not rely on it |
| The image's `ENV`/`ENTRYPOINT` | expanded by the shell into the command line | your Dockerfile |
| The pod spec's `env` / `args` | overrides the image `ENV` of the same name | your manifest |

The important structural fact: the environment-variable sources **prepend**, and HotSpot resolves
duplicate options **last one wins**. So a command-line `-Xmx` beats one from
`JAVA_TOOL_OPTIONS`, and a pod-spec `JAVA_OPTS` that replaces the image's `ENV JAVA_OPTS` beats
the image's — but a `JAVA_TOOL_OPTIONS` set by a base image and a `JAVA_OPTS` set by your chart
are two different variables and do **not** override each other. They concatenate, and the last
`-Xmx` in the resulting sequence is the one that takes effect.

The man page also notes that with `JDK_JAVA_OPTIONS` set, *"the launcher prints a message to
stderr as a reminder"*. There is no such courtesy from an `ENV` in a Dockerfile.

Two details worth carrying:

- The JVM TI specification says the reference implementation **disables `JAVA_TOOL_OPTIONS` on
  Unix when the effective user or group ID differs from the real ID**. A setuid wrapper therefore
  silently drops it.
- It also says *"the variable should not be overwritten, instead, options should be appended to
  the variable"* — which is exactly what buildpack-produced images assume, and exactly what a
  chart that sets `JAVA_TOOL_OPTIONS` outright breaks.

## Proving what the process actually got

```bash
# what the launcher was handed, including options from the environment
jcmd <pid> VM.command_line

# what the JVM ended up with, and who set each one
jcmd <pid> VM.flags -all
java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|MaxRAMPercentage'
```

`VM.command_line` is documented as *"Print the command line used to start this VM instance"* and
`VM.flags` as *"Print the VM flag options and their current values"*, both `Impact: Low`. Between
them there is no configuration mystery left: the first shows the inputs, the second shows the
resolution and marks each value `{default}`, `{command line}` or `{ergonomic}`.

## When an absolute `-Xmx` is the right answer

There is a legitimate case, and it is not the Dockerfile. It is: **compute the absolute number at
container start, from the limit that actually exists, then pass it.** That is precisely what
Cloud Native Buildpacks do — [04c · The buildpack memory calculator](04c-the-memory-calculator.md)
— and the reason they do it is that they can account for metaspace and thread stacks
individually instead of lumping everything into "the other 30 percent".

If you want that without a buildpack, the shape is:

```sh
#!/bin/sh
# entrypoint.sh — derive an absolute heap from the cgroup limit at START, not at BUILD
LIMIT=$(cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null)
case "$LIMIT" in
  ''|max|*[!0-9]*) exec java $JAVA_OPTS -jar /app.jar ;;   # no limit: let ergonomics decide
esac
NATIVE=$((400 * 1024 * 1024))                              # measured, not guessed
HEAP=$(( (LIMIT - NATIVE) / 1024 / 1024 ))
exec java -Xmx${HEAP}m $JAVA_OPTS -jar /app.jar
```

Three things about that script are load-bearing. It reads the **v2 path first and falls back to
v1**. It **bails out to ergonomics when there is no limit**, rather than computing nonsense. And
`NATIVE` is a number you measured with Native Memory Tracking for *this* service, not a constant
copied from a blog — the measurement is
[11b · The NMT baseline workflow](../01-memory-layout/11b-the-nmt-baseline-workflow.md), and the
list of things it has to cover is [04 · The memory budget](04-the-memory-budget.md).

For almost everyone, `-XX:MaxRAMPercentage` is the same decision with none of the script.

## Gotchas

**★ `-Xmx` does not reserve memory, so an over-large `-Xmx` starts fine.**
The JVM reserves address space and commits lazily. `-Xmx4g` in a 512 MiB container launches
happily and dies later, under load, in production, at a moment unrelated to the deploy. That
delay is what makes this bug survive review — nothing fails at rollout.

**★ `-Xms` equal to `-Xmx` turns a latent bug into an immediate one, which is an improvement.**
With `-Xms` equal to `-Xmx` the JVM commits the full heap at startup. In a container that is too
small, it fails immediately and visibly instead of six hours later. That is a legitimate use of
`-Xms`: converting a silent misconfiguration into a fast one. Pair it with
[09 · `AlwaysPreTouch`](09-alwayspretouch.md) to also touch the pages, which turns "committed" into
"actually resident" and removes the last hiding place.

**★ `-Xmx` and `-XX:MaxRAMPercentage` in the same command line is not a conflict the JVM
reports.**
`-Xmx` wins, silently. There is no warning even at `-Xlog:gc+heap=debug`. The only evidence is
`MaxHeapSize` showing `{command line}` in `PrintFlagsFinal`.

**★ `-Xmx` is `MaxHeapSize`, and setting either sets both.**
So a chart that sets `-XX:MaxHeapSize=2g` and a Dockerfile that sets `-Xmx1g` are competing for
the same flag; last wins. Searching your configuration for the literal string `-Xmx` will miss
the other spelling. Search for `MaxHeapSize` too.

**★ Base images set `JAVA_TOOL_OPTIONS`, and it is invisible in your manifest.**
Several vendor and buildpack-produced base images set it. A `docker inspect` of the image
`Config.Env` is the fastest way to find one; `jcmd VM.command_line` on the running process is the
definitive one.

**★ An absolute heap computed from the limit at *build* time is the same bug wearing a script.**
A Maven or Gradle step that writes `-Xmx` into the image based on the developer's laptop, or a CI
job that reads the build agent's memory, produces exactly the constant this page is about. The
number has to come from the cgroup at container start or from a percentage.

**★ Removing `-Xmx` from a service that has always had it will change its heap size, possibly a
lot.**
Deleting the flag hands sizing back to ergonomics, and the default is 25 percent. If the old
`-Xmx` was 70 percent of the limit, removing it *without* adding `MaxRAMPercentage` is a large,
unannounced heap reduction. Always replace, never just delete.

**★ `_JAVA_OPTIONS` is not documented in the JDK 25 man page.**
It still works on HotSpot, which means somebody's shell profile or CI runner can inject flags
into every JVM on the box. Because it is undocumented, it is also the last place anyone looks. If
`VM.command_line` shows options nobody claims, check it.

**★ Shell-form `ENTRYPOINT` changes more than option parsing.**
`ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app.jar"]` makes `sh` PID 1 and, unless `exec` is
used, the JVM becomes a child that does not receive `SIGTERM` directly. That is a graceful
shutdown problem rather than a sizing one — **12 · Graceful shutdown** *(not written yet)* — but
it lives in the same line of the same Dockerfile, so fix both at once with `exec java ...`.

## Interview questions

**★ Why is `-Xmx` in a Dockerfile considered a bug?**
Because a Dockerfile is built once and the image runs at many memory limits. A constant can be
correct at exactly one limit; above it you waste memory and GC harder than you need to, below it
the heap ceiling exceeds the container limit and you get an OOMKill loop. And it is not a passive
mistake: setting `-Xmx` makes `FLAG_IS_DEFAULT(MaxHeapSize)` false, which disables the entire
percentage-based ergonomic path in `Arguments::set_heap_size()` with no warning, so anyone who
later adds `MaxRAMPercentage` to fix the problem sees no effect at all.

**★ Someone insists their service needs a precise heap number, not a percentage. Are they wrong?**
Not necessarily — they are wrong about *when* to compute it. A precise number derived from a
measured native footprint is better than a percentage, because it accounts for metaspace, code
cache and stacks individually rather than by a single fudge factor. But it has to be computed at
container start from the cgroup limit that is actually in force. That is what the buildpack memory
calculator does. Baked into an image, the same number is a constant that will be wrong at the next
limit change.

**★ A flag is being applied that appears nowhere in your Helm chart or Dockerfile. How do you find
it?**
`jcmd <pid> VM.command_line` shows what the launcher was actually given, including everything
prepended from `JDK_JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS` and `_JAVA_OPTIONS`;
`jcmd <pid> VM.flags -all` shows the resolved values with their provenance. Working backwards,
the usual sources are a base image's `ENV JAVA_TOOL_OPTIONS`, a buildpack launcher, an APM or
profiler agent's installation script, and the undocumented `_JAVA_OPTIONS` set somewhere in the
platform.

**★ What is the precedence between `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS` and the command line?**
Both environment variables *prepend* their contents — `JDK_JAVA_OPTIONS` at the launcher level and
`JAVA_TOOL_OPTIONS` at the `JNI_CreateJavaVM` level — and HotSpot resolves duplicate options with
last-one-wins. So the command line beats both for any option specified in more than one place.
The subtlety is that they are separate variables: setting one does not override the other, and an
image that sets `JAVA_TOOL_OPTIONS` while your chart sets `JAVA_OPTS` produces a concatenation,
not a replacement. The JVM TI specification also warns that the variable should be appended to
rather than overwritten, and that the reference implementation ignores it entirely when the
effective and real user IDs differ.

**★ Is there any situation where you would set `-Xms` equal to `-Xmx` in a container?**
Yes, for two reasons that have nothing to do with performance folklore. First, it makes a sizing
mistake fail fast: the heap is committed at startup, so a heap ceiling that does not fit the
container kills the pod at rollout rather than at 3 a.m. Second, it removes heap expansion from
the startup path, which matters when your readiness probe is competing with cache warming. The
cost is that the container's charged memory is at its maximum from the first second, so a
node-level bin-packing strategy that relied on gradual growth stops working.

{/* FOOTER */}
