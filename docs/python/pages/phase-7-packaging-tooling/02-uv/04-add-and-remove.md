---
title: "`uv add` is not `pip install` — it edits `pyproject.toml`, re-resolves the lockfile and syncs the environment in one command, and the lower bound it writes for you is a decision you are implicitly accepting"
sidebar_label: "04 · uv add and uv remove"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Managing dependencies*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/)), *Locking and
> syncing* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Configuring
> projects* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)), the
> `pyproject.toml` specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/))
> and PEP 735 ([peps.python.org](https://peps.python.org/pep-0735/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`pip install requests` changes one thing: the environment. `uv add requests` changes three —
`pyproject.toml` gains a requirement, `uv.lock` gains a resolution, and the environment gains the
package — and it is the first of those that matters most, because uv writes a version constraint on
your behalf. It writes a *lower* bound and no upper bound, which is almost always right and is still
a decision you are accepting silently. The rest of this chunk is about the four places a dependency
can go — a runtime requirement, a dependency group, an extra, or a source override — and about the
distinction between groups and extras, which is the one people get wrong because for a decade the
only mechanism available was to abuse extras.**

## What `uv add` does, and to what

> *"To add a dependency: `$ uv add httpx` An entry will be added in the `project.dependencies` field"*
> — [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)

Because locking and syncing are automatic ([01](01-what-uv-is.md)), a single `uv add` performs the
whole cycle:

1. edits `pyproject.toml`;
2. re-resolves and writes `uv.lock`;
3. syncs the environment.

Which means **`uv add` is the only dependency command whose result is reviewable**, and it is the
reason `uv pip install` inside a project is a mistake ([06e](06e-uv-pip-install-sync-and-compile.md)): the latter does step 3
and nothing else, leaving no record of the decision anywhere.

```bash
uv add httpx
git add pyproject.toml uv.lock        # both files, always, in the same commit
```

## 🔴 The bound uv writes for you

> *"The dependency will include a constraint, e.g., `>=0.27.2`, for the most recent, compatible
> version of the package."*

> *"The kind of bound can be adjusted with `--bounds`, or the constraint can be provided directly"*
> — both [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)

So the default is a **lower bound at the version resolved today, and no upper bound**. Two things
follow:

- **Your application is protected by the lockfile, not by the range.** `>=0.27.2` permits `1.0`, and
  the only reason you are not running `1.0` is that `uv.lock` pins what you resolved. That is fine —
  it is the whole argument for committing the lock ([03](03-the-lockfile.md)).
- **Your library is protected by nothing.** A consumer resolving `>=0.27.2` may get any future
  release, including a breaking one. Whether to add an upper bound is genuinely contested and is topic
  **03 · Dependencies done right** *(not written yet)*'s argument; what matters here is that uv makes
  the permissive choice for you unless you speak up.

```bash
uv add 'httpx>=0.27,<1'      # state the constraint yourself
uv add httpx --bounds exact  # or ask uv for a different bound style
```

## The four places a dependency can go

```toml
[project]
name = "myapp"
requires-python = ">=3.14"
dependencies = [                   # 1 · runtime requirements — consumers get these
  "httpx>=0.27.2",
]

[project.optional-dependencies]
postgres = ["psycopg[binary]>=3.2"]   # 2 · an extra — consumers opt in: myapp[postgres]

[dependency-groups]
dev = ["pytest>=8.4"]                 # 3 · a group (PEP 735) — consumers never see it
docs = ["mkdocs>=1.6"]
lint = ["ruff>=0.16.6"]

[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }   # 4 · where to GET it — uv only
```

The commands that write each:

| Target | Command | uv's wording |
|---|---|---|
| `project.dependencies` | `uv add httpx` | *"An entry will be added in the `project.dependencies` field"* |
| dependency group `dev` | `uv add --dev pytest` | *"uv uses the `[dependency-groups]` table (as defined in PEP 735) for declaration of development dependencies"* |
| another group | `uv add --group docs mkdocs` | *"Development dependencies can be divided into multiple groups, using the `--group` flag"* |
| an extra | `uv add httpx --optional network` | *"To add an optional dependency, use the `--optional <extra>` option: `$ uv add httpx --optional network`"* |
| a source override | `uv add --editable ./path/foo` | *"When adding a dependency from a source other than a package registry, uv will add an entry in the sources field"* |

**Groups versus extras** is the distinction people get wrong, and it is not a uv invention: extras
are declared in `[project.optional-dependencies]` and are *part of your published metadata*, so a
consumer can write `pip install myapp[postgres]`. Groups are `[dependency-groups]` from PEP 735, and
they exist precisely so that development requirements stop being smuggled in as fake extras. A
consumer cannot install a group. The rule of thumb: **if a user could plausibly want it, it is an
extra; if only a contributor wants it, it is a group.**

A dependency can also carry a *source override* — a git URL, a local path, an editable checkout —
recorded under `[tool.uv.sources]`. That table has a trap in it serious enough to be its own chunk:
[04b](04b-tool-uv-sources.md).

## `uv remove` cleans up after itself

> *"To remove a dependency: `$ uv remove httpx` The `--dev`, `--group`, or `--optional` flags can be
> used to remove a dependency from a specific table. If a source is defined for the removed
> dependency, and there are no other references to the dependency, it will also be removed."*
> — [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)

Note the last clause: removing the requirement also removes its `[tool.uv.sources]` entry, but only
when nothing else refers to it. And because removal re-locks and re-syncs, the package leaves the
environment too — exact syncing ([02c](02c-uv-sync-makes-the-environment-match.md)) means an
undeclared package does not linger.

```bash
uv remove httpx                 # from project.dependencies
uv remove --dev pytest          # from the dev group
uv remove --group docs mkdocs   # from a named group
uv remove --optional network httpx
```

## Gotchas

**★ Symptom: a dependency works on your machine and CI cannot find it.**
Cause: you installed it with `uv pip install`, which records nothing. Fix: declare it, and commit both
files uv touched.

```bash
uv add httpx
git add pyproject.toml uv.lock
```

**★ Symptom: `uv remove` left the package installed.**
Cause: almost always that it was never declared — you are removing something that is not in
`pyproject.toml`, so there is nothing to remove and the environment still holds a stray. Fix: converge
the environment with an exact sync, which removes what is not in the lockfile.

```bash
uv sync            # exact by default: removes undeclared packages
```

**★ Symptom: your library's consumers hit a breaking change in a dependency and blame you.**
Cause: uv wrote `>=` with no upper bound and you accepted it. Fix: state the constraint you actually
mean when you add it.

```bash
uv add 'httpx>=0.27,<1'
```

**★ Symptom: `pip install myapp[dev]` fails for a consumer, though `dev` clearly exists in your `pyproject.toml`.**
Cause: `dev` is a dependency *group*, not an extra. Groups are PEP 735 declarations for contributors
and are not installable by consumers. Fix: if a consumer genuinely needs it, it is an extra.

```bash
uv add --optional cli 'typer>=0.15'    # consumers: pip install myapp[cli]
uv add --group dev pytest              # contributors only
```

**★ Symptom: dev tooling ended up in the runtime dependency list.**
Cause: `uv add pytest` with no flag writes to `project.dependencies`, and it is one forgotten flag
away. Fix: move it, in two commands.

```bash
uv remove pytest
uv add --dev pytest
```

**★ Symptom: `uv add` fails with a resolution error naming `requires-python`.**
Cause: the package does not support the whole range you declared — *"all required packages must be
compatible with the entire range of `requires-python`"*
([resolution](https://docs.astral.sh/uv/concepts/resolution/)). Fix: narrow your support commitment,
or accept an older release of that package.

```toml
[project]
requires-python = ">=3.13"     # was >=3.9; that was the constraint doing the blocking
```

**★ Symptom: `uv add` produced a lockfile diff touching packages you did not mention.**
Cause: adding a requirement can shift the transitive tree around it — that *is* the change. Fix:
nothing to undo, but keep it reviewable by committing dependency changes on their own.

```bash
uv add httpx && git commit -m "deps: add httpx" pyproject.toml uv.lock
```

**★ Symptom: after `uv add`, `import my_package` still fails for your own code.**
Cause: unrelated to the add — no `[build-system]`, so uv installs *"just its dependencies"*
([01b](01b-the-project-uv-sees.md)). Fix: declare a build system.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**★ Symptom: `uv add` in CI modified `pyproject.toml` and the job passed.**
Cause: `uv add` is a *write* command; nothing about CI stops it. Fix: CI should never add
dependencies. If a job needs an extra package for one invocation, use `uv run --with`
([04c](04c-uv-run.md)), which changes no file.

```bash
uv run --with pytest-xdist pytest -n auto
```

## Interview questions

**★ What are the three things `uv add` changes, and why does that make it different in kind from `pip install`?**
It edits `pyproject.toml` (adding a requirement to `project.dependencies`, a group, or an extra),
re-resolves and rewrites `uv.lock`, and installs into the environment — because *"locking and syncing
are automatic in uv."* `pip install` does only the last one. The difference in kind is that `uv add`
leaves a **reviewable record of a decision** in two committed files, while `pip install` leaves state
on one machine. That is why "it works locally" survives as a phrase in pip workflows and stops being
possible in a uv project: an undeclared package is not merely undocumented, it is actively removed by
the next exact sync.

**★ uv writes `>=0.27.2` when you add a package. What are you accepting?**
That there is no upper bound. uv documents the behaviour — *"The dependency will include a
constraint, e.g., `>=0.27.2`, for the most recent, compatible version of the package"* — and offers
`--bounds` or a constraint written by hand. For an application it is the right default, because the
lockfile is what actually pins your versions and the range only needs to record the minimum you
depend on. For a library it is a published promise that every future release of that dependency will
work with your code, which nobody can honour. So the answer differs by artefact type, and the thing
to notice is that uv makes the permissive choice silently: if you never look at the diff, you never
made a decision.

**★ Explain groups versus extras to someone who has always used `extras_require["dev"]`.**
Extras live in `[project.optional-dependencies]` and are part of your *published* metadata: a
consumer can write `pip install myapp[postgres]`, and the extra's requirements become their problem
to resolve. Dependency groups live in `[dependency-groups]`, standardised by PEP 735, and are
**not** published — a consumer cannot install one. The historical `extras_require["dev"]` pattern was
an abuse of extras precisely because no other mechanism existed: it exposed your test dependencies as
an installable feature of your package and put them in your published metadata. Groups fixed that.
uv's flags mirror the distinction directly: `--optional <extra>` writes an extra, `--dev` and
`--group <name>` write groups, and uv notes that it *"uses the `[dependency-groups]` table (as defined
in PEP 735) for declaration of development dependencies."*

**★ A teammate wants to add a package for one CI step. What should they do, and what should they not do?**
They should use `uv run --with <package> <command>`, which makes the requirement available for that
one invocation and changes no file — uv describes `--with` as being *"used to include a dependency for
the invocation"*. What they should not do is `uv add` in CI: it is a write command, it will happily
modify `pyproject.toml` and `uv.lock` inside a job, and the change either evaporates with the runner
(so the job tested something not in the repository) or gets committed by an automation nobody
reviewed. The general principle: CI reads the declared state and never authors it.

**Why does `uv remove` also delete a `[tool.uv.sources]` entry, and why only sometimes?**
Because the source entry is not a dependency, it is a *routing rule* for a dependency — it says where
to get `my-lib` from. Once nothing requires `my-lib`, the rule is dead configuration, and uv cleans it
up: *"If a source is defined for the removed dependency, and there are no other references to the
dependency, it will also be removed."* The "no other references" condition matters because the same
package can be required from more than one place — `project.dependencies` and a group, say — and the
routing rule is still live for the remaining one. It is the same reasoning as not deleting a shared
configuration block when one of its two consumers goes away.

---

← Prev: [03c · Exporting the lockfile](03c-exporting-the-lockfile.md) · [Topic index](README.md) · Next → [04b · tool.uv.sources](04b-tool-uv-sources.md)
