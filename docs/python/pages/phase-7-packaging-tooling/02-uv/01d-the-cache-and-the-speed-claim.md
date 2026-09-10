---
title: "uv's speed comes from a global cache it links out of rather than copies out of, which is why the cache has to sit on the same filesystem as the environment and why containers need `UV_LINK_MODE=copy`"
sidebar_label: "01d · The cache and the speed claim"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Caching*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/cache/)), *Using uv in Docker*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)), the environment
> variable reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)),
> *Installation* ([docs.astral.sh](https://docs.astral.sh/uv/getting-started/installation/)) and
> the uv documentation home ([docs.astral.sh](https://docs.astral.sh/uv/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings** — the only speed figure on this page is
> uv's own published claim, quoted and attributed.

**uv's documentation home advertises *"10-100x faster than `pip`"*. That is uv's claim, not a
measurement made anywhere in this corpus, and nothing here reports a timing. What *is*
documented, and what you actually need in order to debug uv, are the mechanisms: one global
cache shared by every project on the machine, and installation that places files into an
environment by linking them out of that cache rather than copying them. Both facts have
consequences you will meet. Linking only works within a filesystem, which is why uv's docs say
the cache should live on the same filesystem as the environment and why every Docker example
sets `UV_LINK_MODE=copy`. And a cache full of hardlinked files is a cache you must not delete
casually, which is why uv ships a CI-shaped prune that is not the same thing as a clean.**

## The three directories uv owns outside your project

uv's own uninstall instructions are the clearest documentation of its footprint:

> `uv cache clean`
> `rm -r "$(uv python dir)"`
> `rm -r "$(uv tool dir)"`
> — [installation](https://docs.astral.sh/uv/getting-started/installation/)

| Store | What is in it | Relocated by |
|---|---|---|
| cache | downloaded and unpacked distributions, built wheels | `UV_CACHE_DIR` / `--cache-dir` / `tool.uv.cache-dir` |
| managed Pythons | interpreters uv downloaded — [05](05-uv-python.md) | `UV_PYTHON_INSTALL_DIR` |
| tools | environments for `uv tool install` — [07](07-uvx-and-tools.md) | `UV_TOOL_DIR` |

The env-var descriptions are verbatim from the [environment
reference](https://docs.astral.sh/uv/reference/environment/): `UV_PYTHON_INSTALL_DIR`
*"Specifies the directory for storing managed Python installations"*, `UV_TOOL_DIR`
*"Specifies the directory where uv stores managed tools"*. Learn the `uv cache dir`,
`uv python dir` and `uv tool dir` subcommands rather than the default paths — they print the
truth on the machine in front of you, which is the only thing that helps at 2am.

## Where the cache lives, in the order uv decides

> *"uv determines the cache directory according to, in order: 1. A temporary cache directory,
> if `--no-cache` was requested. 2. The specific cache directory specified via `--cache-dir`,
> `UV_CACHE_DIR`, or `tool.uv.cache-dir`"*
> — [caching](https://docs.astral.sh/uv/concepts/cache/)

Note what `--no-cache` does: it does **not** disable caching, it redirects it to a temporary
directory that is discarded. That distinction matters — a `--no-cache` run still needs
somewhere to unpack a wheel before installing it, and still needs disk space for it.

## 🔴 The cache must be on the same filesystem as the environment

This is the single most load-bearing sentence on uv's caching page:

> *"It is important for performance for the cache directory to be located on the same file
> system as the Python environment uv is operating on."*
> — [caching](https://docs.astral.sh/uv/concepts/cache/)

The reason is what "install" means here. Placing a package into an environment can be done by
copying bytes, or by creating a link to bytes that already exist in the cache. A link is
essentially free and consumes no additional space, which is what uv's *"Disk-space efficient,
with a global cache for dependency deduplication"* claim
([docs.astral.sh/uv](https://docs.astral.sh/uv/)) refers to — but a hardlink cannot cross a
filesystem boundary. When the cache and the environment are on different filesystems, linking is
impossible and uv falls back to copying.

The Docker guide documents exactly that situation and its remedy:

> *"Changing the `UV_LINK_MODE` silences warnings about not being able to link files since the
> cache and sync target are on separate file systems."*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
ENV UV_LINK_MODE=copy
```

⚠️ **What I could not confirm:** uv's caching page does not enumerate the `--link-mode` values
or state the default per platform, and the CLI reference describes the flag only as *"The method
to use when installing packages from the global cache"*. So this page does not name a default —
if you need to know it for a specific platform, read the settings reference for the uv version
you are running rather than trusting a page. What *is* documented is the failure mode (a warning
about not being able to link) and the fix (`UV_LINK_MODE=copy`).

## `uv cache prune --ci` is not `uv cache clean`

Two commands, and using the destructive one in CI throws away the expensive half of the cache:

> *"uv provides a `uv cache prune --ci` command, which removes all pre-built wheels and unzipped
> source distributions from the cache, but retains any wheels that were built from source."*

> *"`uv cache clean` removes all cache entries from the cache directory, clearing it out
> entirely."*
> — both [caching](https://docs.astral.sh/uv/concepts/cache/)

The asymmetry is the point. A pre-built wheel is cheap to re-download. A wheel that uv *built*
from a source distribution cost a compiler run — possibly a long one, for anything with C
extensions. `prune --ci` is shaped exactly for a cache that gets saved and restored between
jobs: keep what was expensive, discard what a network fetch can replace.

```yaml
# .github/workflows/ci.yml — fragment: shrink the cache before it is uploaded
- name: Install from the lockfile
  run: uv sync --locked
- name: Test
  run: uv run pytest
- name: Trim the cache for storage
  run: uv cache prune --ci
```

## Invalidation: `--refresh` and `--reinstall` are different questions

> *"To force uv to revalidate cached data for all dependencies, pass `--refresh` to any command
> (e.g., `uv sync --refresh`)"*

> *"To force uv to ignore existing installed versions, pass `--reinstall` to any installation
> command"*
> — both [caching](https://docs.astral.sh/uv/concepts/cache/)

- `--refresh` distrusts the **cache**: re-check the index, re-fetch metadata and distributions.
  Use it when you suspect uv is serving you a stale view of a registry — a package you just
  published, a mutable internal index.
- `--reinstall` distrusts the **environment**: put the package back regardless of what is
  already installed. Use it when `site-packages` has been damaged — a half-deleted directory, a
  file you edited in place inside `.venv`, an environment that outlived a Python upgrade.

They compose, and knowing which one you need is the difference between a two-second fix and
re-downloading the world.

## Two safety properties worth knowing

> *"Each bucket is versioned, such that if a release contains a breaking change to the cache
> format, uv will not attempt to read from or write to an incompatible cache bucket."*
> — [caching](https://docs.astral.sh/uv/concepts/cache/)

This explains a specific confusing observation: after upgrading uv, a build can appear to lose
its warm cache. It has not been corrupted — the new uv declined to read a bucket in a format it
does not accept. Given uv's release cadence ([01c](01c-installing-and-pinning-uv.md)), a
long-lived CI cache and an unpinned uv can produce a "why is CI slow again" cycle with no
visible cause. Pinning uv keeps the bucket version stable too.

> *"uv's cache is designed to be thread-safe and append-only, and thus robust to multiple
> concurrent readers and writers."*
> — [caching](https://docs.astral.sh/uv/concepts/cache/)

So several uv processes may share one cache — parallel CI jobs on a shared runner, a monorepo
syncing several projects at once. Append-only is also why *deleting* from it is a separate,
explicit command rather than something uv does opportunistically.

The other half of this — the Docker cache mount that gives a build layer a persistent uv cache,
and `UV_COMPILE_BYTECODE` — is an image-build concern rather than a cache concern, so it sits
with the container recipes in [02e](02e-uv-inside-a-container-image.md).

## Gotchas

**★ Symptom: every `uv sync` in your container build warns that files could not be linked.**
Cause: the cache and the target environment are on separate filesystems — a cache mount, a
bind-mounted volume, a `/tmp` on a different device. Fix: tell uv to copy, per its own Docker
guidance.

```dockerfile
ENV UV_LINK_MODE=copy
```

**★ Symptom: disk usage keeps climbing on a build agent that never installs anything twice.**
Cause: uv's three global stores — cache, managed Pythons, installed tools — persist, and none of
them lives inside your project, so cleaning the workspace does nothing. Fix: prune the cache the
CI-shaped way and remove the stores that agent does not need.

```bash
uv cache prune --ci
rm -r "$(uv python dir)"
rm -r "$(uv tool dir)"
```

**★ Symptom: CI got slow again after a uv upgrade, and the cache step reports a hit.**
Cause: the cache is bucket-versioned — *"if a release contains a breaking change to the cache
format, uv will not attempt to read from or write to an incompatible cache bucket."* The archive
restored fine; uv declined to use it. Fix: pin uv so the bucket format stops moving, and include
the uv version in the cache key so a real upgrade starts a clean bucket rather than carrying a
dead one.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/uv
    key: uv-0.12.12-${{ hashFiles('uv.lock') }}
```

**★ Symptom: you published a package and uv keeps resolving the previous version.**
Cause: cached index metadata. Fix: revalidate the cache rather than deleting it.

```bash
uv sync --refresh
uv lock --refresh-package my-internal-lib     # narrower: one package
```

**★ Symptom: a package imports but its files are visibly broken in `site-packages` — and `--refresh` does not help.**
Cause: wrong tool. `--refresh` distrusts the cache; the damage is in the environment. Fix: use
the flag that distrusts the environment.

```bash
uv sync --reinstall-package pydantic
uv sync --reinstall                       # everything, when you cannot narrow it
```

**★ Symptom: `--no-cache` did not reduce disk usage during a build.**
Cause: `--no-cache` does not mean "no cache" — uv uses *"a temporary cache directory, if
`--no-cache` was requested."* The space is still needed; it is just not kept. Fix: if the goal
is a small final image, discard the cache in the same layer or use a cache mount instead.

```dockerfile
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked
```

**★ Symptom: an air-gapped or network-restricted runner fails on a package that "was already cached".**
Cause: the cache holds distributions, but resolution may still want to talk to the index; a
warm cache is not the same as an offline-capable one. Fix: resolve nothing at all in that
environment — install strictly from the committed lockfile.

```bash
uv sync --frozen        # do not even check whether uv.lock is up to date — 02d
```

## Interview questions

**★ Why does uv's documentation insist the cache be on the same filesystem as the environment?**
Because installation is implemented as linking out of the cache rather than copying into the
environment, and a hardlink cannot cross a filesystem boundary. uv's caching page states it as a
performance requirement — *"It is important for performance for the cache directory to be
located on the same file system as the Python environment uv is operating on"* — and the Docker
guide names the observable symptom when it is violated: warnings *"about not being able to link
files since the cache and sync target are on separate file systems."* This is also where uv's
disk-space claim comes from: one copy of a package in the cache, linked into every environment
that needs it, rather than N copies. Split the filesystems and you lose both the speed and the
deduplication, silently, with only a warning to tell you.

**★ What is the difference between `uv cache clean` and `uv cache prune --ci`, and which belongs in CI?**
`clean` *"removes all cache entries from the cache directory, clearing it out entirely."*
`prune --ci` *"removes all pre-built wheels and unzipped source distributions from the cache, but
retains any wheels that were built from source."* The prune is the CI one, and the reasoning is
about cost asymmetry: a pre-built wheel can be re-fetched from an index in a moment, while a
wheel uv built from a source distribution cost a compiler invocation that may be the slowest
thing in your pipeline. So `prune --ci` shrinks the archive you upload while keeping precisely
the entries that are expensive to recreate. Running `clean` in the same position throws away the
compile results and guarantees you pay for them again next run.

**★ `--refresh` or `--reinstall`: how do you choose?**
By asking which store you distrust. `--refresh` *"force[s] uv to revalidate cached data for all
dependencies"* — it is about the **cache**, so it is the right flag when uv's view of a registry
is stale: you just published a version, or an internal index moved a tag. `--reinstall`
*"force[s] uv to ignore existing installed versions"* — it is about the **environment**, so it is
the right flag when `site-packages` is damaged: a partially deleted package, a file someone
edited in place, an environment that survived an interpreter upgrade. Choosing wrong is not
harmful but it is slow and it does not fix the problem, which is the worst combination while
debugging.

**★ How would you quote uv's performance to a colleague who asks "is it really 100x faster"?**
By attributing it. uv's own documentation home says *"10-100x faster than `pip`."* — that is a
vendor claim on a marketing surface, with no stated workload, no stated baseline pip version and
no stated cache state, and nothing in this corpus has measured it. What can be said without
hedging is *why* it could be dramatically faster: a Rust implementation, a resolver that is not
a Python program, a global cache shared across projects, and installation by linking rather than
copying — plus the fact that a warm cache and a cold cache are entirely different workloads. If
the number matters for a decision, measure it on your dependency set, on your CI runner, with
the cache state your pipeline actually has. Repeating a multiplier as though you had measured it
is how a page loses its credibility.

**Why can a uv upgrade make a warm CI cache useless, and how do you stop that from being a mystery?**
Because the cache is bucket-versioned: *"if a release contains a breaking change to the cache
format, uv will not attempt to read from or write to an incompatible cache bucket."* The cache
restore step still reports success — the archive is there — but the new uv declines to read part
of it, so the job downloads and rebuilds. The fix is two-part: pin uv (so the format stops moving
without a commit), and put the uv version into the cache key, so that when you *do* upgrade, the
job starts a fresh bucket instead of carrying a dead one around forever.

**Several CI jobs share one runner and one uv cache. Is that safe?**
Yes, and uv says so explicitly: *"uv's cache is designed to be thread-safe and append-only, and
thus robust to multiple concurrent readers and writers."* Append-only is the property that makes
concurrency safe — nobody mutates an existing entry — and it is also why removal is a separate
explicit command (`prune`, `clean`) rather than something uv does opportunistically. The
practical caveat is the flip side: because nothing evicts entries automatically, an
append-only cache on a long-lived agent grows until you prune it. That is a disk-monitoring
task, not a uv bug.

---

← Prev: [01c · Installing and pinning uv](01c-installing-and-pinning-uv.md) · [Topic index](README.md) · Next → [02 · The environment uv expects](02-the-environment-uv-expects.md)
