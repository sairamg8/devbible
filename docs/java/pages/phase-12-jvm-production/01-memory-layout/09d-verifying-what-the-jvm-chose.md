---
title: "Which compression a JVM ended up with is an observation, not a deduction from your flags — the encoding depends on where the operating system let the heap be mapped, so the only correct answer to \"are compressed oops on?\" is a command"
sidebar_label: "09d · Verifying what the JVM chose"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html))
> and the **JDK 25 `jcmd` tool reference and troubleshooting guide**
> ([docs.oracle.com/en/java/javase/25/troubleshoot/](https://docs.oracle.com/en/java/javase/25/troubleshoot/)),
> including the documented `VM.native_memory` subcommands and NMT overhead figures.
> JDK 25 · Spring Boot 4.1.1.
>
> ⚠️ **Corrected 2026-09-05:** this page previously taught the pre-JDK-25 `:=` marker for
> non-default flags. JDK 25 prints a plain `=` on every row and reports the origin as a
> separate brace-delimited token. See
> [`../13-jvm-flags-that-matter/04-printflagsfinal.md`](../13-jvm-flags-that-matter/04-printflagsfinal.md),
> which owns this flag.
> **No sandbox** — this page shows commands to run and describes what each reports. It
> contains no captured output from any JVM.

**Everything in [09](09-compressed-oops.md) and
[09b](09b-alignment-and-class-pointers.md) is settled at startup by a negotiation between
your flags, container ergonomics and where the operating system was willing to map the heap
— and only the first of those three is under your control. That is why every claim about
compression on a running JVM has to be checked rather than reasoned about. This chunk is the
four commands that check it, and what each one can and cannot tell you.**

The habit is the point. "We set the flag" is not evidence. "Two identical containers" is not
evidence. The log line is evidence.

## 1. Which flags ended up set — `-XX:+PrintFlagsFinal`

```bash
java -XX:+PrintFlagsFinal -version \
  | grep -Ei 'UseCompressedOops|UseCompressedClassPointers|ObjectAlignmentInBytes|CompressedClassSpaceSize|UseCompactObjectHeaders'
```

This prints every flag's **final** value — after your command line, after ergonomics, and
after any flag that sets another as a side effect.

🔴 **Read the origin, not just the value.** On JDK 25 the separator is a plain `=` on every
line regardless of where the value came from, and the origin is a **separate brace-delimited
token at the end of the row**:

```text
     uintx MaxHeapSize                 = 2147483648   {product} {ergonomic}
      bool UseCompressedOops            = true         {product} {ergonomic}
      bool UseCompactObjectHeaders      = false        {product} {default}
     uintx ObjectAlignmentInBytes       = 8            {product} {command line}
```

*(Illustrative — this shows the shape of the columns, not output captured from a run, and
the numbers are not measurements.)*

| Origin token | Means |
|---|---|
| `{default}` | Nobody touched it — the value compiled into the JVM. |
| `{ergonomic}` | 🔴 The JVM chose it by inspecting the machine — the container's CPUs and memory limit. |
| `{command line}` | You, or something that built your command line, set it explicitly. |

⚠️ **The complete set of origin tokens is not enumerated in the JDK 25 tool reference**, and
this page does not assert one — others exist for values arriving from the environment and
from runtime management operations. Treat the three above as the ones that carry the audit
signal, and read whatever else appears rather than assuming the list is closed.

That origin column is the entire reason `PrintFlagsFinal` earns a place in an incident, and
it is the fastest way to answer "did my flag actually take effect, or did something override
it?" A flag you passed that shows `{default}` did not reach the JVM. A flag you never passed
that shows `{ergonomic}` was chosen for you by the machine's shape, and a flag showing
`{command line}` that you cannot find in your own manifest arrived from an entrypoint script
or an environment variable — finding out which is the next question.

🔴 **Older HotSpot printed `:=` instead of `=` on any non-default flag, and most material
online still teaches that reading. It does not exist on JDK 25.** The consequence is worse
than a cosmetic mismatch: the classic audit idiom
`java -XX:+PrintFlagsFinal -version | grep ':='` matches **nothing** on a modern JDK, and
empty output reads exactly like "nothing is overridden" rather than "you grepped for a
marker that is no longer printed". Grep the origin token instead:

```bash
java -XX:+PrintFlagsFinal -version | grep -E '\{(ergonomic|command line)\}'
```

**13 · JVM flags that matter** *(not written yet)* owns `PrintFlagsFinal` in
general, including the product/diagnostic/experimental distinction that governs which flags
appear at all.

## 2. Which encoding mode it actually landed in — `-Xlog:gc+heap+coops`

```bash
java -Xlog:gc+heap+coops=info -Xmx30g -version
```

The `gc+heap+coops` unified-logging tag exists precisely to report the chosen **heap base and
shift**. That is the only direct evidence of which of the three encoding modes from
[09](09-compressed-oops.md) you got, because the mode depends on where the heap was mapped —
information that exists nowhere in your flags.

🔴 **If your heap is anywhere near the 32 GB boundary, put this tag in your permanent startup
logging.** It costs one line at startup, it is written before anything interesting happens,
and it converts a category of "mysterious few-percent difference between hosts" into a fact
you can read. This is the single highest-value logging recommendation on the whole subject.

Unified logging is the JDK 9+ framework; `-XX:+PrintGCDetails` and its relatives are gone.
**Topic 02 · GC in practice** *(not written yet)* owns `-Xlog` properly.

## 3. A process that is already running — `jcmd`

Two subcommands, and the second is the one that settles arguments:

```bash
jcmd <pid> VM.flags            # the flags this JVM is running with
jcmd <pid> VM.command_line     # what it was actually launched with
```

`VM.flags` answers "what is true now". `VM.command_line` answers "what did this process
actually receive", which is regularly not what anyone intended, because by the time the JVM
starts, the arguments have passed through an entrypoint script, `JAVA_TOOL_OPTIONS`,
`JDK_JAVA_OPTIONS`, a Helm chart and possibly a base image's own defaults.

A third is worth knowing for the same reason:

```bash
jcmd <pid> VM.system_properties
jcmd <pid> VM.version
```

`jcmd` with no subcommand lists the PIDs it can see; `jcmd <pid> help` lists what that JVM
supports. Both are better first moves than guessing at a subcommand name.

## 4. What it cost you in the regions — Native Memory Tracking

Flags tell you what was configured. NMT tells you what was actually reserved and committed,
broken down by JVM subsystem — which is how you see the class-space side of the bill rather
than inferring it.

```bash
# started with -XX:NativeMemoryTracking=summary
jcmd <pid> VM.native_memory summary
```

NMT reports **Java Heap** and **Class** as separate categories, so the effect of compressed
class pointers on metadata is visible directly. The documented subcommands are `summary`,
`detail`, `baseline`, `summary.diff` and `detail.diff`, and the diff forms against a baseline
are what turn NMT from a snapshot into a growth investigation.

⚠️ **NMT is not free.** The troubleshooting guide documents a **5–10% JVM performance drop**
when it is enabled, plus **two machine words added to every malloc** as a tracking header.
That is a deliberate, temporary diagnostic setting, not a permanent production default.
[11 · Native memory tracking](11-native-memory-tracking.md) owns it in full.

## Putting it together: a five-minute audit

For a service you have inherited and know nothing about:

```bash
jcmd <pid> VM.command_line     # what it was actually given
jcmd <pid> VM.flags            # what it ended up with
jcmd <pid> VM.version          # which JDK, before you trust any flag advice
```

Then, if the heap is near 32 GB, add `-Xlog:gc+heap+coops=info` to the startup arguments and
restart once — that one line answers a question that no amount of reading the deployment
manifest can.

The order matters. Establish the JDK version first, because half of the flag advice on the
internet is for a JDK that had different defaults, different collectors, or flags that no
longer parse. Establish the actual command line second, because that is where the surprises
are. Only then reason about what the values mean.

## Gotchas

**★ `-XX:+PrintFlagsFinal` on a bare `-version` run does not always match your service.**
Ergonomics depends on the container's CPU and memory limits, and several of these flags are
set by ergonomics. Run it inside the same container shape, or use `jcmd VM.flags` against the
real process, or you are reading a different JVM's decisions than the one you care about.

**★ The origin token in `PrintFlagsFinal` output is not decoration, and the `:=` marker you
were taught to grep for is not printed on JDK 25.** `{ergonomic}` or `{command line}` means
the value was changed from the default by *something* — possibly a flag you did not know was
setting it as a side effect. A flag you passed that still shows `{default}` never reached the
JVM. When two flags disagree, the origin column is how you find out which one won. The trap
is that the pre-JDK-25 idiom `grep ':='` returns no rows at all, and an empty result is read
as "clean" rather than "wrong query" — so the audit silently passes a JVM nobody checked.

**★ You cannot deduce the encoding mode from `-Xmx`.** Staying under 32 GB gets you
compression; it does not get you zero-based mode, which additionally depends on where the OS
mapped the heap. Only `gc+heap+coops` reports the base and shift that were chosen.

**★ `VM.flags` and `VM.command_line` answer different questions.** The first shows the JVM's
final state, the second shows what it was handed. When they disagree, the gap is ergonomics
or a flag with side effects — and that gap is usually the thing you were looking for.

**★ Environment variables inject flags you did not write.** `JAVA_TOOL_OPTIONS`,
`JDK_JAVA_OPTIONS` and `_JAVA_OPTIONS` all feed the JVM, and base images and agents set them.
`VM.command_line` is how you find out. Do not audit a deployment by reading the YAML.

**★ NMT costs 5–10% throughput and adds two words to every malloc.** The troubleshooting
guide states both. Turn it on to answer a question, then turn it off. Leaving it on
"just in case" makes every future measurement of that service slightly wrong.

**★ NMT tracks the JVM's own allocations only.** The documentation is explicit that it *"does
not track memory allocations by non-JVM code"* — a native library's allocations are invisible
to it. A process whose growth NMT cannot account for is showing you exactly that, and it is a
finding, not a failure of the tool. See
[11c · The footprint that is not in any region](11c-the-footprint-that-is-not-in-any-region.md).

**★ `jcmd` needs to reach the target process.** It works over the attach mechanism, which
means the same user (or sufficient privilege) and a shared PID namespace. In a container,
"jcmd cannot see my PID" is usually a namespace problem, not a JVM problem — you have to run
it inside the container, or with the process's namespace joined.

**★ A flag that does not exist is fatal, so a failed launch is also information.** On JDK 25
an unrecognised `-XX:` option prevents startup. If a service refuses to boot after a JDK
upgrade, a retired flag is the first hypothesis — and `-XX:+IgnoreUnrecognizedVMOptions` is
how you hide the problem rather than fix it. **Topic 13** *(not written yet)*
owns the retired-flag inventory.

## Interview questions

**★ How do you verify what a running JVM actually chose?**
`java -XX:+PrintFlagsFinal -version | grep UseCompressedOops` for whether compression is on
and at what alignment — reading the trailing origin token (`{default}` versus `{ergonomic}`
versus `{command line}`) to see whether anything set it, because on JDK 25 the value is
always printed with a plain `=`.
`-Xlog:gc+heap+coops=info` at startup for the encoding mode, base and shift, which is the
only direct evidence of the mode. `jcmd <pid> VM.flags` and `jcmd <pid> VM.command_line` for
a process already running, the latter showing what actually reached the JVM after the
entrypoint script and environment variables had their turn. The point is that these are
observations: you cannot deduce the encoding mode from `-Xmx`, and you cannot deduce a
container's ergonomics from a `-version` run on your laptop.

**★ Why can two JVMs with identical flags end up with different compressed-oops encodings?**
Because the encoding depends on where the heap was actually mapped in the address space, not
on the flags. If the JVM can place the heap so the base is zero, it gets the cheaper
zero-based mode — a single shift to decode. If address-space fragmentation, ASLR, or a heap
size close to the ceiling prevents that, it falls back to base+shift, which adds an add and a
null check on top of the shift. The flags are identical; the outcome is not. This is why the
`gc+heap+coops` log tag exists, and why "we set the same flags" is not evidence of the same
behaviour.

**★ How do you tell from `PrintFlagsFinal` output whether a flag holds its default, and what
changed if it does not?**
Read the brace-delimited **origin token** at the end of the row: `{default}` means the flag
still holds its built-in value, `{ergonomic}` means the JVM chose it by inspecting the
machine, and `{command line}` means it was imposed. It matters in exactly the two cases where
people get confused. First, you passed a flag and it shows `{default}` — it did not reach the
JVM, so the problem is in the entrypoint or the manifest, not in the JVM. Second, you did not
pass a flag and it shows `{ergonomic}` — the machine's shape set it, which is how you discover
that, say, selecting a collector changed several sizing defaults underneath you.

🔴 **The follow-up that catches people:** many candidates answer this with the `:=` marker,
because that is what a decade of blog posts describe. On JDK 25 the value is printed with a
plain `=` whatever its origin, and `grep ':='` returns nothing — which is far more dangerous
than an error, because empty output looks like a clean audit. Knowing that the marker moved
into its own column is the difference between an audit and a reassuring illusion.

**★ A colleague says "we definitely have compressed oops on, it's in the Helm chart." How do
you respond?**
That the chart records an intention, not an outcome. The arguments pass through an entrypoint
script, possibly `JAVA_TOOL_OPTIONS` set by the base image or an injected agent, and then
through ergonomics — and any of those can change or override what arrives.
`jcmd <pid> VM.command_line` shows what the process was actually handed, and
`jcmd <pid> VM.flags` shows what it settled on. Also worth noting: compressed oops are on by default anyway, so the
interesting question is usually not whether the flag is set but whether the heap size let the
JVM keep them, which only `-Xlog:gc+heap+coops` answers.

**★ You are asked to prove that a memory regression came from losing compressed oops. What
evidence would you gather?**
Direct evidence first: the `gc+heap+coops` startup line from before and after, showing
compression on in one and off in the other, or `jcmd VM.flags` on both processes.
Corroborating evidence second: live-set-after-full-GC from the GC logs, which should rise for
identical traffic, and a heap histogram or dump comparison showing the same object counts
occupying more space. The `VM.command_line` output from both would show the `-Xmx` change that
caused it. I would want the direct evidence, because the corroborating evidence is also
consistent with a genuine growth in live data, and the two need distinguishing.

**★ Why is NMT not a good permanent production setting?**
Because it is documented as costing a 5–10% JVM performance drop and adding two machine words
to every malloc as a tracking header — so it changes both the throughput and the memory
footprint of the thing you are measuring. It is the right tool to answer a specific question
about native growth, run deliberately for the duration of the investigation, with a baseline
taken and `summary.diff` used to see change over time. Leaving it on permanently means every
future measurement of that service carries the overhead and every comparison against another
service is slightly unfair.

**★ `jcmd` cannot see the JVM's PID inside a container. What is going on?**
Almost certainly a namespace or permissions problem rather than anything wrong with the JVM.
`jcmd` uses the attach mechanism, which requires the same user (or enough privilege) and a
shared PID namespace with the target. Running `jcmd` from the host against a process in a
container's own PID namespace will not find it. The usual answers are to run `jcmd` inside
the container — which is an argument for a base image that contains the JDK tools rather than
a bare JRE — or to attach into the process's namespace. This is also why
**topic 10's** *(not written yet)* choice between a JRE and a JDK base image is
an observability decision, not just a size decision.

{/* FOOTER */}
