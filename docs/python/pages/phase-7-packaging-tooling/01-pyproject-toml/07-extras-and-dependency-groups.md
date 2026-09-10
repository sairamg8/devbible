---
title: "An extra is published metadata your users can request; a dependency group is private to your repository and build backends are forbidden from shipping it — putting pytest in the wrong one is the mistake that leaks your test suite into every install"
sidebar_label: "07 · Extras and dependency groups"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *Dependency Groups* specification ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-groups/)), the *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), *Dependency specifiers* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)), and *Writing your pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**For a decade the only way to say "these dependencies are for developing this project" was `[project.optional-dependencies] dev = [...]` — which publishes a `dev` extra to PyPI that anyone can `pip install your-package[dev]`, pulls your linter into their environment, and constrains their resolver. PEP 735 fixed it with `[dependency-groups]`, a top-level table whose defining property is stated as a MUST: build backends **must not** put it in built distributions. The two tables look almost identical in TOML and are opposites in every way that matters — one is a published feature of your package, the other is repository-local configuration that never leaves your machine.**

## `[project.optional-dependencies]` — a published feature flag

> *"You may want to make some of your dependencies optional, if they are only needed for a specific feature of your package. In that case, put them in `optional-dependencies`."*

> *"Each of the keys defines a 'packaging extra'... one could use, e.g., `pip install your-project-name[gui]` to install your project with GUI support."*

```toml
[project]
name = "invoice-service"
version = "0.4.2"
dependencies = ["httpx>=0.28", "pydantic>=2.9"]

[project.optional-dependencies]
postgres = ["psycopg[binary]>=3.2"]
mysql = ["pymysql>=1.1"]
pdf = ["reportlab>=4.2", "pypdf>=5.0"]
```

Consumers then write `invoice-service[postgres,pdf]`.

### What the backend does with it

Two spec sentences describe the whole mechanism:

> *"The keys MUST be valid values for Provides-Extra."*

> *"Each value in the array thus becomes a corresponding Requires-Dist entry for the matching Provides-Extra metadata."*

So each extra name becomes a `Provides-Extra` line, and each dependency becomes a `Requires-Dist` line carrying the `extra == "…"` marker described in **[06 · dependencies and markers](06-dependencies-and-markers.md)**. Conceptually the metadata reads:

```text
Provides-Extra: postgres
Requires-Dist: psycopg[binary]>=3.2; extra == "postgres"
```

(illustrative rendering of the mapping the two quoted sentences define — not captured output)

Two consequences fall straight out of that representation:

- **An extra can only ADD dependencies.** There is no marker that removes or relaxes one. `[project.optional-dependencies] lite = []` does not give a smaller install; it gives the same install with an empty extra.
- **The extra names are public API.** Renaming `pdf` to `reports` breaks `pip install invoice-service[pdf]` in every downstream requirements file, with an error about an unknown extra rather than a version conflict.

### Extra names are normalised too

`Provides-Extra` is stricter than a project name:

> *"A string containing the name of an optional feature. A valid name consists only of lowercase ASCII letters, ASCII numbers, and hyphen."* — regex `^[a-z0-9]+(-[a-z0-9]+)*$`

Write `Dev_Tools` and a backend will normalise it to `dev-tools`, at which point `pip install pkg[Dev_Tools]` still works (the installer normalises too) but the name you documented is not the name in the metadata. Use lowercase and hyphens from the start.

### Self-referential extras: the "all" pattern

An extra may depend on your own project, which is how a combined extra is built without repetition:

```toml
[project]
name = "invoice-service"
version = "0.4.2"

[project.optional-dependencies]
postgres = ["psycopg[binary]>=3.2"]
pdf = ["reportlab>=4.2"]
all = ["invoice-service[postgres,pdf]"]
```

This works because the resolver treats your own distribution like any other and the version is already pinned by the fact that it is the one being installed. It is legal, widely used, and it does put a self-edge in the dependency graph — which older resolvers handled badly and modern ones handle fine.

## `[dependency-groups]` — private, by specification

Note the table is **top-level**, not under `[project]`. That placement is the point.

> *"This specification defines dependency groups, a mechanism for storing package requirements in `pyproject.toml` files such that they are not included in project metadata when it is built."*

🔴 The guarantee:

> *"Build backends MUST NOT include Dependency Group data in built distributions as package metadata."*

> *"Dependency groups are suitable for internal development use-cases like linting and testing, as well as for projects which are not built for distribution, like collections of related scripts."*

```toml
[dependency-groups]
test = ["pytest>=8.3", "pytest-cov>=6.0"]
lint = ["ruff>=0.16", "mypy>=1.13"]
docs = ["mkdocs>=1.6", "mkdocs-material>=9.5"]
dev = [
    { include-group = "test" },
    { include-group = "lint" },
    "ipython>=8.30",
]
```

### `include-group` composes groups

> *"An include is a table with exactly one key, `"include-group"`, whose value is a string, the name of another Dependency Group."*

