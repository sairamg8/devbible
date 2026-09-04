---
title: "Ask the JVM instead of believing the string: -XX:+PrintFlagsFinal prints every resolved flag with the origin that set it, and on JDK 25 there is no := marker to read — the origin is a separate column"
sidebar_label: "04 · PrintFlagsFinal"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference
> ([java](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) — which
> documents `-XX:+PrintFlagsRanges` and, as recorded below, **does not document
> `-XX:+PrintFlagsFinal` at all** — and the JDK 25 GC Tuning Guide
> ([Ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html)).
> Target: **JDK 25 (LTS)**. Documentation-validated; **no sandbox run**.

**Every argument about a flag string ends the same way: someone runs the JVM and reads what
it actually resolved to. `-XX:+PrintFlagsFinal` dumps every flag the JVM has, with its final
value and — the part that matters — **where that value came from**, so you can separate a
compiled-in default from a choice ergonomics made from a value you imposed. 🔴 Most material
about this flag, including this corpus's own topic 01, teaches you to read a `:=` marker
meaning "not default". **That reading does not exist on JDK 25.** The value is printed with a
plain `=` regardless of origin, and the origin is a separate token at the end of the line.
Reading for `:=` on a modern JDK finds nothing and concludes, wrongly, that nothing was
overridden.**

## The command

```bash
java -XX:+PrintFlagsFinal -version
```

`-version` matters: it gives the JVM something trivial to do so it starts, prints the table
and exits. You are not running your application; you are asking this JVM, on this machine,
with these flags, what it resolved to. Add your real flags to see how they interact:

```bash
java $JAVA_OPTS -XX:+PrintFlagsFinal -version
```

That single line answers question 1 of the three-question audit from
`01-the-flags-you-inherited.md` — *does it still exist* — and simultaneously answers a
question people rarely think to ask: *did it take effect, and did something else override
it?*

## The line format on JDK 25

Each row carries the flag's **type**, its **name**, a plain `=`, its **resolved value**, and
then brace-delimited tokens giving the flag's **category** and its **origin**.

The following is **illustrative** — it shows the shape of the columns, not output captured
from a run, and the numbers are not measurements:

```text
     uintx MaxHeapSize        = 2147483648    {product} {ergonomic}
      bool UseG1GC            = true          {product} {ergonomic}
      bool UseCompactObjectHeaders = false    {product} {default}
     uintx MaxMetaspaceSize   = 268435456     {product} {command line}
```

Read right to left. **The origin token is the whole point of the command.** The value tells
you what the JVM will do; the origin tells you *who decided*, and that is the difference
between "the default is fine" and "someone chose this in 2019".

The origins you will meet in practice:

| Origin | Means |
|---|---|
| `{default}` | Nobody touched it — this is the value compiled into the JVM |
| `{ergonomic}` | 🔴 The JVM chose it by inspecting the machine — see `03-ergonomics.md` |
| `{command line}` | You (or something that built your command line) set it explicitly |

⚠️ **The complete set of origin tokens is not enumerated in the JDK 25 tool reference**, and
this page does not assert one. Others exist for values arriving from the environment and
from runtime management operations. Treat the three above as the ones that carry the audit
signal and read whatever else appears rather than assuming the list is closed.

## 🔴 The `:=` correction, and why it matters more than a formatting detail

Older HotSpot printed a **`:=`** instead of `=` on any flag whose value was not the default.
That made a "what did we change?" audit a single `grep`:

```bash
# Pre-JDK-25 idiom. On JDK 25 this matches NOTHING and the silence looks like an answer.
java -XX:+PrintFlagsFinal -version | grep ':='
```

On JDK 25 the assignment operator is a plain `=` on every row, and the non-default
information moved into the origin token. The correct modern equivalent asks for the origins
that are not `{default}`:

```bash
# What is NOT at its compiled-in default, on this JVM, with these flags:
java $JAVA_OPTS -XX:+PrintFlagsFinal -version | grep -v '{default}'

# Narrower: only what a human or a script imposed, excluding ergonomic choices:
java $JAVA_OPTS -XX:+PrintFlagsFinal -version | grep 'command line'
```

The reason to belabour a punctuation change is the **failure mode**, which is silent and
confirms the wrong conclusion. A `grep ':='` on JDK 25 returns nothing. Nothing is not an
error; it reads as *"nothing has been overridden"*, which is precisely the opposite of what
a long inherited `JAVA_OPTS` means. An engineer running the command they have run for a
decade gets a clean result and stops looking.

🔴 **This corpus carries the defect.** `01-memory-layout/09d-verifying-what-the-jvm-chose.md`
teaches the `:=` reading, and `02-gc-in-practice/02c2-flags-that-still-work.md` cites
`-XX:+PrintFlagsFinal` as appearing in the JDK 25 `java` man page. Both are wrong and both
are recorded as defects for the phase to repair; they are named here so a reader who meets
them knows which page to believe.

## `PrintFlagsFinal` is not in the tool reference

Checked directly against the JDK 25 `java` page: **`-XX:+PrintFlagsRanges` is documented and
`-XX:+PrintFlagsFinal` is not.** The flag works — it is a product option and has been the
standard introspection tool for many years — but it has no entry in the manual.

Two practical consequences, and the second is the one that bites:

- Do not cite the man page as the source for its behaviour. It is not there.
- **Its output format is therefore not a documented interface.** The `:=` change is exactly
  what an undocumented format is entitled to do between releases. Anything that parses this
  output — a compliance script, a config-drift detector, a startup assertion — is parsing an
  undocumented format and will break silently. For a machine-readable answer on a running
  process, use `jcmd`, which is documented; [VM flags on a running process](04b-vm-flags-on-a-running-process.md) covers it.

The related documented flag is worth knowing for a different job:

> *"`-XX:+PrintFlagsRanges` — Prints the range specified and allows au…"*

(The reference's own entry, quoted as far as it was legible in the source consulted.) It
prints the *permitted ranges* for flags rather than their resolved values — the question
"what values would this flag even accept", not "what is it set to".

## What to actually do with the output

Three jobs, three commands. This is the payoff of the whole page:

**1 · Does this flag string start a JVM on the target release?**

```bash
java $JAVA_OPTS -version
```

Cheapest possible upgrade check. Aborts and names the flag, or prints a banner.

**2 · What is not at its default, and who set it?**

```bash
java $JAVA_OPTS -XX:+PrintFlagsFinal -version | grep -v '{default}'
```

The audit list. Everything here is either an ergonomic decision the JVM made — which you
should mostly leave alone — or something a human imposed, which needs a reason.

**3 · Did my flag actually take effect?**

```bash
java $JAVA_OPTS -XX:+PrintFlagsFinal -version | grep -i maxrampercentage
```

Prints the resolved value and its origin. If you set it and the origin says `{ergonomic}` or
`{default}`, your flag did not reach the JVM — which is a configuration-delivery problem, not
a JVM problem, and `07-where-flags-come-from.md` *(not written yet)* is where it lives.

## Gotchas

**★ Symptom: `grep ':='` against `PrintFlagsFinal` returns nothing on JDK 25, and the
conclusion drawn is that no flags are overridden.** Cause: the `:=` marker no longer exists;
values print with a plain `=` and the non-default signal moved to the origin token. Empty
output is not evidence of a clean configuration — it is evidence of grepping for a marker the
JVM stopped emitting. Fix: filter on origin instead.

```bash
java $JAVA_OPTS -XX:+PrintFlagsFinal -version | grep -v '{default}'
```

**★ Symptom: a flag is in the deployment manifest, and `PrintFlagsFinal` shows the value with
origin `{default}`.** Cause: the flag never reached the JVM. `JAVA_OPTS` is not read by the
JVM and needs a script to expand it; an exec-form `ENTRYPOINT` performs no shell expansion at
all. Fix: verify delivery rather than syntax — the flag is spelled correctly and is simply
not being passed. Move it to `JDK_JAVA_OPTIONS`, which the launcher reads by itself.

**★ Symptom: a flag is set, `PrintFlagsFinal` shows a different value, and the origin still
says `{command line}`.** Cause: the flag was set more than once — a base image, an
environment variable and the command line can all contribute — and a later occurrence
overrode the earlier one. The origin is still "command line" because that is where the
winning value came from; it does not tell you there were three of them. Fix: read the
assembled command line rather than any single source.

```bash
jcmd <pid> VM.command_line
```

**★ Symptom: a script that parsed `PrintFlagsFinal` output broke after a JDK upgrade with no
error, just wrong answers.** Cause: the output format is not a documented interface — the
flag is not even in the tool reference — so it is free to change between releases, and it
did. Fix: do not parse it in automation. Use `jcmd <pid> VM.flags` against a running process
for anything programmatic, and keep `PrintFlagsFinal` for interactive investigation.

**★ Symptom: `PrintFlagsFinal` output differs between two hosts on identical flags, in a long
list of unrelated-looking flags.** Cause: usually one of two things — ergonomics resolved
differently because the machines differ in processor count or memory limit (see the 1792 MB
threshold in `03-ergonomics.md`), or one host has an unlock flag open and is therefore
listing options the other hides entirely. Fix: compare the origins, not the values, and check
the unlock flags first; a difference in visible flag *count* points at a gate rather than at
tuning.

**★ Symptom: a flag appears in `PrintFlagsFinal` with a sensible value but has no observable
effect.** Cause: it parsed, it is present, and it is *obsolete* — accepted, warned about and
ignored. Presence in the table means the flag exists, not that it does anything. Fix: check
the retired list in `06-the-retired-list.md` *(not written yet)*, and read the launch warnings,
which are the only place the JVM says so.

**★ Symptom: `-XX:+PrintFlagsFinal` is added to a production service to keep a record of its
configuration.** Cause: a reasonable instinct applied to the wrong tool — it prints hundreds
of lines at every start, into logs, forever. Fix: run it in CI or at a shell against the same
image, or query the running process on demand with `jcmd`. The information is the same and it
is not in your log budget.

## Interview questions

**★ What does `-XX:+PrintFlagsFinal` tell you that reading `JAVA_OPTS` cannot?**
Three things the string cannot express. First, the **resolved** value after every source has
been merged and later settings have overridden earlier ones, so you see what the JVM will
actually do rather than what someone intended. Second, the **origin** of each value, which
separates a compiled-in default from an ergonomic decision from something a human imposed —
and that distinction is the entire content of a flag audit. Third, the **full flag set**,
including hundreds of flags nobody set, which is how you discover that ergonomics chose a
collector or a heap size you assumed was configured. The string is a request; this is the
answer.

**★ On JDK 25, how do you find which flags are not at their defaults, and what is the trap?**
Filter on the origin token — `grep -v '{default}'` — because on JDK 25 the value is printed
with a plain `=` regardless of origin and the non-default information lives at the end of the
line. The trap is the older idiom `grep ':='`, which worked for years: HotSpot used to print
`:=` for any overridden flag. On JDK 25 that grep matches nothing, and nothing looks exactly
like a clean answer rather than like a broken query. It is a silent failure that confirms the
wrong conclusion, which is why it is worth knowing as a specific fact rather than as a
formatting footnote — and it is why this corpus's topic 01 page teaching the `:=` reading is
recorded as a defect.

**★ Would you use `PrintFlagsFinal` in a monitoring or compliance script?**
No, and the reason is stronger than style. The flag is not documented in the JDK 25 `java`
tool reference at all — only `-XX:+PrintFlagsRanges` is — so its output format is not a
committed interface and is free to change between releases without a deprecation cycle. The
`:=` change is exactly that having already happened once. A parser built on it breaks
silently, producing wrong answers rather than errors, which is the worst failure mode for a
compliance check. For anything programmatic, query a running process with `jcmd <pid>
VM.flags`, which is a documented tool.

**★ You set `-XX:MaxRAMPercentage=75.0` and `PrintFlagsFinal` reports the value with origin
`{default}`. What happened?**
The flag never reached the JVM. The value is the compiled-in default and the JVM is reporting
truthfully that nobody set it — so this is a delivery problem, not a syntax or support
problem, and re-reading the flag's spelling will waste the afternoon. The usual causes are
that the flag sits in `JAVA_OPTS`, which the JVM has never read and which requires a startup
script to expand, or that the container uses an exec-form `ENTRYPOINT` where no shell exists
to expand a variable reference. The fix is to use a variable the JVM reads by itself, such as
`JDK_JAVA_OPTIONS`, and then re-run the same check to confirm the origin has changed to
`{command line}`.

**★ Why is the origin column more useful in an audit than the value?**
Because the value alone cannot tell you whether a setting is a decision or an accident. A
heap size of 512 MiB might be a compiled-in default, an ergonomic choice made from the
cgroup limit, or a number a human typed years ago — the value is identical in all three cases
and the appropriate action is completely different in each. `{default}` means nothing to
audit. `{ergonomic}` means the JVM chose it and will keep improving that choice, so
overriding it needs a positive justification. `{command line}` means a person is responsible
and the three audit questions apply. The origin turns an undifferentiated list of hundreds of
flags into a short list of things somebody actually decided.

{/* FOOTER */}
