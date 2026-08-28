---
title: "Turning the dangerous entries off: -P, -I, -E, -s, -S, and the sys.path.insert you should not write"
sidebar_label: "2c · Controlling sys.path"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-P`, `-I`, `-E`, `-s`, `-S`, `PYTHONSAFEPATH`, `PYTHONNOUSERSITE`),
> [What's New In Python 3.11](https://docs.python.org/3.14/whatsnew/3.11.html)
> (the `-P` rationale) and
> [`sys.path` initialization](https://docs.python.org/3.14/library/sys_path_init.html)
> (`._pth` files).
> Target: **CPython 3.14**.

**Every entry `sys.path` gets automatically is a convenience with a matching
failure mode, and CPython gives you a switch for each one. `-P` removes the
directory that causes stdlib shadowing, `-s` removes the user site directory,
`-E` removes the environment's influence, `-S` removes site-packages entirely,
and `-I` removes all of them at once. Knowing which switch removes which entry
turns "why is it importing that?" from a guessing game into three commands.**

## `-P` and `PYTHONSAFEPATH` — the fix for the whole of chunk 3

> *"Don't prepend a potentially unsafe path to `sys.path`: `python -m module`
> command line: Don't prepend the current working directory. `python script.py`
> command line: Don't prepend the script's directory. If it's a symbolic link,
> resolve symbolic links. `python -c code` and `python` (REPL) command lines:
> Don't prepend an empty string, which means the current working directory."*

> *"If this is set to a non-empty string, don't prepend a potentially unsafe path
> to `sys.path`: see the `-P` option for details."* (`PYTHONSAFEPATH`)

The 3.11 release note gives the reason in one sentence:

> *"This ensures only stdlib and installed modules are picked up by `import`, and
> avoids unintentionally or maliciously shadowing modules with those in a local
> (and typically user-writable) directory."*

Both were added in 3.11 and the flag is exposed as `sys.flags.safe_path`. For any
installed application — a console entry point, a container `CMD`, a systemd unit
— `PYTHONSAFEPATH=1` is close to free correctness: the code is installed, so it
does not need the cwd, and removing the cwd removes the entire shadowing class of
bug from [chunk 3](03-shadowing-the-stdlib.md).

The catch is that it changes what your program can import, so it is a deployment
decision rather than a debugging flag. Turn it on early, in development, where a
newly broken import is cheap.

There is also a subtle interaction worth knowing before you enable it globally:
CPython's "you may be shadowing a stdlib module" hint is itself conditional on
the unsafe path being present. The comment in `Objects/moduleobject.c` states the
check as pseudocode:

> *"The condition we check is basically: `root =
> os.path.dirname(origin.removesuffix(os.sep + "__init__.py"))`; `return not
> sys.flags.safe_path and root == (sys.path[0] or os.getcwd())`"*

So with `-P` active, a shadowing file that still reaches `sys.path` some other
way (via `PYTHONPATH`, say) produces the *generic* error rather than the helpful
one. `-P` prevents the common case and removes the hint for the rare one.

## `-I` — isolated mode, the one to reach for when diagnosing

> *"Run Python in isolated mode. This also implies `-E`, `-P` and `-s` options."*

> *"In isolated mode `sys.path` contains neither the script's directory nor the
> user's site-packages directory. All `PYTHON*` environment variables are ignored,
> too. Further restrictions may be imposed to prevent the user from injecting
> malicious code."*

`python -I` is the fastest way to answer "is my problem in the environment or in
the code?". If the failure disappears under `-I`, it was caused by the cwd,
`PYTHONPATH`, `PYTHONHOME`, or the user site directory — and the next three
commands narrow down which.

## The individual switches

| Switch | Removes | Environment equivalent |
|---|---|---|
| `-P` | the script directory / cwd entry | `PYTHONSAFEPATH` |
| `-E` | *"all `PYTHON*` environment variables"* | — |
| `-s` | the user site-packages directory | `PYTHONNOUSERSITE` |
| `-S` | the `site` import and its path manipulations | — |
| `-I` | `-E` + `-P` + `-s` together | — |

`-E` verbatim:

> *"Ignore all `PYTHON*` environment variables, e.g. `PYTHONPATH` and
> `PYTHONHOME`, that might be set."*

`-s` verbatim:

> *"Don't add the user site-packages directory to `sys.path`."*

`-S` is the heavy one and needs care:

> *"Disable the import of the module `site` and the site-dependent manipulations
> of `sys.path` that it entails. Also disable these manipulations if `site` is
> explicitly imported later (call `site.main()` if you want them to be
> triggered)."*

Under `-S` you lose site-packages, which means every third-party dependency. It
is a startup-time optimisation for a program that vendors everything, and a
diagnostic for "is a `.pth` file doing this to me?" — not something to leave on.
On 3.14 it no longer affects `sys.prefix` inside a virtual environment, because
that assignment moved into path initialisation.

## `._pth` — total override, mostly on Windows

> *"To completely override `sys.path` create a `._pth` file with the same name as
> the shared library or executable (`python._pth` or `python311._pth`)… In the
> `._pth` file specify one line for each path to add to `sys.path`."*

> *"When the file exists, all registry and environment variables are ignored,
> isolated mode is enabled, and `site` is not imported unless one line in the file
> specifies `import site`. Blank paths and lines starting with `#` are ignored.
> Each path may be absolute or relative to the location of the file."*

