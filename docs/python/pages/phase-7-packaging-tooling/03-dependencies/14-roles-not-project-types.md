---
title: "\"Library\" and \"application\" are roles decided by whether anything declares a dependency on you — one repository can be both, a library still commits a lockfile, and the lock is checked for consistency rather than for being up to date"
sidebar_label: "14 · Roles, not project types"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Creating projects**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/init/), **uv 0.12.12**), uv's
> **Locking and syncing** ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)),
> uv's **Project structure and files**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)) and **PEP 735**
> ([peps.python.org](https://peps.python.org/pep-0735/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**The previous page's rule is often mis-taught as being about project *kinds* — "libraries do this,
apps do that" — when it is really about a single question: does anything else declare a dependency on
you? A repository can be a library for one purpose and an application for another; a monorepo is
routinely both. Two conclusions follow that surprise people. A library still commits a lockfile,
because reproducible CI is not a library-versus-application question. And a lockfile is checked for
*consistency with the declaration*, not for being current — widening a range does not make the lock
stale, and a new release upstream never does.**

## The test is one question

| | Library role | Application role |
|---|---|---|
| Something else declares a dependency on it | yes | no |
| `[project.dependencies]` | widest ranges you have evidence for | ranges, often just floors |
| Lockfile committed | yes — for **your own** CI | yes — it *is* the deployment contract |
| Lockfile read by consumers | never; it is not metadata a wheel carries | n/a |
| Exact pins belong in | nothing you publish | the lockfile |
| A speculative upper bound costs | every consumer, forever | you, once |

uv's scaffolding encodes the distinction at `init` time, and its wording is about *distribution*, not
about code shape:

> *"When creating projects, uv supports two basic templates: applications and libraries. By default, uv
> will create a project for an application. The `--lib` flag can be used to create a project for a library
> instead."*

> *"A library provides functions and objects for other projects to consume. Libraries are intended to be
> built and distributed, e.g., by uploading them to PyPI."*

> *"Application projects are suitable for web servers, scripts, and command-line interfaces."*

> *"Libraries always require a packaged project."*

Both templates now define a build system, which uv changed deliberately:

> *"In both cases, uv prefers to define a build system and place source files in a dedicated
> `src/<project_name>/` directory. Defining a build system allows use of various Python packaging features,
> such as adding command-line entry points, and avoids common points of confusion with the Python import
> system."*

> *"Prior to v0.12, uv did not define a build system for applications by default."*

So "is it packaged?" no longer distinguishes the two. The distinguishing question remains "does anything
depend on it?", and a project can answer yes for one consumer and no for another — a service that also
publishes a client SDK is both, and the SDK's declarations must be wide while the service's lock must be
exact.

## A library still commits a lockfile

The mechanical facts, which are what you can rely on:

- A lockfile is **not** metadata. A wheel carries `Requires-Dist` entries; it does not carry a lock. A
  consumer resolving your library reads the former and cannot read the latter.
- Therefore your lock constrains **only your own** environments: CI, your contributors' machines, your
  docs build.
- Therefore committing it is a reproducibility decision about your own repository and imposes nothing on
  anyone.

Beyond that, practice diverges. Some library maintainers deliberately do **not** commit a lock so that
CI resolves fresh every run and thereby exercises the declared range; others commit one and add a
separate scheduled CI job that resolves without it. 🔴 **I could not find a PyPA or uv statement
prescribing either practice**, so this page does not claim one. What it does claim is the mechanism
above, plus the observation that whichever you choose, you need *some* job that resolves outside the
lock — otherwise the ranges in your published metadata are never tested at all
([06](06-floors-and-ceilings.md)).

```yaml
# .github/workflows/ci.yml — a library that commits a lock, and still tests the range
jobs:
  reproducible:
    steps:
      - run: uv sync --locked          # exactly what the lock says
      - run: uv run pytest -q

  fresh-resolution:                     # nightly: does the declared range still work?
    steps:
      - run: uv sync --upgrade
      - run: uv run pytest -q

  declared-floors:                      # does the bottom of the range still work?
    steps:
      - run: uv sync --resolution lowest-direct
      - run: uv run pytest -q
```

PEP 735 names the library case explicitly among its motivating use cases — *"Libraries with unpublished
dev dependency groups"* — which is the same idea one level down: a library needs private, local
development requirements that consumers never see ([22](22-dependency-groups.md)).

## Where the declaration and the lock disagree, and which wins

The declaration wins by construction: a lock is derived from it. uv makes the staleness rule precise,
and it is narrower than people assume:

> *"When considering if the lockfile is up-to-date, uv will check if it matches the project metadata. For
> example, if you add a dependency to your `pyproject.toml`, the lockfile will be considered outdated.
> Similarly, if you change the version constraints for a dependency such that the locked version is
> excluded, the lockfile will be considered outdated. However, if you change the version constraints such
> that the existing locked version is still included, the lockfile will still be considered up-to-date."*

Three cases, and the third is the one that catches reviewers:

| Change to `pyproject.toml` | Lock considered outdated? |
|---|---|
| add or remove a dependency | **yes** |
| tighten a range so the locked version no longer satisfies it | **yes** |
| widen a range, or tighten it while the locked version still satisfies it | **no** |

So relaxing `httpx>=0.28` to `httpx>=0.27` leaves the lock valid and `uv sync --locked` green — the
locked version still satisfies the new range. The lock is checked for *consistency*, not for
*optimality*. And separately:

> *"uv will not consider lockfiles outdated when new versions of packages are released — the lockfile needs
> to be explicitly updated if you want to upgrade dependencies."*

Both facts together mean a lock is a **record of a decision**, and decisions do not expire on their own.
[17](17-what-a-lockfile-guarantees.md) is the full account of what that record does and does not
guarantee.

## Gotchas

**★ Symptom: a downstream team asks you to loosen a bound and you cannot, because "your lock pins it".**
Cause: a confusion about which file constrains them. Your lock does not affect consumers at all — only
your declared ranges do, because only those become `Requires-Dist` in the wheel. Fix: look at what you
actually published; the change is usually one word in `dependencies` and no change to the lock:

```bash
python -c "from importlib.metadata import metadata; print(metadata('acme-reports').get_all('Requires-Dist'))"
```

**★ Symptom: the lockfile is committed and CI still installs different versions each week.** Cause:
nothing is asserting that the lock is *used*. `uv sync` will happily update a stale lock, and `uv run`
locks and syncs automatically — *"Locking and syncing are automatic in uv."* Fix: the assertive flags,
covered in [20](20-the-ci-flags-that-refuse-to-re-resolve.md):

```bash
- uv sync
+ uv sync --locked        # fails if the lock is missing or does not match the declaration
```

**★ Symptom: a library publishes fine and the sdist is missing the lockfile, breaking a downstream build
that expected it.** Cause: a lockfile is not part of the published dependency contract, so depending on
one means depending on an implementation detail of your repository. Fix: whatever the downstream build
needed belongs in metadata — `[project.dependencies]` for runtime, a dependency group for tooling
([22](22-dependency-groups.md)) — not in a file consumers cannot rely on.

**★ Symptom: `uv sync --locked` passes after a `pyproject.toml` change that a reviewer expected to
require a re-lock.** Cause: the change widened the range, and *"if you change the version constraints such
that the existing locked version is still included, the lockfile will still be considered up-to-date."*
This is correct behaviour and it means "the lock is consistent" is not the same claim as "the lock reflects
what you would resolve today". Fix: if you *want* the widened range exercised, resolve deliberately:

```bash
uv lock --upgrade-package httpx     # move within the new range, on purpose
```

**★ Symptom: a repository publishes a library *and* deploys a service, and the two keep fighting over
bounds.** Cause: one `pyproject.toml` doing two jobs. Fix: split them into workspace members so each has
its own declaration, with one lock at the root:

```toml
# root pyproject.toml
[tool.uv.workspace]
members = ["packages/acme-client", "services/reports-api"]
```

The client keeps wide ranges because strangers depend on it; the service keeps whatever ranges are
convenient because nothing does.

**★ Symptom: an application's CI is reproducible and a *contributor's* machine is not.** Cause: the
contributor runs `uv run` (which resolves and syncs as needed) rather than `uv sync --locked`, so a stale
lock is silently refreshed locally. Fix: make the strict behaviour the default for everyone through the
environment rather than through discipline:

```bash
export UV_LOCKED=1        # documented as the env form of --locked
```

**★ Symptom: a new team member cannot tell whether a project is "a library" and asks for a rule.** Cause:
the question is usually asked about code shape (does it have a `src/` layout? a build backend?) which no
longer distinguishes anything, since uv defines a build system for both templates. Fix: ask the real
question — *does anything declare a dependency on this?* — and answer it by looking for the project's name
in someone else's `[project.dependencies]`.

## Interview questions

**★ Does a library commit its lockfile?**
For its own CI, yes — reproducible CI is not a library-versus-application question. The fact that matters is
mechanical: a lockfile is not metadata a wheel carries, so a consumer resolving your library reads your
`Requires-Dist` entries and never your lock. Committing it therefore constrains only you. Some maintainers
deliberately do not commit one so CI resolves fresh and exercises the declared range; I could not find a
PyPA or uv statement prescribing either practice, so treat it as a project decision — but either way, keep a
job that resolves *outside* the lock, or your published ranges are untested claims.

**★ Two libraries in one monorepo, plus a service that uses both. What does each file look like?**
Each library gets a `pyproject.toml` with wide ranges, because each is published and its declarations
intersect with strangers'. The service gets ranges too, plus the lock that defines its deployment. The
libraries are wired into the service by *source*, not by URL —
`[tool.uv.sources] acme-core = { path = "../acme-core", editable = true }`
([10](10-direct-references-and-sources.md)) — so the published metadata stays abstract while local
development uses the working copy. One lock at the workspace root covers all members, which is what makes
"CI tested exactly this" true across the whole repository.

**★ You widen a dependency range and `uv sync --locked` still passes. Is the lock wrong?**
No, and this is worth being precise about. uv checks the lock against *the declaration*, not against the
index: *"if you change the version constraints such that the existing locked version is still included, the
lockfile will still be considered up-to-date."* The locked version satisfies the wider range, so the lock is
consistent. What it is not is *current* — and it never becomes stale on its own, because *"uv will not
consider lockfiles outdated when new versions of packages are released."* If you widened the range in order
to move, say so with `uv lock --upgrade-package <name>`.

**★ Where does the "library versus application" distinction actually bite, given both are now packaged the
same way?**
In three places, all downstream of "does anything depend on you". First, upper bounds: yours intersect with
every consumer's, so a speculative ceiling in a library is a cost imposed on strangers, while in an
application it costs only you. Second, exact pins: forbidden in anything you publish (*"strongly
discouraged as it greatly complicates the deployment of security fixes"*), fine in a lock. Third,
concreteness: a direct URL or an index option in a library's metadata removes its consumers' ability to
choose a source, whereas an application may name its index freely. Code layout and build backend no longer
distinguish the two at all.

**★ A single service repo is also the source of a published SDK. What is the smallest change that keeps both
correct?**
Make them two distributions in a workspace, so each has its own `[project]` table. The SDK declares wide
ranges and is published; the service declares whatever it likes and is deployed from the shared lock. Without
that split you are forced to pick one policy for one file, and both choices are wrong: wide ranges leave the
service under-specified for deployment, and tight ranges leak into the SDK's published metadata, where they
constrain every consumer.

---

← [13 · Apps lock, libraries range](13-applications-lock-libraries-range.md) · [Topic index](README.md) · Next → [15 · The diamond that cannot resolve](15-the-diamond-that-cannot-resolve.md)
