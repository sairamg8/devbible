---
title: "`requires-python` is not a note about your own code — it is a constraint every dependency in the graph must satisfy across its whole declared range, so lowering it by one minor version can make a resolution impossible"
sidebar_label: "16 · `requires-python`"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **core metadata** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)),
> the PyPA **pyproject.toml** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)),
> the PyPA guide **Writing your pyproject.toml**
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)),
> uv's **Resolution** concepts
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**) and uv's
> **Managing dependencies** ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**`requires-python` looks like the least interesting field in `pyproject.toml`: one string saying
which Pythons you support. It is in fact the most far-reaching constraint you can write, because a
universal resolver must find versions of *every* dependency that work across your **whole declared
range** — not on the interpreter you happen to be running. Widen it from `>=3.12` to `>=3.9` and
dependencies you have used for years may become unresolvable, because their newer releases dropped
3.9. The rule to memorise is uv's: your `requires-python` must be a subset of every dependency's
`requires-python`.**

## The field

> *"`requires-python` · TOML type: string · Corresponding core metadata field: `Requires-Python` · The
> Python version requirements of the project."*

Core metadata adds what installers do with it:

> *"This field specifies the Python version(s) that the distribution is compatible with. Installation
> tools may look at this when picking which version of a project to install. The value must be in the
> format specified in Version specifiers."*

> *"This field cannot be followed by an environment marker."*

Two consequences of that last sentence. First, `requires-python` is unconditional — there is no way to
say "3.9 on Linux, 3.11 elsewhere". Second, because it is a *version specifier*, every operator from
[04](04-equality-and-exclusion.md) and [05](05-ordered-comparisons.md) is available, including
`~=` and `!=` — and the exclusive-comparison carve-outs apply, so `<4` and `<4.0` differ in their
treatment of `4.0` pre-releases.

The PyPA guide's framing is the common case:

> *"This lets you declare the minimum version of Python that you support."*

```toml
[project]
name = "acme-reports"
requires-python = ">=3.12"
```

## 🔴 The rule: your range must be a subset of every dependency's

uv states the mechanism and its consequence in one paragraph:

> *"During universal resolution, all required packages must be compatible with the entire range of
> `requires-python` declared in the `pyproject.toml`. For example, if a project's `requires-python` is
> `>=3.8`, resolution will fail if all versions of given dependency require Python 3.9 or later, since the
> dependency lacks a usable version for (e.g.) Python 3.8, the lower bound of the project's supported
> range. In other words, the project's `requires-python` must be a subset of the `requires-python` of all
> its dependencies."*

Read that as an ordering of blame. When a resolution fails after you *widened* `requires-python`, the
dependency did not change — your claim did. You are now asserting that your project works on a Python
for which some dependency has no usable release.

The resolver's escape route is to pick *older* releases of that dependency for the older interpreters:

> *"When selecting the compatible version for a given dependency, uv will (by default) attempt to choose
> the latest compatible version for each supported Python version. For example, if a project's
> `requires-python` is `>=3.8`, and the latest version of a dependency requires Python 3.9 or later, while
> all prior versions supporting Python 3.8, the resolver will select the latest version for users running
> Python 3.9 or later, and previous versions for users running Python 3.8."*

which is precisely the marker-forked lockfile of [15](15-the-diamond-that-cannot-resolve.md): one
`pyproject.toml`, several locked versions of one package, one chosen per environment. If *no* release of
that dependency ever supported your floor, there is nothing to fall back to and the resolution fails.

## Upper bounds on `requires-python` are ignored by uv, deliberately

> *"When evaluating `requires-python` ranges for dependencies, uv only considers lower bounds and ignores
> upper bounds entirely. For example, `>=3.8, <4` is treated as `>=3.8`. Respecting upper bounds on
> `requires-python` often leads to formally correct but practically incorrect resolutions, as, e.g.,
> resolvers will backtrack to the first published version that omits the upper bound"*

The failure that rationale describes is worth spelling out. Suppose a dependency declares
`requires-python = ">=3.8,<4"` and you are resolving for Python 3.13. Taken literally, `<4` is satisfied
— but a project that *changed* its declaration from `<4` to no upper bound in a later release would, on
a strict resolver, look "less compatible" in its older releases, and the resolver would walk backwards
looking for the first release whose declaration does not cap. You end up with a five-year-old version of
a library that supports your Python perfectly well.

