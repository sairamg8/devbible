---
title: "A recording that is already running when the incident starts is the only kind that contains the cause, because incidents are noticed after they begin — and the three settings that make it safe all default to unbounded"
sidebar_label: "03c · Continuous recording in production"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** — every option, default and
> quoted description below comes from `JFR.start`, `JFR.dump` and `JFR.configure`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and **JEP 509** for the configurable-detail argument
> ([openjdk.org](https://openjdk.org/jeps/509)).
> 🔴 **No sandbox** — no measurement, disk figure or recording below is a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Incidents are recognised after they start and understood after they end. A recording begun in
response to one has already missed the cause, which is why continuous recording is not a nicety
but the difference between explaining an incident and speculating about it. This page is how to
run one without it becoming an incident of its own — because the three options that bound it all
default to unlimited.**

## The configuration

```bash
java -XX:StartFlightRecording=name=continuous,settings=default,disk=true,maxage=6h,maxsize=500m,dumponexit=true \
     -jar app.jar
```

Every part of that line is load-bearing:

| Setting | Why |
|---|---|
| `name=continuous` | You will `JFR.dump` this by name during an incident |
| `settings=default` | The profile the JDK documents as *"can be used with recordings that run continuously"* — [03b](03b-settings-profiles.md) |
| `disk=true` | 🔴 **Required** — `maxage` and `maxsize` are *"valid only when the `disk` parameter is set to `true`"* |
| `maxage=6h` | How far back you can look. **Default `0s` means forever** |
| `maxsize=500m` | Hard cap on disk. **Default `0` means no maximum** |
| `dumponexit=true` | Get a file when the JVM shuts down — including a crash-adjacent one |

⚠️ **Note what is *not* there: `duration`.** Its default of `0s` means forever, which for once is
what you want. Setting a duration on a continuous recording is the mistake that makes it stop
silently after an hour.

## 🔴 The three unbounded defaults

This is the part that turns a diagnostic into an outage:

> `duration` — *"Length of time to record. Note that `0s` means forever"*
> `maxage` — *"Maximum time to keep the recorded data on disk … Note `0s` means forever."*
> `maxsize` — *"(STRING, 0 (no maximum size))"*

**All three default to unlimited, and two of them need to be set.** A recording started with
`disk=true` and neither `maxage` nor `maxsize` writes until the disk fills.

🔴 **Diagnostics that take the service down are worse than no diagnostics**, and this is the most
plausible way for that to happen with JFR. Set both. `maxsize` is the one that actually protects
you, because `maxage` bounds time and a burst of events can produce a great deal of data in a
short window.

⚠️ **`maxsize` has a floor:** *"The value must not be less than the value for the `maxchunksize`
parameter set with the `JFR.configure` command"* — which defaults to **12M**. A `maxsize` below
that is not a valid configuration.

## Where it writes, which matters more in a container

`JFR.configure`'s `repositorypath`:

> *"Path to the location where recordings are stored until they are written to a permanent file.
> (STRING, The default location is the temporary directory for the operating system. On Linux
> operating systems, the temporary directory is `/tmp`.)"*

🔴 **`/tmp` in a container is frequently the wrong place**, in three distinct ways:

- **It may be memory-backed.** A `tmpfs` `/tmp` means the recording consumes *memory*, and in
  Kubernetes an in-memory volume's contents count against the container's memory limit — so a
  growing recording can OOMKill the pod. That is the same trap as writing a heap dump to an
  in-memory `emptyDir`.
- **It may be small.** Container filesystems are often sized for the application, not for a
  rolling half-gigabyte of diagnostics.
- **It vanishes on restart**, which is precisely when you wanted the file.

**So set `repositorypath` to a real volume**, and note that `JFR.configure` values *"cannot be
changed once JFR has been initialized"* — this is a launch-time decision, not something to fix
during an incident.

**And `dumponexit=true` needs its `filename` to be somewhere that survives the container**, or the
file is written into a filesystem that is about to disappear.

## Dumping the past — the whole point

```bash
jcmd <pid> JFR.dump name=continuous maxage=15m filename=/tmp/incident-%p-%t.jfr
```

`JFR.dump` extracts a snapshot **without stopping the recording**, and its `maxage` and `maxsize`
bound *what you extract*, not what is being collected. So a six-hour buffer yields the fifteen
minutes you actually want.

It also takes `begin` and `end`, *"specified as local time"*, which is the form to use when you
know when the incident started:

```bash
jcmd <pid> JFR.dump name=continuous begin=14:05:00 end=14:20:00 filename=/tmp/spike.jfr
```

🔴 **This is the capability that justifies the whole arrangement.** Starting a recording during an
incident gets you data from *now*; dumping a continuous one gets you data from *before anyone
noticed*, which is where the cause is.

⚠️ **`JFR.dump` — not `JFR.stop`.** Stopping ends the recording, and if it was started without a
`filename`, *"the data from the recording is discarded"*. Dumping keeps it running for the next
question.

## The other reasons it is worth it

**Comparison against normal.** A profile is much easier to read against a baseline, and a
continuous recording means you always have one: dump an equivalent window from a healthy period
and compare. Without it, every profile is interpreted in isolation.

**Intermittent problems.** A failure that happens twice a week cannot be caught by starting a
recording when you notice it. A rolling buffer catches it by construction.

**Post-incident questions.** The questions that arrive the next day — was there a GC pause, was
there class loading, what was allocating — have answers only if something was recording.

**`dumponexit` catches shutdown problems.** A JVM that dies produces a recording, which is one of
the few ways to see what a process was doing shortly before it stopped.

## What to check before calling it done

1. **Is `maxsize` set, and is disk headroom greater than it?** Including the space needed for the
   dumps you will write alongside it.
2. **Is `repositorypath` on a real volume**, not a memory-backed or ephemeral `/tmp`?
3. **Does `JFR.check` show the recording running** on a pod you have not touched? A recording
   nobody verified is a recording that may have failed to start.
4. **Has someone actually taken a dump and opened it?** A recording that has never been read is an
   untested backup.
5. **Is the dump command in the runbook**, with the recording's name in it?

⚠️ **Point 4 is the one that fails.** The configuration goes in, nobody exercises it, and the first
attempt to use it happens during an incident — which is when you discover the repository path was
wrong or the retention was three minutes.

## Gotchas

**★ `duration`, `maxage` and `maxsize` all default to unlimited.**
`0s` means forever for the first two; `0` means no maximum for the third. A continuous recording
with none of them considered writes until the disk fills.

**★ `maxage` and `maxsize` require `disk=true`.**
The documentation says both are *"valid only when the `disk` parameter is set to `true`"*. Setting
retention on an in-memory recording silently does nothing.

**★ `maxsize` cannot be smaller than `maxchunksize`, which defaults to 12M.**
The documentation states the constraint directly. A very small cap is not a valid configuration.

**★ Do not set `duration` on a continuous recording.**
It is the one place the unbounded default is correct. A duration makes the recording stop
silently, and nobody notices until the incident when it was needed.

**★ The repository defaults to `/tmp`, which in a container may be memory-backed.**
Then the recording consumes memory rather than disk, and in Kubernetes an in-memory volume counts
against the container's memory limit — so your diagnostics can OOMKill the pod.

**★ `JFR.configure` settings cannot change after initialization.**
`repositorypath`, `maxchunksize`, `stackdepth` and the buffer sizes are launch-time decisions.
Discovering the repository is in the wrong place during an incident is not fixable then.

**★ Use `JFR.dump`, never `JFR.stop`, to collect from a continuous recording.**
`dump` snapshots and keeps recording. `stop` ends it — and without a filename, the documentation
says the data *"is discarded"*.

**★ `dump`'s `maxage` bounds what you extract, not what is recorded.**
That is what lets a six-hour buffer produce a fifteen-minute file. Confusing the two leads people
to think dumping shortens their retention.

**★ `dumponexit` writes to a filesystem that may be about to disappear.**
In a container the default location goes away with the container. Point its `filename` at a
mounted volume or the file exists only for as long as nothing needed it.

**★ A recording nobody has ever read is an untested backup.**
The common failure is not the recording — it is discovering during an incident that the retention
was too short or the path was wrong. Exercise it deliberately, in advance.

**★ The value is the baseline as much as the incident.**
Dumping an equivalent window from a healthy period gives you something to compare against, and a
profile read in isolation is much harder to interpret than a profile read against normal.

## Interview questions

**★ Why run JFR continuously rather than starting it when something goes wrong?**
Because incidents are noticed after they begin. A recording started in response has already missed
the cause, and reproducing usually means restarting — which destroys the state and often does not
reproduce. A rolling buffer means `JFR.dump` with a `maxage` returns the minutes *before* anyone
looked, which is where the cause is. It also catches intermittent failures that cannot be caught by
reacting to them.

**★ What settings make a continuous recording safe?**
`disk=true`, since retention options are only valid with it, plus `maxage` and `maxsize` — both of
which default to unlimited, so an unconfigured recording writes until the disk fills. `maxsize` is
the one that really protects you, because a burst of events can produce a lot of data inside a
short `maxage` window. And leave `duration` unset, since its unbounded default is what you want
here.

**★ Where does a continuous recording write, and why does that matter in a container?**
To the repository, which defaults to the OS temporary directory — `/tmp` on Linux. In a container
that may be memory-backed, in which case the recording consumes memory and, under Kubernetes,
counts against the container's memory limit, so it can OOMKill the pod. It may also be small, and
it disappears on restart. Set `repositorypath` to a real volume, and do it at launch, because
`JFR.configure` values cannot be changed after JFR initialises.

**★ An incident is happening and you have a continuous recording. What is the exact command?**
`jcmd <pid> JFR.dump name=continuous maxage=15m filename=/tmp/incident-%p-%t.jfr` — dump, not stop,
so the recording continues for the next question; `maxage` to extract just the relevant window from
a much longer buffer; and `%p`/`%t` so several pods do not overwrite one file. If the incident's
start time is known, `begin` and `end` in local time are more precise than `maxage`.

**★ What is the difference between `maxage` on `JFR.start` and on `JFR.dump`?**
On `start` it is retention — how much history the recording keeps on disk. On `dump` it bounds the
extraction — how much of that history goes into the file you are writing. That distinction is what
lets a six-hour rolling buffer produce a fifteen-minute artefact, and confusing them leads people to
believe dumping shortens their retention.

**★ You configure continuous recording across a fleet. What do you verify before considering it
done?**
That `maxsize` is set and the volume has more headroom than it, including room for the dumps you
will write alongside. That `repositorypath` is a real volume rather than a memory-backed `/tmp`.
That `JFR.check` shows the recording actually running on a pod nobody has touched. And — the step
that is always skipped — that somebody has taken a dump and opened it, because a recording that has
never been read is an untested backup, and the first attempt during an incident is when you find
out the retention was three minutes.

**★ Besides the incident itself, what does a continuous recording give you?**
A baseline. A profile is far easier to interpret against a comparable healthy window than in
isolation, and a rolling recording means you can always dump one. It also answers the questions that
arrive the day after — was there a GC pause, was there class loading, what was allocating — which
have no answer at all if nothing was recording at the time.

{/* FOOTER */}
