---
title: "A lock never expires — upstream can publish a fix, yank a broken release or disclose a CVE and the lock keeps installing what you chose, so every upgrade is an act you perform, bounded by your own ceilings"
sidebar_label: "17b · A lock never expires"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Locking and syncing**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/), **uv 0.12.12**), uv's
> **CLI reference** for `uv sync` and `uv lock`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and **PEP 592**, *Adding "Yank" Support
> to the Simple API* ([peps.python.org](https://peps.python.org/pep-0592/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**The second gap between what a lock is and what people assume it is: time. A lock records a decision,
and a decision does not change because the world did. Upstream publishing a patched release does not make
it stale; a maintainer yanking the version you locked does not make it stale; an advisory against it does
not make it stale. That is the correct design — the alternative is an install that changes without anyone
choosing — but it means currency is a job you do, with commands that have a precise and deliberately
narrow scope, and a ceiling in your own `pyproject.toml` quietly limits every one of them.**

## Gap 2 — a lock never expires

🔴 > *"uv will not consider lockfiles outdated when new versions of packages are released — the lockfile
needs to be explicitly updated if you want to upgrade dependencies."*

A lock is a record of a decision, and decisions do not go stale on their own. This is a feature: the
alternative is an install that quietly differs from the one you tested. But it means **"we have a
lockfile" is not a security posture** — nothing in the mechanism notices that a locked version was
yanked or has a published advisory. Upgrading is an action you take:

> *"To upgrade all packages: `uv lock --upgrade` · To upgrade a single package to the latest version, while
> retaining the locked versions of all other packages: `uv lock --upgrade-package <package>` · To upgrade a
> single package to a specific version: `uv lock --upgrade-package <package>==<version>`"*

> *"In all cases, upgrades are limited to the project's dependency constraints. For example, if the project
> defines an upper bound for a package then an upgrade will not go beyond that version."*

That last sentence is why a stale ceiling is worse in a locked project than in an unlocked one: the
ceiling silently caps `--upgrade`, and the lock makes the result look deliberate.

The preference rule that keeps upgrades minimal:

> *"With an existing `uv.lock` file, uv will prefer the previously locked versions of packages when running
> `uv sync` and `uv lock`. Package versions will only change if the project's dependency constraints exclude
> the previous, locked version."*

## A yank does not reach a lock

PyPI's own withdrawal mechanism does not help here either. A maintainer who discovers a broken release
*yanks* it, and PEP 592 defines what that means to an installer:

> *"Yanked files are always ignored, unless they are the only file that matches a version specifier that
> "pins" to an exact version using either `==` (without any modifiers that make it a range, such as `.*`) or
> `===`."*

> *"Regardless of the specific strategy that an installer chooses for deciding when to install yanked files,
> an installer SHOULD emit a warning when it does decide to install a yanked file."*

> *"The value of the `data-yanked` attribute, if present, is an arbitrary string that represents the reason
> for why the file has been yanked."*

A lock is precisely the case that exception was written for — every entry is an exact pin — so a yanked
version stays installable from it by design. And uv states that it does not take even the warning path when
the source is a lock:

🔴 > *"Note that, when installing from a lockfile, uv will not provide warnings for yanked package versions."*

The maintainer's "do not use this" therefore reaches every *new* resolution and never reaches your lock.
What notices is a deliberate re-resolution of that package, or an audit against an advisory database —
both in [23](23-keeping-a-lock-current.md).

## What `uv lock` does when you ask it for nothing

The command's own contract is narrower than its name suggests:

> *"If the project lockfile (uv.lock) does not exist, it will be created. If a lockfile is present, its
> contents will be used as preferences for the resolution. If there are no changes to the project's
> dependencies, locking will have no effect unless the --upgrade flag is provided."*

The three levers, from widest to narrowest:

| Flag | Scope, quoted from the CLI reference |
|---|---|
| `--upgrade`, `-U` | *"Allow package upgrades, ignoring pinned versions in any existing output file. Implies --refresh"* |
| `--upgrade-group <group>` | *"Allow upgrades for all packages in a dependency group, ignoring pinned versions in any existing output file"* |
| `--upgrade-package`, `-P <name>` | *"Allow upgrades for a specific package, ignoring pinned versions in any existing output file. Implies --refresh-package"* |

and the one that writes nothing — `--dry-run`, *"Perform a dry run, without writing the lockfile … uv will
resolve the project's dependencies and report on the resulting changes, but will not write the lockfile to
disk."* The same flags work on `uv sync` and `uv run`: *"These flags can also be provided to uv sync or uv run
to update the lockfile and the environment."*

## Gotchas

**★ Symptom: a lockfile has been committed for a year and nobody noticed a CVE in a pinned dependency.**
Cause: *"uv will not consider lockfiles outdated when new versions of packages are released."* A lock is a
decision, not a monitor. Fix: schedule the upgrade and let CI judge it:

```yaml
# .github/workflows/refresh-lock.yml — weekly, opens a PR
- run: uv lock --upgrade
- run: uv sync --locked && uv run pytest -q
```

**★ Symptom: `uv lock --upgrade` refuses to move a package past a version you know is fine.** Cause: your
own ceiling — *"upgrades are limited to the project's dependency constraints. For example, if the project
defines an upper bound for a package then an upgrade will not go beyond that version."* Fix: retire the
ceiling in `pyproject.toml`, then re-lock; do not reach for an override for your own bound.

**★ Symptom: a dependency's maintainer yanked a broken release weeks ago and your locked deploys still install
it, with no warning.** Cause: PEP 592 keeps yanked files selectable when *"they are the only file that matches
a version specifier that "pins" to an exact version"* — and a lock is nothing but exact pins — while uv adds
*"when installing from a lockfile, uv will not provide warnings for yanked package versions."* Fix: re-resolve
the package deliberately, and make the audit part of CI so the next one is caught by a machine:

```bash
uv lock --upgrade-package httpx     # a fresh resolution for this package only
uv audit --frozen                   # checks the locked set without re-locking
```

**★ Symptom: a routine `uv lock --upgrade` produces a diff touching 140 packages and nobody can review it.**
Cause: `--upgrade` releases *every* preference at once — *"Allow package upgrades, ignoring pinned versions in
any existing output file."* Fix: upgrade in reviewable slices — the package with the advisory, then a group,
then the rest on a schedule:

```bash
uv lock --upgrade-package cryptography     # one package, everything else stays put
uv lock --upgrade-group test               # all packages in one dependency group
```

`--upgrade-group` is documented as *"Allow upgrades for all packages in a dependency group, ignoring pinned
versions in any existing output file"*; since uv 0.12.0 it must *"name an existing dependency group"*.

**Symptom: `uv lock` with no arguments reports nothing to do while PyPI clearly has newer releases.** Cause:
that is its contract — *"If there are no changes to the project's dependencies, locking will have no effect
unless the --upgrade flag is provided."* An existing lock is used *"as preferences for the resolution."* Fix:
say what you want to move:

```bash
uv lock --upgrade-package httpx
```

**Symptom: a security fix needs `urllib3` to move, and upgrading it drags a dozen unrelated packages
along.** Cause: the new version's own requirements forced them — preferences are released only for the packages
named, but anything whose locked version no longer satisfies the new graph must change. Fix: preview before you
commit, and read which packages moved and why:

```bash
uv lock --upgrade-package urllib3 --dry-run   # "report on the resulting changes … but will not write the lockfile"
uv tree --package urllib3 --invert            # who depends on it, and with what range
```

## Interview questions

**★ A lockfile never goes stale on its own. Why is that the right design?**
Because the alternative is an install that changes without anyone deciding it should. If a lock expired when
upstream published, two builds of the same commit a day apart could differ, and a bisect would stop being
meaningful: the code would be identical and the environment not. uv makes the choice explicit — *"uv will not
consider lockfiles outdated when new versions of packages are released"* — and pairs it with a minimal-upgrade
rule, preferring previously locked versions so that *"Package versions will only change if the project's
dependency constraints exclude the previous, locked version."* The cost is that currency becomes your job: a
scheduled upgrade, an audit, a bot. That is the correct division — the tool guarantees stability, you choose the
moment of change.

**★ Why is a yanked release still installed from a lock, and is that a bug?**
It is PEP 592 working as designed. Yanking is a soft withdrawal: *"Yanked files are always ignored, unless they
are the only file that matches a version specifier that "pins" to an exact version"*. The exception exists so
that people who pinned exactly — a lock is the extreme case — are not broken by a maintainer's decision. The
cost is that the pin keeps the bad release alive silently; uv says it *"will not provide warnings for yanked
package versions"* when installing from a lock. So the yank is information you have to go and fetch, by
re-resolving the package or auditing the lock.

**★ How do you upgrade exactly one package in a locked project, and what can still move?**
`uv lock --upgrade-package <name>` — or `<name>==<version>` for a specific target — which releases the
preference for that package and keeps every other locked version as a preference. What can still move is
anything the new version *forces*: if the upgraded package requires a newer version of a shared dependency than
the one locked, that dependency must change too, because a lock is one consistent resolution. `--dry-run` shows
the full set before anything is written, and it is worth reading in any upgrade that is supposed to be small.

**Why is a stale upper bound worse in a locked project than in an unlocked one?**
Because it disguises itself. In an unlocked project a ceiling at least shows up the day someone tries to install
the newer version and cannot. In a locked project nobody tries: upgrades go through `uv lock --upgrade`, and
*"In all cases, upgrades are limited to the project's dependency constraints … an upgrade will not go beyond that
version."* The upgrade "succeeds", the lock diff looks like a normal refresh, and the ceiling has silently held a
package back — possibly one with a security fix above the bound. Every ceiling therefore needs an owner and a
reason in a comment, and a scheduled job that resolves without it is the only thing that will tell you when it
started to bind.

---

← [17 · What a lock guarantees](17-what-a-lockfile-guarantees.md) · [Topic index](README.md) · Next → [17c · The lock is not the environment](17c-the-lock-is-not-the-environment.md)
