---
title: "Strip the .py files and the level mismatch stops being a slow start — a .pyc inside __pycache__ is ignored outright when its source is missing, a source-less module loads only from the un-tagged name, and the failure arrives as ModuleNotFoundError on a file you can see with ls"
sidebar_label: "06zf · Bytecode-only and the name that is read"
sidebar_position: 170
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against [PEP 3147 — PYC repository directories](https://peps.python.org/pep-3147/)
> and [PEP 488 — Elimination of PYO files](https://peps.python.org/pep-0488/), plus the Python 3.14 documentation —
> [`compileall`](https://docs.python.org/3.14/library/compileall.html) (`-o`, `-b`, `-q`),
> [`importlib.util.cache_from_source` / `source_from_cache`](https://docs.python.org/3.14/library/importlib.html#importlib.util.cache_from_source),
> [`ModuleNotFoundError`](https://docs.python.org/3.14/library/exceptions.html#ModuleNotFoundError),
> [`sys.implementation`](https://docs.python.org/3.14/library/sys.html#sys.implementation).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06zd](06zd-the-bytecode-cache-and-the-flag.md) established that the interpreter looks for
exactly one bytecode filename and recompiles from source when it is not there. Delete the
source and that sentence loses its escape hatch. Two rules then govern, they live in two
different PEPs, and neither is where anyone looks: a `.pyc` inside `__pycache__` is ignored
when its `.py` is missing, and a source-less module is loaded only from the *non-optimized*
filename. So the obvious bytecode-only recipe — `compileall -o 2`, then delete the `.py`
files — produces a tree containing no importable modules whatsoever, and reports it as
`ModuleNotFoundError` on packages you can see with `ls`. This chunk is those two rules and the
build recipe that satisfies both; [06zp](06zp-the-path-api-for-the-cache.md) is the API that
answers "which file would this process actually open" without guessing.**

## Rule one — `__pycache__` needs the source to exist

PEP 3147, which invented `__pycache__`, is explicit that its contents are a *cache* and not a
distribution format:

> *"If the py source file is missing, the pyc file inside `__pycache__` will be ignored."*

Not "tried and rejected" — ignored. The directory is keyed to a source file, and with the key
gone the entry is unreachable. The PEP then carves out the one supported alternative:

> *"In order to continue to support source-less distributions though, if the source file is
> missing, Python will import a lone pyc file if it lives where the py file would have been,
> i.e. not in the `__pycache__` directory."*

And the precedence between the two locations, so a leftover legacy file cannot shadow live
source:

> *"Python will ignore all legacy pyc files when a source file exists next to it … pyc file
> outside of `__pycache__` will only be imported if the py source file is missing."*

## Rule two — a source-less module is read from the un-tagged name

PEP 488's rationale settles what that "lone pyc" may be called:

> *"This means that bytecode-only modules will only load from their non-optimized `.pyc` file
> name."*

There is no `opt-1` or `opt-2` variant of the source-less path. The optimization level, which
[06zd](06zd-the-bytecode-cache-and-the-flag.md) showed is normally *in the filename*, is
therefore invisible for this one class of artefact — the file is called `orders.pyc` whatever
it contains. That is why the PEP tells distributors to make the decision once, up front:

> *"As for people who distribute bytecode-only modules (i.e., use a bytecode file instead of a
> source file), they will have to choose which optimization level they want their bytecode
> files to be since distributing a `.pyo` file with a `.pyc` file will no longer be of any
> use."*

## The recipe that satisfies both rules

`compileall -b` writes exactly the location and name the source-less path requires:

> *"Write the byte-code files to their legacy locations and names, which may overwrite
> byte-code files created by another version of Python. The default is to write files to their
> PEP 3147 locations and names, which allows byte-code files from multiple versions of Python
> to coexist."*

```bash
# Bytecode-only at level 2, in the location and under the name import will read.
python -m compileall -o 2 -b -q /app
find /app -name '*.py' -delete
find /app -name '__pycache__' -type d -prune -exec rm -rf {} +
```

Read the second half of the `-b` sentence before you adopt it. Legacy names carry no
`cache_tag`, so the collision protection [06zd](06zd-the-bytecode-cache-and-the-flag.md)
described is gone too: `orders.pyc` from a 3.13 build and `orders.pyc` from a 3.14 build are
the same path. A source-less tree is version-locked to the interpreter that compiled it, and
nothing in the filename will tell you which one that was.

⚠️ **The uncertainty in the middle of that recipe.** Each half is documented — `-b` writes
legacy names, and source-less imports come from the non-optimized name — but **I could not
find a sentence stating that `-o 2 -b` composes into "level-2 bytecode under the un-tagged
name"**. It is the only reading that makes PEP 488's "choose your level" instruction
meaningful for source-less distributions, and it is how the pieces fit; treat it as the
documented pieces implying the result rather than as a documented result, and verify it on
your own build before shipping.

## Gotchas

**★ Symptom: `ModuleNotFoundError` for a package you can see in the image with `ls`.** Cause:
the artefact is bytecode-only and the bytecode is in `__pycache__`, where *"if the py source
file is missing, the pyc file inside `__pycache__` will be ignored"* — or it sits in the right
place but is tagged `.opt-2`, and *"bytecode-only modules will only load from their
non-optimized `.pyc` file name."* The exception is the ordinary one, *"raised by import when a
module could not be located"*, so nothing in the traceback mentions optimization levels or
cache directories, and the whole investigation goes looking at `sys.path`. Fix: write the
legacy location, then remove the `__pycache__` tree that is now unreachable weight.

```bash
python -m compileall -o 2 -b -q /app
find /app -name '*.py' -delete
find /app -name '__pycache__' -type d -prune -exec rm -rf {} +
```

**★ Symptom: a source-less deployment that worked last quarter fails wholesale after a
routine base-image bump.** Cause: legacy names carry no `cache_tag` — that is the documented
trade of `-b`, *"which may overwrite byte-code files created by another version of Python"* —
so the artefact is bound to one interpreter version with nothing in the filename to say which.
A 3.14 interpreter reading bytecode compiled by 3.13 has no name-based miss to fall back on.
Fix: pin the interpreter in the same file that builds the artefact, and re-run the source-less
build on every interpreter bump rather than treating the `.pyc` tree as portable.

```dockerfile
FROM python:3.14-slim AS build
RUN python -m compileall -o 2 -b -q /app && find /app -name '*.py' -delete

FROM python:3.14-slim          # 🔴 must be the same version, not just the same tag family
COPY --from=build /app /app
```

**★ Symptom: assertions are gone from a service whose command line and environment are both
clean.** Cause: this is [06m](06m-the-guard-the-platform-deletes.md)'s third route, and the
source-less case is where it is completely undetectable from outside the process. Optimization
happens at compile time; a source-less `orders.pyc` built with `-o 1` carries the deletions,
and its filename records no level because the un-tagged name is the only one that loads. Fix:
assert the level from inside the process at startup, since neither `ps` nor `env` can answer
it here.

```python
import sys
EXPECTED_OPTIMIZE = 0
if sys.flags.optimize != EXPECTED_OPTIMIZE:
    raise SystemExit(
        f"refusing to start: optimization level {sys.flags.optimize}, expected {EXPECTED_OPTIMIZE}"
    )
```

⚠️ `sys.flags.optimize` reports how the *interpreter* was started, not the level the bytecode
was compiled at. In a source-less tree those are exactly the two things that can differ, so
the check above catches an unexpected flag and cannot catch an unexpected artefact. Record the
compile level as image metadata as well; there is no runtime API that recovers it.

**Symptom: a stale `orders.pyc` next to live source is being blamed for stale behaviour.**
Cause: it is not the culprit — *"Python will ignore all legacy pyc files when a source file
exists next to it"*, so a legacy-location file is dead the moment a `.py` is beside it. Fix:
look in `__pycache__` instead, and delete the legacy file anyway because it will spring back
to life the day someone strips the sources.

```bash
find /app -maxdepth 3 -name '*.pyc' -not -path '*/__pycache__/*' -print -delete
```

## Interview questions

**★ A wheel ships only `.pyc` files and the import fails on the production interpreter, but
the files are visibly present. Walk through it.**
Three questions, in order, and each has a documented answer. *Where are the files* — if they
are in `__pycache__` they are dead, because *"if the py source file is missing, the pyc file
inside `__pycache__` will be ignored"*; source-less imports come only from the location the
`.py` would have occupied. *What are they named* — if they carry `.opt-1` or `.opt-2` they are
dead too, since *"bytecode-only modules will only load from their non-optimized `.pyc` file
name."* *Which interpreter compiled them* — legacy names carry no `cache_tag`, so a tree built
on 3.13 is simply wrong bytecode for 3.14 with no filename to reveal it. The single diagnostic
that covers the first two is `importlib.util.cache_from_source(path)` under the production
interpreter with `optimization` left at `None`: it yields the exact path import will try, and
the mismatch names itself.

**★ Why is `ModuleNotFoundError` the *right* failure here, rather than a bug?**
Because the alternative is worse. The import system does one lookup for one name; if it fell
back across optimization levels or locations, a source-less deployment could silently load
level-2 bytecode — assertions removed, docstrings discarded — into a process that asked for
neither, and nothing in the environment would show it. PEP 488's whole argument against `.pyo`
was that one name meant two possible contents. Refusing to import is a loud failure at
startup, in the build pipeline, on the first smoke test. Answering the question "would you
rather have the wrong bytecode or no bytecode" correctly is most of what this topic is about,
and it is the same trade as [06m](06m-the-guard-the-platform-deletes.md)'s: a check that is
absent is far more dangerous than one that fails.

**Can you recover, at runtime, the optimization level a `.pyc` was compiled at?**
For the `__pycache__` case, yes, and trivially — it is in the filename, which is the entire
contribution of PEP 488. For the source-less legacy case, no: the file is `orders.pyc`
whatever level produced it, because a bytecode-only module *"will only load from their
non-optimized `.pyc` file name"*. `sys.flags.optimize` does not help, since it reports how the
interpreter was started, not how the bytecode was compiled, and those are precisely the two
things that can disagree in a source-less deployment. **I could not find a documented API that
recovers the compile-time level from a legacy-named `.pyc`.** The engineering answer is
therefore to record the level as build metadata — an image label, a manifest entry — because
the artefact has thrown that information away.

**When is `compileall -b` the right choice and when is it a mistake?**
Right when you are deliberately shipping source-less code, because it is the only supported
way to produce the location and name a source-less import reads. A mistake anywhere else, and
the documentation says why in the same breath: it writes files *"which may overwrite byte-code
files created by another version of Python"*, whereas the default PEP 3147 layout *"allows
byte-code files from multiple versions of Python to coexist."* Running `-b` over a shared
`site-packages` to "clean up `__pycache__` directories" trades a self-healing cache for a
version-locked one, and the damage surfaces on the next interpreter upgrade rather than on the
day of the change.

---

← Prev: [The bytecode cache and the flag](06zd-the-bytecode-cache-and-the-flag.md) · Index: [EAFP vs LBYL](README.md) · Next → [The path API for the cache](06zp-the-path-api-for-the-cache.md)
