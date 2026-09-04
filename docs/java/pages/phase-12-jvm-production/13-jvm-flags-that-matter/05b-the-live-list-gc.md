---
title: "Selecting a collector is a decision you earn with a measurement, not one you inherit — and on JDK 25 the whole -XX:+PrintGC* family is gone, replaced by one -Xlog flag that most inherited strings have never heard of"
sidebar_label: "05b · The live list — GC"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 HotSpot GC Tuning Guide
> ([Ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html)), quoted
> verbatim for the default-collector rule, and this phase's version spine in
> `../_PHASE-NOTES.md` (verified 2026-08-31) for the JEP numbers behind the ZGC and
> Shenandoah changes. Target: **JDK 25 (LTS)**. Documentation-validated;
> **no sandbox run**.

**Garbage-collection flags are where inherited strings are most confidently wrong, because GC
is the area where the JVM has changed most and where the internet's advice is oldest. Three
things are true on JDK 25 that invalidate most of what is written down: the entire
`-XX:+PrintGC*` logging family has been replaced by a single `-Xlog` flag, ZGC has exactly one
mode and the flag people still paste to enable the "new" one is obsolete, and the default
collector is chosen by a hardware test that a small container fails. The flag worth keeping in
this group is the logging one. Collector selection is a decision you should be able to justify
with a measured pause problem — and if you can, it is one flag, not five.**

## Selecting a collector

The tuning guide states the default plainly:

> *"Garbage-First (G1) Collector on server-class machines, Serial Collector otherwise."*

The collectors available on JDK 25 are **Serial, Parallel, G1 and ZGC**, with G1 the default
on anything that passes the server-class test — *"two or more processors and physical memory
larger than or equal to 1792 MB"*, both conditions required. `03-ergonomics.md` covers that
cliff and why a container reaches it far more easily than a server does.

| Flag | When it is the right answer |
|---|---|
| *(none)* | 🔴 **The default answer.** G1 on anything server-class |
| `-XX:+UseZGC` | A measured pause problem G1 could not meet, usually on a large heap |
| `-XX:+UseParallelGC` | Throughput batch work where pause length genuinely does not matter |
| `-XX:+UseSerialGC` | Small heap, one CPU — and ergonomics already picks it there |

🔴 **"No collector flag" is a position, not an omission.** A service with no collector flag is
running the collector the JVM chose from the machine it is on, and that choice tracks the
machine when the machine changes. A hard-coded collector does not.

### ⚠️ Shenandoah is not universally available

Shenandoah is an OpenJDK collector that **is not in every build**. Oracle's JDK does not ship
it; Temurin and Red Hat's builds do. So `-XX:+UseShenandoahGC` is a flag that works on one
vendor's image and **aborts the launch** on another at the same version — which is one of the
few ways "the same Java 25" produces genuinely different behaviour.

Its generational mode became a **product** feature in JDK 25 via **JEP 521**, but it is still
**not** Shenandoah's default. All three of those facts need saying together; material that
presents Shenandoah as a universally available drop-in is wrong on the first one.

## 🔴 ZGC is generational, and there is no other kind

This is the single most out-of-date piece of advice in circulation:

- Generational ZGC became the **default** ZGC mode in **JDK 23** (JEP 474).
- The **non-generational mode was removed in JDK 24** (JEP 490).
- Therefore on JDK 25, `-XX:+UseZGC` **is** generational ZGC. There is nothing to enable.

Every article telling you to *"enable generational ZGC with `-XX:+ZGenerational`"* is pre-24.

⚠️ **And `-XX:-ZGenerational` does not fail the launch — it is obsolete, so it warns and is
ignored.** This corpus's own `_PHASE-NOTES.md` item 1 says the flag *"will not even parse"*,
and that is wrong in a way that costs you time: you would go looking for a launch failure that
never happens, while the actual symptom is a warning line nobody reads and a flag doing
nothing. The distinction between *removed* and *obsolete* is exactly the one
`01-the-flags-you-inherited.md` sets up, and this is its most consequential live instance.

## `-XX:MaxGCPauseMillis` is a goal, not a guarantee

```bash
-XX:MaxGCPauseMillis=200
```

G1 treats this as a **target** it will trade other things to approach — chiefly throughput and
heap sizing. It is not a bound, nothing enforces it, and the JVM will not fail or warn when it
is missed.

