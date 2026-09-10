---
title: "`.python-version` and `requires-python` are not two ways of saying the same thing: one is a request for an interpreter, the other is a constraint on your entire dependency resolution"
sidebar_label: "05b · .python-version vs requires-python"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Python versions*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/python-versions/)), *Working on projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/projects/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)) and the `pyproject.toml`
> specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Every uv project has two places that mention a Python version, and treating them as duplicates is
the most common structural mistake in a `pyproject.toml`. `.python-version` is a *request*: which
interpreter should uv use here, today, when creating this environment. `requires-python` is a
*constraint*: which Python versions this project supports — and therefore, per uv's resolver, which
versions **every single one of your dependencies** must also support. The first affects one machine.
The second reshapes your lockfile. Getting them backwards produces two recognisable failures: a
project pinned to an interpreter nobody else has, and a dependency set silently held at old releases
to satisfy a Python version you stopped caring about years ago.**

## The two declarations, side by side

```text
.python-version                    →  "use 3.14 here"          (a request)
pyproject.toml requires-python     →  "we support >=3.14"      (a constraint)
```

```toml
# pyproject.toml
[project]
name = "myapp"
requires-python = ">=3.14"
```

```text
# .python-version
3.14
```

> *"The `.python-version` file contains the project's default Python version. This file tells uv which
> Python version to use when creating the project's virtual environment."*
> — [working on projects](https://docs.astral.sh/uv/guides/projects/)

> *".python-version file can be used to create a default Python version request"*

> *"A `.python-version` file can be created in the current directory with the `uv python pin`
> command."*
> — both [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

Note the word uv uses: **request**. Against that:

> *"uv will respect Python requirements defined in `requires-python` in the `pyproject.toml` file
> during project command invocations"*
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

> `requires-python`: *"The Python version requirements of the project."*
> — [pyproject.toml specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

## 🔴 `requires-python` is an input to the resolver, and wider means stricter

> *"all required packages must be compatible with the entire range of `requires-python` declared in
> the `pyproject.toml`"*
> — [resolution](https://docs.astral.sh/uv/concepts/resolution/)

> *"The Python version requirement determines the Python syntax that is allowed in the project and
> affects selection of dependency versions"*
> — [configuring projects](https://docs.astral.sh/uv/concepts/projects/config/)

This is the counter-intuitive part and it is worth stating twice: **a wider `requires-python` is a
stronger constraint on your dependencies.** `>=3.9` means every locked package must work on 3.9 *and*
on 3.14, so any dependency whose current release has dropped 3.9 becomes ineligible and the resolver
falls back to an older release of it. No error, no warning — just old dependencies.

```toml
[project]
requires-python = ">=3.14"     # narrow: dependencies only need to support 3.14+
# requires-python = ">=3.9"    # wide: every dependency must ALSO still support 3.9
```

It also drives *forking* in the lockfile ([03](03-the-lockfile.md)): the wider the range, the more
likely uv must record two versions of a package under different markers because no single version
covers the whole span.

## Which one to change, when

| You want to… | Change | Because |
|---|---|---|
| develop against 3.14 today | `.python-version` | it is a request for this environment |
| stop supporting 3.12 | `requires-python` | it is your published support commitment |
| get newer releases of a dependency | `requires-python` (narrow it) | old Pythons are what is blocking them |
| test against several Pythons in CI | neither — pass `--python` per job | the files describe the project, not a matrix |
| let a colleague on 3.13 work | reconsider `requires-python` | if 3.13 is supported, say so; do not just widen the pin |

```bash
uv python pin 3.14              # writes .python-version
uv run --python 3.13 pytest     # one invocation on a different interpreter
```

⚠️ **What I could not confirm:** the documentation I checked does not state what uv does when
`.python-version` requests a version *outside* `requires-python` — whether it errors, ignores the
request, or narrows it. Do not guess. Keep them consistent, and if you need to know the behaviour for
a specific uv version, test it on the machine in front of you and read the message uv prints.

## Both files are committed, and both are easy to lose

`.python-version` is created by `uv init` ([01b](01b-the-project-uv-sees.md)) and belongs in version
control — it is how a colleague's fresh clone gets the interpreter you tested on. The way it gets
lost is a `.gitignore` inherited from a pyenv-era template that ignores it by habit:

```bash
git check-ignore -v .python-version     # prints the rule hiding it, if any
git add .python-version
```

Two things follow from all this over time rather than at one moment — moving a managed interpreter to
a newer patch release, and testing several Python versions in one CI pipeline. Both are
[05c](05c-interpreter-upgrades-and-ci-matrices.md).

## Gotchas

**★ Symptom: after widening `requires-python` to support older Pythons, several dependencies dropped to ancient versions.**
Cause: the documented rule — *"all required packages must be compatible with the entire range of
`requires-python`"* — so the newest release of anything that dropped that old Python is now
ineligible. Fix: narrow the declaration to your real support commitment and re-lock.

```toml
[project]
requires-python = ">=3.13"
```

```bash
uv lock
```

**★ Symptom: a colleague's clone uses a different Python than yours.**
Cause: `.python-version` is not committed, so their environment was created from whatever uv found.
Fix: commit it, after checking nothing is ignoring it.

```bash
git check-ignore -v .python-version
uv python pin 3.14 && git add .python-version
```

**★ Symptom: you bumped `.python-version` and the lockfile did not change.**
Cause: correct behaviour — `.python-version` is a request for an interpreter, not a resolution input.
The resolution is shaped by `requires-python`. Fix: if you meant to change what the project supports,
change the constraint.

```toml
[project]
requires-python = ">=3.14"
```

**★ Symptom: you narrowed `requires-python` and nothing improved.**
Cause: the lockfile still holds the old resolution; narrowing the constraint does not re-resolve by
itself. Fix: re-lock so the new constraint is applied.

```bash
uv lock --upgrade
```

**★ Symptom: `.python-version` says `3.14` and `uv python find` reports something else.**
Cause: something is overriding the request — `UV_PYTHON`, an explicit `--python`, or a
`.python-version` in a parent directory. Fix: audit the overrides rather than editing the file again.

```bash
env | grep '^UV_PYTHON'
uv python find
```

**★ Symptom: you pinned an exact patch version and CI cannot find it.**
Cause: pinning `3.14.7` is a narrower request than `3.14`, and a runner that has 3.14.6 does not
satisfy it — so uv must download, or fail if downloads are disabled
([05](05-uv-python.md)). Fix: pin the minor version unless you have a specific reason to pin the
patch.

```bash
uv python pin 3.14
```

## Interview questions

**★ What is the difference between `.python-version` and `requires-python`?**
`.python-version` is a *request*: uv's docs describe it as containing *"the project's default Python
version"* and say it *"tells uv which Python version to use when creating the project's virtual
environment"* — a per-checkout choice of interpreter. `requires-python` is a *constraint*, described
by the packaging specification as *"the Python version requirements of the project"*, and uv treats it
as an input to resolution: *"all required packages must be compatible with the entire range of
`requires-python`."* So one decides which interpreter runs your code here; the other decides which
releases of every dependency are eligible, everywhere. They are both committed, they should be
consistent, and they answer different questions — which is why changing one and expecting the other's
effect is the standard confusion.

**★ Why does widening `requires-python` make your dependency situation worse rather than better?**
Because it constrains your dependencies, not you. uv's rule is that *"all required packages must be
compatible with the entire range of `requires-python`"*, so declaring `>=3.9` means every locked
package must work on 3.9 as well as on 3.14. Any dependency whose current release has dropped 3.9
becomes ineligible, and the resolver silently falls back to an older release of it — you end up on old
libraries in order to support a Python nobody is running. It also increases forking in the lockfile,
because a wider span makes it more likely that no single version of a package covers the whole range.
The discipline is that `requires-python` should state your actual support commitment exactly:
generosity here is paid for in dependency versions, invisibly.

**★ A colleague changes `.python-version` from `3.13` to `3.14` and is surprised the lockfile is unchanged. What do you tell them?**
That the lockfile is not a function of `.python-version`. The lockfile is a universal resolution
constrained by `requires-python`, which describes the *span* of Python versions the project supports —
so as long as that span is unchanged, the set of eligible dependency releases is unchanged too, and
there is nothing to re-resolve. `.python-version` only decides which interpreter uv uses to build the
environment here. If they intended to stop supporting 3.13, the change belongs in `requires-python`,
and then `uv lock` will produce a different (usually better) resolution because fewer old Pythons must
be accommodated.

**Should you pin an exact patch version in `.python-version`?**
Usually not. Pinning `3.14` says "any 3.14", which every machine with a 3.14 satisfies; pinning
`3.14.7` says "exactly this build", which means a runner holding 3.14.6 must download one — or fail
outright if `UV_PYTHON_DOWNLOADS=never`. Since patch releases of CPython are security and bug fixes, the
usual goal is to be *on the latest* rather than *held at a specific one*, which is precisely what a
minor-version pin plus `uv python upgrade` gives you. Pinning the patch is justified when you are
chasing an interpreter-level bug, or when a compliance process requires that the exact interpreter
build be recorded — and in that case it belongs alongside a note explaining why, because the next
person will otherwise widen it.

---

← Prev: [05 · uv python](05-uv-python.md) · [Topic index](README.md) · Next → [05c · Upgrades and CI matrices](05c-interpreter-upgrades-and-ci-matrices.md)
