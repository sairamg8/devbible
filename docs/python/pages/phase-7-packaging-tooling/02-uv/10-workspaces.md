---
title: "A uv workspace is several packages sharing one lockfile, one `requires-python` and one configuration root — which is exactly what you want when they are released together and exactly what hurts when any two of them need different versions of the same dependency"
sidebar_label: "10 · Workspaces"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Using workspaces*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/workspaces/)), *Configuration files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/configuration-files/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Using uv in Docker*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)) and the release notes
> ([github.com/astral-sh/uv](https://github.com/astral-sh/uv/releases)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**A workspace is uv's answer to a repository that holds several Python packages which depend on each
other — an application and the libraries it is split into, a library and its plugins. Each member keeps
its own `pyproject.toml`, but the workspace has *one* `uv.lock`, *one* effective `requires-python` (the
intersection of every member's), and *one* place configuration is read from (the root). That is the
whole design, and both its value and its cost follow from "one". Members that must agree on dependency
versions get that agreement enforced by construction, and a change to a shared dependency is a single
lockfile diff. Members that genuinely need different versions of the same package cannot coexist in
it — and for those, uv's own documentation recommends path dependencies instead. Editable installs and
path dependencies as a general practice are topic **10 · Editable installs** *(not written yet)*; this
page is uv's workspace mechanism.**

## What a workspace is, in uv's words

> *"a collection of one or more packages, called _workspace members_, that are managed together."*
> — inspired, the page says, by *"the Cargo concept of the same name"*

> *"In a workspace, each package defines its own `pyproject.toml`, but the workspace shares a single
> lockfile, ensuring that the workspace operates with a consistent set of dependencies."*
> — both [using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)

## Declaring one

> *"In defining a workspace, you must specify the `members` (required) and `exclude` (optional) keys,
> which direct the workspace to include or exclude specific directories as members respectively, and
> accept lists of globs"*

> *"Every directory included by the `members` globs (and not excluded by the `exclude` globs) must
> contain a `pyproject.toml` file."*
> — both [using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)

```text
invoicing/
├── pyproject.toml            ← workspace root, and itself a project
├── uv.lock                   ← the only lockfile
├── src/invoicing/__init__.py
└── packages/
    ├── invoice-models/
    │   ├── pyproject.toml
    │   └── src/invoice_models/__init__.py
    ├── pdf-renderer/
    │   ├── pyproject.toml
    │   └── src/pdf_renderer/__init__.py
    └── seeds/                ← fixture data, not a package
```

```toml
# invoicing/pyproject.toml — the root
[project]
name = "invoicing"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["invoice-models", "pdf-renderer"]

[tool.uv.workspace]
members = ["packages/*"]
exclude = ["packages/seeds"]

[tool.uv.sources]
invoice-models = { workspace = true }
pdf-renderer = { workspace = true }

[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

```toml
# packages/pdf-renderer/pyproject.toml — a member depending on a sibling
[project]
name = "pdf-renderer"
version = "0.3.0"
requires-python = ">=3.12"
dependencies = ["invoice-models", "reportlab>=4.2"]

[tool.uv.sources]
invoice-models = { workspace = true }

[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

## `workspace = true` is the routing, and it is still `[tool.uv.sources]`

> *"Within a workspace, dependencies on workspace members are facilitated via `tool.uv.sources`"*

> *"The `workspace = true` key-value pair in the `tool.uv.sources` table indicates the `bird-feeder`
> dependency should be provided by the workspace"*

> *"Any `tool.uv.sources` definitions in the workspace root apply to all members, unless overridden in
> the `tool.uv.sources` of a specific member."*
> — all three [using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)

The dependency on a sibling is declared twice on purpose: as a normal requirement in `[project]`
(`"invoice-models"`, which is what a published wheel will carry) and as a routing rule in
`[tool.uv.sources]` (which only uv reads — [04b](04b-tool-uv-sources.md)). Leave out the routing and
uv treats `invoice-models` as a package to find on an index. Publish a member and the routing
disappears for its users, which is why a member's release build should be `uv build --no-sources`
([09b](09b-uv-build-and-uv-publish.md)).

Synced members are installed editable, like the root project: *"When the environment is synced, uv
will install the project (and other workspace members) as editable packages"*
([locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)). A change in
`packages/invoice-models/src/` is visible to the root immediately.

## What operates on the whole workspace, and what on one member

> *"`uv lock` operates on the entire workspace at once, while `uv run` and `uv sync` operate on the
> workspace root by default, though both accept a `--package` argument"*
> — [using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)

```bash
uv lock                                        # always the whole workspace
uv sync                                        # the root's dependencies
uv sync --package pdf-renderer                 # that member's dependencies
uv run --package pdf-renderer pytest packages/pdf-renderer/tests
```

The lock is global because it is *one* resolution; the environment is per-target because a member's
test run should see that member's dependencies, not the union of everyone's.

## Three things that are workspace-wide whether you like it or not

**1 · `requires-python`.**

> *"uv's workspaces enforce a single `requires-python` for the entire workspace, taking the intersection
> of all members' `requires-python` values."*
> — [using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)

One member raising its floor to 3.14 raises it for all of them — including a library that promised its
users 3.12.

**2 · Configuration.** *"In workspaces, uv will begin its search at the workspace root, ignoring any
configuration defined in workspace members"* ([configuration files](https://docs.astral.sh/uv/concepts/configuration-files/),
[08](08-configuration-files.md)). A member's `[tool.uv]` settings are dead text.

**3 · Versions.** One lockfile means one version of each package for the whole workspace — the
consistency the feature exists for, and the reason it does not fit every repository.

## When a workspace is the wrong tool

> Not suitable for *"cases in which members have conflicting requirements, or desire a separate virtual
> environment for each member. In this case, path dependencies are often preferable."*
> — [using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)

```toml
# instead of a workspace: each project keeps its own lockfile and environment
[tool.uv.sources]
invoice-models = { path = "../invoice-models" }
```

The decision rule: **are these packages released and tested together, against the same dependency
versions?** If yes, a workspace makes that a guarantee. If two of them pin the same library differently
— a legacy service on an old ORM next to a new one — they are separate projects that happen to share a
repository, and a workspace would force a resolution neither wants.

## In a container, and in preview

The Docker guide's advice for workspaces is the inverse of the usual lock-mode rule: *"Use `--frozen`
instead of `--locked` during the initial sync"* and *"Use the `--no-install-workspace` flag which
excludes the project _and_ any workspace members"* ([using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)
— worked in [02e](02e-uv-inside-a-container-image.md)).

`uv workspace` is described in the CLI reference as *"Inspect uv workspaces"*. ⚠️ Its sub-commands are
moving: uv **0.12.6** (2026-08-25) added, in preview, *"Add `uv workspace metadata --sync --exact` to
remove packages outside the selected resolution"* ([releases](https://github.com/astral-sh/uv/releases)).
Preview features change on purpose; do not build a pipeline on them without pinning uv.

## Gotchas

**★ Symptom: `uv lock` tries to fetch a workspace member from PyPI, or fails because no such package exists there.**
Cause: the member is listed in `dependencies` but not routed — no `workspace = true` source. Fix:

```toml
[tool.uv.sources]
invoice-models = { workspace = true }
```

**★ Symptom: `uv run pytest` at the root cannot import a member's test dependencies.**
Cause: `uv run` and `uv sync` *"operate on the workspace root by default"*, so the environment holds the
root's dependencies. Fix: target the member.

```bash
uv run --package pdf-renderer pytest packages/pdf-renderer/tests
```

**★ Symptom: after one member raised `requires-python`, a library in the same workspace stopped supporting the Python its users run.**
Cause: the workspace takes *"the intersection of all members' `requires-python` values."* Fix: align
the floors deliberately — or, if the member truly needs a newer Python, move it out of the workspace.

```toml
# every member, and the root
requires-python = ">=3.12"
```

**★ Symptom: two members need different major versions of the same library and `uv lock` cannot resolve.**
Cause: one lockfile, one version per package — the case uv's page names as unsuitable. Fix: take one
of them out of the workspace and depend on it by path.

```toml
[tool.uv.sources]
legacy-billing = { path = "../legacy-billing" }
```

**★ Symptom: `uv lock` complains about a directory under `packages/` that is not a project.**
Cause: *"Every directory included by the `members` globs … must contain a `pyproject.toml` file."* Fix:
exclude it.

```toml
[tool.uv.workspace]
members = ["packages/*"]
exclude = ["packages/seeds"]
```

**Symptom: an index or constraint set in a member's `[tool.uv]` is ignored.**
Cause: configuration is read from the workspace root only. Fix: move it to the root's `[tool.uv]`
([08](08-configuration-files.md)).

```toml
# root pyproject.toml
[tool.uv]
constraint-dependencies = ["reportlab<5"]
```

**Symptom: a published member installs fine with uv in the repository and fails for users.**
Cause: its dependency on a sibling was satisfied by `workspace = true`, which no other tool reads, and
the sibling was never published at a compatible version. Fix: publish the sibling first, and build each
member without sources before release.

```bash
cd packages/pdf-renderer && uv build --no-sources
```

## Interview questions

**★ What does it mean that a uv workspace "shares a single lockfile"?**
That all members are resolved together, as one problem, into one `uv.lock` — uv's words are that this
ensures *"the workspace operates with a consistent set of dependencies."* Every member gets the same
version of every shared package, and `uv lock` always operates on *"the entire workspace at once."* The
benefits are agreement by construction and one reviewable diff when a shared dependency moves. The
costs come from the same fact: members cannot pin conflicting versions of anything, a single member's
`requires-python` constrains all of them, and a dependency bump for one member is a lockfile change for
all of them.

**★ When would you choose path dependencies over a workspace?**
When the packages share a repository but not a release cadence or a dependency set. uv's page is
explicit that workspaces do not suit *"cases in which members have conflicting requirements, or desire a
separate virtual environment for each member. In this case, path dependencies are often preferable."* A
path dependency — `{ path = "../other" }` in `[tool.uv.sources]` — lets each project keep its own lockfile,
environment and `requires-python`, at the price of no enforced agreement between them. The test is
whether the packages are tested and shipped together against the same versions: if yes, workspace; if
not, path.

**Why is a member's dependency on a sibling written twice — once in `[project]` and once in `[tool.uv.sources]`?**
Because they answer different questions for different readers. The `[project]` requirement is metadata:
it says the member needs `invoice-models`, and it ships in the built wheel for every installer to honour.
The `{ workspace = true }` source is a uv routing rule: it says *where* uv should get that package while
you are in this repository — from the sibling directory, editable. Drop the first and the published
package does not declare its dependency; drop the second and uv looks for the sibling on an index. And
because the second lives under `[tool]`, it vanishes for users, which is why members are built with
`--no-sources` before release.

**Why does the workspace enforce the intersection of every member's `requires-python`?**
Because one lockfile is one resolution, and a universal resolution has to hold for every interpreter it
covers — uv's resolver requires that packages *"must be compatible with the entire range of
`requires-python`"* ([03](03-the-lockfile.md)). If members declared different ranges and were locked
together, some locked versions would be invalid for some members. Taking the intersection is the only
range in which one consistent answer exists. The practical effect is that the most demanding member
sets the floor for all — which is fine for an application and its internal libraries, and a reason to
keep a library with a wider support promise out of a workspace full of applications.

**How do `uv run` and `uv sync` decide which member they act on?**
They act on the workspace root unless told otherwise — the page says they *"operate on the workspace
root by default, though both accept a `--package` argument"*. `uv lock` is the exception: it always
covers the whole workspace, because the lockfile is shared. So a member's tests should be run with
`uv run --package <member>`, which syncs the environment to that member's dependencies before running.
Forgetting it produces a confusing class of failure — the test imports a dependency the member declares,
and the root does not.

---

← Prev: [09b · uv build and uv publish](09b-uv-build-and-uv-publish.md) · [Topic index](README.md) · Next → [03 · Dependencies done right](../03-dependencies/README.md)
