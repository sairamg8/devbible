---
title: "Two settings files ship with the JDK and the difference between them is the whole overhead argument — `default.jfc` is documented as safe to run continuously, `profile.jfc` is documented as being for short periods, and benchmarking the second is how JFR gets banned from production"
sidebar_label: "03b · Settings profiles"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference**, whose `JFR.start` `settings`
> option documents both shipped profiles verbatim
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> the **JDK 25 `jfr` tool reference** for the `configure` subcommand
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)),
> and **JEPs 509 and 520** for the events that are off by default and outside the overhead aim
> ([openjdk.org](https://openjdk.org/jeps/509)).
> 🔴 **No sandbox** — no measurement below is taken here.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A recording collects whatever its settings file says and nothing else, so the settings file is
the single decision that determines both what you can answer afterwards and what it costs to
collect. The JDK ships two, and the documentation is unusually direct about which is for what —
directly enough that most disagreements about JFR's overhead turn out to be a disagreement about
which of these two files was used.**

## The two shipped profiles, in the JDK's own words

From the `JFR.start` `settings` option, quoted verbatim:

> *"The following profiles are included with the JDK in the `JAVA-HOME`/lib/jfr directory:
> **'default.jfc'**: collects a predefined set of information with low overhead, so it has minimal
> impact on performance and **can be used with recordings that run continuously**;
> **'profile.jfc'**: Provides more data than the 'default.jfc' profile, but with more overhead and
> impact on performance. **Use this configuration for short periods of time when more information
> is needed.** Use `none` to start a recording without a predefined configuration file."*

🔴 **The documentation itself assigns the use cases**, and this is worth quoting to anybody
arguing about it:

| Profile | The documentation's own words | Use |
|---|---|---|
| **`default.jfc`** | *"low overhead … can be used with recordings that run continuously"* | Always-on in production |
| **`profile.jfc`** | *"more overhead … for short periods of time when more information is needed"* | An incident, a load test, a developer's machine |
| **`none`** | *"without a predefined configuration file"* | You are enabling specific events yourself |

⚠️ **This is the source of most overhead disputes.** Someone benchmarks with `settings=profile`,
measures a cost far above the "about 1%" figure ([02b](02b-the-overhead-argument.md)), and
concludes JFR is too expensive for production — having measured the profile the JDK explicitly
says is for short periods. **When somebody reports a JFR overhead number, the first question is
which settings file.**

## What actually differs

Not the *set* of events so much as their **thresholds and their sampling rates**.

A `.jfc` file is XML: a list of event types, each with `enabled`, and — for events that have them
— a `threshold` (only record occurrences longer than this), a `stackTrace` flag (capture a stack,
which is the expensive part), and a period for sampling events.

**The expensive settings, in rough order:**

1. **Stack traces.** Capturing a stack per event is far more costly than recording the event.
   Turning `stackTrace` on for a high-frequency event is the fastest way to make a recording
   expensive.
2. **Low thresholds.** An event with a 10 ms threshold records rarely; the same event at 1 ms may
   record orders of magnitude more often.
3. **High sampling rates** for the periodic sampling events.
4. **Allocation events with stacks**, which is exactly what makes allocation profiling useful and
   also what makes it costly.

`profile.jfc` largely differs from `default.jfc` by lowering thresholds and enabling stack traces
in more places. **That is why the difference in cost is real rather than nominal**, and why a
middle ground exists.

## Events that are off in both

Two JDK 25 features are not in either profile and must be asked for by name:

**`jdk.CPUTimeSample`** — JEP 509's CPU-time profiling event. The JEP is explicit: *"This event is
not enabled by default"*, and shows the enabling form:

```bash
java -XX:StartFlightRecording=jdk.CPUTimeSample#enabled=true,filename=profile.jfr ...
```

⚠️ It is **experimental and Linux-only** ([08](08-jdk-25-jfr.md)).

**`jdk.MethodTiming` and `jdk.MethodTrace`** — JEP 520's instrumentation events, which take a
`filter` naming the methods:

```bash
java -XX:StartFlightRecording:jdk.MethodTrace#filter=java.util.HashMap::resize,filename=recording.jfr ...
```

🔴 **These are outside the overhead aim by the JEP's own statement** — *"It is not a goal to remain
within this constraint when timing and tracing methods"* — and its non-goals warn against using
them broadly: *"It is not a goal to time or trace a large number of methods simultaneously, since
that would significantly degrade performance. Use method sampling in such cases."*

**The `#` syntax generalises.** `EventName#setting=value` overrides one setting for one event on
top of whichever profile you chose, which is how you get "the cheap profile plus the one
expensive thing I actually need" without editing a file.

## Building your own

```bash
jfr configure --interactive
jfr configure --input default.jfc --output custom.jfc <event-setting=value>...
```

From the tool reference, `jfr configure` *"Configure a .jfc settings file"*, with `--interactive`
*"where configuration is determined by questions"*, `--input` taking *"a comma-separated list of
.jfc files to base configuration on"*, and `--output` defaulting to `custom.jfc`.

**Starting from `default.jfc` and adding a small number of events is the right shape** — it keeps
the continuous-recording property and buys the specific thing you need. Starting from
`profile.jfc` and removing things tends to leave you with an expensive file nobody can characterise.

Deploy it by putting the file somewhere the JVM can read and naming the path:

```bash
jcmd <pid> JFR.start name=custom settings=/etc/jfr/custom.jfc filename=/tmp/rec.jfr
```

The `settings` option notes you must *"include the path if the file is not in
`JAVA-HOME`/lib/jfr"*, and that multiple files can be given comma-separated — so a base profile
plus an overlay is a supported composition rather than a trick.

## Knowing what a recording actually collected

🔴 **The most useful habit in this page:**

```bash
jcmd <pid> JFR.check verbose=true
```

`verbose` is documented as *"Flag for printing the event settings for the recording"*. That is the
difference between what you *think* you configured and what the recording is actually collecting —
and when an analysis turns up empty because an event was never enabled, this is the command that
tells you in one line rather than after an hour.

⚠️ **An empty analysis result usually means a settings problem, not an absence of the phenomenon.**
"There were no allocation events" and "allocation events were not enabled" look identical in a
viewer.

## A workable production posture

- **Continuous:** `settings=default`, with `maxage` and `maxsize` bounded
  ([03c](03c-continuous-recording-in-production.md)).
- **Incident escalation:** a short `settings=profile` recording *alongside* the continuous one —
  they can run simultaneously, so you keep the history and add detail.
- **Known recurring question:** a custom profile built from `default.jfc` plus the specific events
  that answer it, rather than escalating to `profile` every time.
- **Targeted method question:** `jdk.MethodTrace` with a narrow `filter`, briefly, accepting that
  it is outside the overhead budget.

## Gotchas

**★ The two shipped profiles have documented use cases — quote them.**
`default.jfc` *"can be used with recordings that run continuously"*; `profile.jfc` is for *"short
periods of time when more information is needed"*. Most overhead disagreements dissolve once
somebody names which file was measured.

**★ Benchmarking `profile.jfc` and calling it "JFR's overhead" is a category error.**
It is the high-detail profile the JDK says is for short periods. Reporting its cost as the cost of
running JFR in production is how JFR ends up banned on the strength of a number nobody claimed.

**★ Stack traces are the expensive part, not the events.**
Recording that an event occurred is cheap; capturing a stack for it is not. Enabling `stackTrace`
on a high-frequency event is the fastest way to make a recording costly.

**★ Thresholds are the main lever between the profiles.**
The same event at a 1 ms threshold instead of 10 ms can record orders of magnitude more often.
Lowering thresholds is usually what people mean when they say they "enabled more events".

**★ `jdk.CPUTimeSample` is off in both profiles.**
JEP 509: *"This event is not enabled by default."* It has to be named with
`jdk.CPUTimeSample#enabled=true`, and it is experimental and Linux-only.

**★ `jdk.MethodTiming` and `jdk.MethodTrace` are outside the overhead aim by design.**
JEP 520 says remaining within the one-percent constraint is not a goal for them, and warns against
tracing many methods at once because it *"would significantly degrade performance"*.

**★ `EventName#setting=value` overrides one event on top of a profile.**
That is how you get the cheap profile plus one expensive thing, without maintaining a whole custom
file for a single change.

**★ Build custom profiles up from `default.jfc`, not down from `profile.jfc`.**
Adding a few events to a known-cheap base keeps the continuous property. Removing things from the
expensive base leaves a file whose cost nobody can characterise.

**★ An empty analysis usually means the event was never enabled.**
"No allocation events occurred" and "allocation events were not recorded" look identical in a
viewer. `JFR.check verbose=true` distinguishes them in one command.

**★ Multiple recordings can run at once.**
So an incident does not mean stopping the continuous recording to start a detailed one — run both
and keep the history.

## Interview questions

**★ What is the difference between `default.jfc` and `profile.jfc`?**
The JDK documents them by use case rather than by content: `default.jfc` *"collects a predefined
set of information with low overhead … can be used with recordings that run continuously"*, while
`profile.jfc` *"Provides more data … but with more overhead"* and is *"for short periods of time
when more information is needed"*. Mechanically the difference is mostly lower thresholds and stack
traces enabled in more places.

**★ Someone measured 8% overhead from JFR. What do you ask?**
Which settings file. Almost always it is `profile.jfc`, which the documentation explicitly scopes
to short periods — so the number is real but is not the cost of production JFR. I would also ask
whether method timing or tracing events were enabled, since JEP 520 places those outside the
overhead aim entirely, and whether the application defines custom events without guards.

**★ What actually makes a JFR configuration expensive?**
Stack trace capture first — recording that an event happened is cheap, capturing a stack for it is
not. Then thresholds: the same event at 1 ms rather than 10 ms can fire orders of magnitude more
often. Then sampling rates for periodic events, and allocation events with stacks, which are the
most useful and most costly combination.

**★ How would you enable one expensive event on top of the cheap profile?**
With the `#` override syntax rather than a custom file:
`settings=default,jdk.ObjectAllocationSample#enabled=true`, or at launch
`-XX:StartFlightRecording=jdk.CPUTimeSample#enabled=true,...`. It applies one setting to one event
on top of the chosen profile, which keeps the base characterised and avoids maintaining a whole
file for a single change.

**★ Your analysis of a recording shows no allocation data. What do you check?**
Whether the events were enabled, before concluding anything about the application.
`jcmd <pid> JFR.check verbose=true` prints the event settings for the recording, which distinguishes
"this did not happen" from "this was not recorded". An empty result in a viewer looks the same for
both, and mistaking the second for the first sends the investigation in a wrong direction.

**★ How do you build a custom settings file?**
`jfr configure`, either `--interactive` or with `--input default.jfc --output custom.jfc` plus
event settings. Base it on `default.jfc` and add the specific events you need, so it retains the
property of being safe to run continuously — building down from `profile.jfc` produces a file whose
cost is not characterised. Then pass its full path to `settings`, since the JVM only resolves bare
names inside `JAVA-HOME/lib/jfr`.

**★ Can you run a detailed recording without losing your continuous one?**
Yes — multiple recordings can run simultaneously, each with its own name and settings. The right
incident move is to start a short `settings=profile` recording alongside the continuous
`settings=default` one, so you get high detail from now plus the history from before you noticed.
Stopping the continuous recording to start a detailed one throws away the part you cannot recreate.

{/* FOOTER */}