> *"Includes are defined to be exactly equivalent to the contents of the named Dependency Group, inserted into the current group at the location of the include."*

"Inserted at the location of the include" is a precise claim: the result is a flat list in a defined order, not a set union. It also means the obvious hazard is real and the spec addresses it:

> *"Dependency Group Includes MUST NOT include cycles, and tools SHOULD report an error if they detect a cycle."*

### Group names normalise as well

> *"[dependency-groups] keys, sometimes also called 'group names', must be valid non-normalized names. Tools which handle Dependency Groups MUST normalize these names before comparisons."*

and:

> *"if duplicate names are detected after normalization, tools SHOULD emit an error"*

So `Dev` and `dev` in the same table is a probable error, not two groups.

### There is no standard way to install one

This is the sharpest difference from extras, and the spec says it outright: there is *"no syntax or specification-defined interface for installing or referring to dependency groups"*. An extra has one — the `[name]` suffix, understood everywhere. A group is installed by whatever your tool offers:

```bash
uv sync --group test          # uv
pip install --group test      # pip, in versions that support the flag
```

⚠️ I have not verified which pip release introduced `--group`; if your pip does not have it, `uv` and the group-aware alternatives are the practical path, and there is no fallback syntax to substitute.

## Choosing between them — the one question that decides it

**Would a user of your published package ever want this?**

- Yes → `[project.optional-dependencies]`. A database driver, an optional serialiser, a CLI's colour support.
- No → `[dependency-groups]`. pytest, ruff, mypy, mkdocs, the coverage plugin, the release script's helpers.

| | `[project.optional-dependencies]` | `[dependency-groups]` |
|---|---|---|
| Location | under `[project]` | top level |
| In built metadata | yes — `Provides-Extra` + `Requires-Dist` | **MUST NOT be** |
| Requested by | `pkg[extra]`, understood by every installer | tool-specific flag; no standard syntax |
| Visible on PyPI | yes | no |
| Composes | via a self-referential extra | via `include-group` |
| Affects consumers' resolution | yes | no |
| Right for `pytest` | 🔴 no | ✅ yes |

## Gotchas

**★ Symptom: a user runs `pip install invoice-service[dev]` and gets your entire test and lint toolchain.** Cause: `dev` is an extra, so it is published, discoverable and installable by anyone. Fix: move it to a dependency group, which backends *must not* publish.

```toml
[dependency-groups]
dev = ["pytest>=8.3", "ruff>=0.16", "mypy>=1.13"]
```

**★ Symptom: your package's `pytest` pin conflicts with a consumer's, even though they never asked for your dev extra.** Cause: `Provides-Extra` and its `Requires-Dist` lines are in the metadata whether or not the extra is requested, so a resolver may consider them while exploring — and any tool that installs "all extras" will pull them in. Fix: same as above; the dependency has to leave the published metadata entirely.

**★ Symptom: `pip install pkg[Dev_Tools]` works for you and the extra is missing from the PyPI page.** Cause: `Provides-Extra` names are lowercase-and-hyphen only, so the backend normalised `Dev_Tools` to `dev-tools` in the metadata while installers normalise your request to match. Fix: name it in the normalised form so the documentation and metadata agree.

```toml
[project.optional-dependencies]
dev-tools = ["ipython>=8.30"]
```

**★ Symptom: you add `[project.optional-dependencies] minimal = []` expecting a slimmer install and nothing changes.** Cause: extras are additive only — the metadata mechanism is an extra `Requires-Dist` line, and there is no line that subtracts. Fix: invert the design. Make the base install minimal and put the heavy pieces behind extras.

```toml
[project]
dependencies = ["httpx>=0.28"]

[project.optional-dependencies]
full = ["pandas>=2.2", "pyarrow>=18.0"]
```

**★ Symptom: you rename an extra, and a consumer's install stops pulling the dependency without failing.** Cause: extra names are public API, and a request for an extra a package no longer provides is treated as a warning rather than an error by at least some installers — so the install succeeds with less in it than the consumer asked for. Fix: keep the old name as an alias pointing at the new one for at least one release.

```toml
[project.optional-dependencies]
reports = ["reportlab>=4.2"]
pdf = ["invoice-service[reports]"]      # deprecated alias, remove in 1.0
```

**★ Symptom: `uv sync` errors on your dependency groups with a cycle complaint.** Cause: two groups include each other, directly or through a third — the spec requires that includes *"MUST NOT include cycles."* Fix: make one group the leaf and have the others include it, never mutually.

```toml
[dependency-groups]
test = ["pytest>=8.3"]
lint = ["ruff>=0.16"]
dev = [{ include-group = "test" }, { include-group = "lint" }]
```

**★ Symptom: `[dependency-groups]` is ignored entirely and your dev tools are never installed.** Cause: it is a *top-level* table. Written as `[project.dependency-groups]` it is an unknown key under `[project]`, which PEP 621 forbids tools from inventing, so it is at best ignored. Fix: no `project.` prefix.