The failure mode is that it is a real knob with real effects, so setting it aggressively
*does* change behaviour — just not always the behaviour you wanted. Ask for 10 ms and G1 will
shrink its young generation to try to comply, collecting far more often, which can cost more
total pause time and considerably more CPU than the 200 ms default would have. **A pause
target below what the workload can support degrades throughput without delivering the pause.**

Set it when you have a stated latency requirement and a measurement showing the default misses
it. Otherwise it is a number someone typed.

## 🔴 The logging flags: one `-Xlog`, not the `PrintGC*` family

Every one of these is **gone**, and they are the most common fossils in an inherited string:

| Retired | Replacement |
|---|---|
| `-XX:+PrintGCDetails` | `-Xlog:gc*` |
| `-XX:+PrintGCTimeStamps` | `-Xlog:gc*::time` (a decoration) |
| `-XX:+PrintGCDateStamps` | `-Xlog:gc*::time` |
| `-Xloggc:<file>` | `-Xlog:gc*:file=<path>` |
| `-XX:+PrintTenuringDistribution` | `-Xlog:gc+age*` |

Unified logging replaced the lot. Note it is `-Xlog` — an **`-X`** option, not `-XX` — so a
large slice of what used to be `-XX` GC configuration now lives behind a single `-X` flag.
`02-the-three-kinds.md` covers why that boundary looks arbitrary.

The form worth keeping:

```bash
-Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags
```

Read as four colon-separated parts: **what** (`gc*` — the `gc` tag and everything under it),
**where** (`file=…`), **decorations** (`time,uptime,level,tags`), and an optional fifth for
file rotation. `uptime` is the one people omit and then miss, because correlating a pause
against process age is most of what you do with a GC log.

⚠️ **`-Xlog:gc*` is not free but it is cheap**, and it is the difference between diagnosing a
pause problem and guessing at one. Of everything on this page it is the flag most worth having
before you need it — a GC log you did not enable is the one piece of evidence you cannot
reconstruct after the fact.

## Gotchas

**★ Symptom: a JDK upgrade aborts the launch, and the offending flag is `-XX:+PrintGCDetails`
or `-Xloggc:`.** Cause: the `PrintGC*` family was removed; unified logging replaced it, and an
unrecognised `-XX:` option is a hard error. Fix: translate rather than delete — the intent was
a GC log and you still want one.

```bash
# Before (removed):
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/var/log/app/gc.log
# After:
-Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags
```

**★ Symptom: `-XX:+ZGenerational` is in the string, the service starts normally, and someone
concludes the flag is fine.** Cause: it is obsolete, not removed — accepted, warned about,
ignored. On JDK 25 `-XX:+UseZGC` is already generational, so the flag has nothing to do. Fix:
delete it. It is inert either way, but it is also a signal that the whole string predates
JDK 24 and the rest of it deserves the same scrutiny.

**★ Symptom: `-XX:MaxGCPauseMillis=10` is set and pauses are longer than before, with
throughput visibly worse.** Cause: the target is a goal G1 trades other things to chase. Asked
for something the workload cannot support, it shrinks the young generation and collects far
more often, spending more total time in GC without meeting the target. Fix: raise it to
something the workload can actually deliver, or remove it and measure the default first.
Nothing enforces this number, so an unachievable one is pure cost.

**★ Symptom: `-XX:+UseShenandoahGC` works on a developer laptop and aborts the launch in CI.**
Cause: Shenandoah is not in every OpenJDK build — Oracle's JDK does not ship it, Temurin and
Red Hat's do. Same version, different vendor, flag absent. Fix: pin the *build* rather than
the version across all environments, and verify the collector is present rather than inferring
it from the major version.

**★ Symptom: a service switched to ZGC for latency and now uses noticeably more memory.**
Cause: this is the trade, not a fault — ZGC's concurrent work costs footprint and CPU to buy
short pauses. Fix: none required if the pause requirement is real. But it should have been a
measured decision: if nobody can produce the pause measurement that motivated the switch, the
right move is to go back to the default and re-measure.

**★ Symptom: an incident needs a GC log and there is none, so the flag is added and the
service restarted.** Cause: the restart destroyed the state that caused the problem, and the
new log starts from a healthy process. Fix: there is no fix after the fact — this is the
argument for `-Xlog:gc*` being on by default. It is cheap, and the evidence it produces cannot
be reconstructed retroactively.

