---
title: "Where the time goes: a Python CLI feels slow before it has run a line of your code, and `-X importtime` tells you exactly why"
sidebar_label: "1 · Where the time goes"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-28 against the Python 3.14
> [command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> documentation (`-X importtime`, `-X importtime=2` new in 3.14,
> `PYTHONPROFILEIMPORTTIME`, `-S`, `-E`, `-I`, `-P`) and the
> [`site` module](https://docs.python.org/3.14/library/site.html).
> Target: **CPython 3.14.7**. No timings are quoted here: measurements belong to
> your machine, and the tooling below produces them.

**"Python is slow to start" is a real complaint with a specific and almost
always identical cause: it is not the interpreter, it is what your program
imports. A bare interpreter starts fast enough that nobody would notice. A CLI
that imports `requests`, `pandas` or a web framework at module level pays for
all of it before printing `--help`. This chunk is about locating that cost
precisely rather than guessing at it, because the guesses are reliably wrong.**

## The two halves of startup

```
[ interpreter init ] + [ your imports ]
```

**Interpreter init** is CPython setting up the runtime, then running `site.py`,
which extends `sys.path` with site-packages and processes any `.pth` files it
finds there. It is roughly constant for a given installation, and it is not
where your problem is — but it is not nothing either, and `.pth` files can make
it much worse (see chunk [2](02-what-you-can-actually-do.md)).

**Your imports** is everything reachable from the module-level `import`
statements in your entry point, transitively. This is where essentially all
surprising startup cost lives, and the reason is that the cost is *transitive*
and therefore invisible in your own source. You import one convenience helper;
it imports a validation library; that imports `typing`, `email`, `re` and a
compiled extension. Nothing in your file says any of this.

🔴 **The critical property: importing a module executes it, top to bottom.**
This is the same fact as topic
[08 · Imports](../08-imports/README.md) — an import is not a declaration, it is
execution. Every class body, every decorator, every module-level constant,
every regex compiled at import time, every `Enum` definition runs before your
`main()` is called.

## Measuring it: `-X importtime`

Do not guess. The interpreter will tell you, and the documentation describes it
exactly:

> *"`-X importtime` to show how long each import takes. It shows module name,
> cumulative time (including nested imports) and self time (excluding nested
> imports). Note that its output may be broken in multi-threaded application.
> Typical usage is `python -X importtime -c 'import asyncio'`."*

```bash
python -X importtime -c 'import asyncio'
python -X importtime myapp/cli.py --help
PYTHONPROFILEIMPORTTIME=1 python -m myapp     # same thing via the environment
```

The output goes to **stderr**, one line per module, with the tree indicated by
indentation of the module name. Redirect it deliberately:

```bash
python -X importtime -m myapp 2> importtime.log
```

**The two columns are the whole skill.** *Cumulative* includes everything a
module imported in turn; *self* excludes it. A module with huge cumulative and
tiny self time is innocent — it is a doorway, and the cost is behind it. A
module with large **self** time is doing real work at import: compiling regexes,
building tables, loading a shared library, reading a data file. Sort by self
time to find the actual culprits; read cumulative time to find which of *your*
imports is the doorway to drop.

### 3.14 adds the "already loaded" case

New in this version, and genuinely useful:

> *"`-X importtime=2` enables additional output that indicates when an imported
> module has already been loaded. In such cases, the string `cached` will be
> printed in both time columns."*

The default mode shows a module only the first time it is imported, which hides
*who else wanted it*. With `=2`, every import site appears, marked `cached` when
the module was already in `sys.modules`. That is how you find out that the
module you were about to delete an import of is pulled in by four other paths
anyway, so removing your one import buys nothing.

`PYTHONPROFILEIMPORTTIME=2` is the environment-variable equivalent — useful when
you cannot edit the command line, as in a container entrypoint or a systemd
unit.

⚠️ **Both were changed in 3.14** to add the `=2` mode, and values other than `1`
and `2` are reserved for future use. On 3.13 and earlier, only the plain form
exists.

### Reading it honestly

Three traps in interpreting the output:

- **First run versus later runs.** The first import of a module may compile
  `.py` to `.pyc` and write it to `__pycache__`; subsequent runs skip that. A
  cold-cache measurement is a different measurement. Decide which one you care
  about — for a CLI a user runs repeatedly, the warm number is the honest one;
  for a serverless cold start, the cold number is.
- **The filesystem is a variable.** Import is I/O: stat calls down every
  `sys.path` entry until a match. A network filesystem, a container layer, or a
  very long `sys.path` changes the answer without any code changing.
- **The output may be broken under threads**, as the documentation warns. Profile
  startup in a single-threaded run.

## Where the cost usually is

In practice, in roughly this order:

| Cause | What it looks like |
|---|---|
| A heavyweight library imported at module level and used in one subcommand | Enormous cumulative time under one of your own imports |
| `typing` used at runtime rather than under `TYPE_CHECKING` | Broad, diffuse cost across many modules |
| Regexes, `Enum`s and lookup tables built at import time | Large **self** time in your own modules |
| Plugin discovery / entry-point scanning at startup | Time inside `importlib.metadata` |
| A compiled extension loading a large shared library | Large self time in a single `.so` |
| `.pth` files in site-packages executing code | Cost before your first import even runs |

**The single most common shape** is the first row, and it has a name: a CLI that
imports its entire dependency tree at module scope in order to define
subcommands, then runs one of them. `--help`, `--version` and a bad-argument
error all pay full price for work they never use.

## Why anyone cares

Startup cost is invisible in a long-running server and dominant everywhere else:

- **CLIs.** A human notices a few hundred milliseconds. Tools invoked in a loop
  by a shell script or a `Makefile` multiply it by the loop count.
- **Serverless and cold starts.** Import time is billed and is part of
  user-facing latency on every cold invocation.
- **Test suites.** Collection imports every test module. A slow import in a
  shared conftest is paid once per worker, and pre-commit hooks pay it on every
  commit.
- **Subprocess-heavy work.** `multiprocessing` with the `spawn` or `forkserver`
  start method — the latter now the default on Unix other than macOS in 3.14 —
  re-imports your `__main__` in each new process. Import cost is multiplied by
  the pool size. This is the practical link to topic
  [09 · `if __name__ == "__main__"`](../09-name-main/README.md).

Conversely: **for a web service that starts once and serves for days, import
time is irrelevant** and optimising it is wasted effort. Know which you are
writing before you spend a day on this.

## Gotchas

**Symptom:** `mytool --help` takes noticeably longer than feels reasonable
**Cause:** the entry point imports every subcommand's dependencies at module
level so it can register them, before argument parsing happens
**Fix:** import inside the subcommand function, so only the chosen path pays.
Chunk [2](02-what-you-can-actually-do.md) covers the patterns

**Symptom:** `-X importtime` shows a module you do not import anywhere
**Cause:** it is a transitive import — something you *do* import pulled it in
**Fix:** read the indentation, which shows the tree. Or use `-X importtime=2` to
see every site that asked for it

**Symptom:** removed an import, startup time did not change
**Cause:** another path still imports the same module, so it was going to be
loaded regardless
**Fix:** this is exactly what `-X importtime=2` diagnoses — the module will show
as `cached` at the other import sites

**Symptom:** `-X importtime` output is interleaved and unreadable
**Cause:** either it is being mixed with the program's own stderr, or the
application is multi-threaded, which the docs warn can break the output
**Fix:** redirect stderr to a file, and profile a single-threaded run

**Symptom:** startup is fast on the developer's laptop and slow in the container
**Cause:** import is filesystem work — layered container filesystems, network
mounts and cold page caches all change it. `sys.path` length matters too
**Fix:** measure inside the container. A laptop measurement of import cost is
not transferable

**Symptom:** the first run after a deploy is slow, subsequent ones are fine
**Cause:** `__pycache__` was cold; the first run compiled the bytecode
**Fix:** expected. Precompile at build time if the cold number matters — and
note that a read-only filesystem means it is *always* cold, because the `.pyc`
can never be written

**Symptom:** import time is spent in `importlib.metadata` and nothing obvious
**Cause:** entry-point / plugin discovery scans installed distributions
**Fix:** it is real work; the fix is to defer discovery until a plugin is
actually needed, not to make the scan faster

## Interview questions

**A colleague says Python has slow startup. Is that true?**
Partly, and rarely in the way meant. Bare interpreter startup is small; what
people experience is the transitive import cost of their dependency tree, all of
which executes before `main()` runs. The distinction matters because it is
actionable — you cannot change the interpreter, and you can change what you
import at module level.

**How would you find out why a CLI takes too long to print `--help`?**
`python -X importtime` on the entry point, stderr to a file. Sort by self time
to find modules doing real work at import; read cumulative time to find which
of my own top-level imports is the expensive doorway. On 3.14, `-X importtime=2`
additionally shows already-loaded modules as `cached`, which tells me whether
removing a given import will actually help.

**What is the difference between the cumulative and self columns?**
Cumulative includes everything the module imported transitively; self excludes
it. High cumulative with low self means the module is just a doorway to
expensive dependencies. High self means that module itself is doing work at
import time — compiling regexes, building tables, loading a shared object.

**Why does importing a module cost anything at all? It is just a name.**
Because an import executes the module top to bottom the first time. Class
bodies, decorators, module-level constants and any work written at module scope
all run at import. `sys.modules` makes the *second* import nearly free, but the
first pays in full.

**When is startup time not worth optimising?**
For a long-running server that starts once and serves for days — the cost is
amortised to nothing and the effort is better spent elsewhere. It matters for
CLIs, cold starts in serverless, test collection, pre-commit hooks, and anything
that spawns processes, since `spawn` and `forkserver` re-import the module in
every child.

**Why can the same program have different import times on two machines?**
Import is filesystem work — a stat down each `sys.path` entry until a match,
then a read. `sys.path` length, filesystem type, container layering, and whether
`__pycache__` is warm all change the result. A read-only filesystem never
caches bytecode, so it is permanently cold.

---

← Prev: [Python vs Node for a backend](../10-python-vs-node/README.md) · Index: [Startup and import cost](README.md) · Next → [What you can actually do about it](02-what-you-can-actually-do.md)
