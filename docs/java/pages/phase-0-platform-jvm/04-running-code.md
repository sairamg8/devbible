---
title: "Running code: java, javac, source launch, jshell"
sidebar_label: "04 · Running code"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 `java` launcher reference, JEP 330
> (single-file source launch, 11), JEP 458 (multi-file source programs, 22),
> JEP 512 (compact source files and instance main methods, 25), and JEP 222
> (`jshell`, 9).

**There are four ways to run Java in 2026, and three of them skip the visible
compile step. The classic `javac`-then-`java` two-step still underlies
everything, but the launcher now compiles single files and whole multi-file
programs in memory, `jshell` evaluates snippets interactively, and Java 25's
compact source files cut `Hello.java` down to three lines. Knowing which mode
you are in explains a whole family of "why didn't my change take effect"
confusions.**

## Mode 1 — the classic two-step

```bash
javac -d out src/com/acme/Main.java     # compile: .java → .class into out/
java -cp out com.acme.Main arg1 arg2    # run: fully-qualified class name, no .class suffix
```

The rules that trip people:

- `java` takes a **class name**, not a file name: `com.acme.Main`, never
  `out/com/acme/Main.class`.
- Argument order is rigid: `java [jvm-options] <class-or-jar> [program-args]`.
  Everything *after* the class name goes into `String[] args` — including a
  misplaced `-Xmx2g`, which then silently arrives as a program argument
  instead of sizing the heap.
- `java -jar app.jar` reads `Main-Class:` from the jar's manifest — and, as
  topic 05 covers, **ignores `-cp` entirely** in this mode.

In real projects the build tool (Phase 8) drives `javac`, and you run either
a jar or the build tool's `run` task. Manual `javac` remains worth knowing
because CI scripts, containers and interview whiteboards all speak it.

## Mode 2 — single-file source launch (11+)

```bash
java Hello.java arg1        # compiles in memory, then runs — no .class left behind
```

JEP 330 made the launcher compile a single source file in memory and execute
it directly. Notes that matter:

- Nothing is written to disk — no stale `.class` files to clean up. In
  source-file mode the launcher compiles what it sees *now*, which
  sidesteps the stale-class gotcha of mode 1 entirely.
- Dependencies work via `--class-path` as usual, but the moment a program
  needs a build tool's dependency management, it has outgrown this mode.
- Shebang scripts work: a first line of `#!/usr/bin/env -S java --source 25`
  turns a `.java` file into an executable script — genuinely used for ops
  tooling in Java shops.

## Mode 3 — multi-file source programs (22+)

JEP 458 extended source launch across files: `java Main.java` now compiles
*other* `.java` files in the same source tree on demand, as `Main` references
them. A small tool can grow to a handful of files before needing Maven. The
boundary is dependencies and tests — the moment either appears, reach for the
build tool.

## Compact source files and instance main (25)

JEP 512 (finalized in 25) removed the ceremony from small programs:

```java
// Hello.java — a complete, valid Java 25 program
void main() {
    IO.println("Hello");
}
```

No class declaration, no `static`, no `String[] args` (declare `main(String[]
args)` if you need them), and `java.lang.IO` provides basic console I/O
without imports. The launcher wraps the file in an implicit class. This is
the teaching-and-scripting face of Java; production services still use
explicit classes, and knowing *both* forms means older tutorials and modern
ones both parse.

## Mode 4 — jshell, the REPL (9+)

```bash
jshell
jshell> List.of(1, 2, 3).stream().map(n -> n * n).toList()
jshell> /vars      # list declared variables
jshell> /exit
```

`jshell` evaluates snippets: expressions print their value, semicolons are
optional on statements, and tab completion browses APIs. Its real job in a
working day is **answering an API question in ten seconds** — "does
`String.split` keep trailing empty strings?" — without creating a file or
touching the test suite. It accepts `--class-path` to explore a library jar
interactively.

## Choosing a mode

| Situation | Mode |
|---|---|
| Production service | Build tool → jar → `java -jar` (Phase 8) |
| Trying an API, checking behaviour | `jshell` |
| Teaching, exercises, this syllabus's snippets | Compact source files + `java Hello.java` |
| Ops script in a Java shop | Single/multi-file source launch, optionally shebang |
| CI diagnostics, understanding the machinery | The explicit two-step |

