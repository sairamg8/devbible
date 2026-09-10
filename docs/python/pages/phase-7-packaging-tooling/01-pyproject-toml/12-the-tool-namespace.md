---
title: "[tool] is the reason one file configures your linter, formatter, type checker, test runner and build backend at once — and the reason it works is a one-sentence ownership rule in PEP 518 that ties a subtable name to a PyPI project"
sidebar_label: "12 · The tool namespace"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against PEP 518 ([peps.python.org](https://peps.python.org/pep-0518/)), PEP 621 ([peps.python.org](https://peps.python.org/pep-0621/)), the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Writing your pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)), setuptools' *Configuring setuptools using pyproject.toml* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html)), and ruff's *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)).
> Target: **Python 3.14.7** · **ruff 0.16.6** · **uv 0.12.12**. Documentation-validated — **no sandbox run, no program output**.

**The single most useful thing PEP 518 did was not `[build-system]`. It was reserving `[tool]` as a shared namespace with a name-ownership rule strict enough that no two projects can ever collide in it. That is why a modern repository has one config file instead of nine, why `[tool.ruff]` needs no registration process, and why `[tool.pytest.ini_options]` has that strange extra level. It is also where every "why is my config being ignored" bug lives, because a subtable nobody owns is not an error — it is silence.**

## The definition and the rule

> *"The `[tool]` table is where any tool related to your Python project, not just build tools, can have users specify configuration data as long as they use a sub-table within `[tool]`"*

with the example *"the flit tool would store its configuration in `[tool.flit]`"*.

🔴 And the rule that makes the namespace safe:

> *"A project can use the subtable `tool.$NAME` if, and only if, they own the entry for `$NAME` in the Cheeseshop/PyPI."*

("Cheeseshop" is the historical name for PyPI.) There is no registry to apply to and no committee: **owning the PyPI name is the claim**. `ruff` on PyPI is the same project as `[tool.ruff]`, and nobody else can take either.

The current spec restates it, and the packaging guide draws the boundary:

> *"The `[tool]` table has tool-specific subtables, e.g., `[tool.hatch]`, `[tool.black]`, `[tool.mypy]`. We only touch upon this table here because its contents are defined by each tool."*

*"defined by each tool"* is the operative clause. The packaging specifications say nothing about what goes inside a subtable, only who owns it. Every key under `[tool.ruff]` is documented by ruff and by nobody else.

## Why `[tool]` exists rather than letting tools extend `[project]`

PEP 621 forbids the alternative outright:

> *"No tools may add fields to this table which are not defined by this PEP or subsequent PEPs. For tools wishing to store their own settings in `pyproject.toml`, they may use the `[tool]` table as defined in PEP 518."*

The reason is what `[project]` *is*: a mapping onto core metadata, a published wire format read by installers that have never heard of your tool. An unrecognised key there is not extensibility — it is metadata some backends drop silently and others reject, with no way for a reader to know which happened. `[tool]` has no such contract, so an unrecognised key is simply a key that tool does not read.

## Who owns what — the subtables you will actually meet

| Subtable | Owned by | What it configures |
|---|---|---|
| `[tool.ruff]` | `ruff` | lint rule selection, formatter settings, per-file ignores |
| `[tool.mypy]` | `mypy` | strictness, per-module overrides, plugin list |
| `[tool.pytest.ini_options]` | `pytest` | test paths, markers, addopts |
| `[tool.coverage.run]` / `[tool.coverage.report]` | `coverage` | source paths, exclusions, fail-under |
| `[tool.hatch.*]` | `hatch` | build config for hatchling, version source, environments |
| `[tool.setuptools.*]` | `setuptools` | package discovery, package data, dynamic fields |
| `[tool.uv]` | `uv` | resolution settings, index config, workspace members |
| `[tool.poetry]` | `poetry` | that project's own metadata dialect |

A realistic file's tool half:

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
ignore = ["E501"]

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["S101"]

[tool.mypy]
python_version = "3.12"
strict = true

[[tool.mypy.overrides]]
module = ["legacy_importer.*"]
ignore_errors = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers"

[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
fail_under = 85
```

Note `[[tool.mypy.overrides]]` — a TOML array-of-tables, repeated for each override block. It is legal TOML and easy to mistype as `[tool.mypy.overrides]`, which is a single table and a different structure entirely.

### Why `[tool.pytest.ini_options]` has the extra level

pytest's configuration language predates `pyproject.toml` — it is the INI dialect of `pytest.ini` and `setup.cfg`. Rather than invent a second dialect, pytest nests the existing option set under `ini_options`, so the keys inside are the same keys you would write in `pytest.ini`. That is also why they use underscores and INI-ish values (`addopts` as one space-separated string) while ruff, designed for TOML, uses hyphenated keys and real arrays. The inconsistency is historical, not accidental, and knowing its origin is the fastest way to stop mistyping it.

## What still cannot live here

Not every tool reads TOML, and `[tool]` is a namespace, not a compatibility layer:

- **flake8** — has no `pyproject.toml` support; it wants `setup.cfg`, `tox.ini` or `.flake8`. (This is one of ruff's practical selling points: it consolidates what flake8 could not.)
- **`.gitignore`, `.dockerignore`, `.editorconfig`** — not Python tools, different consumers, different formats.
- **CI workflow definitions** — GitHub Actions and friends read their own YAML from their own paths.
- **`pre-commit`** — reads `.pre-commit-config.yaml`. It orchestrates hooks; the hooks themselves may read `[tool.*]`.
- **Anything secret** — `pyproject.toml` is committed and shipped inside sdists. Credentials belong in the environment; see **08 · Config and secrets** *(not written yet)*.

## The build backend's `[tool]` half

This is the seam people miss: `[project]` is standardised, but *how the backend finds your source* is not. That lives under `[tool]`:

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"

[project]
name = "invoice-service"
version = "0.4.2"

[tool.setuptools.packages.find]
where = ["src"]
```

setuptools documents the discovery behaviour this configures:

> *"When both `py-modules` and `packages` are left unspecified, `setuptools` will attempt to perform Automatic discovery...you might need to use the `find` directive"*

So a src-layout project that "builds an empty wheel" usually has correct `[project]` metadata and a missing `[tool.setuptools.packages.find]`. The metadata was never the problem. The equivalent under hatchling is a different subtable with different keys — which is precisely the portability cost of choosing a backend, and the reason **[11 · build-system and backends](11-build-system-and-choosing-a-backend.md)** matters more than it looks.

## Gotchas

**★ Symptom: your `[tool.ruff]` settings are ignored and ruff uses defaults.** Cause: a `ruff.toml` or `.ruff.toml` also exists, and ruff documents the order:

> *"If Ruff detects multiple configuration files in the same directory, the `.ruff.toml` file will take precedence over the `ruff.toml` file, and the `ruff.toml` file will take precedence over the `pyproject.toml` file."*

Nothing warns you, because all three files are individually valid. Fix: delete the ones you are not using. Keep `pyproject.toml` if you want one file; keep `ruff.toml` if you have a reason, and then do not also write `[tool.ruff]`.

**★ Symptom: a typo'd subtable is silently ignored.** Cause: `[tool.rufff]` or `[tool.pytest]` without `ini_options` is a subtable nobody owns, and no tool errors on a namespace that is not theirs — that is the whole design. Ruff even documents skipping files that lack its section: *"Ruff ignores any `pyproject.toml` files that lack a `[tool.ruff]` section."* Fix: nothing in the file can catch it, so ask the tool what it resolved. Ruff's flag is documented as *"See the settings Ruff will use to lint a given Python file"*:

```bash
ruff check --show-settings src/invoice_service/cli.py
```

**★ Symptom: `[tool.pytest]` keys do nothing.** Cause: pytest reads `[tool.pytest.ini_options]`, not `[tool.pytest]`, because it is carrying its INI dialect across. Fix:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

**★ Symptom: mypy overrides apply to everything or to nothing.** Cause: `[tool.mypy.overrides]` instead of `[[tool.mypy.overrides]]`. The double bracket is a TOML array-of-tables; the single bracket is one table, and the `module` key then means something different. Fix:

```toml
[[tool.mypy.overrides]]
module = ["legacy_importer.*"]
ignore_errors = true
```

**★ Symptom: your wheel installs and the package is empty.** Cause: the backend found no source. `[project]` says nothing about where your code lives — discovery is backend configuration under `[tool]`, and a src layout usually needs to be told. Fix:

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

**★ Symptom: you add `[project.ruff]` and the build errors or the setting is ignored.** Cause: PEP 621 forbids tools adding fields to `[project]`, so it is at best unknown and at worst rejected. Fix: `[tool.ruff]`, always.

**★ Symptom: two internal tools written in-house fight over the same subtable.** Cause: neither owns the name on PyPI, so the ownership rule that prevents collisions everywhere else does not apply to you. Fix: namespace your internal tools by something you do control, and treat it as a convention your team enforces since nothing else will.

```toml
[tool.acme-release-bot]
channel = "internal"
```

**★ Symptom: `[tool.poetry]` and `[project]` both present, with different versions.** Cause: a half-finished migration. Poetry's older dialect keeps metadata under `[tool.poetry]`; PEP 621 keeps it in `[project]`. Which one wins depends on your build backend and its version, so the file has two answers to "what version is this". Fix: complete the migration and delete the loser, rather than leaving both and hoping.

**★ Symptom: a tool's config works locally and is ignored in CI.** Cause: the tool is invoked from a different working directory, and `pyproject.toml` is discovered by walking up from the current directory. Fix: pass the config path explicitly in CI rather than relying on discovery — ruff's `--config` is documented as taking *"either a path to a TOML configuration file (`pyproject.toml` or `ruff.toml`), or a TOML `<KEY> = <VALUE>` pair overriding a specific configuration option."*

```bash
ruff check --config pyproject.toml src tests
```

**★ Symptom: flake8 config in `[tool.flake8]` does nothing.** Cause: flake8 does not read `pyproject.toml`. Since nobody errors on a subtable they do not own, the section sits there looking correct. Fix: use `setup.cfg` or `.flake8`, or move to ruff, which reads `[tool.ruff]` natively.

**★ Symptom: a secret you put in `[tool.something]` ends up on PyPI.** Cause: `pyproject.toml` is included in sdists — it has to be, since a build from an sdist needs it. Anything in it is published with your package. Fix: environment variables or a secret manager, and never a token in a committed config file.

## Interview questions

**★ How does the ecosystem stop two tools claiming `[tool.build]`?**
By tying the subtable name to PyPI ownership. PEP 518 states it as a biconditional: *"A project can use the subtable `tool.$NAME` if, and only if, they own the entry for `$NAME` in the Cheeseshop/PyPI."* PyPI names are already unique and already contested through an existing process, so the packaging ecosystem reused that uniqueness rather than building a second registry. The elegance is that there is nothing to apply for — publishing `ruff` to PyPI is what entitles ruff to `[tool.ruff]`, and no arbitration is needed because the arbitration already happened at the index.

**★ Why can't a tool add a key to `[project]` instead?**
Because `[project]` maps onto core metadata, which is a published format read by installers that know nothing about your tool. An unknown key there would be dropped by some backends and rejected by others, with no way for a downstream reader to tell which happened — so it is not extensibility, it is silent data loss. PEP 621 forbids it in one sentence and points at the alternative: *"For tools wishing to store their own settings in `pyproject.toml`, they may use the `[tool]` table as defined in PEP 518."* `[tool]` can be permissive precisely because nothing downstream interprets it.

**★ What happens when you misspell a subtable name?**
Nothing, and that is by design. No tool can error on a subtable it does not own, because the whole point of the namespace is that `[tool.ruff]` and `[tool.mypy]` coexist with each tool ignoring the other's section. A misspelling is therefore indistinguishable from a section belonging to a tool that is not currently running. There is no validation available at the file level, so the only defence is to verify from the tool's side — most of them will print their resolved configuration on request, and that is the check worth putting in CI for a config you care about.

**★ Why does pytest need `[tool.pytest.ini_options]` when ruff just uses `[tool.ruff]`?**
Because pytest's option set predates TOML by more than a decade. It is an INI dialect, originally from `pytest.ini` and `setup.cfg`, and rather than fork it into a second incompatible TOML dialect pytest nested the existing options under `ini_options`. The upside is that every `pytest.ini` key means the same thing in `pyproject.toml`; the downside is the extra level and the INI-flavoured values, such as `addopts` being a single space-separated string rather than an array. ruff had no such history and could design for TOML directly.

**★ Where does the boundary between `[project]` and `[tool.<backend>]` actually fall?**
`[project]` describes *what the package is* — the metadata that ends up in the artifact and that every installer reads. `[tool.<backend>]` describes *how to build it* — which directories contain source, which files to include, where a dynamic version comes from. That split is what makes `[project]` portable: moving from setuptools to hatchling leaves the metadata untouched and rewrites only the backend's subtable. It is also why a correct `[project]` can still produce an empty wheel, since nothing in the standardised half says where your code lives.

**★ Is there anything that should *not* go in `pyproject.toml` even though it could?**
Secrets, unambiguously. The file is committed to version control and is included in sdists, because a build from an sdist needs it — so anything inside it is published with the package. Beyond that it is a judgement call: config for a tool that only some contributors run, or a section large enough to bury the packaging metadata, is often better in its own file. The counter-argument that usually wins is that one file is one place to look, and a tool that supports `pyproject.toml` should generally be configured there.

**★ A repository has both `pyproject.toml` with `[tool.ruff]` and a `ruff.toml`. Which wins?**
The dedicated file, and for ruff specifically it is documented: *"the `.ruff.toml` file will take precedence over the `ruff.toml` file, and the `ruff.toml` file will take precedence over the `pyproject.toml` file."* The losing section is ignored silently, since all of the files are individually valid and none is malformed. This is the most common form of "my configuration is being ignored", and it is worth checking before anything else, because the symptom (defaults being applied) looks identical to a typo, a wrong working directory, or a version of the tool that predates the setting.

---

← Prev: [11 · build-system and choosing a backend](11-build-system-and-choosing-a-backend.md) · [Topic index](README.md) · Next → [13 · Dynamic metadata](13-dynamic-metadata.md)
