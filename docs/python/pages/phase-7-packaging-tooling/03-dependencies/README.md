---
title: "03 · Dependencies done right — a declaration says what you tolerate, a lock records what you chose, and every rule in between exists because Python installs exactly one version of each package into one environment"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA specifications — *Version specifiers* (PEP 440)
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)),
> *Dependency specifiers* (PEP 508)
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)),
> *Dependency groups* (PEP 735)
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-groups/)) — plus
> **PEP 751** and **PEP 592** ([peps.python.org](https://peps.python.org/)), the PyPA discussion
> *install_requires vs requirements files*
> ([packaging.python.org](https://packaging.python.org/en/latest/discussions/install-requires-vs-requirements/)),
> pip's documentation (v26.2.1, [pip.pypa.io](https://pip.pypa.io/en/stable/)) and uv's documentation
> ([docs.astral.sh](https://docs.astral.sh/uv/), **uv 0.12.12**). Target: **Python 3.14.7**.
> Documentation-validated — **no sandbox run, no program output on any page**; the few error texts shown
> are quoted from the documentation that prints them.

**Dependency management in Python is two different jobs that share a syntax. A *declaration* —
`[project.dependencies]`, a range like `httpx>=0.27` — is an abstract statement of what your code tolerates,
and for a library it is published, where it intersects with every other library's declaration in a stranger's
environment. A *lock* — `uv.lock`, a compiled `requirements.txt`, a `pylock.toml` — is a concrete record of
the exact files one resolution chose, and for an application it is the deployment contract. Libraries range
because a pin in published metadata collapses that intersection to a point; applications lock because a range
at deploy time means the index decides what runs. This topic works through both halves: the version and
specifier grammar that every tool shares, the reason the two roles differ, what a lock does and does not
guarantee, the CI flags that make it binding, extras and dependency groups as practice, keeping a lock current
and audited, and how to read — and fix — a resolution that cannot succeed.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The version itself](01-pep-440-the-version-itself.md)** | the five-segment PEP 440 scheme, 🔴 zero padding (`1.0 == 1.0.0`), where `dev`/`a`/`post` sort, and the epoch as the escape hatch for a scheme change |
| 2 | **[Local versions](02-local-versions-and-the-plus-label.md)** | the `+label` suffix, 🔴 why specifiers ignore it so a patched rebuild satisfies your pin, and why PyPI refuses to host one |
| 3 | **[Normalization](03-normalization-and-comparing-versions.md)** | ten spellings of one version, name normalization, and 🔴 why every comparison belongs to `packaging` rather than to string logic |
| 4 | **[Equality and exclusion](04-equality-and-exclusion.md)** | the eight operators and the comma, 🔴 `==1.1` rejecting `1.1.post1`, `.*` prefix matching, `!=`, and `===` as not-a-comparison |
| 5 | **[Ordered comparisons](05-ordered-comparisons.md)** | 🔴 why `<` and `>` exclude the pre-, post- and local releases of the version you named, side by side with `<=`/`>=` |
| 6 | **[Floors and ceilings](06-floors-and-ceilings.md)** | 🔴 a lower bound is an untested claim, an upper bound a prediction that binds every consumer; `--resolution lowest-direct`; uv's `--bounds` |
| 7 | **[`~=` and the missing caret](07-compatible-release-and-the-missing-caret.md)** | the compatible-release expansion, 🔴 why `~=1.4` and `~=1.4.2` differ by a whole series, and why Python has no caret |
| 8 | **[Pre-releases are excluded](08-pre-releases-are-excluded.md)** | 🔴 the implicit exclusion rule quoted whole, "the only available version", turning it on per package, and already-installed pre-releases |
| 9 | **[The requirement string](09-the-requirement-string.md)** | the five slots of a PEP 508 specifier, the name regex, whitespace, and parsing one with `packaging` |
| 10 | **[Direct references](10-direct-references-and-sources.md)** | `name @ url`, 🔴 why a URL makes a library unpublishable, hashes and VCS commit pins, and `tool.uv.sources` as the shape to use instead |
| 11 | **[Environment markers](11-environment-markers.md)** | the marker fields, typed comparisons, 🔴 no comparison chaining, and how a type mistake makes a dependency silently vanish |
| 12 | **[Marker fields and portability](12-markers-special-fields-and-portability.md)** | 🔴 unknown fields make a package ineligible, `extra` vs `extras`/`dependency_groups`, and markers as what makes a universal lock possible |
| 13 | **[Apps lock, libraries range](13-applications-lock-libraries-range.md)** | 🔴 PyPA's abstract/concrete distinction, why a library must not pin, why an application must not merely range, and the two files side by side |
| 14 | **[Roles, not project types](14-roles-not-project-types.md)** | the one-question test, 🔴 a library still commits a lockfile, and a lock is checked for consistency, not currency |
| 15 | **[The diamond](15-the-diamond-that-cannot-resolve.md)** | 🔴 why Python cannot nest two versions, why a published pin is the cause, multi-version forks in a lock, and pip's fix ladder |
| 16 | **[`requires-python` constrains everything](16-requires-python-constrains-everything.md)** | 🔴 your range must be a subset of every dependency's, uv ignores upper bounds on it, and per-group ranges |
| 17 | **[What a lock guarantees](17-what-a-lockfile-guarantees.md)** | 🔴 the one guarantee — no resolution at install — versions versus files, reproducible is not safe, and a locked sdist still builds |
| 17b | **[A lock never expires](17b-a-lock-never-expires.md)** | new releases, advisories and 🔴 yanks never reach a lock; `--upgrade`, `--upgrade-group`, `--upgrade-package`, `--dry-run` |
| 17c | **[Lock vs environment](17c-the-lock-is-not-the-environment.md)** | three states and a check per pair, exact vs inexact sync, 🔴 one universal lock is many environments, lock schema versions, `pylock.toml` |
| 18 | **[`uv.lock` vs `pip freeze` vs `pip-compile`](18-uv-lock-vs-pip-freeze-vs-pip-compile.md)** | 🔴 *"pip freeze … does not compute a lockfile"*, single- vs multi-environment resolution, `pip lock`, and migrating without moving a version |
| 19 | **[Hashes and hash-checking mode](19-hashes-and-hash-checking-mode.md)** | 🔴 all-or-nothing, every dependency, exact pins, local hashes only, strong algorithms, pip 26.2's `--no-require-hashes`, and uv's different default |
| 19b | **[Producing hashed files](19b-producing-hashed-files-and-your-own-project.md)** | generating hashes for every platform, 🔴 keeping your own project out of the hashed set and installing it with `--no-deps` |
| 20 | **[The CI flags that refuse to re-resolve](20-the-ci-flags-that-refuse-to-re-resolve.md)** | 🔴 uv re-locks by default; `--locked` asserts, `--frozen` trusts; `UV_LOCKED`, `uv sync --check`, and the pip-side equivalents |
| 21 | **[Extras in practice](21-extras.md)** | when a dependency earns an extra, 🔴 guarded imports, a CI job with no extras and one with all, and exporting with extras |
| 21b | **[Extras in the graph](21b-extras-in-the-lock-and-the-graph.md)** | 🔴 every extra is in your lock, extras union across the whole environment, and the `all` extra that rots |
| 22 | **[Dependency groups in practice](22-dependency-groups.md)** | groups by consumer, uv's two defaults, 🔴 one CI job per group with `--only-group` vs `--group`, production excludes by flag |
| 22b | **[Groups beyond uv](22b-groups-beyond-uv.md)** | pip's `--group`, 🔴 a group never implies the project, exporting per group, and projects with no package at all |
| 22c | **[Groups share one resolution](22c-groups-share-one-resolution.md)** | 🔴 a dev tool's ceiling can choose production's versions; `uvx`, separate projects, per-group Python ranges, the legacy table |
| 23 | **[Keeping a lock current](23-keeping-a-lock-current.md)** | refresh in slices, Dependabot for uv, 🔴 cooldowns with `exclude-newer` and their silent failure mode, reproducing a past resolution |
| 23b | **[Auditing and indexes](23b-auditing-and-where-packages-come-from.md)** | `uv audit` against OSV, `--ignore-until-fixed`, preview malware checks, and 🔴 dependency confusion versus uv's `first-index` default |
| 24 | **[Reading a resolution failure](24-reading-a-resolution-failure.md)** | 🔴 reading uv's "Because … we can conclude" proof, pip's `ResolutionImpossible`, the failure shapes, and what hides versions silently |
| 25 | **[Constraints, overrides, exclusions](25-constraints-overrides-and-declared-conflicts.md)** | 🔴 narrow vs replace vs delete, scoped overrides, workspace-root-only settings, and why none of them reaches your consumers |
| 25b | **[Declared conflicts](25b-declared-conflicts.md)** | 🔴 extras and groups resolved as separate forks, `--all-extras` stops working, workspace members, and the CPU/GPU `torch` split |

## Phase gate

You are done with this topic when you can take a real project and set up its dependencies so that a clean
machine reproduces production exactly, and defend every line. Concretely, without looking anything up:

- Say whether `1.1.post1` satisfies `==1.1`, `>1.1` and `~=1.1`, and why each answer follows from the spec.
- Explain why a library that declares `requests==2.32.3` is broken even though its own tests pass.
- Name the one thing a lockfile guarantees and three things it does not, with the mechanism that closes each.
- Write the CI steps that fail when someone edits `pyproject.toml` without re-locking, and say why `--frozen`
  does not.
- Produce a hash-checked install of a service, including the service itself.
- Decide whether a dependency is a runtime dependency, an extra or a group — and explain why a docs tool in a
  group can still change a production version.
- Read a uv "No solution found" message and name the two constraints it proves incompatible.

## Where this connects

- **[Phase 7 — Packaging, projects and tooling](../README.md)** is the phase this topic belongs to.
- **[01 · pyproject.toml](../01-pyproject-toml/README.md)** owns the fields this topic uses —
  [dependencies and markers](../01-pyproject-toml/06-dependencies-and-markers.md) and
  [extras and dependency groups](../01-pyproject-toml/07-extras-and-dependency-groups.md) as a specification;
  this topic is the practice.
- **02 · uv** *(not written yet)* covers the tool in depth — environments, `uv sync` mechanics, Docker images,
  the lockfile's upgrade and export workflow — where this topic uses uv as the reference implementation of the
  policy.
- **04 · Project layout** *(not written yet)* is where workspaces and the src layout decide which
  `pyproject.toml` a lock is computed from.
- **12 · Publishing to PyPI** *(not written yet)* is where the library half of this topic becomes public:
  the ranges you declare are what every consumer's resolver sees.

---

← Prev: [Phase 7 — Packaging, projects and tooling](../README.md) · Start → [01 · The version itself](01-pep-440-the-version-itself.md)
