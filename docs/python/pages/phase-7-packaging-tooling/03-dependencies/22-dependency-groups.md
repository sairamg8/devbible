---
title: "Dependency groups are the answer to \"what does this environment need\" — a small set of leaf groups, one default aggregate for developers, each CI job installing only the groups its tool reads, and production excluding all of them by flag rather than by discipline"
sidebar_label: "22 · Dependency groups in practice"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **PEP 735** ([peps.python.org](https://peps.python.org/pep-0735/)), the
> PyPA **Dependency groups** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-groups/)),
> uv's **Managing dependencies** and **Locking and syncing**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/), **uv 0.12.12**), uv's
> **CLI reference** ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and pip's **pip install**
> reference ([pip.pypa.io](https://pip.pypa.io/en/stable/cli/pip_install/), pip docs v26.2.1).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**The table itself — top-level `[dependency-groups]`, `include-group`, normalised names, the MUST that
keeps groups out of built metadata — is [pyproject.toml · 07](../01-pyproject-toml/07-extras-and-dependency-groups.md).
This page is how to use it. A group answers one question: *which packages does this particular environment
need?* The linter job needs ruff and nothing else; the test job needs your project plus pytest; the docs
build needs a site generator; production needs none of them. Getting that right is mostly a matter of
choosing leaf groups by *consumer*, making `dev` the aggregate developers get by default, and making every
non-developer environment say what it excludes. What makes groups easy to get wrong is that uv installs
`dev` unless told otherwise, and installs your project unless told otherwise — two defaults that are right
on a laptop and wrong in a container.**

This page is the design and what each environment installs. Groups outside uv — pip, exports, projects with no
package — are [22b](22b-groups-beyond-uv.md); the fact that every group shares one resolution with production,
and what that costs, is [22c](22c-groups-share-one-resolution.md).

## Group by consumer, not by vibe

The spec's own framing:

> *"Dependency groups are suitable for internal development use-cases like linting and testing, as well as for
> projects which are not built for distribution, like collections of related scripts."*

> *"Fundamentally, dependency groups should be thought of as being a standardized subset of the capabilities of
> `requirements.txt` files (which are pip-specific)."*

So a group is a named `requirements.txt` — and the useful unit is *one per thing that installs it*. PEP 735's
canonical example is exactly that shape:

```toml
[dependency-groups]
test = ["pytest", "coverage"]
docs = ["sphinx", "sphinx-rtd-theme"]
typing = ["mypy", "types-requests"]
typing-test = [{include-group = "typing"}, {include-group = "test"}, "useful-types"]
```

A production-grade version for a service, with the aggregate developers get by default:

```toml
[dependency-groups]
test   = ["pytest>=8.3", "pytest-cov>=6.0"]
lint   = ["ruff>=0.16"]
typing = ["mypy>=1.13", "types-requests>=2.32"]
docs   = ["mkdocs>=1.6", "mkdocs-material>=9.5"]
dev    = [
    { include-group = "test" },
    { include-group = "lint" },
    { include-group = "typing" },
    "ipython>=8.30",
]
```

`uv add` writes into the right place without hand-editing:

```bash
uv add --dev ipython            # "This option is an alias for --group dev."
uv add --group lint ruff        # "These requirements will not be included in the published metadata"
```

## What uv installs when you do not say

Two defaults, both documented, both surprising in CI:

> *"By default, uv includes the `dev` dependency group in the environment (e.g., during `uv run` or `uv sync`).
> The default groups to include can be changed using the `tool.uv.default-groups` setting."*

> *"By default, the current project is installed into the environment with all of its dependencies."*

The group flags, from the CLI reference:

| Flag | What it does, quoted |
|---|---|
| `--group <name>` | *"Include dependencies from the specified dependency group."* |
| `--only-group <name>` | *"Only include dependencies from the specified dependency group. The project and its dependencies will be omitted."* |
| `--no-group <name>` | *"This option always takes precedence over default groups, --all-groups, and --group."* |
| `--all-groups` | *"Include dependencies from all dependency groups."* |
| `--no-default-groups` | *"uv includes the groups defined in tool.uv.default-groups by default. This disables that option, however, specific groups can still be included with --group."* |
| `--dev` / `--no-dev` / `--only-dev` | *"equivalent to --group dev, --only-group dev, and --no-group dev respectively"* |

and the precedence rule, stated with its own example:

> *"Group exclusions always take precedence over inclusions, so given the command: `uv sync --no-group foo
> --group foo` The foo group would not be installed."*

To change what developers get by default — for instance to include `docs` for everyone:

```toml
[tool.uv]
default-groups = ["dev", "docs"]     # or "all"
```

## One CI job, one group

Each tool reads a different slice, and installing only that slice makes jobs faster and makes a missing
dependency show up in the job that needs it rather than being masked by another group:

```yaml
# .github/workflows/ci.yml
env:
  UV_LOCKED: "1"
jobs:
  lint:                                  # ruff never imports your code: no project, no runtime deps
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --only-group lint
      - run: uv run ruff check .

  typing:                                # mypy must see your code and its dependencies
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --no-default-groups --group typing
      - run: uv run mypy src

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --no-default-groups --group test
      - run: uv run pytest -q
```

The `--only-group` versus `--group` choice is the whole design: *only* drops the project and its runtime
dependencies, which is right for a formatter and wrong for a type checker or a test runner.

## Production excludes by flag

The dependency is simple — no group belongs in a production image — and the mechanism has to be a flag,
because `dev` is on by default:

```dockerfile
RUN uv sync --locked --no-dev --no-install-project     # dependencies only, no dev group
COPY . .
RUN uv sync --locked --no-dev
```

`--no-dev` excludes only `dev`; if you added groups to `default-groups`, use the flag that removes them all:

```bash
uv sync --locked --no-default-groups
```

or set it once for the whole environment: `--no-dev` is documented with `[env: UV_NO_DEV=]`.

## Gotchas

**★ Symptom: the production image contains pytest, ruff and mypy.** Cause: `uv sync` in the Dockerfile without
a flag — *"By default, uv includes the `dev` dependency group in the environment"*. Fix: exclude explicitly:

```bash
uv sync --locked --no-dev              # or --no-default-groups if you changed default-groups
```

**★ Symptom: the type-check job reports every import of your own dependencies as missing.** Cause:
`--only-group typing` — *"The project and its dependencies will be omitted."* Fix: include the group without
dropping the project:

```bash
uv sync --no-default-groups --group typing
```

**★ Symptom: a test passes in CI and fails on a developer's machine because of a missing plugin.** Cause: CI
installs `--group test` while the developer's `dev` aggregate does not include `test` — or the reverse, a plugin
listed only in `dev` that CI never installs. Fix: make `dev` include the leaves by reference, never by copying:

```toml
dev = [{ include-group = "test" }, { include-group = "lint" }, "ipython>=8.30"]
```

**Symptom: `uv sync --group docs --no-group docs` installs nothing from docs, and a wrapper script that always
appended `--no-group docs` silently disabled a job.** Cause: *"Group exclusions always take precedence over
inclusions"* — and `--no-group` *"always takes precedence over default groups, --all-groups, and --group."* Fix:
compose flags in one place, and when a job must have a group, prefer `--only-group` or
`--no-default-groups --group` so no inherited exclusion can win:

```bash
uv sync --no-default-groups --group docs
```

**Symptom: an environment variable set for local work (`UV_NO_DEV`) leaks into CI and the test job silently runs
without its tools.** Cause: `--no-dev` has an environment form, `[env: UV_NO_DEV=]`, and environment beats
memory. Fix: set group behaviour explicitly in each job, not globally on a shared runner image:

```bash
uv sync --no-default-groups --group test
```

## Interview questions

**★ How would you split a service's development dependencies into groups?**
By consumer. One leaf group per thing that installs it — `test` for the test runner and its plugins, `lint` for
the formatter and linter, `typing` for the type checker and stubs, `docs` for the site generator — and one `dev`
aggregate that includes the leaves by reference plus personal conveniences like a REPL. The spec frames groups
as *"a standardized subset of the capabilities of `requirements.txt` files"*, and that is the right mental model:
each leaf is the requirements file for one job. CI jobs install one leaf each, developers get `dev` by default,
and production installs none.

**★ How do you guarantee no development tool reaches a production image?**
By flag, not by convention, because uv's default includes `dev`: *"By default, uv includes the `dev` dependency
group in the environment (e.g., during `uv run` or `uv sync`)."* The image build runs `uv sync --locked --no-dev`
— or `--no-default-groups` if `default-groups` lists more than `dev` — and ideally a test in the image pipeline
asserts the absence of a marker package such as `pytest`. Groups are guaranteed never to reach *published*
metadata by the spec; nothing guarantees they stay out of a container except the flag.

**★ When does `uv sync` install your project, and when does it not?**
It installs the project by default, *"with all of its dependencies"*. `--only-group` and `--only-dev` omit it:
*"The project and its dependencies will be omitted."* `--no-install-project` omits the project while keeping its
dependencies, which is the Docker layer-caching pattern. So a lint job wants `--only-group lint` — ruff never
imports your code — while a type-check or test job wants `--no-default-groups --group …`, because those tools
must import the project and everything it depends on.

---

← [21b · Extras in the lock and the graph](21b-extras-in-the-lock-and-the-graph.md) · [Topic index](README.md) · Next → [22b · Groups beyond uv](22b-groups-beyond-uv.md)