## Gotchas

**Symptom:** `Error: Could not find or load main class Hello.class`
**Cause:** passing a *file name* to class-mode `java` — it expected a class name and looked for a class literally named `Hello.class`
**Fix:** `java Hello` (class mode, compiled first) or `java Hello.java` (source mode). The `.class` suffix is never typed

**Symptom:** `java -cp out com.acme.Main -Xmx2g` runs but the heap flag "does nothing"
**Cause:** argument order — anything after the class name is a *program* argument; `-Xmx2g` arrived in `args[0]`
**Fix:** JVM options go before the class name: `java -Xmx2g -cp out com.acme.Main`. Silent, because a program is free to ignore arguments

**Symptom:** edited the source, ran `java Hello`, old behaviour — again
**Cause:** class mode runs the stale `.class` from the last `javac`; nothing rebuilds automatically
**Fix:** recompile, or use `java Hello.java` (source mode always compiles fresh). In projects, the build tool owns staleness

**Symptom:** `java Hello.java` fails with compilation errors referencing a class that "is right there", compiled, on the classpath
**Cause:** source-file mode compiles the named file fresh and prefers its in-memory world; mixing precompiled classes of the same names on the classpath confuses which version wins
**Fix:** don't mix modes for the same classes — source-launch self-contained programs, or compile everything and use class mode

**Symptom:** a single-file program needs Jackson, and `java App.java` can't find it
**Cause:** source launch has no dependency management — it is just javac-in-memory
**Fix:** `java --class-path lib/jackson-databind.jar App.java` works for one jar; more than a couple means the program has outgrown source mode — create a real build

**Symptom:** `void main()` fails to compile on the team's older JDK
**Cause:** compact source files and instance `main` finalized in 25 — a 21 toolchain rejects them
**Fix:** check `java -version` matches the feature's release (topic 03's map); classic `public static void main(String[])` runs everywhere

**Symptom:** jshell says a variable "cannot be resolved" after pasting a snippet that works in a file
**Cause:** jshell evaluates incrementally — forward references between pasted snippets and some file-level constructs (like package declarations) don't apply in the REPL
**Fix:** paste in dependency order; jshell is for snippets, not whole files (`/open file.java` exists when needed)

## Interview questions

**★ What happens, step by step, when you run `java Hello.java`?**
The launcher detects source-file mode, compiles `Hello.java` in memory (no
`.class` written to disk), then loads and runs the result — since 22, pulling
in other source files from the same tree as they're referenced, and since 25
accepting an instance `void main()` in a compact source file. It is the
normal compile-then-execute pipeline with the intermediate artifact kept in
memory.

**★ Why does `java -Xmx2g App` size the heap but `java App -Xmx2g` not?**
The launcher's grammar is `java [jvm-options] <class> [program-args]` —
everything after the class name is handed to `main` as a string. The second
form passes `-Xmx2g` as `args[0]`, and nothing warns, because programs may
legitimately take dash-prefixed arguments.

**★ When would you use jshell in real work?**
To answer an API behaviour question in seconds — edge cases of `split`,
formatting output, exploring a library jar via `--class-path` — without
creating files or polluting the test suite. It is an exploration tool; the
verified knowledge then goes into a unit test.

**★ What did JEP 512 change about `main`?**
Since 25, a source file can omit the class declaration (the launcher wraps
it), `main` can be an instance method, `static` and the `String[]` parameter
are optional, and `java.lang.IO` supplies console I/O without imports. The
classic form remains valid everywhere; the compact form is for small
programs and learning.

**Why does `java` take a class name rather than a file path (in class mode)?**
Because execution starts from a class *on the classpath*, not from a file
location — the same class might live in a directory, a jar, or elsewhere on
the search path. Topic 05 makes that lookup precise.

**Where is the line between source-launch and needing a build tool?**
Dependencies and tests. Source launch has no dependency resolution and no
test runner; the moment either matters, Maven/Gradle (Phase 8) is the answer.
Multi-file source programs (22) moved the line from "one file" to "one small
tree", not past dependencies.

---

← Prev: [The release model](03-release-model.md) · Index: [Phase 0 — The platform and the JVM](README.md)
