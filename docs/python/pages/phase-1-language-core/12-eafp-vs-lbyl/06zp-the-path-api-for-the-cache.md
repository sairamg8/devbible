---
title: "Stop guessing at cache filenames: importlib.util.cache_from_source with its default optimization answers which bytecode file this interpreter will actually look for, and source_from_cache inverts it while raising on precisely the files that are not PEP 488 cache entries"
sidebar_label: "06zp · The path API for the cache"
sidebar_position: 171
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference — [`importlib.util.cache_from_source` / `importlib.util.source_from_cache`](https://docs.python.org/3.14/library/importlib.html#importlib.util.cache_from_source),
> [`sys.pycache_prefix`](https://docs.python.org/3.14/library/sys.html#sys.pycache_prefix), [`sys.implementation`](https://docs.python.org/3.14/library/sys.html#sys.implementation),
> [`sys.flags`](https://docs.python.org/3.14/library/sys.html#sys.flags), [`PYTHONPYCACHEPREFIX` and `-X pycache_prefix`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONPYCACHEPREFIX),
> [PEP 488](https://peps.python.org/pep-0488/), [PEP 3147](https://peps.python.org/pep-3147/).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06zd](06zd-the-bytecode-cache-and-the-flag.md) and
[06zf](06zf-bytecode-only-and-the-name-that-is-read.md) established that a bytecode cache
miss is a *filename* disagreement, invisible from the outside and reported as either a slow
start or a missing module. Both are diagnosed the same way: ask the interpreter which path it
is going to try, instead of inferring it from flags you think were set.
`importlib.util.cache_from_source` is that question, and its default — `optimization=None`,
meaning "this process's level" — is what makes it an answer rather than a calculator.
`source_from_cache` runs it backwards and raises on exactly the files that are not
PEP-488-named, which makes its `ValueError` a free classifier rather than a failure. Between
them they turn "which `.pyc` does this process want" from an argument into a call.**

## `cache_from_source` — three behaviours in one parameter

The signature is `cache_from_source(path, debug_override=None, *, optimization=None)`, and the
whole page turns on what `optimization` accepts:

> *"The `optimization` parameter is used to specify the optimization level of the bytecode
> file. An empty string represents no optimization, so `/foo/bar/baz.py` with an
> `optimization` of `''` will result in a bytecode path of
> `/foo/bar/__pycache__/baz.cpython-32.pyc`. `None` causes the interpreter's optimization
> level to be used. Any other value's string representation is used, so `/foo/bar/baz.py` with
> an `optimization` of `2` will lead to the bytecode path of
> `/foo/bar/__pycache__/baz.cpython-32.opt-2.pyc`. The string representation of `optimization`
> can only be alphanumeric, else `ValueError` is raised."*

| `optimization=` | Means | Use it when |
|---|---|---|
| `None` (default) | *"the interpreter's optimization level"* | **Diagnosing.** You want the path *this* process will try |
| `''` | no optimization, un-tagged name | Auditing the level-0 file specifically |
| `1` / `2` / `"1"` | that level, `.opt-N` tag | Checking a build produced a level you did not run at |
| anything non-alphanumeric | — | Never; it raises `ValueError` |

The tag also comes from the running interpreter: *"The `cpython-32` string comes from the
current magic tag … if `sys.implementation.cache_tag` is not defined then
`NotImplementedError` will be raised."* So a single call with the default covers all three
fields of the PEP 488 name, and covers them for the process that is actually running rather
than for the one you believe is running.

## The two shapes worth writing down

**A startup log**, so the fact is in the same place as the incident. `sys.pycache_prefix` is
in there because it relocates the whole cache tree —
[06zq](06zq-where-the-cache-lives.md) is what it does and why a build step has to match it:

```python
import logging
import sys
from importlib.util import cache_from_source

logger = logging.getLogger(__name__)

def log_bytecode_identity(module) -> None:
    """Record which bytecode file this process would look for, for one module."""
    source = getattr(module, "__file__", None)
    if source is None or not source.endswith(".py"):
        logger.warning("no source path for %r; cannot derive a cache path", module)
        return
    logger.warning(
        "optimize=%d cache_tag=%s prefix=%s expects=%s",
        sys.flags.optimize,
        sys.implementation.cache_tag,
        sys.pycache_prefix,
        cache_from_source(source),        # optimization=None -> this interpreter's level
    )
```

**A build gate**, run with the interpreter and flags the container will use, so the mismatch
fails the build rather than the deploy:

```python
import sys
from importlib.util import cache_from_source
from pathlib import Path

def sources_without_bytecode(package_root: Path) -> list[Path]:
    """Sources with no .pyc at THIS interpreter's optimization level and cache tag."""
    return [
        source
        for source in package_root.rglob("*.py")
        if not Path(cache_from_source(source)).exists()
    ]

if __name__ == "__main__":
    gaps = sources_without_bytecode(Path(sys.argv[1]))
    if gaps:
        raise SystemExit(
            f"{len(gaps)} modules have no bytecode at optimization level "
            f"{sys.flags.optimize} (cache_tag={sys.implementation.cache_tag}); "
            f"first offender: {gaps[0]}"
        )
```

That gate is worth more than it looks. `compileall` exiting zero proves files were written; it
proves nothing about whether they are the files the runtime will open, which is the only
property anyone cares about.

## `source_from_cache` — the inverse, and its two exceptions

> *"Given the `path` to a PEP 3147 file name, return the associated source code file path …
> `path` need not exist, however if it does not conform to PEP 3147 or PEP 488 format, a
> `ValueError` is raised. If `sys.implementation.cache_tag` is not defined,
> `NotImplementedError` is raised."*

The `ValueError` is the useful half: it is a free classifier for "this `.pyc` is not a PEP 488
cache entry", which catches legacy-named files, hand-copied bytecode and the output of
`compileall -b`. The `NotImplementedError` means something categorically different —
*"If `cache_tag` is set to `None`, it indicates that module caching should be disabled"* — and
should never be swallowed by the same handler.

```python
from importlib.util import source_from_cache

def source_for(pyc: str) -> str | None:
    try:
        return source_from_cache(pyc)
    except ValueError:
        return None            # legacy-named or hand-placed: not a PEP 488 cache entry
    except NotImplementedError:
        raise RuntimeError("this interpreter has no cache_tag; bytecode caching is disabled")
```

## Gotchas

**★ Symptom: `ValueError` from `cache_from_source` in a build script.** Cause: *"The string
representation of `optimization` can only be alphanumeric, else `ValueError` is raised"* — so
a level read from config or `argv` as `"1 "`, `"-O"` or `"opt-1"` fails at the call. Fix:
normalise to an integer at the boundary, and pass `None` when you mean "whatever this process
is".

```python
from importlib.util import cache_from_source

def cache_path(source: str, level: str | None) -> str:
    optimization = None if level is None else int(level)   # fails here, where it means something
    return cache_from_source(source, optimization=optimization)
```

**Symptom: `TypeError` from `cache_from_source` after adding an `optimization=` argument to an
old call.** Cause: the call already passed the deprecated second positional argument. *"The
`debug_override` parameter is deprecated and can be used to override the system's value for
`__debug__`. A `True` value is the equivalent of setting `optimization` to the empty string. A
`False` value is the same as setting `optimization` to `1`. If both `debug_override` and
`optimization` are not `None` then `TypeError` is raised."* Fix: delete `debug_override` and
say the level directly — the mapping is in the quote.

```python
from importlib.util import cache_from_source

cache_from_source("app/orders.py", optimization="")   # was debug_override=True
cache_from_source("app/orders.py", optimization=1)    # was debug_override=False
cache_from_source("app/orders.py")                    # whatever this process is
```

**Symptom: a cache-auditing script crashes on the first file it meets in a vendored tree.**
Cause: `source_from_cache` raises `ValueError` when the path *"does not conform to PEP 3147 or
PEP 488 format"*, and legacy-named bytecode is exactly that. The script treated an expected
classification as a fatal error. Fix: catch `ValueError` as the classification it is, and let
`NotImplementedError` — a disabled `cache_tag` — stay fatal, because it means the whole audit
is meaningless on this interpreter.

```python
from importlib.util import source_from_cache
from pathlib import Path

def legacy_named_pycs(root: Path) -> list[Path]:
    found = []
    for pyc in root.rglob("*.pyc"):
        try:
            source_from_cache(str(pyc))
        except ValueError:
            found.append(pyc)              # not PEP 488 -> legacy or hand-placed
    return found
```

**Symptom: `cache_from_source` returns a path for a file that could never have one.** Cause:
it is a pure name transformation — *"`path` need not exist"* is stated for `source_from_cache`
and the same is true in the other direction; nothing is checked against the filesystem, and a
`.so`, a `.pyd` or a directory name will be transformed just as happily. Fix: guard on the
suffix before you call it, and treat the result as a *question* to ask the filesystem, not an
answer.

```python
from pathlib import Path
from importlib.util import cache_from_source

def expected_cache(source: Path) -> Path | None:
    if source.suffix != ".py":
        return None                        # extension modules have no PEP 488 cache entry
    return Path(cache_from_source(str(source)))
```

## Interview questions

**★ How do you prove which bytecode file a running process will load, without guessing?**
Call `importlib.util.cache_from_source` on the module's source path *from inside that
process*, with `optimization` at its default — *"`None` causes the interpreter's optimization
level to be used"* — and log it beside `sys.flags.optimize`, `sys.implementation.cache_tag`
and `sys.pycache_prefix`. That covers every field that can move the path, and it needs no
knowledge of how the process was launched, which is the point: the flag may have come from a
wrapper script, a base image's `ENV` or a pod spec rather than a command line you can read.
Two limits are worth volunteering. It returns the `__pycache__`-style path, so it does not
describe the source-less legacy location from
[06zf](06zf-bytecode-only-and-the-name-that-is-read.md). And it reports the path the
interpreter *expects*, not the file it actually read — so pair it with an existence check when
the question is "did the build produce this".

**★ Why does `cache_from_source` take an `optimization` argument at all, when the interpreter
already has a level?**
Because the two useful questions are different. `None` asks *"what will this process open"*,
which is the diagnostic question. An explicit level asks *"what would a process at level N
open"*, which is the build question — and a build very often runs at a different level from
the runtime it is producing for. The empty string is the third case, and it is not the same as
`0`: *"An empty string represents no optimization"* and produces the un-tagged pre-PEP-488
name, which is the name a source-less module loads from. A build gate typically wants the
explicit form; a startup log always wants the default.

That `sys.implementation.cache_tag` is `None`, which is documented to mean *"module caching
should be disabled"* — an alternative implementation or an embedded build that does not use
`.pyc` files at all. It is a statement about the interpreter, not about the path you passed,
which is why it should not share a handler with `ValueError`. On such a runtime the entire
bytecode-cache discussion is inapplicable: there is no file to be stale, no level to disagree
about, and any tooling that assumes `__pycache__` exists is simply wrong there.

**Why is `debug_override` deprecated rather than just kept as a convenience?**
Because it encodes the pre-PEP-488 world, where the only distinction was "optimized or not".
Its documented mapping gives it away — *"A `True` value is the equivalent of setting
`optimization` to the empty string. A `False` value is the same as setting `optimization` to
`1`"* — so it cannot express level 2 at all, which is precisely the level `-OO` produces and
the one that discards docstrings. It is the same defect PEP 488 removed from the filename
scheme, surviving in an API parameter: a boolean where the domain has three values.

---

← Prev: [Bytecode-only and the name that is read](06zf-bytecode-only-and-the-name-that-is-read.md) · Index: [EAFP vs LBYL](README.md) · Next → [Where the cache lives, and whether it is written](06zq-where-the-cache-lives.md)
