---
title: "main, startup and the two config channels"
sidebar_label: "06 · main and config channels"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 `java` launcher reference
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the `java.lang.System` Javadoc, and JEP 512 (Compact Source Files and
> Instance Main Methods, finalized in 25).

**A Java process receives configuration through exactly two channels — system
properties (`-D`, owned by the JVM, set on the command line) and environment
variables (owned by the OS, inherited from the parent process). Every deploy
script, Dockerfile and orchestrator manifest you will ever read is arranging
values into these two channels, and the position of an argument on the `java`
command line decides which channel — or neither — it lands in.**

## The entry point

The launcher looks for the classic signature:

```java
public class App {
    public static void main(String[] args) {
        // args = everything after the class/jar on the command line
    }
}
```

`public static void`, taking `String[]` (or varargs `String... args` — same
thing to the JVM). The method must be `static` because no instance exists yet.

Since Java 25 (JEP 512, finalized), smaller forms are also launchable —
an *instance* `main`, a `main` with no parameters, and compact source files
with no class declaration at all:

```java
// hello.java — a complete, launchable Java 25 program
void main() {
    IO.println("hello");
}
```

These exist to make Java teachable and script-friendly. Services and
frameworks continue to use the classic form — an executable jar's manifest
points at a class with `public static void main(String[])`, and that is the
shape you will see in every codebase.

## Command-line anatomy: position is meaning

```bash
java [jvm-options] -jar app.jar [program-arguments]
java [jvm-options] com.acme.App [program-arguments]
```

Everything **before** the jar/class name is read by the JVM. Everything
**after** it is handed to `main` as `args`, verbatim and unparsed. So:

```bash
java -Xmx512m -Dapp.env=prod -jar app.jar --verbose input.csv
#    └── JVM ──┴── property ──┘           └── args[0], args[1] ──┘
```

And the classic mistake:

```bash
java -jar app.jar -Dapp.env=prod     # -Dapp.env=prod is args[0], NOT a property!
```

Placed after the jar, `-D...` is just a string in `args`. `getProperty`
returns `null`, nothing warns, and the service silently runs with defaults.
This one misplacement has caused real outages; it is the first thing to check
when "the flag didn't take".

`args` is raw: the JDK ships no argument parser. Real CLIs use a library
(picocli is the current default choice); services mostly ignore `args`
entirely in favour of the two channels below.

## Channel 1: system properties (`-D`)

Key-value strings owned by the *JVM*, set at launch, read anywhere:

```java
String env = System.getProperty("app.env");          // null if unset
String env2 = System.getProperty("app.env", "dev");  // with default
```

The JVM pre-populates dozens of standard ones — `java.version`, `os.name`,
`user.dir` (working directory), `user.home`, `user.timezone`,
`java.io.tmpdir`, `file.separator`. Reading these beats guessing.

Properties are **mutable at run time** (`System.setProperty`) — occasionally
useful, mostly a trap: a test that sets a property and doesn't restore it
leaks state into every later test in the same JVM.

Two environment variables inject JVM options *without* touching the command
line: `JDK_JAVA_OPTIONS` (read by the `java` launcher, since 9) and
`JAVA_TOOL_OPTIONS` (read by essentially all JDK tools). Ops teams and APM
agents use them to add flags in containers — when a JVM logs options nobody
typed, look there.

## Channel 2: environment variables

Owned by the *operating system*, inherited from the parent process (shell,
systemd, container runtime), read-only from Java:

```java
String home = System.getenv("HOME");        // single variable, null if unset
Map<String, String> all = System.getenv();  // immutable snapshot
```

You cannot set an environment variable for your own running process — the
`getenv` map is immutable and there is no setter. That is the OS process
model, not a Java gap; anything that claims to work around it is a hack that
breaks across platforms.

## Which channel for what

| | System properties (`-D`) | Environment variables |
|---|---|---|
| Owned by | the JVM invocation | the OS process |
| Scope | this `java` command | the process and its children |
| Naming | `dot.separated.lowercase` | `UPPER_SNAKE_CASE` |
| Mutable in-process | yes (`setProperty` — carefully) | no |
| Typical content | JVM knobs, Java-library switches, per-run overrides | 12-factor app config, secrets from the orchestrator, anything language-agnostic |

The ecosystem convention, which Spring Boot later formalizes into an explicit
precedence order (Phase 9's configuration topic): **command-line and `-D`
override environment, environment overrides packaged defaults.** Kubernetes
manifests and Dockerfiles set environment variables; wrapper scripts and
`JAVA_OPTS`-style variables assemble `-D` flags. Both funnel into the same
two `System` calls.

Exit codes close the loop on startup's mirror image: `System.exit(n)` (or
`main` returning normally = 0) is what shell scripts and orchestrators see.
Non-zero means failure — CI gates and restart policies key off it.

