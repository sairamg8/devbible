---
title: "The interpreter decides it is inside a virtual environment by looking for pyvenv.cfg beside the path it was launched as, which is why sys.prefix != sys.base_prefix is the only honest test"
sidebar_label: "2 · How the interpreter finds it"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against
> [PEP 405 – Python Virtual Environments](https://peps.python.org/pep-0405/),
> the Python 3.14 [`venv` docs](https://docs.python.org/3.14/library/venv.html),
> [`site`](https://docs.python.org/3.14/library/site.html) (including the 3.14
> change note on `sys.prefix` under virtual environments),
> [`sys`](https://docs.python.org/3.14/library/sys.html) and
> [The initialization of the `sys.path` module search path](https://docs.python.org/3.14/library/sys_path_init.html).
> Version spine: **Python 3.14.7**.

**Nothing tells the interpreter it is in a virtual environment. It works it out,
at startup, by looking for a `pyvenv.cfg` next to — or one level above — the
executable path it was invoked as. If it finds one with a `home` key, it sets
`sys.prefix` to the directory containing that file and `sys.base_prefix` to the
base installation, and everything downstream (site-packages, `pip`'s install
target, `sysconfig` paths) follows from those two values. Understanding this one
lookup explains why symlink resolution matters, why `VIRTUAL_ENV` is a lie, and
why the only correct "am I in a venv?" check is a comparison of two prefixes.**

## The landmark search

PEP 405 specifies the whole mechanism in two sentences:

> *"If a `pyvenv.cfg` file is found either adjacent to the Python executable or
> one directory above it (if the executable is a symlink, it is not
> dereferenced), this file is scanned for lines of the form `key = value`. If a
> `home` key is found, this signifies that the Python binary belongs to a virtual
> environment, and the value of the `home` key is the directory containing the
> Python executable used to create this virtual environment."*

Unpack the parenthesis, because it carries the design. `.venv/bin/python` is a
symlink to `/usr/local/bin/python3.14`. If the interpreter dereferenced it before
looking for the landmark, it would search `/usr/local/bin/` and one level up,
find no `pyvenv.cfg`, and conclude it was the base installation. Because it does
**not** dereference, it searches `.venv/bin/` and `.venv/`, finds the file, and
becomes the environment.

That is the entire trick. A venv is a *location* that the interpreter was
launched from, not a state the interpreter is in.

Then:

> *"`sys.base_prefix` is set to this value, while `sys.prefix` is set to the
> directory containing `pyvenv.cfg`."*

## The two prefixes and the one reliable test

The `venv` documentation states the consequence and hands you the test:

> *"When a Python interpreter is running from a virtual environment, `sys.prefix`
> and `sys.exec_prefix` point to the directories of the virtual environment,
> whereas `sys.base_prefix` and `sys.base_exec_prefix` point to those of the base
> Python used to create the environment. It is sufficient to check
> `sys.prefix != sys.base_prefix` to determine if the current interpreter is
> running from a virtual environment."*

So:

```python
import sys

def in_virtualenv() -> bool:
    return sys.prefix != sys.base_prefix
```

Outside an environment the two are equal. That is the whole check, it needs no
imports beyond `sys`, and it works whether or not anything was "activated".

Two variants you will meet in older code, and what to do with them:

```python
# virtualenv < 20 set this attribute; it does not exist on modern interpreters
# and never existed for the stdlib venv module. Do not write new code that uses it.
in_venv_legacy = hasattr(sys, "real_prefix")

# Reads an environment variable that activation happens to set. Wrong.
import os
in_venv_wrong = "VIRTUAL_ENV" in os.environ
```

The documentation is explicit about why the second one is wrong:

> *"When a virtual environment has been activated, the `VIRTUAL_ENV` environment
> variable is set to the path of the environment. Since explicitly activating a
> virtual environment is not required to use it, `VIRTUAL_ENV` cannot be relied
> upon to determine whether a virtual environment is being used."*

It fails in both directions. Run `.venv/bin/python` without activating and
`VIRTUAL_ENV` is unset while you are unambiguously in the environment. Activate a
venv and then run `/usr/bin/python3` by absolute path and `VIRTUAL_ENV` is still
set while you are unambiguously *not* in it — the variable is inherited by the
child process and describes your shell, not your interpreter.

## What follows from `sys.prefix`

Once `sys.prefix` is the environment, everything else falls out of it
mechanically. The `site` module docs:

> *"Head part: Uses `sys.prefix` and `sys.exec_prefix`; empty heads are
> skipped."*
>
> Tail part: *"`lib/python_X.Y[t]_/site-packages`"* on Unix and macOS,
> *"`lib/site-packages`"* on Windows.

So the environment's `site-packages` is added to `sys.path` for the same reason
the base installation's would have been — it is `sys.prefix` plus a fixed tail.
`pip` installs there because `pip` asks `sysconfig` where the current
interpreter's `purelib` is, and `sysconfig` answers from `sys.prefix`. There is
no venv-specific code path in pip's decision at all.

This is also why the free-threaded build gets its own directory name: the tail
picks up the `t` ABI flag, so a `3.14t` environment's packages land in
`lib/python3.14t/site-packages` and cannot be confused with the GIL build's.

## The 3.14 change: `-S` no longer hides the environment

Historically the prefix rewriting happened inside `site`, which meant that
disabling `site` disabled the venv. Python 3.14 moved it. From the `site` docs:

> *"Changed in version 3.14: `site` is no longer responsible for updating
> `sys.prefix` and `sys.exec_prefix` on Virtual Environments. This is now done
> during path initialization. As a result, under Virtual Environments,
> `sys.prefix` and `sys.exec_prefix` no longer depend on the `site`
> initialization and are unaffected by `-S`."*

Practical reading: on 3.14 and later, `.venv/bin/python -S -c "import sys; ..."`
reports the environment's prefix. On 3.13 and earlier it reported the base
prefix, because the rewrite never ran. If you maintain a tool that shells out
with `-S` — some build backends and profilers do — this is a behaviour change you
inherit for free by upgrading, and a divergence you must handle if you support
both.

`-S` still skips adding `site-packages` to `sys.path`. The prefixes being right
does not mean the packages are importable.

## Diagnosing "which environment am I in?"

The complete answer to that question is four values, and you can print all of
them without leaving `sys`:

```python
import sys, sysconfig

print("executable      :", sys.executable)       # the interpreter actually running
print("prefix          :", sys.prefix)           # the environment
print("base_prefix     :", sys.base_prefix)      # the installation behind it
print("in a venv       :", sys.prefix != sys.base_prefix)
print("site-packages   :", sysconfig.get_paths()["purelib"])
```

Run that with the interpreter you are suspicious about — `python`,
`./.venv/bin/python`, `python3 -m something`, whatever your CI actually invokes.
`sys.executable` alone resolves most confusion: it is the path of the running
interpreter, and it is what you must pass to `subprocess` if a program needs to
start another Python and stay in the same environment.

For a shell-level check without writing a file, ask the interpreter directly:

```bash
python -c "import sys; print(sys.prefix, sys.base_prefix, sep='\n')"
python -c "import sys; print(sys.executable)"
python -m pip -V     # prints pip's location, which reveals the site-packages it will write to
```

## Gotchas

**Symptom:** a script checks `os.environ["VIRTUAL_ENV"]` to refuse to run outside an environment, and refuses even when run as `.venv/bin/python script.py`
**Cause:** the environment was never activated, so the variable is unset — but the interpreter is the environment's
**Fix:** `if sys.prefix == sys.base_prefix: sys.exit("run me inside a virtual environment")`. The docs say `VIRTUAL_ENV` *"cannot be relied upon"* for exactly this

**Symptom:** a CI job activates a venv, then a build step runs `/usr/bin/python3` and installs into the system interpreter — while `VIRTUAL_ENV` still points at the venv
**Cause:** the variable is inherited by every child process regardless of which interpreter that child is
**Fix:** invoke the environment's interpreter explicitly (`"$VIRTUAL_ENV/bin/python" -m pip ...`) or, better, `uv run`. Never let a tool infer the environment from a variable it did not set

**Symptom:** double-clicking `python.exe` inside a venv on Windows runs the base interpreter
**Cause:** the docs warn that *"double-clicking `python.exe` in File Explorer will resolve the symlink eagerly and ignore the virtual environment"* — resolving the symlink moves the landmark search to the base installation's directory
**Fix:** this is why Windows venvs copy the executable by default. Do not create Windows environments with `--symlinks`

**Symptom:** a wrapper script does `python="$(readlink -f .venv/bin/python)"` and then everything installs into the base Python
**Cause:** `readlink -f` performs exactly the dereference PEP 405 deliberately avoids. The resolved path has no `pyvenv.cfg` above it
**Fix:** never canonicalise the path to a venv interpreter. Pass `.venv/bin/python` as-is; the interpreter needs that path to find its own environment

**Symptom:** a `systemd` unit or cron job with `ExecStart=/usr/bin/python3 /srv/app/main.py` cannot import the app's dependencies, though it works in your shell
**Cause:** you activated in your shell; the service did not. Nothing about the venv is recorded in the filesystem the service reads
**Fix:** `ExecStart=/srv/app/.venv/bin/python /srv/app/main.py`. Naming the environment's interpreter is the activation

**Symptom:** on 3.13 a tool that shells out with `python -S` reports the base prefix; on 3.14 the same tool reports the venv prefix
**Cause:** the 3.14 change moving venv prefix handling out of `site` and into path initialization
**Fix:** if you must support both, do not use `-S` to probe prefixes; read `sys.prefix` from a normal invocation, or use `-I`, whose semantics are unchanged

**Symptom:** `sys.prefix != sys.base_prefix` returns `True` inside a conda environment, so a check meant to detect venvs misfires
**Cause:** conda environments also give the interpreter its own prefix. The test detects "not the base installation", which is a slightly larger set than "a `venv`-created environment"
**Fix:** if you specifically need a `venv`, test for the file: `(pathlib.Path(sys.prefix) / "pyvenv.cfg").exists()`. In practice most tools want the broader test and should keep it

**Symptom:** two interpreters report the same `sys.prefix` but behave differently
**Cause:** `PYTHONPATH`, a `.pth` file, or a user site-packages directory is contributing entries that are not derived from the prefix
**Fix:** compare `sys.path` itself, not the prefix, and run with `-I` to see the behaviour with all of that stripped away

## Interview questions

**★ How does Python know it is running inside a virtual environment?**
At startup it looks for a `pyvenv.cfg` file adjacent to the executable path it
was invoked as, or one directory above it, *without* dereferencing symlinks. If
that file exists and contains a `home` key, `sys.prefix` is set to the directory
containing the file and `sys.base_prefix` to the base installation. There is no
environment variable involved and no flag — it is a filesystem lookup based on
`argv[0]`'s directory.

**★ What is the correct programmatic test for "am I in a venv"?**
`sys.prefix != sys.base_prefix`. The `venv` documentation states this is
sufficient. `VIRTUAL_ENV` is wrong because activation is optional and because the
variable is inherited by children that may be different interpreters entirely.
`sys.real_prefix` is a dead artifact of virtualenv 1.x.

**★ Why does the interpreter deliberately not resolve symlinks when looking for `pyvenv.cfg`?**
Because on POSIX the environment's `python` *is* a symlink to the base
interpreter. Resolving it would land the search in the base installation's
directory, no landmark would be found, and every virtual environment on the
platform would silently stop working. The non-resolution is the feature, and it
is why canonicalising the path to a venv interpreter in a wrapper script breaks
the environment.

**★ Why does `pip install` inside an activated environment write to the environment?**
Not because of activation. `pip` runs under the environment's interpreter, that
interpreter has `sys.prefix` pointing at the environment, `sysconfig` derives the
install paths from `sys.prefix`, and `site` derived the importable
`site-packages` from the same value. Activation only ensured that the `pip` on
your `PATH` was the environment's one.

**★ What changed in 3.14 about venv prefixes, and why would you care?**
The rewriting of `sys.prefix`/`sys.exec_prefix` for virtual environments moved
out of the `site` module into path initialization, so it is *"unaffected by
`-S`"*. You care if you own tooling that probes an interpreter with `-S` — the
answer it gets changes between 3.13 and 3.14 — and it is a small hardening: the
environment is now a property of interpreter startup rather than of an importable
module that can be disabled.

**★ Someone shows you a machine where `pip install` keeps hitting the system Python despite an activated venv. Where do you look?**
At `sys.executable` and `python -m pip -V`, not at `VIRTUAL_ENV`. The usual
causes are: a shell that cached the old `pip` location in its hash table, a
wrapper or alias with an absolute path to the system `pip`, `PATH` being
re-prepended by a later profile script or a version-manager shim, or the tool
being invoked as `pip` rather than `python -m pip`. All are diagnosed by asking
the interpreter which interpreter it is.

---

← Prev: [What a venv is on disk](01-what-a-venv-is-on-disk.md) · Index: [Virtual environments](README.md) · Next → [Creating one with python -m venv](03-creating-with-python-m-venv.md)