Practical rule: **do not put an upper bound on your own `requires-python`.** Writing `<4` buys nothing —
uv ignores it, and other resolvers may treat it as a reason to skip your release. The one thing it
reliably does is make your package look incompatible with a Python that does not exist yet.

## Dependency groups can have their own range

Development tooling often supports fewer Pythons than the library does, and uv lets you say so:

> *"By default, dependency groups must be compatible with your project's `requires-python` range. If a
> dependency group requires a different range of Python versions than your project, you can specify a
> `requires-python` for the group in `[tool.uv.dependency-groups]`"*

```toml
[project]
name = "example"
version = "0.0.0"
requires-python = ">=3.10"

[dependency-groups]
dev = ["pytest"]

[tool.uv.dependency-groups]
dev = { requires-python = ">=3.12" }
```

That is the release valve for the commonest version of this problem: a type checker or a formatter that
dropped an old Python, blocking a library that still supports it. Note it is a `tool.uv` table, not a
standard one — PEP 735 defines no per-group `requires-python`.

## How to widen or narrow it safely

```bash
# 1 — what does the graph actually require? Look before you edit.
uv tree

# 2 — change the declaration, then re-resolve deliberately
#     (editing requires-python makes the lock outdated: the metadata changed)
uv lock

# 3 — prove the claim on the floor you just declared, not just on your own interpreter
uv run --python 3.10 pytest -q
uv sync --resolution lowest-direct && uv run pytest -q
```

Narrowing is the safe direction: raising the floor can only enlarge the set of dependency releases
available to you, which is why "raise `requires-python`" is a standard remedy for an unresolvable graph.
Widening is the dangerous direction, and it is dangerous *silently* — the resolution either fails
immediately, or succeeds by pinning old versions for the older interpreters, which you will not notice
until a bug report arrives from someone on Python 3.9 running a two-year-old dependency.

## Gotchas

**★ Symptom: lowering `requires-python` from `>=3.12` to `>=3.9` breaks a resolution that worked.**
Cause: some dependency has no release supporting 3.9, and *"the project's `requires-python` must be a
subset of the `requires-python` of all its dependencies."* Fix: either raise the floor back, or accept
older releases for the old interpreters — and check what you got:

```bash
uv tree --python-version 3.9      # what the 3.9 fork actually resolves to
```

If the 3.9 fork pins a dependency two years old, you are shipping two different applications with one
version number. Usually the honest answer is a higher floor.

**★ Symptom: `requires-python = ">=3.10, <4"` and a resolver installs an ancient release of a
dependency.** Cause: the upper bound. uv *"only considers lower bounds and ignores upper bounds
entirely"* for *dependencies'* declarations, but other resolvers may honour them, and the documented
failure mode is that *"resolvers will backtrack to the first published version that omits the upper
bound."* Fix: drop the ceiling:

```toml
- requires-python = ">=3.10, <4"
+ requires-python = ">=3.10"
```

**★ Symptom: a dev tool cannot be installed because it dropped an old Python your library still
supports.** Cause: by default *"dependency groups must be compatible with your project's
`requires-python` range."* Fix: give the group its own range:

```toml
[tool.uv.dependency-groups]
typing = { requires-python = ">=3.12" }
```

**★ Symptom: CI passes on 3.13 and users on 3.10 report an `ImportError` from the standard library.**
Cause: `requires-python` constrains *resolution*, not your code. Declaring `>=3.10` does not stop you
writing 3.12-only syntax or importing `tomllib` where it does not exist. Fix: test the floor in CI and
tell the linter the target:

```toml
[tool.ruff]
target-version = "py310"      # flags syntax and API newer than the declared floor
```

**★ Symptom: `uv sync --locked` starts failing after only a `requires-python` edit.** Cause: correct
behaviour — the lock is checked against *"the project metadata"*, and `requires-python` is metadata, so
changing it invalidates the lock even if no dependency line moved. Fix: re-lock in the same commit, so
the declaration and its consequence land together:

```bash
uv lock && git add pyproject.toml uv.lock
```

