---
title: "The optimization level is baked into the cached bytecode's filename, so -O lives in a second, on-disk place the running process never chose — and PEP 488 made the levels coexist so a mismatch is a lookup failure rather than a behaviour change"
sidebar_label: "06zd · The bytecode cache and the flag"
sidebar_position: 169
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`-O` / `-OO` / `PYTHONOPTIMIZE`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-O),
> [PEP 488 — Elimination of PYO files](https://peps.python.org/pep-0488/),
> [`sys.flags`](https://docs.python.org/3.14/library/sys.html#sys.flags) and [`sys.implementation`](https://docs.python.org/3.14/library/sys.html#sys.implementation),
> [`compileall`](https://docs.python.org/3.14/library/compileall.html),
> [`importlib.util.cache_from_source`](https://docs.python.org/3.14/library/importlib.html#importlib.util.cache_from_source).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06m](06m-the-guard-the-platform-deletes.md) named three ways `-O` arrives and treated the
third — pre-compiled bytecode — as one more route to the same symptom. It is not. The
optimization level is part of the cached bytecode's *filename*, so `__pycache__` is a second,
persistent copy of the flag that can disagree with the flag the interpreter was started with.
When it does, you do not get a missing assertion. You get a startup that silently recompiles
everything on every boot, a cache directory three times the size you budgeted, or a level
baked into an artefact that nobody on the team selected. This chunk is the naming grammar and
the single-file lookup rule that make all three inevitable;
[06zf](06zf-bytecode-only-and-the-name-that-is-read.md) is the case where the same mismatch
stops being a slow start and becomes a module that will not import at all.**

## The filename *is* the mechanism

Before Python 3.5, `-O` and `-OO` both wrote `.pyo`. PEP 488 removed that file type precisely
because the name did not record what was in it:

> *"This PEP proposes eliminating the concept of PYO files from Python. To continue the
> support of the separation of bytecode files based on their optimization level, this PEP
> proposes extending the PYC file name to include the optimization level in the bytecode
> repository directory when there are optimizations applied."*

The resulting name is a format string, and it is worth memorising because every failure below
is a consequence of it:

> *"`'{name}.{cache_tag}.opt-{optimization}.pyc'.format(name=module_name, cache_tag=sys.implementation.cache_tag, optimization=str(sys.flags.optimize))`"*

Three variables, three independent ways two builds can disagree:

| Field | Comes from | Changes when |
|---|---|---|
| `name` | the module | never, for a given module |
| `cache_tag` | `sys.implementation.cache_tag` | the interpreter changes — *"a composite of the implementation's name and version, like `'cpython-33'`"* |
| `optimization` | `sys.flags.optimize` | `-O`, `-OO`, `PYTHONOPTIMIZE` or `compileall -o` |

The level-0 case has no tag at all — *"When no optimization level is specified, the pre-PEP
`.pyc` file name will be used"* — so a `__pycache__` holding all three levels of one module
holds `orders.cpython-314.pyc`, `orders.cpython-314.opt-1.pyc` and
`orders.cpython-314.opt-2.pyc`. They coexist. That coexistence is the point of the PEP: under
the `.pyo` scheme *"there is no clear way to tell what optimization level was used to generate
the bytecode file"*, and switching levels meant deleting and regenerating the whole tree.

`cache_tag` deserves its own note, because it is the field that makes the *other* two
mismatches survivable. A `.pyc` written by CPython 3.13 is named `…cpython-313…` and is
simply not the file a 3.14 interpreter looks for, which is why `compileall`'s default layout
*"allows byte-code files from multiple versions of Python to coexist."* Version skew is
handled by the name. Optimization skew is handled by the name too — and that is exactly what
turns it from a behaviour difference into a lookup miss.

## The interpreter looks for exactly one file

This is the sentence that makes the rest inevitable:

> *"the import system looks for a single bytecode file based on the optimization level of the
> interpreter already and generates a new bytecode file if it doesn't exist"*

One lookup, no fallback, no search across levels. So a level mismatch has two completely
different outcomes, and which one you get depends on a single thing — whether the `.py` is
still there:

- **Source present.** The expected file is absent, so the interpreter compiles the source and
  writes the file it wanted. You paid a compile. If the directory is not writable you pay it
  again on every process start; `compileall` exists precisely so bytecode is *"available for
  use even by users who don't have write permission to the library directories."* The
  wrongly-levelled `.pyc` sits there forever, never read, never cleaned up.
- **Source absent.** There is nothing to compile from and no second lookup to try. That case
  is [06zf](06zf-bytecode-only-and-the-name-that-is-read.md)'s subject, and it does not
  degrade gracefully.

The asymmetry is worth holding onto: with source present, a level mismatch costs latency and
disk and is otherwise silent. Silent is what makes it survive to production.

## Compiling for more than one level, deliberately

`compileall` takes the level as a repeatable option:

> *"Compile with the given optimization level. May be used multiple times to compile for
> multiple levels at a time (for example, `compileall -o 1 -o 2`)."*

```bash
# A base image that must serve both an optimized and an unoptimized entrypoint.
python -m compileall -o 0 -o 1 -q /usr/local/lib/python3.14/site-packages
```

That is a real answer when one image runs two ways, and it is the wrong default: it writes a
second (or third) copy of every module's bytecode for a level most processes will never read.
Compile the level you ship, and pin the flag that selects it in the same file that pins the
compile step, so the two cannot drift apart in a later edit:

```dockerfile
ENV PYTHONOPTIMIZE=1
RUN python -m compileall -o 1 -q /app
```

🔴 **`compileall` is not interpreter-neutral.** The names it writes carry the running
interpreter's `cache_tag` and the level from `-o`. A multi-stage build that compiles in a
`python:3.14` builder and runs on a different base has produced bytecode the runtime will
never open — correctly, by design, and invisibly.

## Gotchas

**★ Symptom: every container start recompiles the whole application, and the build step
definitely ran `compileall`.** Cause: the build and the runtime disagreed on one of the three
filename fields — a different base image (`cache_tag`), or `compileall -o 1` against a runtime
with no `PYTHONOPTIMIZE`. The interpreter *"looks for a single bytecode file based on the
optimization level of the interpreter already and generates a new bytecode file if it doesn't
exist"*, and a read-only layer cannot keep the one it generates, so the work repeats on every
boot. Fix: set the level and compile it in the same place, with the interpreter that will run.

```dockerfile
ENV PYTHONOPTIMIZE=1
RUN python -m compileall -o 1 -q /app
```

**★ Symptom: `PYTHONOPTIMIZE=0` does not turn optimization off.** Cause: the documentation
gives two rules whose outcomes for the string `"0"` are opposite. *"If this is set to a
non-empty string it is equivalent to specifying the `-O` option"* — and `"0"` is a non-empty
string. *"If set to an integer, it is equivalent to specifying `-O` multiple times"* — and `0`
as an integer means `-O` applied zero times. 🔴 **The documentation does not settle which rule
wins, and I could not confirm the behaviour without running it.** Do not assert either
reading and do not build on it: `0` is not a documented "off" switch. Fix: unset the variable
— absence is unambiguous — and read the answer from inside the process.

```bash
unset PYTHONOPTIMIZE           # shell
```

```dockerfile
ENV PYTHONOPTIMIZE=            # 🔴 also unsafe: this is a value, not an absence
```

```python
import sys
level = sys.flags.optimize     # 0 = assertions compiled in. The only honest source.
```

**★ Symptom: `__pycache__` is two or three times the size you budgeted.** Cause: levels
coexist by design — `orders.cpython-314.pyc`, `orders.cpython-314.opt-1.pyc` and
`orders.cpython-314.opt-2.pyc` are three files for one module, and `compileall -o 1 -o 2`
writes them without complaint. Fix: compile exactly the level you run, and delete the rest as
a build step rather than shipping levels nobody will read.

```bash
python -m compileall -o 1 -q /app
find /app -name '*.opt-2.pyc' -delete
```

**Symptom: two builds of the same commit produce different image digests, and no source file
changed.** Cause: which `.pyc` files exist depends on the interpreter's level, so an
unpinned `PYTHONOPTIMIZE` inherited from a base image changes the tree. Fix: pin the level
explicitly in your own build, so the flag is a line you can read in a diff and not a property
of somebody else's image.

```dockerfile
ENV PYTHONOPTIMIZE=1
RUN python -m compileall -o 1 -q /app
```

**Symptom: an audit that greps the image for `.pyo` files reports a clean tree, and the
assertions are still gone.** Cause: `.pyo` has not existed since PEP 488 landed in 3.5;
optimized bytecode is `.opt-1.pyc` / `.opt-2.pyc` inside `__pycache__`. Fix: audit for the
names that exist now, and for the flag itself.

```bash
find / -name '*.opt-[12].pyc' -print
env | grep -E '^PYTHONOPTIMIZE='
```

**Symptom: a level-0 build and a level-0-by-default build are indistinguishable in the
artefact.** Cause: level 0 keeps the pre-PEP-488 name, so "no tag" and "deliberately
unoptimized" look identical on disk. Fix: record the level in the image rather than inferring
it from filenames, and assert it at startup.

```dockerfile
ENV PYTHONOPTIMIZE=
LABEL org.opencontainers.image.description="compiled at optimization level 0"
```

```python
import sys
EXPECTED_OPTIMIZE = 0
if sys.flags.optimize != EXPECTED_OPTIMIZE:
    raise SystemExit(
        f"refusing to start: optimization level {sys.flags.optimize}, expected {EXPECTED_OPTIMIZE}"
    )
```

## Interview questions

**★ Why does `__pycache__` contain `opt-1` / `opt-2` files, and when does that bite?**
Because PEP 488 put the optimization level into the filename —
`'{name}.{cache_tag}.opt-{optimization}.pyc'` — so that levels stop overwriting one another.
Before 3.5, `-O` and `-OO` both wrote `.pyo`, and *"there is no clear way to tell what
optimization level was used to generate the bytecode file"*; switching levels meant purging
the tree. Now the three names coexist and each is read only by an interpreter running at that
level, because *"the import system looks for a single bytecode file based on the optimization
level of the interpreter already."* Where it bites depends entirely on whether the source is
present. With the `.py` there, a mismatch is nearly invisible: a recompile per module per
process, permanent if the filesystem is read-only, plus dead files you keep shipping. With the
`.py` deleted there is no fallback at all and the module ceases to exist as far as import is
concerned — [06zf](06zf-bytecode-only-and-the-name-that-is-read.md). The senior addition is
the direction people forget: because optimization is applied at *compile* time, a `.pyc`
built at level 1 carries `-O` semantics into a process whose command line and environment are
both clean.

**★ Is `PYTHONOPTIMIZE=0` a safe way to say "no optimization"?**
No, and the reason is that the documentation gives two rules that disagree about it. *"If this
is set to a non-empty string it is equivalent to specifying the `-O` option"* covers `"0"`,
because `"0"` is non-empty. *"If set to an integer, it is equivalent to specifying `-O`
multiple times"* also covers `0`, and zero times means not at all. The docs do not say which
rule is applied first, and I have not run it, so the honest answer is: I would not rely on
either reading. Unset the variable and confirm the result from inside the process with
`sys.flags.optimize`, documented as part of the named tuple that *"exposes the status of
command line flags"*. This is a good question to be asked, because the tempting answer — "0
means off, obviously" — is a guess wearing the clothes of knowledge.

**★ You unset `-O` and restarted, but `__pycache__` still holds `opt-1` files. Are your
assertions back?**
If the source is present, yes, and the `opt-1` files are irrelevant. The interpreter now looks
for the un-tagged name, does not find it, and compiles from source — the optimized files are
never consulted, so nothing needs clearing. That is exactly the benefit PEP 488 bought over
`.pyo`, where the two levels shared a name and the stale one *would* have been read. If the
source is absent the answer flips: the module is not importable at all rather than importable
with assertions restored. Notice that both answers turn on the *source*, not on the cache —
"delete `__pycache__` to be safe" is folklore that happens to be harmless here, and reciting
why it is unnecessary is the part that shows you know the naming rule.

**What is `cache_tag` and what problem does it solve?**
It is the middle field of the cache filename, described as *"the tag used by the import
machinery in the filenames of cached modules … By convention, it would be a composite of the
implementation's name and version, like `'cpython-33'`."* It exists so bytecode from different
interpreters never collides: a virtualenv rebuilt on a newer Python does not have to be purged
of stale `.pyc` files, because the new interpreter looks for different names entirely. One
value is worth knowing — *"If `cache_tag` is set to `None`, it indicates that module caching
should be disabled"* — and that is the case where the `importlib` helpers raise
`NotImplementedError` rather than returning a path.

**Why is there no `.opt-0.pyc`?**
Backward compatibility, stated outright: *"When no optimization level is specified, the
pre-PEP `.pyc` file name will be used."* Level 0 keeps the name it had before PEP 488, so
every tool, packaging script and `.gitignore` written against the old scheme still works. The
practical consequence is the one in the gotchas: "no tag" and "level 0" are the same file, so
the artefact cannot tell you whether an unoptimized build was chosen or merely defaulted to.
It also matters for source-less distribution, where the un-tagged name is the *only* name that
gets read.

**Does `compileall` care which interpreter runs it?**
Completely — which is why "we compile at build time" is not by itself a correct statement. The
files it writes carry the running interpreter's `cache_tag` and the level given by `-o`, so a
build stage on a different base image than the runtime stage produces bytecode the runtime
will never open. Run it as the runtime interpreter with the runtime's flags, and gate the
build on a check that the expected files exist rather than on `compileall` exiting zero — a
successful `compileall` proves files were written, not that they are the files anything will
read.

**Why did PEP 488 bother? What was actually wrong with `.pyo`?**
One name for two different things. Levels 1 and 2 both wrote `.pyo`, so the file could not
tell you which it was, and an interpreter could not select between them. Two costs followed.
Users switching levels had to delete and regenerate the whole bytecode tree rather than
keeping both, and anyone distributing bytecode had to ship a `.pyc` *and* a `.pyo` to cover
both cases — which the PEP calls *"unnecessary for the common use-case of code obfuscation and
smaller file deployments."* Encoding the level in the name fixed both at once, and it turned a
class of silent wrong-bytecode bugs into a cache miss, which is the strictly better failure.

---

← Prev: [The guard the platform deletes](06m-the-guard-the-platform-deletes.md) · Index: [EAFP vs LBYL](README.md) · Next → [Bytecode-only and the name that is read](06zf-bytecode-only-and-the-name-that-is-read.md)
