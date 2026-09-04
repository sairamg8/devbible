---
title: "An unlock flag is a signed waiver, not a switch — it must appear before the option it unlocks, and its presence in a production command line is a finding in its own right"
sidebar_label: "02b · Unlocking diagnostic and experimental"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference —
> [`-XX:+UnlockDiagnosticVMOptions` and `-XX:+UnlockExperimentalVMOptions`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> both quoted verbatim. Target: **JDK 25 (LTS)**. Documentation-validated;
> **no sandbox run**.

**Two `-XX` options in HotSpot are gates rather than settings: they make a whole class of
other options legal. What matters about them is not the mechanics, which are trivial, but
what accepting them means. The reference states plainly that options behind the diagnostic
gate *are not supported*, that you may be asked to reproduce any problem without them before
Oracle Support will investigate, and that they *"may be removed or their behavior changed
without any warning."* That is a support waiver, written down, and passing the flag is
signing it. Treat an unlock flag in a production command line as an audit finding on its
own, before you even look at what it unlocked.**

## The two gates, verbatim

> *"`-XX:+UnlockDiagnosticVMOptions` — Unlocks the options intended for diagnosing the JVM.
> By default, this option is disabled and diagnostic options aren't available.*
>
> *Command line options that are enabled with the use of this option are not supported. If
> you encounter issues while using any of these options, it is very likely that you will be
> required to reproduce the problem without using any of these unsupported options before
> Oracle Support can assist with an investigation. It is also possible that any of these
> options may be removed or their behavior changed without any warning."*

> *"`-XX:+UnlockExperimentalVMOptions` — Unlocks the options that provide experimental
> features in the JVM. By default, this option is disabled and experimental features aren't
> available."*

Read the second paragraph of the diagnostic entry twice. It is doing three separate things:
withdrawing support, warning that a reproduction without the flag may be demanded as a
precondition for help, and reserving the right to change behaviour with **no warning at
all** — not a deprecation cycle, not a release note. Very little else in the tool reference
is worded that strongly.

The experimental entry is shorter and its force is in the word *experimental*: the feature
exists, is reachable, and has not been committed to.

## Order matters, and it is the failure everyone hits once

The unlock must appear **before** the option it unlocks:

```bash
# Works — gate first, then the option it makes legal.
java -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining -jar app.jar

# Aborts — the locked option is parsed before the gate that would allow it.
java -XX:+PrintInlining -XX:+UnlockDiagnosticVMOptions -jar app.jar
```

⚠️ **The tool reference does not state this ordering requirement explicitly.** It follows
from arguments being processed left to right: when the launcher reaches a diagnostic option
it checks whether diagnostic options are currently unlocked, and if the gate has not been
seen yet, they are not. The observable consequence is that the *same set of flags* in a
different order is the difference between a running service and an aborted launch — which
is a genuinely surprising property for a flag string and worth stating on any runbook that
carries one.

This interacts badly with flag strings assembled from more than one source. If the gate is
on the command line and the locked option arrives via an environment variable that gets
**prepended**, the option lands to the left of its gate and the launch aborts, even though
both flags are present and a human reading the two strings together would see nothing
wrong. `07-where-flags-come-from.md` *(not written yet)* owns the source-ordering rules;
the interaction is the reason that topic matters more than it first appears.

The same mechanism gives you a fix when you do not control the command line: an unlock
placed in a *prepended* source arrives to the left of everything on the command line, so it
gates options you did not write.

## What a locked option looks like when you get it wrong

The launch aborts and the message identifies the option as one requiring an unlock rather
than as an unknown option. That distinction is useful: an *unrecognised* flag means the
option does not exist on this JVM — wrong name, wrong vendor, or removed in an earlier
release — while a *locked* flag means the option exists and you have not signed for it. The
two send you to completely different places, so read which one you got before you start
searching.

🔴 **Do not respond to a locked-flag error by adding the unlock reflexively.** The error is
the last moment at which the decision is visible. Once the unlock is in the deployment
manifest it stops being a decision and becomes furniture — which is exactly how the flag in
the gotchas below survived nine months past the incident that introduced it.

## Where these come from, and why they stay

Almost every unlock flag in a production command line arrives the same way:

1. An incident. Someone needs a diagnostic the JVM does not expose by default — inlining
   decisions, a specific compiler trace, an internal counter.
2. They add the unlock and the diagnostic flag, restart, get the data, and fix the problem.
3. The command line change ships to the base image, the Helm chart or the Dockerfile,
   because that was the fastest way to apply it under pressure.
4. Nobody removes it, because removing it has no visible benefit and a non-zero perceived
   risk.

Step 4 is the whole problem, and it is not solved by remembering harder. It is solved by the
practice in `08-the-discipline.md` *(not written yet)*: a flag arrives with a reason and an
expiry, or it does not arrive.

## The audit rule

When you find an unlock flag, work in this order:

1. **What does it unlock?** Read the rest of the string for options that need it. If there
   are none, the unlock is pure risk at zero benefit — remove it, no further discussion.
2. **If something is behind it, is that option still doing anything?** A diagnostic flag from
   a resolved incident is dead weight carrying a support waiver.
3. **If it is genuinely needed, has it got an owner, a written reason and an expiry?** If
   not, it fails the audit even though it is doing something, because nothing distinguishes
   it from case 2 six months from now.
4. **Has the option changed class since it was added?** A promotion to product makes the
   unlock unnecessary; the option keeps working and the gate becomes a false signal in every
   future audit. `-XX:+UseCompactObjectHeaders` is the current live example and
   `05f-the-live-list-jdk-25.md` *(not written yet)* covers it.

## Gotchas

**★ Symptom: the launch aborts on a flag that is definitely spelled correctly and definitely
exists on this JDK.** Cause: it is a diagnostic or experimental option and either the unlock
is missing or — the harder case — the unlock is present but *after* it in the resolved
argument list. Fix: check for the gate and check its position, then confirm the resolved
order rather than the order you wrote:

```bash
jcmd <pid> VM.command_line   # on a process that did start, shows the resolved line
java $JAVA_OPTS -version     # cheapest way to test a string without deploying
```

**★ Symptom: adding a flag to `JAVA_TOOL_OPTIONS` breaks a launch that works when the same
flag is on the command line.** Cause: the environment variable's contents are prepended, so
a locked option supplied that way lands to the *left* of an unlock flag that sits on the
command line. Both flags are present; the order is wrong. Fix: put the unlock in the same
source as the option it gates, so their relative order cannot be changed by where each
string is assembled.

**★ Symptom: `-XX:+UnlockExperimentalVMOptions` sits in the base image and nothing in any
service's command line needs it.** Cause: an experimental option was dropped or promoted and
only its gate survived — unlock flags outlive the flags they were added for, because removing
one looks like it has no effect and therefore no upside. Fix: delete it. An unlock with
nothing behind it provides no capability and still marks the service as running unsupported
options to anyone auditing the fleet.

**★ Symptom: an unlocked diagnostic flag stops working after a JDK upgrade with no
deprecation warning anywhere in the release notes.** Cause: this is the documented contract
being honoured exactly as written — diagnostic options *"may be removed or their behavior
changed without any warning."* There was never a promise to warn you. Fix: none available
after the fact, which is the point. Anything behind an unlock gate must be treated as
unversioned: never build alerting, dashboards, tooling or a runbook step on it without an
alternative that does not need the gate.

**★ Symptom: Oracle Support asks for a reproduction without several flags before they will
look at a crash, and the team reads it as stalling.** Cause: it is the stated policy, quoted
above — a reproduction without unsupported options *"will be required"* before an
investigation proceeds. Fix: know this in advance, because the expensive version is
discovering it mid-incident. If a service permanently runs with a diagnostic unlock, the
ability to run without it should be a tested configuration, not a hypothesis.

**★ Symptom: `-XX:+PrintFlagsFinal` output looks different between two hosts and a flag
appears on one and not the other.** Cause: locked options are not listed unless they have
been unlocked, so the visible flag set depends on which gates are open. Fix: compare the
gates before comparing the flags — two hosts with different unlock flags do not have
comparable flag listings, and diffing them without accounting for that produces a long list
of differences that are all the same difference.

## Interview questions

**★ What are you actually agreeing to when you pass `-XX:+UnlockDiagnosticVMOptions`?**
A support waiver with three distinct clauses, all stated in the tool reference. First, the
options it enables *"are not supported"* — full stop. Second, if you hit a problem you will
*"very likely"* be required to reproduce it without them before Oracle Support will assist,
which means the flags can become an obstacle to getting help at the worst possible moment.
Third, those options *"may be removed or their behavior changed without any warning"* — not
deprecated with a cycle, not announced, simply different one release later. The mechanical
effect of the flag is trivial; the contractual effect is the reason it exists as a separate
flag at all.

**★ Why must the unlock flag come before the option it unlocks, and why is that surprising?**
Because arguments are processed left to right, so when the parser reaches a locked option it
tests whether the corresponding gate is currently open — and a gate further right has not
been seen yet. It surprises people because flag strings otherwise behave like an unordered
set for most purposes, with the significant exception that a later setting of the same flag
overrides an earlier one. Here, two flags that are both present and both correct produce a
failed launch purely because of their relative position. It matters most when a string is
assembled from several sources, since a prepended environment variable can silently move a
locked option to the left of its gate. Worth noting that the tool reference does not state
the ordering rule explicitly; it follows from the processing model rather than from a
documented sentence.

**★ You are auditing a fleet and find `-XX:+UnlockExperimentalVMOptions` on nine services,
with no experimental flag beside it on any of them. What is the finding?**
That there is no capability being provided and a signal being emitted. With nothing behind
it the unlock changes no behaviour, so removing it is safe in the strongest sense — there is
nothing for it to break. Its cost is informational: every future audit sees a service marked
as running unsupported options and has to re-derive that it is not, and the flag makes it
marginally easier for the next incident to leave a real experimental option behind without
anyone noticing a new gate appearing. The likely history is that an experimental flag was
either promoted to product, making the gate redundant, or dropped, leaving the gate orphaned
— and the fact that it propagated to nine services says it lives in a base image or a shared
chart, which is where the fix belongs.

**★ Is there a legitimate reason to run a diagnostic option in production long-term?**
Yes, but it needs to survive a specific question: what happens when it changes without
warning? Some diagnostics genuinely have no supported equivalent and the information is worth
the risk — a long-running investigation into an intermittent fault is the honest case. What
makes it legitimate is not the flag but the surrounding structure: a named owner, a written
reason, an expiry date, and crucially a tested configuration *without* it, so that the
support requirement to reproduce without unsupported options does not become an emergency
piece of work mid-incident. What makes it illegitimate is the common case — it was added
during an incident nine months ago, the incident is closed, and it stayed because nobody had
a reason to remove it.

**★ How does an unlock flag interact with the environment variables that can inject flags?**
It interacts through position, and the interaction cuts both ways. Because `JAVA_TOOL_OPTIONS`
and `JDK_JAVA_OPTIONS` are *prepended*, an unlock placed in one of them arrives to the left of
everything on the command line — so it can gate options in a command line you do not control,
which is genuinely useful when the command line is baked into an image. The same mechanism is
the trap: a *locked option* placed in a prepended variable lands to the left of an unlock flag
that sits on the command line, and the launch aborts even though both flags are present and a
human reading both strings sees nothing wrong. The rule that avoids both failure modes is to
keep a gate and the option it gates in the same source.

{/* FOOTER */}