**★ Symptom: a published library "supports 3.9" and installing it on 3.9 pulls unexpected old
dependencies.** Cause: the marker-forked resolution described above, working exactly as designed —
*"the resolver will select the latest version for users running Python 3.9 or later, and previous
versions for users running Python 3.8."* Fix: decide whether you actually support that floor. If you
have never run the old fork's dependency set, you do not; raise `requires-python` and say so in the
changelog.

**★ Symptom: `requires-python = "3.12"` behaves like an exact pin.** Cause: it *is* one — the field is a
version specifier, and a bare version with no operator is not valid, while `==3.12` would mean exactly
3.12.0 (plus zero-padding). Fix: use a bound:

```toml
- requires-python = "==3.12"
+ requires-python = ">=3.12"
```

**★ Symptom: you want "3.11 on Windows, 3.10 elsewhere" and cannot express it.** Cause:
*"This field cannot be followed by an environment marker."* `requires-python` is unconditional by
design, because an installer must be able to decide whether a distribution is usable *before* evaluating
anything environment-specific. Fix: declare the lower of the two and use markers on the *dependencies*
that differ ([11](11-environment-markers.md)).

**★ Symptom: a wheel installs on a Python it does not support.** Cause: `Requires-Python` is advisory in
tone — installers *"may look at this when picking which version of a project to install"* — and a
sufficiently forceful install (a direct URL, `--no-deps`, an unpacked wheel) can bypass the check. Fix:
do not rely on the field as a runtime guard; if the code truly cannot run, fail loudly at import:

```python
import sys
if sys.version_info < (3, 12):
    raise RuntimeError("acme-reports requires Python 3.12 or newer")
```

## Interview questions

**★ What does `requires-python` constrain, and what does it not?**
It constrains *resolution*: the set of dependency releases that may be selected, because every selected
release must itself declare compatibility with your whole range — uv's phrasing is that *"the project's
`requires-python` must be a subset of the `requires-python` of all its dependencies."* It does **not**
constrain your source code, your syntax or your standard-library usage; it does not stop a determined
install on an unsupported interpreter, since installers *"may"* consult it; and it cannot vary by
platform, because *"This field cannot be followed by an environment marker."*

**★ Why can lowering `requires-python` make a resolution fail?**
Because it widens the set of interpreters that every dependency must support. If your floor drops to
Python 3.9 and some dependency's releases all require 3.10+, there is no version of that dependency that
works across your declared range, and the resolution has nothing to choose. The subtler outcome is
success-with-a-cost: the resolver may satisfy the old interpreter with an *older* release of the
dependency, giving you a marker-forked lock where 3.9 users get code you have never tested.

**★ Why does uv ignore upper bounds on dependencies' `requires-python`?**
Because honouring them produces *"formally correct but practically incorrect resolutions"*. If a project
capped its declaration at `<4` in older releases and removed the cap later, a strict resolver reading a
newer Python would reject the capped releases and *"backtrack to the first published version that omits
the upper bound"* — landing on an ancient release that in reality works fine. Ignoring the ceiling avoids
punishing projects for a defensive declaration, and it is the reason you should not write `<4` in your
own `requires-python` either.

**★ Your library supports Python 3.10+ but your type checker dropped 3.10. How do you proceed?**
Give the dependency group its own range, since by default *"dependency groups must be compatible with your
project's `requires-python` range"*:
```toml
[tool.uv.dependency-groups]
typing = { requires-python = ">=3.12" }
```
The library keeps `requires-python = ">=3.10"` for its consumers, and the type-checking job runs on a newer
interpreter in CI. Note this is a `tool.uv` setting — PEP 735 defines no per-group `requires-python`, so a
different toolchain will need its own mechanism.

**★ How do you decide what floor to declare in the first place?**
By what you *test*, not by what you hope. The floor is a claim with two costs when it is wrong: too low, and
you promise support for interpreters that CI never runs and whose dependency sets differ from everyone
else's; too high, and you exclude users unnecessarily. So pick the oldest Python your CI matrix actually
exercises, keep a job that resolves at `--resolution lowest-direct` on that interpreter, and raise the floor
in a minor release with a changelog line when you drop one. An untested floor is the same category of defect
as an untested lower bound on a dependency ([06](06-floors-and-ceilings.md)).

---

← [15 · The diamond](15-the-diamond-that-cannot-resolve.md) · [Topic index](README.md) · Next → [17 · What a lockfile guarantees](17-what-a-lockfile-guarantees.md)
