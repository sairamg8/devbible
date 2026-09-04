---
title: "VM.command_line is what you asked for and VM.flags is what you got — the gap between them is where every configuration argument is actually settled, and jcmd will only tell you from the same machine as the same user"
sidebar_label: "04b · VM flags on a running process"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `jcmd` tool reference
> ([jcmd](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), quoted
> verbatim below for `VM.flags`, `VM.command_line`, `VM.system_properties`, `VM.set_flag`
> and `VM.native_memory`, and the JDK 25 `java` tool reference. Target: **JDK 25 (LTS)**.
> Documentation-validated; **no sandbox run**.

**`-XX:+PrintFlagsFinal` answers questions about a JVM you are about to start.
`jcmd` answers them about the one that is currently misbehaving, which is usually the one
you care about. Two of its commands matter more than the rest and they are useful precisely
because they disagree: `VM.command_line` shows the arguments this process was launched with,
and `VM.flags` shows the flag values it ended up with. Everything interesting lives in the
gap — a flag you passed that is not in the resolved set, a value you never set that is,
an override you did not know an environment variable was making. The constraint to plan
around is access: `jcmd` works only from the same machine, as the same user.**

## The access constraint, first, because it decides your runbook

> *"The `jcmd` utility is used to send diagnostic command requests to the JVM. It must be
> used on the same machine on which the JVM is running, and have the same effective user and
> group identifiers that were used to launch the JVM."*

Three requirements, all hard: same machine, same effective UID, same effective GID. There is
no remote mode and no credential to present. In practice:

- **Kubernetes** — you must `kubectl exec` into the pod itself. Running `jcmd` from the node
  or a debug container in a different PID namespace will not see the process.
- **The image must contain `jcmd`.** A JRE-only or distroless image typically does not ship
  the JDK tools, so the command you planned your incident response around does not exist at
  the moment you need it. 🔴 **Check this before an incident, not during one** — it is the
  most common reason this page's advice fails in practice.
- **`USER` in the Dockerfile matters.** If the JVM runs as an unprivileged user and your exec
  lands you as `root`, the effective IDs do not match and the attach is refused. Attach as
  the same user the JVM runs as.

## `VM.command_line` — what you asked for

> *"Print the command line used to start this VM instance. Impact: Low"*

```bash
jcmd <pid> VM.command_line
```

This is the **assembled** command line: the flags that actually reached the JVM after every
source contributed. That makes it the authoritative answer to a whole family of arguments
that otherwise go in circles — whether an environment variable was picked up, whether a base
image is injecting something, whether the flag really is in the deployment manifest the way
everyone believes it is.

⚠️ **It is not the string in your YAML.** `07-where-flags-come-from.md` *(not written yet)*
covers the four sources that feed it, and the routine surprise is that the resolved line
contains flags nobody on the team put there.

Run it before `VM.flags` when you are investigating a configuration question, because it
answers *"is my flag even present"* — and if it is not, nothing about the resolved values
will explain why.

## `VM.flags` — what you got

> *"Print the VM flag options and their current values. Impact: Low"*
>
> *"`-all`: (Optional) Prints all flags supported by the VM (BOOLEAN, false)."*

```bash
jcmd <pid> VM.flags          # the flags that are actually SET on this VM
jcmd <pid> VM.flags -all     # every flag the VM supports, with its value
```

🔴 **The two forms answer different questions and the default is the one you usually want.**
Bare `VM.flags` gives you the short list — the values that are set, which is close to your
audit list. `-all` gives you the full table, comparable to `-XX:+PrintFlagsFinal`, which is
what you want when you need to know a specific flag's resolved value whether or not anyone
set it.

A useful pairing to keep in your head:

| Question | Tool |
|---|---|
| What will this flag string resolve to before I deploy it? | `java $JAVA_OPTS -XX:+PrintFlagsFinal -version` |
| What did this *running* process end up with? | `jcmd <pid> VM.flags -all` |
| What is set, as opposed to defaulted, right now? | `jcmd <pid> VM.flags` |
| What was it launched with? | `jcmd <pid> VM.command_line` |

## The gap between the two, which is the actual technique

Diagnosis lives in the disagreement between the two commands, and the disagreements come in
recognisable shapes:

- **A flag in `VM.command_line` and absent from `VM.flags`** — it was accepted and is not in
  effect. Usually an *obsolete* flag: accepted, warned about at launch, ignored. See
  `06-the-retired-list.md` *(not written yet)*.
- **A flag in `VM.flags` that is not in `VM.command_line`** — something set it that is not the
  command line. Ergonomics is the benign explanation; an environment variable injecting flags
  invisibly is the one worth chasing.
- **A flag in both, with different values** — it was specified more than once and a later
  occurrence won. `VM.command_line` shows all the occurrences; `VM.flags` shows the winner.
- **A flag in neither, that the manifest clearly contains** — it never reached the JVM at all.
  `JAVA_OPTS` unexpanded by an exec-form `ENTRYPOINT` is the classic cause, and no amount of
  re-reading the flag's spelling will reveal it.

## `VM.system_properties` — the other half of configuration

> *"Print system properties. Impact: Low"*

```bash
jcmd <pid> VM.system_properties
```

`-D` properties are not VM flags and do not appear in `VM.flags`. When Spring Boot
configuration is behaving unexpectedly this is frequently the command that settles it,
because a `-D` set in one place and overridden in another produces exactly the same
"the config says X and the app does Y" symptom as a mis-delivered VM flag, with a completely
different cause and fix.

## `VM.set_flag` — changing one without a restart

> *"Sets VM flag option using the provided value. Impact: Low"*
>
> *"`flag name`: The name of the flag that you want to set (STRING, no default value)"*
> *"`string value`: (Optional) The value that you want to set (STRING, no default value)"*

```bash
jcmd <pid> VM.set_flag HeapDumpOnOutOfMemoryError true
jcmd <pid> VM.set_flag HeapDumpPath /var/log/app
```

This works only for **manageable** flags — the class covered in `02-the-three-kinds.md`.
Most tuning flags are consumed once during startup to size structures or select an
implementation, and there is no mechanism to re-apply them.

⚠️ **Which flags are manageable is not enumerated in the tool reference.** Attempt the set
and read the response; a non-manageable flag is refused rather than silently accepted, so the
attempt is safe and is the cheapest way to find out.

🔴 **The high-value use is arming a diagnostic on a process you must not restart.** A service
is heading toward an `OutOfMemoryError` and has no heap dump configured — restarting it
destroys the evidence you need. Setting `HeapDumpOnOutOfMemoryError` and `HeapDumpPath` on
the live process means the *next* failure produces a dump, and costs nothing until then.

Note the flag name is given **without** the `-XX:` prefix and without a `+`/`-` sign;
booleans take `true` or `false` as the value.

## `VM.native_memory` — when the heap is not the question

> *"Print native memory usage. Impact: Medium"*

```bash
jcmd <pid> VM.native_memory summary
jcmd <pid> VM.native_memory baseline
jcmd <pid> VM.native_memory summary.diff
```

The documented options include `summary`, `detail`, `baseline`, `summary.diff`,
`detail.diff`, `statistics` and `scale` (*"Memory usage in which scale, KB, MB or GB"*).

⚠️ **Impact is Medium, not Low** — the only command on this page that is. It is not free, and
`detail` reports *"memory allocation >= 1K by each callsite"*, which is considerably more work
than `summary`. Use `summary` unless you have a reason.

This requires `-XX:NativeMemoryTracking` to have been enabled **at launch**, which is the
catch: the flag that makes the diagnosis possible is one you must have set before the problem
appeared. `05d-the-live-list-diagnostics.md` *(not written yet)* argues for enabling it
pre-emptively. The `baseline` / `summary.diff` pair is the technique for a slow native leak —
baseline now, compare later — and topic 01 owns the framing that heap is not the process.

## Gotchas

**★ Symptom: `jcmd` reports the process ID does not exist, and `ps` in the same shell clearly
shows it.** Cause: almost always a namespace or identity mismatch rather than a missing
process — you are on the node rather than inside the pod, or you have exec'd as `root` while
the JVM runs as an unprivileged user. The reference requires the *"same machine"* and the
*"same effective user and group identifiers that were used to launch the JVM."* Fix: exec
into the pod itself and become the JVM's user.

```bash
kubectl exec -it <pod> -- jcmd            # lists the JVMs jcmd can actually see
```

Running bare `jcmd` with no arguments lists attachable JVMs, which distinguishes "wrong
namespace" (empty list) from "wrong user" (refused attach) in one step.

**★ Symptom: `jcmd: command not found` inside the container, during an incident.** Cause: the
image ships a JRE or is distroless and has no JDK tools. Fix: there is no fix at that moment
— the tooling has to be present before you need it. Decide deliberately whether production
images carry the JDK tools, and if they deliberately do not, have the alternative path
(a debug sidecar sharing the process namespace, or an ephemeral debug container) written down
and *tested* rather than assumed.

**★ Symptom: a flag is clearly in `VM.command_line` and does not appear in `VM.flags`.**
Cause: it was accepted and is not in effect — the signature of an obsolete flag, which warns
at launch and is then ignored. Fix: read the launch warnings, which are the only place the
JVM says so, and check the retired list. Do not conclude `jcmd` is unreliable; it is
reporting a real difference between what was passed and what is in force.

**★ Symptom: `VM.flags` shows a flag nobody on the team set.** Cause: either ergonomics chose
it, which is normal and expected, or a source you are not looking at is injecting it —
`JAVA_TOOL_OPTIONS` set by a platform agent is the classic case, since APM and profiling
agents commonly inject themselves that way. Fix: compare with `VM.command_line` and check the
environment of the process itself, not the manifest.

**★ Symptom: `VM.set_flag` is refused and the conclusion is that permissions are wrong.**
Cause: the flag is not manageable. Most flags are read once at startup and cannot be
re-applied to a running VM, and the refusal is about the flag rather than about your access —
if your access were wrong, the *attach* would have failed rather than the individual command.
Fix: read the refusal as information about the flag; if it must change, it is a restart.

**★ Symptom: `VM.native_memory` reports that native memory tracking is not enabled.** Cause:
`-XX:NativeMemoryTracking` is a launch-time flag and was not set, so the accounting was never
collected — the data does not exist and cannot be produced retroactively. Fix: none for the
current process. This is the argument for enabling `summary` tracking pre-emptively rather
than deciding to enable it during the incident that needed it.

**★ Symptom: someone runs `VM.native_memory detail` on a busy production JVM and latency
moves.** Cause: this command is documented at *"Impact: Medium"* — uniquely on this page —
and `detail` walks *"memory allocation >= 1K by each callsite"*. Fix: use `summary` by
default, and treat `detail` as a deliberate act with a known cost rather than as a more
thorough version of the same free command.

**★ Symptom: `-D` configuration behaves unexpectedly and `VM.flags` shows nothing relevant.**
Cause: system properties are not VM flags; they never appear in `VM.flags` at all. Fix: use
`VM.system_properties`. The two configuration channels present identical symptoms and are
inspected with different commands.

## Interview questions

**★ What is the difference between `jcmd VM.command_line` and `jcmd VM.flags`, and why would
you run both?**
`VM.command_line` prints *"the command line used to start this VM instance"* — the arguments
that actually reached the JVM after every source was assembled. `VM.flags` prints the flag
values the JVM currently holds. You run both because the gap between them is the diagnosis:
a flag present in the command line and absent from the flags is one that was accepted and
ignored, typically an obsolete flag; a flag in the flags but not the command line was set by
something else, usually ergonomics or an environment variable; the same flag in both with
different values means it was specified more than once and a later occurrence won. Either
command alone tells you what happened but not why.

**★ Why can `jcmd` not be used remotely, and what does that mean for a containerised
service?**
Because it is not a network protocol — it uses a local attach mechanism, and the reference
requires it be run *"on the same machine on which the JVM is running"* with *"the same
effective user and group identifiers that were used to launch the JVM."* There is no
credential to present and no remote mode to enable. For containers this has two practical
consequences that need deciding in advance. You must exec into the pod itself, since a debug
container in a different PID namespace cannot see the process. And the image has to contain
the JDK tools at all — a JRE-only or distroless image does not, so the incident-response step
everyone assumes is available is missing at exactly the moment it is needed. Both are cheap
to verify on a normal day and expensive to discover during an outage.

**★ When would you use `jcmd VM.set_flag` in production, and what limits it?**
The high-value case is arming a diagnostic on a process you cannot restart. A service is
drifting toward an `OutOfMemoryError` with no heap dump configured, and restarting it
destroys the state you need to understand it — setting `HeapDumpOnOutOfMemoryError` and
`HeapDumpPath` on the live process means the next failure leaves evidence, at no cost until
then. The limit is that only *manageable* flags are writable at runtime; most tuning flags
are consumed during startup to size structures or select an implementation and cannot be
re-applied. Which flags are manageable is not enumerated in the tool reference, so it is
discovered by attempting the set — safe, because a non-manageable flag is refused rather than
silently accepted, and a refusal tells you about the flag rather than about your access.

**★ `VM.native_memory` returns an error saying tracking is not enabled. What are your
options?**
For that process, none — and this is the point worth making rather than a limitation to work
around. Native memory tracking is enabled by `-XX:NativeMemoryTracking` at launch, and the
accounting is only collected when it is on, so the data for the period you care about does
not exist and cannot be reconstructed. Your options are to restart with tracking enabled and
wait for the problem to recur, which on an intermittent native leak can mean weeks, or to
proceed without it. That asymmetry is the argument for enabling `summary` tracking
pre-emptively: it must be armed before the incident to be useful in it, and the class of
problem it answers — the pod is OOMKilled while the heap looks healthy — is precisely the
class where nothing else will tell you.

**★ Why does `jcmd VM.flags` show fewer flags than `-XX:+PrintFlagsFinal`?**
Because they are answering different questions by default. Bare `VM.flags` prints the flags
that are *set*, which is the short, useful audit list; `-XX:+PrintFlagsFinal` prints the
entire table including hundreds of flags nobody touched. The reference documents `-all` on
`VM.flags` as *"Prints all flags supported by the VM"*, which brings the two into
correspondence. The distinction is worth knowing because the short list is what you want when
auditing a service — it is close to "what has anyone decided here" — and the long list is
what you want when checking one specific flag's resolved value, whether or not it was ever
set.

{/* FOOTER */}
