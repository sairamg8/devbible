---
title: "The JVM now has a CompileCommand whose only purpose is to keep a method's arguments alive, and JMH auto-detects it by launching a throwaway JVM and reading the error messages — so on a modern JDK your benchmarks are probably already using it"
sidebar_label: "06b · Compiler blackholes"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `CompilerHints` source** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-core/src/main/java/org/openjdk/jmh/runner/CompilerHints.java)),
> which contains the mode enum, the auto-detection probe and the flags JMH adds, and the
> `Blackhole` source's `COMPILER_BLACKHOLE` static initialiser. Cross-checked against the
> **JDK 25 `java` man page** ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)):
> 🔴 **`blackhole` is *not* in the man page's documented `-XX:CompileCommand` list** —
> it is a diagnostic/experimental command, which is exactly why JMH probes for it rather
> than assuming it. JMH 1.37, JDK 25. 🔴 **No sandbox.**

**[06](06-blackholes.md) described a 545-line class built from padding, volatile reads and
inlining prohibitions. This page is about the version where the JVM simply agrees not to
optimise the arguments away, and the fact that JMH switches to it silently.**

## The three modes

`CompilerHints` defines them, with the descriptions it prints:

| Mode | `shouldBlackhole` | `shouldNotInline` | description |
|---|---|---|---|
| `COMPILER` | `true` | `false` | *"compiler"* |
| `FULL_DONTINLINE` | `false` | `true` | *"full + dont-inline hint"* |
| `FULL` | `false` | `false` | *"full"* |

`FULL_DONTINLINE` is the classic mechanism from [06](06-blackholes.md): the hand-built
blackhole, with `dontinline` hints so the safety net holds. `COMPILER` hands the job to the
JIT instead.

The hints JMH writes into its compile-command file show the switch precisely:

```
inline,org/openjdk/jmh/infra/Blackhole.consume
dontinline,org/openjdk/jmh/infra/Blackhole.consumeCPU
blackhole,org/openjdk/jmh/infra/Blackhole.consumeCompiler      # only in COMPILER mode
dontinline,org/openjdk/jmh/infra/Blackhole.consumeFull         # only when not
dontinline,org/openjdk/jmh/infra/Blackhole.clearBox
```

🔴 **Two different consume implementations exist in the class** — `consumeCompiler` and
`consumeFull` — and which one runs is decided by the mode at startup. The `Blackhole` class
reads the system property `compilerBlackholesEnabled` in a static initialiser to know which it
is in.

In `COMPILER` mode the runner also adds, verbatim from the source:

```
-XX:+UnlockDiagnosticVMOptions
-XX:+UnlockExperimentalVMOptions
-DcompilerBlackholesEnabled=true
```

⚠️ **Those unlock flags are the giveaway that this is not a supported production feature.**
The `Blackhole` implementation notes call it *"an experimental compiler support for
Blackholes that instructs compilers to treat specific methods as blackholes: keeping their
arguments alive"*, and add the intention: *"At some point in the future, we hope to switch to
that mode by default, thus greatly simplifying the Blackhole code."*

## How JMH decides — it launches a JVM and reads the complaints

The detection is refreshingly literal. `compilerBlackholesAvailable()` runs a throwaway JVM:

```bash
<current jvm> -XX:+UnlockExperimentalVMOptions \
              -XX:CompileCommand=quiet \
              -XX:CompileCommand=blackhole,some/fake/Class.method \
              -version
```

and inspects the output for lines containing `CompilerOracle` or `CompileCommand`. 🔴 **A JVM
that does not know the command complains; a JVM that does stays quiet** — note the
`-XX:CompileCommand=quiet` first, which the man page describes as suppressing the normal
echo of compile commands, so anything printed afterwards is an actual error.

The selection order in `blackholeMode()`:

1. **Forced.** `-Djmh.blackhole.mode=COMPILER|FULL_DONTINLINE|FULL` wins. If you force
   `COMPILER` and the probe says it is unavailable, JMH throws
   `"Compiler Blackholes are not available in current VM"`. An unknown name throws
   `"Unknown Blackhole mode: …"`.
2. **Auto-detect**, on by default — `jmh.blackhole.autoDetect` defaults to `"true"`. Available
   → `COMPILER`; otherwise → `FULL_DONTINLINE`. Disable it with
   `-Djmh.blackhole.autoDetect=false`.
3. **Fallback** → `FULL_DONTINLINE`.

The enum that records *how* the mode was chosen carries the instructions in its own
descriptions: `AUTO` — *"auto-detected, use `-Djmh.blackhole.autoDetect=false` to disable"*;
`FALLBACK` — *"fallback, use `-Djmh.blackhole.mode` to force"*; `FORCED` — *"forced"*.
`-Djmh.blackhole.debug=true` prints the probe's output.

