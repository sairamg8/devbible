---
title: "Ten interpreter options that earn their keep: -u for container logs, -X dev and -X importtime for diagnosis, -I for isolation, and -O which you should almost never use"
sidebar_label: "5 · Options worth knowing"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (all option and environment-variable text quoted below),
> [Python Development Mode](https://docs.python.org/3.14/library/devmode.html),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (`-X importtime=2`) and [PEP 488](https://peps.python.org/pep-0488/).
> Version spine: **Python 3.14.7**.

**The interpreter has around forty command-line switches and most of them you
will never type. About ten repay learning, because each one turns a class of
mystery into a visible fact: why the container has no logs, why startup takes two
seconds, which module is being imported from where, and what the program does
when every warning is an error. One of them — `-O` — is famous for the wrong
reason, and this chunk argues you should not use it.**

## `-u` — the reason your container has no logs

> *"Force the stdout and stderr streams to be unbuffered. This option has no
> effect on the stdin stream."*

When stdout is a terminal it is line-buffered, so `print()` appears immediately.
When it is a pipe — which is what a container runtime, a CI log collector, a
systemd unit or a `subprocess.PIPE` gives you — it is block-buffered, so output
appears in chunks of kilobytes, or not at all until the process exits. A crash
can lose the buffered tail entirely, which is why the last thing your program
printed before dying is so often missing.

```dockerfile
ENV PYTHONUNBUFFERED=1
```

```bash
python -u app.py
```

Either works; the environment variable is the usual choice in an image because it
applies to every process. If you use `logging` writing to stderr, the problem is
smaller (stderr is unbuffered or line-buffered in more cases), which is one more
argument for logging over `print`.

## `-X dev` — the mode to develop in

> *"`-X dev`: enable Python Development Mode, introducing additional runtime
> checks that are too expensive to be enabled by default."*

Development Mode turns on a bundle: the default warning filter becomes `always`,
`faulthandler` is enabled so a segfault prints a Python traceback, the memory
allocator gets debug hooks, and various resource warnings (an unclosed file, an
unawaited coroutine) become visible. It is the single highest-value flag for
local development and for CI, and the cost is only performance.

```bash
python -X dev -m pytest
PYTHONDEVMODE=1 python -m myapp
```

## `-W error` — make warnings impossible to ignore

> *"`-Werror`    # Convert to exceptions"*

`DeprecationWarning` is hidden by default outside `__main__`, so a library
deprecation reaches you as a breakage two releases later rather than as a warning
today. Turning warnings into errors in CI is how you find out on your schedule
instead of the library's. The related machinery — which warnings are visible when,
and how to scope a filter to one module — is in
[`../03-release-model/06-seeing-deprecation-warnings.md`](../03-release-model/06-seeing-deprecation-warnings.md).

## `-X importtime` — why the CLI feels slow

> *"`-X importtime` to show how long each import takes. It shows module name,
> cumulative time (including nested imports) and self time (excluding nested
> imports). Note that its output may be broken in multi-threaded application.
> Typical usage is `python -X importtime -c 'import asyncio'`. `-X importtime=2`
> enables additional output that indicates when an imported module has already
> been loaded."*

The `=2` form is new in 3.14 — *"When such a module is imported, the `self` and
`cumulative` times are replaced by the string `cached`"* — which makes it possible
to see which imports are genuinely being executed versus merely resolved from
`sys.modules`.

This is the tool for "my command-line program takes 800 ms to print `--help`".
The answer is nearly always one heavy import at module scope that could have been
deferred into the function that needs it.

## `-i` — inspect the wreckage

> *"Enter interactive mode after execution. […] Interactive mode will start even
> when `sys.stdin` does not appear to be a terminal. The `PYTHONSTARTUP` file is
> not read. This can be useful to inspect global variables or a stack trace when
> a script raises an exception."*

```bash
python -i script.py         # crashes → you are left in a REPL with the globals
```

Combined with `import pdb; pdb.pm()` (post-mortem) at that prompt, this is the
fastest route from "it raised something" to "I can see the state that caused it",
without adding a breakpoint and re-running.

## `-O` and `-OO` — the flags to leave alone

> *"`-O`: Remove assert statements and any code conditional on the value of
> `__debug__`. Augment the filename for compiled (bytecode) files by adding
> `.opt-1` before the `.pyc` extension."*
>
> *"`-OO`: Do `-O` and also discard docstrings."*

People reach for `-O` expecting a speed-up. It does not optimise anything; it
removes assertions and docstrings. The realistic gain is a small reduction in
memory and bytecode size. The realistic loss is much larger:

- **Any `assert` used for validation stops running.** Assertions guarding an
  invariant in library code you depend on are silently gone.
- **`assert`-based test suites do not work at all.** Running pytest under `-O`
  removes the very statements it inspects.
- **`-OO` breaks anything that reads `__doc__`** — `help()`, some CLI frameworks
  that build usage text from docstrings, doctests, and libraries that parse
  docstrings for schema or type information.

Use `-O` only if you have measured a benefit you actually need and you have
audited every `assert` in your dependency tree, which is a sentence that answers
itself. The correct rule for your own code is the one that makes `-O` irrelevant:
**never use `assert` for runtime validation**, only for internal invariants that
cannot be false unless the program is already wrong.

## `-B` and `-X pycache_prefix` — bytecode files

> *"`-B`: If given, Python won't try to write `.pyc` files on the import of source
> modules."*
>
> *"`-X pycache_prefix=PATH` enables writing `.pyc` files to a parallel tree
> rooted at the given directory instead of to the code tree."*

`-B` (or `PYTHONDONTWRITEBYTECODE=1`) matters for read-only filesystems, for
container images where the `__pycache__` directories bloat a layer, and for
keeping a source tree clean. Note that it stops Python *writing* caches, not
reading existing ones — so a stale `__pycache__` committed by accident is still
used.

## The isolation switches

Five options control what Python trusts at startup. All are quoted and worked
through in [`../08-imports/02c-controlling-sys-path.md`](../08-imports/02c-controlling-sys-path.md);
the summary:

| Option | Effect |
|---|---|
| `-E` | *"Ignore all `PYTHON*` environment variables, e.g. `PYTHONPATH` and `PYTHONHOME`, that might be set."* |
| `-s` | *"Don't add the user site-packages directory to `sys.path`."* |
| `-S` | *"Disable the import of the module `site` and the site-dependent manipulations of `sys.path` that it entails."* |
| `-P` | Don't prepend the script directory / cwd to `sys.path` (also `PYTHONSAFEPATH`) |
| `-I` | *"Run Python in isolated mode. This also implies `-E`, `-P` and `-s` options."* |

`-I` is the flag to reach for when you want to know how a program behaves without
your machine's contributions:

```bash
python -I -c "import sys; print(*sys.path, sep='\n')"
```

One thing `-I` does **not** do: it does not take you out of a virtual
environment. The environment is located from the interpreter's own path, not from
an environment variable ([`../05-virtual-environments/02-how-the-interpreter-finds-it.md`](../05-virtual-environments/02-how-the-interpreter-finds-it.md)),
so `.venv/bin/python -I` is still in the venv. `-I` does not imply `-S`, so the
environment's `site-packages` is still loaded.

## The rest, in one line each

- **`-v`** — *"Print a message each time a module is initialized, showing the
  place (filename or built-in module) from which it is loaded."* Very noisy; `-vv`
  additionally reports every path checked, which is the tool for "why is it
  finding *that* copy".
- **`-X faulthandler`** — dump a Python traceback on a fatal signal. Implied by
  `-X dev`.
- **`-X tracemalloc[=N]`** — start tracing allocations with an `N`-frame
  traceback, so a `ResourceWarning` can tell you where the object was created.
- **`-X utf8`** — *"enables the Python UTF-8 Mode"*, forcing UTF-8 regardless of
  locale. The fix for a container whose locale is `POSIX` and which therefore
  mangles non-ASCII filenames.
- **`-X int_max_str_digits=N`** — raises or lowers the integer/string conversion
  limit, for the rare program that legitimately prints enormous integers.
- **`-X cpu_count=n`** — *"overrides `os.cpu_count()`, `os.process_cpu_count()`,
  and `multiprocessing.cpu_count()`"*, which is how you stop a pool sizing itself
  to the host's core count inside a CPU-limited container.
- **`-X gil=0,1`** — *"forces the GIL to be disabled or enabled, respectively.
  Setting to `0` is only available in builds configured with `--disable-gil`."*
  See [`../02-the-gil/README.md`](../02-the-gil/README.md).
- **`-X perf`** — enables the Linux `perf` profiler to report Python calls.

## Gotchas

**Symptom:** a containerised Python service produces no logs until it crashes, and then loses the last few lines
**Cause:** stdout is a pipe, so it is block-buffered
**Fix:** `ENV PYTHONUNBUFFERED=1` or run with `python -u`. This is the most common "the application is hung" report that is not a hang at all

**Symptom:** a test suite passes under `-O` because assertions were removed
**Cause:** `-O` strips `assert` statements, which is precisely what most test frameworks are built on
**Fix:** never run tests under `-O`. If a deployment pipeline sets `PYTHONOPTIMIZE`, make sure the test stage does not inherit it

**Symptom:** a library's runtime validation stops rejecting bad input in production
**Cause:** the validation was written with `assert`, and production runs with `-O` or `PYTHONOPTIMIZE`
**Fix:** raise real exceptions for anything that validates external input. Reserve `assert` for invariants that are the program's own responsibility

**Symptom:** `help()` shows nothing and a CLI's usage text is empty
**Cause:** `-OO` discarded docstrings
**Fix:** do not use `-OO` for anything that introspects documentation. The saving is not worth it

**Symptom:** `-B` is set but a stale `.pyc` is still being used
**Cause:** `-B` prevents *writing* bytecode caches, not reading them
**Fix:** delete the `__pycache__` directories, and keep them out of source control and out of Docker build contexts

**Symptom:** `-X importtime` output is interleaved and unreadable
**Cause:** the documented caveat that *"its output may be broken in multi-threaded application"*
**Fix:** measure a plain `python -X importtime -c "import myapp"` rather than the running service

**Symptom:** a process pool creates dozens of workers inside a container limited to two CPUs
**Cause:** `os.cpu_count()` reports the host's cores, not the cgroup limit
**Fix:** `-X cpu_count=2`, or size the pool from configuration rather than from the machine

**Symptom:** `-E` in a wrapper script breaks a program that needed `PYTHONPATH`
**Cause:** `-E` ignores *all* `PYTHON*` variables, not just the dangerous ones
**Fix:** that is usually the point — but if the program genuinely depends on one, install the package properly instead ([chunk 2](02-script-vs-m.md))

**Symptom:** `-I` is used to "get out of the virtual environment" and does not
**Cause:** the environment is determined by the interpreter's own location, not by environment variables, so isolated mode does not affect it
**Fix:** run the base interpreter by absolute path if that is what you want

**Symptom:** non-ASCII filenames break only inside a container
**Cause:** the container's locale is minimal, so the filesystem encoding is not UTF-8
**Fix:** `-X utf8` or `PYTHONUTF8=1`, and set a sensible locale in the image

## Interview questions

**★ Why does a Python service in a container appear to produce no logs?**
Because standard output is a pipe rather than a terminal, so it is
block-buffered: output accumulates until the buffer fills or the process exits,
and a crash can discard the tail. `python -u` or `PYTHONUNBUFFERED=1` forces
unbuffered streams. It is not a logging configuration problem and it is not a
hang.

**★ Does `-O` make Python faster?**
Effectively no. It removes `assert` statements and code guarded by `__debug__`,
and `-OO` additionally discards docstrings. There is no optimiser involved. What
you gain is a small memory and bytecode-size reduction; what you risk is losing
validation that a dependency implemented with assertions, and breaking anything
that reads `__doc__`. The safe posture is not to use it and never to write
`assert` for runtime validation.

**★ Which flags would you reach for to diagnose a slow-starting CLI?**
`-X importtime` first, to see which imports dominate, and on 3.14 `-X importtime=2`
to distinguish work actually being done from modules already cached. Then move
the expensive imports inside the functions that need them. `-v`/`-vv` if the
question is *which file* is being imported rather than how long it takes.

**★ What does Python Development Mode give you?**
A bundle of checks too expensive for production: warnings shown by default,
`faulthandler` enabled so a hard crash still yields a Python traceback, debug
hooks on the memory allocator, and resource warnings for unclosed files and
unawaited coroutines. Enable it in development and in CI with `-X dev` or
`PYTHONDEVMODE=1`.

**★ What is the difference between `-I` and `-E`?**
`-E` only ignores `PYTHON*` environment variables. `-I` is isolated mode and
implies `-E` plus `-P` (no script directory or cwd on `sys.path`) and `-s` (no
user site-packages). Neither removes you from a virtual environment, because the
environment is discovered from the interpreter's path rather than from the
environment block.

---

← Prev: [-c, stdin and pipes](04-c-and-stdin.md) · Index: [Running code](README.md) · Next → **06 · The REPL** *(not written yet)*
