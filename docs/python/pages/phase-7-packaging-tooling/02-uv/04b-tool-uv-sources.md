---
title: "`[tool.uv.sources]` separates *what* you depend on from *where* uv gets it — and because the packaging specification defines `[tool]` as tool-scoped, the second half never reaches anyone who installs your package"
sidebar_label: "04b · tool.uv.sources"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Managing dependencies*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/)), *Project structure
> and files* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), *Locking and
> syncing* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)) and the
> `pyproject.toml` specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Two questions look like one and are not. *What do I depend on?* is answered by
`[project.dependencies]`, is standard packaging metadata, and travels inside your built wheel to
every consumer. *Where should uv fetch it from?* is answered by `[tool.uv.sources]`, and by
specification it travels nowhere at all — the `[tool]` table is defined as configuration a named
tool reads, so a git URL or local path you record there is an instruction to uv and invisible to
pip, to your users, and to any other resolver. Keeping those two answers straight is the difference
between a local development convenience and a library whose published requirement has never once
been resolved the way its users will resolve it.**

## What uv writes, and when

> *"When adding a dependency from a source other than a package registry, uv will add an entry in
> the sources field."*
> — [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)

So `uv add` writes **two** entries whenever the source is not an index: the requirement in
`[project.dependencies]`, and the routing rule in `[tool.uv.sources]`.

> `[tool.uv.sources]` example: `httpx = { git = "https://github.com/encode/httpx" }`

> *"To add a path source, provide the path of a wheel (ending in `.whl`), a source distribution... or
> a directory containing a `pyproject.toml`."*

> *"To add an editable dependency, use the `--editable` flag: `$ uv add --editable ./path/foo`"*
> — all [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)

```toml
[project]
name = "myapp"
dependencies = [
  "my-lib>=1.4",            # ← what a consumer sees and resolves
  "httpx>=0.27.2",
]

[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }        # ← uv-only routing
httpx  = { git = "https://github.com/encode/httpx" }    # ← uv-only routing
```

Read the two tables aloud and the design is obvious: *"this project requires my-lib 1.4 or newer"*
is a fact about the project; *"and while developing, get it from the sibling directory"* is a fact
about your machine.

## 🔴 Why the second table stops at your repository

> *"The `[tool]` table is where any tool related to your Python project, not just build tools, can
> have users specify configuration data as long as they use a sub-table within `[tool]`"*