```toml
[dependency-groups]
test = ["pytest>=8.3"]
```

**★ Symptom: an include-group entry is rejected as invalid.** Cause: the include table takes *"exactly one key"* — adding a version, a marker or a second key makes it something else. Fix: one key, one string.

```toml
[dependency-groups]
dev = [{ include-group = "test" }, "ipython>=8.30"]
```

**★ Symptom: CI installs your groups, production does not, and a group member turns out to be a real runtime dependency.** Cause: a genuine dependency was filed as a dev tool because it was first needed by a test. Nothing warns you: groups are absent from the wheel by design, so the import failure only appears in a clean production install. Fix: the test is "does the shipped code import it?" If yes, it belongs in `[project] dependencies`, however it entered the repository.

**★ Symptom: two groups named `Dev` and `dev` behave as one.** Cause: normalisation before comparison is a MUST, and duplicates after normalisation *"SHOULD"* be an error — a SHOULD your tool may not implement. Fix: lowercase group names, always.

## Interview questions

**★ Why did PEP 735 exist when `optional-dependencies` already worked for dev dependencies?**
Because `optional-dependencies` publishes. A `dev` extra becomes `Provides-Extra: dev` plus a set of `Requires-Dist` lines in the wheel's metadata, which means your linter and test framework are part of your package's public interface: discoverable on PyPI, installable by any consumer, and present in the metadata a resolver reads. Dependency groups are defined by the opposite guarantee — *"Build backends MUST NOT include Dependency Group data in built distributions as package metadata"* — so they exist only in the repository. The distinction is not tidiness; it is whether your development choices constrain your users' resolution.

**★ Can an extra remove or downgrade a dependency?**
No, and the reason is in the representation. An extra is implemented as additional `Requires-Dist` lines gated by an `extra == "name"` marker. Markers can make a line inactive; nothing can make an already-active line inactive, and no metadata construct subtracts. So a `[minimal]` extra intended to strip a heavyweight dependency does nothing at all. The correct shape is always to make the base install lean and add via extras — which is also why libraries with a huge default install and a `[lite]` extra are a design smell rather than an unlucky config.

**★ Where do you put `pytest`, and how do you defend the choice?**
`[dependency-groups]`, under a `test` group. The test is whether a consumer of the published package could ever want it: they cannot run your test suite, since the tests are not usually in the wheel, so the answer is no. Filing it as an extra publishes it, adds it to the metadata a resolver may consider, and lets someone install `your-package[test]` and receive a pytest pin they never wanted. The one case where a test dependency legitimately becomes an extra is when you ship reusable test *helpers* — a pytest plugin, a fixtures module — because then the user really does need pytest to use the thing you shipped.

**★ What does `include-group` guarantee, and what does it not?**
It guarantees textual substitution: *"Includes are defined to be exactly equivalent to the contents of the named Dependency Group, inserted into the current group at the location of the include."* So the result is an ordered flat list, and if two included groups both name the same package with different specifiers you get both entries and the resolver intersects them — the include mechanism does not deduplicate or reconcile. What it does forbid is cycles, which *"MUST NOT"* occur and *"SHOULD"* be reported. Practically: build a tree of leaf groups with one aggregate `dev` group at the top, and never have two groups include each other.

**★ Why can you write `pip install pkg[extra]` but not `pip install pkg[group]`?**
Because extras are part of the published metadata format and dependency groups are deliberately not. The `[name]` suffix is part of the dependency-specifier grammar, so every installer, index and resolver understands it. Groups live only in the source `pyproject.toml`, and the specification states there is *"no syntax or specification-defined interface for installing or referring to dependency groups"* — installing one is a feature of your local tool, not of the package. That is exactly why groups can be a private matter: nothing downstream ever needs to name them.

**★ Is a self-referential extra like `all = ["mypkg[a,b]"]` a hack?**
No — it is the intended way to compose extras, and it works because your own distribution is an ordinary node in the dependency graph. The alternative, repeating every dependency in the `all` list, is worse: it duplicates version constraints that then drift apart. The one thing to be aware of is that it creates a self-edge, so a resolver must handle a package depending on itself with a different extra set; modern resolvers do. Prefer it over duplication.

**★ A colleague puts `[dependency-groups]` inside `[project]`. What happens?**
Nothing useful, and probably nothing visible. PEP 621 states that *"No tools may add fields to this table which are not defined by this PEP or subsequent PEPs"*, so `[project.dependency-groups]` is not a defined key — a strict backend errors, a lenient one ignores it, and the groups are simply never available to any tool that looks for the real top-level table. The symptom is dev dependencies that never install, with no error to search for, which is why the table's placement is worth checking first when a group appears to do nothing.

---

← Prev: [06 · dependencies and markers](06-dependencies-and-markers.md) · [Topic index](README.md) · Next → [08 · license and PEP 639](08-license-and-the-pep-639-migration.md)
