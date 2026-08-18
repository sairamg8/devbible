---
title: "ProcessBuilder"
sidebar_label: "10 · ProcessBuilder"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ProcessBuilder`,
> `Process` (including the block/deadlock warning in its class description,
> `onExit`, `inputReader`), `ProcessBuilder.Redirect` and `ProcessHandle`.

**Shelling out is an API call to the operating system, and the two ways teams
get it wrong are both silent: building a command by string concatenation
(which either breaks on the first filename with a space or becomes an
injection hole), and forgetting that a child process writing to a full pipe
buffer simply stops — so the "hung" deployment script was actually your JVM
never reading its output. `ProcessBuilder` fixes both if you use it the way
it was designed: argument lists, explicit redirection, and a drain or a
timeout on everything.**

## Argument lists, never command strings

```java
// RIGHT: each argument is one list element, passed to the OS verbatim
Process p = new ProcessBuilder("git", "log", "--format=%H", "--", userPath)
        .start();
```

There is no shell between you and the child: no word-splitting, no glob
expansion, no `$VAR` interpolation, no `;`. A `userPath` of
`"; rm -rf /"` is just a strange filename argument. That protection
disappears the moment you invoke a shell yourself:

```java
// WRONG unless you truly need shell features — now userInput IS code
new ProcessBuilder("/bin/sh", "-c", "grep " + userInput + " app.log");
```

If you need a pipeline or a glob, prefer `ProcessBuilder.startPipeline`
(JDK 9) or expand the glob in Java (`Files.newDirectoryStream`) over
handing untrusted text to `sh -c`.

## Redirection — decide where every stream goes

Three child streams, each independently redirectable via
`ProcessBuilder.Redirect`:

| Redirect | Meaning |
|---|---|
| `PIPE` (default) | you read/write it through `Process` — **you now owe a drain** |
| `INHERIT` | child shares the JVM's own stdin/stdout/stderr — right for CLIs |
| `to(file)` / `appendTo(file)` | straight to a log file, no thread needed |
| `from(file)` | feed stdin from a file |
| `DISCARD` (JDK 9) | throw it away — the null device, portably |

`redirectErrorStream(true)` merges stderr into stdout so there is only one
stream to drain — usually the right first move for tooling.

## The stream-draining deadlock

The `Process` Javadoc says it plainly: the pipe buffers between parent and
child are limited and platform-dependent, and *"failure to promptly write
the input stream or read the output/error stream of the subprocess may
cause the subprocess to block, or even deadlock."* The child calls
`write(2)`, the buffer is full because nobody on the Java side is reading,
and the child sleeps forever — while your code sits in `waitFor()`.

The safe shapes, in order of preference:

1. **Redirect instead of piping** — `INHERIT`, a file, or `DISCARD`. No
   Java-side reader, no deadlock possible.
2. **Merge and drain before waiting:**

```java
ProcessBuilder pb = new ProcessBuilder(cmd).redirectErrorStream(true);
Process p = pb.start();
String out;
try (var reader = p.inputReader()) {          // JDK 17+, charset-aware
    out = reader.lines().collect(Collectors.joining("\n"));
}                                             // read to EOF *first*
boolean done = p.waitFor(30, TimeUnit.SECONDS);
```

3. **Two piped streams → two readers.** If you keep stdout and stderr
   separate, drain them on different threads (virtual threads make this
   cheap — [platform vs virtual threads](../phase-6-concurrency/02-platform-vs-virtual-threads/README.md));
   one loop alternating between them can still deadlock when the *other*
   pipe fills.

## Waiting, timeouts and the kill ladder

`waitFor()` blocks forever; services use the timed form and escalate:

```java
if (!p.waitFor(30, TimeUnit.SECONDS)) {
    p.destroy();                                   // polite: SIGTERM
    if (!p.waitFor(5, TimeUnit.SECONDS)) {
        p.destroyForcibly();                       // SIGKILL — no cleanup runs
        p.waitFor();
    }
}
int code = p.exitValue();                          // now safe to read
```

- `exitValue()` before termination throws `IllegalThreadStateException` —
  gate it on `waitFor`/`isAlive()`.
- `destroy()` gives the child a chance to clean up; `destroyForcibly()`
  does not, and even it is not guaranteed instant — always re-`waitFor`.
- Exit code `0` is success by convention only; document what your specific
  tool returns (e.g. `grep` uses `1` for "no matches", not failure).

For non-blocking completion, `p.onExit()` returns a
`CompletableFuture<Process>` — composable with everything from
[`CompletableFuture`](../phase-6-concurrency/07-completablefuture/README.md)
(`orTimeout`, `thenApply` on the exit code).

## Environment and working directory

`pb.environment()` returns a **mutable copy** of the JVM's environment used
only for this child — put/remove freely, the JVM's own env is untouched
(`System.getenv` is immutable). `pb.directory(File)` sets the child's
working directory; null means inherit the JVM's.

Secrets note: environment variables of a live process are inspectable by
other same-user processes on most OSes (`/proc/<pid>/environ`) and by
`ProcessHandle.info().arguments()` for argv — prefer files or stdin for
credentials you would not log.

## `ProcessHandle` — inspection without spawning

```java
ProcessHandle.current().pid();
p.toHandle().info().command();        // Optional<String> — may be empty
ProcessHandle.of(pid).map(h -> h.destroy());
p.descendants().forEach(ProcessHandle::destroy);   // kill the tree
```

Everything in `ProcessHandle.Info` is `Optional` — the OS may withhold any
of it (other users' processes, restricted containers). `descendants()`
matters because killing a shell does not kill what the shell started.

## Charsets — whose bytes are these?

The child writes bytes in *its* encoding, which the JVM cannot know.
`p.inputReader()` (no-arg) decodes with the platform's `native.encoding` —
usually right for OS tools — while `new InputStreamReader(p.getInputStream(),
UTF_8)` is right when you control the child and told it to emit UTF-8.
Since JDK 18 the JVM's *own* default charset is UTF-8 (JEP 400), which is
exactly why the `Process` readers deliberately default to `native.encoding`
instead: the OS tools around you did not get the memo.

## Gotchas

**Symptom:** command works in a terminal, `IOException: error=2, No such file or directory` from Java
**Cause:** the terminal resolved the name through the shell's `PATH`/aliases/functions; `ProcessBuilder` execs the program directly — aliases and shell builtins (`cd`, `source`) don't exist
**Fix:** absolute path to the executable, or check `PATH` is what you think; builtins have no executable to run at all

**Symptom:** child hangs mid-run; jstack shows the JVM parked in `waitFor`
**Cause:** the pipe buffer filled because stdout/stderr was left at `PIPE` and never drained
**Fix:** drain to EOF before `waitFor`, or redirect to a file/`DISCARD`/`INHERIT`

**Symptom:** deploy script "works" but produced no output and exit code 0 was never checked
**Cause:** `start()` succeeded so no exception was thrown; the tool failed and said so only via its exit code
**Fix:** always check `waitFor`'s code; treat "started" and "succeeded" as different facts

**Symptom:** passing one string `"git log --oneline"` fails with `error=2`
**Cause:** the whole string is treated as the executable's *name* — there is no word-splitting
**Fix:** one list element per argument: `new ProcessBuilder("git", "log", "--oneline")`

**Symptom:** filenames with spaces break, or a crafted input runs extra commands
**Cause:** command assembled by concatenation and handed to `sh -c`
**Fix:** argument lists with no shell; if a shell is unavoidable, the untrusted value must never be inside the `-c` string

**Symptom:** killed the process but its children live on, still holding the port
**Cause:** `destroy()` signals only the direct child, not the tree it spawned
**Fix:** `p.descendants().forEach(ProcessHandle::destroyForcibly)` before/after killing the parent

**Symptom:** non-ASCII output arrives mojibake'd
**Cause:** decoded child bytes with the wrong charset (hardcoded UTF-8 for a native-encoding tool, or vice versa)
**Fix:** `p.inputReader()` for OS tools (native encoding), explicit charset when you control the child's output

## Interview questions

**★ Why is `new ProcessBuilder("sh", "-c", cmd + userInput)` dangerous and what is the safe form?**
The user input becomes shell *code* — `;`, `$()`, backticks all execute. Safe form: no shell at all, each argument its own list element, so input is only ever data. If shell features are truly needed, the untrusted value is passed as a separate argument (`sh -c 'grep "$1" app.log' _ userInput`), never spliced into the script text.

**★ A subprocess deadlocks under load but not in tests. Mechanism?**
Pipe buffers are finite. In tests the output was small enough to fit; under load the child fills the buffer, blocks in write, and never exits — while the parent blocks in `waitFor` without reading. Drain to EOF first or redirect the stream.

**★ `destroy()` vs `destroyForcibly()` — and why call `waitFor` after either?**
`destroy` requests graceful termination (SIGTERM — handlers/cleanup may run); `destroyForcibly` is SIGKILL. Neither is synchronous: the process is dead only when `waitFor`/`onExit` says so, and `exitValue` before that throws.

**★ What does `pb.environment()` actually mutate?**
A per-builder copy used for children it starts. The JVM's own environment is read-only (`System.getenv`); there is no supported way to change it in-place.

**★ How do you run a subprocess without any risk of stream deadlock and without writing a reader thread?**
Redirect every stream away from `PIPE`: `INHERIT` for tooling, `Redirect.to(file)` for logs, `DISCARD` when output is irrelevant. No pipe, no drain obligation.

**★ What is `startPipeline` for?**
`ProcessBuilder.startPipeline(List<ProcessBuilder>)` (JDK 9) connects stdout→stdin across the builders like a shell pipeline, without invoking a shell — you get back the list of `Process`es and still owe a drain only at the ends you kept as `PIPE`.

---

← Prev: **09 · Localization basics** *(not written yet)* · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [Console I/O and Scanner](11-console-io-scanner.md)
