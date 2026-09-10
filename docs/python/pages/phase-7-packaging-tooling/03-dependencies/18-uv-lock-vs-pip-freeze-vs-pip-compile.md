---
title: "`pip freeze` records what happens to be installed, `pip-compile` records what one environment resolves to, and `uv.lock` records what every environment resolves to — three different artifacts that all get called a lockfile"
sidebar_label: "18 · uv.lock vs freeze vs compile"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against pip's **pip freeze** and **pip lock** references and its **Repeatable
> Installs** topic ([pip.pypa.io](https://pip.pypa.io/en/stable/cli/pip_freeze/), pip docs v26.2.1),
> the **pip-tools** documentation ([pip-tools.readthedocs.io](https://pip-tools.readthedocs.io/en/stable/),
> 7.6.1), uv's **Resolution** concepts and **CLI reference**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**), uv's **Project
> structure and files** ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)) and
> **PEP 751** ([peps.python.org](https://peps.python.org/pep-0751/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**Three commands produce a file of exact versions, and teams treat the three files as interchangeable. They
are not. `pip freeze` performs no resolution at all — it lists whatever is in the environment, including
the package you installed by hand last Tuesday. `pip-compile` (and `uv pip compile`) resolves your declared
inputs, but for exactly one environment: the Python version and platform it ran on. `uv.lock` resolves once
for every platform and Python version your project claims, and records the markers that select between
them. Choosing between them is choosing how much of the resolver's work you want to keep, and knowing which
one you are holding is the difference between a deployment that reproduces and one that merely looks
pinned.**

## Side by side

| | `pip freeze` | `pip-compile` / `uv pip compile` | `uv.lock` |
|---|---|---|---|
| Input | the installed environment | declared requirements (`requirements.in`, `pyproject.toml`) | `pyproject.toml` (+ workspace) |
| Runs a resolver | **no** | yes | yes |
| Environments covered | the one it ran in | the one it ran in (unless `--universal`) | every marker combination in `requires-python` × platforms |
| Records why a package is there | no | yes — `# via` annotations | yes — the dependency graph |
| Extras and groups | whatever happened to be installed | one file per combination | all, in one file |
| Hashes | no | opt-in (`--generate-hashes`) | exports carry them by default |
| Readable by | pip, and anything that reads requirements files | same | uv only (export for others) |

PEP 751's own summary of the landscape, from the motivation for standardising:

> *"Those tools also vary in what locking scenarios they support. For instance, `pip freeze` and pip-tools
> only generate single-use lock files for the current environment while PDM, Poetry, and uv can/try to lock
> for multiple environments and use-cases at once."*

## `pip freeze` — a snapshot, not a solve

> *"Output installed packages in requirements format."*

🔴 And the sentence that settles the argument, from pip's own reference:

> *"pip freeze reports what is installed; it does not compute a lockfile or a solver result."*

Everything wrong with using it as a lock follows from that. It records the environment's *accidents* as
well as its intentions: a debugging tool installed ad hoc, a package left behind after a dependency was
removed, your own project installed editable. It records nothing about which entries were top-level, so the
file cannot be regenerated from intent — only re-snapshotted. And it drops what pip considers bootstrap
tooling, differently by Python version:

> *"By default, pip freeze omits bootstrap packaging tools so the output focuses on your project's
> dependencies. On Python 3.11 and earlier this excludes pip, setuptools, wheel and distribute; on Python
> 3.12 and later only pip is excluded. Use `--all` to include those packages when you need a complete
> environment snapshot."*

pip's own documentation presents a frozen file as the *first*, weakest rung of repeatability, with one
piece of insurance attached:

> *"A requirements file, containing pinned package versions can be generated using `pip freeze`. This would
> pin not only the top-level packages, but also all of their transitive dependencies. Performing the
> installation using `--no-deps` would provide an extra dose of insurance against installing anything not
> explicitly listed."*

```bash
python -m pip install --no-deps -r requirements.txt   # install exactly the list, nothing it implies
python -m pip check                                   # then verify the list was actually complete
```

## `pip-compile` and `uv pip compile` — a resolve, for one environment

pip-tools describes itself as *"A set of command line tools to help you keep your `pip`-based packages
fresh, even when you've pinned them."* The model is two files: a hand-written input of intent and a
generated output of exact versions.

```text
# requirements.in — intent, hand-written
httpx>=0.27
sqlalchemy>=2.0
```

```bash
pip-compile requirements.in -o requirements.txt        # pip-tools
uv pip compile requirements.in -o requirements.txt     # uv's pip-compatible interface
pip-sync requirements.txt                               # make the environment match exactly
```

The output carries `# via` annotations naming which input pulled each package in — the provenance
`pip freeze` cannot give you. The limit is the environment. pip-tools warns that *"the resulting
`requirements.txt` can differ for each environment"* and advises running pip-compile *"on each Python
environment separately"*; uv's documentation says the same of its pip interface:

> *"By default, uv's pip interface, i.e., `uv pip compile`, produces a resolution that is platform-specific,
> like pip-tools. There is no way to use platform-specific resolution in the uv's project interface."*

and explains why markers vanish from the output:

> *"By default, uv strips environment markers, as the resolution generated by compile is only guaranteed to
> be correct for the target environment."*

Two ways out, both documented. Resolve for a *different* target explicitly — *"during platform-specific
resolution, the provided --python-version is the exact python version to use, not a lower bound"* — or ask
for a universal resolution:

```bash
uv pip compile requirements.in --python-platform linux --python-version 3.14 -o requirements.linux.txt
uv pip compile requirements.in --universal -o requirements.txt
```

`--universal` *"Perform[s] a universal resolution, attempting to generate a single requirements.txt output
file that is compatible with all operating systems, architectures, and Python implementations"*, and in that
mode *"the current Python version (or user-provided --python-version) will be treated as a lower bound."*

An existing output file is an input too: *"If the file already exists, the existing versions will be
preferred when resolving dependencies, unless --upgrade is also specified."* That is what makes a compiled
file behave like a lock across re-runs rather than a fresh snapshot each time.

## `pip lock` — the standard format, still one environment

pip 26.2.1 documents an **experimental** `pip lock` command that writes PEP 751 `pylock.toml` (default
name `pylock.toml`, `-o -` for stdout), with the same boundary as the other pip-side tools:

> *"The generated lock file is only guaranteed to be valid for the current python version and platform."*

`pip install -r` accepts the result — *"The file or URL can be in pip's requirements.txt format, or
pylock.toml format. pylock.toml support is experimental."* Standard format, single-use scope: it solves the
portability gap from [17c](17c-the-lock-is-not-the-environment.md), not the multi-environment one.

## `uv.lock` — one resolution, every environment

> *"`uv.lock` is a universal or cross-platform lockfile that captures the packages that would be installed
> across all possible Python markers such as operating system, architecture, and Python version."*

> *"uv's lockfile (`uv.lock`) is created with a universal resolution and is portable across platforms. This
> ensures that dependencies are locked for everyone working on the project, regardless of operating system,
> architecture, and Python version."*

It is multi-use as well — extras and every dependency group resolved together, so the test toolchain's
transitive dependencies cannot disagree with production's. The price is that it is uv's format alone
(*"specific to uv and not usable by other tools"*) and that a universal resolution *"is often more
constrained than a platform-specific resolution"*, so it can fail where a single-platform compile succeeds
([12](12-markers-special-fields-and-portability.md)).

## Migrating a compiled project to `uv.lock` without moving a single version

The input file becomes the declaration; the old output becomes a one-off constraint so the first lock
reproduces what production already runs:

```bash
uv init --bare                                    # a pyproject.toml, nothing else
uv add -r requirements.in -c requirements.txt     # declare intent, resolve within today's pins
uv lock --check                                   # from now on, CI asserts this file
```

uv documents that constraints passed to `uv add` *"will not be added to the project's pyproject.toml file,
but will be respected during dependency resolution"* — so the ranges land in `pyproject.toml` and the exact
versions land in the lock, which is the split [13](13-applications-lock-libraries-range.md) argues for.

## Gotchas

**★ Symptom: a frozen `requirements.txt` fails on every machine but the author's with a path that does not
exist.** Cause: the author's own project was installed editable, and `pip freeze` recorded it as a local
reference. Fix: never lock from a live environment; if you must, exclude editables and compile instead:

```bash
python -m pip freeze --exclude-editable > requirements.txt   # the stopgap
uv pip compile requirements.in -o requirements.txt           # the fix
```

**★ Symptom: production gains a dependency nobody declared — a profiler, a REPL, an old library.** Cause: it
was installed by hand into the environment that was frozen, and *"pip freeze reports what is installed"*.
Fix: generate the file from declared inputs, so only intent can enter it:

```bash
uv pip compile requirements.in -o requirements.txt
```

**★ Symptom: an application that imports `pkg_resources` works in CI and fails in a fresh Python 3.14
container built from a frozen file.** Cause: the file was frozen on Python 3.11, where freeze *"excludes pip,
setuptools, wheel and distribute"*, so `setuptools` was silently dropped; newer `venv`s do not pre-install it.
Fix: declare what you import, or freeze everything:

```text
# requirements.in
setuptools>=75      # imported at runtime via pkg_resources — declare it
```

**★ Symptom: a `requirements.txt` compiled on a Mac fails to install in the Linux container.** Cause:
platform-specific resolution — markers were evaluated for macOS and *"strip[ped]"*, so Linux-only branches
are simply absent. Fix: compile for the target, or universally:

```bash
uv pip compile requirements.in --python-platform linux --python-version 3.14 -o requirements.txt
```

**Symptom: the compiled file installs on Python 3.14 in CI and fails on the 3.12 production host with a
`Requires-Python` refusal.** Cause: the resolver chose the newest versions compatible with the interpreter
it ran on. Fix: tell it the interpreter you deploy — *"the provided --python-version is the exact python
version to use"*:

```bash
uv pip compile requirements.in --python-version 3.12 -o requirements.txt
```

**★ Symptom: `uv.lock` and a checked-in `requirements.txt` disagree about a version.** Cause: two locks, one
of them maintained by hand or by a different tool. Fix: make the requirements file a *build product* of the
lock and fail CI if it drifts:

```bash
uv export --locked --format requirements.txt -o requirements.txt
git diff --exit-code requirements.txt
```

**Symptom: someone bumps one line in a compiled `requirements.txt` by hand, and the next compile reverts
it.** Cause: the output is generated from the input plus preferences; a hand edit is neither. Fix: move the
version through the tool:

```bash
uv pip compile requirements.in --upgrade-package httpx -o requirements.txt
pip-compile --upgrade-package httpx requirements.in        # pip-tools spelling
```

**Symptom: a compiled file used as `-c constraints.txt` is rejected.** Cause: it was generated with extras
kept — *"output files generated with --no-strip-extras cannot be used as constraints files in install and
sync invocations."* Fix: compile the constraints file with the default, which strips extras:

```bash
uv pip compile requirements.in -o constraints.txt
```

**Symptom: a `pylock.toml` produced by `pip lock` on a developer laptop installs the wrong wheels in
production.** Cause: *"The generated lock file is only guaranteed to be valid for the current python
version and platform."* Fix: generate one per target, using the names PEP 751 reserves for multiple locks
(`pylock.<name>.toml`), or export from a universal lock:

```bash
uv export --locked --format pylock.toml -o pylock.toml
```

## Interview questions

**★ Is `pip freeze` a lockfile?**
No, and pip's own reference says so: *"pip freeze reports what is installed; it does not compute a lockfile
or a solver result."* A lockfile is the output of a resolution over declared inputs; a freeze is a snapshot of
an environment, accidents included. It cannot tell you why any line is present, it cannot be regenerated from
intent, it drops bootstrap tools differently on different Python versions, and it is valid only for the
platform it ran on. It is useful as the first rung of repeatability — pip's docs pair it with `--no-deps` as
*"an extra dose of insurance"* — but a compiled file or a real lock is the thing to deploy from.

**★ Why can a `requirements.txt` compiled on macOS fail in a Linux container?**
Because compilation is platform-specific by default. The resolver evaluated every marker for the machine it
ran on and emitted only the matching branches — uv strips markers *"as the resolution generated by compile is
only guaranteed to be correct for the target environment."* A dependency gated on `sys_platform == 'linux'`
was never resolved; one gated on Darwin was. The fix is to resolve for the target (`--python-platform linux
--python-version 3.14`), to compile inside the target image, or to resolve universally with `--universal`
or `uv.lock`.

**★ When would you still choose a compiled `requirements.txt` over `uv.lock`?**
When the consumer is not uv. A base image, a platform buildpack, a legacy deployment script or an audit tool
may only read requirements files, and `uv.lock` is *"specific to uv and not usable by other tools."* Even then
the better shape is usually to keep `uv.lock` as the source of truth and *export* the requirements file from
it in CI, so there is one resolution and one derived artifact rather than two independent locks. A compiled
file as the *only* lock remains reasonable for a single-platform deployment that never runs anywhere else.

**What does the `# via` annotation give you that `pip freeze` cannot?**
Provenance. Each pinned package names the input that pulled it in, so you can answer "why is this here?" and
"what breaks if I remove that?" from the file alone, and a reviewer can see that a lock diff moved a package
because of a specific upgrade. A frozen file is a flat list with no graph, so removing a top-level dependency
leaves its whole subtree behind as orphans that nobody knows are safe to delete.

**How would you move a pip-tools project to uv without changing any deployed version?**
Declare intent from the old input and constrain the first resolution with the old output:
`uv add -r requirements.in -c requirements.txt`. uv adds the requirements to `pyproject.toml` and uses the
compiled file as constraints that *"will not be added to the project's pyproject.toml file, but will be
respected during dependency resolution"*, so the new lock reproduces what production runs. Then commit the
lock, switch CI to `uv sync --locked`, and if anything downstream still needs a requirements file, generate it
with `uv export --locked`.

---

← [17c · The lock is not the environment](17c-the-lock-is-not-the-environment.md) · [Topic index](README.md) · Next → [19 · Hashes and hash-checking mode](19-hashes-and-hash-checking-mode.md)