This is how the Windows embeddable distribution pins its own path, and it is a
trap for anyone who unzips that distribution expecting a normal Python: `pip`
does not work until `import site` is added to the `._pth`, because `site` never
ran. Note the difference from an ordinary `.pth`: a `.pth` file in site-packages
*adds* to the path; a `._pth` file next to the executable *replaces* it.

## Mutating `sys.path` at runtime

`sys.path` is a plain list, so `sys.path.insert(0, ...)` works. It is also,
almost always, the wrong answer:

```python
# The line that appears in every "make my imports work" answer online
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import mypkg                     # now it works!
```

Three problems, in increasing order of severity. It runs at import time of the
module that contains it, so the effect depends on import order. It reintroduces
exactly the shadowing risk `-P` exists to remove, at position 0, for the rest of
the process. And it makes the project non-installable in practice — the hack is
load-bearing, so the package never gets a working `pyproject.toml`, and the next
person to try `pip install .` finds out the hard way.

The supported alternatives, in order of preference: make the project installable
and use an editable install; use `python -m` from the project root; use
`site.addsitedir` if you genuinely need to add a directory of installed code; and
only then, as a last resort inside a script that will never be packaged, mutate
`sys.path` — at the very top of the entry point, never inside a library module.

## Gotchas

**Symptom:** enabling `PYTHONSAFEPATH=1` in production breaks imports that worked
**Cause:** the program was relying on the cwd or script directory being on `sys.path` — usually an uninstalled local package
**Fix:** that reliance *is* the bug; make the project installable. Enable the flag in development first so the breakage is cheap

**Symptom:** `-P` is set and CPython no longer suggests renaming a shadowing file
**Cause:** the hint is gated on `not sys.flags.safe_path`, per the check documented in `Objects/moduleobject.c`
**Fix:** expected. Diagnose with `find_spec` and `__file__` instead of relying on the hint

**Symptom:** `python -S` makes a script start faster but nothing third-party imports
**Cause:** `-S` skips `site`, and site-packages is added by `site`
**Fix:** use it only for programs that vendor their dependencies, or call `site.main()` explicitly once you have measured what you wanted to measure

**Symptom:** an embedded/embeddable Windows Python cannot run `pip`
**Cause:** a `._pth` file next to the executable replaced `sys.path` and, per the docs, `site` *"is not imported unless one line in the file specifies `import site`"*
**Fix:** add `import site` to the `._pth`. This is a documented switch, not a workaround

