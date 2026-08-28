---
title: "Choosing a version manager: uv against pyenv on the two axes that matter, and where mise, asdf and conda actually belong"
sidebar_label: "7 · Choosing a manager"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/)
> documentation and the
> [pyenv README](https://github.com/pyenv/pyenv/blob/master/README.md).
> Claims about `mise`, `asdf` and `conda` are stated at recognition level and
> are the parts of this page I would check against their own current
> documentation before relying on a detail.
> Version spine: **Python 3.14.7**.

**There is no universally right version manager, but there are only two axes
that decide it: whether you need control over how the interpreter was *built*,
and whether you want the tool to manage environments and packages as well as
interpreters. `uv` says no to the first and yes to the second; `pyenv` says yes
to the first and deliberately no to the second. Everything else — speed,
polyglot support, the scientific stack — follows from those two answers.**

## pyenv versus uv, side by side

| | `pyenv` | `uv` |
|---|---|---|
| Selection mechanism | shims intercept the command name, globally | resolved per invocation |
| `which python` | a shim | the real path, if you installed the executables |
| Where interpreters come from | built from source at install time | pre-built python-build-standalone distributions |
| Build customisation | full — `configure` flags, compiler flags | none; take the distribution as shipped |
| Prerequisites | a compiler and build dependencies | none |
| Environments and packages | not its job (or `pyenv-virtualenv`) | integrated: `uv venv`, `uv add`, lockfile |
| `.python-version` | version numbers and version names | version numbers plus specifiers, implementations, variants |
| Parent search for `.python-version` | up to the filesystem root | stops at the project or workspace boundary |
| Windows | not supported (separate `pyenv-win` fork) | supported, registers per PEP 514 |
| Implemented in | pure shell | a compiled binary |

Neither is wrong. **Prefer `uv`** when you want the fastest path from nothing to
a reproducible project, and you are content with the shipped builds. **Prefer
`pyenv`** when you need a build you control — custom flags, a specific OpenSSL,
matching a production image byte for byte — or when you are on a machine where
the team's tooling already assumes shims.

## The other tools, at recognition level

- **`mise`** (formerly `rtx`) — a polyglot version manager in the `asdf` mould
  that also handles Node, Go, Ruby and so on, with shims *or* `PATH`
  manipulation. Worth knowing if your team already uses it for other languages;
  it uses python-build-standalone or source builds depending on configuration.
- **`asdf`** — the older polyglot shim manager, with Python provided by a plugin
  that wraps `python-build` (the same builder pyenv uses). Same shim semantics,
  same build prerequisites.
- **`conda` / `mamba` / `micromamba`** — a fundamentally different animal. Conda
  manages non-Python binary dependencies (compilers, CUDA, MKL, GDAL) alongside
  Python, from its own package channels rather than PyPI. In scientific and
  ML work that is often the deciding factor. The cost is a parallel packaging
  universe: conda packages and wheels can both be installed into the same
  environment and can disagree about which shared library is loaded.
- **Docker** — sidesteps the whole layer by shipping an interpreter inside the
  image. [Chunk 14](14-docker-base-images.md) covers the base-image choice.


## A decision procedure

**Start with `uv` unless something on this list applies.** It is the fastest
route from nothing to a reproducible project, it needs no build toolchain, and
it covers all three layers of [the model](03-installations-managers-environments.md).

**Choose `pyenv` when:**

- you need a build you control — custom `configure` flags, a specific OpenSSL, a
  shared-library build for embedding, `--disable-gil`;
- you must match a production interpreter's build characteristics exactly;
- the team's existing tooling assumes shims and you are not the one changing
  that today.

**Choose `conda` (or `mamba`/`micromamba`) when** the hard part of your
dependency graph is *not Python* — CUDA, MKL, GDAL, a Fortran compiler, an
older toolchain than the OS provides. That is a real category and pip cannot
solve it.

**Choose `mise` or `asdf` when** your repository already pins Node, Go or Ruby
versions through one of them, and the cost of a second mechanism for Python
exceeds the benefit of a better one.

**They can coexist, badly.** pyenv shims sit at the front of `PATH`; conda's
`base` environment activation also modifies `PATH`; uv resolves independently of
both. A machine with all three is not broken, but "which Python is this" now has
three plausible answers, and the diagnostic from
[chunk 3](03-installations-managers-environments.md) — asking the interpreter
rather than the shell — stops being optional.

## Gotchas

**Symptom:** conda and pip both installed a package and the wrong shared library is loaded
**Cause:** conda packages and wheels are two packaging universes writing into one environment, with different opinions about bundled native libraries
**Fix:** pick one as the source of truth per environment — usually conda for the native stack, pip only for pure-Python packages conda does not carry — and record the rule in the project's README

**Symptom:** a machine with pyenv *and* conda gives different answers in different shells
**Cause:** both modify `PATH` from your shell profile, and the order depends on which initialisation block ran last
**Fix:** decide which one owns `python` on that machine and remove the other's shell hook. Diagnose with `python -c "import sys; print(sys.executable, sys.prefix)"`, never with `which`

**Symptom:** the team standardised on a version manager but CI uses a different one
**Cause:** CI images ship their own Python and their own setup actions, which usually bypass whatever the developers use
**Fix:** make CI use the same mechanism as developers, or at minimum pin the same exact interpreter version. A version manager that is not used in CI is documentation, not enforcement

**Symptom:** switching from pyenv to uv left projects broken
**Cause:** existing virtual environments record an absolute path under `$(pyenv root)/versions`; nothing about installing uv changes that, and removing pyenv orphans them
**Fix:** migrate per project — install the equivalent version with uv, recreate `.venv`, re-resolve dependencies — and keep pyenv installed until the last project has moved

**Symptom:** `mise` or `asdf` and pyenv both installed, and shims are fighting
**Cause:** both work by putting a shims directory at the front of `PATH`; whichever is prepended last wins, and that can differ between login and non-login shells
**Fix:** exactly one shim-based manager per machine. This is not a preference; two shim directories is an unresolvable ordering problem

**Symptom:** a `.python-version` file works with one tool and is ignored or misread by another
**Cause:** the filename is shared but the accepted syntax is not — uv reads specifiers, implementation names and variants; pyenv reads version names and multiple lines; other tools read their own dialect
**Fix:** keep the committed file to a plain version number, which every tool that reads the file understands

## Interview questions

**★ What is the substantive difference between pyenv and uv?**
Two things. Mechanism: pyenv intercepts the command name globally with shims,
whereas uv resolves an interpreter per invocation from an explicit request.
Provenance: pyenv compiles each version from source at install time, so it needs
a toolchain and build dependencies but gives you complete control over
`configure` and compiler flags; uv downloads pre-built portable distributions,
so it needs nothing and is fast but you take the build as shipped. Scope also
differs — pyenv deliberately does not manage environments or packages, and uv
does both.

**★ Why might you deliberately choose pyenv over uv today?**
When the build matters. If you need a specific `configure` flag, a particular
OpenSSL, `--enable-optimizations`, a shared-library build for embedding, or an
interpreter that matches a production image exactly, source is the only route
and uv's pre-built distributions cannot give it to you — the uv docs themselves
note their distributions have portability-driven behaviour quirks. The other
reason is unglamorous: the team's tooling already assumes shims and changing
that is not today's task.

**★ Where does conda fit in this picture?**
It is not really a version manager; it is a second packaging ecosystem that also
happens to supply interpreters. Its value is managing non-Python binary
dependencies — compilers, CUDA, MKL, geospatial libraries — from its own
channels, which is why it dominates scientific and ML work. The cost is that
conda packages and PyPI wheels can both land in one environment with different
ideas about which native libraries to bundle, so a project should pick one as
the primary source and use the other only for what the first does not carry.

**Can you run pyenv and uv on the same machine?**
Yes, and it is a common transition state. uv classifies pyenv-installed
interpreters as *system* Pythons, so it can find and use them; pyenv is unaware
of uv entirely. The friction is that pyenv's shims answer for the bare `python`
command while uv answers per invocation, so the two can disagree about what
"Python" means in the same directory. Keeping one of them authoritative for the
global `python` command, and using `uv run` explicitly for project work, avoids
most of it.

**Two shim-based managers on one machine — what goes wrong?**
Both prepend a shims directory to `PATH`, so the winner is decided by whichever
shell initialisation ran last, which can differ between a login shell, a
non-login shell, an IDE terminal and a CI runner. The result is a machine where
the same command gives different answers in different contexts for reasons that
are not visible in any project file. One shim manager per machine is the only
stable configuration.

**Your team uses `mise` for Node and Go. Should Python use it too?**
Probably, unless something specific argues otherwise. A second mechanism for one
language means a second file to keep in sync, a second thing to explain to new
joiners, and a second failure mode in CI. The counter-argument is that Python's
environment and packaging story is deeper than most languages', so a
Python-specific tool that also handles locking and environments can be worth the
inconsistency — which is the actual case for `uv` alongside `mise`.

---

← Prev: [`pyenv`](06-pyenv.md) · Index: [Installing and versions](README.md) · Next → [Platform stories](08-platform-stories.md)
