---
title: "You can start a recording at launch or attach one to a JVM that is already misbehaving, and the second is the one that matters — because the alternative during an incident is restarting the process, which destroys the state you were trying to explain"
sidebar_label: "03 · Starting a recording"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference**, from which every option,
> default and Impact level below is quoted — `JFR.start`, `JFR.stop`, `JFR.dump`, `JFR.check`,
> `JFR.configure` and `JFR.view`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and **JEPs 509 and 520** for the `-XX:StartFlightRecording` forms
> ([openjdk.org](https://openjdk.org/jeps/509)).
> 🔴 **No sandbox** — command output is not reproduced here; only documented syntax, options and
> defaults.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Two ways in: a flag at launch, or `jcmd` against a running process. The flag is what you
configure once and forget; `jcmd` is what you reach for at 03:00. Both are documented precisely,
and this page is the options that actually matter — which is a much shorter list than the full
set, because most of the defaults are already right.**

## At launch

```bash
java -XX:StartFlightRecording=filename=app.jfr,duration=60s -jar app.jar
```

JEP 520's own example shows the colon form and an event-specific setting:

```bash
java -XX:StartFlightRecording:jdk.MethodTrace#filter=java.util.HashMap::resize,filename=recording.jfr ...
```

and JEP 509's shows enabling an event that is off by default:

```bash
java -XX:StartFlightRecording=jdk.CPUTimeSample#enabled=true,filename=profile.jfr ...
```

⚠️ **Both `=` and `:` forms appear in current JDK documentation.** The `:` form is the newer
spelling and is what JEP 520 uses; the `=` form is what JEP 509 uses and remains widely
documented. Do not "correct" one to the other in an existing script.

## On a running process — the one that matters

```bash
jcmd <pid> JFR.start name=incident settings=profile duration=2m filename=/tmp/incident-%p-%t.jfr
```

**`JFR.start` is rated "Impact: Low".** So is `JFR.stop`, `JFR.dump`, `JFR.check` and
`JFR.configure`. Only `JFR.view` is Medium.

🔴 **This is the capability that distinguishes JFR from every profiler that needs an agent at
startup.** During an incident you do not have to choose between keeping the broken process and
getting data from it. Restarting destroys the state, often fails to reproduce, and is the single
most common way an incident ends with no explanation.

## The options worth knowing

From the `JFR.start` documentation, the ones that change what you get:

| Option | Default | What it does |
|---|---|---|
| `settings` | `default.jfc` | Which events. `default` for continuous, `profile` for detail, `none` for no predefined config — [03b](03b-settings-profiles.md) |
| `duration` | `0s` | Length of recording. 🔴 **`0s` means forever** |
| `filename` | generated | Where it lands. **`%p` expands to PID, `%t` to timestamp** |
| `name` | generated | Your handle for `dump`, `stop` and `check`. **Always set it** |
| `disk` | `true` | Write to disk while recording — required for `maxage`/`maxsize` |
| `maxage` | `0s` | How much history to keep. 🔴 **`0s` means forever** |
| `maxsize` | `0` | Cap on disk. 🔴 **`0` means no maximum** |
| `dumponexit` | `false` | Write the recording when the JVM shuts down |
| `delay` | `0s` | Wait before starting — useful to skip warm-up |
| `path-to-gc-roots` | `false` | ⚠️ Expensive; only for a suspected leak (below) |

**Three of those defaults are "unbounded", and that is the trap.** `duration=0s`, `maxage=0s` and
`maxsize=0` all mean *forever* or *no limit*. A recording started with none of them set runs
indefinitely and grows without bound — [03c](03c-continuous-recording-in-production.md) is where
that has to be handled.

### `name` is not optional in practice

The documentation is explicit about why:

> *"If no name is provided, a name is generated. Make note of the generated name that is shown in
> the response to the command so that you can use it with other commands."*

⚠️ **Every other subcommand takes `name` to identify which recording to act on.** Starting one
without a name means reading the generated name out of the command's output and hoping you still
have it when you need to dump. Set it.

### `%p` and `%t` matter in containers

`filename` supports both: *"If %p and/or %t is specified in the filename, it expands to the JVM's
PID and the current timestamp, respectively."* Across several pods writing to the same mounted
path, that is the difference between distinct files and one being overwritten.

### ⚠️ `path-to-gc-roots` is not a general option

> *"Flag for saving the path to garbage collection (GC) roots at the end of a recording. The path
> information is useful for finding memory leaks but collecting it is time consuming. Turn on this
> flag only when you have an application that you suspect has a memory leak."*

**"Turn on this flag only when" is the documentation's own wording.** It is a leak-hunting tool,
it costs a pause, and it does not belong in a standing configuration. The docs add that with
`settings=profile` the information *"includes the stack trace from where the potential leaking
object was allocated"*, which is what makes it worth the cost when you genuinely need it.

## The other four subcommands

**`JFR.dump` — take a snapshot without stopping.** This is the one you use against a continuous
recording:

```bash
jcmd <pid> JFR.dump name=continuous filename=/tmp/incident-%p-%t.jfr maxage=15m
```

Its `maxage` and `maxsize` limit *what you extract*, not what is being recorded — so you can pull
the last fifteen minutes out of an hour-long buffer. It also takes `begin` and `end`, *"specified
as local time"*, to extract a window you can name.

**`JFR.stop` — end it.** ⚠️ **With a caveat that costs people their data:**

> *"If no path is provided, the data from the recording is discarded."*

🔴 **`JFR.stop` without `filename` throws the recording away.** If it was started with a
`filename`, that is where it goes; otherwise, stopping without one loses everything.

**`JFR.check` — what is running.** Lists recordings and their state; `verbose=true` prints the
event settings, which is how you confirm what a recording is actually collecting rather than what
you think you asked for.

**`JFR.configure` — the recorder itself, not a recording.** Buffers, repository path, stack
depth. Two of its options come up in practice:

- `stackdepth`, default **64** — *"Setting this value greater than the default of 64 may cause a
  performance degradation."* 🔴 **Deep frameworks truncate stacks at 64**, and a truncated stack
  attributes cost to the wrong place. Raising it is sometimes necessary and is not free.
- `repositorypath`, defaulting to the OS temporary directory — `/tmp` on Linux. ⚠️ In a container
  that may be small, memory-backed, or wiped; [03c](03c-continuous-recording-in-production.md)
  returns to it.

⚠️ Most `JFR.configure` values *"cannot be changed once JFR has been initialized"*, so they belong
at launch rather than in an incident.

## The two workflows

**Incident, nothing was recording:**

```bash
jcmd <pid> JFR.start name=incident settings=profile duration=2m filename=/tmp/incident-%p-%t.jfr
# wait, then collect the file
```

Short, high detail, bounded by `duration` so it ends itself.

**Incident, continuous recording already running** — the better position to be in:

```bash
jcmd <pid> JFR.dump name=continuous maxage=15m filename=/tmp/incident-%p-%t.jfr
```

🔴 **The second gets you the data from *before* you noticed**, which the first structurally cannot.
That is the whole argument for [03c](03c-continuous-recording-in-production.md).

## Gotchas

**★ `duration=0s`, `maxage=0s` and `maxsize=0` all mean unbounded.**
Three defaults that read like "off" and mean "forever". A recording started with none of them set
runs indefinitely and grows without limit.

**★ `JFR.stop` without `filename` discards the recording.**
The documentation says so directly: *"If no path is provided, the data from the recording is
discarded."* Stopping a recording to "collect it" is how the data gets thrown away.

**★ Always set `name`.**
Every other subcommand identifies a recording by name. Without one you are reading a generated
name out of command output and hoping to still have it when you need to dump.

**★ `%p` and `%t` expand in `filename`.**
PID and timestamp. Across pods writing to a shared path, their absence means one file overwriting
another.

**★ `path-to-gc-roots` is for suspected leaks only.**
The docs say *"collecting it is time consuming"* and *"Turn on this flag only when you have an
application that you suspect has a memory leak"*. It causes a pause and does not belong in a
standing configuration.

**★ `stackdepth` defaults to 64 and deep frameworks exceed it.**
A truncated stack attributes cost to the wrong frame, which quietly produces a wrong profile.
Raising it is documented as possibly causing *"a performance degradation"*, so it is a trade rather
than a fix.

**★ Most `JFR.configure` settings cannot change after initialization.**
Buffer sizes, chunk size, stack depth and repository path are launch-time decisions. Discovering
that during an incident means you get the values you shipped with.

**★ The repository defaults to the OS temp directory.**
`/tmp` on Linux, which in a container may be small, memory-backed or wiped on restart. A
continuous recording writing there is a disk or memory problem waiting to happen.

**★ Both `-XX:StartFlightRecording=` and `:` forms are current.**
JEP 509 uses `=`, JEP 520 uses `:`. Both appear in JDK 25 documentation; neither is a mistake to
be corrected in an existing script.

**★ `JFR.view` is the only Medium-impact subcommand.**
`start`, `stop`, `dump`, `check` and `configure` are all Low. That makes starting and dumping a
recording safe on production in a way that in-process aggregation is not.

**★ Starting a recording during an incident cannot recover the past.**
It records from now. Everything before the command is gone, which is why the continuous-recording
argument is about evidence rather than overhead.

## Interview questions

**★ How do you start a JFR recording on a JVM that is already running?**
`jcmd <pid> JFR.start`, with `name`, `settings`, `duration` and `filename`. It is rated Impact:
Low, so it is safe on production. This matters more than the launch flag, because the alternative
during an incident is restarting the process — which destroys the state that caused the problem
and frequently fails to reproduce it.

**★ Which `JFR.start` defaults would you always override?**
`name`, because every other subcommand identifies recordings by it and the generated one has to be
read out of command output. And the three unbounded ones — `duration=0s`, `maxage=0s` and
`maxsize=0` all mean forever or no limit, so a recording left with them runs indefinitely and grows
without bound. For a continuous recording, `maxage` and `maxsize` are mandatory rather than
advisable.

**★ What is the difference between `JFR.dump` and `JFR.stop`?**
`dump` writes out a snapshot while the recording continues; `stop` ends it. `dump` takes `maxage`,
`maxsize`, `begin` and `end` to extract a window from a longer buffer, which is exactly the
continuous-recording workflow. And `stop` has a sharp edge: if no filename was provided, the
documentation says the data *"is discarded"*, so stopping a recording in order to collect it can
lose it.

**★ Why does `stackdepth` matter?**
It defaults to 64, and deep framework stacks — a request through a web layer, security filters, a
proxy, an ORM — exceed that. A truncated stack attributes the cost to whatever frame survives the
truncation, so the profile is silently wrong rather than obviously incomplete. Raising it is
documented as possibly degrading performance and cannot be changed after JFR initialises, so it is a
launch-time trade.

**★ You have a suspected memory leak. Which option becomes relevant, and what does it cost?**
`path-to-gc-roots`, on either `JFR.start` or `JFR.dump`. It records the reference paths from GC
roots, which is what identifies what is retaining objects. The documentation is explicit that
*"collecting it is time consuming"*, causes a pause, and should be turned on *"only when you have
an application that you suspect has a memory leak"* — so it is a targeted tool, not part of a
standing configuration. With `settings=profile` it also captures the allocation stack trace.

**★ An incident is happening and nothing was recording. What do you run?**
`jcmd <pid> JFR.start name=incident settings=profile duration=2m filename=/tmp/incident-%p-%t.jfr`
— short, high detail, self-terminating. But it only records from now, so whatever caused the
incident before you noticed is unrecoverable. That gap is the entire argument for running a
continuous low-detail recording, where the equivalent command is a `JFR.dump` with `maxage` and it
returns the minutes *before* anyone looked.

{/* FOOTER */}