**★ Symptom: two services on identical flags show different GC behaviour, and the flags are
identical because someone checked.** Cause: the flags being identical is the point — the
*collector* may not be. Ergonomics chooses from processor count and memory limit, so a
container below the server-class threshold is running Serial while its sibling runs G1, with
no flag difference to see. Fix: compare the resolved collector, not the strings.

```bash
jcmd <pid> VM.flags | tr ' ' '\n' | grep -i 'UseG1GC\|UseSerialGC\|UseZGC\|UseParallelGC'
```

**★ Symptom: a GC log exists but timestamps cannot be correlated with an incident.** Cause:
decorations were left at their defaults, so the log has no wall-clock time or process uptime.
Fix: name the decorations explicitly — `time` for wall clock, `uptime` for process age. This
costs nothing to set and cannot be added to a log already written.

## Interview questions

**★ Which collector does JDK 25 use by default, and what decides it?**
The tuning guide says *"Garbage-First (G1) Collector on server-class machines, Serial Collector
otherwise"*, and server-class is a specific hardware test: two or more processors **and**
physical memory of at least 1792 MB, both required. The available collectors are Serial,
Parallel, G1 and ZGC. What makes this worth knowing precisely rather than as "G1 is the
default" is containers — HotSpot reads the cgroup limit, so an ordinary 1 CPU or 1.5 GiB pod
fails the test and silently runs Serial. That is a different latency profile arriving with no
flag, no log line and no configuration change to point at.

**★ How do you enable generational ZGC on JDK 25?**
You do not — there is nothing to enable. Generational ZGC became the default ZGC mode in
JDK 23 and the non-generational mode was **removed** in JDK 24, so on JDK 25 `-XX:+UseZGC`
*is* generational ZGC. The question is worth asking precisely because the wrong answer,
`-XX:+ZGenerational`, is still the top result in most searches. The follow-up that separates
people who have read the release notes from people who have read a blog is what that flag does
now if you pass it: it does not fail the launch. It is **obsolete** — accepted, warned about,
ignored — so a service carrying it starts normally and looks fine, which is exactly why it
survives in inherited strings.

**★ Is `-XX:MaxGCPauseMillis` a guarantee?**
No. It is a goal that G1 trades other things to approach — primarily throughput and heap
sizing — and nothing enforces it, fails on it, or warns when it is missed. The practical
consequence is the opposite of harmless: because it is a real knob, setting it aggressively
does change behaviour, just not always usefully. Asking for 10 ms on a workload that cannot
support it makes G1 shrink the young generation and collect much more frequently, which can
increase total pause time and CPU while still missing the target. It earns its place when
there is a stated latency requirement and a measurement showing the default misses it;
otherwise it is a number with costs and no benefit.

**★ An inherited string has `-XX:+PrintGCDetails -Xloggc:/var/log/gc.log`. What happens on
JDK 25 and what do you do?**
The launch aborts. That whole family was removed when unified logging replaced it, and an
unrecognised `-XX:` option is a hard error rather than a warning — so this is a
CrashLoopBackOff, not a degraded service. The fix is a translation rather than a deletion,
because the intent was a GC log and you still want one:
`-Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags`. Two details worth carrying: it is
`-Xlog`, an `-X` option rather than `-XX`, so a large slice of former `-XX` GC configuration
now sits behind one `-X` flag; and the decorations must be named explicitly, because a log
without `time` and `uptime` cannot be correlated with an incident and that cannot be fixed
after the log is written.

**★ Should a production service pin its garbage collector?**
Usually not, and the reasoning mirrors the general ergonomics argument. Not pinning means the
JVM picks from the machine it is actually on and keeps tracking that choice as the machine
changes; pinning freezes a decision made against one machine shape. Pinning is justified when
there is a measured pause problem the default could not meet — that is a real and common
situation on large heaps, and ZGC exists for it. What is not justified is inheriting a
collector flag nobody can attribute to a measurement, and the tell is easy to check: ask what
the pause requirement was and what the default actually delivered. If neither answer exists,
the flag is a fossil. The sharp edge to know is that *not* pinning is not the same as *always
getting G1* — below the server-class threshold, not pinning gets you Serial.

{/* FOOTER */}