> *"A project can use the subtable `tool.$NAME` if, and only if, they own the entry for `$NAME` in
> the Cheeseshop/PyPI."*
> — both [pyproject.toml specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

`[tool]` is a namespace for tool configuration, by definition. Nothing in the packaging standards
asks an installer to look inside another tool's sub-table, and no installer does. The consequence
is precise:

| Who is resolving | Reads `[project.dependencies]` | Reads `[tool.uv.sources]` |
|---|---|---|
| you, with uv, in this repository | ✅ | ✅ |
| your CI, with uv, in this repository | ✅ | ✅ |
| a consumer running `pip install myapp` | ✅ | ❌ |
| a consumer running `uv add myapp` | ✅ | ❌ — it is *your* `[tool.uv]`, not theirs |

That last row surprises people: sources are not transitive. A source override applies to the
project that declares it, not to anything that depends on that project. If it were otherwise, every
package on PyPI could redirect your dependency fetches, which would be a supply-chain catastrophe
rather than a feature.

## The safe pattern, and the unsafe one

```toml
# ✅ Safe — the requirement stands on its own; the source is a development convenience
[project]
dependencies = ["my-lib>=1.4"]

[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }
```

```toml
# ⚠️ Unsafe for anything you publish — the requirement is meaningless without the source
[project]
dependencies = ["my-lib"]          # no version at all; only the git pin made this work

[tool.uv.sources]
my-lib = { git = "https://github.com/acme/my-lib", rev = "3f1c9ad" }
```

In the second case your consumers get `my-lib` — *any* `my-lib` on PyPI, including one that has
nothing to do with yours if the name is squatted. The test to apply before publishing: **delete
`[tool.uv.sources]` mentally and ask whether `[project.dependencies]` still describes something a
stranger could install correctly.** For an application, the answer is allowed to be "no" as long as
`uv.lock` is committed, because your deployment is you. For a library it must be "yes".

## Sources and the lockfile

The lockfile records the resolution, so a git source resolves to a concrete commit and a path source
records the path. Two consequences:

- **A git source without a pinned revision is a moving target for everyone but you.** Your lockfile
  holds the commit that was resolved; a colleague who re-locks may get a different one, and the diff
  is the only place that shows it.
- **A path source makes the lockfile machine-shaped.** A relative path is fine and portable within a
  monorepo checkout; an absolute path is not, and it will break for everyone else.

```toml
[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }        # ✅ relative — works for the whole team
# my-lib = { path = "/Users/me/code/my-lib" }           # ⛔ absolute — works for exactly one person
```

For local development against a sibling library, `editable = true` is what makes the loop tight:
your changes in `../my-lib` are live in this project's environment without re-installing, which is
the same editable mechanism uv uses for your own project
([02c](02c-uv-sync-makes-the-environment-match.md)).

## Removal cleans the routing rule up

> *"If a source is defined for the removed dependency, and there are no other references to the
> dependency, it will also be removed."*
> — [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)

The "no other references" condition matters: the same package can be required from
`project.dependencies` *and* a group, and the routing rule is still live for whichever remains.

```bash
uv remove my-lib               # drops the requirement AND the source, if nothing else needs it
uv remove --group dev my-lib   # only from that group; the source survives if the runtime dep does
```

## Gotchas

**★ Symptom: a git or path dependency works for the whole team and fails for anyone installing your published wheel.**
Cause: `[tool.uv.sources]` is uv-specific configuration under the specification's tool-scoped
`[tool]` table; it is not part of your published metadata. Fix: make the requirement in
`[project.dependencies]` resolvable from an index on its own, and keep the source as a
development-only override.

```toml
[project]
dependencies = ["my-lib>=1.4"]

[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }
```

**★ Symptom: a colleague clones the repo and `uv sync` fails on a path that does not exist.**
Cause: an absolute path in `[tool.uv.sources]`, or a relative path that assumes a particular checkout
layout. Fix: use a relative path and document the expected layout — or make it a workspace, which is
what workspaces are for.

```toml
[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }
```

**★ Symptom: two developers resolve different commits of the same git dependency.**
Cause: the source names a branch (or nothing), so "latest" moves. The lockfile pins whatever was
resolved, so the divergence only appears when someone re-locks. Fix: pin the revision in the source,
so a re-lock is deterministic.

```toml
[tool.uv.sources]
my-lib = { git = "https://github.com/acme/my-lib", rev = "3f1c9ad" }
```

**★ Symptom: you removed a dependency and its `[tool.uv.sources]` entry is still there.**
Cause: something else still references the package — a dependency group, or an extra. uv only removes
the source when *"there are no other references to the dependency."* Fix: find the other reference.

```bash
grep -n 'my-lib' pyproject.toml
```

**★ Symptom: you published a package whose `[project.dependencies]` has no version constraint, because the git pin was doing the work.**
Cause: `uv add` from a git source still writes a requirement, and if you edited it down to a bare
name the constraint disappeared while everything kept working locally. Fix: state a real constraint;
the source is not part of the contract.

```toml
[project]
dependencies = ["my-lib>=1.4,<2"]
```

**★ Symptom: you expected a dependency's own `[tool.uv.sources]` to apply to your project.**
Cause: sources are not transitive — they configure the project that declares them. Fix: if you need
the override, declare it in *your* `pyproject.toml`.

```toml
[tool.uv.sources]
transitive-thing = { git = "https://github.com/acme/transitive-thing", rev = "a1b2c3d" }
```

**★ Symptom: CI cannot install a git source that works locally.**
Cause: an SSH-style URL that depends on your agent and keys, in an environment that has neither. Fix:
this is a credentials problem, not a uv problem — supply the runner with the access it needs, or use
an internal index instead of a git source. Prefer the index: it is the one that keeps working when a
repository is renamed.

## Interview questions

**★ Why is `[tool.uv.sources]` safe for an application and dangerous for a library?**
Because the packaging specification defines `[tool]` as configuration for one named tool — *"any tool
related to your Python project… can have users specify configuration data as long as they use a
sub-table within `[tool]`"* — so `[tool.uv.sources]` is read by uv and by nothing else, and never
travels with a built distribution. For an application that is a non-issue: your deployment uses uv,
and `uv.lock` records the real source. For a library it means your consumers resolve the plain
requirement from `[project.dependencies]` against an index, while you spent the whole development
cycle installing from a git checkout or a sibling directory — so the requirement you published may be
satisfiable in a configuration you have literally never run. The rule is that the requirement must
stand on its own, with the source override layered on top as a convenience.

**★ Are source overrides transitive? Why is the answer what it is?**
No. A `[tool.uv.sources]` entry configures the project that declares it, and a package you depend on
cannot use its own sources table to redirect where *your* dependencies come from. The reason is
security before it is design: if a published package could specify fetch locations that applied to
its dependents, then installing anything would grant that package's author the ability to redirect
arbitrary downloads in your build. It is also consistent with the `[tool]` table's definition —
configuration belongs to the project it appears in. The practical consequence is that if you need an
override for a transitive dependency, you declare it yourself, in your own `pyproject.toml`, where it
is visible in your diff.

**★ You are reviewing a `pyproject.toml` with a git source and no version constraint. What do you say?**
That it is fine for an application and unpublishable for a library, and I would want to know which
this is. If it is an application, the git revision plus a committed `uv.lock` gives full
reproducibility, and the missing constraint costs nothing because no stranger resolves this file. If
it is a library, the published requirement is a bare package name — meaning any version, from any
project that happens to hold that name on PyPI — while every test you have ever run used a specific
git commit. The published contract and the tested configuration have no relationship. The fix is to
put a real constraint in `[project.dependencies]` and treat the source as a development override, and
the check to apply generally is: delete the sources table mentally and see whether the dependency list
still means something.

**★ What is the difference between a path source with `editable = true` and one without?**
The same difference as any editable install: an editable dependency is wired to the source directory
rather than copied into `site-packages`, so edits in the sibling project are immediately live in this
one — the same mechanism uv uses for your own project when it *"install[s] the project (and other
workspace members) as editable packages, such that re-syncing is not necessary for changes to be
reflected in the environment."* Without `editable = true`, the path source is built and installed
once, so every change in the sibling requires a re-sync. Editable is what you want for a tight
development loop across two repositories; non-editable is what you want when the path is a built
artefact (a `.whl`) rather than a live source tree.

**How would you set up development across two repositories that depend on each other, without breaking either one's published metadata?**
Declare a real version requirement in each `[project.dependencies]` — the thing your users will
resolve — and add a relative path source in `[tool.uv.sources]` with `editable = true` for local
development. That gives a live edit loop while leaving the published contract intact, and because the
source table is uv-scoped it is inert for anyone installing from an index. Two refinements matter:
keep the path relative so the whole team's checkouts work, and consider whether this is actually a
workspace — if the two projects are in one repository and always released together, uv's workspaces
are built for exactly that and remove the path bookkeeping. If they are separate repositories with
independent release cycles, the sources override is the right tool, and the discipline is to test at
least one CI job resolving from the index rather than the path.

---

← Prev: [04 · uv add and uv remove](04-add-and-remove.md) · [Topic index](README.md) · Next → [04c · uv run](04c-uv-run.md)
