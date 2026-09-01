---
title: "Automated analysis scores a recording against a fixed set of rules and hands you a ranked list of things that look wrong, which is genuinely useful and is also the fastest way to spend a day fixing something that was never your problem"
sidebar_label: "06b · Reading the automated analysis"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **OpenJDK Mission Control project**
> ([github.com/openjdk/jmc](https://github.com/openjdk/jmc)), and — for the properties of sampled
> data that determine what any rules engine can and cannot conclude — **JEP 509 "JFR CPU-Time
> Profiling (Experimental)"** and **JEP 518 "JFR Cooperative Sampling"**, both Release 25
> ([openjdk.org](https://openjdk.org/jeps/509)).
> ⚠️ **The specific rules, their names and their scoring thresholds are not enumerated here.** They
> are JMC's, they change between JMC versions, and JMC versions independently of the JDK
> ([06](06-jdk-mission-control.md)). This page is how to read the output, not a rule catalogue —
> read your own version's rule descriptions rather than trusting a list written elsewhere.
> 🔴 **No sandbox** — no score, finding or output below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Mission Control's Automated Analysis page runs a set of rules over a recording and produces
ranked findings with scores and a written explanation each. It is the single fastest way to orient
yourself in an unfamiliar recording, and it is also a machine applying general heuristics to a
workload it knows nothing about. This page is how to get the value without inheriting the
mistakes.**

## What it is

A **rules engine**. Each rule examines particular event types, applies thresholds, and produces a
score plus a human-readable explanation of what it found and why that might matter. The page ranks
findings so the most alarming appear first.

**What it is good at** is the thing a person is bad at on first contact with a large recording:
**checking everything, uniformly, immediately**. A recording contains dozens of event types; a
person looks at the three they already suspect. The rules engine looks at all of them and has no
prior belief about which subsystem is guilty.

🔴 **That is its real value: it is a systematic sweep, not an expert opinion.** Read it as "here
are the places worth looking", and it is excellent. Read it as "here is what is wrong", and it will
occasionally send you a long way in the wrong direction.

## Why a rules engine cannot know if a finding matters

Four structural reasons, none of which is a defect in the implementation:

**1 · It has no baseline for your application.** A rule fires on a threshold chosen to be
reasonable across all Java applications. Whether *your* service's value is normal for *it* is
information the engine does not have. A batch job legitimately spends its life in GC; a rule saying
so is describing the design.

**2 · It has no notion of your SLO.** A finding about pause times cannot know whether your budget
is 10 ms or 2 seconds. Both are real systems.

**3 · It cannot see intent.** A cache that retains objects looks like retention. A thread pool
sized deliberately for a slow dependency looks like saturation. The engine sees the shape and not
the reason.

**4 · Its inputs are partly samples, not facts.** Rules built on sampled events inherit every
limitation in [07](07-execution-sampling.md) — native code invisible to the classic sampler,
unreported failed samples, per-interval thread subsetting, residual safepoint bias. JEP 509 is
explicit that the resulting profile *"may be inaccurate"*, and that inaccuracies *"are likely to be
greater when collecting the samples over a relatively short period (say, one minute)"*.

🔴 **So a high-scoring finding on a sixty-second recording is a much weaker claim than the same
finding over an hour** — and the score does not say which you have.

## The two failure modes

**False positives — the expensive one.** A rule fires on something normal for your workload. It
scores high, it is at the top of the list, it comes with a confident explanation, and somebody
spends a day on it. This is the common failure and it is caused by reading the ranking as a
priority order rather than as a list of leads.

**False negatives — the quiet one.** Your actual problem has no rule, or falls below a threshold,
and the page looks clean. ⚠️ **"Automated analysis found nothing" is not a clean bill of health.**
It means no rule fired — and rules exist for known, general failure modes, not for whatever is
peculiar about your system.

**Both come from the same misreading**, which is treating a general heuristic as a verdict on a
specific system.

## How to actually use it

**1 · Read every finding, ignore the ranking at first.** The order reflects the engine's scoring,
which knows nothing about your service. A low-scored finding that names a subsystem you already
suspect is worth more than a high-scored one about something you understand.

**2 · Verify each candidate against the underlying events.** This is the step that converts a lead
into a finding. The Event Browser and the specific pages ([06](06-jdk-mission-control.md)) show the
events the rule was scoring — check that the shape is really what the rule says. On the command
line, `jfr view` and `jfr print --events` do the same job
([05](05-the-jfr-command-line-tool.md)).

**3 · Compare against a baseline.** 🔴 **This is the single most effective correction.** Run the
same analysis on a recording from a healthy period. Findings that appear in *both* are properties
of your application, not causes of your incident — and that comparison eliminates most false
positives in one step. It is the strongest practical argument for continuous recording
([03c](03c-continuous-recording-in-production.md)).

**4 · Check the recording is adequate before believing anything.** How long is it? Which settings
profile ([03b](03b-settings-profiles.md))? A rule that scores an event type which was never enabled
has scored an absence. `jfr summary` and `JFR.check verbose=true` answer both.

**5 · Stop when a finding matches your symptom.** The engine reports what looks unusual; you are
looking for what explains the thing that happened. A finding that does not connect to the symptom
is not your incident, however high it scored.

## Where it is genuinely excellent

Being fair about this matters, because the caveats above could read as dismissal and it does not
deserve that:

- **On an unfamiliar service**, it orients you in seconds. Someone handed a recording from a
  system they have never seen gets a map of what is unusual about it, which no amount of scrolling
  produces.
- **It catches configuration mistakes reliably** — the class of problem it is best at, because
  configuration *is* general rather than workload-specific.
- **It knows event types you have never opened.** The value of a uniform sweep is highest exactly
  where your attention is weakest.
- **Its explanations teach.** The written rationale for each rule is a short lesson in what that
  event type means and why the threshold is where it is.

## Gotchas

**★ The ranking is the engine's confidence, not your priority.**
Scores come from thresholds chosen to be reasonable across all Java applications. A high-scoring
finding about something normal for your workload outranks a low-scoring one about your actual
problem.

**★ "Automated analysis found nothing" is not a clean bill of health.**
It means no rule fired. Rules cover known general failure modes, not whatever is peculiar to your
system, so the absence of findings is much weaker evidence than their presence.

**★ It has no baseline for your application.**
A batch job legitimately spending its life in GC will be flagged. The engine sees the shape and
cannot see that it is the design.

**★ It has no notion of your SLO.**
A pause-time finding cannot know whether your budget is 10 ms or 2 seconds, so it cannot tell you
whether the number it found is a problem.

**★ It cannot see intent.**
A deliberate cache looks like retention; a pool sized for a slow dependency looks like saturation.
Both are correct designs and both will be reported.

**★ Findings built on sampled events inherit every sampling limitation.**
Native code invisible to the classic sampler, unreported failed samples, thread subsetting,
residual safepoint bias. JEP 509 says such profiles *"may be inaccurate"*.

**★ Short recordings produce weaker findings, and the score does not say so.**
JEP 509 names about a minute as the regime where inaccuracies are likely greater. A confident
finding from a ninety-second recording deserves much more scepticism than the same finding from an
hour, and nothing in the output distinguishes them.

**★ A rule can score an event type that was never enabled.**
Then it is scoring an absence. Check the settings profile with `JFR.check verbose=true` before
drawing a conclusion from a finding — or from a clean page.

**★ Comparing against a baseline eliminates most false positives in one step.**
Findings present in both a healthy and an incident recording are properties of the application, not
causes of the incident. This is the highest-value habit on this page.

**★ Verifying a finding against the raw events is not optional.**
The rule tells you what it scored; the Event Browser or `jfr print --events` tells you whether the
shape is really what the rule claims. That step is what converts a lead into a finding.

**★ The rules and their thresholds change between JMC versions.**
And JMC versions independently of the JDK. A remembered rule list ages badly; read the explanations
in the version you are actually running.

## Interview questions

**★ What is JMC's automated analysis, and how much should you trust it?**
A rules engine that examines a recording's event types against thresholds and produces ranked,
explained findings. Trust it as a systematic sweep — it checks everything uniformly, which a person
does not — and not as a verdict. It has no baseline for your application, no notion of your SLO,
and no way to see intent, so it reports shapes rather than problems. Read it as a list of places
worth looking.

**★ Automated analysis reports nothing. What does that tell you?**
Only that no rule fired. Rules encode known, general failure modes; your problem may have no rule,
or may fall below a threshold, or may be entirely specific to your system. It is much weaker
evidence than a finding would be, and treating it as "the JVM is healthy" is the quiet failure mode
of the tool.

**★ A finding scores very high. How do you decide whether to act on it?**
Three checks. Does it connect to the symptom you are investigating — the engine reports what is
unusual, you are looking for what explains what happened. Does it appear in a baseline recording
from a healthy period — if so it is a property of the application, not a cause. And does the
underlying event data actually show the shape the rule describes, checked in the Event Browser or
with `jfr print --events`. A finding that fails any of those is a lead that did not survive.

**★ Why does recording length affect how much you should trust a finding?**
Because many rules are built on sampled events, and JEP 509 states that sampling inaccuracies *"are
likely to be greater when collecting the samples over a relatively short period (say, one
minute)"*. A short recording gives fewer samples and a less reliable profile, so the same finding
means less. The score does not encode this, so it has to be applied by the reader.

**★ What is automated analysis genuinely best at?**
Orienting you in an unfamiliar system, and catching configuration mistakes. On a service you have
never seen it produces a map of what is unusual within seconds, covering event types you would
never have opened. And configuration problems are the class where general heuristics work well,
because configuration is general rather than workload-specific — unlike anything that depends on
what the application is for.

**★ What single habit most improves its accuracy?**
Comparing against a baseline recording from a healthy period. Any finding that appears in both is a
property of the application rather than a cause of the incident, which removes most false positives
in one step. It requires having a healthy recording available, which is the practical argument for
running a continuous recording rather than starting one when something breaks.

{/* FOOTER */}
