---
title: "__pycache__: what those .pyc files actually are, why they never speed up your code, and why the script you ran has none"
sidebar_label: "3 · __pycache__"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14 tutorial
> [6.1.3 "Compiled" Python files](https://docs.python.org/3.14/tutorial/modules.html#compiled-python-files),
> [PEP 3147](https://peps.python.org/pep-3147/),
> [PEP 488](https://peps.python.org/pep-0488/),
> [`sys.implementation`](https://docs.python.org/3.14/library/sys.html#sys.implementation),
> and [1. Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-B`, `PYTHONDONTWRITEBYTECODE`, `PYTHONPYCACHEPREFIX`).
> Version spine: **Python 3.14.7**.

**`__pycache__` is CPython caching the compile step so it does not have to redo
it on the next import. That is the whole of it. It never makes your program run
faster once started, it never hides your source, and it only ever caches
modules you *imported* — never the script you executed. Understanding those
three negatives removes most of the mystery, and the fourth thing — the naming
scheme — explains why a directory full of `cpython-313` and `cpython-314` files
is not a mess but the design working.**

## The naming scheme, and why it looks like that

> *"To speed up loading modules, Python caches the compiled version of each
> module in the `__pycache__` directory under the name `module.version.pyc`,
> where the version encodes the format of the compiled file; it generally
> contains the Python version number."*

The `version` part is `sys.implementation.cache_tag` — `cpython-314` on the
interpreter this page targets. So a package directory ends up like:

```text
myapp/
  parser.py
  __pycache__/
    parser.cpython-313.pyc          # written by a 3.13 interpreter
    parser.cpython-314.pyc          # written by a 3.14 interpreter
    parser.cpython-314.opt-1.pyc    # written by a 3.14 interpreter running -O
```

Three caches, no collisions. That is the entire point of **PEP 3147**, which
introduced the subdirectory: before it, `.pyc` files sat beside their sources,
one per module, and switching Python versions meant either stale bytecode or a
cleanup script. The `.opt-1` / `.opt-2` suffixes come from **PEP 488** and
encode the optimisation level, so `-O` and non-`-O` caches also coexist rather
than overwrite each other.

Because the tag encodes the *implementation* as well as the version, a PyPy
cache sits in the same directory and is simply never a candidate for CPython.
If an implementation sets `cache_tag` to `None`, module caching is disabled
outright.

## Negative 1: it does not make your code run faster

The tutorial says it plainly:

> *"A program doesn't run any faster when it is read from a `.pyc` file than
> when it is read from a `.py` file; the only thing that's faster about `.pyc`
> files is the speed with which they are loaded."*

Bytecode loaded from a cache and bytecode compiled a millisecond ago are
byte-identical — same instructions, same specialisation opportunities, same
everything. The saving is parse-and-compile time *at import*, which matters
enormously for a CLI that imports 300 modules and starts fresh on every
invocation, and not at all for a web worker that has been up for a week.

If someone proposes pre-compiling to make a long-running service faster, they
have the wrong model. Pre-compiling makes it *start* faster.

## Negative 2: it is not source protection

A `.pyc` holds the same code object your source produced — every name, every
constant, every string literal, the docstrings (unless compiled under `-OO`),
and the line-number table that builds tracebacks. Decompilers reconstruct
near-original source from it; only comments and some local-variable naming
nuance are genuinely gone.

Shipping `.pyc` without `.py` therefore obscures nothing that matters, and it
costs you portability, because the cache tag pins the file to one exact
CPython version. Anyone selling "compile your Python to protect the IP" is
selling obfuscation, not encryption.

## Negative 3: the script you ran has no cache

This is the question everyone eventually asks, and the answer is one sentence
in the tutorial:

> *"Python does not check the cache in two circumstances. First, it always
> recompiles and does not store the result for the module that's loaded
> directly from the command line. Second, it does not check the cache if there
> is no source module."*

So `python app.py` recompiles `app.py` on every single run and writes nothing
for it. `import helpers` from inside it *does* write
`__pycache__/helpers.cpython-314.pyc`. The rule: **imported modules are cached;
the `__main__` module is not** — because the main module is compiled exactly
once per process, and by the time you could write a cache the compile has
already happened. The next `python app.py` takes the same path again, so the
cache would never be read either.

The *second* circumstance is the sourceless-distribution mechanism: if there is
no `.py` at all, a `.pyc` placed in the **legacy** location — beside the source,
not inside `__pycache__` — is importable directly, with no validation against
anything. That is the only supported way to ship bytecode without source, and
it is also the mechanism behind the "ghost module" incident below.

## The knobs

| Knob | Effect |
|---|---|
| `-B` / `PYTHONDONTWRITEBYTECODE=1` | Compile as normal but never *write* `.pyc`. Existing caches are still read |
| `sys.dont_write_bytecode` | The same switch, readable and writable at run time |
| `-X pycache_prefix=PATH` / `PYTHONPYCACHEPREFIX` | Write all caches into a parallel tree rooted at `PATH` instead of alongside the source |
| `python -m compileall` | Pre-compile a tree ahead of time — see [the next chunk](04-cache-invalidation.md) |

`PYTHONPYCACHEPREFIX` is the underrated one. It solves the read-only source
tree, the bind-mounted volume filling with root-owned `__pycache__`
directories, and the checksum-verified deployment that a runtime write would
invalidate — all without giving up caching itself, which `-B` does.

Note the asymmetry in `-B`: it stops writes, not reads. A directory full of
stale caches will still be used under `-B`, which makes it a poor debugging tool
for a suspected stale-cache problem. Delete the directory instead.

## `__pycache__` in version control and images

Three rules that are not negotiable:

1. **`__pycache__/` and `*.pyc` go in `.gitignore`.** Always. Committed
   bytecode is a merge conflict generator and a stale-import source.
2. **Pre-compile in a container build, don't compile at run time.** A
   `RUN python -m compileall` in the build stage buys you the import saving on
   every cold start without a single runtime write.
3. **Set `PYTHONDONTWRITEBYTECODE=1` in the running container** once you have
   pre-compiled, so a non-root process on a read-only filesystem never attempts
   a write it cannot make.

## Gotchas

**Symptom:** deleted a `.py` file, and the module still imports successfully
**Cause:** a stale `.pyc` in the *legacy* location (beside the source, not in `__pycache__`) is importable on its own when no source exists — exactly the sourceless-distribution mechanism, working as designed
**Fix:** `find . -name '*.pyc' -delete` and `find . -name __pycache__ -type d -exec rm -rf {} +`. This is the classic "ghost module" incident and it lands hardest after a `git mv` or a branch switch that left build artefacts behind

**Symptom:** `__pycache__` directories appear inside a bind-mounted source volume, owned by root, and `git status` is full of them
**Cause:** the container's Python wrote caches into the mounted host directory as its own user
**Fix:** `PYTHONPYCACHEPREFIX=/tmp/pycache` in the container so caches land outside the mount, or `PYTHONDONTWRITEBYTECODE=1` to skip writing entirely. And `__pycache__/` in `.gitignore` regardless

**Symptom:** an AWS Lambda or read-only-rootfs deployment logs permission errors on first import
**Cause:** Python tried to write `__pycache__` next to code in a read-only path
**Fix:** it is not fatal — Python falls back to running uncached — but it is log noise plus a per-invocation compile cost. Pre-compile at build time and set `PYTHONDONTWRITEBYTECODE=1`

**Symptom:** `-B` was set to "fix" a stale-cache problem and the stale behaviour continues
**Cause:** `-B` suppresses *writing*, not *reading*. Every existing `.pyc` in the tree is still a valid candidate
**Fix:** delete the caches. `-B` is for environments where writes are unwanted, not a cache-busting flag

**Symptom:** shipping only `.pyc` files "to protect the source", and a customer posts the decompiled source in a bug report
**Cause:** a `.pyc` is a serialised code object with all names, constants, literals and line numbers intact
**Fix:** accept that Python bytecode is not a protection mechanism. Keep secrets out of the artefact; enforce licensing legally or move the logic server-side

**Symptom:** an ancient `.pyc` from another Python version sits in the tree and the module recompiles every run anyway
**Cause:** the cache tag does not match, so the file is not a candidate at all
**Fix:** nothing is broken — coexistence rather than breakage is the design point of PEP 3147. But do clean them up; they are dead weight in an image and confusing in a diff

**Symptom:** the same source directory accumulates both `.opt-1` and no-suffix caches, doubling the file count
**Cause:** something in the pipeline runs Python with `-O` and something else without; PEP 488 gives each optimisation level its own filename
**Fix:** expected behaviour, not a bug — but pick one optimisation level for the whole deployment so you are not shipping and validating two sets of bytecode

**Symptom:** committed `__pycache__` causes an import to resolve to code nobody can find in the repository
**Cause:** bytecode was committed, then the source was renamed or removed on a later commit while the cache survived
**Fix:** `git rm -r --cached` the directories, add the ignore rule, and treat any `.pyc` in version control as a defect

**Symptom:** "we pre-compiled everything and the service is not faster"
**Cause:** correct — pre-compiling reduces *import* time, and a long-lived server imports once
**Fix:** measure cold start, not steady state. If cold start is not a problem you are solving, pre-compiling buys you determinism and read-only-filesystem compatibility, not throughput

## Interview questions

**★ What is in `__pycache__` and why does it exist?**
Cached bytecode. CPython compiles every module to a code object before running
it, and caching that result lets the next import skip the parse and compile
steps. Files are named `module.cpython-314.pyc`, where the middle part is
`sys.implementation.cache_tag`, so caches from different implementations,
versions and optimisation levels coexist in one directory rather than
colliding. PEP 3147 introduced the subdirectory to keep source trees clean.
Loading is faster; execution is not — the tutorial states outright that a
program does not run any faster from a `.pyc`.

**★ Why does `python script.py` never create a `__pycache__` entry for `script.py` itself?**
Because the module loaded directly from the command line is always recompiled
and never cached — the documentation says exactly that. Caching the `__main__`
module would help no run: it is compiled once per process, and the next
invocation of `python script.py` takes the identical path, so the cache would
never be read. Modules that `script.py` *imports* are cached normally, which is
why a `__pycache__` appears next to your helper modules but not next to your
entry point.

**★ Can you protect your source by shipping only `.pyc` files?**
No. A `.pyc` is a serialised code object containing every name, constant,
string literal and the line-number table; decompilers recover readable source
from it. You would also be trading away portability, because the cache tag pins
the file to one exact CPython version and it will not load on any other. Keep
secrets out of the artefact entirely and enforce licensing by other means.

**Does pre-compiling with `compileall` make my web service faster?**
It makes it *start* faster, which for a long-running server is a one-off saving
per process. Bytecode from cache is byte-identical to bytecode compiled a
moment ago, so steady-state throughput is unchanged. Where it genuinely matters
is anything that starts a fresh interpreter frequently — CLIs, serverless
functions, per-request subprocesses — and anywhere you want zero writes to disk
at run time.

**What does the `.opt-1` in `foo.cpython-314.opt-1.pyc` mean?**
The optimisation level the interpreter was at when the cache was written, per
PEP 488. `.opt-1` is `-O` (asserts and `if __debug__:` blocks removed),
`.opt-2` is `-OO` (also docstrings removed), and no suffix is the default
level. Separate filenames mean an application run with and without `-O` cannot
silently pick up bytecode compiled under the other setting.

**How do you stop Python writing `.pyc` files, and when would you?**
`PYTHONDONTWRITEBYTECODE=1` or `-B`, or redirect them with
`PYTHONPYCACHEPREFIX=/writable/path`. You would do it when the source tree is
read-only, when it is a bind mount you don't want polluted with root-owned
directories, in serverless environments where only `/tmp` is writable, or when
runtime writes would break a checksum-verified deployment. Note that `-B` only
stops writing — existing caches are still read, so it is not a way to bust a
stale cache.

**A module still imports after you deleted its `.py`. What happened?**
There is a `.pyc` in the legacy location — beside where the source used to be,
not in `__pycache__`. When no source module exists, Python does not check the
cache at all and imports that bytecode directly; it is the supported mechanism
for shipping bytecode without source. Clear `*.pyc` and `__pycache__`
directories and the import will fail as expected.

---

← Prev: [Source to bytecode](02-source-to-bytecode.md) · Index: [What Python is](README.md) · Next → [Cache invalidation](04-cache-invalidation.md)
