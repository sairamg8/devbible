---
title: "Mission Control is the GUI for reading a recording and it is not simply \"in the JDK\" — it is a separate OpenJDK project shipped by half a dozen vendors, which is why the answer to \"just open it in JMC\" is often that nobody on the team has it"
sidebar_label: "06 · JDK Mission Control"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **OpenJDK Mission Control project README**, from which the
> distribution statements below are quoted verbatim
> ([github.com/openjdk/jmc](https://github.com/openjdk/jmc)), and the **JDK 25 `jfr` tool
> reference** for the command-line alternatives
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)).
> ⚠️ **JMC's version numbering is not pinned on this page.** It releases on its own cadence,
> independent of the JDK, and I did not verify a current version number — check your vendor's
> download page rather than trusting a number written here.
> 🔴 **No sandbox** — no screenshot, panel output or measurement below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**JDK Mission Control is the graphical client for JFR recordings: pages of aggregated views, a
call tree, and an automated analysis that applies a set of rules to a recording and reports what
looks wrong. It is genuinely good, and the first thing to know about it is administrative rather
than technical — it is not part of the JDK you already installed.**

## 🔴 It is a separate download, from whichever vendor you use

The OpenJDK Mission Control README states the distribution position:

> *"Mission Control is an open source production time profiling and diagnostics tool for Java."*
>
> *"Builds of Mission Control can currently be found in the Oracle JDK on supported platforms and
> in the Eclipse Marketplace."*
>
> *"Binary distributions of JDK Mission Control are provided by different downstream vendors."*

and lists them: **Eclipse Adoptium**, **Azul** (Zulu Mission Control), **Bell-Soft** (Liberica
Mission Control), **Oracle**, and **Red Hat**.

**Three consequences that matter more than any feature:**

🔴 **"It ships with the JDK" is true only for the Oracle JDK on supported platforms.** If your
build image is Temurin, Corretto, Zulu or a Red Hat build, `jmc` is very likely not on the machine.
Saying "just open it in JMC" to a team on Temurin means "go and find a download first".

**It versions independently of the JDK.** JMC is its own OpenJDK project with its own release
cadence, so the version you have has no relationship to the JDK you run. A recording from a newer
JDK may contain event types an older JMC does not know how to present specially — though it will
still display them generically, because the recording carries its own schema
([04](04-the-event-model.md)).

**It is an Eclipse RCP application**, distributed through the Eclipse Marketplace as well as by
vendors — which is why it looks like Eclipse and why it is a desktop install rather than something
you run on a server.

## What you do with it

Load a recording file and you get a set of pages. The ones that earn their place:

**Automated Analysis.** A rules engine that scores a recording and reports findings. This is JMC's
distinguishing feature and it is worth its own page —
[06b](06b-reading-the-automated-analysis.md).

**Method Profiling.** The aggregated view of `jdk.ExecutionSample` — hot methods, and a call tree
you can expand. 🔴 **The call tree is the reason to use a GUI at all**: expanding and collapsing
paths interactively is what a terminal does badly, and [07](07-execution-sampling.md) argues that
the tree, not the flat list, is where the actionable answer lives.

**Garbage Collections.** Pause durations, phases and causes over the timeline — useful as a
cross-check against the GC log, which topic 02 owns properly.

**Memory / TLAB.** Allocation by class and by thread, with stacks. This answers "what is producing
garbage", which is the allocation question no thread dump can touch.

**Threads.** A timeline per thread showing states — the JFR complement to
[topic 05](../05-thread-dumps/README.md)'s point-in-time dumps, and considerably better for seeing
*when* something blocked.

**Event Browser.** The raw events, filterable. Where you go for anything the curated pages do not
cover, including your own custom events ([04b](04b-custom-events.md)), which appear here because
the recording describes them.

## The one thing a GUI is genuinely better at

**Correlating across the timeline by eye.**

[04](04-the-event-model.md) argued that a single timeline is JFR's structural advantage. Acting on
that means looking at several event types *at the same instant* — did the latency spike line up
with a GC pause, a class-loading burst, or a lock? Scrolling a timeline with several tracks and
seeing them align is a genuinely visual task, and it is clumsy on a terminal.

⚠️ **Almost everything else is available from the command line** ([05](05-the-jfr-command-line-tool.md)):
`jfr summary` for what is in the file, `jfr view` for the same aggregations the pages show, and
`jfr print --json` for anything bespoke. **The GUI is a convenience for most questions and a real
advantage for correlation.**

## When you cannot use it

This is the common case in production work and worth planning for:

- **No display.** The recording is on a container, reached over SSH.
- **The file is large.** Copying a multi-gigabyte recording to a laptop is slow and sometimes
  prohibited.
- **The data is sensitive.** Moving a production recording onto a personal machine may be a policy
  problem — `jfr scrub` first ([05](05-the-jfr-command-line-tool.md)).
- **JMC is not installed** and getting it approved takes longer than the incident.

🔴 **The answer in all four cases is the command line, and it is a complete answer.** `jfr view` on
the host, or `jcmd <pid> JFR.view` against the live JVM with no file at all, covers the great
majority of questions. **Do not treat "I cannot open JMC" as "I cannot analyse this."**