🔴 **So on a JDK that supports it, `COMPILER` is what you get without asking.** This is the
answer to "are compiler blackholes on by default?" — not a JVM default, but a JMH default,
reached by probing your JVM at run time.

## Why it matters that the two modes differ

- **Different code runs.** `consumeCompiler` versus `consumeFull` are different method bodies
  with different costs. A benchmark's absolute numbers can shift between two machines whose
  JDKs differ in blackhole support, with nothing in your source changed.
- **Cross-machine comparisons need the same mode.** If you compare a laptop result with a CI
  result, pin the mode explicitly rather than letting each host auto-detect.
- **It is one more thing to record.** JMH prints the mode; a benchmark result quoted without
  its harness configuration is missing a variable.

## Gotchas

🔴 **`blackhole` is not a documented `-XX:CompileCommand` in the JDK 25 man page.** The man
page lists `break`, `compileonly`, `dontinline`, `exclude`, `help`, `inline`, `log`, `option`,
`print` and `quiet`. `blackhole` is a diagnostic/experimental addition, which is why JMH
unlocks diagnostic *and* experimental options before using it — and why probing beats
assuming.

🔴 **Forcing `COMPILER` on a JVM without support is a hard failure, not a downgrade.** JMH
throws rather than silently reverting, which is the right behaviour and worth knowing before
you put `-Djmh.blackhole.mode=COMPILER` in a CI script.

⚠️ **Auto-detection costs a JVM launch.** It is cheap relative to a benchmark run, but it is
real work at startup and it needs to be able to fork a JVM — locked-down environments that
forbid subprocesses can make detection fail.

⚠️ **`FULL` (without `dontinline`) removes the safety net** described in the `Blackhole`
implementation notes. It exists for experiments with the harness itself, not for measurement.

⚠️ **Comparing scores across JDK versions silently changes the blackhole mode.** A JDK
upgrade can flip `FULL_DONTINLINE` to `COMPILER`, which changes harness overhead — a
"regression" or "improvement" that is entirely in the measurement apparatus.

⚠️ **This is JMH-internal machinery that can change.** The implementation notes say the
project hopes to make the compiler mode the default and simplify the class; treat mode names
and flags as version-specific and check them against the JMH you actually run.

## Interview questions

**★ What is a compiler blackhole?**
Experimental JVM support that instructs the compiler to treat a specific method as a
blackhole — keeping its arguments alive — so the harness does not have to construct an
un-optimisable sink by hand. JMH requests it with
`-XX:CompileCommand=blackhole,org/openjdk/jmh/infra/Blackhole.consumeCompiler`.

**★ How does JMH decide whether to use it?**
By probing: it launches a throwaway JVM with `-XX:CompileCommand=quiet` and a fake
`blackhole` command and looks for `CompilerOracle`/`CompileCommand` complaints in the output.
Available → `COMPILER` mode; otherwise → `FULL_DONTINLINE`.

**★ Is auto-detection on by default, and how do you override it?**
Yes — `jmh.blackhole.autoDetect` defaults to true. Force a mode with `-Djmh.blackhole.mode=…`
(`COMPILER`, `FULL_DONTINLINE`, `FULL`), disable detection with
`-Djmh.blackhole.autoDetect=false`, and debug the probe with `-Djmh.blackhole.debug=true`.

**★ What happens if you force `COMPILER` on a JVM that does not support it?**
JMH throws `IllegalStateException` with *"Compiler Blackholes are not available in current
VM"*. It does not silently fall back, which prevents a script from quietly measuring something
other than what it asked for.

**★ Which JVM flags does JMH add in `COMPILER` mode?**
`-XX:+UnlockDiagnosticVMOptions`, `-XX:+UnlockExperimentalVMOptions` and
`-DcompilerBlackholesEnabled=true` — the last of which the `Blackhole` class reads in a static
initialiser to select `consumeCompiler` over `consumeFull`.

**★ Is `blackhole` a documented `CompileCommand`?**
Not in the JDK 25 `java` man page, which lists `break`, `compileonly`, `dontinline`,
`exclude`, `help`, `inline`, `log`, `option`, `print` and `quiet`. It is diagnostic and
experimental — hence the unlock flags and the probe.

**★ Why can the same benchmark score differently on two machines with identical hardware?**
Among other reasons, because their JDKs may resolve to different blackhole modes, so a
different consume implementation runs with different overhead. Pin the mode when comparing
across hosts.

**★ Why does JMH hint `inline` for `consume` but `dontinline` for `consumeCPU`?**
They have opposite requirements: the consume path should be as cheap as possible in the
measured code, while `consumeCPU`'s controlled busy-work must not be inlined and folded into
the caller. JMH states both hints explicitly rather than hoping for the right heuristic.

Next: [Forks and warmup](07-forks-and-warmup.md).

{/* FOOTER */}
