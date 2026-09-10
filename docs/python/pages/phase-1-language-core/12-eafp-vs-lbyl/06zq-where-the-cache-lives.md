---
title: "Two more knobs decide whether the cache your build wrote is the cache your runtime reads: PYTHONPYCACHEPREFIX relocates the entire tree and makes in-tree __pycache__ directories invisible, and PYTHONDONTWRITEBYTECODE treats any non-empty string as on — including the string 0"
sidebar_label: "06zq · Where the cache lives"
sidebar_position: 172
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`sys.pycache_prefix`](https://docs.python.org/3.14/library/sys.html#sys.pycache_prefix),
> [`sys.dont_write_bytecode`](https://docs.python.org/3.14/library/sys.html#sys.dont_write_bytecode),
> [`-B` and `PYTHONDONTWRITEBYTECODE`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-B),
> [`PYTHONPYCACHEPREFIX` / `-X pycache_prefix`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONPYCACHEPREFIX),
> [`compileall`](https://docs.python.org/3.14/library/compileall.html).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06zd](06zd-the-bytecode-cache-and-the-flag.md) covered the three fields of the cache
filename. Two settings move the file without touching any of them.
`PYTHONPYCACHEPREFIX` relocates the whole cache to a parallel tree and — the sentence people
skim — makes every in-tree `__pycache__` directory *ignored*, so a build step that did not
set it produced nothing the runtime can use. `PYTHONDONTWRITEBYTECODE` decides whether the
cache is written at all, and its rule is the "non-empty string" rule, which means the string
`0` turns it **on**. That last one is worth holding beside
[06zd](06zd-the-bytecode-cache-and-the-flag.md)'s unresolved `PYTHONOPTIMIZE=0`: same-looking
variable, same-looking value, and here the documentation actually does settle it — against the
intuitive reading.**

## `sys.pycache_prefix` — the whole tree moves

The documentation states the build-step consequence itself, which is unusual and worth
quoting in full:

> *"If this is set (not `None`), Python will write bytecode-cache `.pyc` files to (and read
> them from) a parallel directory tree rooted at this directory, rather than from `__pycache__`
> directories in the source code tree. Any `__pycache__` directories in the source code tree
> will be ignored and new `.pyc` files written within the pycache prefix. Thus if you use
> `compileall` as a pre-build step, you must ensure you run it with the same pycache prefix (if
> any) that you will use at runtime."*

Three details hide in there.

**"Will be ignored"** — not merged, not consulted as a fallback. Turning the prefix on at
runtime invalidates, in one step, every byte of cache your image build produced in-tree. The
files still ship; they are simply unreachable.

**"A relative path is interpreted relative to the current working directory."** A relative
prefix is therefore a *different directory per launcher*: systemd, cron, a shell and a
container entrypoint do not agree on `cwd`, so each accumulates its own tree and none of them
finds the build's.

**Precedence, and it is not the usual one.** *"This value is initially set based on the value
of the `-X` `pycache_prefix=PATH` command-line option or the `PYTHONPYCACHEPREFIX` environment
variable (command-line takes precedence). If neither are set, it is `None`."* A wrapper script
adding `-X pycache_prefix=…` silently beats the `ENV` in your Dockerfile.

The safe shape sets it once, above the compile step, so the build physically cannot run
without it:

```dockerfile
ENV PYTHONPYCACHEPREFIX=/var/cache/pyc
RUN python -m compileall -o 1 -q /app
```

## `-B` — the cache that is never written

The other knob is binary and has three spellings:

> *"`-B` — If given, Python won't try to write `.pyc` files on the import of source modules."*

> *"`PYTHONDONTWRITEBYTECODE` — If this is set to a non-empty string, Python won't try to
> write `.pyc` files on the import of source modules. This is equivalent to specifying the
> `-B` option."*

> *"`sys.dont_write_bytecode` — If this is true, Python won't try to write `.pyc` files on the
> import of source modules. This value is initially set to `True` or `False` depending on the
> `-B` command line option and the `PYTHONDONTWRITEBYTECODE` environment variable, but you can
> set it yourself to control bytecode file generation."*

🔴 **The environment variable has exactly one rule — non-empty means on — and no competing
integer rule.** `PYTHONDONTWRITEBYTECODE=0` is a non-empty string, so it means *do not write
bytecode*. That is the opposite of what almost everyone typing it intends, and unlike
[06zd](06zd-the-bytecode-cache-and-the-flag.md)'s `PYTHONOPTIMIZE=0`, the documentation is not
ambiguous about it: there is only one sentence and it covers `"0"`.

The third spelling is the interesting one, because it is *writable at runtime* — the only
member of this whole family that is. That makes a narrow but real pattern available: import
your application normally, then stop writing bytecode before you start executing untrusted or
temporary code.

```python
import sys

def freeze_bytecode_cache() -> None:
    """Stop writing .pyc files for anything imported from here on."""
    sys.dont_write_bytecode = True
```

⚠️ It only affects imports that have not happened yet. Setting it in the middle of your
application does nothing about modules already imported, and nothing about modules imported by
the interpreter before your first line ran.

## When turning the cache off is right

Three cases, and none of them is "for performance":

- **A read-only or immutable filesystem.** The write will not succeed anyway; `-B` stops the
  attempt rather than the recompile. Note what it does *not* buy you — the modules are still
  compiled on every start, because the cache was never there to read.
- **A bind-mounted source tree in a container.** The container's interpreter writes
  `__pycache__` directories into the host's working copy, owned by the container's user. `-B`
  keeps the host tree clean.
- **Ephemeral processes that import once.** A short CLI invocation that writes a cache nothing
  will ever read has paid the write for nothing.

The case it is *wrong* for is the common one: a long-lived service image, where a cache
written once at build time and read on every start is exactly the point.

## Gotchas

**★ Symptom: `compileall` runs in the image build, `__pycache__` is full, and the runtime
still recompiles every module.** Cause: `PYTHONPYCACHEPREFIX` is set at runtime but was not
set during the build — and *"any `__pycache__` directories in the source code tree will be
ignored"*, so the build's entire output is unreachable. The docs say it outright: *"if you use
`compileall` as a pre-build step, you must ensure you run it with the same pycache prefix (if
any) that you will use at runtime."* Fix: set the prefix once, as an `ENV`, above the compile
step, so the build cannot run without it.

```dockerfile
ENV PYTHONPYCACHEPREFIX=/var/cache/pyc
RUN python -m compileall -o 1 -q /app
```

**★ Symptom: `PYTHONDONTWRITEBYTECODE=0` disables the bytecode cache.** Cause: the rule is
*"If this is set to a non-empty string"*, and `"0"` is a non-empty string. There is no second
sentence about integers here, so the reading is unambiguous — the variable is on. Fix: unset
it. An environment variable whose semantics are "set or not set" cannot be turned off by
giving it a falsey-looking value.

```bash
unset PYTHONDONTWRITEBYTECODE          # the only "off"
```

```python
import sys
assert sys.dont_write_bytecode is False, "bytecode writing is disabled"
```

**★ Symptom: a relative `PYTHONPYCACHEPREFIX` behaves differently under systemd, cron and a
shell.** Cause: *"A relative path is interpreted relative to the current working directory"*,
and those three launchers do not agree on `cwd`. Each ends up with its own cache tree, none of
them the one the build populated. Fix: make the prefix absolute, always.

```bash
PYTHONPYCACHEPREFIX=/var/cache/pyc python -m app     # not ./pyc-cache
```

**★ Symptom: `__pycache__` directories keep appearing in the developer's working tree owned by
`root`.** Cause: a container with the source bind-mounted writes its cache into the host tree
as the container's user. Fix: turn writing off for that container specifically — this is the
case `-B` exists for — and keep the compiled cache for the production image, which does not
bind-mount anything.

```yaml
services:
  api:
    environment:
      PYTHONDONTWRITEBYTECODE: "1"      # dev only; the built image must NOT set this
    volumes:
      - ./src:/app/src
```

**Symptom: a wrapper script's cache prefix wins over the one in the Dockerfile, and nothing in
the image explains it.** Cause: documented precedence — *"the `-X` `pycache_prefix=PATH`
command-line option or the `PYTHONPYCACHEPREFIX` environment variable (command-line takes
precedence)"*. Fix: log the effective value at startup rather than the configured one; it is a
plain attribute.

```python
import sys
import logging

logging.getLogger(__name__).warning(
    "pycache_prefix=%s dont_write_bytecode=%s",
    sys.pycache_prefix,
    sys.dont_write_bytecode,
)
```

**Symptom: setting `sys.dont_write_bytecode = True` in `main()` does not stop `.pyc` files
appearing.** Cause: it governs *future* imports only — the documented behaviour is that Python
*"won't try to write `.pyc` files on the import of source modules"*, and your application's
own modules were imported before `main()` ran. Fix: if the intent is "this process never
writes bytecode", pass `-B` or set the environment variable, which apply from interpreter
startup; use the attribute only to cover imports you are about to perform.

```python
import sys
import importlib

def import_plugin_without_caching(name: str):
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        return importlib.import_module(name)
    finally:
        sys.dont_write_bytecode = previous
```

**Symptom: an image sets `PYTHONDONTWRITEBYTECODE=1` and starts slowly, and someone
"optimises" it by adding `compileall`.** Cause: the two are fighting. `compileall` writes the
cache at build time; the variable prevents *writes* but does not prevent *reads*, so the
build's files are still read — unless the build inherited the same variable, in which case it
wrote nothing at all. Fix: decide which one you want. For a production image, write at build
and leave writing enabled at runtime is harmless; setting the variable is the dev-container
answer, not the image answer.

```dockerfile
# Production image: compile once, read many. Do not set PYTHONDONTWRITEBYTECODE here.
RUN python -m compileall -o 1 -q /app
```

## Interview questions

**★ What actually breaks when `PYTHONPYCACHEPREFIX` is set in one place and not another?**
Everything the other place cached. The documentation is unusually direct: with a prefix set,
*"any `__pycache__` directories in the source code tree will be ignored and new `.pyc` files
written within the pycache prefix"*, and *"if you use `compileall` as a pre-build step, you
must ensure you run it with the same pycache prefix (if any) that you will use at runtime."*
So an image that compiles in-tree at build and sets the prefix at runtime recompiles the whole
application on every start, and the wasted `__pycache__` still ships in the layer. The two
sub-cases people miss: `-X pycache_prefix` beats the environment variable, so a wrapper script
can override an `ENV` invisibly; and a relative prefix is resolved against `cwd`, so one
configuration means different directories under different launchers.

**★ `PYTHONOPTIMIZE=0` and `PYTHONDONTWRITEBYTECODE=0` — do they mean the same kind of thing?**
No, and the contrast is the whole point. `PYTHONDONTWRITEBYTECODE` has one documented rule,
*"If this is set to a non-empty string"*, and `"0"` is non-empty, so the variable is **on** —
counter-intuitive but settled. `PYTHONOPTIMIZE` has two rules, one about non-empty strings and
one about integers, and they disagree about `"0"`; the documentation does not say which wins
and I have not run it, so the honest position is that its behaviour with `0` is unspecified as
far as the docs go. The transferable lesson is that a Python environment variable's semantics
are usually *presence*, not value, and the safe idiom for "off" is `unset`, never `=0`.

**★ Why does `sys.dont_write_bytecode` exist when `-B` already does the job?**
Because it is writable, and the other two spellings are decided before your code runs. The
documentation says so explicitly — *"you can set it yourself to control bytecode file
generation"* — which enables the narrow pattern of importing your own application normally,
with all the cache benefit, and then disabling writes before importing plugins, user scripts
or generated code that you do not want leaving `.pyc` files behind. Its limit is the same
thing that makes it useful: it applies to imports that have not happened yet, so it is not a
way to retroactively undo the cache your own startup already wrote.

**Does `-B` make anything faster?**
No, and expecting it to is the usual reason it is set. It removes a write, not a compile: the
source is still compiled on every process start, and now the result is thrown away instead of
being kept for the next one. On a long-lived service that restarts occasionally, `-B` is a
straight loss. It pays only when the write itself is the problem — a read-only filesystem
where the attempt is pointless, or a bind-mounted developer tree where the files land in
someone's working copy owned by the wrong user.

**A container image compiles bytecode at build time. What must be true at runtime for that
work to be used?**
Four things, and each is a separate way to lose it. The same `cache_tag`, meaning the same
interpreter build — a different base image in the runtime stage discards everything. The same
optimization level, because the level is in the filename. The same `pycache_prefix`, because
in-tree caches are *ignored* when a prefix is set. And the source files still present, because
a `__pycache__` entry whose `.py` is missing is ignored outright
([06zf](06zf-bytecode-only-and-the-name-that-is-read.md)). `PYTHONDONTWRITEBYTECODE` is not on
that list: it stops writes, not reads, so it costs you nothing already built — it only
guarantees you never repair a miss.

---

← Prev: [The path API for the cache](06zp-the-path-api-for-the-cache.md) · Index: [EAFP vs LBYL](README.md) · Next → [When the cache stops noticing](06zr-when-the-cache-stops-noticing.md)