## Using it well

**Load a baseline alongside the incident recording.** JMC will happily open two recordings, and
almost every judgement is comparative — [07](07-execution-sampling.md) argues profiles rank rather
than measure, and a baseline is what makes a ranking meaningful.

**Start at Automated Analysis, then verify.** Treat its findings as a list of leads to check
against the underlying events, not as conclusions — [06b](06b-reading-the-automated-analysis.md) is
about exactly where it misleads.

**Use the Event Browser when a curated page seems to be hiding something.** The pages are
opinionated aggregations; the browser is the events. If a number on a page does not make sense,
the browser is where you find out why.

**Check the recording's settings.** A page showing nothing may mean the events were never enabled
([03b](03b-settings-profiles.md)), and that is a much more common explanation than the phenomenon
being absent.

## Gotchas

**★ JMC is not part of every JDK.**
The README says builds are *"in the Oracle JDK on supported platforms and in the Eclipse
Marketplace"*, with binaries *"provided by different downstream vendors"* — Adoptium, Azul,
Bell-Soft, Oracle, Red Hat. On a Temurin or Corretto machine it is very likely absent.

**★ Its version has nothing to do with your JDK version.**
It is a separate OpenJDK project with its own cadence. Do not infer JMC capabilities from the JDK
you run, or vice versa.

**★ An older JMC still opens a newer recording.**
The recording carries its own schema, so unknown event types display generically rather than
failing. What you lose is a curated page for them, not the data.

**★ "Just open it in JMC" is not a usable instruction on a server.**
No display, possibly a very large file, possibly a policy problem in copying production data to a
laptop. Plan for the command line as the primary path and the GUI as the convenience.

**★ The command line is not a degraded fallback.**
`jfr summary`, `jfr view` and `jfr print --json` cover most of what the pages show, and
`jcmd JFR.view` needs no file at all. Treating a missing GUI as a blocker is the mistake.

**★ An empty page usually means an unenabled event.**
The pages render what the recording contains. "No allocation data" far more often means the
allocation events were off in that settings profile than that nothing allocated.

**★ Comparison beats inspection.**
Open a baseline recording next to the incident one. A profile in isolation shows what the program
does; against a baseline it shows what changed — which is nearly always the question.

**★ The call tree is the point of the GUI, not the hot-method list.**
A flat list showing `HashMap.get` at the top is not actionable. Expanding the tree to find the
caller responsible is, and interactive expansion is the thing a terminal does badly.

**★ Moving a production recording to a laptop is a data decision.**
Recordings contain file paths, class names, thread names and whatever custom events recorded.
`jfr scrub` exists for this, and it should happen before the file leaves the host.

## Interview questions

**★ Is JDK Mission Control part of the JDK?**
Not universally. The OpenJDK project's own README says builds are found *"in the Oracle JDK on
supported platforms and in the Eclipse Marketplace"*, and that binary distributions are *"provided
by different downstream vendors"* — Adoptium, Azul, Bell-Soft, Oracle and Red Hat. It is a separate
OpenJDK project with its own release cadence, so on a Temurin or Corretto image it is generally a
separate download.

**★ What does JMC give you that the `jfr` command-line tool does not?**
Interactive correlation across the timeline, and an interactive call tree. Seeing whether a latency
spike aligns with a GC pause, a class-loading burst and a lock — all at the same instant across
several tracks — is a visual task the terminal does badly. Everything else is largely available
from `jfr summary`, `jfr view` and `jfr print --json`, so the GUI is a convenience for most
questions and a genuine advantage for correlation.

**★ Your recording is on a production container and JMC is not installed anywhere. What now?**
Analyse from the command line, which is a complete answer rather than a fallback. `jfr summary` for
what the recording contains, `jfr view` for the same aggregations JMC's pages show, and
`jfr print --json` piped into other tooling for anything bespoke. And with a continuous recording
running, `jcmd <pid> JFR.view` answers many questions against the live JVM with no file at all.

**★ You open a JMC page and it is empty. What is the most likely explanation?**
That the events were never enabled in the settings profile used for that recording — not that the
phenomenon did not occur. The two look identical in any viewer. `jfr summary` shows event counts
and `jcmd JFR.check verbose=true` shows the settings in force, and either distinguishes them
immediately.

**★ How would you get the most out of a JMC session?**
Open a baseline recording from a healthy period alongside the incident recording, because profiles
rank rather than measure and comparison is what makes a ranking meaningful. Start at Automated
Analysis for leads, then verify each against the underlying events rather than taking findings as
conclusions. Work in the call tree rather than the flat hot-method list. And check what the
recording's settings actually enabled before concluding anything from an empty page.

**★ Any concerns about opening a production recording locally?**
Yes — it is a data movement decision. Recordings contain file paths, class names, thread names, and
whatever custom events chose to record, which can include business identifiers. `jfr scrub` removes
events by name, category or thread and exists precisely to *"remove sensitive contents"*; it should
be applied on the host, before the file is copied anywhere.

{/* FOOTER */}
