---
title: "A lock that nobody refreshes is a list of known vulnerabilities in waiting — refresh on a schedule, in slices a human can review, let a bot open the pull requests, and put a cooldown between a release and your resolution so the newest upload is never the one you trust first"
sidebar_label: "23 · Keeping a lock current"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Resolution** concepts (*Reproducible resolutions*, *Dependency
> cooldowns*) ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**), uv's
> **Using uv with Dependabot** guide ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/dependabot/)),
> uv's **CLI reference** for `uv lock` and `uv tree`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and the GitHub changelog entry *Dependabot version
> updates now support uv in general availability*, 2025-03-13
> ([github.blog](https://github.blog/changelog/2025-03-13-dependabot-version-updates-now-support-uv-in-general-availability/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**A lock trades currency for stability, on purpose ([17b](17b-a-lock-never-expires.md)): nothing moves unless
you move it. That makes refreshing a routine you have to build, and the routine has three parts that pull in
different directions. Upgrades must be *frequent*, or the eventual jump spans three majors and nobody can
review it. They must be *small*, or a regression cannot be traced to a package. And they must not be
*too fresh*, because the most dangerous version of any package is the one uploaded an hour ago — before
anyone has noticed it was published from a stolen token. uv gives you the pieces — targeted upgrades, a
resolution cutoff by upload time, and a bot integration — and this page assembles them into a policy.**

## Why bother, in uv's words

> *"It is considered best practice to regularly update dependencies, to avoid being exposed to vulnerabilities,
> limit incompatibilities between dependencies, and avoid complex upgrades when upgrading from a too old
> version."*

Three reasons, and the third is the one that bites teams that "only upgrade when something breaks": the cost of
an upgrade grows faster than linearly with its age, because every skipped release is a changelog you did not
read and a deprecation you did not see turn into a removal.

## Seeing what is behind

```bash
uv tree --outdated              # "Show the latest available version of each package in the tree"
uv tree --outdated --depth 1    # only your direct dependencies
```

Read it against your declared ranges: a package that is behind *and* capped by your own ceiling will not move no
matter how often you refresh ([06](06-floors-and-ceilings.md)).

## The refresh, in slices

The flags are in [17b](17b-a-lock-never-expires.md); the policy is to use the narrowest one that does the job:

| When | Command | Reviewable because |
|---|---|---|
| an advisory names a package | `uv lock --upgrade-package cryptography` | one package, plus whatever it forces |
| a toolchain refresh | `uv lock --upgrade-group test` | one group's packages |
| the scheduled sweep | `uv lock --upgrade` | run often enough that the diff stays small |

A scheduled sweep that runs weekly and opens a pull request — letting CI judge the result rather than a human
reading 140 version bumps:

```yaml
# .github/workflows/refresh-lock.yml
on:
  schedule: [{ cron: "0 6 * * 1" }]
  workflow_dispatch: {}
jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions: { contents: write, pull-requests: write }
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv lock --upgrade
      - run: uv sync --locked && uv run --locked pytest -q
      - uses: peter-evans/create-pull-request@v7
        with:
          branch: chore/refresh-lock
          title: "chore: weekly uv.lock refresh"
```

## Letting a bot do it

GitHub announced on 2025-03-13 that *"Dependabot version updates now support uv in general availability"*, and
uv documents the configuration:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "uv"
    directory: "/"
    schedule:
      interval: "weekly"
```

uv's guide is candid about the edges — *"Dependabot has announced support for uv, but there are some use cases
that are not yet working"* — and ⚠️ I could not confirm from GitHub's supported-ecosystems page whether Dependabot
*security* updates (as opposed to version updates) cover `uv.lock`; treat security alerts as something your own
audit step must catch ([23b](23b-auditing-and-where-packages-come-from.md)).

## A cooldown: never trust the newest upload first

Supply-chain attacks through a package index share a timeline: a malicious version is uploaded, installed by
whoever resolves in the next hours, and yanked once someone notices. A lock refreshed during that window
records it, and hashes then reproduce it faithfully ([17](17-what-a-lockfile-guarantees.md)). uv's answer acts
at resolution time:

> *"uv also supports dependency "cooldowns" in which resolution will ignore packages newer than a duration. This
> is a good way to improve security posture by delaying package updates until the community has had the
> opportunity to vet new versions of packages."*

```toml
[tool.uv]
exclude-newer = "1 week"
```

The semantics are precise, and every one of them matters:

- It compares **upload time per file**: *"The date is compared against the upload time of each individual
  distribution artifact (i.e., when each file was uploaded to the package index), not the release date of the
  package version."*
- It needs the index to publish that time: *"The package index must support the upload-time field as specified
  in PEP 700. If the field is not present for a given distribution, the distribution will be treated as
  unavailable"* — and *"PyPI provides upload-time for all packages."*
- It is silent about what it hides: *"messages for unsatisfiable resolutions will not mention that distributions
  were excluded due to the --exclude-newer flag — newer distributions will be treated as if they do not exist."*
- It only applies to registries: *"The --exclude-newer option is only applied to packages that are read from a
  registry (as opposed to, e.g., Git dependencies)."*
- It is frozen into the lock: *"When a duration is used for resolution, a timestamp is calculated relative to the
  current time. When using a uv.lock file, the timestamp is included in the lockfile. uv will not update the
  lockfile when the current time changes, instead, uv will update the timestamp when a new resolution is
  performed, e.g., when --upgrade or --refresh is used."*

Per-package and per-index overrides handle the exceptions — the urgent security fix you cannot wait a week for,
and the private index that publishes no upload times:

```toml
[tool.uv]
exclude-newer = "1 week"
exclude-newer-package = { cryptography = false }    # take the fix now; remove this line next week

[[tool.uv.index]]
name = "internal"
url = "https://internal.example.com/simple"
exclude-newer = false                               # no upload-time published here
```

*"Package-specific values will take precedence over both global and index-specific values."*

A bot must honour the same window, or it opens pull requests uv refuses to lock — uv's guide: *"set the
equivalent `cooldown` option in Dependabot, to avoid ending up with pull requests where uv would not be able to
lock the dependencies."*

```yaml
    cooldown:
      default-days: 7
```

## Reproducing a past resolution

The same option with an absolute timestamp answers "what would we have resolved on the day of the incident?":

> *"uv supports an --exclude-newer option to limit resolution to distributions uploaded before a specific date,
> allowing reproduction of installations regardless of new package releases."*

```bash
uv lock --exclude-newer 2026-08-01T00:00:00Z --dry-run
```

In persistent configuration the value must be unambiguous — *"When specified in persistent configuration, local
date times are not allowed."*

## Gotchas

**★ Symptom: a critical security release is out, and `uv lock --upgrade-package` insists the old version is the
newest available.** Cause: the cooldown — *"newer distributions will be treated as if they do not exist"*, and
the message does not say so. Fix: exempt that one package, temporarily and visibly:

```toml
[tool.uv]
exclude-newer-package = { cryptography = false }    # CVE fix; delete after 2026-09-17
```

**★ Symptom: Dependabot opens pull requests that fail CI with an unlockable resolution.** Cause: the bot
proposed a version newer than your `exclude-newer` window. Fix: the matching Dependabot cooldown, as uv's guide
prescribes:

```yaml
cooldown:
  default-days: 7
```

**★ Symptom: after adding a cooldown, every package from the company's private index becomes "unavailable".**
Cause: that index does not publish PEP 700 upload times, and *"the distribution will be treated as unavailable"*.
Fix: opt the index out:

```toml
[[tool.uv.index]]
name = "internal"
url = "https://internal.example.com/simple"
exclude-newer = false
```

**Symptom: a Git dependency pulled in a commit made yesterday despite a one-week cooldown.** Cause: *"The
--exclude-newer option is only applied to packages that are read from a registry (as opposed to, e.g., Git
dependencies)."* Fix: pin Git sources to a reviewed commit rather than a branch:

```toml
[tool.uv.sources]
acme-sdk = { git = "https://github.com/acme/sdk", rev = "4f2c1e9a7b3d5f60812c4e7a9b1d3f5e7a9c2b41" }
```

**Symptom: `exclude-newer = "2026-09-01"` in `pyproject.toml` is rejected.** Cause: *"When specified in
persistent configuration, local date times are not allowed"* — a bare date is resolved in the local time zone.
Fix: an RFC 3339 timestamp, or a duration:

```toml
exclude-newer = "2026-09-01T00:00:00Z"
```

**Symptom: the cooldown seems to have stopped rolling — a package uploaded three days ago is still excluded two
weeks later.** Cause: the cutoff is computed at resolution time and stored in the lock — *"uv will not update the
lockfile when the current time changes"*. Fix: nothing is wrong; the window advances on the next deliberate
resolution:

```bash
uv lock --upgrade            # recomputes the timestamp
```

**★ Symptom: upgrades happen twice a year and each one breaks something nobody can pin down.** Cause: the upgrade
spans dozens of releases per package; the regression could be anywhere. Fix: frequency, not heroics — a weekly
sweep that keeps each diff small, plus targeted upgrades for advisories:

```bash
uv lock --upgrade && uv sync --locked && uv run --locked pytest -q
```

**Symptom: the refresh job keeps proposing the same package and CI rejects it every week.** Cause: the new version
is genuinely incompatible, and nothing records the decision to skip it. Fix: record it where the resolver can see
it — an exclusion with a reason — and revisit on a date:

```toml
dependencies = [
  "sqlalchemy>=2.0,!=2.1.0",    # 2.1.0 breaks Session.merge; upstream issue #12345; revisit 2026-10
]
```

## Interview questions

**★ How often should a locked application update its dependencies, and how?**
Continuously, in small slices. A weekly `uv lock --upgrade` in a bot-opened pull request keeps each diff
reviewable and lets CI, not a human, judge it; advisories trigger an immediate `uv lock --upgrade-package` for the
affected package. uv's own guidance is that regular updates *"avoid being exposed to vulnerabilities, limit
incompatibilities between dependencies, and avoid complex upgrades when upgrading from a too old version."* The
failure mode of "only when something breaks" is that the upgrade you finally need spans years of changes and
cannot be bisected.

**★ What is a dependency cooldown, what does it protect against, and what does it cost?**
A resolution-time rule that ignores any file uploaded more recently than a duration — `exclude-newer = "1 week"`.
It protects against the short-lived malicious release: uv describes it as delaying updates *"until the community
has had the opportunity to vet new versions of packages."* It costs latency on fixes, and it is silent —
*"newer distributions will be treated as if they do not exist"* — so an urgent security release must be exempted
explicitly with `exclude-newer-package`. It also depends on the index publishing PEP 700 upload times and does
not apply to Git sources.

**Why must Dependabot's cooldown match uv's `exclude-newer`?**
Because they are two resolvers with two opinions. Dependabot picks a new version and asks uv to lock it; if that
version is inside uv's window, uv treats it as nonexistent and the lock fails. uv's guide says to set *"the
equivalent `cooldown` option in Dependabot, to avoid ending up with pull requests where uv would not be able to
lock the dependencies"* — so a one-week `exclude-newer` pairs with `cooldown: default-days: 7`.

**How would you reproduce the resolution your project would have produced on a past date?**
Resolve with an absolute cutoff: `uv lock --exclude-newer 2026-08-01T00:00:00Z --dry-run`. uv documents the
option as limiting resolution *"to distributions uploaded before a specific date, allowing reproduction of
installations regardless of new package releases"*, comparing each file's upload time. It is the tool for
incident archaeology when the historical lock was not kept — with the caveat that it only covers registry packages
and only indexes that publish upload times.

**Your scheduled refresh keeps failing on one package. What do you do?**
Record the decision in the declaration, not in someone's memory: exclude the incompatible version with `!=` and a
comment naming the upstream issue and a revisit date, so the refresh succeeds for everything else and the
exclusion is reviewed rather than forgotten. If the whole next major is incompatible, a ceiling with the same kind
of comment is the honest version — and it needs an owner, because *"upgrades are limited to the project's
dependency constraints"* and a forgotten ceiling silently stops every future refresh at the same place.

---

← [22c · Groups share one resolution](22c-groups-share-one-resolution.md) · [Topic index](README.md) · Next → [23b · Auditing and where packages come from](23b-auditing-and-where-packages-come-from.md)
