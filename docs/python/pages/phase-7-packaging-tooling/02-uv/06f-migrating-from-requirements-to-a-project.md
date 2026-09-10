---
title: "Migrating from requirements files to a uv project is a declaration step, not a conversion — the intentions file becomes the requirements, the compiled file becomes a constraint, and the first lockfile should change no version at all"
sidebar_label: "06f · Migrating to a uv project"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *From pip to a uv project*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/migration/pip-to-project/)), *Locking an
> environment* ([docs.astral.sh](https://docs.astral.sh/uv/pip/compile/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)) and the CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**A `requirements.txt` repository already contains the two things a uv project needs, just in the
wrong files: a `requirements.in` of intentions and a compiled `requirements.txt` of resolved facts.
The migration is therefore not a format conversion. It is the act of *declaring* the intentions in
`pyproject.toml` while using the resolved facts only to hold versions still, so that the first
`uv.lock` describes exactly what production already runs. Done that way, moving to uv is a
no-op for your dependency set and every upgrade that follows is its own reviewable change. Done the
obvious way — feeding the compiled file to `uv add` — it produces a `pyproject.toml` of ninety exact
pins that can never be upgraded, or, without the constraint, an unreviewed upgrade of half the tree
disguised as a tooling change.**

## Migrating a pip-interface repository to the project interface

When the decision is made to move off `requirements.txt`, the migration is a declaration step, not a
conversion step — a compiled file is *resolved fact*, and `pyproject.toml` wants *intent*. uv's
migration guide does it with the intentions file as the requirement and the compiled file as a
*constraint*:

```bash
uv init --bare                                   # a pyproject.toml and nothing else
uv add -r requirements.in -c requirements.txt    # declare intentions; keep today's versions
uv add --dev -r requirements-dev.in -c requirements-dev.txt
git rm requirements.txt requirements-dev.txt     # or regenerate with `uv export` if something reads them
```

> *"Your existing versions will be retained when producing a `uv.lock` file."*

> *"Notice we used the `requirements.in` file, which does not pin to exact versions of packages so uv
> will solve for new versions of these packages."*
> — both [from pip to a uv project](https://docs.astral.sh/uv/guides/migration/pip-to-project/)

The `-c` is what makes the migration a no-op for versions: the first `uv.lock` holds what production
already runs, and upgrading becomes a separate, reviewable step afterwards
([03b](03b-upgrading-the-lockfile.md)). Adding from the compiled `requirements.txt` as a *requirement*
instead would declare every transitive dependency as a direct one, each pinned exactly — a
`pyproject.toml` that can never be upgraded selectively.

Two details from the same guide. A dev file that begins with `-r requirements.in` re-declares the
production requirements; the guide strips those lines before adding
(`sed '/^-r /d' requirements-dev.in | uv add --dev -r - -c requirements-dev.txt`). And
platform-specific compiled files can all be passed as constraints at once
(`-c requirements-win.txt -c requirements-linux.txt`). `uv init --bare` is documented as *"Only create
a `pyproject.toml`"* ([CLI reference](https://docs.astral.sh/uv/reference/cli/)); `uv add` and its
bounds are [04](04-add-and-remove.md); keeping a `requirements.txt` for a consumer that cannot read
`uv.lock` is [03c](03c-exporting-the-lockfile.md).

## The rest of the move, in the order it should land

The declaration is the core; four smaller decisions finish the job, and each has its own chunk:

1. **Is it a package?** `uv init --bare` writes only a `pyproject.toml`. Whether your own code is then
   installed into the environment is decided by the presence of `[build-system]`
   ([01b](01b-the-project-uv-sees.md)) — a `requirements.txt` repository usually never had to answer
   that question, and `ModuleNotFoundError` on your own package is how it gets asked.
2. **Which interpreter?** Pin the development interpreter with `uv python pin` and state the supported
   range in `requires-python` — two different declarations ([05b](05b-python-version-vs-requires-python.md)).
3. **What replaces `pip install -r` in CI and the Dockerfile?** `uv sync --locked`, so a stale lockfile
   fails the job instead of being re-resolved ([02d](02d-frozen-and-locked-in-ci.md),
   [02e](02e-uv-inside-a-container-image.md)).
4. **Who still reads `requirements.txt`?** If anything does — a platform, a scanner — generate it
   from the lockfile with `uv export` and verify it in CI rather than keeping the old file
   ([03c](03c-exporting-the-lockfile.md)).

```bash
uv init --bare
uv add -r requirements.in -c requirements.txt
uv add --dev -r requirements-dev.in -c requirements-dev.txt
uv python pin 3.14
uv lock
git add pyproject.toml uv.lock .python-version
```

### Checking that the migration moved nothing

The point of the constraint is that the new lockfile should agree with the old compiled file on every
version. Render the lockfile in the old format and read the diff for *version* changes:

```bash
uv export --format requirements.txt --no-dev -o /tmp/after.txt
diff -u requirements.txt /tmp/after.txt
```

⚠️ Do not expect the two files to be byte-identical — the export is a different renderer from the one
that produced your old file, and I could not confirm that it lays out comments, markers or hashes the
same way. What must not differ is the version on each line. A version that moved is the constraint not
having been applied, and is worth stopping for before anything is committed.

### Platform-specific compiled files

A repository that compiled one `requirements.txt` per platform — because a Windows-only or Linux-only
dependency made one file impossible — carries that knowledge only in the compiled files. The guide's
answer is to regenerate each with its markers kept, then pass all of them as constraints:

```bash
uv pip compile requirements.in -o requirements-win.txt --python-platform windows --no-strip-markers
uv add -r requirements.in -c requirements-win.txt -c requirements-linux.txt
```

After the move the platform split disappears as a *file* concern, because `uv.lock` is universal
([03](03-the-lockfile.md)) — the conditionality lives on as markers inside one lockfile.

## Gotchas

**Symptom: after migrating, `pyproject.toml` lists ninety exact pins and `uv lock --upgrade` moves nothing.**
Cause: the migration added the *compiled* file as requirements, so every transitive dependency became
a direct, exactly-pinned requirement. Fix: re-declare from the intentions file and pass the compiled
file only as a constraint.

```bash
git checkout pyproject.toml
uv add -r requirements.in -c requirements.txt
```

**Symptom: the migration itself upgraded half the dependency tree, and the first deploy on uv broke.**
Cause: `uv add -r requirements.in` without a constraint re-solves — the guide says so: it *"does not
pin to exact versions of packages so uv will solve for new versions of these packages."* Fix: migrate
first, upgrade later.

```bash
uv add -r requirements.in -c requirements.txt    # the lock reproduces what production runs today
```

**★ Symptom: after migration the `dev` group contains every production dependency a second time.**
Cause: `requirements-dev.in` began with `-r requirements.in`, and adding it re-declared the production
requirements into the group. Fix: strip the include lines before adding, as uv's guide does.

```bash
sed '/^-r /d' requirements-dev.in | uv add --dev -r - -c requirements-dev.txt
```

**★ Symptom: `uv sync` succeeds after the migration, and `import myservice` fails.**
Cause: `uv init --bare` writes only a `pyproject.toml`; with no `[build-system]`, uv installs *"just
its dependencies"* and never the project ([01b](01b-the-project-uv-sees.md)). Fix: declare a backend
if the code is a package.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Symptom: the Windows developers lost a dependency in the migration; Linux is fine.**
Cause: the constraint file you passed was compiled on Linux, so the Windows-only requirement was not
in it and the platform knowledge was dropped. Fix: regenerate each platform's file with markers kept,
and constrain with all of them.

```bash
uv pip compile requirements.in -o requirements-win.txt --python-platform windows --no-strip-markers
uv add -r requirements.in -c requirements-win.txt -c requirements-linux.txt
```

**Symptom: three months after the migration, `requirements.txt` and `uv.lock` disagree and a deploy used the wrong one.**
Cause: the old file was kept "for safety" and never regenerated, so there are two sources of truth.
Fix: delete it, or regenerate and verify it in CI ([03c](03c-exporting-the-lockfile.md)).

```yaml
- run: |
    uv export --format requirements.txt --no-dev -o /tmp/requirements.expected
    diff -u requirements.txt /tmp/requirements.expected
```

**Symptom: CI is green after the migration, but the lockfile turns out to have been re-resolved in the job.**
Cause: the pipeline was switched from `pip install -r requirements.txt` to plain `uv sync`, which
locks automatically when `pyproject.toml` has drifted. Fix: forbid it
([02d](02d-frozen-and-locked-in-ci.md)).

```bash
uv sync --locked
```

## Interview questions

**★ Why pass the compiled `requirements.txt` with `-c` rather than adding it with `-r`?**
Because a constraint and a requirement mean different things to the resolver, and the migration needs
the first. A requirement says *install this*; a constraint says *if you install this, it must be this
version*. Passing the compiled file with `-r` declares every transitive dependency as a direct one,
each pinned exactly, which destroys the declared-versus-resolved distinction the project interface
exists to create. Passing it with `-c` leaves the declaration to the hand-written `.in` file — so
`pyproject.toml` records intentions — while the constraint holds every version where production has
it. uv's guide states the effect in one line: *"Your existing versions will be retained when producing
a `uv.lock` file."*

**★ What belongs in the migration pull request, and what does not?**
The declaration, the lockfile, the interpreter pin, and the CI and Dockerfile switch to
`uv sync --locked` belong together, because they are one change of tooling. A version upgrade does
not — and the constraint file is what keeps one from sneaking in. The reviewer of a migration PR should
be able to confirm that no dependency version moved, which is checkable by rendering the new lockfile
back to requirements format and comparing versions line by line. Upgrades then arrive as ordinary
`uv lock --upgrade-package` changes in later PRs, each small enough to review and to revert. A
migration that also upgrades cannot be reverted without also reverting the upgrade, and a regression
found a week later cannot be attributed to either.

**What happens to per-platform requirements files once a project has a universal lockfile?**
They stop being necessary as files, because the platform knowledge moves into the lockfile. A
pip-interface repository needs one compiled file per platform when the dependency set genuinely
differs, since `uv pip compile` output is platform-specific by default. `uv.lock` resolves for every
platform at once and expresses the differences as environment markers — so after the migration there
is one lockfile, and `uv sync` on each platform installs the subset that applies there. During the
migration the per-platform files are still valuable: compiled with `--no-strip-markers` and passed
together as constraints, they are what carries the existing per-platform versions into that single
lockfile.

**How do you migrate a `requirements.in` / `requirements.txt` repository to the project interface without losing the ability to upgrade?**
By declaring from the intentions file and constraining with the compiled one, which is exactly what
uv's migration guide does: `uv add -r requirements.in -c requirements.txt`. The `.in` file becomes the
direct requirements, with the bounds uv writes; the `.txt` file acts only as a constraint, so that
*"your existing versions will be retained when producing a `uv.lock` file."* If you feed it the
compiled file as requirements instead, every transitive dependency becomes a direct requirement pinned
with `==`, and the lockfile can never move a version on its own — `uv lock --upgrade` has nothing it is
permitted to change. If you drop the `-c`, the migration silently doubles as an upgrade, which is two
risky changes in one commit. After the move, delete the compiled file or replace it with an
`uv export` generated in CI, so there is one source of truth rather than two that drift.

---

← Prev: [06e · uv pip install, sync, compile](06e-uv-pip-install-sync-and-compile.md) · [Topic index](README.md) · Next → [07 · uvx — running tools](07-uvx-and-tools.md)
