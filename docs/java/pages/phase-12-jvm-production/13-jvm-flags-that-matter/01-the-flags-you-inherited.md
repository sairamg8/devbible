---
title: "The JAVA_OPTS you inherited is a fossil record, not a configuration — every flag in it was added by someone solving a problem you cannot see, on a JVM that no longer exists"
sidebar_label: "01 · The flags you inherited"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference
> ([Oracle](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) for the
> option classes and the unlock flags, and the JVM TI 25 specification
> ([`JAVA_TOOL_OPTIONS`](https://docs.oracle.com/en/java/javase/25/docs/specs/jvmti.html)).
> Target: **JDK 25 (LTS)** · Spring Boot 4.1.0. Documentation-validated; **no sandbox run**.

**Almost every production Java service runs with a `JAVA_OPTS` string that nobody currently
employed can fully explain. It was not designed; it accreted — one flag per incident, each
added by an engineer who was right at the time, on a JVM two or three LTS releases back,
and never removed because removing it felt riskier than keeping it. That string is now
three different kinds of wrong at once: flags that no longer exist and will stop the
process from starting, flags that still parse but do nothing, and flags that work exactly
as documented and are actively fighting the ergonomics the JVM would have chosen for
itself. This topic is the inventory and the discipline. It owns the flag list for the whole
phase — every other topic uses flags and links here rather than repeating a status.**

## The artefact

A real shape, reconstructed from the pattern rather than from any one employer's config:

```bash
JAVA_OPTS="-Xms2g -Xmx2g \
  -XX:+UseConcMarkSweepGC \
  -XX:+CMSParallelRemarkEnabled \
  -XX:PermSize=256m -XX:MaxPermSize=512m \
  -XX:+PrintGCDetails -XX:+PrintGCTimeStamps \
  -Xloggc:/var/log/app/gc.log \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/app"
```

Nine flags. On **JDK 25**, exactly two of them are still both valid and a good idea, one is
valid and probably wrong for a container, and six are removed — which means this string
does not start a JVM at all. It is not "mostly fine with some legacy in it". It is a
launch failure.

That is the first thing to internalise about inherited flags: **the failure is usually
total, not partial.** An unrecognised `-XX:` option aborts the launch. You do not get a
degraded service; you get a container that exits before your first log line, in a
CrashLoopBackOff, with an error message about a flag nobody has thought about since 2016.

## How a flag string rots — the four mechanisms

A flag does not simply "become old". It leaves by one of four doors, and **which door it
went through decides what happens to you**, so the distinction is not pedantry:

| Door | What the JVM does on JDK 25 | What you see |
|---|---|---|
| **Removed** | Refuses to start | Launch aborts: unrecognised option |
| **Obsolete** | Accepts, ignores, warns | Service starts; a warning nobody reads; the flag has no effect |
| **Deprecated** | Accepts, honours, warns | Service starts and behaves; a warning that it will stop working |
| **Still valid** | Accepts and honours it — completely | Everything "works", and your tuning may be worse than the default |

The fourth row is the one that catches good engineers. `-Xmx2g` is not deprecated, not
obsolete and not removed. It is a fully supported flag that does exactly what it says. It
is also, in a container, very often the wrong instrument — because it hard-codes a number
that the platform already knows and can change under you. Nothing warns you about that.
Nothing ever will.

## Why removal is a launch failure, and why that is the friendly outcome

The JDK 25 tool reference is explicit that `-XX` options are not a stable interface:

> *"These options aren't guaranteed to be supported by all JVM implementations and are
> subject to change. Advanced options start with `-XX`."*

The launcher takes that seriously. An `-XX:` option it does not recognise is a hard error,
not a warning. It feels hostile the first time and it is the correct design: a flag that
silently did nothing would let you believe for two years that you had tuned something.

The dangerous door is **obsolete**, precisely because it is polite. The process starts. The
dashboards are green. And the flag you are relying on has been inert since the release that
obsoleted it. `-XX:+ZGenerational` is the current example worth knowing: on JDK 25 it is
accepted with a warning and does nothing, because generational mode became the only ZGC
mode. A page that tells you it "will not parse" is wrong in a way that matters — you would
go looking for a launch failure that never happens.

⚠️ **This distinction is the whole reason topic 13 exists as a topic.** Nine other topics in
this phase name flags. If each of them carried its own status claim, they would drift apart
within two releases. Status is recorded **here, once**, per flag, with the release that
changed it.

## The three questions that retire a flag

You cannot audit a flag string by reading it. You audit it by asking three questions per
flag, in this order, and the order matters because a "no" at any step ends the enquiry:

1. **Does it still exist on the JVM we actually run?** Not on the JVM the wiki describes.
   This is answerable mechanically and the answer is not a matter of opinion —
   `06-the-retired-list.md` *(not written yet)* holds the inventory, and
   `04-printflagsfinal.md` *(not written yet)* is how you ask the running JVM directly
   rather than trusting any document, this one included.
2. **What problem was it added for, and does that problem still exist?** A flag added to
   work around a JDK 8 metaspace leak is not a tuning decision on JDK 25; it is a
   fossilised bug report. If nobody can name the incident, the flag has no owner and no
   evidence.
3. **Is the JVM's own default now better than our number?** Ergonomics moved a long way.
   `03-ergonomics.md` *(not written yet)* argues this properly: the honest default position
   on JDK 25 is *fewer* flags, and each one you keep should be able to name its measurement.

**A flag that fails any of the three comes out.** Not "gets reviewed next quarter" — comes
out, in a change small enough that the rollback is obvious.

## What replaces the fossil

The same intent, expressed in flags that exist on JDK 25 and survive being moved between
container sizes:

```bash
JAVA_OPTS="-XX:MaxRAMPercentage=75.0 \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/app \
  -Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags"
```

Four flags where there were nine, and every one of them can name its reason:

- **`-XX:MaxRAMPercentage=75.0`** — a share of the *cgroup* limit rather than a fixed
  number, so one image is correct at every memory size the platform gives it. Topic 03
  owns the container arithmetic and the OOMKilled-versus-`OutOfMemoryError` distinction;
  `05-the-live-list-memory.md` *(not written yet)* covers the flag itself.
- **`-XX:+HeapDumpOnOutOfMemoryError` + `-XX:HeapDumpPath`** — the two survivors from the
  original string. They cost nothing until the day they are the only evidence you have.
- **`-Xlog:gc*`** — unified logging, which replaced the whole `-XX:+PrintGC*` family. Note
  it is `-Xlog`, an `-X` option, not `-XX`.

No collector is selected. **That is deliberate, not an omission.** G1 is the default on
JDK 25 on most configurations, and choosing a collector is a decision you make after
measuring a pause-time problem, not one you inherit. `05b-the-live-list-gc.md`
*(not written yet)* covers when that changes.

## Gotchas

**★ Symptom: the container exits immediately after a JDK upgrade, with no application log
output at all, and restarts forever.** Cause: an `-XX:` flag in the inherited `JAVA_OPTS`
was removed in some JDK between the old version and the new one. The launcher aborts before
the application starts, so there is nothing in the application log by construction — the
message is on the container's stderr, which many log pipelines drop for a process that
exits during startup. Fix: read the container's own stderr rather than the shipped log, and
bisect the flag string rather than the JDK.

```bash
# Ask the JVM to parse the flags and exit, instead of deploying to find out.
java $JAVA_OPTS -version
```

That single line is the cheapest audit in this topic. It parses the entire string and exits.
If it prints a version banner, the string starts a JVM; if it aborts, it names the flag.

**★ Symptom: a flag is definitely in `JAVA_OPTS`, the service starts fine, and the
behaviour it should produce never appears.** Cause: the flag is *obsolete* — accepted,
warned about, and ignored — so nothing fails and nothing happens. Alternatively the
variable itself is not reaching the JVM at all (see the next gotcha). Fix: do not reason
about it, ask the running process what it actually has:

```bash
jcmd <pid> VM.flags        # what the JVM ended up with
jcmd <pid> VM.command_line # what it was actually launched with
```

`04b-vm-flags-on-a-running-process.md` *(not written yet)* covers the difference between
those two, which is exactly the difference between what you asked for and what you got.

**★ Symptom: `JAVA_OPTS` is set in the deployment manifest and the JVM ignores it
completely.** Cause: `JAVA_OPTS` is **not a JVM variable**. The JVM has never read it. It
is a convention honoured by startup scripts — Tomcat's `catalina.sh`, Maven, Gradle, many
Docker entrypoints — and if your image runs `java -jar app.jar` directly, nothing expands
it. The JVM's own variables are `JDK_JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS` and `_JAVA_OPTIONS`.
Fix: either reference it explicitly in the entrypoint, or use a variable the JVM reads by
itself:

```dockerfile
# Broken: JAVA_OPTS is set and never expanded by anything.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

# Works: the launcher itself reads JDK_JAVA_OPTIONS and prepends it.
ENV JDK_JAVA_OPTIONS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

🔴 The exec-form `ENTRYPOINT` above is the common trap: there is no shell, so `$JAVA_OPTS`
would not expand even if you wrote it. `07-where-flags-come-from.md` *(not written yet)*
owns the four sources and their precedence.

**★ Symptom: the same flag string behaves differently on two nodes running "the same
Java".** Cause: "the same Java" is doing a lot of work in that sentence. Vendor builds
differ in which collectors they ship — Shenandoah is an OpenJDK collector that is not in
every build; Oracle's JDK does not ship it, Temurin and Red Hat's builds do. A
`-XX:+UseShenandoahGC` that works on one image aborts the launch on another. Fix: pin the
*build*, not just the version, and verify the collector is present rather than assuming
the major version implies it.

**★ Symptom: an audit removes a flag, and a latency regression appears two weeks later.**
Cause: the flag was load-bearing and its reason had simply never been written down —
question 2 of the three was answered "nobody knows" and treated as "no reason". Fix:
"nobody can explain it" is not the same as "it does nothing". Remove flags one at a time,
with the metric that would show the regression already on a dashboard, and record the
removal where the next person will find it. `08-the-discipline.md` *(not written yet)* is
this rule written as a practice: one flag, one reason, one measurement, written down.

**★ Symptom: `-Xmx` was raised to fix an `OutOfMemoryError` and the pod now gets OOMKilled
instead.** Cause: `-Xmx` bounds the Java heap only. Metaspace, code cache, thread stacks, GC
structures, direct and mapped buffers and the native allocator all live outside it, so
raising the heap ceiling raises the *process* footprint past the cgroup limit and the
kernel kills the container. Fix: this is topic 03's subject and it is the single most
misdiagnosed production symptom in the phase — set a percentage of the container limit
rather than an absolute, and measure the native footprint with Native Memory Tracking
(`-XX:NativeMemoryTracking=summary`, then `jcmd <pid> VM.native_memory summary`) rather
than with a heap dump.

**★ Symptom: two engineers reading the same `JAVA_OPTS` disagree about whether a flag is
active, and both are partly right.** Cause: a flag can legally appear more than once, from
more than one source, and the JVM resolves that by a rule neither of them stated. Fix: stop
arguing about the string and read the resolved value — `-XX:+PrintFlagsFinal` at launch, or
`jcmd VM.flags` on the running process, is the authority. Every later topic in this chunk
set is downstream of that habit.

## Interview questions

**★ Why does an unrecognised `-XX:` flag abort the JVM instead of being ignored with a
warning?**
Because `-XX` options are explicitly not a supported, stable interface — the tool reference
says they are *"not guaranteed to be supported by all JVM implementations and are subject
to change"*. Given that, silently ignoring an unknown one would be the worse failure: an
operator would believe a tuning was in effect for years while it did nothing. Failing at
launch converts a silent, permanent misconfiguration into a loud, immediate, obvious one,
at the only moment when it is cheap to fix. The JVM does provide an escape hatch for the
case where you genuinely want tolerance — and that escape hatch is itself a trap, which
`06b-the-flag-that-stops-your-jvm-booting.md` *(not written yet)* covers.

**★ What is the practical difference between a *removed*, an *obsolete* and a *deprecated*
flag, and why does the distinction matter operationally?**
Removed means the JVM refuses to start — total, immediate, unmissable. Obsolete means it
starts, warns, and ignores the flag, so you keep believing a setting is in effect that has
no effect at all. Deprecated means it starts, warns, and still honours the flag, so
behaviour is unchanged today and will break at some future release. Operationally they
require three different responses: removed is an emergency you cannot miss, deprecated is a
scheduled piece of work, and obsolete is the genuinely dangerous one because nothing forces
you to notice. The classic live example is `-XX:+ZGenerational` on JDK 25: it is obsolete,
not removed, so it warns and is ignored — and material claiming it "will not even parse"
sends you hunting for a crash that will never occur.

**★ Your service works fine. Should you remove flags from `JAVA_OPTS` anyway?**
Yes, and the argument is about risk rather than tidiness. Every flag is a standing override
of a decision the JVM would otherwise make for itself, and the JVM's decisions improve with
every release while your override is frozen at the day it was added. A flag with no owner
and no recorded reason cannot be evaluated against a new release — so it never is, and it
accumulates. The counter-argument is real and should be respected: removal without
measurement is how you lose a fix nobody documented. The resolution is procedural rather
than philosophical — remove one flag at a time, with the metric that would reveal the
regression already being watched, and write down what you removed and why.

**★ Why is `-XX:MaxRAMPercentage` usually a better instrument than `-Xmx` in a container,
given that `-Xmx` is not deprecated and works exactly as documented?**
Because `-Xmx` encodes an absolute number that duplicates knowledge the platform already
has, and the two copies drift. The JVM has been container-aware since JDK 10 and reads the
cgroup limit directly, so a percentage stays correct when the deployment is resized from
2 GiB to 4 GiB while a hard-coded `-Xmx2g` silently wastes half the new allocation. The
subtler point is that this is not a case of a bad flag: `-Xmx` is fully supported and does
precisely what it promises. It is an example of the fourth failure mode — a flag that is
completely valid and still the wrong tool — which is why an audit cannot just be a search
for deprecated options.

**★ Someone hands you a 400-character `JAVA_OPTS` and a JDK upgrade ticket. What is the
first command you run?**
`java $JAVA_OPTS -version`. It parses the entire flag string against the target JVM and
exits immediately, so it turns a deployment-time discovery into a shell-prompt one and
costs nothing. If it prints a version banner, the string at least starts a JVM on that
release; if it aborts, it names the offending flag directly. It deliberately answers only
the first of the three audit questions — existence — but that is the question whose failure
mode is a CrashLoopBackOff, so it is the right one to answer first. The remaining two
questions, *what was it for* and *is the default now better*, need people and measurements
rather than a command.

**★ Why does this phase keep flag status in one topic instead of stating it wherever a flag
is used?**
Because status is a fact about a *release*, not about a use case, and a fact repeated in ten
places is a fact that will disagree with itself within two releases. Nine other topics in
this phase name flags in passing — GC tuning, container sizing, heap dumps, JFR, native
memory. If each asserted independently whether `-XX:+ZGenerational` still worked, the corpus
would carry contradictory claims and a reader would have no way to tell which page was
maintained. Recording status once, with the release that changed it, means an upgrade
touches one page.

{/* FOOTER */}
