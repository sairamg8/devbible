---
title: "`uv export` exists because `uv.lock` is deliberately unreadable to everything else, and every format it emits is a derived artefact that must be regenerated rather than committed and trusted"
sidebar_label: "03c · Exporting the lockfile"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Project structure and
> files* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), the release list
> ([github.com](https://github.com/astral-sh/uv/releases)) and PEP 751
> ([peps.python.org](https://peps.python.org/pep-0751/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`uv.lock` is *"specific to uv and not usable by other tools"*, which is a real cost and one uv
answers with a single command. `uv export` renders the lockfile into three formats other things can
read: a `requirements.txt` for anything that speaks pip, a `pylock.toml` for the standardised
format PEP 751 defines, and a CycloneDX SBOM for the compliance pipeline that will eventually ask
you for one. The discipline that matters is that all three are **derived artefacts**. The moment one
is committed and treated as a source of truth, you have two lockfiles that can disagree, and the
disagreement will be discovered in production. Generate them in CI, or generate and verify them.**

## The command and the three formats

> *"If you need to integrate uv with other tools or workflows, you can export `uv.lock` to different
> formats including `requirements.txt`, `pylock.toml` (PEP 751), and CycloneDX SBOM."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

```bash
uv export --format requirements.txt
uv export --format pylock.toml
uv export --format cyclonedx1.5
```

| Format | Who reads it | What it loses |
|---|---|---|
| `requirements.txt` | pip, and every platform that only accepts it | it is a flat list, so the direct/transitive distinction is gone |
| `pylock.toml` | tools implementing **PEP 751** | nothing structural; this is the standardised successor |
| `cyclonedx1.5` | SBOM / supply-chain and licence scanners | it is an inventory, not an install input |

The reason to reach for each is different, and it is worth being explicit about which problem you
are solving, because reaching for `requirements.txt` out of habit is how a project ends up with two
sources of truth.

## When you actually need an export

- **A platform that only accepts `requirements.txt`.** Plenty of managed runtimes, build images and
  internal deployment tools do exactly one thing with a Python repository. Export in CI, feed it in.
- **A scanner.** Licence and vulnerability tooling that has not learned `uv.lock` — which is most of
  it — will read `requirements.txt` or CycloneDX.
- **A consumer who does not use uv.** Handing a colleague a `requirements.txt` is kinder than
  telling them to install a tool.
- **A `pylock.toml`, when the receiving tool supports PEP 751.** This is the direction the ecosystem
  is going, and it is the export to prefer where you have the choice.

## 🔴 An export is a derived artefact, and committing it creates a second source of truth

Nothing stops you committing `requirements.txt`. What happens next is predictable: somebody changes
a dependency, re-locks `uv.lock`, and does not re-export — or exports from a different branch, or
with different group flags. Now two files describe the dependency set, they disagree, and whichever
one your deployment reads is the one that wins.

Two acceptable arrangements, and they are the only two:

**1 · Generate it in CI, never commit it.** The lockfile is the single source of truth.

```yaml
# .github/workflows/deploy.yml — fragment
- name: Render the lockfile for a platform that only speaks pip
  run: uv export --format requirements.txt --no-dev -o requirements.txt
- name: Deploy
  run: ./deploy.sh requirements.txt        # the file exists only inside the job
```

**2 · Commit it *and verify it in CI*.** If a platform requires the file to be in the repository,
make a stale one fail the build. This is the same discipline as `--locked`
([02d](02d-frozen-and-locked-in-ci.md)): the check is what makes the duplication survivable.

```yaml
- name: The committed export must match the lockfile
  run: |
    uv export --format requirements.txt --no-dev -o /tmp/requirements.expected
    diff -u requirements.txt /tmp/requirements.expected
```

What is not acceptable is committing it with no check. That is not a workflow, it is a race between
two files and a deadline.

## The flags that decide what lands in the export

An export is a rendering of a *subset*, so the same group and extra flags that govern `uv sync`
apply here ([02c](02c-uv-sync-makes-the-environment-match.md)) — and the same trap. Remember that
*"the `dev` group is special-cased and synced by default"*
([locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)), so an export intended
for production almost certainly wants `--no-dev`:

```bash
uv export --format requirements.txt --no-dev -o requirements.txt
uv export --format requirements.txt --no-dev --extra postgres -o requirements.txt
uv export --format requirements.txt --only-group docs -o requirements-docs.txt
```

⚠️ **What I could not confirm:** `--no-emit-project` was **not** present on the page I checked, so
this page does not describe it or claim what it does. If you need to exclude your own project from
an export, check `uv export --help` on the uv you are running rather than trusting a page.

## 🔴 A universal lockfile exported to `requirements.txt` is a lossy conversion

This is the part that bites. `uv.lock` is universal — it *"captures the packages that would be
installed across all possible Python markers"* — while `uv pip compile` output is, by uv's own
statement, *"platform-specific, like `pip-tools`"*
([resolution](https://docs.astral.sh/uv/concepts/resolution/)). A `requirements.txt` expresses
conditionality only through environment markers on individual lines, so a resolution that **forked**
([03](03-the-lockfile.md)) — one package at two versions under different markers — has to be
flattened somehow.

Treat every export as a rendering for *one purpose*, verify it does what you need on the platform
that will consume it, and never assume a round trip through `requirements.txt` preserves the
lockfile's guarantees. The lockfile is the artefact with the properties; the export is a projection
of it.

## `pylock.toml` is standardised — and moving

PEP 751 defines a lock file format for Python
([peps.python.org/pep-0751](https://peps.python.org/pep-0751/)), and it is the thing that will
eventually make `uv export` unnecessary for tool interoperability. uv already emits it, and it is
actively changing:

- **0.12.11** (2026-09-08), preview: *"Generate missing artifact hashes when exporting
  `pylock.toml` files to ensure they conform to PEP 751"*, and *"Warn when `pylock.toml` artifact
  hash tables are empty, which will be rejected in a future uv release"*.
- **0.12.10** (2026-09-04), preview: *"Omit `exclude-newer-package` settings for packages outside
  the resolution from `uv.lock`"*.
  — both [releases](https://github.com/astral-sh/uv/releases)

That second 0.12.11 note is an explicit promise of a future breaking change: an export that only
*warns* today will be *rejected* later. If a pipeline depends on `pylock.toml` output, pin uv
([01c](01c-installing-and-pinning-uv.md)) and read release notes on upgrade — this is exactly the
pre-1.0 behaviour this topic keeps flagging.

## Gotchas

**★ Symptom: production installed a different dependency set from the one in `uv.lock`.**
Cause: a committed `requirements.txt` that nobody re-exported after the last lock change. Fix: either
generate it in CI, or commit it *and* fail the build when it drifts.

```bash
uv export --format requirements.txt --no-dev -o /tmp/expected
diff -u requirements.txt /tmp/expected
```

**★ Symptom: an exported `requirements.txt` fed to a deployment installed pytest and ruff.**
Cause: the dev group is included by default, in exports as in syncs. Fix: exclude it explicitly.

```bash
uv export --format requirements.txt --no-dev -o requirements.txt
```

**★ Symptom: `pip install -r uv.lock` fails.**
Cause: *"The `uv.lock` format is specific to uv and not usable by other tools."* Fix: export first.

```bash
uv export --format requirements.txt -o requirements.txt
pip install -r requirements.txt
```

**★ Symptom: a `pylock.toml` export that worked on one machine is rejected on another.**
Cause: uv's `pylock.toml` handling is preview and moved in **0.12.11** — empty artifact hash tables
now warn and *"will be rejected in a future uv release."* Fix: pin uv across every machine that
produces or consumes the file.

```bash
uv self version
```

**★ Symptom: the export changes every time CI runs, producing noise in a committed file.**
Cause: you are exporting a different subset each time — different group or extra flags between the
local command and the CI one. Fix: put the exact command in one place so both use it.

```makefile
export-requirements:
	uv export --format requirements.txt --no-dev -o requirements.txt
```

**★ Symptom: a licence scanner reports dependencies you do not recognise, or misses some you do.**
Cause: a `requirements.txt` export is flat, so it cannot distinguish direct from transitive
dependencies — and if it was exported without the right extras, entire subtrees are absent. Fix: give
the scanner an SBOM, which is the format built for that question.

```bash
uv export --format cyclonedx1.5 -o sbom.json
```

**★ Symptom: your platform needs `requirements.txt` and you started maintaining it by hand alongside `pyproject.toml`.**
Cause: an understandable reflex, and it recreates the exact problem `uv.lock` solved — two
declarations that can disagree. Fix: keep one source of truth and render the other.

```bash
uv export --format requirements.txt --no-dev -o requirements.txt   # generated, never edited
```

## Interview questions

**★ Why does `uv export` exist at all?**
Because `uv.lock` is deliberately non-interoperable: uv states that the format *"is specific to uv
and not usable by other tools."* That was the cost of universal locking — no existing format could
express a cross-platform resolution, `requirements.txt` least of all, since it is a flat
platform-specific list. So uv defined its own format and provided a rendering path out of it: a
`requirements.txt` for anything that speaks pip, `pylock.toml` for the format PEP 751 standardises,
and CycloneDX for supply-chain tooling. The design point is which artefact is authoritative — the
lockfile is, and every export is a projection of it for one consumer.

**★ Why should an exported `requirements.txt` not be committed and trusted?**
Because it duplicates information that already has a single authoritative source, and duplicated
information drifts. The failure sequence is always the same: a dependency changes, `uv.lock` is
re-locked, the export is not regenerated (or is regenerated with different group flags), and now two
files in the repository describe the dependency set. Nothing errors — both are valid files — and
whichever one the deployment path reads is what production gets. There are two survivable
arrangements: generate the export inside CI so it never exists in the repository, or commit it and add
a CI step that re-exports and diffs, so a stale file fails the build. Committing it with no check is
the arrangement that eventually causes an incident.

**★ In what sense is exporting a universal lockfile to `requirements.txt` lossy?**
`uv.lock` *"captures the packages that would be installed across all possible Python markers such as
operating system, architecture, and Python version"*, and it can hold the same package at two
versions under different markers when the resolution forked. `requirements.txt` can only express
conditionality as environment markers attached to individual lines, and its natural form — as uv says
of `uv pip compile` output — is *"platform-specific, like `pip-tools`."* So the conversion is from a
structure that describes a space of environments into a format designed to describe one. The practical
rule is to treat an export as a rendering for a specific consumer, verify it on the platform that will
consume it, and never assume the export carries the lockfile's guarantees.

**★ What is `pylock.toml`, and why prefer it over `requirements.txt` where you can?**
It is the lock file format standardised by PEP 751, and uv can emit it today. Preferring it is a bet
on the ecosystem: a standardised format means the interoperability problem `uv export` exists to
paper over eventually goes away, and unlike `requirements.txt` it is designed to carry the structure a
lock actually has rather than a flattened list. The caveat is that uv's support is preview and moving
— 0.12.11 added hash generation for PEP 751 conformance and began warning that empty artifact hash
tables *"will be rejected in a future uv release"* — so any pipeline built on it needs a pinned uv and
someone reading release notes on upgrade.

**Your deployment platform only accepts `requirements.txt`. Walk through the pipeline you would build.**
The lockfile stays the single source of truth and the export never enters the repository. In CI: run
`uv lock --check` so a lockfile inconsistent with `pyproject.toml` fails immediately; `uv sync
--locked --no-dev` and run the tests against exactly the resolution being shipped; then
`uv export --format requirements.txt --no-dev -o requirements.txt` as a build step, and hand that file
to the platform. The export lives only inside the job, so there is no second artefact to keep in step.
If the platform insists on reading the file from the repository, then commit it and add the diff check
— and put the exact export command in a Makefile target so the local and CI invocations cannot drift
in their group and extra flags.

---

← Prev: [03b · Upgrading the lockfile](03b-upgrading-the-lockfile.md) · [Topic index](README.md) · Next → [04 · uv add and uv remove](04-add-and-remove.md)