## Gotchas

**Symptom:** a `-D` flag has no effect; `getProperty` returns `null` despite the flag being visibly on the command line
**Cause:** the flag sits *after* `-jar app.jar` or the class name, so it was passed to `main` as `args[0]` instead of reaching the JVM
**Fix:** JVM options go before the jar/class. Verify from inside: log `System.getProperty(...)` at startup, or check the args the app actually received

**Symptom:** a test passes alone, fails in the suite (or vice versa) depending on run order
**Cause:** some test called `System.setProperty` and never restored the old value — properties are JVM-global mutable state
**Fix:** restore in `@AfterEach` (or use JUnit extensions built for it); treat `setProperty` in production code as a design smell

**Symptom:** `export MY_VAR=x` in the shell, but the app started from the IDE sees `null`
**Cause:** the IDE process was not launched from that shell and never inherited the variable — environment is inherited at process creation, not looked up live
**Fix:** set the variable in the IDE's run configuration, or launch the IDE/app from the configured shell

**Symptom:** the JVM logs options — an agent, memory flags — that appear nowhere in the deploy script
**Cause:** `JDK_JAVA_OPTIONS` or `JAVA_TOOL_OPTIONS` is set in the container/host environment and the launcher picked it up
**Fix:** check both variables (`env | grep -i options`); they are legitimate injection points for ops tooling, but they belong in version-controlled config, not in a surprise

**Symptom:** `-Dkey=some value` truncates at the space
**Cause:** shell word-splitting — the property value ended at the first space
**Fix:** quote the whole flag: `"-Dkey=some value"`

**Symptom:** changing `TZ`/`user.timezone` behaves differently across machines; timestamps shift after a deploy
**Cause:** both channels can influence the default timezone (`TZ` env var, `-Duser.timezone`), and unset means "whatever the host says"
**Fix:** set `-Duser.timezone=UTC` explicitly for services and store `Instant` (Phase 7) — never depend on the host default

**Symptom:** code expects `args[0]` to be the program name, C-style, and is off by one
**Cause:** Java's `args` contains *only* the program arguments — the launcher and class name are not included
**Fix:** `args[0]` is the first real argument; the program's own name is not part of `args` at all

## Interview questions

**★ What is the difference between a system property and an environment variable?**
A system property is JVM-scoped, set per invocation with `-D` (or
`setProperty`), read with `System.getProperty`, and conventionally
dot.lowercase. An environment variable is OS-scoped, inherited from the
parent process, read-only via `System.getenv`, and UPPER_SNAKE. Services use
env for 12-factor config and secrets; `-D` for JVM and library knobs.

**★ Why does `java -jar app.jar -Dapp.env=prod` not set the property?**
Position: everything after `-jar app.jar` is a program argument. The string
`-Dapp.env=prod` arrives as `args[0]` and no property is set. JVM options
must precede the jar or main class.

**★ Can a Java program change its own environment variables?**
No — `System.getenv()` returns an immutable map and no setter exists,
because the OS process environment is fixed at process creation. The
in-process mutable channel is system properties, which is exactly why tests
must clean them up.

**★ Which `main` signatures can the launcher start?**
Classically `public static void main(String[] args)` (varargs form included).
Since Java 25 (JEP 512), also instance `main` methods, `main()` with no
parameters, and compact source files without a class declaration —
launch-protocol conveniences aimed at scripts and teaching; frameworks and
executable jars still target the classic form.

**What are `JDK_JAVA_OPTIONS` and `JAVA_TOOL_OPTIONS`?**
Environment variables the launcher (and JDK tools generally, for the latter)
read for extra JVM options — the standard way containers and APM agents
inject flags without editing the command line. First place to look when a
JVM runs options nobody typed.

**How does Spring Boot's configuration relate to these two channels?**
Boot builds a precedence ladder on top of them: command-line args and `-D`
properties override OS environment variables, which override profile YAML,
which overrides packaged defaults — same two channels underneath, plus
file-based sources (Phase 9's configuration topic).

**What does the process exit code mean and how do you set it?**
The integer the OS reports to the parent — 0 for success by convention.
`main` returning normally exits 0; `System.exit(n)` sets it explicitly.
Shell scripts, CI gates and restart policies branch on it.

---

← Index: [Phase 0 — The platform and the JVM](README.md) · Next → [JIT compilation](07-jit-compilation.md)
