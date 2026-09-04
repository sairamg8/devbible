---
title: "A flag's prefix is a support contract: one dash means every JVM must honour it, -X means HotSpot only and may change, and -XX means you are in developer territory where the option can be removed without a deprecation cycle"
sidebar_label: "02 · The three kinds"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference —
> [Standard, Extra and Advanced options](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> quoted verbatim below. Target: **JDK 25 (LTS)**. Documentation-validated;
> **no sandbox run**.

**The number of dashes on a JVM flag is not cosmetic and it is not a naming accident — it
is the stability contract you are agreeing to. A single dash means the option is guaranteed
by every conforming JVM implementation. `-X` means it is a HotSpot extension that other
JVMs need not have and that Oracle may change. `-XX` means it is a developer option,
explicitly *"not guaranteed to be supported by all JVM implementations"* and *"subject to
change"* — which is precisely why an unrecognised one aborts your launch rather than being
politely ignored. Read the prefix before you read the name, because it tells you how much
of your production configuration you are betting on an unversioned interface.**

## The three classes, in the reference's own words

The tool reference draws the lines itself. These are the load-bearing sentences:

> *"**Standard Options for Java**: Options guaranteed to be supported by all
> implementations of the Java Virtual Machine (JVM). They're used for common actions, such
> as checking the version of the JRE, setting the class path, enabling verbose output, and
> so on."*

> *"**Extra Options for Java**: General purpose options that are specific to the Java
> HotSpot Virtual Machine. They aren't guaranteed to be supported by all JVM
> implementations, and are subject to change. These options start with `-X`."*

> *"The advanced options aren't recommended for casual use. These are developer options
> used for tuning specific areas of the Java HotSpot Virtual Machine operation that often
> have specific system requirements and may require privileged access to system
> configuration parameters. […] These options aren't guaranteed to be supported by all JVM
> implementations and are subject to change. Advanced options start with `-XX`."*

Three tiers of promise, weakening left to right:

| Prefix | Promise | Examples | If it disappears |
|---|---|---|---|
| `-` | Every conforming JVM supports it | `-classpath`, `-version`, `-jar`, `-D` | It won't |
| `-X` | HotSpot only; may change | `-Xmx`, `-Xms`, `-Xss`, `-Xlog`, `-Xshare` | A release note, if you're lucky |
| `-XX` | Developer option; may change or vanish | `-XX:MaxRAMPercentage`, `-XX:+UseG1GC` | Your launch aborts |

🔴 **"Subject to change" applies to `-X` and `-XX` in exactly the same words.** People treat
`-Xmx` as eternal and `-XX:` flags as fragile, and the reference makes no such distinction
between them — both carry the identical disclaimer. In practice `-Xmx` has been stable for
decades and `-XX:` flags churn every release, but that is a track record, not a guarantee.

## Why the boundary looks arbitrary — because it is historical

`-Xmx` sets the maximum heap. `-XX:MaxRAMPercentage` also sets the maximum heap. One is
`-X`, the other is `-XX`, and nothing about their function explains the split.

The honest answer is that the boundary records *when a flag was added*, not what it does.
The `-X` set is small, old and effectively frozen; almost everything added since has landed
in `-XX` because `-XX` is where new HotSpot tuning goes. **Do not try to infer a flag's
importance, stability or "officialness" from which side of the line it fell on.** Two flags
that do the same job can sit on opposite sides.

The practical consequence: `-Xlog` — the unified logging framework that replaced the entire
`-XX:+PrintGC*` family — is an `-X` option. A great deal of GC configuration that used to be
`-XX` is now reached through a single `-X` flag.

## The two syntaxes inside `-XX`

`-XX` options come in two shapes and mixing them up is a launch failure, not a warning.

**Boolean flags** take a `+` or `-` immediately after the colon:

```bash
-XX:+HeapDumpOnOutOfMemoryError    # turn it on
-XX:-HeapDumpOnOutOfMemoryError    # turn it off
```

**Valued flags** take an `=`:

```bash
-XX:MaxRAMPercentage=75.0
-XX:HeapDumpPath=/var/log/app
-XX:NativeMemoryTracking=summary
```

There is no third shape. `-XX:UseG1GC` (boolean without a sign) and
`-XX:+MaxRAMPercentage=75.0` (sign on a valued flag) are both rejected. The error is
unhelpful enough that the misreading survives code review — see the gotchas.

⚠️ **A boolean flag's `-` form is a real capability, not just documentation.** Because a
later setting overrides an earlier one, `-XX:-SomeFlag` is how you switch something *off*
that a base image or a platform-injected environment variable turned on. That is often the
only lever you have when you do not control the earlier source.
`07-where-flags-come-from.md` *(not written yet)* is where that fight actually happens.

## Inside `-XX`: product, diagnostic and experimental

`-XX` is not one undifferentiated pile. HotSpot classifies its options, and two of those
classes are **locked by default** — present in the binary, rejected at launch unless you
also pass an unlock flag.

- **Product** options are the ordinary supported ones. `-XX:MaxRAMPercentage`,
  `-XX:+UseG1GC`, `-XX:+HeapDumpOnOutOfMemoryError`. No unlock needed.
- **Diagnostic** options exist for debugging a JVM problem, and the reference is unusually
  blunt about their support status:

  > *"Command line options that are enabled with the use of this option are not supported.
  > If you encounter issues while using any of these options, it is very likely that you
  > will be required to reproduce the problem without using any of these unsupported options
  > before Oracle Support can assist with an investigation. It is also possible that any of
  > these options may be removed or their behavior changed without any warning."*

- **Experimental** options are features not yet ready to be depended on:

  > *"`-XX:+UnlockExperimentalVMOptions` — Unlocks the options that provide experimental
  > features in the JVM. By default, this option is disabled and experimental features
  > aren't available."*

A flag can also **move between these classes across releases**, and that movement is the
most consequential thing in this whole classification. `-XX:+UseCompactObjectHeaders` was
experimental — requiring an unlock flag — and on JDK 25 is a product option that needs no
unlock at all. A copied command line carrying the old unlock flag is now carrying a flag it
does not need. `05e-the-live-list-jdk-25.md` *(not written yet)* covers that specific
promotion and what it means for your command line;
[unlocking diagnostic and experimental](02b-unlocking-diagnostic-and-experimental.md) covers the unlock
mechanics and the risk you take on when you use one.

### Manageable options — the ones you can change while it runs

A further class is writable at runtime rather than only at launch. The mechanism is
`jcmd <pid> VM.set_flag <name> <value>`, and it is the reason you can turn on heap-dump-on-OOM
for a process you cannot restart.

⚠️ **Which flags are manageable is not enumerated in the `java` tool reference**, and this
page does not have a verified list. Treat it as discovered rather than declared: attempt the
`VM.set_flag` and read the response, rather than assuming a given flag is writable because a
blog said so. A flag that is not manageable is refused, not silently ignored, so the attempt
is safe.

## What this classification buys you in an audit

Prefix and class together give a triage order for an inherited flag string, before you look
up a single flag's meaning:

1. **Single-dash options** — leave them alone. `-classpath`, `-D`, `-jar`. They are not
   tuning and they are not going anywhere.
2. **`-X` options** — small, stable, few in number. Check `-Xmx`/`-Xms` against the
   container question (topic 03), and check whether `-Xloggc` or `-XX:+PrintGC*` should have
   become `-Xlog`.
3. **`-XX` product options** — the real audit surface. Each needs the three questions from
   `01-the-flags-you-inherited.md`.
4. **Anything behind an unlock flag** — 🔴 **the highest-priority review item in the
   string.** You are running an option the vendor says is unsupported and may change without
   warning. It needs a named owner, a written reason and an expiry, or it comes out.

That last line is the practical payoff of knowing the classes at all: the presence of
`-XX:+UnlockDiagnosticVMOptions` or `-XX:+UnlockExperimentalVMOptions` in a production
command line is a finding in its own right, independent of which flag it unlocked.

## Gotchas

**★ Symptom: `-XX:UseG1GC` is rejected and the message points at the flag name, so you go
looking for a renamed collector.** Cause: the flag name is fine; the syntax is not. Boolean
`-XX` options require an explicit `+` or `-`, and without one the launcher cannot parse it
as a boolean at all. Fix: add the sign.

```bash
java -XX:UseG1GC -version     # rejected — boolean flag with no + or -
java -XX:+UseG1GC -version    # correct
```

**★ Symptom: `-XX:+MaxRAMPercentage=75.0` fails, and the obvious "fix" of dropping the `=75.0`
also fails.** Cause: the `+`/`-` form is for booleans only, and `MaxRAMPercentage` is a
valued flag. Dropping the value leaves a valued flag with no value, which is a second,
different error. Fix: no sign, use `=`.

```bash
-XX:MaxRAMPercentage=75.0
```

**★ Symptom: a flag that worked on a colleague's machine aborts the launch on the build
agent, and both are running "JDK 25".** Cause: either the flag is diagnostic or experimental
and the working environment carried an unlock flag the other did not, or the two are
different vendor builds and the option is not present in both. Fix: compare the *resolved*
state rather than the strings, and check for an unlock flag in the environment as well as in
the command line — `07-where-flags-come-from.md` *(not written yet)* covers the environment
variables that inject flags invisibly.

```bash
jcmd <pid> VM.command_line    # what this JVM was actually launched with
```

**★ Symptom: a copied incident command line still carries `-XX:+UnlockExperimentalVMOptions`
months later and nobody can say what it unlocks.** Cause: unlock flags are sticky — they
survive copy-paste into a base image or a Helm chart long after the experimental flag beside
them was dropped or promoted. Fix: an unlock flag with no experimental flag left to unlock is
pure risk with zero benefit and comes out immediately. If a flag beside it *is* still there,
that flag is the review item: you are depending on something the reference says *"may be
removed or their behavior changed without any warning."*

**★ Symptom: an upgrade removes `-XX:+UnlockExperimentalVMOptions` from the command line and
the JVM now aborts on the flag it used to unlock — or the reverse, it starts warning about a
redundant unlock.** Cause: the flag changed class between releases. A promotion from
experimental to product makes the unlock unnecessary; a demotion or removal makes the
unlocked flag itself invalid. Fix: when a flag changes class, both the flag and its unlock
must be re-checked together. `-XX:+UseCompactObjectHeaders` is the current example — product
on JDK 25, no unlock required.

**★ Symptom: `-Xmx` is treated as sacred and `-XX:MaxRAMPercentage` as risky, so a container
sizing fix is blocked in review.** Cause: an assumption that fewer dashes means more stable.
The reference gives `-X` and `-XX` the *same* "subject to change" disclaimer; the difference
in perceived stability is a track record, not a contract. Fix: argue the flag on its merits —
does it exist on our JVM, what problem does it solve, is the default better — rather than on
its prefix.

**★ Symptom: `jcmd VM.set_flag` refuses to change a flag at runtime and the team concludes
`jcmd` is broken or lacks permission.** Cause: only manageable flags are writable while the
JVM runs. Most tuning flags are read once during startup and the JVM has no mechanism to
re-apply them. Fix: read the refusal as information about the flag rather than about the
tool. If it must change, it is a restart.

## Interview questions

**★ What does the number of dashes on a JVM flag actually tell you?**
It tells you the support contract, not the function. A single dash is a standard option that
the reference says is *"guaranteed to be supported by all implementations of the Java Virtual
Machine"* — portable across vendors and effectively permanent. `-X` is a HotSpot extension:
not guaranteed elsewhere, and explicitly subject to change. `-XX` is an advanced developer
option carrying the same disclaimer plus a warning that it is not recommended for casual use.
The practical reading is that as you add dashes you are moving from a specified interface
towards an implementation detail, and your production configuration should be conscious of
how much of it lives at the far end.

**★ Both `-Xmx` and `-XX:MaxRAMPercentage` set the maximum heap. Why do they have different
prefixes, and does the difference mean anything?**
The difference is historical rather than semantic. The `-X` set is old and effectively
frozen; new HotSpot tuning options have gone into `-XX` for years, so `MaxRAMPercentage`
landed there simply because it was added later. It means nothing about relative stability or
official status — the reference applies the identical "subject to change" language to both
classes. The useful lesson is negative: you cannot infer anything about a flag's importance
or permanence from its prefix, so a review that approves `-Xmx` and blocks
`-XX:MaxRAMPercentage` on prefix grounds is reasoning from an intuition the documentation
does not support.

**★ Why are diagnostic and experimental options locked behind a separate unlock flag rather
than simply documented as risky?**
Because documentation does not survive copy-paste and a second flag does. Requiring
`-XX:+UnlockDiagnosticVMOptions` makes the risk *structurally visible* in the command line
itself, so it shows up in a diff, a Helm chart and a `ps` listing, where a comment in a wiki
would not. It also makes the acceptance explicit rather than accidental — the reference says
outright that options behind the diagnostic unlock *"are not supported"*, that reproducing
any problem without them may be required before Oracle Support will investigate, and that
they *"may be removed or their behavior changed without any warning."* You cannot enable one
by accident, and you cannot later claim you were not told.

**★ A flag was experimental on JDK 21 and is a product option on JDK 25. What breaks, and in
which direction?**
The flag itself gets easier — it no longer needs an unlock — but the *command line* around it
can break in both directions. A line carrying the old `-XX:+UnlockExperimentalVMOptions` now
carries an unlock with nothing left to unlock: harmless in effect but a false signal in every
future audit, since the presence of an unlock flag is normally itself a finding. In the
reverse direction, if someone tidies the unlock away while the flag is still experimental on
the JVM actually deployed, the launch aborts. The rule that covers both cases is to treat a
flag and its unlock as a pair and re-check them together on every upgrade.
`-XX:+UseCompactObjectHeaders` is the concrete instance on JDK 25: product, no unlock needed,
and JEP 519 explicitly lists making it the default as a non-goal.

**★ You find `-XX:+UnlockDiagnosticVMOptions` in a production command line. What do you do?**
Treat it as a finding before you even look at what it unlocked. Its presence means the
service is running at least one option the vendor states is unsupported and may change or
disappear without warning, which converts a routine JDK upgrade into a change with an
unbounded blast radius. First establish what it unlocks: if nothing — the diagnostic flag
beside it was removed at some point and only the unlock survived — it comes out immediately,
because it is pure risk at zero benefit. If something is still there, that flag needs a named
owner, a written reason and an expiry date. The common legitimate case is a diagnostic flag
added during an incident and never removed, which is exactly the pattern
`08-the-discipline.md` *(not written yet)* is designed to stop.

**★ Can you change a JVM flag on a running process, and what determines the answer?**
Sometimes, and the determining factor is whether the flag is *manageable*. Manageable flags
are writable at runtime via `jcmd <pid> VM.set_flag <name> <value>`, which is how you can
enable heap-dump-on-OOM on a process you are not allowed to restart. Most tuning flags are
not manageable: they are consumed during startup to size structures or select an
implementation, and there is no mechanism to re-apply them to a running VM. Which flags are
manageable is not enumerated in the `java` tool reference, so treat it as something you
discover by attempting the `VM.set_flag` and reading the response — the attempt is safe,
because a non-manageable flag is refused rather than silently accepted.

{/* FOOTER */}