**Symptom:** `sys.path.insert(0, ...)` at the top of a module works in one entry point and not another
**Cause:** it executes when that module is imported, so its effect depends on import order — and it does nothing for imports that already resolved
**Fix:** if it must exist, it goes in the entry point before any project import. Better: install the package

**Symptom:** `-I` fixes the problem, and you ship `-I`
**Cause:** isolated mode also removes the user site directory and all `PYTHON*` variables, some of which your deployment may legitimately need
**Fix:** use `-I` to *locate* the cause, then remove that specific cause. Ship `-P`/`PYTHONSAFEPATH` if you want the durable part

**Symptom:** `-E` does not stop a `.pth` file from running code
**Cause:** `.pth` processing is part of `site`, not of the environment
**Fix:** `-S` disables `site` entirely; `-E` only ignores `PYTHON*` variables. They are orthogonal switches

**Symptom:** a program behaves differently for two users on the same machine
**Cause:** one of them has `PYTHONPATH`, `PYTHONSTARTUP` or a user site-packages directory the other does not
**Fix:** `-E` for the environment half, `-s` for the user site half, or `-I` for both plus the cwd — then reintroduce only what the program genuinely needs

## Interview questions

**★ What does `-P` do, and why would you turn it on?**
It stops CPython prepending the script's directory (for `python script.py`) or the
current directory (for `-m`, `-c`, stdin and the REPL) to `sys.path`. The 3.11
release note gives the motive: it *"ensures only stdlib and installed modules are
picked up by `import`, and avoids unintentionally or maliciously shadowing
modules with those in a local (and typically user-writable) directory"*. For an
installed application it is nearly free, because installed code does not need the
cwd — and it removes the entire `random.py` class of bug.

**Why is `sys.path.insert(0, ...)` considered a smell?**
Because it runs at import time of whichever module contains it, so its effect
depends on import order; because it puts a user-writable directory ahead of the
standard library for the rest of the process, reintroducing exactly what `-P`
removes; and because it substitutes for making the project installable, so the
hack becomes load-bearing and the packaging problem is never fixed. If a
directory genuinely must be added, `site.addsitedir` in an entry point is the
version that also processes `.pth` files.

**What is the difference between a `.pth` file and a `._pth` file?**
A `.pth` file lives in a site-packages directory and *adds* lines to `sys.path`
during `site` processing; its `import`-prefixed lines are executed. A `._pth`
file lives next to the executable or shared library and *replaces* `sys.path`
entirely — and when it exists, environment variables are ignored, isolated mode
is enabled, and `site` is not imported at all unless the file says `import site`.
The second is how the Windows embeddable distribution is locked down.

**Does `-S` make a program faster?**
It skips `site`, so it skips scanning site-packages directories, processing every
`.pth` file, and running any `import` lines those files contain, plus the
`sitecustomize`/`usercustomize` imports. On an interpreter with a crowded
site-packages that is measurable. It also removes site-packages from `sys.path`,
so it is only usable for programs that vendor their dependencies or extend the
path themselves.

**When would you use `-E`, and how is it different from `-I`?**
`-E` ignores all `PYTHON*` environment variables — `PYTHONPATH`, `PYTHONHOME`,
`PYTHONSTARTUP` and the rest. It is the surgical version of `-I`, which also
implies `-P` (no script directory or cwd) and `-s` (no user site-packages). Use
`-E` when you want a program's behaviour to be independent of a user's shell but
still want the cwd and the user site directory; use `-I` when you are diagnosing,
or when the process must be as close to hermetic as the interpreter allows.

**What is the practical difference between `-s` and `-S`?**
`-s` removes only the user site-packages directory — the `pip install --user`
location. `-S` skips the entire `site` module: no site-packages at all, no `.pth`
processing, no `sitecustomize`. The first is a small, safe hardening step for a
deployed program; the second removes every third-party dependency and is only
usable if the program vendors them or builds its own path.

---

← Prev: [`PYTHONPATH` and site-packages](02b-pythonpath-and-site-packages.md) · Index: [Imports](README.md) · Next → [Diagnosing an import failure](02d-diagnosing-import-failures.md)
