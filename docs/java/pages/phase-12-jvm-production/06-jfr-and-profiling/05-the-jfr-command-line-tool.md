---
title: "The JDK ships a command-line tool that reads recordings, and it matters because the machine holding the interesting recording is usually a container with no display, no browser and no intention of letting you copy a two-gigabyte file to your laptop"
sidebar_label: "05 · The jfr command-line tool"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jfr` tool reference**, from which every subcommand,
> option and default below is quoted
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)),
> the **JDK 25 `jcmd` tool reference** for `JFR.view`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and **JEP 520** for the `jfr print` example
> ([openjdk.org](https://openjdk.org/jeps/520)).
> 🔴 **No sandbox** — no command output is reproduced here except where quoted from JEP 520 and
> attributed. Nothing below is a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Analysis does not require a GUI, and the situations where it matters most are exactly the ones
where a GUI is unavailable: a recording on a production host, over SSH, on a machine with no
display. The JDK ships `jfr` for this. It also ships `JFR.view`, which reads a *running* JVM
without producing a file at all — and that one is the underused tool in this topic.**

## The eight subcommands

From the tool reference:

| Subcommand | The documentation's own description |
|---|---|
| **`summary`** | *"View the summary statistics for a flight recording file (number of recorded events, disk space used, etc.)"* |
| **`view`** | *"Display aggregated event data on standard out"* |
| **`print`** | *"Print the contents of a flight recording file to standard out"* |
| **`metadata`** | *"Print metadata information about flight recording events"* |
| **`configure`** | *"Configure a .jfc settings file"* — [03b](03b-settings-profiles.md) |
| **`scrub`** | *"Remove events from a flight recording file (remove sensitive contents or reduce size)"* |
| **`assemble`** | *"Assemble chunk files into a flight recording file"* |
| **`disassemble`** | *"Disassemble a flight recording file into chunk files"* |

## Start with `summary`, always

```bash
jfr summary recording.jfr
```

🔴 **This is the first command for any recording**, and it answers the question that determines
everything after it: **what is actually in this file?**

It reports the number of recorded events by type and the disk space used. Two things you learn
immediately:

- **Which events are present at all.** If the event you intended to analyse has a count of zero, it
  was never enabled ([03b](03b-settings-profiles.md)) — and that is a settings problem, not a
  finding about the application.
- **Where the volume is.** An event type with an enormous count is either the phenomenon you are
  looking for or the reason the recording is large.

⚠️ **"No events of type X" and "X never happened" are different statements** and look identical in
every viewer. `summary` distinguishes them in one command, and it is why running it first saves
the most time.

## `view` — aggregation without a GUI

```bash
jfr view hot-methods recording.jfr
jfr view --verbose gc-pause-phases recording.jfr
```

> *"Display aggregated event data on standard out."*

**This is the subcommand that replaces most GUI use.** It runs predefined views — aggregations
that answer common questions — and prints them as tables. Options are `--verbose`
(*"Displays the query that makes up the view"*), `--width`, `--truncate` (*"'beginning' or 'end',
default: 'end'"*) and `--cell-height`.

🔴 **`--verbose` is the one worth knowing**: it prints the query behind the view. That turns the
built-in views into a set of worked examples for the query language, and it is how you find out
what a view is actually computing rather than inferring it from a column heading.

**And the same capability exists against a live JVM**, via `jcmd`:

```bash
jcmd <pid> JFR.view hot-methods
```

with `maxage` defaulting to **10m** and `maxsize` to **32MB** — so it aggregates a recent window of
a running recording. ⚠️ It is the **only Medium-impact** JFR subcommand; the rest are Low.

**This is the underused tool.** With a continuous recording running
([03c](03c-continuous-recording-in-production.md)), `jcmd <pid> JFR.view` answers a question in one
command with no file, no copy and no download. Use `help JFR.view` to list the available views on
your JDK.

## `print` — the raw events

```bash
jfr print --events jdk.CPUTimeSample recording.jfr
jfr print --events jdk.MethodTrace --stack-depth 20 recording.jfr
jfr print --json --events com.example.OrderProcessed recording.jfr
```

The second is JEP 520's own example. Options: `--xml`, `--json`, `--exact`
(*"Pretty-print numbers and timestamps with full precision"*), `--categories`, `--events`, and
`--stack-depth`, whose default the reference gives as **5**.

🔴 **`--stack-depth` defaults to 5, which is almost never enough.** Five frames of a framework
stack is `Thread.run` and some machinery. **Raise it — 20 or more — whenever the stack is the point
of looking.** This default is a display setting, unrelated to the recorder's own 64-frame
`stackdepth` cap ([04](04-the-event-model.md)); the two truncate independently, and both can be
wrong at once.

⚠️ **`print` with no filter on a real recording produces an unreadable volume.** Always filter with
`--events` or `--categories`.

**`--json` is the one that makes `print` powerful**, because it composes with everything else. A
recording becomes a structured stream you can filter, group and count with ordinary tooling —
which is how you answer a question no predefined view covers, and the only realistic approach for
a virtual-thread-scale recording.

## `metadata` — what is in an event

```bash
jfr metadata recording.jfr
jfr metadata --events com.example.OrderProcessed recording.jfr
```

Prints event types and their fields **from the recording itself**
([04](04-the-event-model.md)). Two uses:

- **Before writing a query**, to get field names and types right rather than guessing from the
  event name.
- **To verify a custom event's fields survived** the type rules
  ([04b](04b-custom-events.md)) — the only mechanism that catches a silently dropped field.

## `scrub` — before the recording leaves your control

```bash
jfr scrub --exclude-events com.example.OrderProcessed recording.jfr scrubbed.jfr
jfr scrub --exclude-categories Application recording.jfr scrubbed.jfr
```

> *"Remove events from a flight recording file (remove sensitive contents or reduce size)"*

Filters: `--include-events`, `--exclude-events`, `--include-categories`, `--exclude-categories`,
`--include-threads`, `--exclude-threads`.

🔴 **It removes whole events, not fields.** So scrubbing a sensitive field costs the event that
carried it ([04b2](04b2-custom-events-in-production.md)). It is the right tool before attaching a
production recording to a ticket, and it is a remedy rather than a policy.

**`--include-events` also reduces size**, which is the practical way to make a large recording
transferable: keep the three event types you care about and discard the rest.

## `assemble` and `disassemble` — the repository

**`assemble <repository> <file>`** — *"Assemble chunk files into a flight recording file."*

🔴 **This is the recovery tool.** A continuous recording writes chunks into the repository
([03c](03c-continuous-recording-in-production.md)). If the JVM dies without dumping — a crash, an
OOMKill, a `kill -9` — the chunks are still on disk, and `assemble` turns them into a readable
recording. **A process that died without writing a file may still have left its data**, which is
worth knowing before concluding an incident produced no evidence.

⚠️ It depends on the repository surviving the process, which is why `preserve-repository` and a
`repositorypath` on a real volume matter ([03c](03c-continuous-recording-in-production.md)).

**`disassemble`** splits a recording into chunks, with `--max-chunks` (default 5) and `--output`.
Useful for making a very large recording transferable in pieces.

## A workable sequence

```bash
jfr summary recording.jfr                                   # what is in here?
jfr view hot-methods recording.jfr                          # the usual question
jfr view --verbose hot-methods recording.jfr                # what did that actually compute?
jfr metadata --events com.example.OrderProcessed recording.jfr   # what fields exist?
jfr print --json --events com.example.OrderProcessed --stack-depth 20 recording.jfr | <your tooling>
```

**And on a live JVM with a continuous recording, the first two collapse into one command that
needs no file at all:**

```bash
jcmd <pid> JFR.view hot-methods
```

## Gotchas

**★ Run `jfr summary` first, every time.**
It tells you which events are present and in what volume. A count of zero for the event you came
to analyse means it was never enabled — a settings problem, not a finding — and every viewer
displays that identically to "it never happened".

**★ `jfr print --stack-depth` defaults to 5.**
Five frames of a framework stack is `Thread.run` and machinery. Raise it whenever the stack is the
reason you are looking.

**★ The two stack-depth limits are different and both apply.**
`print --stack-depth` truncates the *display*; `JFR.configure stackdepth` (default 64) truncated
the *recording*. Raising the display option cannot recover frames the recorder never captured.

**★ `jfr print` without a filter is unusable on a real recording.**
Always narrow with `--events` or `--categories`, or use `view` for an aggregate.

**★ `jfr view --verbose` prints the query behind the view.**
That is how you learn what a view computes rather than inferring it from column headings, and it
doubles as a set of worked query examples.

**★ `jcmd JFR.view` works against a live JVM with no file at all.**
`maxage` defaults to 10m and `maxsize` to 32MB. With a continuous recording running, most questions
are one command away — and it is the most underused capability in this topic.

**★ `JFR.view` is the only Medium-impact JFR subcommand.**
`start`, `stop`, `dump`, `check` and `configure` are Low. It aggregates in-process, which is why it
costs more.

**★ `jfr scrub` removes whole events, not fields.**
Scrubbing a sensitive field costs the event that carried it. Categorising events by sensitivity is
what makes `--exclude-categories` a usable one-command remedy.

**★ `jfr assemble` can recover a recording from a JVM that died without dumping.**
The chunks are in the repository. A crash, an OOMKill or a `kill -9` does not necessarily mean the
evidence is gone — provided the repository outlived the process.

**★ `--json` is what makes `print` composable.**
It turns a recording into a structured stream for ordinary tooling, which is how you answer
questions no predefined view covers and the only realistic approach at large scale.

**★ `metadata` is the only check for a silently dropped custom-event field.**
It prints the fields the recording actually contains, which is what the type rules in
[04b](04b-custom-events.md) may have quietly reduced.

## Interview questions

**★ How do you analyse a JFR recording without a GUI?**
With the `jfr` tool the JDK ships. `jfr summary` first, to see which events are present and in what
volume; `jfr view <name>` for aggregated answers to common questions; `jfr print --events … --json`
for raw events to feed into other tooling; and `jfr metadata` to get field names right before
querying. It matters because the recording that counts is usually on a container with no display
and no appetite for copying a large file off it.

**★ Why run `jfr summary` before anything else?**
Because it distinguishes "this did not happen" from "this was not recorded". If the event you came
to analyse has a count of zero, the settings profile never enabled it — a configuration problem
rather than a finding — and every viewer renders both cases as an empty result. It also shows where
the volume is, which explains a large recording immediately.

**★ Your `jfr print` output shows only a few frames per stack. What is wrong?**
`--stack-depth` defaults to 5. Raise it. But check the other limit too: the recorder's own
`stackdepth`, configured through `JFR.configure` and defaulting to 64, truncated the stacks when
they were captured. The print option only controls display, so if the recording was made with a
shallow cap, no display setting can recover the frames.

**★ What can you do without producing a file at all?**
`jcmd <pid> JFR.view <view>` aggregates events from a running JVM's recording and prints a table —
`maxage` defaults to 10 minutes, `maxsize` to 32MB. With a continuous recording in place that
answers most routine questions in one command, with no dump, no copy and no download. It is the
only Medium-impact JFR subcommand, the rest being Low, because it aggregates in-process.

**★ A JVM was OOMKilled without dumping its recording. Is the data gone?**
Not necessarily. A continuous recording writes chunk files into the repository as it goes, and
`jfr assemble <repository> <file>` turns those chunks into a readable recording. Whether it works
depends on the repository having outlived the process — which is one more reason to set
`repositorypath` to a real volume rather than leaving it in a container's ephemeral `/tmp`.

**★ You need to send a production recording to a vendor. What do you do first?**
Scrub it. `jfr scrub` with `--exclude-events` or `--exclude-categories` removes events that carry
sensitive content — and note that it removes *whole events*, not individual fields, so anything
sensitive costs you the event carrying it. `--include-events` is also the practical way to shrink a
large recording to something transferable, by keeping only the event types the vendor needs.

**★ How would you answer a question no built-in view covers?**
Two routes. Run `jfr view --verbose` on a similar view to see the query behind it and adapt that
approach. Or take `jfr print --json --events <type>` and process the structured output with ordinary
tooling — filtering, grouping and counting outside the JDK. The second is also the only realistic
approach for a recording with a very large number of events.

{/* FOOTER */}
